import type { MoneyCents } from "./types";

export function formatMoneyCents(value: MoneyCents): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value / 100);
}
export function formatCompactMoneyCents(value: MoneyCents): string {
  const dollars = value / 100;
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(dollars % 1_000 === 0 ? 0 : 1)}K`;
  return formatMoneyCents(value);
}

export function formatDateRange(from: string, to: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(new Date(from))} – ${formatter.format(new Date(to))}`;
}
