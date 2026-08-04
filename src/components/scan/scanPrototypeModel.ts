/**
 * Local `/scan` prototype model — Sprint 2.
 *
 * Metadata and UI-state helpers only. No FileReader, object URLs, Base64,
 * Supabase, Gemini, persistence, OTP, or tracking.
 *
 * NOTE: The local 15 MiB prototype limit must be reconciled with backend
 * enforcement before production wiring.
 */

export type ScanPrototypeState =
  | "idle"
  | "selected"
  | "analyzing"
  | "lead_capture"
  | "summary";

export type SelectedEstimateMeta = {
  name: string;
  size: number;
  type: string;
};

export type LeadFormValues = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  contractorName: string;
  totalOpenings: string;
  totalQuotedPrice: string;
};

export type LeadFieldKey = keyof LeadFormValues;

export const EMPTY_LEAD_FORM: LeadFormValues = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  contractorName: "",
  totalOpenings: "",
  totalQuotedPrice: "",
};

/** Prototype maximum — must match backend enforcement before production wiring. */
export const MAX_PROTOTYPE_BYTES = 15_728_640;

export const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ACCEPTED_FILE_TYPES =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

export const MULTI_FILE_NOTICE =
  "WindowMan reviews one estimate at a time. The first file was selected.";

export const ANALYSIS_DURATION_MS = 1500;

export const ANALYSIS_STEPS = [
  "Reading quoted scope",
  "Checking what is missing",
  "Flagging questions worth asking",
  "Preparing your example report",
] as const;

export const CHECK_DIMENSIONS = ["PRICE", "SCOPE", "GLASS", "WARRANTY", "FINE PRINT"] as const;

export type ValidateEstimateResult =
  | { ok: true; meta: SelectedEstimateMeta; multiFile: boolean }
  | { ok: false; error: string; multiFile: boolean };

export function extractEstimateMeta(file: File): SelectedEstimateMeta {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export function validateEstimateFile(file: File): { ok: true; meta: SelectedEstimateMeta } | { ok: false; error: string } {
  if (file.size === 0) {
    return { ok: false, error: "That file is empty. Choose a real estimate PDF or image." };
  }

  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Unsupported file type. Use PDF, JPG, PNG, or WebP.",
    };
  }

  if (file.size > MAX_PROTOTYPE_BYTES) {
    return {
      ok: false,
      error: "That file is larger than 15 MiB. Choose a smaller estimate file.",
    };
  }

  return { ok: true, meta: extractEstimateMeta(file) };
}

/**
 * Validates the first file in a FileList. Never reads file contents.
 * Does not retain the File object — only metadata on success.
 */
export function validateEstimateSelection(
  files: FileList | File[] | null | undefined,
): ValidateEstimateResult {
  if (!files || files.length === 0) {
    return { ok: false, error: "Choose an estimate file to continue.", multiFile: false };
  }

  const multiFile = files.length > 1;
  const result = validateEstimateFile(files[0]);

  if (result.ok === false) {
    return { ok: false, error: result.error, multiFile };
  }

  return { ok: true, meta: result.meta, multiFile };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function isValidLeadEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidLeadName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

export function isValidLeadPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function formatLeadPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export type LeadValidationErrors = Partial<Record<LeadFieldKey, string>>;

export function validateLeadForm(values: LeadFormValues): LeadValidationErrors {
  const errors: LeadValidationErrors = {};

  if (!isValidLeadName(values.fullName)) {
    errors.fullName = "Enter your full name.";
  }
  if (!isValidLeadEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!isValidLeadPhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number.";
  }

  return errors;
}

export const LEAD_FIELD_ORDER: LeadFieldKey[] = [
  "fullName",
  "email",
  "phone",
  "address",
  "contractorName",
  "totalOpenings",
  "totalQuotedPrice",
];

export function firstInvalidLeadField(errors: LeadValidationErrors): LeadFieldKey | null {
  for (const key of LEAD_FIELD_ORDER) {
    if (errors[key]) return key;
  }
  return null;
}
