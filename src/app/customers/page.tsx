"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Eye, Plus, Repeat, Search, UserCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthContext";
import { Card, EmptyState, ErrorState, KpiCard, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { GUJARAT_DISTRICTS } from "@/lib/constants";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { formatDate, formatINR } from "@/lib/format";

function CustomersContent() {
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("id");
  const { hasPerm } = useAuth();

  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("All");
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    primaryMobile: "",
    altMobile: "",
    email: "",
    customerType: "Individual",
    district: "Ahmedabad",
    city: "Ahmedabad",
    pinCode: "380001",
    fullAddress: "",
    notes: "",
  });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search,
        district,
        repeatOnly: String(repeatOnly),
      });
      const res = await fetch(`/api/customers?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load customers");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, district, repeatOnly]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const openProfile = useCallback(async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      setSelectedProfile(json.customer);
    }
  }, []);

  useEffect(() => {
    if (initialCustomerId) openProfile(initialCustomerId);
  }, [initialCustomerId, openProfile]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setCreateOpen(false);
      await loadCustomers();
    } else {
      const j = await res.json();
      alert(j.error || "Unable to create customer");
    }
  };

  const exportCustomers = (fmt: "csv" | "xlsx") => {
    const rows = data?.customers || [];
    const cols = [
      { header: "Customer ID", accessor: (r: any) => r.customerCode },
      { header: "Name", accessor: (r: any) => r.name },
      { header: "Mobile", accessor: (r: any) => r.primaryMobile },
      { header: "Type", accessor: (r: any) => r.customerType },
      { header: "District", accessor: (r: any) => r.district },
      { header: "City", accessor: (r: any) => r.city },
      { header: "Leads", accessor: (r: any) => r.leadCount },
      { header: "Vehicles", accessor: (r: any) => r.vehicleCount },
      { header: "Created", accessor: (r: any) => formatDate(r.createdAt) },
    ];
    if (fmt === "csv") exportToCSV("movish-customers", rows, cols);
    else exportToExcel("movish-customers", "Customers", rows, cols);
  };

  return (
    <AppShell>
      <PageHeader
        title="Customer Management"
        subtitle="Centralized customer directory tracking repeat sellers, vehicles, transactions, and communication history"
        actions={
          <>
            {hasPerm("customers:manage") && (
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            )}
            <button onClick={() => exportCustomers("csv")} className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => exportCustomers("xlsx")} className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </>
        }
      />

      {data?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
          <KpiCard label="Total Customers" value={data.summary.total} icon={<UserCheck className="w-4 h-4" />} />
          <KpiCard label="Repeat Customers" value={data.summary.repeatCustomers} icon={<Repeat className="w-4 h-4" />} desc="Multiple enquiries or vehicles" />
          <KpiCard label="With Linked Vehicles" value={data.summary.withVehicles} icon={<UserCheck className="w-4 h-4" />} />
        </div>
      )}

      <Card className="p-3.5 mb-5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer ID, name, mobile, city, PIN..." className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
          </div>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">All Gujarat Districts</option>
            {GUJARAT_DISTRICTS.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
            <input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} />
            Repeat Customers Only
          </label>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadCustomers} />}

      {!loading && data && (
        <Card className="overflow-hidden">
          {data.customers.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {data.customers.map((c: any) => (
                  <div key={c.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#0B5CA8]">{c.customerCode}</span>
                          {c.isRepeat && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-700 font-semibold">
                              Repeat
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.primaryMobile}{c.email ? ` · ${c.email}` : ""}</div>
                      </div>
                      <StatusBadge value={c.customerType} className="shrink-0" />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{c.city}, {c.district} {c.pinCode ? `(${c.pinCode})` : ""}</span>
                      <span>Created {formatDate(c.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex gap-3 text-[11px]">
                        <span><strong>{c.leadCount}</strong> Leads</span>
                        <span><strong>{c.vehicleCount}</strong> Vehicles</span>
                        <span><strong>{c.interactionCount}</strong> Logs</span>
                      </div>
                      <button
                        onClick={() => openProfile(c.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0B5CA8] hover:text-white font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> History
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Customer ID</th>
                    <th className="p-3">Customer Name & Contact</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">City / District / PIN</th>
                    <th className="p-3 text-center">Leads</th>
                    <th className="p-3 text-center">Vehicles</th>
                    <th className="p-3 text-center">Interactions</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.customers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-[#0B5CA8]">
                        {c.customerCode}
                        {c.isRepeat && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-700 font-semibold">
                            Repeat
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.primaryMobile} {c.email ? `· ${c.email}` : ""}</div>
                      </td>
                      <td className="p-3"><StatusBadge value={c.customerType} /></td>
                      <td className="p-3">{c.city}, {c.district} {c.pinCode ? `(${c.pinCode})` : ""}</td>
                      <td className="p-3 text-center font-bold">{c.leadCount}</td>
                      <td className="p-3 text-center font-bold">{c.vehicleCount}</td>
                      <td className="p-3 text-center">{c.interactionCount}</td>
                      <td className="p-3">{formatDate(c.createdAt)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => openProfile(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-[#0B5CA8] hover:text-white font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Customer Profile & History Modal */}
      <Modal
        open={Boolean(selectedProfile)}
        onClose={() => setSelectedProfile(null)}
        title={selectedProfile ? `${selectedProfile.customerCode} — ${selectedProfile.name}` : ""}
        subtitle={selectedProfile ? `${selectedProfile.primaryMobile} · ${selectedProfile.fullAddress || selectedProfile.city}` : ""}
        maxWidth="max-w-3xl"
      >
        {selectedProfile && (
          <div className="space-y-4 text-xs">
            {hasPerm("customers:manage") && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditCustomer({ ...selectedProfile });
                    setSelectedProfile(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0B5CA8] text-white font-semibold"
                >
                  Edit Customer Details
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70">
                <div className="font-bold mb-1.5">Associated Leads ({selectedProfile.leads.length})</div>
                <div className="space-y-1.5">
                  {selectedProfile.leads.map((l: any) => (
                    <div key={l.id} className="flex justify-between items-center">
                      <Link href={`/leads/${l.id}`} className="text-[#0B5CA8] font-semibold hover:underline">
                        {l.leadCode} ({l.leadSource.name})
                      </Link>
                      <StatusBadge value={l.status} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70">
                <div className="font-bold mb-1.5">Vehicles ({selectedProfile.vehicles.length})</div>
                <div className="space-y-1.5">
                  {selectedProfile.vehicles.map((v: any) => (
                    <div key={v.id} className="flex justify-between items-center">
                      <span>{v.manufacturer} {v.model} ({v.registrationNumber})</span>
                      <StatusBadge value={v.purchaseStatus} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selectedProfile.transactions.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70">
                <div className="font-bold mb-1.5">Transactions ({selectedProfile.transactions.length})</div>
                {selectedProfile.transactions.map((t: any) => (
                  <div key={t.id} className="flex justify-between py-1">
                    <span>{t.transactionCode} — {t.vehicle.registrationNumber}</span>
                    <span className="font-semibold">{formatINR(t.vehiclePurchaseAmount)} ({t.paymentStatus})</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70">
              <div className="font-bold mb-1.5">Communication History ({selectedProfile.communicationLogs.length})</div>
              {selectedProfile.communicationLogs.length === 0 ? (
                <p className="text-slate-400">No interactions recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedProfile.communicationLogs.map((c: any) => (
                    <div key={c.id} className="border-b border-slate-200 dark:border-slate-800 pb-1.5 last:border-none">
                      <div className="flex justify-between font-medium">
                        <span>{c.communicationType} ({c.direction})</span>
                        <span className="text-slate-400">{formatDate(c.timestamp)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{c.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Customer Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add New Customer" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <input required placeholder="Primary Mobile *" value={form.primaryMobile} onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <input placeholder="Alt Mobile" value={form.altMobile} onChange={(e) => setForm({ ...form, altMobile: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              {GUJARAT_DISTRICTS.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}
            </select>
            <input placeholder="City *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
          </div>
          <input placeholder="Full Address" value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Customer</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editCustomer)} onClose={() => setEditCustomer(null)} title={`Edit ${editCustomer?.customerCode || ""}`} maxWidth="max-w-lg">
        {editCustomer && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch(`/api/customers/${editCustomer.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editCustomer),
              });
              if (res.ok) {
                setEditCustomer(null);
                await loadCustomers();
              } else {
                const j = await res.json().catch(() => ({}));
                alert(j.error || "Unable to update customer");
              }
            }}
            className="space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder="Full Name *" value={editCustomer.name} onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
              <input required placeholder="Primary Mobile *" value={editCustomer.primaryMobile} onChange={(e) => setEditCustomer({ ...editCustomer, primaryMobile: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
              <input placeholder="Email" value={editCustomer.email || ""} onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
              <input placeholder="City" value={editCustomer.city || ""} onChange={(e) => setEditCustomer({ ...editCustomer, city: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            </div>
            <input placeholder="Full Address" value={editCustomer.fullAddress || ""} onChange={(e) => setEditCustomer({ ...editCustomer, fullAddress: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditCustomer(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Update Customer</button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <CustomersContent />
    </Suspense>
  );
}
