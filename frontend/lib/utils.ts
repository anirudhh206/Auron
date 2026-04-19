import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format ucless (6 decimals) → human readable CLESS */
export function formatCless(ucless: number | string): string {
  const n = typeof ucless === "string" ? Number.parseFloat(ucless) : ucless;
  const cless = n / 1_000_000;
  return cless.toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

/** Shorten a wallet address for display */
export function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/** Convert duration_days to a human readable string */
export function formatDuration(days: number): string {
  if (days >= 365 && days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
  if (days >= 30 && days % 30 === 0)  return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
  if (days >= 7 && days % 7 === 0)    return `${days / 7} week${days / 7 > 1 ? "s" : ""}`;
  return `${days} day${days > 1 ? "s" : ""}`;
}

/** Format a unix timestamp → readable date */
export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Generate a unique message ID */
export function genId(): string {
  return crypto.randomUUID();
}
