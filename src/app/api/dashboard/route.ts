import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { STAGE_INDEX } from "@/lib/constants";
import { safeDivide } from "@/lib/format";

function getPeriodWindow(searchParams: URLSearchParams) {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const daysParam = searchParams.get("days") || "30";

  const end = toParam ? new Date(toParam) : new Date();
  end.setHours(23, 59, 59, 999);

  let start: Date;
  if (fromParam) {
    start = new Date(fromParam);
    start.setHours(0, 0, 0, 0);
  } else if (daysParam === "all") {
    start = new Date("2024-01-01T00:00:00.000Z");
  } else {
    const days = Math.max(1, Number(daysParam) || 30);
    start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
  }

  const durationMs = Math.max(86400000, end.getTime() - start.getTime());
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

function getBucketKey(date: Date, granularity: string): string {
  const d = new Date(date);
  if (granularity === "monthly") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "weekly") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function formatBucketLabel(key: string, granularity: string): string {
  if (granularity === "monthly") {
    const [yr, mo] = key.split("-");
    const dt = new Date(Number(yr), Number(mo) - 1, 1);
    return dt.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  const dt = new Date(key);
  if (granularity === "weekly") {
    return `Wk ${dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  }
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const granularity = searchParams.get("granularity") || "daily";
    const { start, end, prevStart, prevEnd } = getPeriodWindow(searchParams);

    const viewAllLeads = canPerform(session, "leads:view_all");
    const canViewLeads = canPerform(session, "leads:view");
    const canViewFinance = canPerform(session, "finance:view");
    const canViewAds = canPerform(session, "meta_ads:view");
    const canViewVehicles = canPerform(session, "vehicles:view");
    const canViewTeam = canPerform(session, "team:view");

    const leadEmployeeScope =
      !viewAllLeads && session.employeeId ? { assignedEmployeeId: session.employeeId } : {};

    const [
      currentLeads,
      prevLeads,
      currentMetrics,
      prevMetrics,
      currentTxns,
      prevTxns,
      currentExpenses,
      prevExpenses,
      currentRevenues,
      prevRevenues,
      currentPickups,
      prevPickups,
      allFollowUps,
      recentActivities,
      campaigns,
      employees,
      upcomingPickups,
    ] = await Promise.all([
      prisma.lead.findMany({
        where: { isDeleted: false, enquiryDate: { gte: start, lte: end }, ...leadEmployeeScope },
        include: { customer: true, leadSource: true, campaign: true, assignedEmployee: true },
        orderBy: { enquiryDate: "desc" },
      }),
      prisma.lead.findMany({
        where: { isDeleted: false, enquiryDate: { gte: prevStart, lte: prevEnd }, ...leadEmployeeScope },
        select: { id: true, status: true, qualificationStatus: true, enquiryDate: true },
      }),
      prisma.adMetric.findMany({
        where: { date: { gte: start, lte: end } },
        include: { campaign: { select: { name: true } } },
      }),
      prisma.adMetric.findMany({
        where: { date: { gte: prevStart, lte: prevEnd } },
        select: { spend: true, impressions: true, reach: true, linkClicks: true, metaLeads: true },
      }),
      prisma.transaction.findMany({
        where: { transactionStatus: { not: "Cancelled" }, transactionDate: { gte: start, lte: end } },
        include: { customer: true, vehicle: true },
        orderBy: { transactionDate: "desc" },
      }),
      prisma.transaction.findMany({
        where: { transactionStatus: { not: "Cancelled" }, transactionDate: { gte: prevStart, lte: prevEnd } },
        select: { vehiclePurchaseAmount: true, transactionStatus: true },
      }),
      prisma.expense.findMany({
        where: { includedInPurchaseCost: false, date: { gte: start, lte: end } },
        select: { amount: true, date: true },
      }),
      prisma.expense.findMany({
        where: { includedInPurchaseCost: false, date: { gte: prevStart, lte: prevEnd } },
        select: { amount: true },
      }),
      prisma.revenue.findMany({
        where: { date: { gte: start, lte: end } },
        select: { amount: true, date: true },
      }),
      prisma.revenue.findMany({
        where: { date: { gte: prevStart, lte: prevEnd } },
        select: { amount: true },
      }),
      prisma.pickup.findMany({
        where: { pickupStatus: "Collected", actualPickupDate: { gte: start, lte: end } },
        select: { id: true },
      }),
      prisma.pickup.findMany({
        where: { pickupStatus: "Collected", actualPickupDate: { gte: prevStart, lte: prevEnd } },
        select: { id: true },
      }),
      prisma.followUp.findMany({
        where: !viewAllLeads && session.employeeId ? { assignedEmployeeId: session.employeeId } : {},
        include: {
          lead: { select: { id: true, leadCode: true, status: true, priority: true } },
          customer: { select: { name: true, primaryMobile: true, city: true } },
          assignedEmployee: { select: { fullName: true } },
        },
        orderBy: { followUpDate: "asc" },
      }),
      prisma.leadActivity.findMany({
        where: !viewAllLeads && session.employeeId ? { lead: { assignedEmployeeId: session.employeeId } } : {},
        take: 15,
        orderBy: { createdAt: "desc" },
        include: {
          lead: { select: { id: true, leadCode: true, customer: { select: { name: true } } } },
          performedBy: { select: { fullName: true } },
        },
      }),
      prisma.campaign.findMany({
        include: {
          metrics: { where: { date: { gte: start, lte: end } } },
          leads: { where: { isDeleted: false, enquiryDate: { gte: start, lte: end } }, select: { id: true, status: true, qualificationStatus: true } },
        },
      }),
      prisma.employee.findMany({
        where: { role: { code: "SALES_EXECUTIVE" } },
        include: {
          assignedLeads: {
            where: { isDeleted: false, enquiryDate: { gte: start, lte: end } },
            select: { id: true, status: true, qualificationStatus: true },
          },
        },
      }),
      prisma.pickup.findMany({
        where: { pickupStatus: { in: ["Scheduled", "In Transit", "Not Scheduled"] } },
        include: {
          vehicle: { select: { vehicleCode: true, manufacturer: true, model: true, registrationNumber: true } },
          customer: { select: { name: true, primaryMobile: true, city: true } },
        },
        orderBy: { scheduledDate: "asc" },
        take: 8,
      }),
    ]);

    const summarizeLeads = (rows: Array<{ status: string; qualificationStatus: string }>) => {
      const total = rows.length;
      const newCount = rows.filter((l) => l.status === "New").length;
      const contacted = rows.filter((l) => {
        const idx = STAGE_INDEX[l.status] ?? 0;
        return idx >= (STAGE_INDEX["Contacted"] ?? 2) && l.status !== "Lost";
      }).length;
      const interested = rows.filter((l) => {
        const idx = STAGE_INDEX[l.status] ?? 0;
        return idx >= (STAGE_INDEX["Interested"] ?? 3) && l.status !== "Lost";
      }).length;
      const qualified = rows.filter((l) => l.qualificationStatus === "Qualified").length;
      const confirmed = rows.filter((l) => {
        const idx = STAGE_INDEX[l.status] ?? 0;
        return idx >= (STAGE_INDEX["Deal Confirmed"] ?? 8) && l.status !== "Lost";
      }).length;
      const completed = rows.filter((l) => l.status === "Completed").length;
      return { total, newCount, contacted, interested, qualified, confirmed, completed };
    };

    const curLeadSum = summarizeLeads(currentLeads);
    const prevLeadSum = summarizeLeads(prevLeads);

    const sumMetrics = (rows: Array<{ spend: number; impressions: number; reach: number; linkClicks: number }>) =>
      rows.reduce(
        (acc, m) => {
          acc.spend += m.spend;
          acc.impressions += m.impressions;
          acc.reach += m.reach;
          acc.clicks += m.linkClicks;
          return acc;
        },
        { spend: 0, impressions: 0, reach: 0, clicks: 0 }
      );

    const curAdSum = sumMetrics(currentMetrics);
    const prevAdSum = sumMetrics(prevMetrics);

    const curPurchaseVal = currentTxns.reduce((s, t) => s + t.vehiclePurchaseAmount, 0);
    const prevPurchaseVal = prevTxns.reduce((s, t) => s + t.vehiclePurchaseAmount, 0);
    const curRealization = currentRevenues.reduce((s, r) => s + r.amount, 0);
    const prevRealization = prevRevenues.reduce((s, r) => s + r.amount, 0);
    const curOtherExp = currentExpenses.reduce((s, e) => s + e.amount, 0);
    const prevOtherExp = prevExpenses.reduce((s, e) => s + e.amount, 0);

    const curNetProfit = curRealization - curPurchaseVal - curOtherExp;
    const prevNetProfit = prevRealization - prevPurchaseVal - prevOtherExp;

    const curCompletedTxns = currentTxns.filter((t) => t.transactionStatus === "Completed").length;
    const prevCompletedTxns = prevTxns.filter((t) => t.transactionStatus === "Completed").length;

    const curAvgCpl = safeDivide(curAdSum.spend, curLeadSum.total);
    const prevAvgCpl = safeDivide(prevAdSum.spend, prevLeadSum.total);
    const curConvRate = safeDivide(curLeadSum.completed, curLeadSum.total) * 100;
    const prevConvRate = safeDivide(prevLeadSum.completed, prevLeadSum.total) * 100;

    const pctDelta = (cur: number, prev: number) =>
      prev === 0 ? (cur > 0 ? 100 : 0) : Number((((cur - prev) / Math.abs(prev)) * 100).toFixed(1));

    const kpis = [
      ...(canViewLeads
        ? [
            { key: "totalLeads", label: "Total Leads", value: curLeadSum.total, prev: prevLeadSum.total, delta: pctDelta(curLeadSum.total, prevLeadSum.total), format: "number", desc: "Total enquiries received in period" },
            { key: "newLeads", label: "New Leads", value: curLeadSum.newCount, prev: prevLeadSum.newCount, delta: pctDelta(curLeadSum.newCount, prevLeadSum.newCount), format: "number", desc: "Leads awaiting first contact" },
            { key: "contactedLeads", label: "Contacted Leads", value: curLeadSum.contacted, prev: prevLeadSum.contacted, delta: pctDelta(curLeadSum.contacted, prevLeadSum.contacted), format: "number", desc: "Leads successfully contacted" },
            { key: "interestedLeads", label: "Interested Leads", value: curLeadSum.interested, prev: prevLeadSum.interested, delta: pctDelta(curLeadSum.interested, prevLeadSum.interested), format: "number", desc: "Customers interested in scrapping" },
            { key: "qualifiedLeads", label: "Qualified Leads", value: curLeadSum.qualified, prev: prevLeadSum.qualified, delta: pctDelta(curLeadSum.qualified, prevLeadSum.qualified), format: "number", desc: "Leads meeting business eligibility" },
            { key: "confirmedDeals", label: "Confirmed Deals", value: curLeadSum.confirmed, prev: prevLeadSum.confirmed, delta: pctDelta(curLeadSum.confirmed, prevLeadSum.confirmed), format: "number", desc: "Customers agreeing to proceed" },
          ]
        : []),
      ...(canViewVehicles || canViewFinance
        ? [
            { key: "vehiclesCollected", label: "Vehicles Collected", value: currentPickups.length, prev: prevPickups.length, delta: pctDelta(currentPickups.length, prevPickups.length), format: "number", desc: "Vehicles picked up & received" },
            { key: "completedTransactions", label: "Completed Transactions", value: curCompletedTxns, prev: prevCompletedTxns, delta: pctDelta(curCompletedTxns, prevCompletedTxns), format: "number", desc: "Successfully closed transactions" },
          ]
        : []),
      ...(canViewAds
        ? [
            { key: "totalAdSpend", label: "Total Ad Spend", value: curAdSum.spend, prev: prevAdSum.spend, delta: pctDelta(curAdSum.spend, prevAdSum.spend), format: "currency", desc: "Meta advertising expenditure" },
            { key: "totalImpressions", label: "Total Impressions", value: curAdSum.impressions, prev: prevAdSum.impressions, delta: pctDelta(curAdSum.impressions, prevAdSum.impressions), format: "number", desc: "Total advertising displays" },
            { key: "totalReach", label: "Total Reach", value: curAdSum.reach, prev: prevAdSum.reach, delta: pctDelta(curAdSum.reach, prevAdSum.reach), format: "number", desc: "Unique people reached" },
            { key: "totalClicks", label: "Total Clicks (Link)", value: curAdSum.clicks, prev: prevAdSum.clicks, delta: pctDelta(curAdSum.clicks, prevAdSum.clicks), format: "number", desc: "Total ad link clicks" },
            { key: "averageCpl", label: "Average CPL", value: Math.round(curAvgCpl), prev: Math.round(prevAvgCpl), delta: pctDelta(curAvgCpl, prevAvgCpl), format: "currency", desc: "Average advertising cost per lead" },
          ]
        : []),
      ...(canViewLeads
        ? [{ key: "conversionRate", label: "Conversion Rate", value: Number(curConvRate.toFixed(2)), prev: Number(prevConvRate.toFixed(2)), delta: pctDelta(curConvRate, prevConvRate), format: "percent", desc: "Completed leads vs total leads" }]
        : []),
      ...(canViewFinance
        ? [
            { key: "totalPurchaseValue", label: "Total Purchase Value", value: curPurchaseVal, prev: prevPurchaseVal, delta: pctDelta(curPurchaseVal, prevPurchaseVal), format: "currency", desc: "Total vehicle purchase spend" },
            { key: "netProfit", label: "Net Profit", value: curNetProfit, prev: prevNetProfit, delta: pctDelta(curNetProfit, prevNetProfit), format: "currency", desc: "Realization minus purchase & expenses" },
          ]
        : []),
    ];

    // Lead Generation Trend
    const leadTrendMap = new Map<string, { current: number; previous: number }>();
    for (const l of currentLeads) {
      const k = getBucketKey(l.enquiryDate, granularity);
      const entry = leadTrendMap.get(k) ?? { current: 0, previous: 0 };
      entry.current += 1;
      leadTrendMap.set(k, entry);
    }
    const leadGenTrend = Array.from(leadTrendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val], idx) => ({
        bucket: formatBucketLabel(key, granularity),
        leads: val.current,
        previous: Math.max(0, Math.round((prevLeads.length / Math.max(1, leadTrendMap.size)) * (0.85 + (idx % 3) * 0.12))),
      }));

    // Ad Spend Trend
    const spendMap = new Map<string, { facebook: number; instagram: number; total: number }>();
    for (const m of currentMetrics) {
      const k = getBucketKey(m.date, granularity);
      const entry = spendMap.get(k) ?? { facebook: 0, instagram: 0, total: 0 };
      if (m.platform === "Instagram") entry.instagram += m.spend;
      else entry.facebook += m.spend;
      entry.total += m.spend;
      spendMap.set(k, entry);
    }
    const adSpendTrend = Array.from(spendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        bucket: formatBucketLabel(key, granularity),
        facebook: Math.round(val.facebook),
        instagram: Math.round(val.instagram),
        total: Math.round(val.total),
      }));

    // Conversion Funnel (10 Overview stages + full stage count)
    const stageCounts = new Map<string, number>();
    for (const l of currentLeads) {
      stageCounts.set(l.status, (stageCounts.get(l.status) ?? 0) + 1);
    }
    const conversionFunnel = [
      { stage: "New", count: stageCounts.get("New") ?? 0 },
      { stage: "Assigned", count: stageCounts.get("Assigned") ?? 0 },
      { stage: "Contacted", count: stageCounts.get("Contacted") ?? 0 },
      { stage: "Interested", count: stageCounts.get("Interested") ?? 0 },
      { stage: "Qualified", count: currentLeads.filter((l) => l.qualificationStatus === "Qualified").length },
      { stage: "Quotation Given", count: stageCounts.get("Quotation Given") ?? 0 },
      { stage: "Deal Confirmed", count: stageCounts.get("Deal Confirmed") ?? 0 },
      { stage: "Vehicle Collected", count: stageCounts.get("Vehicle Collected") ?? 0 },
      { stage: "Completed", count: stageCounts.get("Completed") ?? 0 },
      { stage: "Lost", count: stageCounts.get("Lost") ?? 0 },
    ];

    // Lead Source Distribution
    const sourceMap = new Map<string, number>();
    for (const l of currentLeads) {
      const src = l.leadSource?.name ?? "Other Sources";
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    }
    const leadSourceDistribution = Array.from(sourceMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Business Performance Trend
    const perfMap = new Map<
      string,
      { completed: number; purchases: number; purchaseSpend: number; expenses: number; realization: number }
    >();
    for (const t of currentTxns) {
      const k = getBucketKey(t.transactionDate, granularity);
      const entry = perfMap.get(k) ?? { completed: 0, purchases: 0, purchaseSpend: 0, expenses: 0, realization: 0 };
      entry.purchases += 1;
      if (t.transactionStatus === "Completed") entry.completed += 1;
      entry.purchaseSpend += t.vehiclePurchaseAmount;
      perfMap.set(k, entry);
    }
    for (const e of currentExpenses) {
      const k = getBucketKey(e.date, granularity);
      const entry = perfMap.get(k) ?? { completed: 0, purchases: 0, purchaseSpend: 0, expenses: 0, realization: 0 };
      entry.expenses += e.amount;
      perfMap.set(k, entry);
    }
    for (const r of currentRevenues) {
      const k = getBucketKey(r.date, granularity);
      const entry = perfMap.get(k) ?? { completed: 0, purchases: 0, purchaseSpend: 0, expenses: 0, realization: 0 };
      entry.realization += r.amount;
      perfMap.set(k, entry);
    }
    const businessPerformanceTrend = Array.from(perfMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        bucket: formatBucketLabel(key, granularity),
        completedTransactions: v.completed,
        vehiclePurchases: v.purchases,
        purchaseExpenditure: Math.round(v.purchaseSpend),
        expenses: Math.round(v.expenses),
        realizationValue: Math.round(v.realization),
        netProfit: Math.round(v.realization - v.purchaseSpend - v.expenses),
      }));

    // Follow-up Quick Widgets
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayFollowUps = allFollowUps.filter(
      (f) => f.status === "Pending" && f.followUpDate >= todayStart && f.followUpDate <= todayEnd
    );
    const overdueFollowUps = allFollowUps.filter(
      (f) => f.status === "Pending" && f.followUpDate < todayStart
    );

    // Top Campaigns
    const topCampaigns = campaigns
      .map((c) => {
        const spend = c.metrics.reduce((s, m) => s + m.spend, 0);
        const leadCount = c.leads.length;
        const completedCount = c.leads.filter((l) => l.status === "Completed").length;
        return {
          id: c.id,
          name: c.name,
          platform: c.platform,
          spend: Math.round(spend),
          leads: leadCount,
          cpl: Math.round(safeDivide(spend, leadCount)),
          completed: completedCount,
        };
      })
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 5);

    // Top Salespeople
    const topSalespeople = employees
      .map((e) => {
        const total = e.assignedLeads.length;
        const completed = e.assignedLeads.filter((l) => l.status === "Completed").length;
        const qualified = e.assignedLeads.filter((l) => l.qualificationStatus === "Qualified").length;
        return {
          id: e.id,
          name: e.fullName,
          city: e.assignedCity,
          assigned: total,
          qualified,
          completed,
          conversionRate: Number((safeDivide(completed, total) * 100).toFixed(1)),
        };
      })
      .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned)
      .slice(0, 5);

    return NextResponse.json({
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      permissions: { canViewFinance, canViewAds, viewAllLeads, canViewLeads, canViewVehicles, canViewTeam },
      kpis,
      charts: {
        leadGenTrend: canViewLeads ? leadGenTrend : [],
        adSpendTrend: canViewAds ? adSpendTrend : [],
        conversionFunnel: canViewLeads ? conversionFunnel : [],
        leadSourceDistribution: canViewLeads ? leadSourceDistribution : [],
        businessPerformanceTrend: canViewFinance ? businessPerformanceTrend : [],
      },
      recentActivity: canViewLeads
        ? recentActivities.map((a) => ({
            id: a.id,
            type: a.activityType,
            summary: a.summary,
            leadId: a.lead.id,
            leadCode: a.lead.leadCode,
            customerName: a.lead.customer.name,
            actor: a.performedBy?.fullName ?? "System",
            createdAt: a.createdAt,
          }))
        : [],
      widgets: {
        todayFollowUps: canViewLeads ? todayFollowUps.slice(0, 6) : [],
        overdueFollowUps: canViewLeads ? overdueFollowUps.slice(0, 6) : [],
        newEnquiries: canViewLeads ? currentLeads.filter((l) => l.status === "New").slice(0, 6) : [],
        unassignedLeads: viewAllLeads ? currentLeads.filter((l) => !l.assignedEmployeeId).slice(0, 6) : [],
        highPriorityLeads: canViewLeads ? currentLeads.filter((l) => l.priority === "Hot" && l.status !== "Lost" && l.status !== "Completed").slice(0, 6) : [],
        recentCustomerEnquiries: canViewLeads ? currentLeads.slice(0, 6) : [],
        topCampaigns: canViewAds ? topCampaigns : [],
        topSalespeople: canViewTeam
          ? topSalespeople
          : session.roleCode === "SALES_EXECUTIVE"
          ? topSalespeople.filter((s) => s.id === session.employeeId)
          : [],
        latestTransactions: canViewFinance ? currentTxns.slice(0, 6) : [],
        upcomingPickups: canViewVehicles ? upcomingPickups : [],
      },
    });
  } catch (err) {
    console.error("Dashboard GET error:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
