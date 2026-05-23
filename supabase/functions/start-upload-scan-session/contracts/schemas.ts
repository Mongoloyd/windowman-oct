// supabase/functions/start-upload-scan-session/contracts/schemas.ts
//
// Single source of truth for the request/response wire contract of the
// `start-upload-scan-session` Edge Function.
//
// These schemas are intentionally strict:
//   - `.strict()` rejects unknown properties so a drifted frontend caller
//     fails fast instead of silently dropping fields.
//   - All IDs are validated as RFC-4122 UUIDs.
//   - `storage_path` is shape-checked here; the cross-field scope rule
//     (must start with `${session_id}/...`) is enforced via superRefine.
//   - The response is a discriminated union so a `success: true` envelope
//     can never accidentally carry an error `code`, and vice versa.
//
// Nothing in this file performs I/O. It is import-safe from both the
// handler (`index.ts`) and the Deno test file (`schemas.test.ts`).

import { z } from "npm:zod@3.23.8";

// ── Primitives ─────────────────────────────────────────────────────────────
export const UUID = z.string().uuid();

const StoragePathString = z
  .string()
  .min(1, "storage_path is required")
  .max(1024, "storage_path exceeds 1024 chars");

const FileName = z.string().min(1).max(512).nullish();
const FileSize = z.number().int().nonnegative().nullish();
const FileType = z.string().max(128).nullish();

// ── Request ────────────────────────────────────────────────────────────────
export const RequestSchema = z
  .object({
    session_id: UUID,
    storage_path: StoragePathString,
    file_name: FileName,
    file_size: FileSize,
    file_type: FileType,
  })
  .strict()
  .superRefine((val, ctx) => {
    const sp = val.storage_path;
    if (sp.startsWith("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "leading_slash",
      });
    }
    if (sp.includes("//")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "double_slash",
      });
    }
    if (sp.includes("../") || sp.includes("..\\")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "path_traversal",
      });
    }
    const prefix = `${val.session_id}/`;
    if (!sp.startsWith(prefix)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "prefix_mismatch",
      });
      return;
    }
    const remainder = sp.slice(prefix.length);
    if (remainder.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "empty_filename",
      });
    } else if (remainder.endsWith("/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "trailing_slash",
      });
    } else if (remainder.split("/").some((s) => s.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storage_path"],
        message: "empty_segment",
      });
    }
  });

export type BootstrapRequest = z.infer<typeof RequestSchema>;

// ── Response ───────────────────────────────────────────────────────────────
// Mirrors every `code` literal currently emitted by the handler. Adding a
// new error path requires extending this enum first — that is the contract.
export const ErrorCode = z.enum([
  "invalid_json",
  "invalid_payload",
  "storage_path_scope_mismatch",
  "storage_object_missing",
  "method_not_allowed",
  "server_misconfigured",
  "lead_create_failed",
  "quote_file_create_failed",
  "scan_session_create_failed",
  "unexpected_error",
]);
export type BootstrapErrorCode = z.infer<typeof ErrorCode>;

export const SuccessResponseSchema = z
  .object({
    success: z.literal(true),
    scan_session_id: UUID,
    quote_file_id: UUID,
    lead_id: UUID,
  })
  .strict();
export type BootstrapSuccess = z.infer<typeof SuccessResponseSchema>;

export const ErrorResponseSchema = z
  .object({
    success: z.literal(false),
    code: ErrorCode,
    message: z.string().min(1),
    details: z.unknown().optional(),
  })
  .strict();
export type BootstrapError = z.infer<typeof ErrorResponseSchema>;

export const ResponseSchema = z.discriminatedUnion("success", [
  SuccessResponseSchema,
  ErrorResponseSchema,
]);
export type BootstrapResponse = z.infer<typeof ResponseSchema>;
