import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { createNotification, logAudit } from "@/lib/audit";
import { safeDivide } from "@/lib/format";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "finance:view")) {
      return NextResponse.json({ error: "Forbidden: Financial records restricted" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const paymentStatus = searchParams.get("paymentStatus") || "All";
    const category = searchParams.get("category") || "All";
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const dateFilter =
      fromParam || toParam
        ? {
            ...(fromParam ? { gte: new Date(fromParam) } : {}),
            ...(toParam ? { lte: new Date(toParam) } : {}),
          }
        : undefined;

    const [transactions, expenses, revenues, payments, vehicles, employees] = await Promise.all([
      prisma.transaction.findMany({
        where: dateFilter ? { transactionDate: dateFilter } : {},
        include: {
          customer: { select: { id: true, name: true, city: true, district: true } },
          vehicle: { select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true, inventory: { select: { estimatedValue: true } } } },
          expenses: true,
          revenues: true,
          payments: true,
        },
        orderBy: { transactionDate: "desc" },
      }),
      prisma.expense.findMany({
        where: dateFilter ? { date: dateFilter } : {},
        include: {
          vehicle: { select: { vehicleCode: true, registrationNumber: true } },
          transaction: { select: { transactionCode: true } },
          enteredBy: { select: { fullName: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.revenue.findMany({
        where: dateFilter ? { date: dateFilter } : {},
        include: {
          vehicle: { select: { vehicleCode: true, registrationNumber: true, manufacturer: true, model: true } },
          transaction: { select: { transactionCode: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.payment.findMany({
        where: dateFilter ? { paymentDate: dateFilter } : {},
        include: {
          vehicle: { select: { vehicleCode: true, registrationNumber: true } },
          transaction: { select: { transactionCode: true } },
          recordedBy: { select: { fullName: true } },
        },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.vehicle.findMany({
        select: { id: true, vehicleCode: true, registrationNumber: true, manufacturer: true, model: true, customerId: true, leadId: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employee.findMany({ where: { accountStatus: "Active" }, select: { id: true, fullName: true } }),
    ]);

    const activeTxns = transactions.filter((t) => t.transactionStatus !== "Cancelled");
    const totalPurchaseCost = activeTxns.reduce((s, t) => s + t.vehiclePurchaseAmount, 0);
    // Avoid double-counting expenses flagged includedInPurchaseCost (PRD Sec 12.5)
    const totalOperationalExpenses = expenses
      .filter((e) => !e.includedInPurchaseCost)
      .reduce((s, e) => s + e.amount, 0);
    const totalRealization = revenues.reduce((s, r) => s + r.amount, 0);
    const estimatedInventoryValue = activeTxns
      .filter((t) => t.transactionStatus !== "Completed")
      .reduce((s, t) => s + (t.vehicle.inventory?.estimatedValue ?? 0), 0);

    const grossMargin = totalRealization - totalPurchaseCost;
    const netProfit = totalRealization - totalPurchaseCost - totalOperationalExpenses;
    const completedCount = activeTxns.filter((t) => t.transactionStatus === "Completed").length;
    const averagePurchaseCost = safeDivide(totalPurchaseCost, activeTxns.length);
    const averageNetProfit = safeDivide(netProfit, completedCount || activeTxns.length);
    const profitMargin = safeDivide(netProfit, totalRealization) * 100;

    const filteredTxns = transactions.filter((t) => {
      if (paymentStatus !== "All" && t.paymentStatus !== paymentStatus) return false;
      if (search) {
        const hay = `${t.transactionCode} ${t.customer.name} ${t.customer.city} ${t.vehicle.registrationNumber} ${t.vehicle.model}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    const filteredExpenses = expenses.filter((e) => {
      if (category !== "All" && e.category !== category) return false;
      if (search) {
        const hay = `${e.expenseCode} ${e.category} ${e.notes || ""} ${e.vehicle?.registrationNumber || ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return NextResponse.json({
      summary: {
        totalPurchaseCost,
        totalOperationalExpenses,
        totalRealization,
        estimatedInventoryValue,
        grossMargin,
        netProfit,
        averagePurchaseCost,
        averageNetProfit,
        profitMargin,
        totalTransactions: activeTxns.length,
        completedTransactions: completedCount,
      },
      transactions: filteredTxns,
      expenses: filteredExpenses,
      revenues,
      payments,
      options: { vehicles, employees },
    });
  } catch (err) {
    console.error("Transactions GET error:", err);
    return NextResponse.json({ error: "Failed to load financial records" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "finance:manage")) {
      return NextResponse.json({ error: "Forbidden: Accounts permission required" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "create_expense") {
      const count = await prisma.expense.count();
      const expense = await prisma.expense.create({
        data: {
          expenseCode: `EXP-${String(count + 1).padStart(4, "0")}`,
          category: String(body.category || "Other"),
          amount: Number(body.amount),
          date: body.date ? new Date(body.date) : new Date(),
          transactionId: body.transactionId || null,
          vehicleId: body.vehicleId || null,
          paymentMethod: String(body.paymentMethod || "Bank Transfer"),
          reference: body.reference || null,
          enteredById: session.employeeId,
          includedInPurchaseCost: Boolean(body.includedInPurchaseCost),
          notes: body.notes || null,
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "EXPENSE_RECORDED",
        entityType: "Expense",
        entityId: expense.id,
        summary: `Recorded expense ${expense.expenseCode} (${expense.category}: ₹${expense.amount})`,
      });
      return NextResponse.json({ expense }, { status: 201 });
    }

    if (action === "create_revenue") {
      const count = await prisma.revenue.count();
      const revenue = await prisma.revenue.create({
        data: {
          revenueCode: `REV-${String(count + 1).padStart(4, "0")}`,
          source: String(body.source || "Scrap material sales"),
          vehicleId: body.vehicleId || null,
          transactionId: body.transactionId || null,
          amount: Number(body.amount),
          date: body.date ? new Date(body.date) : new Date(),
          buyer: body.buyer || null,
          paymentStatus: String(body.paymentStatus || "Paid"),
          notes: body.notes || null,
        },
      });

      if (body.transactionId) {
        const txnRevs = await prisma.revenue.findMany({ where: { transactionId: String(body.transactionId) } });
        const totalRev = txnRevs.reduce((s, r) => s + r.amount, 0);
        await prisma.transaction.update({
          where: { id: String(body.transactionId) },
          data: { realizationValue: totalRev, transactionStatus: "Completed" },
        });
      }

      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "REVENUE_RECORDED",
        entityType: "Revenue",
        entityId: revenue.id,
        summary: `Recorded realization ${revenue.revenueCode} (${revenue.source}: ₹${revenue.amount})`,
      });
      return NextResponse.json({ revenue }, { status: 201 });
    }

    if (action === "create_transaction") {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: String(body.vehicleId) } });
      if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

      const count = await prisma.transaction.count();
      const txn = await prisma.transaction.create({
        data: {
          transactionCode: `TXN-${String(count + 1).padStart(4, "0")}`,
          leadId: vehicle.leadId,
          customerId: vehicle.customerId,
          vehicleId: vehicle.id,
          vehiclePurchaseAmount: Number(body.vehiclePurchaseAmount),
          paymentStatus: String(body.paymentStatus || "Pending"),
          paymentMethod: String(body.paymentMethod || "NEFT / IMPS"),
          paymentReference: body.paymentReference || null,
          transactionStatus: String(body.transactionStatus || "Open"),
          remarks: body.remarks || null,
        },
      });

      await createNotification({
        title: `Transaction ${txn.transactionCode} Created`,
        description: `Purchase ₹${txn.vehiclePurchaseAmount} for ${vehicle.registrationNumber}`,
        category: "Transaction completed",
        relatedModule: "transactions",
        relatedRecordId: txn.id,
      });

      return NextResponse.json({ transaction: txn }, { status: 201 });
    }

    if (action === "update_payment_status") {
      const txn = await prisma.transaction.update({
        where: { id: String(body.transactionId) },
        data: {
          paymentStatus: String(body.paymentStatus),
          ...(body.paymentReference ? { paymentReference: String(body.paymentReference) } : {}),
          ...(body.transactionStatus ? { transactionStatus: String(body.transactionStatus) } : {}),
        },
      });
      const payCount = await prisma.payment.count();
      await prisma.payment.create({
        data: {
          paymentCode: `PAY-${String(payCount + 1).padStart(4, "0")}`,
          transactionId: txn.id,
          vehicleId: txn.vehicleId,
          direction: "Outbound",
          amount: Number(body.amount || txn.vehiclePurchaseAmount),
          paymentMethod: String(body.paymentMethod || txn.paymentMethod),
          paymentReference: body.paymentReference || txn.paymentReference,
          status: String(body.paymentStatus),
          recordedById: session.employeeId,
          notes: body.notes || `Updated transaction payment status to ${body.paymentStatus}`,
        },
      });
      await logAudit({
        actorUserId: session.userId,
        actorName: session.name,
        action: "PAYMENT_UPDATED",
        entityType: "Transaction",
        entityId: txn.id,
        summary: `Updated payment for ${txn.transactionCode} to ${txn.paymentStatus}`,
      });
      return NextResponse.json({ transaction: txn });
    }

    return NextResponse.json({ error: "Unsupported finance action" }, { status: 400 });
  } catch (err) {
    console.error("Transactions POST error:", err);
    return NextResponse.json({ error: "Failed to record financial entry" }, { status: 500 });
  }
}
