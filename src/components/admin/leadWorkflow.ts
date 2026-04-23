/**
 * Lead workflow constants — Sprint 5
 *
 * Canonical CRM stages an operator can move a lead through. Kept in sync
 * with `ALLOWED_FUNNEL_STAGES` in supabase/functions/admin-data/index.ts.
 *
 * Order in this list = order shown in the UI.
 */

export type FunnelStage =
  | "new"
  | "qualified"
  | "analyzing"
  | "routed"
  | "contacted"
  | "booked"
  | "closed"
  | "stale"
  | "ghost";

export interface FunnelStageDef {
  value: FunnelStage;
  label: string;
  description: string;
  /** Tailwind classes for the pill background + text. Uses semantic tokens. */
  badgeClass: string;
}

export const FUNNEL_STAGES: FunnelStageDef[] = [
  { value: "new",        label: "New",        description: "Just landed — needs first touch.",        badgeClass: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "qualified",  label: "Qualified",  description: "Verified contact and intent.",            badgeClass: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "analyzing",  label: "Analyzing",  description: "Quote scan and audit in progress.",       badgeClass: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "routed",     label: "Routed",     description: "Sent to a contractor for follow-up.",     badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "contacted",  label: "Contacted",  description: "Operator or contractor has reached out.", badgeClass: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "booked",     label: "Booked",     description: "Appointment confirmed.",                   badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "closed",     label: "Closed",     description: "Deal completed or terminal outcome.",      badgeClass: "bg-green-100 text-green-800 border-green-200" },
  { value: "stale",      label: "Stale",      description: "Inactive — needs re-engagement.",          badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "ghost",      label: "Ghost",      description: "Unverified or unreachable.",               badgeClass: "bg-rose-100 text-rose-800 border-rose-200" },
];

const STAGE_MAP: Record<string, FunnelStageDef> = Object.fromEntries(
  FUNNEL_STAGES.map((s) => [s.value, s]),
);

export function getStageDef(value: string | null | undefined): FunnelStageDef | null {
  if (!value) return null;
  return STAGE_MAP[value] ?? null;
}

export function isValidStage(value: unknown): value is FunnelStage {
  return typeof value === "string" && value in STAGE_MAP;
}

export const NOTE_CATEGORIES: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "call",    label: "Call log" },
  { value: "email",   label: "Email" },
  { value: "sms",     label: "SMS" },
  { value: "meeting", label: "Meeting" },
  { value: "internal", label: "Internal" },
];
