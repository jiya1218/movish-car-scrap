"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Plus, Target, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthContext";
import { Card, ErrorState, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { GUJARAT_DISTRICTS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export default function TeamPage() {
  const { hasPerm } = useAuth();
  const [tab, setTab] = useState<"employees" | "performance" | "targets" | "activity">("employees");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [targetEmp, setTargetEmp] = useState<any>(null);
  const [empForm, setEmpForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    roleId: "",
    assignedDistrict: "Ahmedabad",
    assignedCity: "Ahmedabad",
    createLoginAccount: true,
    password: "Movish@2026",
  });

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load team data");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(empForm),
    });
    if (res.ok) {
      setAddOpen(false);
      await loadTeam();
    } else {
      const j = await res.json();
      alert(j.error || "Unable to add employee");
    }
  };

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmp) return;
    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: targetEmp.id,
        monthlyLeadTarget: targetEmp.targets.leadsContacted,
        monthlyQualifiedTarget: targetEmp.targets.qualifiedLeads,
        monthlyQuotationTarget: targetEmp.targets.quotations,
        monthlyDealTarget: targetEmp.targets.confirmedDeals,
        monthlyPickupTarget: targetEmp.targets.vehiclesCollected,
        monthlyCompletedTarget: targetEmp.targets.completedTransactions,
      }),
    });
    if (res.ok) {
      setTargetEmp(null);
      await loadTeam();
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Team & Employee Management"
        subtitle="Monitor Gujarat employee productivity, lead handling, conversion rates, monthly targets, and activity logs"
        actions={
          hasPerm("team:manage") && (
            <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit text-xs mb-5">
        {[
          { key: "employees", label: `Employees (${data?.employees?.length ?? 0})`, icon: <Users className="w-3.5 h-3.5" /> },
          { key: "performance", label: "Performance Metrics", icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { key: "targets", label: "Monthly Targets", icon: <Target className="w-3.5 h-3.5" /> },
          { key: "activity", label: "Activity Logs", icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadTeam} />}

      {!loading && data && (
        <>
          {tab === "employees" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Employee ID</th>
                      <th className="p-3">Full Name & Contact</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Operating Location</th>
                      <th className="p-3">Reporting Manager</th>
                      <th className="p-3">Joining Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.employees.map((e: any) => (
                      <tr key={e.id}>
                        <td className="p-3 font-semibold text-[#0B5CA8]">{e.employeeCode}</td>
                        <td className="p-3">
                          <div className="font-semibold">{e.fullName}</div>
                          <div className="text-[11px] text-slate-500">{e.mobile} · {e.email}</div>
                        </td>
                        <td className="p-3">{e.roleName}</td>
                        <td className="p-3">{e.assignedCity}, {e.assignedDistrict}</td>
                        <td className="p-3">{e.reportingManagerName}</td>
                        <td className="p-3">{formatDate(e.joiningDate)}</td>
                        <td className="p-3"><StatusBadge value={e.accountStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "performance" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3 text-right">Assigned</th>
                      <th className="p-3 text-right">Contacted</th>
                      <th className="p-3 text-right">Interested</th>
                      <th className="p-3 text-right">Qualified</th>
                      <th className="p-3 text-right">Quotations</th>
                      <th className="p-3 text-right">Confirmed</th>
                      <th className="p-3 text-right">Collected</th>
                      <th className="p-3 text-right">Completed</th>
                      <th className="p-3 text-right">Follow-ups</th>
                      <th className="p-3 text-right">Overdue</th>
                      <th className="p-3 text-right">Resp (h)</th>
                      <th className="p-3 text-right">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.employees.map((e: any) => (
                      <tr key={e.id}>
                        <td className="p-3">
                          <div className="font-semibold">{e.fullName}</div>
                          <div className="text-[10px] text-slate-400">{e.roleName}</div>
                        </td>
                        <td className="p-3 text-right font-semibold">{e.metrics.leadsAssigned}</td>
                        <td className="p-3 text-right">{e.metrics.leadsContacted}</td>
                        <td className="p-3 text-right">{e.metrics.interestedLeads}</td>
                        <td className="p-3 text-right text-[#0B5CA8] font-semibold">{e.metrics.qualifiedLeads}</td>
                        <td className="p-3 text-right">{e.metrics.quotationsGiven}</td>
                        <td className="p-3 text-right">{e.metrics.dealsConfirmed}</td>
                        <td className="p-3 text-right">{e.metrics.vehiclesCollected}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{e.metrics.completedTransactions}</td>
                        <td className="p-3 text-right">{e.metrics.followUpsCompleted}</td>
                        <td className="p-3 text-right text-red-500 font-semibold">{e.metrics.overdueFollowUps}</td>
                        <td className="p-3 text-right">{e.metrics.avgResponseHours}h</td>
                        <td className="p-3 text-right font-bold">{e.metrics.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "targets" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.employees
                .filter((e: any) => ["SALES_EXECUTIVE", "MANAGER", "OPERATIONS_EXECUTIVE"].includes(e.roleCode))
                .map((e: any) => {
                  const rows = [
                    { label: "Leads Contacted", actual: e.metrics.leadsContacted, target: e.targets.leadsContacted },
                    { label: "Qualified Leads", actual: e.metrics.qualifiedLeads, target: e.targets.qualifiedLeads },
                    { label: "Quotations", actual: e.metrics.quotationsGiven, target: e.targets.quotations },
                    { label: "Confirmed Deals", actual: e.metrics.dealsConfirmed, target: e.targets.confirmedDeals },
                    { label: "Vehicles Collected", actual: e.metrics.vehiclesCollected, target: e.targets.vehiclesCollected },
                    { label: "Completed Transactions", actual: e.metrics.completedTransactions, target: e.targets.completedTransactions },
                  ];
                  return (
                    <Card key={e.id} className="p-4 text-xs">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-sm">{e.fullName}</div>
                          <div className="text-[11px] text-slate-400">{e.roleName} · {e.assignedCity}</div>
                        </div>
                        {hasPerm("team:manage") && (
                          <button onClick={() => setTargetEmp(JSON.parse(JSON.stringify(e)))} className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                            Edit Targets
                          </button>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {rows.map((r) => {
                          const pct = r.target > 0 ? Math.min(100, Math.round((r.actual / r.target) * 100)) : 0;
                          return (
                            <div key={r.label}>
                              <div className="flex justify-between mb-1">
                                <span>{r.label}</span>
                                <span className="font-semibold">{r.actual} / {r.target} ({pct}%)</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full bg-[#0B5CA8]" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}

          {tab === "activity" && (
            <Card className="p-4 space-y-2 text-xs">
              {data.activityLogs.map((a: any) => (
                <div key={a.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex justify-between gap-2">
                  <div>
                    <span className="font-semibold text-[#0B5CA8]">{a.performedBy?.fullName || "System"}</span> ·{" "}
                    <Link href={`/leads/${a.lead.id}`} className="font-semibold hover:underline">{a.lead.leadCode}</Link> ({a.lead.customer.name})
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{a.summary}</div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatDateTime(a.createdAt)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Add Employee Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Employee" maxWidth="max-w-md">
        <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
          <input required placeholder="Full Name *" value={empForm.fullName} onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input required type="email" placeholder="Work Email *" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input required placeholder="Mobile Number *" value={empForm.mobile} onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select required value={empForm.roleId} onChange={(e) => setEmpForm({ ...empForm, roleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Role...</option>
            {(data?.roles || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={empForm.assignedDistrict} onChange={(e) => setEmpForm({ ...empForm, assignedDistrict: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              {GUJARAT_DISTRICTS.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}
            </select>
            <input placeholder="City" value={empForm.assignedCity} onChange={(e) => setEmpForm({ ...empForm, assignedCity: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={empForm.createLoginAccount} onChange={(e) => setEmpForm({ ...empForm, createLoginAccount: e.target.checked })} />
            Also create login account (default password: {empForm.password})
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Add Employee</button>
          </div>
        </form>
      </Modal>

      {/* Edit Targets Modal */}
      <Modal open={Boolean(targetEmp)} onClose={() => setTargetEmp(null)} title={`Edit Monthly Targets — ${targetEmp?.fullName || ""}`} maxWidth="max-w-md">
        {targetEmp && (
          <form onSubmit={handleSaveTargets} className="space-y-3 text-xs">
            {[
              { key: "leadsContacted", label: "Leads Contacted Target" },
              { key: "qualifiedLeads", label: "Qualified Leads Target" },
              { key: "quotations", label: "Quotations Target" },
              { key: "confirmedDeals", label: "Confirmed Deals Target" },
              { key: "vehiclesCollected", label: "Vehicles Collected Target" },
              { key: "completedTransactions", label: "Completed Transactions Target" },
            ].map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <label className="font-medium">{f.label}</label>
                <input
                  type="number"
                  value={targetEmp.targets[f.key]}
                  onChange={(e) =>
                    setTargetEmp({
                      ...targetEmp,
                      targets: { ...targetEmp.targets, [f.key]: Number(e.target.value) },
                    })
                  }
                  className="w-24 px-2.5 py-1.5 rounded-lg border bg-transparent text-right"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTargetEmp(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Targets</button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
