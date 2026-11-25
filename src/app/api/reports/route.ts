import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { computeAdMetrics, safeDivide } from "@/lib/format";
import { STAGE_INDEX } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "reports:view")) {
      return NextResponse.json({ error: "Forbidden: Reports access restricted for this role" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.max(1, Number(searchParams.get("days") || 60));
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const canViewAds = canPerform(session, "meta_ads:view");
    const canViewFinance = canPerform(session, "finance:view");
    const canExport = canPerform(session, "reports:export");

    const [campaigns, leads, vehicles, transactions, expenses, revenues, employees, followUps] = await Promise.all([
      canViewAds ? prisma.campaign.findMany({ include: { metrics: { where: { date: { gte: start } } } } }) : Promise.resolve([]),
      prisma.lead.findMany({
        where: { isDeleted: false, enquiryDate: { gte: start } },
        include: { customer: true, leadSource: true, campaign: { select: { name: true } }, assignedEmployee: { select: { fullName: true } } },
      }),
      prisma.vehicle.findMany({
        include: {
          customer: { select: { name: true, city: true } },
          inspections: true,
          pickups: true,
          documents: true,
          inventory: true,
        },
      }),
      canViewFinance
        ? prisma.transaction.findMany({
            where: { transactionDate: { gte: start }, transactionStatus: { not: "Cancelled" } },
            include: {
              customer: { select: { name: true, city: true } },
              vehicle: { select: { vehicleCode: true, registrationNumber: true, model: true } },
              expenses: { where: { includedInPurchaseCost: false } },
              revenues: true,
            },
          })
        : Promise.resolve([]),
      canViewFinance ? prisma.expense.findMany({ where: { date: { gte: start }, includedInPurchaseCost: false } }) : Promise.resolve([]),
      canViewFinance ? prisma.revenue.findMany({ where: { date: { gte: start } } }) : Promise.resolve([]),
      prisma.employee.findMany({
        include: {
          role: { select: { name: true } },
          assignedLeads: { where: { isDeleted: false, enquiryDate: { gte: start } } },
          followUps: true,
        },
      }),
      prisma.followUp.findMany({ where: { createdAt: { gte: start } } }),
    ]);

    const marketingReport = campaigns.map((c) => {
      const spend = c.metrics.reduce((s, m) => s + m.spend, 0);
      const impressions = c.metrics.reduce((s, m) => s + m.impressions, 0);
      const reach = c.metrics.reduce((s, m) => s + m.reach, 0);
      const clicks = c.metrics.reduce((s, m) => s + m.linkClicks, 0);
      const cLeads = leads.filter((l) => l.campaignId === c.id);
      const qualified = cLeads.filter((l) => l.qualificationStatus === "Qualified").length;
      const completed = cLeads.filter((l) => l.status === "Completed").length;
      const calc = computeAdMetrics({ spend, impressions, reach, clicks, leads: cLeads.length, qualifiedLeads: qualified, completedTransactions: completed });
      return {
        campaignCode: c.campaignCode,
        name: c.name,
        platform: c.platform,
        spend: Math.round(spend),
        impressions,
        reach,
        clicks,
        ctr: Number(calc.ctr.toFixed(2)),
        cpc: Math.round(calc.cpc),
        cpm: Math.round(calc.cpm),
        leads: cLeads.length,
        cpl: Math.round(calc.cpl),
        qualified,
        completed,
        cpct: Math.round(calc.cpct),
      };
    });

    const crmSummary = {
      totalLeads: leads.length,
      newLeads: leads.filter((l) => l.status === "New").length,
      contacted: leads.filter((l) => (STAGE_INDEX[l.status] ?? 0) >= 2 && l.status !== "Lost").length,
      interested: leads.filter((l) => (STAGE_INDEX[l.status] ?? 0) >= 3 && l.status !== "Lost").length,
      qualified: leads.filter((l) => l.qualificationStatus === "Qualified").length,
      lost: leads.filter((l) => l.status === "Lost").length,
      duplicates: leads.filter((l) => l.isDuplicate).length,
      completed: leads.filter((l) => l.status === "Completed").length,
      conversionRate: Number((safeDivide(leads.filter((l) => l.status === "Completed").length, leads.length) * 100).toFixed(2)),
      followUpTotal: followUps.length,
      followUpCompleted: followUps.filter((f) => f.status === "Completed").length,
    };

    const financeReport = transactions.map((t) => {
      const exp = t.expenses.reduce((s, e) => s + e.amount, 0);
      const rev = t.revenues.reduce((s, r) => s + r.amount, 0);
      return {
        transactionCode: t.transactionCode,
        vehicle: `${t.vehicle.vehicleCode} (${t.vehicle.registrationNumber})`,
        model: t.vehicle.model,
        city: t.customer.city,
        purchaseCost: t.vehiclePurchaseAmount,
        expenses: exp,
        realization: rev,
        netProfit: rev - t.vehiclePurchaseAmount - exp,
        status: t.transactionStatus,
        date: t.transactionDate,
      };
    });

    const financeTotals = {
      purchaseCost: transactions.reduce((s, t) => s + t.vehiclePurchaseAmount, 0),
      operationalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
      realization: revenues.reduce((s, r) => s + r.amount, 0),
    };

    const operationsReport = vehicles.map((v) => ({
      vehicleCode: v.vehicleCode,
      registrationNumber: v.registrationNumber,
      vehicle: `${v.manufacturer} ${v.model} (${v.manufacturingYear})`,
      city: v.locationCity,
      inspections: v.inspections.length,
      pickupStatus: v.pickups[0]?.pickupStatus ?? "Not Scheduled",
      docsVerified: `${v.documents.filter((d) => d.verificationStatus === "Verified").length}/${v.documents.length}`,
      processingStatus: v.inventory?.processingStatus ?? "Pre-Collection",
      purchaseStatus: v.purchaseStatus,
    }));

    const teamReport = employees.map((e) => {
      const assigned = e.assignedLeads.length;
      const completed = e.assignedLeads.filter((l) => l.status === "Completed").length;
      const fuCompleted = e.followUps.filter((f) => f.status === "Completed").length;
      return {
        employeeCode: e.employeeCode,
        name: e.fullName,
        role: e.role.name,
        city: e.assignedCity,
        assignedLeads: assigned,
        qualifiedLeads: e.assignedLeads.filter((l) => l.qualificationStatus === "Qualified").length,
        completedDeals: completed,
        conversionRate: Number((safeDivide(completed, assigned) * 100).toFixed(1)),
        followUpsCompleted: fuCompleted,
        monthlyTarget: e.monthlyCompletedTarget,
        targetAchievementPct: Number((safeDivide(completed, e.monthlyCompletedTarget || 1) * 100).toFixed(1)),
      };
    });

    return NextResponse.json({
      permissions: { canViewAds, canViewFinance, canExport },
      marketingReport,
      crmSummary,
      crmLeads: leads.map((l) => ({
        leadCode: l.leadCode,
        customerName: l.customer.name,
        city: l.customer.city,
        source: l.leadSource.name,
        campaign: l.campaign?.name ?? "Direct",
        status: l.status,
        priority: l.priority,
        assignee: l.assignedEmployee?.fullName ?? "Unassigned",
        enquiryDate: l.enquiryDate,
      })),
      financeReport,
      financeTotals: canViewFinance
        ? {
            ...financeTotals,
            netProfit: financeTotals.realization - financeTotals.purchaseCost - financeTotals.operationalExpenses,
          }
        : null,
      operationsReport,
      teamReport,
    });
  } catch (err) {
    console.error("Reports GET error:", err);
    return NextResponse.json({ error: "Failed to build reports" }, { status: 500 });
  }
}
