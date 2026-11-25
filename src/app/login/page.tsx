"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { refreshUser } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid username or password.");
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
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#111a2e] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Brand Panel */}
        <div className="lg:col-span-5 bg-[#1B3156] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#0B5CA8]/30 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 w-44 h-44 rounded-full bg-[#D62828]/20 blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex bg-white rounded-xl px-4 py-2.5 shadow-md mb-6">
              <img src="/logo.png" alt="Movish Group" className="h-12 w-auto object-contain" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Movish Group BMS</h1>
            <p className="text-blue-100/90 text-sm mt-2 leading-relaxed">
              Centralized Meta Ads, Lead Management CRM, Vehicle Scrapping Operations & Financial Analytics across Gujarat.
            </p>
          </div>

          <div className="relative z-10 mt-8 space-y-3 text-xs text-blue-100/85">
            <div className="flex items-center gap-2.5 bg-white/10 rounded-lg px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Authenticated workspace with role-based access control</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/10 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-[#D62828] shrink-0" />
              <span>Gujarat District & City Coverage · Currency: INR (₹)</span>
            </div>
          </div>
        </div>

        {/* Sign-in Form */}
        <div className="lg:col-span-7 p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sign in to Movish Group</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your username or work email and password to continue.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B5CA8]"
                  placeholder="Enter username or email"
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0B5CA8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
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
              <span>{submitting ? "Signing in..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
