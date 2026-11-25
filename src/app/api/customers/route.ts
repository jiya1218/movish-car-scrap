import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const district = searchParams.get("district") || "All";
    const repeatOnly = searchParams.get("repeatOnly") === "true";

    const customers = await prisma.customer.findMany({
      include: {
        leads: { where: { isDeleted: false }, select: { id: true, leadCode: true, status: true, enquiryDate: true } },
        vehicles: { select: { id: true, vehicleCode: true, manufacturer: true, model: true, registrationNumber: true, purchaseStatus: true } },
        transactions: { select: { id: true, transactionCode: true, vehiclePurchaseAmount: true, transactionStatus: true } },
        communicationLogs: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const canViewFinance = canPerform(session, "finance:view");

    const enriched = customers
      .map((c) => {
        const isRepeat = c.leads.length > 1 || c.vehicles.length > 1;
        return {
          ...c,
          leadCount: c.leads.length,
          vehicleCount: c.vehicles.length,
          transactionCount: c.transactions.length,
          interactionCount: c.communicationLogs.length,
          isRepeat,
          totalPurchaseValue: canViewFinance
            ? c.transactions.reduce((s, t) => s + t.vehiclePurchaseAmount, 0)
            : null,
        };
      })
      .filter((c) => {
        if (district !== "All" && c.district !== district) return false;
        if (repeatOnly && !c.isRepeat) return false;
        if (search) {
          const hay = `${c.customerCode} ${c.name} ${c.primaryMobile} ${c.email || ""} ${c.city} ${c.district} ${c.pinCode || ""}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

    return NextResponse.json({
      customers: enriched,
      summary: {
        total: customers.length,
        repeatCustomers: customers.filter((c) => c.leads.length > 1 || c.vehicles.length > 1).length,
        withVehicles: customers.filter((c) => c.vehicles.length > 0).length,
      },
    });
  } catch (err) {
    console.error("Customers GET error:", err);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "customers:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const primaryMobile = String(body.primaryMobile ?? "").trim();
    if (!name || !primaryMobile) {
      return NextResponse.json({ error: "Customer name and mobile are required." }, { status: 400 });
    }

    const existing = await prisma.customer.findFirst({ where: { primaryMobile } });
    if (existing) {
      return NextResponse.json({ error: `Customer ${existing.customerCode} already exists with this mobile.` }, { status: 409 });
    }

    const count = await prisma.customer.count();
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUS-${String(count + 1).padStart(4, "0")}`,
        name,
        primaryMobile,
        altMobile: body.altMobile || null,
        email: body.email || null,
        customerType: body.customerType || "Individual",
        state: "Gujarat",
        district: String(body.district || "Ahmedabad"),
        city: String(body.city || "Ahmedabad"),
        area: body.area || null,
        pinCode: body.pinCode || null,
        fullAddress: body.fullAddress || null,
        preferredContactMethod: body.preferredContactMethod || "Phone Call",
        notes: body.notes || null,
      },
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "CUSTOMER_CREATED",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Created customer ${customer.customerCode} (${customer.name})`,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    console.error("Customers POST error:", err);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
