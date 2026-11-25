"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, CheckCircle2, FileText, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorState, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { FOLLOWUP_TYPES, LEAD_STAGES, LOST_REASONS } from "@/lib/constants";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"activity" | "followups" | "documents" | "transactions">("activity");
  const [note, setNote] = useState("");
  const [lostReasonModal, setLostReasonModal] = useState(false);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [fuModal, setFuModal] = useState(false);
  const [fuForm, setFuForm] = useState({ followUpDate: "", followUpTime: "11:00", type: FOLLOWUP_TYPES[0], notes: "" });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load lead profile");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const changeStatus = async (status: string, reason?: string) => {
    if (status === "Lost" && !reason) {
      setLostReasonModal(true);
      return;
    }
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(reason ? { lostReason: reason } : {}) }),
    });
    if (res.ok) {
      setLostReasonModal(false);
      await loadProfile();
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addNote: note.trim() }),
    });
    if (res.ok) {
      setNote("");
      await loadProfile();
    }
  };

  const scheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id, ...fuForm }),
    });
    if (res.ok) {
      setFuModal(false);
      await loadProfile();
    }
  };

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0B5CA8] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Lead CRM
        </Link>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadProfile} />}

      {!loading && data && (
        <div className="space-y-5">
          <PageHeader
            title={`${data.lead.leadCode} — ${data.lead.customer.name}`}
            subtitle={`${data.lead.customer.primaryMobile} · ${data.lead.customer.city}, ${data.lead.customer.district} (Gujarat)`}
            actions={
              <>
                <StatusBadge value={data.lead.status} />
                <StatusBadge value={data.lead.priority} />
                <select
                  value={data.lead.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111a2e]"
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>Stage: {s.key}</option>
                  ))}
                </select>
                <button
                  onClick={() => setFuModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Schedule Follow-up
                </button>
              </>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
            {/* Customer Overview */}
            <Card className="p-4 space-y-2">
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Customer Overview</h3>
              <div><strong>Name:</strong> {data.lead.customer.name}</div>
              <div><strong>Mobile:</strong> {data.lead.customer.primaryMobile}</div>
              <div><strong>Email:</strong> {data.lead.customer.email || "—"}</div>
              <div><strong>Type:</strong> {data.lead.customer.customerType}</div>
              <div><strong>Address:</strong> {data.lead.customer.fullAddress || `${data.lead.customer.city}, ${data.lead.customer.district}`}</div>
              <Link href={`/customers?id=${data.lead.customer.id}`} className="inline-block text-[#0B5CA8] font-semibold hover:underline pt-1">
                View Customer Profile →
              </Link>
            </Card>

            {/* Vehicle Details */}
            <Card className="p-4 space-y-2">
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Vehicle Details</h3>
              {data.lead.vehicles[0] ? (
                <>
                  <div><strong>Vehicle:</strong> {data.lead.vehicles[0].manufacturer} {data.lead.vehicles[0].model}</div>
                  <div><strong>Reg No:</strong> {data.lead.vehicles[0].registrationNumber}</div>
                  <div><strong>Year / Fuel:</strong> {data.lead.vehicles[0].manufacturingYear} · {data.lead.vehicles[0].fuelType}</div>
                  <div><strong>Condition:</strong> {data.lead.vehicles[0].runningCondition} ({data.lead.vehicles[0].vehicleCondition})</div>
                  <div><strong>RC / Docs:</strong> {data.lead.vehicles[0].rcAvailable} ({data.lead.vehicles[0].documentVerificationStatus})</div>
                </>
              ) : (
                <p className="text-slate-400">No vehicle details recorded yet.</p>
              )}
            </Card>

            {/* Marketing Attribution */}
            <Card className="p-4 space-y-2">
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Marketing Attribution</h3>
              <div><strong>Lead Source:</strong> {data.lead.leadSource.name}</div>
              <div><strong>Campaign:</strong> {data.lead.campaign?.name || "Direct / Organic"}</div>
              <div><strong>Ad Set / Ad:</strong> {data.lead.adSet?.name || "—"} / {data.lead.ad?.name || "—"}</div>
              <div><strong>First-Touch:</strong> {data.lead.firstTouchSource || data.lead.leadSource.name}</div>
              <div><strong>Last-Touch:</strong> {data.lead.lastTouchSource || data.lead.leadSource.name}</div>
              <div><strong>Method / Confidence:</strong> {data.lead.attributionMethod} ({data.lead.attributionConfidence})</div>
            </Card>

            {/* Sales & Intent Scoring */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Sales & Intent Score</h3>
                <StatusBadge value={data.scoring.category} />
              </div>
              <div><strong>Assignee:</strong> {data.lead.assignedEmployee?.fullName || "Unassigned"}</div>
              <div><strong>Qualification:</strong> {data.lead.qualificationStatus}</div>
              <div><strong>Expected Price:</strong> {data.lead.expectedSellingPrice ? formatINR(data.lead.expectedSellingPrice) : "—"}</div>
              <div><strong>Quoted Amount:</strong> {data.lead.quotationAmount ? formatINR(data.lead.quotationAmount) : "—"}</div>
              <div className="pt-1">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#0B5CA8]" /> Intent Score</span>
                  <span className="font-bold">{data.scoring.score}/100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-[#0B5CA8]" style={{ width: `${data.scoring.score}%` }} />
                </div>
              </div>
            </Card>
          </div>

          {/* Transparent Scoring Rules Breakdown */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
              Lead Scoring Factors (Section 17.1)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              {data.scoring.factors.map((f: any) => (
                <div key={f.label} className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${f.met ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 opacity-70"}`}>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${f.met ? "text-emerald-600" : "text-slate-400"}`} />
                    <span>{f.label}</span>
                  </span>
                  <span className="font-bold shrink-0">+{f.points}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Tabs: Activity, Follow-ups, Documents, Transactions */}
          <div className="flex gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit text-xs">
            {[
              { key: "activity", label: `Activity & Notes (${data.lead.activities.length})` },
              { key: "followups", label: `Follow-ups (${data.lead.followUps.length})` },
              { key: "documents", label: `Documents (${data.lead.vehicles[0]?.documents?.length || 0})` },
              { key: "transactions", label: `Quotes & Transactions (${data.lead.quotations.length + data.lead.transactions.length})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-3 py-1.5 rounded-lg font-semibold ${tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "activity" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-8 p-4">
                <form onSubmit={addNote} className="flex gap-2 mb-4">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Log negotiation note, customer call outcome, or update..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                  />
                  <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
                    <MessageSquarePlus className="w-3.5 h-3.5" /> Add Note
                  </button>
                </form>

                <div className="space-y-2.5 text-xs">
                  {data.lead.activities.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between">
                        <span className="font-semibold text-[#0B5CA8]">{a.activityType}</span>
                        <span className="text-[11px] text-slate-400">{formatDateTime(a.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-slate-800 dark:text-slate-200">{a.summary}</p>
                      <div className="text-[10px] text-slate-400 mt-1">Performed by {a.performedBy?.fullName || "System"}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="lg:col-span-4 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Assignment History
                </h3>
                <div className="space-y-2 text-xs">
                  {data.lead.assignments.map((as: any) => (
                    <div key={as.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60">
                      <div className="font-semibold">
                        {as.fromEmployee?.fullName || "Unassigned"} → {as.toEmployee.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500">{as.reason || "Assigned"}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTime(as.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === "followups" && (
            <Card className="p-4 text-xs space-y-2">
              {data.lead.followUps.length === 0 ? (
                <p className="text-slate-400 py-4 text-center">No follow-ups recorded.</p>
              ) : (
                data.lead.followUps.map((f: any) => (
                  <div key={f.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{f.followUpCode} · {f.type}</div>
                      <div className="text-slate-500">{formatDate(f.followUpDate)} at {f.followUpTime} · {f.assignedEmployee.fullName}</div>
                      {f.contactResult && <div className="text-emerald-600 mt-0.5">{f.contactResult}</div>}
                    </div>
                    <StatusBadge value={f.status} />
                  </div>
                ))
              )}
            </Card>
          )}

          {tab === "documents" && (
            <Card className="p-4 text-xs space-y-2">
              {!data.lead.vehicles[0]?.documents?.length ? (
                <p className="text-slate-400 py-4 text-center">No vehicle documents uploaded yet.</p>
              ) : (
                data.lead.vehicles[0].documents.map((doc: any) => (
                  <div key={doc.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-[#0B5CA8]" />
                      <div>
                        <div className="font-semibold">{doc.documentType}</div>
                        <div className="text-[11px] text-slate-500">{doc.fileName} · {doc.verificationRemarks}</div>
                      </div>
                    </div>
                    <StatusBadge value={doc.verificationStatus} />
                  </div>
                ))
              )}
            </Card>
          )}

          {tab === "transactions" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold">Quotations ({data.lead.quotations.length})</h3>
                {data.lead.quotations.map((q: any) => (
                  <div key={q.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex justify-between">
                    <div>
                      <div className="font-semibold">{q.quotationCode} (Rev #{q.revisionNumber})</div>
                      <div className="text-slate-500">{q.negotiationNotes}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatINR(q.offeredPurchasePrice)}</div>
                      <StatusBadge value={q.customerAcceptanceStatus} />
                    </div>
                  </div>
                ))}
              </Card>
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold">Transactions ({data.lead.transactions.length})</h3>
                {data.lead.transactions.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 flex justify-between">
                    <div>
                      <div className="font-semibold">{t.transactionCode}</div>
                      <div className="text-slate-500">{formatDate(t.transactionDate)} · {t.paymentMethod}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">Purchase: {formatINR(t.vehiclePurchaseAmount)}</div>
                      <StatusBadge value={t.paymentStatus} />
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal open={lostReasonModal} onClose={() => setLostReasonModal(false)} title="Select Lost Reason" maxWidth="max-w-md">
        <div className="space-y-4 text-xs">
          <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setLostReasonModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button onClick={() => changeStatus("Lost", lostReason)} className="px-4 py-2 rounded-lg bg-[#D62828] text-white font-semibold">Mark Lost</button>
          </div>
        </div>
      </Modal>

      <Modal open={fuModal} onClose={() => setFuModal(false)} title="Schedule Follow-up" maxWidth="max-w-md">
        <form onSubmit={scheduleFollowUp} className="space-y-3 text-xs">
          <input type="date" required value={fuForm.followUpDate} onChange={(e) => setFuForm({ ...fuForm, followUpDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input type="time" value={fuForm.followUpTime} onChange={(e) => setFuForm({ ...fuForm, followUpTime: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select value={fuForm.type} onChange={(e) => setFuForm({ ...fuForm, type: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {FOLLOWUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea placeholder="Notes..." value={fuForm.notes} onChange={(e) => setFuForm({ ...fuForm, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" rows={2} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFuModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Schedule</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
