"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarClock, CheckCircle2, Clock, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, ErrorState, KpiCard, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { FOLLOWUP_TYPES, LEAD_STAGES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

function FollowUpsContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "today");
  const [employeeId, setEmployeeId] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    leadId: "",
    assignedEmployeeId: "",
    followUpDate: new Date().toISOString().slice(0, 10),
    followUpTime: "11:00",
    type: FOLLOWUP_TYPES[0] as string,
    priority: "Medium",
    notes: "",
  });
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [completeForm, setCompleteForm] = useState({
    contactResult: "Connected — Interested",
    customerResponse: "",
    updatedLeadStatus: "",
    notes: "",
    nextFollowUpDate: "",
    nextAction: "",
  });

  const loadFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ tab, employeeId, type: typeFilter, search });
      const res = await fetch(`/api/follow-ups?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load follow-ups");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, employeeId, typeFilter, search]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    if (res.ok) {
      setCreateOpen(false);
      await loadFollowUps();
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTarget) return;
    const res = await fetch(`/api/follow-ups/${completeTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed", ...completeForm }),
    });
    if (res.ok) {
      setCompleteTarget(null);
      await loadFollowUps();
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Follow-up & Task Management"
        subtitle="Track Today's Tasks, Overdue alerts, Missed follow-ups, and response SLA across Gujarat"
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white hover:bg-[#1B3156]"
          >
            <Plus className="w-4 h-4" /> Schedule Follow-up
          </button>
        }
      />

      {data?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <KpiCard label="Total Follow-ups" value={data.metrics.total} icon={<CalendarClock className="w-4 h-4" />} />
          <KpiCard label="Today's Tasks" value={data.metrics.today} icon={<Clock className="w-4 h-4" />} />
          <KpiCard label="Overdue" value={data.metrics.overdue} icon={<Clock className="w-4 h-4" />} invertGoodDirection />
          <KpiCard label="Completed" value={data.metrics.completed} icon={<CheckCircle2 className="w-4 h-4" />} />
          <KpiCard label="Completion Rate" value={data.metrics.completionRate} format="percent" icon={<CheckCircle2 className="w-4 h-4" />} />
          <KpiCard label="Avg Response (hrs)" value={data.metrics.avgResponseHours} icon={<Clock className="w-4 h-4" />} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit text-xs mb-4">
        {[
          { key: "today", label: `Today's Tasks (${data?.metrics?.today ?? 0})` },
          { key: "upcoming", label: `Upcoming (${data?.metrics?.upcoming ?? 0})` },
          { key: "overdue", label: `Overdue (${data?.metrics?.overdue ?? 0})` },
          { key: "completed", label: `Completed (${data?.metrics?.completed ?? 0})` },
          { key: "missed", label: `Missed (${data?.metrics?.missed ?? 0})` },
          { key: "no_followup", label: `Leads Without Follow-up (${data?.metrics?.noFollowUpCount ?? 0})` },
          { key: "all", label: "All" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg font-semibold ${tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-3.5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search follow-up, customer, lead ID..." className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
          </div>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Employee: All</option>
            {(data?.employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Type: All</option>
            {FOLLOWUP_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
          </select>
          <button onClick={() => { setSearch(""); setEmployeeId("All"); setTypeFilter("All"); }} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            Reset Filters
          </button>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadFollowUps} />}

      {!loading && data && tab === "no_followup" && (
        <Card className="overflow-hidden">
          {data.leadsWithoutFollowup.length === 0 ? (
            <EmptyState title="Every active lead has a follow-up scheduled" />
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                <tr>
                  <th className="p-3">Lead ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.leadsWithoutFollowup.map((l: any) => (
                  <tr key={l.id}>
                    <td className="p-3"><Link href={`/leads/${l.id}`} className="font-semibold text-[#0B5CA8] hover:underline">{l.leadCode}</Link></td>
                    <td className="p-3">{l.customer.name} ({l.customer.primaryMobile})</td>
                    <td className="p-3">{l.customer.city}</td>
                    <td className="p-3"><StatusBadge value={l.status} /></td>
                    <td className="p-3">{l.assignedEmployee?.fullName || "Unassigned"}</td>
                    <td className="p-3">
                      <button
                        onClick={() => {
                          setCreateForm({ ...createForm, leadId: l.id, assignedEmployeeId: l.assignedEmployee?.id || "" });
                          setCreateOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-[#0B5CA8] text-white font-medium"
                      >
                        Schedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {!loading && data && tab !== "no_followup" && (
        <Card className="overflow-hidden">
          {data.followUps.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Follow-up ID</th>
                    <th className="p-3">Lead & Customer</th>
                    <th className="p-3">Type & Notes</th>
                    <th className="p-3">Scheduled Date/Time</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Priority / Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.followUps.map((f: any) => (
                    <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold">{f.followUpCode}</td>
                      <td className="p-3">
                        <Link href={`/leads/${f.lead.id}`} className="font-semibold text-[#0B5CA8] hover:underline block">
                          {f.lead.leadCode} — {f.customer.name}
                        </Link>
                        <span className="text-[11px] text-slate-400">{f.customer.primaryMobile} · {f.customer.city}</span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="font-medium">{f.type}</div>
                        <div className="text-[11px] text-slate-500 truncate">{f.notes}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div>{formatDate(f.followUpDate)}</div>
                        <div className="text-[11px] text-slate-400">{f.followUpTime}</div>
                      </td>
                      <td className="p-3">{f.assignedEmployee.fullName}</td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          <StatusBadge value={f.priority} />
                          <StatusBadge value={f.status} />
                        </div>
                      </td>
                      <td className="p-3">
                        {f.status !== "Completed" ? (
                          <button
                            onClick={() => {
                              setCompleteTarget(f);
                              setCompleteForm({
                                contactResult: "Connected — Interested",
                                customerResponse: "",
                                updatedLeadStatus: f.lead.status,
                                notes: "",
                                nextFollowUpDate: "",
                                nextAction: "",
                              });
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                          >
                            Complete
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600">{f.contactResult}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Create Follow-up Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Schedule New Follow-up" maxWidth="max-w-md">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <select
            required
            value={createForm.leadId}
            onChange={(e) => setCreateForm({ ...createForm, leadId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900"
          >
            <option value="">Select Lead...</option>
            {(data?.allActiveLeads || []).map((l: any) => (
              <option key={l.id} value={l.id}>{l.leadCode} — {l.customerName} ({l.status})</option>
            ))}
          </select>
          <select value={createForm.assignedEmployeeId} onChange={(e) => setCreateForm({ ...createForm, assignedEmployeeId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Default Lead Assignee</option>
            {(data?.employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" required value={createForm.followUpDate} onChange={(e) => setCreateForm({ ...createForm, followUpDate: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <input type="time" required value={createForm.followUpTime} onChange={(e) => setCreateForm({ ...createForm, followUpTime: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
          </div>
          <select value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {FOLLOWUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea placeholder="Follow-up notes..." value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Follow-up</button>
          </div>
        </form>
      </Modal>

      {/* Complete Follow-up Modal */}
      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title={`Complete ${completeTarget?.followUpCode || ""}`}
        subtitle="Record outcome, update lead stage, and optionally schedule next follow-up"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleComplete} className="space-y-3 text-xs">
          <input required placeholder="Contact Result (e.g. Connected — Inspection Agreed)" value={completeForm.contactResult} onChange={(e) => setCompleteForm({ ...completeForm, contactResult: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <textarea required placeholder="Customer Response..." value={completeForm.customerResponse} onChange={(e) => setCompleteForm({ ...completeForm, customerResponse: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select value={completeForm.updatedLeadStatus} onChange={(e) => setCompleteForm({ ...completeForm, updatedLeadStatus: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {LEAD_STAGES.filter((s) => s.key !== "Lost").map((s) => (
              <option key={s.key} value={s.key}>Lead Stage: {s.key}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Next Follow-up Date (Optional)</label>
              <input type="date" value={completeForm.nextFollowUpDate} onChange={(e) => setCompleteForm({ ...completeForm, nextFollowUpDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Next Action</label>
              <input placeholder="e.g. Send revised quotation" value={completeForm.nextAction} onChange={(e) => setCompleteForm({ ...completeForm, nextAction: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCompleteTarget(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Complete & Log</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function FollowUpsPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <FollowUpsContent />
    </Suspense>
  );
}
