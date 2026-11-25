"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatINR, formatNumber, formatPercent } from "@/lib/format";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/meta-ads/campaigns/${id}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load campaign detail");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/meta-ads" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0B5CA8] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Meta Ads
        </Link>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && data && (
        <div className="space-y-5">
          <PageHeader
            title={data.campaign.name}
            subtitle={`${data.campaign.campaignCode} · Meta ID: ${data.campaign.metaCampaignId} · ${data.campaign.objective} · ${data.campaign.platform}`}
            actions={<StatusBadge value={data.campaign.status} />}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            {[
              { label: "Start Date", value: formatDate(data.campaign.startDate) },
              { label: "End Date", value: data.campaign.endDate ? formatDate(data.campaign.endDate) : "Ongoing" },
              { label: "Budget", value: formatINR(data.campaign.budget) },
              { label: "Amount Spent", value: formatINR(data.campaign.amountSpent) },
              { label: "Impressions", value: formatNumber(data.campaign.impressions) },
              { label: "Reach", value: formatNumber(data.campaign.reach) },
              { label: "Link Clicks", value: formatNumber(data.campaign.clicks) },
              { label: "CTR", value: formatPercent(data.campaign.ctr) },
              { label: "CPC", value: formatINR(data.campaign.cpc, 2) },
              { label: "CPM", value: formatINR(data.campaign.cpm) },
              { label: "CRM Leads", value: String(data.campaign.leads) },
              { label: "CPL", value: formatINR(data.campaign.cpl) },
              { label: "Frequency", value: data.campaign.frequency.toFixed(2) },
              { label: "Qualified Leads", value: String(data.campaign.qualifiedLeads) },
              { label: "Completed Txns", value: String(data.campaign.completedTransactions) },
              { label: "Cost / Qualified", value: formatINR(data.campaign.cpql) },
              { label: "Cost / Completed", value: formatINR(data.campaign.cpct) },
              { label: "Attributed Revenue", value: formatINR(data.campaign.attributedRevenue) },
            ].map((item) => (
              <Card key={item.label} className="p-3">
                <div className="text-[11px] text-slate-400">{item.label}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">{item.value}</div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-3">Campaign Daily Spend & Click Trend</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="spend" name="Spend (₹)" stroke="#0B5CA8" fill="#0B5CA8" fillOpacity={0.18} />
                  <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#D62828" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Associated Ad Sets ({data.adSets.length})</h3>
              <div className="space-y-2 text-xs">
                {data.adSets.map((as: any) => (
                  <div key={as.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 flex justify-between">
                    <div>
                      <div className="font-semibold">{as.name}</div>
                      <div className="text-[11px] text-slate-500">{as.placement} · {as.audienceInfo}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatINR(as.spend)}</div>
                      <div className="text-[11px] text-[#0B5CA8]">{as.leads} Leads</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Associated Advertisements ({data.ads.length})</h3>
              <div className="space-y-2 text-xs">
                {data.ads.map((ad: any) => (
                  <div key={ad.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 flex justify-between">
                    <div>
                      <div className="font-semibold">{ad.name}</div>
                      <div className="text-[11px] text-slate-500">{ad.headline} ({ad.platform})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatINR(ad.spend)} · CTR {formatPercent(ad.ctr)}</div>
                      <div className="text-[11px] text-[#0B5CA8]">{ad.leads} Leads (CPL {formatINR(ad.cpl)})</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold">CRM Leads Attributed to Campaign ({data.crmLeads.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                  <tr>
                    <th className="p-3">Lead ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">City</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Qualification</th>
                    <th className="p-3">Assigned To</th>
                    <th className="p-3">Enquiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.crmLeads.map((l: any) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <Link href={`/leads/${l.id}`} className="font-semibold text-[#0B5CA8] hover:underline">
                          {l.leadCode}
                        </Link>
                      </td>
                      <td className="p-3">{l.customerName} ({l.mobile})</td>
                      <td className="p-3">{l.city}</td>
                      <td className="p-3"><StatusBadge value={l.status} /></td>
                      <td className="p-3"><StatusBadge value={l.qualificationStatus} /></td>
                      <td className="p-3">{l.assignedEmployee}</td>
                      <td className="p-3">{formatDate(l.enquiryDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
