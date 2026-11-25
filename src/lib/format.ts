import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class names cleanly.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats an integer or decimal amount in Indian Rupees (INR).
 */
export function formatINR(value: number | null | undefined, maximumFractionDigits = 0): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
  }).format(num);
}

/**
 * Formats large INR values compactly using Lakhs (L) and Crores (Cr).
 */
export function formatINRCompact(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "₹0";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  return formatINR(num);
}

/**
 * Formats integers with Indian digit grouping (e.g. 1,24,500).
 */
export function formatNumber(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("en-IN").format(Math.round(num));
}

/**
 * Formats percentages consistently to 2 decimal places by default.
 */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00%";
  return `${num.toFixed(digits)}%`;
}

/**
 * Formats ISO/Date values into consistent Indian DD MMM YYYY display format.
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats ISO/Date values with time in consistent 12-hour format.
 */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Safe division returning 0 when denominator is 0 or non-finite.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Computes standard Meta Ads and ROI KPIs cleanly from raw totals.
 */
export function computeAdMetrics(input: {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  qualifiedLeads?: number;
  completedTransactions?: number;
  attributedRevenue?: number;
}) {
  const ctr = safeDivide(input.clicks, input.impressions) * 100;
  const cpc = safeDivide(input.spend, input.clicks);
  const cpm = safeDivide(input.spend, input.impressions) * 1000;
  const cpl = safeDivide(input.spend, input.leads);
  const frequency = safeDivide(input.impressions, input.reach);
  const cpql = safeDivide(input.spend, input.qualifiedLeads ?? 0);
  const cpct = safeDivide(input.spend, input.completedTransactions ?? 0);
  const marketingRoi =
    input.spend > 0 && input.attributedRevenue !== undefined
      ? ((input.attributedRevenue - input.spend) / input.spend) * 100
      : 0;

  return {
    ctr,
    cpc,
    cpm,
    cpl,
    frequency,
    cpql,
    cpct,
    marketingRoi,
  };
}
