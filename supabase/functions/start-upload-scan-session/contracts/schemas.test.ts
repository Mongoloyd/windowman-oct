// supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
//
// Pure Deno contract tests for the start-upload-scan-session wire shapes.
// No network, no env, no DB. These tests only exercise zod parse/safeParse
// against the schemas in ./schemas.ts.
//
// Run via: deno test supabase/functions/start-upload-scan-session/contracts/

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  ErrorResponseSchema,
  RequestSchema,
  ResponseSchema,
  SuccessResponseSchema,
} from "./schemas.ts";

const SESSION_ID = "11111111-2222-3333-4444-555555555555";
const SECOND_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const THIRD_UUID = "99999999-8888-7777-6666-555555555555";

const validBody = (over: Record<string, unknown> = {}) => ({
  session_id: SESSION_ID,
  storage_path: `${SESSION_ID}/file.pdf`,
  ...over,
});

// ── Request: VALID ─────────────────────────────────────────────────────────

Deno.test("RequestSchema accepts minimal valid body", () => {
  const r = RequestSchema.safeParse(validBody());
  assert(r.success, JSON.stringify(r));
});

Deno.test("RequestSchema accepts full valid body with all optional fields", () => {
  const r = RequestSchema.safeParse(
    validBody({
      file_name: "quote.pdf",
      file_size: 12345,
      file_type: "application/pdf",
    }),
  );
  assert(r.success, JSON.stringify(r));
});

Deno.test("RequestSchema accepts explicit nulls on optional fields", () => {
  const r = RequestSchema.safeParse(
    validBody({ file_name: null, file_size: null, file_type: null }),
  );
  assert(r.success, JSON.stringify(r));
});

Deno.test("RequestSchema accepts nested folder in storage_path", () => {
  const r = RequestSchema.safeParse(
    validBody({ storage_path: `${SESSION_ID}/sub/file.pdf` }),
  );
  assert(r.success, JSON.stringify(r));
});

// ── Request: INVALID ───────────────────────────────────────────────────────

const expectIssuePath = (
  parsed: ReturnType<typeof RequestSchema.safeParse>,
  path: string,
) => {
  assert(!parsed.success);
  if (!parsed.success) {
    assert(
      parsed.error.issues.some((i) => i.path.join(".") === path),
      `Expected issue on path "${path}". Got: ${
        JSON.stringify(parsed.error.issues)
      }`,
    );
  }
};

Deno.test("rejects missing session_id", () => {
  const { session_id: _omit, ...rest } = validBody();
  expectIssuePath(RequestSchema.safeParse(rest), "session_id");
});

Deno.test("rejects non-uuid session_id", () => {
  expectIssuePath(
    RequestSchema.safeParse(validBody({ session_id: "not-a-uuid" })),
    "session_id",
  );
});

Deno.test("rejects missing storage_path", () => {
  const { storage_path: _omit, ...rest } = validBody();
  expectIssuePath(RequestSchema.safeParse(rest), "storage_path");
});

Deno.test("rejects storage_path over 1024 chars", () => {
  const long = `${SESSION_ID}/${"a".repeat(2000)}`;
  expectIssuePath(
    RequestSchema.safeParse(validBody({ storage_path: long })),
    "storage_path",
  );
});

Deno.test("rejects storage_path with leading slash", () => {
  expectIssuePath(
    RequestSchema.safeParse(
      validBody({ storage_path: `/${SESSION_ID}/file.pdf` }),
    ),
    "storage_path",
  );
});

Deno.test("rejects storage_path with double slash", () => {
  expectIssuePath(
    RequestSchema.safeParse(
      validBody({ storage_path: `${SESSION_ID}//file.pdf` }),
    ),
    "storage_path",
  );
});

Deno.test("rejects storage_path with path traversal", () => {
  expectIssuePath(
    RequestSchema.safeParse(
      validBody({ storage_path: `${SESSION_ID}/../etc/passwd` }),
    ),
    "storage_path",
  );
});

Deno.test("rejects storage_path not prefixed by session_id", () => {
  expectIssuePath(
    RequestSchema.safeParse(
      validBody({ storage_path: `${SECOND_UUID}/file.pdf` }),
    ),
    "storage_path",
  );
});

