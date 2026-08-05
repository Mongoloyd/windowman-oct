/**
 * Local `/scan` prototype model — Sprint 2.
 *
 * Metadata and UI-state helpers only. No FileReader, object URLs, Base64,
 * Supabase, Gemini, persistence, OTP, or tracking.
 *
 * File limits align with UploadZone / backend (10 MiB).
 */

/** @deprecated Use RealScanPhase from useRealScanBridge in ScanLandingExperience. */
export type ScanPrototypeState =
  | "idle"
  | "selected"
  | "lead_capture"
  | "summary";

export type SelectedEstimateMeta = {
  name: string;
  size: number;
  type: string;
};

export type QuotePreviewSource = "demo" | "live_preview";

export type QuotePreviewImportance = "high" | "medium" | "low";

export type QuotePreviewFinding = {
  id: string;
  title: string;
  evidence: string;
  importance: QuotePreviewImportance;
  whyItMatters: string;
  recommendedAction: string;
};

export type QuotePreviewViewModel = {
  source: QuotePreviewSource;

  gradeBand: string | null;
  warningCount: number | null;
  missingDetailCount: number | null;

  contractorName: string | null;
  openingCountBucket: string | null;
  documentType: string | null;

  findings: QuotePreviewFinding[];
};

export const demoPreview: QuotePreviewViewModel = {
  source: "demo",
  gradeBand: null,
  warningCount: 3,
  missingDetailCount: 2,
  contractorName: "ABC Windows",
  openingCountBucket: "8–12 openings",
  documentType: "Window and Door Estimate",
  findings: [
    {
      id: "warranty-labor",
      title: "Warranty labor coverage is unclear",
      importance: "high",
      evidence: "Labor coverage was not found in the example warranty language.",
      whyItMatters:
        "A product warranty may not cover removal, labor, or future service visits.",
      recommendedAction:
        "Ask whether labor and service calls are covered, for how long, and who pays after installation.",
    },
    {
      id: "permit-responsibility",
      title: "Permit responsibility needs confirmation",
      importance: "high",
      evidence:
        "The example scope does not clearly assign permit fees, filing, or inspection coordination.",
      whyItMatters:
        "Unclear permit responsibility can create added cost, delays, or disputes after signing.",
      recommendedAction:
        "Ask who obtains the permit, who pays every related fee, and who handles failed inspections.",
    },
    {
      id: "glass-spec",
      title: "Exact glass specification is incomplete",
      importance: "medium",
      evidence: "The example quote does not identify a complete glass package and certification set.",
      whyItMatters:
        "Different glass packages can materially affect performance, code suitability, and price.",
      recommendedAction:
        "Request the exact manufacturer, product line, glass package, ratings, and approval references.",
    },
  ],
};

export type LeadFormValues = {
  firstName: string;
  email: string;
  phone: string;
};

export type LeadFieldKey = keyof LeadFormValues;

export const EMPTY_LEAD_FORM: LeadFormValues = {
  firstName: "",
  email: "",
  phone: "",
};

/** Matches UploadZone `MAX_FILE_SIZE` and backend upload guard. */
export const MAX_PROTOTYPE_BYTES = 10 * 1024 * 1024;

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

  if (file.type === "image/heic" || file.type === "image/heif") {
    return {
      ok: false,
      error: "HEIC and HEIF are not supported. Use PDF, JPG, PNG, or WebP.",
    };
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
      error: "That file is larger than 10 MiB. Choose a smaller estimate file.",
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

  if (!isValidLeadName(values.firstName)) {
    errors.firstName = "Enter your first name (2–100 characters).";
  }
  if (!isValidLeadEmail(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!isValidLeadPhone(values.phone)) {
    errors.phone = "Enter a valid 10-digit phone number.";
  }

  return errors;
}

export const LEAD_FIELD_ORDER: LeadFieldKey[] = ["firstName", "email", "phone"];

export function firstInvalidLeadField(errors: LeadValidationErrors): LeadFieldKey | null {
  for (const key of LEAD_FIELD_ORDER) {
    if (errors[key]) return key;
  }
  return null;
}
