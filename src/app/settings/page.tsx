"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Check, Database, Plug, Plus, Shield, Sliders, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { ALL_GUJARAT_33_DISTRICTS, LEAD_PRIORITIES, LEAD_STAGES, VEHICLE_CATEGORIES, VEHICLE_MANUFACTURERS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

function SettingsContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "company");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingMsg, setSavingMsg] = useState("");

  const [companyForm, setCompanyForm] = useState<any>({});
  const [metaForm, setMetaForm] = useState<any>({});
  const [waForm, setWaForm] = useState<any>({});
  const [scoringForm, setScoringForm] = useState<any>({});
  const [slaForm, setSlaForm] = useState<any>({});

  const [userModal, setUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "Movish@2026", roleId: "" });
  const [locForm, setLocForm] = useState({ district: "Ahmedabad", city: "", area: "", pinCode: "" });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (res.status === 403) throw new Error("Access to Administration & Settings is restricted for your role.");
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      setData(json);
      setCompanyForm(json.settings.company_profile || {});
      setMetaForm(json.settings.meta_integration || {});
      setWaForm(json.settings.whatsapp_integration || {});
      setScoringForm(json.settings.lead_scoring_rules || {});
      setSlaForm(json.settings.followup_sla || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const patchSetting = async (payload: Record<string, unknown>, msg = "Settings saved.") => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSavingMsg(msg);
      setTimeout(() => setSavingMsg(""), 3000);
      await loadSettings();
    } else {
      const j = await res.json();
      alert(j.error || "Failed to update setting");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Settings & Administration"
        subtitle="Configure Movish Group company profile, users, RBAC permissions, Meta/WhatsApp integrations, Gujarat locations & audit logs"
        actions={
          savingMsg && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <Check className="w-3.5 h-3.5" /> {savingMsg}
            </span>
          )
        }
      />

      <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-fit max-w-full text-xs mb-5">
        {[
          { key: "company", label: "Company Profile", icon: <Building2 className="w-3.5 h-3.5" /> },
          { key: "users", label: "Users", icon: <Users className="w-3.5 h-3.5" /> },
          { key: "permissions", label: "Roles & Permissions", icon: <Shield className="w-3.5 h-3.5" /> },
          { key: "integrations", label: "Integrations", icon: <Plug className="w-3.5 h-3.5" /> },
          { key: "config", label: "Pipeline, Vehicles & Geo", icon: <Sliders className="w-3.5 h-3.5" /> },
          { key: "audit", label: "Audit Logs", icon: <Database className="w-3.5 h-3.5" /> },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold shrink-0 ${tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadSettings} />}

      {!loading && data && (
        <>
          {tab === "company" && (
            <Card className="p-6 max-w-2xl">
              <h3 className="text-sm font-semibold mb-4">Company Profile (Movish Group)</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  patchSetting({ action: "update_setting", key: "company_profile", category: "Company", value: companyForm }, "Company profile updated.");
                }}
                className="space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">Brand Name</label>
                    <input value={companyForm.companyName || ""} onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Legal Entity Name</label>
                    <input value={companyForm.legalName || ""} onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Contact Phone</label>
                    <input value={companyForm.phone || ""} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Operations Email</label>
                    <input value={companyForm.email || ""} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">GSTIN</label>
                    <input value={companyForm.gstNumber || ""} onChange={(e) => setCompanyForm({ ...companyForm, gstNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Base Currency & Region</label>
                    <input disabled value={`${companyForm.currency || "INR (₹)"} · ${companyForm.state || "Gujarat"}`} className="w-full px-3 py-2 rounded-lg border bg-slate-50 dark:bg-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Head Office Address</label>
                  <input value={companyForm.headOfficeAddress || ""} onChange={(e) => setCompanyForm({ ...companyForm, headOfficeAddress: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                </div>
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">
                  Save Company Profile
                </button>
              </form>
            </Card>
          )}

          {tab === "users" && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Login Accounts ({data.users.length})</h3>
                <button onClick={() => setUserModal(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
                  <Plus className="w-3.5 h-3.5" /> Create User
                </button>
              </div>
              {data.users.length === 0 ? <EmptyState title="No user accounts found" /> : (
                <>
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {data.users.map((u: any) => (
                      <div key={u.id} className="p-3.5 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{u.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                            <div className="text-[11px] text-slate-400">{u.role.name}</div>
                          </div>
                          <StatusBadge value={u.isActive ? "Active" : "Paused"} className="shrink-0" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">Last login: {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</span>
                          <button
                            onClick={() => patchSetting({ action: "toggle_user", userId: u.id, isActive: !u.isActive }, "User status updated.")}
                            className="px-2.5 py-1 rounded border"
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                        <tr>
                          <th className="p-3">Name</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Last Login</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.users.map((u: any) => (
                          <tr key={u.id}>
                            <td className="p-3 font-semibold">{u.name}</td>
                            <td className="p-3">{u.email}</td>
                            <td className="p-3">{u.role.name}</td>
                            <td className="p-3">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                            <td className="p-3"><StatusBadge value={u.isActive ? "Active" : "Paused"} /></td>
                            <td className="p-3">
                              <button
                                onClick={() => patchSetting({ action: "toggle_user", userId: u.id, isActive: !u.isActive }, "User status updated.")}
                                className="px-2.5 py-1 rounded border"
                              >
                                {u.isActive ? "Deactivate" : "Activate"}
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

          {tab === "permissions" && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold">Role-Based Permission Matrix</h3>
                <p className="text-xs text-slate-500">Toggle granular permissions enforced across API endpoints</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                    <tr>
                      <th className="p-2.5">Permission</th>
                      {data.roles.map((r: any) => (
                        <th key={r.id} className="p-2.5 text-center">{r.name.split(" /")[0]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.permissions.map((perm: any) => (
                      <tr key={perm.id}>
                        <td className="p-2.5">
                          <span className="font-semibold">{perm.module}: {perm.action}</span>
                          <div className="text-[10px] text-slate-400">{perm.description}</div>
                        </td>
                        {data.roles.map((r: any) => {
                          const rp = r.permissions.find((x: any) => x.permissionId === perm.id);
                          const checked = r.code === "SUPER_ADMIN" ? true : Boolean(rp?.allowed);
                          return (
                            <td key={r.id} className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                disabled={r.code === "SUPER_ADMIN"}
                                checked={checked}
                                onChange={(e) =>
                                  patchSetting({ action: "toggle_permission", roleId: r.id, permissionId: perm.id, allowed: e.target.checked }, "Permission updated.")
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "integrations" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Meta Marketing & Lead Ads API (Phase 3)</h3>
                  <StatusBadge value={metaForm.status || "Not Connected"} />
                </div>
                <p className="text-slate-500">{metaForm.note}</p>
                <input placeholder="Meta App ID" value={metaForm.appId || ""} onChange={(e) => setMetaForm({ ...metaForm, appId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                <input placeholder="Meta Ad Account ID (act_...)" value={metaForm.adAccountId || ""} onChange={(e) => setMetaForm({ ...metaForm, adAccountId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                <select value={metaForm.clickMetricPreference || "link_clicks"} onChange={(e) => setMetaForm({ ...metaForm, clickMetricPreference: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
                  <option value="link_clicks">Default Click Metric: Link Clicks</option>
                  <option value="all_clicks">Default Click Metric: All Clicks</option>
                </select>
                <button
                  onClick={() => patchSetting({ action: "update_setting", key: "meta_integration", category: "Integrations", value: metaForm }, "Meta integration config saved.")}
                  className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold"
                >
                  Save Meta Settings
                </button>
              </Card>

              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">WhatsApp Business Cloud API (Phase 4)</h3>
                  <StatusBadge value={waForm.status || "Not Connected"} />
                </div>
                <p className="text-slate-500">{waForm.note}</p>
                <input placeholder="WhatsApp Phone Number ID" value={waForm.phoneNumberId || ""} onChange={(e) => setWaForm({ ...waForm, phoneNumberId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                <input placeholder="WABA Business Account ID" value={waForm.wabaId || ""} onChange={(e) => setWaForm({ ...waForm, wabaId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
                <button
                  onClick={() => patchSetting({ action: "update_setting", key: "whatsapp_integration", category: "Integrations", value: waForm }, "WhatsApp config saved.")}
                  className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold"
                >
                  Save WhatsApp Settings
                </button>
              </Card>
            </div>
          )}

          {tab === "config" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <Card className="p-5 space-y-3">
                <h3 className="text-sm font-semibold">Lead Sources & Pipeline Stages</h3>
                <div className="space-y-1.5">
                  {data.leadSources.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/70">
                      <span>{s.name} ({s.category})</span>
                      <input type="checkbox" checked={s.isActive} onChange={(e) => patchSetting({ action: "toggle_source", sourceId: s.id, isActive: e.target.checked }, "Lead source toggled.")} />
                    </div>
                  ))}
                </div>
                <div className="pt-2">
                  <div className="font-semibold mb-1.5">Configured Pipeline Stages ({LEAD_STAGES.length}) & Priorities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {LEAD_STAGES.map((st) => <StatusBadge key={st.key} value={st.key} />)}
                    {LEAD_PRIORITIES.map((p) => <StatusBadge key={p} value={p} />)}
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-3">
                <h3 className="text-sm font-semibold">Scoring Rules, SLA & Gujarat Locations</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-500">High Intent Threshold</label>
                    <input type="number" value={scoringForm.highIntentThreshold || 70} onChange={(e) => setScoringForm({ ...scoringForm, highIntentThreshold: Number(e.target.value) })} className="w-full px-2.5 py-1.5 rounded border bg-transparent" />
                  </div>
                  <div>
                    <label className="text-slate-500">Stale Lead Alert (Days)</label>
                    <input type="number" value={slaForm.staleLeadAlertDays || 3} onChange={(e) => setSlaForm({ ...slaForm, staleLeadAlertDays: Number(e.target.value) })} className="w-full px-2.5 py-1.5 rounded border bg-transparent" />
                  </div>
                </div>
                <button
                  onClick={() => {
                    patchSetting({ action: "update_setting", key: "lead_scoring_rules", category: "Configuration", value: scoringForm });
                    patchSetting({ action: "update_setting", key: "followup_sla", category: "Configuration", value: slaForm }, "Scoring & SLA rules saved.");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0B5CA8] text-white font-semibold"
                >
                  Save Rules
                </button>

                <div className="pt-3 border-t">
                  <div className="font-semibold mb-2">Add Serviceable Gujarat City / PIN</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select value={locForm.district} onChange={(e) => setLocForm({ ...locForm, district: e.target.value })} className="px-2 py-1.5 rounded border bg-white dark:bg-slate-900">
                      {ALL_GUJARAT_33_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input placeholder="City" value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} className="px-2 py-1.5 rounded border bg-transparent" />
                    <input placeholder="PIN" value={locForm.pinCode} onChange={(e) => setLocForm({ ...locForm, pinCode: e.target.value })} className="px-2 py-1.5 rounded border bg-transparent" />
                  </div>
                  <button
                    onClick={() => locForm.city && patchSetting({ action: "add_location", ...locForm }, "Gujarat location added.")}
                    className="mt-2 px-3 py-1.5 rounded bg-slate-800 text-white"
                  >
                    + Add Location ({data.locations.length} active)
                  </button>
                </div>

                <div className="pt-2 text-[11px] text-slate-500">
                  Supported Vehicle Categories: {VEHICLE_CATEGORIES.join(", ")} · Manufacturers: {VEHICLE_MANUFACTURERS.slice(0, 8).join(", ")}...
                </div>
              </Card>
            </div>
          )}

          {tab === "audit" && (
            <Card className="overflow-hidden">
              {!data.canViewAudit ? (
                <div className="p-8 text-center text-xs text-slate-500">Audit logs are restricted to Super Admin.</div>
              ) : data.auditLogs.length === 0 ? (
                <EmptyState title="No audit logs recorded yet" description="Login, lead, quotation, pickup, financial, and permission events are tracked here." />
              ) : (
                <>
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {data.auditLogs.map((log: any) => (
                      <div key={log.id} className="p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{log.actorName}</span>
                          <StatusBadge value={log.action} />
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{log.summary}</p>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>{log.entityType}</span>
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 border-b">
                        <tr>
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Actor</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Entity</th>
                          <th className="p-3">Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.auditLogs.map((log: any) => (
                          <tr key={log.id}>
                            <td className="p-3 whitespace-nowrap text-slate-500">{formatDateTime(log.createdAt)}</td>
                            <td className="p-3 font-semibold">{log.actorName}</td>
                            <td className="p-3"><StatusBadge value={log.action} /></td>
                            <td className="p-3">{log.entityType}</td>
                            <td className="p-3">{log.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Create Login User" maxWidth="max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            patchSetting({ action: "create_user", ...newUser }, "Login user created.");
            setUserModal(false);
          }}
          className="space-y-3 text-xs"
        >
          <input required placeholder="Full Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input required type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <input required type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select required value={newUser.roleId} onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Role...</option>
            {(data?.roles || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setUserModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Create Account</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <SettingsContent />
    </Suspense>
  );
}
