import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerform, getSessionContext } from "@/lib/auth";
import { computeAdMetrics, safeDivide } from "@/lib/format";
import { STAGE_INDEX } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const session = await getSessionContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canPerform(session, "meta_ads:view")) {
      return NextResponse.json({ error: "Forbidden: Meta Ads access restricted" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get("days") || "60";
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const platformFilter = searchParams.get("platform") || "All";
    const objectiveFilter = searchParams.get("objective") || "All";
    const statusFilter = searchParams.get("status") || "All";
    const campaignFilter = searchParams.get("campaignId") || "All";
    const clickMetric = searchParams.get("clickMetric") === "all_clicks" ? "all_clicks" : "link_clicks";

    const end = toParam ? new Date(toParam) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = fromParam
      ? new Date(fromParam)
      : daysParam === "all"
      ? new Date("2024-01-01T00:00:00.000Z")
      : (() => {
          const d = new Date(end);
          d.setDate(d.getDate() - (Math.max(1, Number(daysParam) || 60) - 1));
          d.setHours(0, 0, 0, 0);
          return d;
        })();

    const [campaigns, adSets, ads, metrics, crmLeads, metaSetting] = await Promise.all([
      prisma.campaign.findMany({ orderBy: { campaignCode: "asc" } }),
      prisma.adSet.findMany({ include: { campaign: { select: { name: true, campaignCode: true } } }, orderBy: { adSetCode: "asc" } }),
      prisma.ad.findMany({
        include: {
          campaign: { select: { name: true, campaignCode: true, objective: true, status: true } },
          adSet: { select: { name: true, adSetCode: true, placement: true } },
        },
        orderBy: { adCode: "asc" },
      }),
      prisma.adMetric.findMany({
        where: {
          date: { gte: start, lte: end },
          ...(platformFilter !== "All" ? { platform: platformFilter } : {}),
          ...(campaignFilter !== "All" ? { campaignId: campaignFilter } : {}),
        },
      }),
      prisma.lead.findMany({
        where: {
          isDeleted: false,
          campaignId: { not: null },
          enquiryDate: { gte: start, lte: end },
          ...(campaignFilter !== "All" ? { campaignId: campaignFilter } : {}),
        },
        include: {
          transactions: {
            include: { revenues: { select: { amount: true } } },
          },
        },
      }),
      prisma.systemSetting.findUnique({ where: { key: "meta_integration" } }),
    ]);

    // Filter campaigns according to selected dropdowns
    const filteredCampaigns = campaigns.filter((c) => {
      if (campaignFilter !== "All" && c.id !== campaignFilter) return false;
      if (objectiveFilter !== "All" && c.objective !== objectiveFilter) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (platformFilter !== "All" && !c.platform.includes(platformFilter)) return false;
      return true;
    });
    const allowedCampaignIds = new Set(filteredCampaigns.map((c) => c.id));

    const scopedMetrics = metrics.filter((m) => allowedCampaignIds.has(m.campaignId));
    const scopedLeads = crmLeads.filter((l) => l.campaignId && allowedCampaignIds.has(l.campaignId));

    const sumAdRows = (rows: typeof scopedMetrics) => {
      let spend = 0;
      let impressions = 0;
      let reach = 0;
      let linkClicks = 0;
      let allClicks = 0;
      let landingPageViews = 0;
      let metaLeads = 0;
      for (const r of rows) {
        spend += r.spend;
        impressions += r.impressions;
        reach += r.reach;
        linkClicks += r.linkClicks;
        allClicks += r.allClicks;
        landingPageViews += r.landingPageViews;
        metaLeads += r.metaLeads;
      }
      const selectedClicks = clickMetric === "all_clicks" ? allClicks : linkClicks;
      return {
        spend: Math.round(spend),
        impressions,
        reach,
        linkClicks,
        allClicks,
        selectedClicks,
        landingPageViews,
        metaLeads,
        ...computeAdMetrics({
          spend,
          impressions,
          reach,
          clicks: selectedClicks,
          leads: metaLeads,
        }),
      };
    };

    const overview = sumAdRows(scopedMetrics);

    // Campaign table with connected CRM funnel & ROI
    const campaignRows = filteredCampaigns.map((c) => {
      const cMetrics = scopedMetrics.filter((m) => m.campaignId === c.id);
      const agg = sumAdRows(cMetrics);
      const cLeads = scopedLeads.filter((l) => l.campaignId === c.id);
      const crmTotalLeads = cLeads.length;
      const duplicateLeads = cLeads.filter((l) => l.isDuplicate).length;
      const interestedLeads = cLeads.filter((l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Interested"] ?? 3) && l.status !== "Lost").length;
      const qualifiedLeads = cLeads.filter((l) => l.qualificationStatus === "Qualified").length;
      const quotationsProvided = cLeads.filter((l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Quotation Given"] ?? 6) && l.status !== "Lost").length;
      const confirmedDeals = cLeads.filter((l) => (STAGE_INDEX[l.status] ?? 0) >= (STAGE_INDEX["Deal Confirmed"] ?? 8) && l.status !== "Lost").length;
      const completedTransactions = cLeads.filter((l) => l.status === "Completed").length;
      const attributedRevenue = cLeads.reduce(
        (sum, l) =>
          sum +
          l.transactions.reduce(
            (ts, t) => ts + t.revenues.reduce((rs, r) => rs + r.amount, 0),
            0
          ),
        0
      );
      const roi = computeAdMetrics({
        spend: agg.spend,
        impressions: agg.impressions,
        reach: agg.reach,
        clicks: agg.selectedClicks,
        leads: crmTotalLeads || agg.metaLeads,
        qualifiedLeads,
        completedTransactions,
        attributedRevenue,
      });

      return {
        ...c,
        ...agg,
        leads: crmTotalLeads,
        cpl: safeDivide(agg.spend, crmTotalLeads || agg.metaLeads),
        crmTotalLeads,
        duplicateLeads,
        interestedLeads,
        qualifiedLeads,
        quotationsProvided,
        confirmedDeals,
        completedTransactions,
        attributedRevenue,
        cpql: roi.cpql,
        cpct: roi.cpct,
        marketingRoi: roi.marketingRoi,
      };
    });

    // Ad Set table
    const adSetRows = adSets
      .filter((as) => allowedCampaignIds.has(as.campaignId))
      .map((as) => {
        const rows = scopedMetrics.filter((m) => m.adSetId === as.id);
        const agg = sumAdRows(rows);
        const asLeads = scopedLeads.filter((l) => l.adSetId === as.id).length;
        return {
          ...as,
          campaignName: as.campaign.name,
          ...agg,
          leads: asLeads,
          cpl: safeDivide(agg.spend, asLeads || agg.metaLeads),
        };
      });

    // Individual Ad table
    const adRows = ads
      .filter((ad) => allowedCampaignIds.has(ad.campaignId))
      .map((ad) => {
        const rows = scopedMetrics.filter((m) => m.adId === ad.id);
        const agg = sumAdRows(rows);
        const adLeads = scopedLeads.filter((l) => l.adId === ad.id);
        const qualifiedLeads = adLeads.filter((l) => l.qualificationStatus === "Qualified").length;
        return {
          ...ad,
          campaignName: ad.campaign.name,
          adSetName: ad.adSet.name,
          ...agg,
          leads: adLeads.length,
          qualifiedLeads,
          cpl: safeDivide(agg.spend, adLeads.length || agg.metaLeads),
        };
      });

    // Facebook vs Instagram comparison
    const fbMetrics = scopedMetrics.filter((m) => m.platform === "Facebook");
    const igMetrics = scopedMetrics.filter((m) => m.platform === "Instagram");
    const fbAgg = sumAdRows(fbMetrics);
    const igAgg = sumAdRows(igMetrics);

    const fbCrmLeads = scopedLeads.filter((l) => l.firstTouchSource === "Facebook").length;
    const igCrmLeads = scopedLeads.filter((l) => l.firstTouchSource === "Instagram").length;

    const platformComparison = {
      facebook: { ...fbAgg, leads: fbCrmLeads, cpl: safeDivide(fbAgg.spend, fbCrmLeads) },
      instagram: { ...igAgg, leads: igCrmLeads, cpl: safeDivide(igAgg.spend, igCrmLeads) },
    };

    return NextResponse.json({
      clickMetric,
      integrationStatus: metaSetting ? JSON.parse(metaSetting.valueJson) : { status: "Not Connected" },
      overview,
      campaigns: campaignRows,
      adSets: adSetRows,
      ads: adRows,
      platformComparison,
    });
  } catch (err) {
    console.error("Meta Ads GET error:", err);
    return NextResponse.json({ error: "Failed to load Meta Ads metrics" }, { status: 500 });
  }
}
