"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthContext";
import { ROLE_DEFINITIONS } from "@/lib/constants";

const SEEDED_ACCOUNTS = [
  { role: "SUPER_ADMIN", label: "Super Admin / Owner", email: "owner@movishgroup.in" },
  { role: "ADMIN", label: "Admin", email: "admin@movishgroup.in" },
  { role: "MANAGER", label: "Manager", email: "manager@movishgroup.in" },
  { role: "SALES_EXECUTIVE", label: "Sales Executive", email: "karan.sales@movishgroup.in" },
  { role: "MARKETING_EXECUTIVE", label: "Marketing Executive", email: "marketing@movishgroup.in" },
  { role: "OPERATIONS_EXECUTIVE", label: "Operations Executive", email: "operations@movishgroup.in" },
  { role: "ACCOUNTS_EXECUTIVE", label: "Accounts Executive", email: "accounts@movishgroup.in" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("owner@movishgroup.in");
  const [password, setPassword] = useState("Movish@2026");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { refreshUser } = useAuth();
  const router = useRouter();

  const submitLogin = async (targetEmail: string, targetPass: string) => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed");
        setSubmitting(false);
        return;
      }
      await refreshUser();
      router.replace("/");
    } catch {
      setError("Network error while signing in.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 dark:from-slate-950 dark:via-[#0e192f] dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#111a2e] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Brand Panel */}
        <div className="lg:col-span-5 bg-[#1B3156] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#0B5CA8]/30 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 w-44 h-44 rounded-full bg-[#D62828]/20 blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex bg-white rounded-xl px-4 py-2.5 shadow-md mb-6">
              <img src="/logo.png" alt="Movish Group" className="h-12 w-auto object-contain" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Movish Group BMS
            </h1>
            <p className="text-blue-100/90 text-sm mt-2 leading-relaxed">
              Centralized Meta Ads, Lead Management CRM, Vehicle Scrapping Operations & Financial Analytics across Gujarat.
            </p>
          </div>

          <div className="relative z-10 mt-8 space-y-3 text-xs text-blue-100/85">
            <div className="flex items-center gap-2.5 bg-white/10 rounded-lg px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Real SQLite relational persistence & role-based permissions</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-[#D62828] shrink-0" />
              <span>Gujarat District & City Coverage · Currency: INR (₹)</span>
            </div>
          </div>
        </div>

        {/* Sign-in Form */}
        <div className="lg:col-span-7 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sign in to workspace</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your Movish Group account credentials or select a role profile below.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLogin(email, password);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B5CA8]"
                  placeholder="name@movishgroup.in"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B5CA8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-[#0B5CA8] hover:bg-[#1B3156] text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60"
            >
              <span>{submitting ? "Authenticating..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Role Access Selector */}
          <div className="mt-7 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Role Accounts (Password: Movish@2026)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEEDED_ACCOUNTS.map((acc) => {
                const def = ROLE_DEFINITIONS.find((r) => r.code === acc.role);
                return (
                  <button
                    key={acc.role}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword("Movish@2026");
                      submitLogin(acc.email, "Movish@2026");
                    }}
                    title={def?.description}
                    className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#0B5CA8] hover:bg-blue-50/60 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{acc.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{acc.email}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
