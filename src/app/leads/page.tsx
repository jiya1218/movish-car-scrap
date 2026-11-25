"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  Edit3,
  Eye,
  GitMerge,
  Kanban,
  List,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthContext";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/ui";
import {
  FUEL_TYPES,
  GUJARAT_DISTRICTS,
  LEAD_PRIORITIES,
  LEAD_STAGES,
  LOST_REASONS,
  VEHICLE_CATEGORIES,
  VEHICLE_MANUFACTURERS,
} from "@/lib/constants";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { formatDate, formatINR } from "@/lib/format";

function LeadsContent() {
  const searchParams = useSearchParams();
  const initialView = (searchParams.get("view") as any) || "all";
  const { hasPerm } = useAuth();

  const [view, setView] = useState<"all" | "pipeline" | "lost" | "duplicates" | "recovery">(initialView);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [districtFilter, setDistrictFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("enquiryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<any>(null);
  const [assignModalLead, setAssignModalLead] = useState<any>(null);
  const [assignEmpId, setAssignEmpId] = useState("");
  const [lostModalTarget, setLostModalTarget] = useState<{ lead: any; newStatus: string } | null>(null);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [mergeModalLead, setMergeModalLead] = useState<any>(null);
  const [mergePrimaryId, setMergePrimaryId] = useState("");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const emptyForm = {
    customerName: "",
    primaryMobile: "",
    altMobile: "",
    email: "",
    state: "Gujarat",
    district: "Ahmedabad",
    city: "Ahmedabad",
    area: "",
    pinCode: "380001",
    fullAddress: "",
    preferredContactMethod: "Phone Call",
    vehicleCategory: "Hatchback",
    manufacturer: "Maruti Suzuki",
    model: "",
    variant: "",
    manufacturingYear: "2010",
    registrationNumber: "",
    fuelType: "Petrol",
    vehicleCondition: "Fair",
    runningCondition: "Running",
    ownershipStatus: "1st Owner",
    rcAvailable: "Yes",
    insuranceStatus: "Expired",
    additionalVehicleDetails: "",
    leadSourceId: "",
    campaignId: "",
    adSetId: "",
    adId: "",
    expectedSellingPrice: "",
    assignedEmployeeId: "",
    priority: "Warm",
    status: "New",
    customerNotes: "",
    internalRemarks: "",
    nextFollowUp: "",
  };
  const [form, setForm] = useState(emptyForm);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        view,
        search,
        status: statusFilter,
        priority: priorityFilter,
        source: sourceFilter,
        district: districtFilter,
        employeeId: employeeFilter,
        sortBy,
        sortDir,
        page: String(page),
        pageSize: view === "pipeline" ? "200" : "20",
      });
      const res = await fetch(`/api/leads?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load leads");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Error loading leads");
    } finally {
      setLoading(false);
    }
  }, [view, search, statusFilter, priorityFilter, sourceFilter, districtFilter, employeeFilter, sortBy, sortDir, page]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const districtCities = useMemo(() => {
    return GUJARAT_DISTRICTS.find((d) => d.district === form.district)?.cities ?? [];
  }, [form.district]);

  const submitCreateLead = async (confirmDuplicate = false) => {
    setFormSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, confirmDuplicate }),
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicateWarning) {
        setDuplicateWarning(json);
        setFormSaving(false);
        return;
      }
      if (!res.ok) {
        setFormError(json.error || "Unable to create lead");
        setFormSaving(false);
        return;
      }
      setDuplicateWarning(null);
      setCreateOpen(false);
      setForm(emptyForm);
      await loadLeads();
    } catch {
      setFormError("Network error while saving lead");
    } finally {
      setFormSaving(false);
    }
  };

  const updateLeadStatus = async (lead: any, newStatus: string, reason?: string) => {
    if (newStatus === "Lost" && !reason) {
      setLostModalTarget({ lead, newStatus });
      return;
    }
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...(reason ? { lostReason: reason } : {}) }),
    });
    if (res.ok) {
      setLostModalTarget(null);
      await loadLeads();
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalLead) return;
    const res = await fetch(`/api/leads/${assignModalLead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedEmployeeId: assignEmpId || null,
        status: assignModalLead.status === "New" && assignEmpId ? "Assigned" : assignModalLead.status,
      }),
    });
    if (res.ok) {
      setAssignModalLead(null);
      await loadLeads();
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead) return;
    const res = await fetch(`/api/leads/${editLead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: editLead.customerName,
        city: editLead.city,
        district: editLead.district,
        priority: editLead.priority,
        expectedSellingPrice: editLead.expectedSellingPrice ? Number(editLead.expectedSellingPrice) : undefined,
        customerNotes: editLead.customerNotes,
      }),
    });
    if (res.ok) {
      setEditLead(null);
      await loadLeads();
    }
  };

  const handleDeleteLead = async (lead: any) => {
    if (!confirm(`Confirm soft-delete for lead ${lead.leadCode} (${lead.customerName})?`)) return;
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (res.ok) await loadLeads();
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeModalLead || !mergePrimaryId) return;
    const res = await fetch("/api/leads/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryLeadId: mergePrimaryId, duplicateLeadId: mergeModalLead.id }),
    });
    if (res.ok) {
      setMergeModalLead(null);
      setMergePrimaryId("");
      await loadLeads();
    }
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const exportLeads = (fmt: "csv" | "xlsx") => {
    const rows = data?.leads || [];
    const cols = [
      { header: "Lead ID", accessor: (r: any) => r.leadCode },
      { header: "Customer", accessor: (r: any) => r.customerName },
      { header: "Mobile", accessor: (r: any) => r.mobile },
      { header: "City", accessor: (r: any) => r.city },
      { header: "District", accessor: (r: any) => r.district },
      { header: "Vehicle", accessor: (r: any) => r.vehicle },
      { header: "Year", accessor: (r: any) => r.manufacturingYear },
      { header: "Reg No", accessor: (r: any) => r.registrationNumber },
      { header: "Source", accessor: (r: any) => r.leadSource },
      { header: "Campaign", accessor: (r: any) => r.campaignName },
      { header: "Status", accessor: (r: any) => r.status },
      { header: "Priority", accessor: (r: any) => r.priority },
      { header: "Assignee", accessor: (r: any) => r.assignedEmployeeName },
      { header: "Created", accessor: (r: any) => formatDate(r.createdDate) },
    ];
    if (fmt === "csv") exportToCSV("movish-leads", rows, cols);
    else exportToExcel("movish-leads", "Leads", rows, cols);
  };

  const pipelineLeads = data?.allLeadsForPipeline ?? data?.leads ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Lead Management CRM"
        subtitle="Capture, qualify, assign, track Kanban stages, detect duplicates, and recover missed scrap enquiries"
        actions={
          <>
            {hasPerm("leads:create") && (
              <button
                onClick={() => {
                  setForm(emptyForm);
                  setFormError("");
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B5CA8] hover:bg-[#1B3156] text-white"
              >
                <Plus className="w-4 h-4" /> Add Lead
              </button>
            )}
            <button onClick={() => exportLeads("csv")} className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => exportLeads("xlsx")} className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </>
        }
      />

      {/* Submodule Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { key: "all", label: `All Leads (${data?.summary?.total ?? "—"})`, icon: <List className="w-3.5 h-3.5" /> },
            { key: "pipeline", label: "Pipeline Kanban", icon: <Kanban className="w-3.5 h-3.5" /> },
            { key: "lost", label: `Lost Leads (${data?.summary?.lostCount ?? 0})`, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            { key: "duplicates", label: `Duplicates (${data?.summary?.duplicateCount ?? 0})`, icon: <GitMerge className="w-3.5 h-3.5" /> },
            { key: "recovery", label: `Missed Lead Recovery (${data?.summary?.recoveryCount ?? 0})`, icon: <ShieldAlert className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setView(t.key as any);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                view === t.key
                  ? "bg-[#0B5CA8] text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <button onClick={loadLeads} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0B5CA8]">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <Card className="p-3.5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs">
          <div className="relative col-span-2 lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, mobile, lead ID, GJ reg, model..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Stage: All</option>
            {LEAD_STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.key}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Priority: All</option>
            {LEAD_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">District: All Gujarat</option>
            {GUJARAT_DISTRICTS.map((d) => (
              <option key={d.district} value={d.district}>{d.district}</option>
            ))}
          </select>
          <select value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <option value="All">Assignee: All</option>
            <option value="unassigned">Unassigned Only</option>
            {(data?.options?.employees || []).map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.fullName}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("All");
              setPriorityFilter("All");
              setSourceFilter("All");
              setDistrictFilter("All");
              setEmployeeFilter("All");
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
          >
            Reset Filters
          </button>
        </div>
      </Card>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadLeads} />}

      {!loading && data && (
        <>
          {/* Lost Reason Breakdown Banner in Lost view */}
          {view === "lost" && data.summary?.lostReasonBreakdown?.length > 0 && (
            <Card className="p-4 mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Most Common Non-Conversion Reasons
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                {data.summary.lostReasonBreakdown.map((item: any) => (
                  <div key={item.reason} className="p-2.5 rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.reason}</div>
                    <div className="text-base font-bold text-[#D62828] mt-0.5">{item.count} leads</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Kanban Pipeline View */}
          {view === "pipeline" ? (
            <div className="flex gap-3.5 overflow-x-auto pb-4">
              {LEAD_STAGES.map((stage) => {
                const cards = pipelineLeads.filter((l: any) => l.status === stage.key);
                return (
                  <div
                    key={stage.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggingLeadId || !hasPerm("leads:edit")) return;
                      const dragged = pipelineLeads.find((l: any) => l.id === draggingLeadId);
                      setDraggingLeadId(null);
                      if (dragged && dragged.status !== stage.key) {
                        updateLeadStatus(dragged, stage.key);
                      }
                    }}
                    className="w-72 shrink-0 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col max-h-[72vh]"
                  >
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.dot }} />
                        <span className="text-xs font-bold truncate">{stage.key}</span>
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {cards.length}
                      </span>
                    </div>

                    <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                      {cards.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                          Drop lead here
                        </div>
                      ) : (
                        cards.map((l: any) => (
                          <div
                            key={l.id}
                            draggable={hasPerm("leads:edit")}
                            onDragStart={() => hasPerm("leads:edit") && setDraggingLeadId(l.id)}
                            className={`p-3 bg-white dark:bg-[#111a2e] rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs ${hasPerm("leads:edit") ? "cursor-grab active:cursor-grabbing hover:border-[#0B5CA8]" : ""} transition-colors`}
                          >
                            <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                              <Link href={`/leads/${l.id}`} className="font-bold text-[#0B5CA8] hover:underline">
                                {l.leadCode}
                              </Link>
                              <StatusBadge value={l.priority} />
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {l.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {l.vehicle} ({l.registrationNumber})
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                              <span>{l.city}</span>
                              <span>{l.assignedEmployeeName}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                              <span className="text-[10px] font-medium text-slate-400">
                                {l.expectedSellingPrice ? formatINR(l.expectedSellingPrice) : l.leadSource}
                              </span>
                              <select
                                value={l.status}
                                disabled={!hasPerm("leads:edit")}
                                onChange={(e) => updateLeadStatus(l, e.target.value)}
                                className="text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 disabled:opacity-60"
                                aria-label="Move stage"
                              >
                                {LEAD_STAGES.map((s) => (
                                  <option key={s.key} value={s.key}>{s.key}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View (All Leads / Lost / Duplicates / Recovery) */
            <Card className="overflow-hidden">
              {data.leads.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3 cursor-pointer" onClick={() => toggleSort("leadCode")}>Lead ID <ArrowUpDown className="inline w-3 h-3" /></th>
                          <th className="p-3 cursor-pointer" onClick={() => toggleSort("customerName")}>Customer & Mobile</th>
                          <th className="p-3 cursor-pointer" onClick={() => toggleSort("city")}>City / District</th>
                          <th className="p-3">Vehicle / Year / Reg</th>
                          <th className="p-3">Source & Campaign</th>
                          <th className="p-3 cursor-pointer" onClick={() => toggleSort("status")}>Stage</th>
                          <th className="p-3">Priority / Score</th>
                          <th className="p-3">Assigned Employee</th>
                          <th className="p-3 cursor-pointer" onClick={() => toggleSort("enquiryDate")}>Created / Follow-up</th>
                          <th className="p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.leads.map((l: any) => (
                          <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="p-3 whitespace-nowrap">
                              <Link href={`/leads/${l.id}`} className="font-bold text-[#0B5CA8] hover:underline block">
                                {l.leadCode}
                              </Link>
                              {l.isDuplicate && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                                  Duplicate Flag
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 dark:text-white">{l.customerName}</div>
                              <div className="text-[11px] text-slate-500">{l.mobile}</div>
                            </td>
                            <td className="p-3">
                              <div>{l.city}</div>
                              <div className="text-[11px] text-slate-400">{l.district}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium">{l.vehicle} {l.manufacturingYear ? `(${l.manufacturingYear})` : ""}</div>
                              <div className="text-[11px] text-slate-500">{l.registrationNumber}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium">{l.leadSource}</div>
                              <div className="text-[11px] text-slate-400 max-w-[160px] truncate">{l.campaignName}</div>
                            </td>
                            <td className="p-3">
                              <StatusBadge value={l.status} />
                              {l.lostReason && <div className="text-[10px] text-red-500 mt-0.5">{l.lostReason}</div>}
                              {view === "recovery" && l.recoveryReasons?.length > 0 && (
                                <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                                  {l.recoveryReasons[0]}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <StatusBadge value={l.priority} />
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1">
                                {l.intentScore}/100 ({l.intentCategory})
                              </div>
                            </td>
                            <td className="p-3">{l.assignedEmployeeName}</td>
                            <td className="p-3 whitespace-nowrap">
                              <div>{formatDate(l.createdDate)}</div>
                              <div className="text-[11px] text-slate-400">
                                Next: {l.nextFollowUp ? formatDate(l.nextFollowUp) : "None"}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Link href={`/leads/${l.id}`} className="p-1.5 rounded hover:bg-blue-50 text-[#0B5CA8]" title="View Profile">
                                  <Eye className="w-3.5 h-3.5" />
                                </Link>
                                {hasPerm("leads:edit") && (
                                  <button onClick={() => setEditLead({ ...l })} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Edit Lead">
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {hasPerm("leads:assign") && (
                                  <button
                                    onClick={() => {
                                      setAssignModalLead(l);
                                      setAssignEmpId(l.assignedEmployeeId || "");
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                                    title="Assign Employee"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {view === "duplicates" && hasPerm("leads:merge") && (
                                  <button
                                    onClick={() => {
                                      setMergeModalLead(l);
                                      setMergePrimaryId("");
                                    }}
                                    className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                                    title="Merge Duplicate"
                                  >
                                    <GitMerge className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {hasPerm("leads:delete") && (
                                  <button onClick={() => handleDeleteLead(l)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete Lead">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} pageSize={20} total={data.totalCount} onPageChange={setPage} />
                </>
              )}
            </Card>
          )}
        </>
      )}

      {/* Create Lead Modal (4 Sections from PRD 7.3) */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add New Scrap Vehicle Lead"
        subtitle="Capture customer, Gujarat location, vehicle, and marketing attribution details"
        maxWidth="max-w-3xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCreateLead(false);
          }}
          className="space-y-5 text-xs"
        >
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{formError}</div>
          )}

          {/* A. Customer Information */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
              A. Customer Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input required placeholder="Customer Name *" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <input required placeholder="Primary Mobile *" value={form.primaryMobile} onChange={(e) => setForm({ ...form, primaryMobile: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <input placeholder="Alternative Mobile" value={form.altMobile} onChange={(e) => setForm({ ...form, altMobile: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <input placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <select
                value={form.district}
                onChange={(e) => {
                  const nextDist = e.target.value;
                  const firstCity = GUJARAT_DISTRICTS.find((d) => d.district === nextDist)?.cities[0];
                  setForm({
                    ...form,
                    district: nextDist,
                    city: firstCity?.city ?? nextDist,
                    pinCode: firstCity?.pinCode ?? form.pinCode,
                  });
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {GUJARAT_DISTRICTS.map((d) => (
                  <option key={d.district} value={d.district}>{d.district} District</option>
                ))}
              </select>
              <select
                value={form.city}
                onChange={(e) => {
                  const found = districtCities.find((c) => c.city === e.target.value);
                  setForm({ ...form, city: e.target.value, pinCode: found?.pinCode ?? form.pinCode });
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {districtCities.map((c) => (
                  <option key={c.city} value={c.city}>{c.city}</option>
                ))}
              </select>
              <input placeholder="Area / Locality" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <input placeholder="PIN Code" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <select value={form.preferredContactMethod} onChange={(e) => setForm({ ...form, preferredContactMethod: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <option value="Phone Call">Preferred: Phone Call</option>
                <option value="WhatsApp">Preferred: WhatsApp</option>
                <option value="Email">Preferred: Email</option>
              </select>
            </div>
          </div>

          {/* B. Vehicle Information */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
              B. Vehicle Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={form.vehicleCategory} onChange={(e) => setForm({ ...form, vehicleCategory: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                {VEHICLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                {VEHICLE_MANUFACTURERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input placeholder="Model (e.g. WagonR)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <input placeholder="Registration No (e.g. GJ-01-AB-1234)" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent uppercase" />
              <input type="number" placeholder="Mfg Year" value={form.manufacturingYear} onChange={(e) => setForm({ ...form, manufacturingYear: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <select value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={form.runningCondition} onChange={(e) => setForm({ ...form, runningCondition: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <option value="Running">Running</option>
                <option value="Non-Running">Non-Running</option>
                <option value="Accident Damaged">Accident Damaged</option>
                <option value="Flood Damaged">Flood Damaged</option>
              </select>
              <select value={form.rcAvailable} onChange={(e) => setForm({ ...form, rcAvailable: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <option value="Yes">RC Available: Yes</option>
                <option value="No">RC Available: No</option>
                <option value="Lost/Duplicate">RC Lost / Duplicate</option>
              </select>
              <input placeholder="Ownership (e.g. 1st Owner)" value={form.ownershipStatus} onChange={(e) => setForm({ ...form, ownershipStatus: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
            </div>
          </div>

          {/* C & D. Enquiry & Internal Info */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
              C. Enquiry Attribution & Assignment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={form.leadSourceId} onChange={(e) => setForm({ ...form, leadSourceId: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <option value="">Source: Facebook (Default)</option>
                {(data?.options?.leadSources || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value, adSetId: "", adId: "" })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <option value="">No Campaign / Direct</option>
                {(data?.options?.campaigns || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {form.campaignId && (
                <>
                  <select value={form.adSetId} onChange={(e) => setForm({ ...form, adSetId: e.target.value, adId: "" })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <option value="">Ad Set (Optional)</option>
                    {(data?.options?.adSets || []).filter((as: any) => as.campaignId === form.campaignId).map((as: any) => (
                      <option key={as.id} value={as.id}>{as.name}</option>
                    ))}
                  </select>
                  <select value={form.adId} onChange={(e) => setForm({ ...form, adId: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <option value="">Advertisement (Optional)</option>
                    {(data?.options?.ads || []).filter((a: any) => a.campaignId === form.campaignId && (!form.adSetId || a.adSetId === form.adSetId)).map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </>
              )}
              <select value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                <option value="">Unassigned</option>
                {(data?.options?.employees || []).map((e: any) => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.assignedCity})</option>
                ))}
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                {LEAD_PRIORITIES.map((p) => <option key={p} value={p}>Priority: {p}</option>)}
              </select>
              <input type="number" placeholder="Expected Price (₹)" value={form.expectedSellingPrice} onChange={(e) => setForm({ ...form, expectedSellingPrice: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
            </div>
            <textarea
              placeholder="Customer notes & remarks..."
              value={form.customerNotes}
              onChange={(e) => setForm({ ...form, customerNotes: e.target.value })}
              rows={2}
              className="mt-3 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={formSaving} className="px-5 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold hover:bg-[#1B3156]">
              {formSaving ? "Saving..." : "Create Lead"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Duplicate Detection Warning Modal */}
      <Modal
        open={Boolean(duplicateWarning)}
        onClose={() => setDuplicateWarning(null)}
        title="Potential Duplicate Enquiry Detected"
        subtitle="Existing records match this mobile number or vehicle registration"
      >
        {duplicateWarning && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              {duplicateWarning.message}
            </div>
            <div className="space-y-2">
              {duplicateWarning.duplicates.map((d: any) => (
                <div key={d.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold">{d.leadCode} — {d.customerName}</div>
                    <div className="text-slate-500">{d.mobile} · {d.city} · {d.vehicle}</div>
                  </div>
                  <Link href={`/leads/${d.id}`} className="text-[#0B5CA8] font-semibold hover:underline">
                    Open Existing →
                  </Link>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setDuplicateWarning(null)} className="px-4 py-2 rounded-lg border">
                Cancel Creation
              </button>
              <button onClick={() => submitCreateLead(true)} className="px-4 py-2 rounded-lg bg-[#D62828] text-white font-semibold">
                Create Anyway (Flag as Duplicate)
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mandatory Lost Reason Modal */}
      <Modal
        open={Boolean(lostModalTarget)}
        onClose={() => setLostModalTarget(null)}
        title="Select Lost Lead Reason"
        subtitle="A reason is mandatory before marking a lead as Lost"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <select
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setLostModalTarget(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button
              onClick={() => lostModalTarget && updateLeadStatus(lostModalTarget.lead, "Lost", lostReason)}
              className="px-4 py-2 rounded-lg bg-[#D62828] text-white font-semibold"
            >
              Confirm Lost
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Lead Modal */}
      <Modal
        open={Boolean(assignModalLead)}
        onClose={() => setAssignModalLead(null)}
        title={`Assign Lead ${assignModalLead?.leadCode || ""}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
          <select
            value={assignEmpId}
            onChange={(e) => setAssignEmpId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="">Unassigned</option>
            {(data?.options?.employees || []).map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.assignedCity})</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAssignModalLead(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Assignment</button>
          </div>
        </form>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal
        open={Boolean(editLead)}
        onClose={() => setEditLead(null)}
        title={`Edit Lead ${editLead?.leadCode || ""}`}
        maxWidth="max-w-lg"
      >
        {editLead && (
          <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
            <input value={editLead.customerName} onChange={(e) => setEditLead({ ...editLead, customerName: e.target.value })} placeholder="Customer Name" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
            <div className="grid grid-cols-2 gap-3">
              <input value={editLead.city} onChange={(e) => setEditLead({ ...editLead, city: e.target.value })} placeholder="City" className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
              <select value={editLead.priority} onChange={(e) => setEditLead({ ...editLead, priority: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                {LEAD_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <input type="number" value={editLead.expectedSellingPrice || ""} onChange={(e) => setEditLead({ ...editLead, expectedSellingPrice: e.target.value })} placeholder="Expected Price (₹)" className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
            <textarea value={editLead.customerNotes || ""} onChange={(e) => setEditLead({ ...editLead, customerNotes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditLead(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Merge Duplicate Modal */}
      <Modal
        open={Boolean(mergeModalLead)}
        onClose={() => setMergeModalLead(null)}
        title={`Merge Duplicate Lead ${mergeModalLead?.leadCode || ""}`}
        subtitle="Select the primary lead record to retain; activities, follow-ups, and attribution will be preserved"
        maxWidth="max-w-md"
      >
        {mergeModalLead && (
          <form onSubmit={handleMergeSubmit} className="space-y-4 text-xs">
            <select
              required
              value={mergePrimaryId}
              onChange={(e) => setMergePrimaryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="">Select primary lead...</option>
              {(data?.leads || [])
                .filter((x: any) => x.id !== mergeModalLead.id)
                .map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.leadCode} — {x.customerName} ({x.mobile})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMergeModalLead(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Merge Leads</button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <LeadsContent />
    </Suspense>
  );
}
