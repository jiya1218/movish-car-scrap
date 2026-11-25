"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, Download, IndianRupee, Plus, Receipt, Search, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthContext";
import { Card, EmptyState, ErrorState, KpiCard, LoadingState, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { EXPENSE_CATEGORIES, PAYMENT_STATUSES, REVENUE_SOURCES } from "@/lib/constants";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { formatDate, formatINR } from "@/lib/format";

function TransactionsContent() {
  const searchParams = useSearchParams();
  const { hasPerm } = useAuth();
  const [tab, setTab] = useState<"transactions" | "expenses" | "revenues" | "payments">("transactions");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState<"transaction" | "expense" | "revenue" | "payment" | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [txnForm, setTxnForm] = useState({ vehicleId: "", vehiclePurchaseAmount: "", paymentStatus: "Pending", paymentMethod: "NEFT / IMPS", remarks: "" });
  const [expForm, setExpForm] = useState({ category: EXPENSE_CATEGORIES[1] as string, amount: "", vehicleId: "", transactionId: "", paymentMethod: "Bank Transfer", includedInPurchaseCost: false, notes: "" });
  const [revForm, setRevForm] = useState({ source: REVENUE_SOURCES[1] as string, amount: "", vehicleId: "", transactionId: "", buyer: "", paymentStatus: "Paid", notes: "" });
  const [payForm, setPayForm] = useState({ paymentStatus: "Paid", paymentReference: "", notes: "" });

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ search, paymentStatus, category });
      const res = await fetch(`/api/transactions?${qs.toString()}`, { cache: "no-store" });
      if (res.status === 403) throw new Error("Access to financial records is restricted for your role.");
      if (!res.ok) throw new Error("Unable to load financial records");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, paymentStatus, category]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const submitPost = async (action: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (res.ok) {
      setModal(null);
      await loadFinance();
    } else {
      const j = await res.json();
      alert(j.error || "Unable to save entry");
    }
  };

  const exportFinance = (fmt: "csv" | "xlsx") => {
    const rows = data?.transactions || [];
    const cols = [
      { header: "Txn ID", accessor: (r: any) => r.transactionCode },
      { header: "Vehicle", accessor: (r: any) => `${r.vehicle.vehicleCode} (${r.vehicle.registrationNumber})` },
      { header: "Customer", accessor: (r: any) => r.customer.name },
      { header: "Purchase Amount (INR)", accessor: (r: any) => r.vehiclePurchaseAmount },
      { header: "Realization (INR)", accessor: (r: any) => r.realizationValue },
      { header: "Payment Status", accessor: (r: any) => r.paymentStatus },
      { header: "Txn Status", accessor: (r: any) => r.transactionStatus },
      { header: "Date", accessor: (r: any) => formatDate(r.transactionDate) },
    ];
    if (fmt === "csv") exportToCSV("movish-transactions", rows, cols);
    else exportToExcel("movish-transactions", "Transactions", rows, cols);
  };

  return (
    <AppShell>
      <PageHeader
        title="Transactions & Financial Management"
        subtitle="Track vehicle purchases, operational expenses, realized revenue, payments & net profitability (INR ₹)"
        actions={
          hasPerm("finance:manage") && (
            <>
              <button onClick={() => setModal("transaction")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0B5CA8] text-white">
                <Plus className="w-3.5 h-3.5" /> New Purchase Txn
              </button>
              <button onClick={() => setModal("expense")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
                + Record Expense
              </button>
              <button onClick={() => setModal("revenue")} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white">
                + Record Revenue
              </button>
              <button onClick={() => exportFinance("csv")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => exportFinance("xlsx")} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111a2e]">
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            </>
          )
        }
      />

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={loadFinance} />}

      {!loading && data && (
        <div className="space-y-5">
          {/* Financial KPIs (PRD Sec 12.5) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <KpiCard label="Total Purchase Cost" value={data.summary.totalPurchaseCost} format="currency" icon={<IndianRupee className="w-4 h-4" />} desc={`Avg ${formatINR(data.summary.averagePurchaseCost)} / vehicle`} />
            <KpiCard label="Operational Expenses" value={data.summary.totalOperationalExpenses} format="currency" icon={<Receipt className="w-4 h-4" />} desc="Excludes purchase-cost items (no double count)" invertGoodDirection />
            <KpiCard label="Realized Revenue" value={data.summary.totalRealization} format="currency" icon={<CheckCircle2 className="w-4 h-4" />} desc={`Est. uncompleted yard value: ${formatINR(data.summary.estimatedInventoryValue)}`} />
            <KpiCard label="Net Profit" value={data.summary.netProfit} format="currency" icon={<TrendingUp className="w-4 h-4" />} desc={`Profit Margin ${data.summary.profitMargin.toFixed(1)}% | Avg ${formatINR(data.summary.averageNetProfit)}`} />
          </div>

          <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 bg-white dark:bg-[#111a2e] p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-fit max-w-full text-xs">
            {[
              { key: "transactions", label: `Purchases & Txns (${data.transactions.length})` },
              { key: "expenses", label: `Expenses (${data.expenses.length})` },
              { key: "revenues", label: `Realization / Revenue (${data.revenues.length})` },
              { key: "payments", label: `Payments (${data.payments.length})` },
            ].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 ${tab === t.key ? "bg-[#0B5CA8] text-white" : "text-slate-600 dark:text-slate-300"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <Card className="p-3.5">
            <div className="flex flex-wrap gap-2.5 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search txn ID, vehicle reg, customer, expense note..." className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" />
              </div>
              {tab === "transactions" && (
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <option value="All">Payment Status: All</option>
                  {PAYMENT_STATUSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {tab === "expenses" && (
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <option value="All">Category: All</option>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </Card>

          {tab === "transactions" && (
            <Card className="overflow-hidden">
              {data.transactions.length === 0 ? <EmptyState title="No purchase transactions yet" description="Record a vehicle purchase transaction to begin financial tracking." /> : (
                <>
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {data.transactions.map((t: any) => {
                      const opsExp = t.pickupExpense + t.transportationExpense + t.labourExpense + t.processingExpense + t.otherExpenses;
                      return (
                        <div key={t.id} className="p-3.5 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-[#0B5CA8]">{t.transactionCode}</div>
                              <div className="font-semibold">{t.vehicle.registrationNumber} ({t.vehicle.model})</div>
                              <div className="text-[11px] text-slate-400">{t.customer.name} · {t.customer.city} · {formatDate(t.transactionDate)}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <StatusBadge value={t.paymentStatus} />
                              <StatusBadge value={t.transactionStatus} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-[11px] tabular-nums">
                            <div><span className="text-slate-400 block">Purchase</span><strong>{formatINR(t.vehiclePurchaseAmount)}</strong></div>
                            <div><span className="text-slate-400 block">Ops Exp</span><strong className="text-amber-600">{formatINR(opsExp)}</strong></div>
                            <div><span className="text-slate-400 block">Realized</span><strong className="text-emerald-600">{formatINR(t.realizationValue)}</strong></div>
                          </div>
                          {hasPerm("finance:manage") && (
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  setSelectedTxn(t);
                                  setPayForm({ paymentStatus: t.paymentStatus, paymentReference: t.paymentReference || "", notes: "" });
                                  setModal("payment");
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0B5CA8] hover:text-white font-medium"
                              >
                                <CreditCard className="w-3 h-3" /> Update Payment
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                        <tr>
                          <th className="p-3">Txn ID & Date</th>
                          <th className="p-3">Vehicle & Customer</th>
                          <th className="p-3 text-right">Purchase Amount</th>
                          <th className="p-3 text-right">Ops Expenses</th>
                          <th className="p-3 text-right">Realized Value</th>
                          <th className="p-3">Payment</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.transactions.map((t: any) => {
                          const opsExp = t.pickupExpense + t.transportationExpense + t.labourExpense + t.processingExpense + t.otherExpenses;
                          return (
                            <tr key={t.id}>
                              <td className="p-3">
                                <div className="font-semibold text-[#0B5CA8]">{t.transactionCode}</div>
                                <div className="text-[11px] text-slate-400">{formatDate(t.transactionDate)}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-semibold">{t.vehicle.registrationNumber} ({t.vehicle.model})</div>
                                <div className="text-[11px] text-slate-400">{t.customer.name} · {t.customer.city}</div>
                              </td>
                              <td className="p-3 text-right font-semibold tabular-nums">{formatINR(t.vehiclePurchaseAmount)}</td>
                              <td className="p-3 text-right text-amber-600 tabular-nums">{formatINR(opsExp)}</td>
                              <td className="p-3 text-right font-bold text-emerald-600 tabular-nums">{formatINR(t.realizationValue)}</td>
                              <td className="p-3">
                                <StatusBadge value={t.paymentStatus} />
                                <div className="text-[10px] text-slate-400 mt-0.5">{t.paymentReference || t.paymentMethod}</div>
                              </td>
                              <td className="p-3"><StatusBadge value={t.transactionStatus} /></td>
                              <td className="p-3">
                                {hasPerm("finance:manage") && (
                                  <button
                                    onClick={() => {
                                      setSelectedTxn(t);
                                      setPayForm({ paymentStatus: t.paymentStatus, paymentReference: t.paymentReference || "", notes: "" });
                                      setModal("payment");
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-[#0B5CA8] hover:text-white"
                                  >
                                    <CreditCard className="w-3 h-3" /> Update
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "expenses" && (
            <Card className="overflow-hidden">
              {data.expenses.length === 0 ? <EmptyState title="No expenses recorded yet" description="Use '+ Record Expense' to log pickup, labour, processing, or general costs." /> : (
                <>
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {data.expenses.map((e: any) => (
                      <div key={e.id} className="p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold">{e.expenseCode}</div>
                            <div className="text-[11px] text-slate-500">{e.vehicle ? `${e.vehicle.registrationNumber} (${e.transaction?.transactionCode || ""})` : "General Operations"}</div>
                          </div>
                          <div className="text-right font-bold text-[#D62828] tabular-nums">{formatINR(e.amount)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge value={e.category} />
                          <span className="text-[11px] text-slate-400">{formatDate(e.date)} · {e.paymentMethod}</span>
                        </div>
                        {e.notes && <p className="text-[11px] text-slate-500">{e.notes}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                        <tr>
                          <th className="p-3">Expense ID</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Related Vehicle / Txn</th>
                          <th className="p-3">Date & Method</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.expenses.map((e: any) => (
                          <tr key={e.id}>
                            <td className="p-3 font-semibold">{e.expenseCode}</td>
                            <td className="p-3"><StatusBadge value={e.category} /></td>
                            <td className="p-3">{e.vehicle ? `${e.vehicle.registrationNumber} (${e.transaction?.transactionCode || ""})` : "General Operations"}</td>
                            <td className="p-3">{formatDate(e.date)} · {e.paymentMethod}</td>
                            <td className="p-3 text-right font-bold text-[#D62828] tabular-nums">{formatINR(e.amount)}</td>
                            <td className="p-3 text-slate-500">{e.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "revenues" && (
            <Card className="overflow-hidden">
              {data.revenues.length === 0 ? <EmptyState title="No realized revenue entries yet" description="Record scrap material, parts, or vehicle resale realization using '+ Record Revenue'." /> : (
                <>
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {data.revenues.map((r: any) => (
                      <div key={r.id} className="p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold">{r.revenueCode}</div>
                            <div className="text-[11px] text-slate-500">{r.vehicle?.registrationNumber || "—"} · {r.buyer || "—"}</div>
                          </div>
                          <div className="font-bold text-emerald-600 tabular-nums">{formatINR(r.amount)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge value={r.source} />
                          <StatusBadge value={r.paymentStatus} />
                        </div>
                        <div className="text-[11px] text-slate-400">{formatDate(r.date)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                        <tr>
                          <th className="p-3">Revenue ID</th>
                          <th className="p-3">Source</th>
                          <th className="p-3">Vehicle & Buyer</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Realized Amount</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.revenues.map((r: any) => (
                          <tr key={r.id}>
                            <td className="p-3 font-semibold">{r.revenueCode}</td>
                            <td className="p-3"><StatusBadge value={r.source} /></td>
                            <td className="p-3">
                              <div className="font-semibold">{r.vehicle?.registrationNumber || "—"}</div>
                              <div className="text-[11px] text-slate-400">{r.buyer || "—"}</div>
                            </td>
                            <td className="p-3">{formatDate(r.date)}</td>
                            <td className="p-3 text-right font-bold text-emerald-600 tabular-nums">{formatINR(r.amount)}</td>
                            <td className="p-3"><StatusBadge value={r.paymentStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}

          {tab === "payments" && (
            <Card className="overflow-hidden">
              {data.payments.length === 0 ? <EmptyState title="No payment updates logged yet" description="Payment history entries appear as purchase payment statuses are updated." /> : (
                <>
                  <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {data.payments.map((p: any) => (
                      <div key={p.id} className="p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold">{p.paymentCode}</div>
                            <div className="text-[11px] text-slate-500">{p.transaction?.transactionCode || "—"} · {p.vehicle?.registrationNumber || "—"}</div>
                          </div>
                          <div className="font-bold tabular-nums">{formatINR(p.amount)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">{p.paymentMethod} · {formatDate(p.paymentDate)}</span>
                          <StatusBadge value={p.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b">
                        <tr>
                          <th className="p-3">Payment ID</th>
                          <th className="p-3">Transaction / Vehicle</th>
                          <th className="p-3">Method & Reference</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.payments.map((p: any) => (
                          <tr key={p.id}>
                            <td className="p-3 font-semibold">{p.paymentCode}</td>
                            <td className="p-3">{p.transaction?.transactionCode || "—"} · {p.vehicle?.registrationNumber || "—"}</td>
                            <td className="p-3">{p.paymentMethod} · {p.paymentReference || "—"}</td>
                            <td className="p-3">{formatDate(p.paymentDate)}</td>
                            <td className="p-3 text-right font-bold tabular-nums">{formatINR(p.amount)}</td>
                            <td className="p-3"><StatusBadge value={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <Modal open={modal === "transaction"} onClose={() => setModal(null)} title="Record New Purchase Transaction" maxWidth="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submitPost("create_transaction", txnForm); }} className="space-y-3 text-xs">
          <select required value={txnForm.vehicleId} onChange={(e) => setTxnForm({ ...txnForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Select Vehicle...</option>
            {(data?.options?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.manufacturer} {v.model}</option>)}
          </select>
          <input type="number" required placeholder="Vehicle Purchase Amount (₹)" value={txnForm.vehiclePurchaseAmount} onChange={(e) => setTxnForm({ ...txnForm, vehiclePurchaseAmount: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select value={txnForm.paymentStatus} onChange={(e) => setTxnForm({ ...txnForm, paymentStatus: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea placeholder="Remarks..." value={txnForm.remarks} onChange={(e) => setTxnForm({ ...txnForm, remarks: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Create Transaction</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "expense"} onClose={() => setModal(null)} title="Record Operational Expense" maxWidth="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submitPost("create_expense", expForm); }} className="space-y-3 text-xs">
          <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" required placeholder="Amount (₹)" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select value={expForm.vehicleId} onChange={(e) => setExpForm({ ...expForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">General Business Expense (No Vehicle)</option>
            {(data?.options?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.model}</option>)}
          </select>
          <select value={expForm.transactionId} onChange={(e) => setExpForm({ ...expForm, transactionId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Link Transaction (Optional)</option>
            {(data?.transactions || []).map((t: any) => <option key={t.id} value={t.id}>{t.transactionCode} — {t.vehicle.registrationNumber}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={expForm.includedInPurchaseCost} onChange={(e) => setExpForm({ ...expForm, includedInPurchaseCost: e.target.checked })} />
            Already included in vehicle purchase cost (prevents double-counting)
          </label>
          <textarea placeholder="Expense details..." value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Record Expense</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "revenue"} onClose={() => setModal(null)} title="Record Realized Revenue" maxWidth="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submitPost("create_revenue", revForm); }} className="space-y-3 text-xs">
          <select value={revForm.source} onChange={(e) => setRevForm({ ...revForm, source: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {REVENUE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="number" required placeholder="Realized Amount (₹)" value={revForm.amount} onChange={(e) => setRevForm({ ...revForm, amount: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <select value={revForm.vehicleId} onChange={(e) => setRevForm({ ...revForm, vehicleId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Link Vehicle (Optional)</option>
            {(data?.options?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.registrationNumber} — {v.model}</option>)}
          </select>
          <select value={revForm.transactionId} onChange={(e) => setRevForm({ ...revForm, transactionId: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            <option value="">Link Transaction (Marks Completed)</option>
            {(data?.transactions || []).map((t: any) => <option key={t.id} value={t.id}>{t.transactionCode} — {t.vehicle.registrationNumber}</option>)}
          </select>
          <input placeholder="Buyer / Mill / Parts Dealer Name" value={revForm.buyer} onChange={(e) => setRevForm({ ...revForm, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Record Revenue</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "payment" && Boolean(selectedTxn)} onClose={() => setModal(null)} title={`Update Payment — ${selectedTxn?.transactionCode || ""}`} maxWidth="max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitPost("update_payment_status", { transactionId: selectedTxn.id, ...payForm });
          }}
          className="space-y-3 text-xs"
        >
          <select value={payForm.paymentStatus} onChange={(e) => setPayForm({ ...payForm, paymentStatus: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900">
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="UTR / Payment Reference" value={payForm.paymentReference} onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <textarea placeholder="Payment notes..." value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border bg-transparent" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B5CA8] text-white font-semibold">Save Payment Update</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <TransactionsContent />
    </Suspense>
  );
}
