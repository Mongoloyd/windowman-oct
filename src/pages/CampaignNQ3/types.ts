export type LeadCaptureStep = number | "done";

export const NQ3_PROJECT_TYPES = [
  "Windows",
  "Doors",
  "Both",
  "Not sure yet",
] as const;

export const NQ3_OPENING_RANGES = [
  "1–5",
  "6–10",
  "11–15",
  "16+",
  "Not sure",
] as const;

export type Nq3ProjectType = (typeof NQ3_PROJECT_TYPES)[number];
export type Nq3OpeningRange = (typeof NQ3_OPENING_RANGES)[number];

export interface Nq3LeadPayload {
  zip: string;
  projectType: Nq3ProjectType;
  openings: Nq3OpeningRange;
  name: string;
  email: string;
  phone: string;
}

export type Nq3LeadSubmitResult =
  | { ok: true }
  | { ok: false; message: string };

export type OnSubmitLead = (
  payload: Nq3LeadPayload,
) => Promise<Nq3LeadSubmitResult>;

export const isFloridaZip = (value: string): boolean => /^3[2-4]\d{3}$/.test(value.trim());
