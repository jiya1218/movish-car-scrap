import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { safeDivide } from "@/lib/format";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.allowedModules.includes("locations")) {
      return NextResponse.json({ error: "Forbidden: Location analytics is restricted for your role" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const districtFilter = searchParams.get("district") || "All";
    const cityFilter = searchParams.get("city") || "All";
    const employeeFilter = searchParams.get("employeeId") || "All";
    const campaignFilter = searchParams.get("campaignId") || "All";
    const statusFilter = searchParams.get("status") || "All";
    const pinSearch = (searchParams.get("pinCode") || "").trim();

    const canViewFinance = canPerform(session, "finance:view");
    const canViewAds = canPerform(session, "meta_ads:view");

    const [leads, locations, campaigns, employees] = await Promise.all([
      prisma.lead.findMany({
        where: {
          isDeleted: false,
          ...(employeeFilter !== "All" ? { assignedEmployeeId: employeeFilter } : {}),
          ...(campaignFilter !== "All" ? { campaignId: campaignFilter } : {}),
          ...(statusFilter !== "All" ? { status: statusFilter } : {}),
        },
        include: {
          customer: true,
          campaign: { select: { id: true, name: true } },
          transactions: {
            where: { transactionStatus: { not: "Cancelled" } },
            include: {
              expenses: { where: { includedInPurchaseCost: false } },
              revenues: true,
            },
          },
        },
      }),
      prisma.location.findMany({ orderBy: [{ district: "asc" }, { city: "asc" }] }),
      prisma.campaign.findMany({
        include: { metrics: { select: { spend: true } } },
      }),
      prisma.employee.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    ]);

    const filteredLeads = leads.filter((l) => {
      if (districtFilter !== "All" && l.customer.district !== districtFilter) return false;
      if (cityFilter !== "All" && l.customer.city !== cityFilter) return false;
      if (pinSearch && !(l.customer.pinCode || "").includes(pinSearch)) return false;
      return true;
    });

    // Estimate ad spend attribution per campaign-lead proportionally where Meta campaign geo applies
    const campaignSpendPerLead = new Map<string, number>();
    for (const c of campaigns) {
      const totalSpend = c.metrics.reduce((s, m) => s + m.spend, 0);
      const cmpLeadCount = leads.filter((l) => l.campaignId === c.id).length;
      campaignSpendPerLead.set(c.id, safeDivide(totalSpend, cmpLeadCount));
    }

    type GeoAgg = {
      key: string;
      district: string;
      city: string;
      totalLeads: number;
      qualifiedLeads: number;
      completedTransactions: number;
      estimatedAdSpend: number;
      purchaseSpend: number;
      operationalExpenses: number;
      realization: number;
      pinCodes: Set<string>;
    };

    const byDistrict = new Map<string, GeoAgg>();
    const byCity = new Map<string, GeoAgg>();

    const accumulate = (map: Map<string, GeoAgg>, key: string, district: string, city: string, l: (typeof filteredLeads)[number]) => {
      const row = map.get(key) ?? {
        key,
        district,
        city,
        totalLeads: 0,
        qualifiedLeads: 0,
        completedTransactions: 0,
        estimatedAdSpend: 0,
        purchaseSpend: 0,
        operationalExpenses: 0,
        realization: 0,
        pinCodes: new Set<string>(),
      };
      row.totalLeads += 1;
      if (l.qualificationStatus === "Qualified") row.qualifiedLeads += 1;
      if (l.status === "Completed") row.completedTransactions += 1;
      if (l.campaignId) row.estimatedAdSpend += campaignSpendPerLead.get(l.campaignId) ?? 0;
      if (l.customer.pinCode) row.pinCodes.add(l.customer.pinCode);

      for (const t of l.transactions) {
        row.purchaseSpend += t.vehiclePurchaseAmount;
        row.operationalExpenses += t.expenses.reduce((s, e) => s + e.amount, 0);
        row.realization += t.revenues.reduce((s, r) => s + r.amount, 0);
      }
      map.set(key, row);
    };

    for (const l of filteredLeads) {
      accumulate(byDistrict, l.customer.district, l.customer.district, l.customer.district, l);
      accumulate(byCity, `${l.customer.city}|${l.customer.district}`, l.customer.district, l.customer.city, l);
    }

    const finalize = (map: Map<string, GeoAgg>) =>
      Array.from(map.values())
        .map((r) => {
          const netProfit = r.realization - r.purchaseSpend - r.operationalExpenses;
          return {
            key: r.key,
            district: r.district,
            city: r.city,
            pinCodes: Array.from(r.pinCodes),
            totalLeads: r.totalLeads,
            qualifiedLeads: r.qualifiedLeads,
            completedTransactions: r.completedTransactions,
            conversionRate: Number((safeDivide(r.completedTransactions, r.totalLeads) * 100).toFixed(1)),
            adSpend: canViewAds ? Math.round(r.estimatedAdSpend) : null,
            cpl: canViewAds ? Math.round(safeDivide(r.estimatedAdSpend, r.totalLeads)) : null,
            purchaseExpenditure: canViewFinance ? Math.round(r.purchaseSpend) : null,
            netProfit: canViewFinance ? Math.round(netProfit) : null,
          };
        })
        .sort((a, b) => b.totalLeads - a.totalLeads);

    const districtRows = finalize(byDistrict);
    const cityRows = finalize(byCity);

    const insights = {
      topEnquiryCity: cityRows[0]?.city ?? "—",
      topQualifiedCity: [...cityRows].sort((a, b) => b.qualifiedLeads - a.qualifiedLeads)[0]?.city ?? "—",
      topCompletedCity: [...cityRows].sort((a, b) => b.completedTransactions - a.completedTransactions)[0]?.city ?? "—",
      lowestConversionCity: [...cityRows].filter((c) => c.totalLeads >= 3).sort((a, b) => a.conversionRate - b.conversionRate)[0]?.city ?? "—",
      highestSpendCity: canViewAds ? [...cityRows].sort((a, b) => (b.adSpend ?? 0) - (a.adSpend ?? 0))[0]?.city ?? "—" : "Restricted",
      mostProfitableCity: canViewFinance ? [...cityRows].sort((a, b) => (b.netProfit ?? 0) - (a.netProfit ?? 0))[0]?.city ?? "—" : "Restricted",
    };

    return NextResponse.json({
      districtRows,
      cityRows,
      locations,
      insights,
      options: {
        campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
        employees,
      },
    });
  } catch (err) {
    console.error("Locations GET error:", err);
    return NextResponse.json({ error: "Failed to load Gujarat location analytics" }, { status: 500 });
  }
}