Deno.test("rejects storage_path equal to '${session_id}/' (empty filename)", () => {
  expectIssuePath(
    RequestSchema.safeParse(validBody({ storage_path: `${SESSION_ID}/` })),
    "storage_path",
  );
});

Deno.test("rejects negative file_size", () => {
  expectIssuePath(
    RequestSchema.safeParse(validBody({ file_size: -1 })),
    "file_size",
  );
});

Deno.test("rejects non-integer file_size", () => {
  expectIssuePath(
    RequestSchema.safeParse(validBody({ file_size: 12.5 })),
    "file_size",
  );
});

Deno.test("rejects file_type over 128 chars", () => {
  expectIssuePath(
    RequestSchema.safeParse(validBody({ file_type: "a".repeat(200) })),
    "file_type",
  );
});

Deno.test("rejects file_name over 512 chars", () => {
  expectIssuePath(
    RequestSchema.safeParse(validBody({ file_name: "a".repeat(600) })),
    "file_name",
  );
});

Deno.test("rejects unknown property via .strict()", () => {
  const r = RequestSchema.safeParse(validBody({ lead_id: "injected" }));
  assert(!r.success);
});

Deno.test("rejects array body", () => {
  const r = RequestSchema.safeParse([] as unknown);
  assert(!r.success);
});

Deno.test("rejects string body", () => {
  const r = RequestSchema.safeParse("oops" as unknown);
  assert(!r.success);
});

Deno.test("rejects null body", () => {
  const r = RequestSchema.safeParse(null as unknown);
  assert(!r.success);
});

// ── Response: VALID ────────────────────────────────────────────────────────

Deno.test("SuccessResponseSchema accepts well-formed success envelope", () => {
  const r = SuccessResponseSchema.safeParse({
    success: true,
    scan_session_id: SESSION_ID,
    quote_file_id: SECOND_UUID,
    lead_id: THIRD_UUID,
  });
  assert(r.success, JSON.stringify(r));
});

Deno.test("ResponseSchema accepts each known error code", () => {
  const codes = [
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
  ] as const;
  for (const code of codes) {
    const r = ResponseSchema.safeParse({
      success: false,
      code,
      message: "boom",
    });
    assert(r.success, `code=${code} failed: ${JSON.stringify(r)}`);
  }
});

Deno.test("ErrorResponseSchema accepts optional details", () => {
  const r = ErrorResponseSchema.safeParse({
    success: false,
    code: "lead_create_failed",
    message: "Failed to initialize session.",
    details: { code: "23505", message: "duplicate" },
  });
  assert(r.success, JSON.stringify(r));
});

// ── Response: INVALID ──────────────────────────────────────────────────────

Deno.test("Success envelope missing scan_session_id fails", () => {
  const r = SuccessResponseSchema.safeParse({
    success: true,
    quote_file_id: SECOND_UUID,
    lead_id: THIRD_UUID,
  });
  assert(!r.success);
});

Deno.test("Error envelope with unknown code fails enum", () => {
  const r = ResponseSchema.safeParse({
    success: false,
    code: "definitely_not_a_real_code",
    message: "x",
  });
  assert(!r.success);
});

Deno.test("Success envelope rejects extra property via .strict()", () => {
  const r = SuccessResponseSchema.safeParse({
    success: true,
    scan_session_id: SESSION_ID,
    quote_file_id: SECOND_UUID,
    lead_id: THIRD_UUID,
    extra: "nope",
  });
  assert(!r.success);
});

Deno.test("Discriminated union rejects success:true with error code field", () => {
  const r = ResponseSchema.safeParse({
    success: true,
    code: "invalid_payload",
    message: "x",
  });
  assert(!r.success);
});

Deno.test("Error envelope rejects empty message", () => {
  const r = ErrorResponseSchema.safeParse({
    success: false,
    code: "invalid_payload",
    message: "",
  });
  assert(!r.success);
});

// Sanity: the response schema's discriminated union resolves both branches.
Deno.test("ResponseSchema round-trips a success envelope", () => {
  const body = {
    success: true as const,
    scan_session_id: SESSION_ID,
    quote_file_id: SECOND_UUID,
    lead_id: THIRD_UUID,
  };
  assertEquals(ResponseSchema.parse(body), body);
});
