"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Award,
  BarChart2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  IndianRupee,
  Megaphone,
  MousePointerClick,
  Percent,
  PhoneCall,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorState, KpiCard, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";

interface DashboardData {
  dateRange: { start: string; end: string };
  permissions: {
    canViewFinance: boolean;
    canViewAds: boolean;
    viewAllLeads: boolean;
    canViewLeads: boolean;
    canViewVehicles: boolean;
    canViewTeam: boolean;
  };
  kpis: Array<{
    key: string;
    label: string;
    value: number;
    prev: number;
    delta: number;
    format: "number" | "currency" | "percent";
    desc: string;
  }>;
  charts: {
    leadGenTrend: Array<{ bucket: string; leads: number; previous: number }>;
    adSpendTrend: Array<{ bucket: string; facebook: number; instagram: number; total: number }>;
    conversionFunnel: Array<{ stage: string; count: number }>;
    leadSourceDistribution: Array<{ name: string; count: number }>;
    businessPerformanceTrend: Array<{
      bucket: string;
      completedTransactions: number;
      vehiclePurchases: number;
      purchaseExpenditure: number;
      expenses: number;
      realizationValue: number;
      netProfit: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    summary: string;
    leadId: string;
    leadCode: string;
    customerName: string;
    actor: string;
    createdAt: string;
  }>;
  widgets: {
    todayFollowUps: Array<any>;
    overdueFollowUps: Array<any>;
    newEnquiries: Array<any>;
    unassignedLeads: Array<any>;
    highPriorityLeads: Array<any>;
    recentCustomerEnquiries: Array<any>;
    topCampaigns: Array<any>;
    topSalespeople: Array<any>;
    latestTransactions: Array<any>;
    upcomingPickups: Array<any>;
  };
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  totalLeads: <Users className="w-4 h-4" />,
  newLeads: <UserPlus className="w-4 h-4" />,
  contactedLeads: <PhoneCall className="w-4 h-4" />,
  interestedLeads: <Flame className="w-4 h-4" />,
  qualifiedLeads: <UserCheck className="w-4 h-4" />,
  confirmedDeals: <Award className="w-4 h-4" />,
  vehiclesCollected: <Car className="w-4 h-4" />,
  completedTransactions: <CheckCircle2 className="w-4 h-4" />,
  totalAdSpend: <Megaphone className="w-4 h-4" />,
  totalImpressions: <Eye className="w-4 h-4" />,
  totalReach: <Users className="w-4 h-4" />,
  totalClicks: <MousePointerClick className="w-4 h-4" />,
  averageCpl: <IndianRupee className="w-4 h-4" />,
  conversionRate: <Percent className="w-4 h-4" />,
  totalPurchaseValue: <IndianRupee className="w-4 h-4" />,
  netProfit: <TrendingUp className="w-4 h-4" />,
};

const SOURCE_COLORS = ["#0B5CA8", "#E1306C", "#16A34A", "#1B3156", "#F59E0B", "#7C3AED", "#06B6D4", "#64748B"];

export default function DashboardPage() {
  const [days, setDays] = useState("30");
  const [granularity, setGranularity] = useState("daily");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeWidgetTab, setActiveWidgetTab] = useState<"followups" | "leads" | "performance" | "operations">("followups");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?days=${days}&granularity=${granularity}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Unable to load business overview");
      const json = await res.json();
      setData(json);
      if (!json.permissions?.canViewLeads) {
        setActiveWidgetTab("operations");
      }
    } catch (e: any) {
      setError(e.message || "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, [days, granularity]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const dateLabel =
    days === "all" ? "All Time" : `Last ${days}d`;

  return (
    <AppShell>
      <PageHeader
        title="Business Overview Dashboard"
        subtitle="Consolidated Movish Group Gujarat performance — Meta Ads, Lead Pipeline, Vehicle Operations & Net Profitability"
        actions={
          <>
            <div className="inline-flex items-center gap-1.5 bg-white dark:bg-[#111a2e] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#0B5CA8]" />
              <select
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="bg-transparent font-medium focus:outline-none"
                aria-label="Date range"
              >
                <option value="7">Last 7 Days</option>
                <option value="14">Last 14 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="60">Last 60 Days</option>
                <option value="all">All Available Data</option>
              </select>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e] p-0.5 text-xs">
              {(["daily", "weekly", "monthly"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                    granularity === g
                      ? "bg-[#0B5CA8] text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </>
        }
      />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadDashboard} />}

      {!loading && data && (
        <div className="space-y-6">
          {/* 16 Main KPI Cards */}
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {data.kpis.map((kpi) => (
                <KpiCard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  prevValue={kpi.prev}
                  delta={kpi.delta}
                  format={kpi.format}
                  desc={kpi.desc}
                  dateLabel={dateLabel}
                  icon={KPI_ICONS[kpi.key] ?? <BarChart2 className="w-4 h-4" />}
                  invertGoodDirection={kpi.key === "averageCpl"}
                />
              ))}
            </div>
          </section>

          {/* Charts Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* A. Lead Generation Trend */}
            {data.permissions.canViewLeads && (
              <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Lead Generation Trend
                  </h2>
                  <p className="text-xs text-slate-500">Current vs previous period ({granularity})</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.leadGenTrend}>
                    <defs>
                      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0B5CA8" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#0B5CA8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      name="Current Period"
                      stroke="#0B5CA8"
                      strokeWidth={2}
                      fill="url(#leadGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="previous"
                      name="Previous Baseline"
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              </Card>
            )}

            {/* B. Advertising Spend Trend */}
            {data.permissions.canViewAds && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Meta Advertising Spend Trend (₹)
                    </h2>
                    <p className="text-xs text-slate-500">Facebook vs Instagram spend ({granularity})</p>
                  </div>
                  <Link href="/meta-ads" className="text-xs font-medium text-[#0B5CA8] hover:underline">
                    Open Meta Ads →
                  </Link>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.adSpendTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => formatINR(Number(val))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="facebook" name="Facebook (₹)" stackId="a" fill="#1B3156" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="instagram" name="Instagram (₹)" stackId="a" fill="#D62828" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* C. Lead Conversion Funnel */}
            {data.permissions.canViewLeads && (
              <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Lead Conversion Funnel
                  </h2>
                  <p className="text-xs text-slate-500">Enquiry progression across key stages</p>
                </div>
                <Link href="/leads?view=pipeline" className="text-xs font-medium text-[#0B5CA8] hover:underline">
                  View Kanban →
                </Link>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.conversionFunnel} layout="vertical" margin={{ left: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="stage" type="category" width={115} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill="#0B5CA8" radius={[0, 4, 4, 0]}>
                      {data.charts.conversionFunnel.map((entry, idx) => (
                        <Cell
                          key={entry.stage}
                          fill={entry.stage === "Lost" ? "#D62828" : entry.stage === "Completed" ? "#16A34A" : idx % 2 === 0 ? "#0B5CA8" : "#1B3156"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              </Card>
            )}

            {/* D. Lead Source Distribution */}
            {data.permissions.canViewLeads && (
              <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Lead Source Distribution
                  </h2>
                  <p className="text-xs text-slate-500">Enquiries across Meta, WhatsApp, Web & Calls</p>
                </div>
              </div>
              <div className="h-64 grid grid-cols-1 sm:grid-cols-2 items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.leadSourceDistribution}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.charts.leadSourceDistribution.map((entry, idx) => (
                        <Cell key={entry.name} fill={SOURCE_COLORS[idx % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 pr-2 max-h-56 overflow-y-auto">
                  {data.charts.leadSourceDistribution.map((s, idx) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }}
                        />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              </Card>
            )}
          </section>

          {/* E. Business Performance Trend + F. Recent Business Activity */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {data.permissions.canViewFinance && (
              <Card className="lg:col-span-7 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Business Financial Performance Trend (₹)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Purchase Expenditure vs Expenses vs Realized Value vs Net Profit
                    </p>
                  </div>
                  <Link href="/transactions" className="text-xs font-medium text-[#0B5CA8] hover:underline">
                    Finance Ledger →
                  </Link>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.businessPerformanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => formatINR(Number(val))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="purchaseExpenditure" name="Purchase Spend" fill="#1B3156" />
                      <Bar dataKey="expenses" name="Expenses" fill="#F59E0B" />
                      <Bar dataKey="realizationValue" name="Realization" fill="#0B5CA8" />
                      <Bar dataKey="netProfit" name="Net Profit" fill="#16A34A" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* F. Recent Business Activity */}
            {data.permissions.canViewLeads && (
              <Card className={data.permissions.canViewFinance ? "lg:col-span-5 p-5" : "lg:col-span-12 p-5"}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0B5CA8]" />
                  Recent Business Activity
                </h2>
              </div>
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {data.recentActivity.map((act) => (
                  <Link
                    key={act.id}
                    href={`/leads/${act.leadId}`}
                    className="block p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#0B5CA8] dark:text-blue-400">
                        {act.leadCode} · {act.customerName}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(act.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-1">
                      {act.summary}
                    </p>
                    <span className="text-[10px] text-slate-400">By {act.actor}</span>
                  </Link>
                ))}
              </div>
              </Card>
            )}
          </section>

          {/* 5.4 Dashboard Quick Widgets */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Operational Quick Widgets
              </h2>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  ...(data.permissions.canViewLeads ? [{ key: "followups", label: "Follow-ups (Today & Overdue)" }] : []),
                  ...(data.permissions.canViewLeads ? [{ key: "leads", label: "Enquiries (New, Unassigned, Hot)" }] : []),
                  ...((data.permissions.canViewAds || data.permissions.canViewTeam) ? [{ key: "performance", label: "Top Campaigns & Salespeople" }] : []),
                  ...((data.permissions.canViewVehicles || data.permissions.canViewFinance) ? [{ key: "operations", label: "Pickups & Latest Transactions" }] : []),
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveWidgetTab(t.key as any)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      activeWidgetTab === t.key
                        ? "bg-[#1B3156] text-white border-[#1B3156]"
                        : "bg-white dark:bg-[#111a2e] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {activeWidgetTab === "followups" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Today&apos;s Follow-ups ({data.widgets.todayFollowUps.length})
                    </h3>
                    <Link href="/follow-ups?tab=today" className="text-xs text-[#0B5CA8] hover:underline">
                      Open All
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.widgets.todayFollowUps.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No follow-ups scheduled for today.</p>
                    ) : (
                      data.widgets.todayFollowUps.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs">
                          <div>
                            <Link href={`/leads/${f.lead.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#0B5CA8]">
                              {f.customer.name} ({f.lead.leadCode})
                            </Link>
                            <div className="text-[11px] text-slate-500">
                              {f.type} · {f.followUpTime} · {f.assignedEmployee.fullName}
                            </div>
                          </div>
                          <StatusBadge value={f.priority} />
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D62828] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Overdue Follow-ups ({data.widgets.overdueFollowUps.length})
                    </h3>
                    <Link href="/follow-ups?tab=overdue" className="text-xs text-[#0B5CA8] hover:underline">
                      Recover All
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.widgets.overdueFollowUps.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No overdue follow-ups.</p>
                    ) : (
                      data.widgets.overdueFollowUps.map((f) => (
                        <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 text-xs">
                          <div>
                            <Link href={`/leads/${f.lead.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#0B5CA8]">
                              {f.customer.name} ({f.lead.leadCode})
                            </Link>
                            <div className="text-[11px] text-slate-500">
                              Due {formatDate(f.followUpDate)} · {f.type} · {f.assignedEmployee.fullName}
                            </div>
                          </div>
                          <StatusBadge value="Missed" />
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            )}

            {activeWidgetTab === "leads" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: "New Enquiries", rows: data.widgets.newEnquiries },
                  { title: "Unassigned Leads", rows: data.widgets.unassignedLeads },
                  { title: "High-Priority (Hot) Leads", rows: data.widgets.highPriorityLeads },
                  { title: "Recent Customer Enquiries", rows: data.widgets.recentCustomerEnquiries },
                ].map((box) => (
                  <Card key={box.title} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {box.title}
                      </h3>
                      <Link href="/leads" className="text-xs text-[#0B5CA8] hover:underline">View</Link>
                    </div>
                    <div className="space-y-2">
                      {box.rows.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">None in period</p>
                      ) : (
                        box.rows.map((l) => (
                          <Link
                            key={l.id}
                            href={`/leads/${l.id}`}
                            className="block p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 hover:bg-blue-50/50 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold truncate">{l.customer.name}</span>
                              <StatusBadge value={l.priority} />
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {l.leadCode} · {l.customer.city} · {l.leadSource?.name}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {activeWidgetTab === "performance" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Top-Performing Campaigns
                  </h3>
                  {data.widgets.topCampaigns.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4">Restricted or no campaign data.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.widgets.topCampaigns.map((c) => (
                        <Link
                          key={c.id}
                          href={`/meta-ads/campaigns/${c.id}`}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 hover:bg-blue-50/50 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{c.name}</div>
                            <div className="text-[11px] text-slate-500">{c.platform} · Spend {formatINR(c.spend)}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-[#0B5CA8]">{c.leads} Leads</div>
                            <div className="text-[11px] text-slate-500">CPL {formatINR(c.cpl)}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Top-Performing Salespeople
                  </h3>
                  <div className="space-y-2">
                    {data.widgets.topSalespeople.map((e) => (
                      <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs">
                        <div>
                          <div className="font-semibold">{e.name}</div>
                          <div className="text-[11px] text-slate-500">{e.city} · {e.assigned} Leads · {e.qualified} Qualified</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600">{e.completed} Completed</div>
                          <div className="text-[11px] text-slate-500">{e.conversionRate}% Conv.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeWidgetTab === "operations" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Upcoming Vehicle Pickups
                    </h3>
                    <Link href="/vehicles?tab=pickup" className="text-xs text-[#0B5CA8] hover:underline">Manage</Link>
                  </div>
                  <div className="space-y-2">
                    {data.widgets.upcomingPickups.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs">
                        <div>
                          <div className="font-semibold">
                            {p.vehicle.manufacturer} {p.vehicle.model} ({p.vehicle.registrationNumber})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {p.customer.name} · {p.city} · {p.scheduledDate ? formatDate(p.scheduledDate) : "Date TBD"}
                          </div>
                        </div>
                        <StatusBadge value={p.pickupStatus} />
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Latest Transactions
                    </h3>
                    <Link href="/transactions" className="text-xs text-[#0B5CA8] hover:underline">View All</Link>
                  </div>
                  {!data.permissions.canViewFinance ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Financial records restricted for your role.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.widgets.latestTransactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-xs">
                          <div>
                            <div className="font-semibold">{t.transactionCode} · {t.vehicle.registrationNumber}</div>
                            <div className="text-[11px] text-slate-500">{t.customer.name} · {t.customer.city}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{formatINR(t.vehiclePurchaseAmount)}</div>
                            <StatusBadge value={t.paymentStatus} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
