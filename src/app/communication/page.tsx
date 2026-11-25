"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, MessageSquare, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthContext";
import { Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { COMMUNICATION_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export default function CommunicationPage() {
  const { hasPerm } = useAuth();
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    leadId: "",
    communicationType: COMMUNICATION_TYPES[0] as string,
    direction: "Outbound",
    summary: "",
    outcome: "",
    nextAction: "",
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ type, search });
      const res = await fetch(`/api/communication?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load communication logs");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/communication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setModalOpen(false);
      setForm({ customerId: "", leadId: "", communicationType: COMMUNICATION_TYPES[0], direction: "Outbound", summary: "", outcome: "", nextAction: "" });
      await loadLogs();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Unable to save interaction log");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Communication Management"
        subtitle="Centralized interaction history across Phone Calls, WhatsApp, SMS, Email, Website & Meta Lead Forms"
        actions={
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
            <Plus className="w-4 h-4" /> Log Interaction
          </button>
        }
      />

      {data?.whatsappStatus?.status !== "Connected" && (
        <div className="mb-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5 sm:mt-0" />
            <span>
              <strong>WhatsApp Business Cloud API: Not Connected.</strong> Manual interaction logging is active; automated WhatsApp acknowledgements & templates activate in Phase 4 once configured in Settings.
            </span>
          </div>
          {hasPerm("settings:manage") && (
            <Link href="/settings?tab=integrations" className="font-semibold text-[#0B5CA8] hover:underline shrink-0">
              Integrations →
            </Link>
          )}
        </div>
      )}

      <Card className="p-3.5 mb-5">
        <div className="flex flex-wrap gap-2.5 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, lead ID, summary..." className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-900">
            <option value="All">All Communication Types</option>
            {COMMUNICATION_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadLogs} />}

      {!loading && data && (
        <Card className="overflow-hidden">
          {data.logs.length === 0 ? <EmptyState /> : (
            <>
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {data.logs.map((l: any) => (
                  <div key={l.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[#0B5CA8]" />
                          {l.commCode} · {l.communicationType}
                        </div>
                        <div className="font-semibold mt-0.5">{l.customer.name} ({l.customer.primaryMobile})</div>
                      </div>
                      <StatusBadge value={l.direction} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg">{l.summary}</p>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
                      <span>{l.employee?.fullName || "System"}{l.outcome ? ` · ${l.outcome}` : ""}</span>
                      <span>{formatDateTime(l.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                  <tr>
                    <th className="p-3">ID & Timestamp</th>
                    <th className="p-3">Channel / Direction</th>
                    <th className="p-3">Customer & Lead</th>
                    <th className="p-3">Interaction Summary</th>
                    <th className="p-3">Outcome / Next Action</th>
                    <th className="p-3">Employee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.logs.map((l: any) => (
                    <tr key={l.id}>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold">{l.commCode}</div>
                        <div className="text-[11px] text-slate-400">{formatDateTime(l.timestamp)}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          <MessageSquare className="w-3.5 h-3.5 text-[#0B5CA8]" /> {l.communicationType}
                        </div>
                        <StatusBadge value={l.direction} className="mt-1" />
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{l.customer.name} ({l.customer.primaryMobile})</div>
                        {l.lead && (
                          <Link href={`/leads/${l.lead.id}`} className="text-[11px] text-[#0B5CA8] hover:underline">
                            {l.lead.leadCode}
                          </Link>
                        )}
                      </td>
                      <td className="p-3 max-w-sm">{l.summary}</td>
                      <td className="p-3">
                        <div className="font-medium">{l.outcome || "—"}</div>
                        <div className="text-[11px] text-slate-400">{l.nextAction || ""}</div>
                      </td>
                      <td className="p-3">{l.employee?.fullName || "System"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Customer Interaction" maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <select required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Customer...</option>
            {(data?.options?.customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.primaryMobile})</option>)}
          </select>
          <select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Link Lead (Optional)...</option>
            {(data?.options?.leads || []).filter((l: any) => !form.customerId || l.customerId === form.customerId).map((l: any) => (
              <option key={l.id} value={l.id}>{l.leadCode} — {l.customer.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={form.communicationType} onChange={(e) => setForm({ ...form, communicationType: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              {COMMUNICATION_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
            </select>
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              <option value="Outbound">Outbound</option>
              <option value="Inbound">Inbound</option>
            </select>
          </div>
          <textarea required placeholder="Interaction Summary *" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input placeholder="Outcome" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input placeholder="Next Action" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Log</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
