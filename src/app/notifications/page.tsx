"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?filter=${filter}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load notifications");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    await loadNotifications();
  };

  const toggleRead = async (n: any) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id, isRead: !n.isRead }),
    });
    await loadNotifications();
  };

  return (
    <AppShell>
      <PageHeader
        title="Notifications & Alerts"
        subtitle="System alerts for new leads, assignments, overdue follow-ups, quotations, pickups, documents, and sync events"
        actions={
          <button onClick={markAllRead} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
            <CheckCheck className="w-4 h-4" /> Mark All Read ({data?.unreadCount ?? 0})
          </button>
        }
      />

      <div className="flex gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit text-xs mb-5">
        {(["all", "unread", "read"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg font-semibold capitalize ${filter === f ? "bg-[#0B5CA8] text-white" : ""}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadNotifications} />}

      {!loading && data && (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.notifications.length === 0 ? (
            <EmptyState title="No notifications" description="You are caught up on all operational alerts." />
          ) : (
            data.notifications.map((n: any) => {
              const modulePath =
                n.relatedModule === "leads" && n.relatedRecordId
                  ? `/leads/${n.relatedRecordId}`
                  : n.relatedModule === "followups"
                  ? "/follow-ups"
                  : n.relatedModule === "meta_ads"
                  ? "/meta-ads"
                  : `/${n.relatedModule}`;
              return (
                <div key={n.id} className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs ${!n.isRead ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1 shrink-0">
                      {!n.isRead ? <Circle className="w-2.5 h-2.5 fill-[#D62828] text-[#D62828]" /> : <Bell className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{n.title}</span>
                        <StatusBadge value={n.category} />
                        <span className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{n.description}</p>
                      {n.relatedModule && (
                        <Link href={modulePath} className="inline-block mt-1.5 text-[#0B5CA8] font-semibold hover:underline">
                          Open Related Module →
                        </Link>
                      )}
                    </div>
                  </div>
                  <button onClick={() => toggleRead(n)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 self-start sm:self-auto">
                    {n.isRead ? "Mark Unread" : "Mark Read"}
                  </button>
                </div>
              );
            })
          )}
        </Card>
      )}
    </AppShell>
  );
}
