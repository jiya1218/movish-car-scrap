"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Car, ClipboardCheck, FileCheck, Package, Plus, Search, Truck, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthContext";
import { Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import {
  DOCUMENT_TYPES,
  FUEL_TYPES,
  GUJARAT_DISTRICTS,
  PICKUP_STATUSES,
  PROCESSING_STATUSES,
  VEHICLE_CATEGORIES,
  VEHICLE_MANUFACTURERS,
} from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";

function VehiclesContent() {
  const searchParams = useSearchParams();
  const { hasPerm } = useAuth();
  const [tab, setTab] = useState(searchParams.get("tab") || "vehicles");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [district, setDistrict] = useState("All");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [modalMode, setModalMode] = useState<"vehicle" | "inspection" | "quotation" | "pickup" | "document" | null>(null);
  const [vehForm, setVehForm] = useState({ customerId: "", registrationNumber: "", manufacturer: "Maruti Suzuki", model: "", manufacturingYear: "2010", category: "Hatchback", fuelType: "Petrol" });
  const [inspForm, setInspForm] = useState({ vehicleId: "", estimatedPurchaseValue: "", vehicleCondition: "Fair", engineCondition: "Average", bodyCondition: "Minor Rust", tyreCondition: "Worn", batteryCondition: "Dead", accidentHistory: "", notes: "", result: "Eligible" });
  const [qtForm, setQtForm] = useState({ vehicleId: "", offeredPurchasePrice: "", negotiationNotes: "" });
  const [pkpForm, setPkpForm] = useState({ vehicleId: "", pickupAddress: "", scheduledDate: new Date().toISOString().slice(0, 10), assignedDriver: "", assignedVendor: "Movish In-House Flatbed", pickupExpenses: "1800" });
  const [docForm, setDocForm] = useState({ vehicleId: "", documentType: DOCUMENT_TYPES[0] as string, fileName: "", verificationRemarks: "" });

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ search, district });
      const res = await fetch(`/api/vehicles?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load vehicle records");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, district]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const submitAction = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (res.ok) {
      setModalMode(null);
      await loadVehicles();
    } else {
      const j = await res.json();
      alert(j.error || "Action failed");
    }
  };

  const patchAction = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) await loadVehicles();
    else {
      const j = await res.json();
      alert(j.error || "Permission denied or update failed");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Vehicle Lifecycle & Yard Operations"
        subtitle="Manage vehicle records, inspections, quotations, pickups, legal scrapping documents & post-collection yard inventory"
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPerm("vehicles:manage") && (
              <>
                <button onClick={() => setModalMode("vehicle")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
                  <Plus className="w-3.5 h-3.5" /> Add Vehicle
                </button>
                <button onClick={() => setModalMode("inspection")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
                  + Inspection
                </button>
                <button onClick={() => setModalMode("pickup")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
                  + Pickup
                </button>
                <button onClick={() => setModalMode("document")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
                  + Document
                </button>
              </>
            )}
            {hasPerm("quotations:create") && (
              <button onClick={() => setModalMode("quotation")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1B3156] text-white">
                + New Quotation
              </button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit text-xs mb-4">
        {[
          { key: "vehicles", label: `Vehicles (${data?.vehicles?.length ?? 0})`, icon: <Car className="w-3.5 h-3.5" /> },
          { key: "inspections", label: `Inspections (${data?.inspections?.length ?? 0})`, icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
          { key: "quotations", label: `Quotations (${data?.quotations?.length ?? 0})`, icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
          { key: "pickup", label: `Pickup (${data?.pickups?.length ?? 0})`, icon: <Truck className="w-3.5 h-3.5" /> },
          { key: "documents", label: `Documents (${data?.documents?.length ?? 0})`, icon: <FileCheck className="w-3.5 h-3.5" /> },
          { key: "inventory", label: `Yard Inventory (${data?.inventory?.length ?? 0})`, icon: <Package className="w-3.5 h-3.5" /> },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold ${
              tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-3.5 mb-5">
        <div className="flex flex-wrap gap-2.5 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration number, vehicle code, model, customer..." className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
          </div>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">All Gujarat Districts</option>
            {GUJARAT_DISTRICTS.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}
          </select>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadVehicles} />}

      {!loading && data && (
        <>
          {tab === "vehicles" && (
            <Card className="overflow-hidden">
              {data.vehicles.length === 0 ? <EmptyState /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                      <tr>
                        <th className="p-3">Vehicle ID & Reg</th>
                        <th className="p-3">Make / Model / Year</th>
                        <th className="p-3">Customer & Location</th>
                        <th className="p-3">Condition & Fuel</th>
                        <th className="p-3">RC & Docs Status</th>
                        <th className="p-3">Purchase Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.vehicles.map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="p-3">
                            <div className="font-bold text-[#0B5CA8]">{v.registrationNumber}</div>
                            <div className="text-[11px] text-slate-400">{v.vehicleCode}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{v.manufacturer} {v.model} {v.variant || ""}</div>
                            <div className="text-[11px] text-slate-400">{v.category} · {v.manufacturingYear}</div>
                          </td>
                          <td className="p-3">
                            <div>{v.customer.name} ({v.customer.primaryMobile})</div>
                            <div className="text-[11px] text-slate-400">{v.locationCity}, {v.locationDistrict}</div>
                          </td>
                          <td className="p-3">
                            <div>{v.runningCondition} · {v.fuelType}</div>
                            <div className="text-[11px] text-slate-400">Engine: {v.engineCondition}</div>
                          </td>
                          <td className="p-3">
                            <div>RC: {v.rcAvailable}</div>
                            <StatusBadge value={v.documentVerificationStatus} className="mt-1" />
                          </td>
                          <td className="p-3"><StatusBadge value={v.purchaseStatus} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "inspections" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Inspection ID</th>
                      <th className="p-3">Vehicle</th>
                      <th className="p-3">Inspector & Date</th>
                      <th className="p-3">Condition Assessment</th>
                      <th className="p-3 text-right">Est. Purchase Value</th>
                      <th className="p-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.inspections.map((i: any) => (
                      <tr key={i.id}>
                        <td className="p-3 font-semibold">{i.inspectionCode}</td>
                        <td className="p-3">
                          <div className="font-semibold">{i.vehicle.registrationNumber}</div>
                          <div className="text-[11px] text-slate-400">{i.vehicle.manufacturer} {i.vehicle.model}</div>
                        </td>
                        <td className="p-3">
                          <div>{i.inspector.fullName}</div>
                          <div className="text-[11px] text-slate-400">{formatDate(i.inspectionDate)}</div>
                        </td>
                        <td className="p-3 max-w-xs">
                          <div>Eng: {i.engineCondition} | Body: {i.bodyCondition} | Tyre: {i.tyreCondition}</div>
                          <div className="text-[11px] text-slate-400 truncate">{i.accidentHistory || i.notes}</div>
                        </td>
                        <td className="p-3 text-right font-bold">{formatINR(i.estimatedPurchaseValue)}</td>
                        <td className="p-3"><StatusBadge value={i.result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "quotations" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Quotation ID</th>
                      <th className="p-3">Vehicle & Customer</th>
                      <th className="p-3 text-right">Offered Price</th>
                      <th className="p-3">Prepared / Valid</th>
                      <th className="p-3">Approval</th>
                      <th className="p-3">Customer Acceptance</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.quotations.map((q: any) => (
                      <tr key={q.id}>
                        <td className="p-3">
                          <div className="font-semibold">{q.quotationCode}</div>
                          <span className="text-[11px] text-slate-400">Rev #{q.revisionNumber}</span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">{q.vehicle.registrationNumber} ({q.vehicle.model})</div>
                          <div className="text-[11px] text-slate-400">{q.customer.name} · {q.customer.city}</div>
                        </td>
                        <td className="p-3 text-right font-bold text-[#0B5CA8]">{formatINR(q.offeredPurchasePrice)}</td>
                        <td className="p-3">
                          <div>{q.preparedBy.fullName}</div>
                          <div className="text-[11px] text-slate-400">Valid {formatDate(q.validityDate)}</div>
                        </td>
                        <td className="p-3"><StatusBadge value={q.approvalStatus} /></td>
                        <td className="p-3"><StatusBadge value={q.customerAcceptanceStatus} /></td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {q.approvalStatus === "Pending Approval" && hasPerm("quotations:approve") && (
                              <button onClick={() => patchAction(q.id, { action: "quotation_status", approvalStatus: "Approved" })} className="px-2 py-1 rounded bg-emerald-600 text-white font-medium">
                                Approve
                              </button>
                            )}
                            {q.approvalStatus === "Approved" && q.customerAcceptanceStatus !== "Accepted" && (
                              <button onClick={() => patchAction(q.id, { action: "quotation_status", customerAcceptanceStatus: "Accepted" })} className="px-2 py-1 rounded bg-[#0B5CA8] text-white font-medium">
                                Mark Accepted
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "pickup" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Pickup ID</th>
                      <th className="p-3">Vehicle & Customer</th>
                      <th className="p-3">Pickup Location</th>
                      <th className="p-3">Driver & Vendor</th>
                      <th className="p-3">Scheduled / Expense</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.pickups.map((p: any) => (
                      <tr key={p.id}>
                        <td className="p-3 font-semibold">{p.pickupCode}</td>
                        <td className="p-3">
                          <div className="font-semibold">{p.vehicle.registrationNumber} ({p.vehicle.model})</div>
                          <div className="text-[11px] text-slate-400">{p.customer.name} · {p.customer.primaryMobile}</div>
                        </td>
                        <td className="p-3">{p.pickupAddress}</td>
                        <td className="p-3">
                          <div>{p.assignedDriver || "TBD"}</div>
                          <div className="text-[11px] text-slate-400">{p.assignedVendor || "—"}</div>
                        </td>
                        <td className="p-3">
                          <div>{p.scheduledDate ? formatDate(p.scheduledDate) : "Not scheduled"}</div>
                          <div className="text-[11px] text-slate-400">Exp: {formatINR(p.pickupExpenses)}</div>
                        </td>
                        <td className="p-3">
                          <select
                            value={p.pickupStatus}
                            disabled={!hasPerm("vehicles:manage")}
                            onChange={(e) => patchAction(p.id, { action: "pickup_status", pickupStatus: e.target.value })}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                          >
                            {PICKUP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "documents" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#0B5CA8]" />
                <span>
                  <strong>Legal Compliance Rule:</strong> A collected vehicle does not automatically satisfy legal scrapping formalities. Ensure RC, Ownership, Identity, Handover & Scrapping Certificates are individually verified below.
                </span>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                      <tr>
                        <th className="p-3">Doc ID</th>
                        <th className="p-3">Vehicle</th>
                        <th className="p-3">Document Type</th>
                        <th className="p-3">File & Remarks</th>
                        <th className="p-3">Upload Date</th>
                        <th className="p-3">Verification</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.documents.map((d: any) => (
                        <tr key={d.id}>
                          <td className="p-3 font-semibold">{d.documentCode}</td>
                          <td className="p-3 font-medium">{d.vehicle.registrationNumber} ({d.vehicle.model})</td>
                          <td className="p-3">{d.documentType}</td>
                          <td className="p-3">
                            <div className="font-mono text-[11px]">{d.fileName}</div>
                            <div className="text-[11px] text-slate-400">{d.verificationRemarks}</div>
                          </td>
                          <td className="p-3">{formatDate(d.uploadDate)}</td>
                          <td className="p-3"><StatusBadge value={d.verificationStatus} /></td>
                          <td className="p-3">
                            {hasPerm("vehicles:manage") && d.verificationStatus !== "Verified" && (
                              <button
                                onClick={() => patchAction(d.id, { action: "document_verify", verificationStatus: "Verified", verificationRemarks: "Verified by Operations" })}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-medium"
                              >
                                Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {tab === "inventory" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Inventory ID</th>
                      <th className="p-3">Vehicle</th>
                      <th className="p-3">Collection & Yard Bay</th>
                      <th className="p-3 text-right">Estimated Value</th>
                      <th className="p-3 text-right">Actual Realization</th>
                      <th className="p-3">Processing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.inventory.map((inv: any) => (
                      <tr key={inv.id}>
                        <td className="p-3 font-semibold">{inv.inventoryCode}</td>
                        <td className="p-3">
                          <div className="font-semibold">{inv.vehicle.registrationNumber}</div>
                          <div className="text-[11px] text-slate-400">{inv.vehicle.manufacturer} {inv.vehicle.model}</div>
                        </td>
                        <td className="p-3">
                          <div>{inv.currentLocation} ({inv.storageLocation})</div>
                          <div className="text-[11px] text-slate-400">Collected {formatDate(inv.collectionDate)}</div>
                        </td>
                        <td className="p-3 text-right font-medium text-slate-500">{formatINR(inv.estimatedValue)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{formatINR(inv.actualRealizationValue)}</td>
                        <td className="p-3">
                          <select
                            value={inv.processingStatus}
                            disabled={!hasPerm("vehicles:manage")}
                            onChange={(e) => patchAction(inv.id, { action: "inventory_status", processingStatus: e.target.value })}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                          >
                            {PROCESSING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Modals for Creating Vehicle / Inspection / Quotation / Pickup / Document */}
      <Modal open={modalMode === "vehicle"} onClose={() => setModalMode(null)} title="Add Vehicle Master Record" maxWidth="max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); submitAction("create_vehicle", vehForm); }} className="space-y-3 text-xs">
          <select required value={vehForm.customerId} onChange={(e) => setVehForm({ ...vehForm, customerId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Customer...</option>
            {(data?.options?.customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.primaryMobile})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Reg Number (GJ-01-XX-0000)" value={vehForm.registrationNumber} onChange={(e) => setVehForm({ ...vehForm, registrationNumber: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent uppercase" />
            <input type="number" required placeholder="Year" value={vehForm.manufacturingYear} onChange={(e) => setVehForm({ ...vehForm, manufacturingYear: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <select value={vehForm.manufacturer} onChange={(e) => setVehForm({ ...vehForm, manufacturer: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              {VEHICLE_MANUFACTURERS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input required placeholder="Model" value={vehForm.model} onChange={(e) => setVehForm({ ...vehForm, model: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <select value={vehForm.category} onChange={(e) => setVehForm({ ...vehForm, category: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={vehForm.fuelType} onChange={(e) => setVehForm({ ...vehForm, fuelType: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Vehicle</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalMode === "inspection"} onClose={() => setModalMode(null)} title="Record Vehicle Inspection" maxWidth="max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); submitAction("create_inspection", inspForm); }} className="space-y-3 text-xs">
          <select required value={inspForm.vehicleId} onChange={(e) => setInspForm({ ...inspForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Vehicle...</option>
            {(data?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.manufacturer} {v.model}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" required placeholder="Est. Purchase Value (₹)" value={inspForm.estimatedPurchaseValue} onChange={(e) => setInspForm({ ...inspForm, estimatedPurchaseValue: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <select value={inspForm.result} onChange={(e) => setInspForm({ ...inspForm, result: e.target.value })} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
              <option value="Eligible">Eligible</option>
              <option value="Conditional">Conditional</option>
              <option value="Not Eligible">Not Eligible</option>
            </select>
            <input placeholder="Engine Condition" value={inspForm.engineCondition} onChange={(e) => setInspForm({ ...inspForm, engineCondition: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <input placeholder="Body Condition" value={inspForm.bodyCondition} onChange={(e) => setInspForm({ ...inspForm, bodyCondition: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
          </div>
          <textarea placeholder="Inspection notes & accident history..." value={inspForm.notes} onChange={(e) => setInspForm({ ...inspForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Inspection</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalMode === "quotation"} onClose={() => setModalMode(null)} title="Create / Revise Vehicle Quotation" maxWidth="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submitAction("create_quotation", qtForm); }} className="space-y-3 text-xs">
          <select required value={qtForm.vehicleId} onChange={(e) => setQtForm({ ...qtForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Vehicle...</option>
            {(data?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.manufacturer} {v.model}</option>)}
          </select>
          <input type="number" required placeholder="Offered Purchase Price (₹)" value={qtForm.offeredPurchasePrice} onChange={(e) => setQtForm({ ...qtForm, offeredPurchasePrice: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <textarea placeholder="Negotiation notes..." value={qtForm.negotiationNotes} onChange={(e) => setQtForm({ ...qtForm, negotiationNotes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Submit Quotation</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalMode === "pickup"} onClose={() => setModalMode(null)} title="Schedule Vehicle Pickup" maxWidth="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submitAction("create_pickup", pkpForm); }} className="space-y-3 text-xs">
          <select required value={pkpForm.vehicleId} onChange={(e) => setPkpForm({ ...pkpForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Vehicle...</option>
            {(data?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.locationCity}</option>)}
          </select>
          <input required placeholder="Pickup Address" value={pkpForm.pickupAddress} onChange={(e) => setPkpForm({ ...pkpForm, pickupAddress: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={pkpForm.scheduledDate} onChange={(e) => setPkpForm({ ...pkpForm, scheduledDate: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
            <input type="number" placeholder="Pickup Expense (₹)" value={pkpForm.pickupExpenses} onChange={(e) => setPkpForm({ ...pkpForm, pickupExpenses: e.target.value })} className="px-3 py-2 rounded-lg border bg-transparent" />
          </div>
          <input placeholder="Assigned Driver & Vehicle No" value={pkpForm.assignedDriver} onChange={(e) => setPkpForm({ ...pkpForm, assignedDriver: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Schedule Pickup</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalMode === "document"} onClose={() => setModalMode(null)} title="Add Vehicle Legal Document Record" maxWidth="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submitAction("upload_document", docForm); }} className="space-y-3 text-xs">
          <select required value={docForm.vehicleId} onChange={(e) => setDocForm({ ...docForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Vehicle...</option>
            {(data?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.manufacturer} {v.model}</option>)}
          </select>
          <select value={docForm.documentType} onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {DOCUMENT_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
          </select>
          <input required placeholder="File Reference Name (e.g. GJ01_RC_Copy.pdf)" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input placeholder="Verification Remarks" value={docForm.verificationRemarks} onChange={(e) => setDocForm({ ...docForm, verificationRemarks: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Add Document</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function VehiclesPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <VehiclesContent />
    </Suspense>
  );
}
