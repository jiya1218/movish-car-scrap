"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpDown,
  Download,
  ExternalLink,
  Eye,
  GitCompare,
  IndianRupee,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import {
  Card,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";

export default function MetaAdsPage() {
  const [tab, setTab] = useState<"overview" | "campaigns" | "adsets" | "ads" | "comparison">("overview");
  const [days, setDays] = useState("60");
  const [platform, setPlatform] = useState("All");
  const [objective, setObjective] = useState("All");
  const [status, setStatus] = useState("All");
  const [campaignId, setCampaignId] = useState("All");
  const [clickMetric, setClickMetric] = useState<"link_clicks" | "all_clicks">("link_clicks");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("leads");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [compareCampaignIds, setCompareCampaignIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareAdIds, setCompareAdIds] = useState<string[]>([]);
  const [compareAdModalOpen, setCompareAdModalOpen] = useState(false);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        days,
        platform,
        objective,
        status,
        campaignId,
        clickMetric,
      });
      const res = await fetch(`/api/meta-ads?${qs.toString()}`, { cache: "no-store" });
      if (res.status === 403) throw new Error("Access to Meta Ads Analytics is restricted for your role.");
      if (!res.ok) throw new Error("Unable to load Meta Ads analytics.");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Error loading Meta Ads");
    } finally {
      setLoading(false);
    }
  }, [days, platform, objective, status, campaignId, clickMetric]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCampaigns = useMemo(() => {
    if (!data?.campaigns) return [];
    const list = data.campaigns.filter((c: any) =>
      `${c.name} ${c.campaignCode} ${c.metaCampaignId} ${c.objective}`.toLowerCase().includes(search.toLowerCase())
    );
    return [...list].sort((a: any, b: any) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, search, sortCol, sortDir]);

  const filteredAds = useMemo(() => {
    if (!data?.ads) return [];
    return data.ads.filter((ad: any) =>
      `${ad.name} ${ad.headline} ${ad.campaignName} ${ad.platform}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const toggleCompareCampaign = (id: string) => {
    setCompareCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const toggleCompareAd = (id: string) => {
    setCompareAdIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const exportCampaigns = (fmt: "csv" | "xlsx" | "pdf") => {
    const cols = [
      { header: "Code", accessor: (r: any) => r.campaignCode },
      { header: "Campaign Name", accessor: (r: any) => r.name },
      { header: "Platform", accessor: (r: any) => r.platform },
      { header: "Status", accessor: (r: any) => r.status },
      { header: "Spend (INR)", accessor: (r: any) => r.spend },
      { header: "Impressions", accessor: (r: any) => r.impressions },
      { header: "Clicks", accessor: (r: any) => r.selectedClicks },
      { header: "CTR %", accessor: (r: any) => r.ctr.toFixed(2) },
      { header: "CRM Leads", accessor: (r: any) => r.leads },
      { header: "CPL (INR)", accessor: (r: any) => Math.round(r.cpl) },
      { header: "Qualified", accessor: (r: any) => r.qualifiedLeads },
      { header: "Completed Txns", accessor: (r: any) => r.completedTransactions },
    ];
    if (fmt === "csv") exportToCSV("movish-meta-campaigns", filteredCampaigns, cols);
    else if (fmt === "xlsx") exportToExcel("movish-meta-campaigns", "Campaigns", filteredCampaigns, cols);
    else exportToPDF("movish-meta-campaigns", "Meta Ads Campaign Performance", `Range: ${days}d`, filteredCampaigns, cols);
  };

  return (
    <AppShell>
      <PageHeader
        title="Meta Ads Analytics & Attribution"
        subtitle="Facebook & Instagram advertising spend, CTR/CPC/CPM/CPL/Frequency connected directly to Movish Group CRM outcomes"
        actions={
          <>
            <select
              value={clickMetric}
              onChange={(e) => setClickMetric(e.target.value as any)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]"
              title="Click measurement definition"
            >
              <option value="link_clicks">Click Metric: Link Clicks</option>
              <option value="all_clicks">Click Metric: All Clicks</option>
            </select>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e] hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </>
        }
      />

      {/* Honest Meta Integration Banner (PRD Sec 6.10 & 28) */}
      {data?.integrationStatus?.status !== "Connected" && (
        <div className="mb-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Meta Business Integration Status: Not Connected.</strong> Showing structured local campaign reporting records reconciled with CRM leads. Live Meta Marketing API synchronization is ready to activate in Settings once authorized credentials are provided.
            </span>
          </div>
          <Link
            href="/settings?tab=integrations"
            className="shrink-0 font-semibold text-[#0B5CA8] hover:underline"
          >
            Configure Integration →
          </Link>
        </div>
      )}

      {/* Submodule Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {[
            { key: "overview", label: "Overview" },
            { key: "campaigns", label: "Campaigns" },
            { key: "adsets", label: "Ad Sets" },
            { key: "ads", label: "Ads" },
            { key: "comparison", label: "Facebook vs Instagram" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.key
                  ? "bg-[#0B5CA8] text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="p-3.5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaign / ad..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <select value={days} onChange={(e) => setDays(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="60">Last 60 Days</option>
            <option value="all">All Dates</option>
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Platform: All</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
          </select>
          <select value={objective} onChange={(e) => setObjective(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Objective: All</option>
            <option value="Lead Generation">Lead Generation</option>
            <option value="Conversions">Conversions</option>
            <option value="Messages">Messages</option>
            <option value="Traffic">Traffic</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Status: All</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Completed">Completed</option>
          </select>
          <button
            onClick={() => {
              setDays("60");
              setPlatform("All");
              setObjective("All");
              setStatus("All");
              setCampaignId("All");
              setSearch("");
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
          >
            Reset Filters
          </button>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && data && (
        <>
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <KpiCard label="Total Ad Spend" value={data.overview.spend} format="currency" icon={<IndianRupee className="w-4 h-4" />} desc="Sum of Meta spend (INR)" />
                <KpiCard label="Impressions" value={data.overview.impressions} format="number" icon={<Eye className="w-4 h-4" />} desc="Total ad displays" />
                <KpiCard label="Reach" value={data.overview.reach} format="number" icon={<Users className="w-4 h-4" />} desc="Unique people reached" />
                <KpiCard label={clickMetric === "link_clicks" ? "Link Clicks" : "All Clicks"} value={data.overview.selectedClicks} format="number" icon={<MousePointerClick className="w-4 h-4" />} desc={`Landing page views: ${formatNumber(data.overview.landingPageViews)}`} />
                <KpiCard label="CTR" value={data.overview.ctr} format="percent" icon={<Megaphone className="w-4 h-4" />} desc="Clicks ÷ Impressions × 100" />
                <KpiCard label="CPC" value={Math.round(data.overview.cpc)} format="currency" icon={<IndianRupee className="w-4 h-4" />} desc="Spend ÷ Clicks" invertGoodDirection />
                <KpiCard label="CPM" value={Math.round(data.overview.cpm)} format="currency" icon={<IndianRupee className="w-4 h-4" />} desc="Spend ÷ Impressions × 1,000" invertGoodDirection />
                <KpiCard label="Meta Leads" value={data.overview.metaLeads} format="number" icon={<Users className="w-4 h-4" />} desc="Reconciled CRM Meta leads" />
                <KpiCard label="CPL" value={Math.round(data.overview.cpl)} format="currency" icon={<IndianRupee className="w-4 h-4" />} desc="Spend ÷ Leads" invertGoodDirection />
                <KpiCard label="Frequency" value={Number(data.overview.frequency.toFixed(2))} format="number" icon={<Eye className="w-4 h-4" />} desc={`Avg ${data.overview.frequency.toFixed(2)}x impressions/user`} />
              </div>

              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-3">Campaign Spend vs CRM Leads & Qualified Leads</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredCampaigns.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="campaignCode" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="left" dataKey="spend" name="Spend (₹)" fill="#1B3156" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="leads" name="CRM Leads" fill="#0B5CA8" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="qualifiedLeads" name="Qualified Leads" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {tab === "campaigns" && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  <strong>{filteredCampaigns.length}</strong> campaigns · Select up to 4 to compare side-by-side
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {compareCampaignIds.length >= 2 && (
                    <button
                      onClick={() => setCompareModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white"
                    >
                      <GitCompare className="w-3.5 h-3.5" /> Compare ({compareCampaignIds.length})
                    </button>
                  )}
                  <button onClick={() => exportCampaigns("csv")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button onClick={() => exportCampaigns("xlsx")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Download className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button onClick={() => exportCampaigns("pdf")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>

              {filteredCampaigns.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Cmp</th>
                        <th className="p-3 cursor-pointer" onClick={() => toggleSort("name")}>Campaign <ArrowUpDown className="inline w-3 h-3" /></th>
                        <th className="p-3">Objective / Platform</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort("spend")}>Spent</th>
                        <th className="p-3 text-right">Impr. / Reach</th>
                        <th className="p-3 text-right">Clicks / CTR</th>
                        <th className="p-3 text-right">CPC / CPM</th>
                        <th className="p-3 text-right cursor-pointer" onClick={() => toggleSort("leads")}>Leads / CPL</th>
                        <th className="p-3 text-right">Qualified / CPQL</th>
                        <th className="p-3 text-right">Txns / ROI</th>
                        <th className="p-3">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCampaigns.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={compareCampaignIds.includes(c.id)}
                              onChange={() => toggleCompareCampaign(c.id)}
                              aria-label={`Compare ${c.name}`}
                            />
                          </td>
                          <td className="p-3">
                            <Link href={`/meta-ads/campaigns/${c.id}`} className="font-semibold text-[#0B5CA8] hover:underline block">
                              {c.name}
                            </Link>
                            <span className="text-[11px] text-slate-400">{c.campaignCode} · ID {c.metaCampaignId}</span>
                          </td>
                          <td className="p-3">
                            <div>{c.objective}</div>
                            <div className="text-[11px] text-slate-500">{c.platform}</div>
                          </td>
                          <td className="p-3"><StatusBadge value={c.status} /></td>
                          <td className="p-3 text-right font-semibold tabular-nums">
                            <div>{formatINR(c.spend)}</div>
                            <div className="text-[10px] text-slate-400">Budget {formatINR(c.budget)}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <div>{formatNumber(c.impressions)}</div>
                            <div className="text-[10px] text-slate-400">Reach {formatNumber(c.reach)}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <div>{formatNumber(c.selectedClicks)}</div>
                            <div className="text-[10px] text-slate-400">{formatPercent(c.ctr)}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <div>{formatINR(c.cpc, 1)}</div>
                            <div className="text-[10px] text-slate-400">CPM {formatINR(c.cpm)}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <div className="font-bold text-[#0B5CA8]">{c.leads}</div>
                            <div className="text-[10px] text-slate-400">CPL {formatINR(c.cpl)}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <div className="font-semibold text-emerald-600">{c.qualifiedLeads}</div>
                            <div className="text-[10px] text-slate-400">CPQL {formatINR(c.cpql)}</div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            <div>{c.completedTransactions} Closed</div>
                            <div className={`text-[10px] font-semibold ${c.marketingRoi >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              ROI {formatPercent(c.marketingRoi, 0)}
                            </div>
                          </td>
                          <td className="p-3">
                            <Link
                              href={`/meta-ads/campaigns/${c.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-[#0B5CA8] hover:text-white font-medium transition-colors"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "adsets" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Ad Set</th>
                      <th className="p-3">Parent Campaign</th>
                      <th className="p-3">Audience & Placement</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Budget</th>
                      <th className="p-3 text-right">Spent</th>
                      <th className="p-3 text-right">Impressions / Reach</th>
                      <th className="p-3 text-right">Clicks</th>
                      <th className="p-3 text-right">Leads</th>
                      <th className="p-3 text-right">CPL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.adSets.map((as: any) => (
                      <tr key={as.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <div className="font-semibold">{as.name}</div>
                          <div className="text-[11px] text-slate-400">{as.adSetCode} · {as.metaAdSetId}</div>
                        </td>
                        <td className="p-3">{as.campaignName}</td>
                        <td className="p-3">
                          <div>{as.placement}</div>
                          <div className="text-[11px] text-slate-400">{as.audienceInfo}</div>
                        </td>
                        <td className="p-3"><StatusBadge value={as.status} /></td>
                        <td className="p-3 text-right tabular-nums">{formatINR(as.budget)}</td>
                        <td className="p-3 text-right font-semibold tabular-nums">{formatINR(as.spend)}</td>
                        <td className="p-3 text-right tabular-nums">{formatNumber(as.impressions)} / {formatNumber(as.reach)}</td>
                        <td className="p-3 text-right tabular-nums">{formatNumber(as.selectedClicks)}</td>
                        <td className="p-3 text-right font-bold text-[#0B5CA8] tabular-nums">{as.leads}</td>
                        <td className="p-3 text-right tabular-nums">{formatINR(as.cpl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "ads" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  <strong>{filteredAds.length}</strong> advertisements · Select up to 4 ads to compare creative & lead efficiency
                </p>
                {compareAdIds.length >= 2 && (
                  <button
                    onClick={() => setCompareAdModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white"
                  >
                    <GitCompare className="w-3.5 h-3.5" /> Compare Ads ({compareAdIds.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAds.map((ad: any) => (
                  <Card key={ad.id} className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={compareAdIds.includes(ad.id)}
                            onChange={() => toggleCompareAd(ad.id)}
                          />
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">{ad.name}</h3>
                            <p className="text-[11px] text-slate-400">{ad.adCode} · {ad.platform} ({ad.placement})</p>
                          </div>
                        </div>
                        <StatusBadge value={ad.status} />
                      </div>

                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-3 my-2.5 flex gap-3">
                        <div className="w-12 h-12 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1">
                          <img src={ad.creativePreviewUrl || "/logo.png"} alt={ad.headline} className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0 text-xs">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{ad.headline}</div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{ad.primaryText}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-[#0B5CA8]">
                            CTA: {ad.cta}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-[11px]">
                      <div>
                        <div className="text-slate-400">Spend</div>
                        <div className="font-semibold">{formatINR(ad.spend)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">CTR</div>
                        <div className="font-semibold">{formatPercent(ad.ctr)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Leads / Qual.</div>
                        <div className="font-bold text-[#0B5CA8]">{ad.leads} / {ad.qualifiedLeads}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">CPL</div>
                        <div className="font-semibold">{formatINR(ad.cpl)}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {tab === "comparison" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <Card className="lg:col-span-6 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold">Facebook vs Instagram Performance</h3>
                  <p className="text-xs text-slate-500">Side-by-side advertising & lead cost comparison</p>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Metric</th>
                      <th className="p-3 text-right">Facebook</th>
                      <th className="p-3 text-right">Instagram</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { label: "Ad Spend", fb: formatINR(data.platformComparison.facebook.spend), ig: formatINR(data.platformComparison.instagram.spend) },
                      { label: "Impressions", fb: formatNumber(data.platformComparison.facebook.impressions), ig: formatNumber(data.platformComparison.instagram.impressions) },
                      { label: "Reach", fb: formatNumber(data.platformComparison.facebook.reach), ig: formatNumber(data.platformComparison.instagram.reach) },
                      { label: "Clicks", fb: formatNumber(data.platformComparison.facebook.selectedClicks), ig: formatNumber(data.platformComparison.instagram.selectedClicks) },
                      { label: "CTR", fb: formatPercent(data.platformComparison.facebook.ctr), ig: formatPercent(data.platformComparison.instagram.ctr) },
                      { label: "CPC", fb: formatINR(data.platformComparison.facebook.cpc, 2), ig: formatINR(data.platformComparison.instagram.cpc, 2) },
                      { label: "CPM", fb: formatINR(data.platformComparison.facebook.cpm), ig: formatINR(data.platformComparison.instagram.cpm) },
                      { label: "CRM Leads", fb: formatNumber(data.platformComparison.facebook.leads), ig: formatNumber(data.platformComparison.instagram.leads) },
                      { label: "CPL", fb: formatINR(data.platformComparison.facebook.cpl), ig: formatINR(data.platformComparison.instagram.cpl) },
                    ].map((row) => (
                      <tr key={row.label}>
                        <td className="p-3 font-medium">{row.label}</td>
                        <td className="p-3 text-right font-semibold tabular-nums">{row.fb}</td>
                        <td className="p-3 text-right font-semibold tabular-nums">{row.ig}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card className="lg:col-span-6 p-5">
                <h3 className="text-sm font-semibold mb-3">Platform Visual Comparison</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { metric: "Ad Spend (₹k)", Facebook: Math.round(data.platformComparison.facebook.spend / 1000), Instagram: Math.round(data.platformComparison.instagram.spend / 1000) },
                        { metric: "Leads", Facebook: data.platformComparison.facebook.leads, Instagram: data.platformComparison.instagram.leads },
                        { metric: "CPL (₹)", Facebook: Math.round(data.platformComparison.facebook.cpl), Instagram: Math.round(data.platformComparison.instagram.cpl) },
                        { metric: "CPM (₹)", Facebook: Math.round(data.platformComparison.facebook.cpm), Instagram: Math.round(data.platformComparison.instagram.cpm) },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Facebook" fill="#1B3156" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Instagram" fill="#D62828" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Campaign Comparison Modal */}
      <Modal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title="Campaign Comparison"
        subtitle="Side-by-side advertising & CRM conversion metrics"
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b">
              <tr>
                <th className="p-2.5">Metric</th>
                {filteredCampaigns
                  .filter((c: any) => compareCampaignIds.includes(c.id))
                  .map((c: any) => (
                    <th key={c.id} className="p-2.5 text-right">{c.campaignCode}: {c.name.slice(0, 22)}</th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: "Spend", get: (c: any) => formatINR(c.spend) },
                { label: "Impressions", get: (c: any) => formatNumber(c.impressions) },
                { label: "CTR", get: (c: any) => formatPercent(c.ctr) },
                { label: "CPC", get: (c: any) => formatINR(c.cpc, 2) },
                { label: "CRM Leads", get: (c: any) => c.leads },
                { label: "CPL", get: (c: any) => formatINR(c.cpl) },
                { label: "Qualified Leads", get: (c: any) => c.qualifiedLeads },
                { label: "Completed Transactions", get: (c: any) => c.completedTransactions },
                { label: "Cost / Completed Txn", get: (c: any) => formatINR(c.cpct) },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="p-2.5 font-medium">{row.label}</td>
                  {filteredCampaigns
                    .filter((c: any) => compareCampaignIds.includes(c.id))
                    .map((c: any) => (
                      <td key={c.id} className="p-2.5 text-right font-semibold tabular-nums">{row.get(c)}</td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Advertisement Comparison Modal */}
      <Modal
        open={compareAdModalOpen}
        onClose={() => setCompareAdModalOpen(false)}
        title="Advertisement Comparison"
        subtitle="Compare creatives, CTR, CPL, and qualified leads"
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b">
              <tr>
                <th className="p-2.5">Metric</th>
                {filteredAds
                  .filter((a: any) => compareAdIds.includes(a.id))
                  .map((a: any) => (
                    <th key={a.id} className="p-2.5 text-right">{a.adCode}: {a.headline.slice(0, 24)}</th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: "Platform", get: (a: any) => a.platform },
                { label: "Spend", get: (a: any) => formatINR(a.spend) },
                { label: "Impressions", get: (a: any) => formatNumber(a.impressions) },
                { label: "Clicks", get: (a: any) => formatNumber(a.selectedClicks) },
                { label: "CTR", get: (a: any) => formatPercent(a.ctr) },
                { label: "Leads", get: (a: any) => a.leads },
                { label: "Qualified Leads", get: (a: any) => a.qualifiedLeads },
                { label: "CPL", get: (a: any) => formatINR(a.cpl) },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="p-2.5 font-medium">{row.label}</td>
                  {filteredAds
                    .filter((a: any) => compareAdIds.includes(a.id))
                    .map((a: any) => (
                      <td key={a.id} className="p-2.5 text-right font-semibold">{row.get(a)}</td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </AppShell>
  );
}
