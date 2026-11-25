import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { computeAdMetrics, safeDivide } from "@/lib/format";
import { STAGE_INDEX } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "meta_ads:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        adSets: true,
        ads: { include: { adSet: { select: { name: true } } } },
        metrics: { orderBy: { date: "asc" } },
        leads: {
          where: { isDeleted: false },
          include: {
            customer: true,
            assignedEmployee: { select: { fullName: true } },
            transactions: { include: { revenues: true } },
          },
          orderBy: { enquiryDate: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const totals = campaign.metrics.reduce(
      (acc, m) => {
        acc.spend += m.spend;
        acc.impressions += m.impressions;
        acc.reach += m.reach;
        acc.linkClicks += m.linkClicks;
        acc.allClicks += m.allClicks;
        acc.landingPageViews += m.landingPageViews;
        return acc;
      },
      { spend: 0, impressions: 0, reach: 0, linkClicks: 0, allClicks: 0, landingPageViews: 0 }
    );

    const crmLeads = campaign.leads;
    const qualifiedLeads = crmLeads.filter((l) => l.qualificationStatus === "Qualified").length;
    const completedTransactions = crmLeads.filter((l) => l.status === "Completed").length;
    const attributedRevenue = crmLeads.reduce(
      (s, l) => s + l.transactions.reduce((ts, t) => ts + t.revenues.reduce((rs, r) => rs + r.amount, 0), 0),
      0
    );

    const computed = computeAdMetrics({
      spend: totals.spend,
      impressions: totals.impressions,
      reach: totals.reach,
      clicks: totals.linkClicks,
      leads: crmLeads.length,
      qualifiedLeads,
      completedTransactions,
      attributedRevenue,
    });

    // Daily trend
    const dailyMap = new Map<string, { date: string; spend: number; clicks: number; impressions: number; leads: number }>();
    for (const m of campaign.metrics) {
      const k = m.date.toISOString().slice(0, 10);
      const entry = dailyMap.get(k) ?? { date: k, spend: 0, clicks: 0, impressions: 0, leads: 0 };
      entry.spend += m.spend;
      entry.clicks += m.linkClicks;
      entry.impressions += m.impressions;
      entry.leads += m.metaLeads;
      dailyMap.set(k, entry);
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        campaignCode: campaign.campaignCode,
        metaCampaignId: campaign.metaCampaignId,
        name: campaign.name,
        objective: campaign.objective,
        platform: campaign.platform,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        amountSpent: Math.round(totals.spend),
        impressions: totals.impressions,
        reach: totals.reach,
        clicks: totals.linkClicks,
        allClicks: totals.allClicks,
        landingPageViews: totals.landingPageViews,
        leads: crmLeads.length,
        qualifiedLeads,
        completedTransactions,
        attributedRevenue,
        ...computed,
      },
      trend: Array.from(dailyMap.values()),
      adSets: campaign.adSets.map((as) => {
        const ms = campaign.metrics.filter((m) => m.adSetId === as.id);
        const spend = ms.reduce((s, m) => s + m.spend, 0);
        const leadsCount = crmLeads.filter((l) => l.adSetId === as.id).length;
        return {
          ...as,
          spend: Math.round(spend),
          impressions: ms.reduce((s, m) => s + m.impressions, 0),
          reach: ms.reduce((s, m) => s + m.reach, 0),
          clicks: ms.reduce((s, m) => s + m.linkClicks, 0),
          leads: leadsCount,
          cpl: safeDivide(spend, leadsCount),
        };
      }),
      ads: campaign.ads.map((ad) => {
        const ms = campaign.metrics.filter((m) => m.adId === ad.id);
        const spend = ms.reduce((s, m) => s + m.spend, 0);
        const impressions = ms.reduce((s, m) => s + m.impressions, 0);
        const reach = ms.reduce((s, m) => s + m.reach, 0);
        const clicks = ms.reduce((s, m) => s + m.linkClicks, 0);
        const leadsCount = crmLeads.filter((l) => l.adId === ad.id).length;
        return {
          ...ad,
          adSetName: ad.adSet.name,
          spend: Math.round(spend),
          impressions,
          reach,
          clicks,
          leads: leadsCount,
          ...computeAdMetrics({ spend, impressions, reach, clicks, leads: leadsCount }),
        };
      }),
      crmLeads: crmLeads.map((l) => ({
        id: l.id,
        leadCode: l.leadCode,
        customerName: l.customer.name,
        mobile: l.customer.primaryMobile,
        city: l.customer.city,
        status: l.status,
        qualificationStatus: l.qualificationStatus,
        priority: l.priority,
        assignedEmployee: l.assignedEmployee?.fullName ?? "Unassigned",
        enquiryDate: l.enquiryDate,
        isInterested: (STAGE_INDEX[l.status] ?? 0) >= 3 && l.status !== "Lost",
      })),
    });
  } catch (err) {
    console.error("Campaign detail error:", err);
    return NextResponse.json({ error: "Failed to load campaign detail" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "meta_ads:manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.status ? { status: String(body.status) } : {}),
        ...(body.budget !== undefined ? { budget: Number(body.budget) } : {}),
      },
    });

    await logAudit({
      actorUserId: session.userId,
      actorName: session.name,
      action: "CAMPAIGN_UPDATED",
      entityType: "Campaign",
      entityId: updated.id,
      summary: `Updated campaign ${updated.campaignCode} (${updated.name})`,
    });

    return NextResponse.json({ campaign: updated });
  } catch (err) {
    console.error("Campaign PATCH error:", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}
