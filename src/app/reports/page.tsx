"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export";
import { formatDate, formatINR, formatNumber } from "@/lib/format";

export default function ReportsPage() {
  const [tab, setTab] = useState<"marketing" | "crm" | "finance" | "operations" | "team">("crm");
  const [days, setDays] = useState("60");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports?days=${days}`, { cache: "no-store" });
      if (res.status === 403) throw new Error("Reports access is restricted for your role.");
      if (!res.ok) throw new Error("Unable to generate reports");
      const json = await res.json();
      setData(json);
      const allowedTabs = [
        ...(json.permissions?.canViewAds ? ["marketing"] : []),
        ...(json.permissions?.canViewCrm ? ["crm"] : []),
        ...(json.permissions?.canViewFinance ? ["finance"] : []),
        ...(json.permissions?.canViewOperations ? ["operations"] : []),
        ...(json.permissions?.canViewTeam ? ["team"] : []),
      ];
      setTab((prev) => (allowedTabs.includes(prev) ? prev : ((allowedTabs[0] as any) || "crm")));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExport = (fmt: "csv" | "xlsx" | "pdf") => {
    if (!data) return;
    let rows: any[] = [];
    let cols: any[] = [];
    let title = "";

    if (tab === "marketing") {
      title = "Marketing Performance Report";
      rows = data.marketingReport;
      cols = [
        { header: "Code", accessor: (r: any) => r.campaignCode },
        { header: "Campaign", accessor: (r: any) => r.name },
        { header: "Platform", accessor: (r: any) => r.platform },
        { header: "Spend (INR)", accessor: (r: any) => r.spend },
        { header: "Impressions", accessor: (r: any) => r.impressions },
        { header: "Clicks", accessor: (r: any) => r.clicks },
        { header: "CTR %", accessor: (r: any) => r.ctr },
        { header: "Leads", accessor: (r: any) => r.leads },
        { header: "CPL (INR)", accessor: (r: any) => r.cpl },
        { header: "Completed", accessor: (r: any) => r.completed },
      ];
    } else if (tab === "crm") {
      title = "CRM Lead Pipeline Report";
      rows = data.crmLeads;
      cols = [
        { header: "Lead ID", accessor: (r: any) => r.leadCode },
        { header: "Customer", accessor: (r: any) => r.customerName },
        { header: "City", accessor: (r: any) => r.city },
        { header: "Source", accessor: (r: any) => r.source },
        { header: "Campaign", accessor: (r: any) => r.campaign },
        { header: "Status", accessor: (r: any) => r.status },
        { header: "Priority", accessor: (r: any) => r.priority },
        { header: "Assignee", accessor: (r: any) => r.assignee },
        { header: "Date", accessor: (r: any) => formatDate(r.enquiryDate) },
      ];
    } else if (tab === "finance") {
      title = "Financial Profitability Report";
      rows = data.financeReport;
      cols = [
        { header: "Txn ID", accessor: (r: any) => r.transactionCode },
        { header: "Vehicle", accessor: (r: any) => r.vehicle },
        { header: "City", accessor: (r: any) => r.city },
        { header: "Purchase (INR)", accessor: (r: any) => r.purchaseCost },
        { header: "Expenses (INR)", accessor: (r: any) => r.expenses },
        { header: "Realization (INR)", accessor: (r: any) => r.realization },
        { header: "Net Profit (INR)", accessor: (r: any) => r.netProfit },
        { header: "Status", accessor: (r: any) => r.status },
      ];
    } else if (tab === "operations") {
      title = "Vehicle Operations Report";
      rows = data.operationsReport;
      cols = [
        { header: "Vehicle ID", accessor: (r: any) => r.vehicleCode },
        { header: "Reg No", accessor: (r: any) => r.registrationNumber },
        { header: "Model", accessor: (r: any) => r.vehicle },
        { header: "City", accessor: (r: any) => r.city },
        { header: "Pickup", accessor: (r: any) => r.pickupStatus },
        { header: "Docs Verified", accessor: (r: any) => r.docsVerified },
        { header: "Processing", accessor: (r: any) => r.processingStatus },
        { header: "Status", accessor: (r: any) => r.purchaseStatus },
      ];
    } else {
      title = "Employee Performance Report";
      rows = data.teamReport;
      cols = [
        { header: "Code", accessor: (r: any) => r.employeeCode },
        { header: "Name", accessor: (r: any) => r.name },
        { header: "Role", accessor: (r: any) => r.role },
        { header: "City", accessor: (r: any) => r.city },
        { header: "Assigned", accessor: (r: any) => r.assignedLeads },
        { header: "Qualified", accessor: (r: any) => r.qualifiedLeads },
        { header: "Completed", accessor: (r: any) => r.completedDeals },
        { header: "Conv %", accessor: (r: any) => r.conversionRate },
        { header: "Target Ach %", accessor: (r: any) => r.targetAchievementPct },
      ];
    }

    const slug = `movish-${tab}-report`;
    if (fmt === "csv") exportToCSV(slug, rows, cols);
    else if (fmt === "xlsx") exportToExcel(slug, tab, rows, cols);
    else exportToPDF(slug, title, `Period: Last ${days} Days`, rows, cols);
  };

  return (
    <AppShell>
      <PageHeader
        title="Reports & Business Intelligence"
        subtitle="Role-scoped Marketing, CRM, Finance, Operations & Team analytics with CSV, Excel, and PDF exports"
        actions={
          <>
            <select value={days} onChange={(e) => setDays(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-[#111a2e]">
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="180">Last 180 Days</option>
            </select>
            {data?.permissions?.canExport && (
              <>
                <button onClick={() => handleExport("csv")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border bg-white dark:bg-[#111a2e] hover:bg-slate-50">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={() => handleExport("xlsx")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border bg-white dark:bg-[#111a2e] hover:bg-slate-50">
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
                <button onClick={() => handleExport("pdf")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </>
            )}
          </>
        }
      />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadReports} />}

      {!loading && data && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit text-xs">
            {[
              ...(data.permissions.canViewAds ? [{ key: "marketing", label: "Marketing" }] : []),
              ...(data.permissions.canViewCrm ? [{ key: "crm", label: "CRM" }] : []),
              ...(data.permissions.canViewFinance ? [{ key: "finance", label: "Finance" }] : []),
              ...(data.permissions.canViewOperations ? [{ key: "operations", label: "Operations" }] : []),
              ...(data.permissions.canViewTeam ? [{ key: "team", label: "Team" }] : []),
            ].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-3.5 py-1.5 rounded-lg font-semibold ${tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "marketing" && data.permissions.canViewAds && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                    <tr>
                      <th className="p-3">Campaign</th>
                      <th className="p-3">Platform</th>
                      <th className="p-3 text-right">Spend</th>
                      <th className="p-3 text-right">Impressions</th>
                      <th className="p-3 text-right">Clicks / CTR</th>
                      <th className="p-3 text-right">CPC / CPM</th>
                      <th className="p-3 text-right">Leads / CPL</th>
                      <th className="p-3 text-right">Qualified / Closed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.marketingReport.map((r: any) => (
                      <tr key={r.campaignCode}>
                        <td className="p-3 font-semibold">{r.campaignCode} — {r.name}</td>
                        <td className="p-3">{r.platform}</td>
                        <td className="p-3 text-right font-semibold">{formatINR(r.spend)}</td>
                        <td className="p-3 text-right">{formatNumber(r.impressions)}</td>
                        <td className="p-3 text-right">{formatNumber(r.clicks)} ({r.ctr}%)</td>
                        <td className="p-3 text-right">{formatINR(r.cpc)} / {formatINR(r.cpm)}</td>
                        <td className="p-3 text-right font-bold text-[#0B5CA8]">{r.leads} ({formatINR(r.cpl)})</td>
                        <td className="p-3 text-right">{r.qualified} / {r.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "crm" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                {[
                  { label: "Total Leads", value: data.crmSummary.totalLeads },
                  { label: "Contacted", value: data.crmSummary.contacted },
                  { label: "Qualified", value: data.crmSummary.qualified },
                  { label: "Lost", value: data.crmSummary.lost },
                  { label: "Conversion Rate", value: `${data.crmSummary.conversionRate}%` },
                ].map((m) => (
                  <Card key={m.label} className="p-3.5">
                    <div className="text-slate-400">{m.label}</div>
                    <div className="text-lg font-bold mt-0.5">{m.value}</div>
                  </Card>
                ))}
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                      <tr>
                        <th className="p-3">Lead ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">City</th>
                        <th className="p-3">Source / Campaign</th>
                        <th className="p-3">Stage</th>
                        <th className="p-3">Assignee</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.crmLeads.slice(0, 50).map((l: any) => (
                        <tr key={l.leadCode}>
                          <td className="p-3 font-semibold">{l.leadCode}</td>
                          <td className="p-3">{l.customerName}</td>
                          <td className="p-3">{l.city}</td>
                          <td className="p-3">{l.source} ({l.campaign})</td>
                          <td className="p-3"><StatusBadge value={l.status} /></td>
                          <td className="p-3">{l.assignee}</td>
                          <td className="p-3">{formatDate(l.enquiryDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {tab === "finance" && data.permissions.canViewFinance && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Card className="p-3.5"><div className="text-slate-400">Purchase Cost</div><div className="text-lg font-bold">{formatINR(data.financeTotals.purchaseCost)}</div></Card>
                <Card className="p-3.5"><div className="text-slate-400">Op. Expenses</div><div className="text-lg font-bold text-amber-600">{formatINR(data.financeTotals.operationalExpenses)}</div></Card>
                <Card className="p-3.5"><div className="text-slate-400">Realization</div><div className="text-lg font-bold text-[#0B5CA8]">{formatINR(data.financeTotals.realization)}</div></Card>
                <Card className="p-3.5"><div className="text-slate-400">Net Profit</div><div className="text-lg font-bold text-emerald-600">{formatINR(data.financeTotals.netProfit)}</div></Card>
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                      <tr>
                        <th className="p-3">Txn ID</th>
                        <th className="p-3">Vehicle & City</th>
                        <th className="p-3 text-right">Purchase Cost</th>
                        <th className="p-3 text-right">Expenses</th>
                        <th className="p-3 text-right">Realization</th>
                        <th className="p-3 text-right">Net Profit</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.financeReport.map((f: any) => (
                        <tr key={f.transactionCode}>
                          <td className="p-3 font-semibold">{f.transactionCode}</td>
                          <td className="p-3">{f.vehicle} · {f.city}</td>
                          <td className="p-3 text-right">{formatINR(f.purchaseCost)}</td>
                          <td className="p-3 text-right">{formatINR(f.expenses)}</td>
                          <td className="p-3 text-right">{formatINR(f.realization)}</td>
                          <td className={`p-3 text-right font-bold ${f.netProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatINR(f.netProfit)}</td>
                          <td className="p-3"><StatusBadge value={f.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {tab === "operations" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                    <tr>
                      <th className="p-3">Vehicle ID</th>
                      <th className="p-3">Reg & Model</th>
                      <th className="p-3">City</th>
                      <th className="p-3">Pickup Status</th>
                      <th className="p-3">Docs Verified</th>
                      <th className="p-3">Processing</th>
                      <th className="p-3">Purchase Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.operationsReport.map((o: any) => (
                      <tr key={o.vehicleCode}>
                        <td className="p-3 font-semibold">{o.vehicleCode}</td>
                        <td className="p-3">{o.registrationNumber} — {o.vehicle}</td>
                        <td className="p-3">{o.city}</td>
                        <td className="p-3"><StatusBadge value={o.pickupStatus} /></td>
                        <td className="p-3">{o.docsVerified}</td>
                        <td className="p-3">{o.processingStatus}</td>
                        <td className="p-3"><StatusBadge value={o.purchaseStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "team" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                    <tr>
                      <th className="p-3">Code</th>
                      <th className="p-3">Employee & Role</th>
                      <th className="p-3">City</th>
                      <th className="p-3 text-right">Assigned</th>
                      <th className="p-3 text-right">Qualified</th>
                      <th className="p-3 text-right">Completed</th>
                      <th className="p-3 text-right">Conv %</th>
                      <th className="p-3 text-right">Target Ach %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.teamReport.map((t: any) => (
                      <tr key={t.employeeCode}>
                        <td className="p-3 font-semibold">{t.employeeCode}</td>
                        <td className="p-3">{t.name} ({t.role})</td>
                        <td className="p-3">{t.city}</td>
                        <td className="p-3 text-right">{t.assignedLeads}</td>
                        <td className="p-3 text-right">{t.qualifiedLeads}</td>
                        <td className="p-3 text-right font-bold">{t.completedDeals}</td>
                        <td className="p-3 text-right">{t.conversionRate}%</td>
                        <td className="p-3 text-right font-semibold">{t.targetAchievementPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
