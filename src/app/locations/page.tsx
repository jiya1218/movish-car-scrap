"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Award, MapPin, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { GUJARAT_DISTRICTS, LEAD_STAGES } from "@/lib/constants";
import { formatINR } from "@/lib/format";

export default function LocationsPage() {
  const [view, setView] = useState<"districts" | "cities">("cities");
  const [district, setDistrict] = useState("All");
  const [employeeId, setEmployeeId] = useState("All");
  const [campaignId, setCampaignId] = useState("All");
  const [status, setStatus] = useState("All");
  const [pinCode, setPinCode] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ district, employeeId, campaignId, status, pinCode });
      const res = await fetch(`/api/locations?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load location analytics");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [district, employeeId, campaignId, status, pinCode]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const rows = view === "districts" ? data?.districtRows || [] : data?.cityRows || [];

  return (
    <AppShell>
      <PageHeader
        title="Gujarat Location Analytics"
        subtitle="District, city, and PIN-code intelligence across Gujarat scrap car enquiries, conversion, ad spend & net profit"
        actions={
          <div className="flex gap-1 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <button onClick={() => setView("cities")} className={`px-3 py-1.5 rounded-lg font-semibold ${view === "cities" ? "bg-[#0B5CA8] text-white" : ""}`}>
              Cities
            </button>
            <button onClick={() => setView("districts")} className={`px-3 py-1.5 rounded-lg font-semibold ${view === "districts" ? "bg-[#0B5CA8] text-white" : ""}`}>
              Districts
            </button>
          </div>
        }
      />

      <Card className="p-3.5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900">
            <option value="All">All Gujarat Districts</option>
            {GUJARAT_DISTRICTS.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}
          </select>
          <input value={pinCode} onChange={(e) => setPinCode(e.target.value)} placeholder="Filter PIN code..." className="px-2.5 py-1.5 rounded-lg border bg-transparent" />
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900">
            <option value="All">Employee: All</option>
            {(data?.options?.employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900">
            <option value="All">Campaign: All</option>
            {(data?.options?.campaigns || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900">
            <option value="All">Lead Status: All</option>
            {LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
          </select>
          <button onClick={() => { setDistrict("All"); setPinCode(""); setEmployeeId("All"); setCampaignId("All"); setStatus("All"); }} className="px-3 py-1.5 rounded-lg border">
            Reset
          </button>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadLocations} />}

      {!loading && data && (
        <div className="space-y-5">
          {/* 6 Location-Based Business Insights (Sec 14.5) */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            {[
              { label: "Most Enquiries", value: data.insights.topEnquiryCity, icon: <MapPin className="w-3.5 h-3.5 text-[#0B5CA8]" /> },
              { label: "Most Qualified Leads", value: data.insights.topQualifiedCity, icon: <Award className="w-3.5 h-3.5 text-indigo-600" /> },
              { label: "Top Completed Txns", value: data.insights.topCompletedCity, icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> },
              { label: "Low Conversion City", value: data.insights.lowestConversionCity, icon: <TrendingDown className="w-3.5 h-3.5 text-amber-600" /> },
              { label: "Highest Ad Spend", value: data.insights.highestSpendCity, icon: <MapPin className="w-3.5 h-3.5 text-[#D62828]" /> },
              { label: "Best Profitability", value: data.insights.mostProfitableCity, icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> },
            ].map((i) => (
              <Card key={i.label} className="p-3.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{i.label}</span>
                  {i.icon}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">{i.value}</div>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">
              {view === "districts" ? "District-Wise" : "City-Wise"} Leads vs Qualified vs Completed
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey={view === "districts" ? "district" : "city"} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalLeads" name="Total Leads" fill="#1B3156" />
                  <Bar dataKey="qualifiedLeads" name="Qualified" fill="#0B5CA8" />
                  <Bar dataKey="completedTransactions" name="Completed Txns" fill="#16A34A" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                  <tr>
                    <th className="p-3">{view === "districts" ? "District" : "City / District"}</th>
                    <th className="p-3">PIN Codes</th>
                    <th className="p-3 text-right">Total Leads</th>
                    <th className="p-3 text-right">Qualified</th>
                    <th className="p-3 text-right">Completed</th>
                    <th className="p-3 text-right">Conv %</th>
                    <th className="p-3 text-right">Est. Ad Spend</th>
                    <th className="p-3 text-right">CPL</th>
                    <th className="p-3 text-right">Purchase Spend</th>
                    <th className="p-3 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r: any) => (
                    <tr key={r.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold">{view === "districts" ? r.district : `${r.city} (${r.district})`}</td>
                      <td className="p-3 text-[11px] text-slate-400">{r.pinCodes.slice(0, 3).join(", ") || "—"}</td>
                      <td className="p-3 text-right font-bold">{r.totalLeads}</td>
                      <td className="p-3 text-right text-[#0B5CA8] font-semibold">{r.qualifiedLeads}</td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">{r.completedTransactions}</td>
                      <td className="p-3 text-right">{r.conversionRate}%</td>
                      <td className="p-3 text-right tabular-nums">{r.adSpend !== null ? formatINR(r.adSpend) : "Restricted"}</td>
                      <td className="p-3 text-right tabular-nums">{r.cpl !== null ? formatINR(r.cpl) : "Restricted"}</td>
                      <td className="p-3 text-right tabular-nums">{r.purchaseExpenditure !== null ? formatINR(r.purchaseExpenditure) : "Restricted"}</td>
                      <td className={`p-3 text-right font-bold tabular-nums ${(r.netProfit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {r.netProfit !== null ? formatINR(r.netProfit) : "Restricted"}
                      </td>
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
