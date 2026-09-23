import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { AppRole } from "../_shared/adminAuth.ts";
import {
  handleMetaIntakeReplayRequest,
  type MetaIntakeReplayDependencies,
} from "./handler.ts";

type RecordedOperation = {
  kind: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  table: string;
  filters: Record<string, unknown>;
  payload?: unknown;
};

type FakeDatabaseOptions = {
  match?: (table: string, filters: Record<string, unknown>) => unknown;
};

function createFakeDatabase(options: FakeDatabaseOptions = {}) {
  const operations: RecordedOperation[] = [];

  class Query {
    private kind: RecordedOperation["kind"] = "select";
    private filters: Record<string, unknown> = {};
    private payload: unknown;

    constructor(private readonly table: string) {}

    select(_columns: string) {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value;
      return this;
    }

    order(_column: string, _options: { ascending: boolean }) {
      return this;
    }

    limit(_limit: number) {
      return this;
    }

    upsert(payload: unknown, _options: { onConflict: string }) {
      this.kind = "upsert";
      this.payload = payload;
      return this;
    }

    insert(payload: unknown) {
      this.kind = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: unknown) {
      this.kind = "update";
      this.payload = payload;
      return this;
    }

    delete() {
      this.kind = "delete";
      return this;
    }

    maybeSingle() {
      operations.push({
        kind: "select",
        table: this.table,
        filters: { ...this.filters },
      });
      return Promise.resolve({
        data: options.match?.(this.table, this.filters) ?? null,
        error: null,
      });
    }

    single() {
      operations.push({
        kind: this.kind,
        table: this.table,
        filters: { ...this.filters },
        payload: this.payload,
      });
      return Promise.resolve({
        data: {
          id: 1,
          ...(this.payload as Record<string, unknown>),
          created_at: "2026-09-04T12:00:00.000Z",
          updated_at: "2026-09-04T12:00:00.000Z",
        },
        error: null,
      });
    }
  }

  const client = {
    from(table: string) {
      return new Query(table);
    },
    rpc(name: string, payload: Record<string, unknown>) {
      operations.push({ kind: "rpc", table: name, filters: {}, payload });
      return Promise.resolve({
        data: {
          id: 1,
          form_id: payload.p_form_id,
          question_label: payload.p_question_label,
          mapping_action: payload.p_mapping_action,
          canonical_key: payload.p_canonical_key,
        },
        error: null,
      });
    },
  } as unknown as SupabaseClient;

  return { client, operations };
}

function authorizeAs(
  role: AppRole,
  client: SupabaseClient,
  seenRoles: AppRole[][] = [],
): NonNullable<MetaIntakeReplayDependencies["authorize"]> {
  return (_req, requiredRoles) => {
    seenRoles.push([...requiredRoles]);
    if (!requiredRoles.includes(role)) {
      return Promise.resolve({
        ok: false,
        response: new Response(
          JSON.stringify({ ok: false, code: "insufficient_role" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      });
    }
    return Promise.resolve({
      ok: true,
      email: "admin@example.com",
      userId: "admin-1",
      role,
      supabaseAdmin: client,
      supabaseAuth: client,
    });
  };
}

function post(body: Record<string, unknown>) {
  return new Request("https://example.test/meta-intake-replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fixture() {
  return {
    id: "lead-1",
    form_id: "form-1",
    field_data: [
      { name: "email", values: ["lead@example.com"] },
      { name: "full_name", values: ["Test Lead"] },
      { name: "opening_bucket", values: ["1-5"] },
    ],
  };
}

Deno.test("analyze allows viewers and performs read-only dedup checks", async () => {
  const { client, operations } = createFakeDatabase();
  const seenRoles: AppRole[][] = [];

  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "analyze",
      fixture: fixture(),
    }),
    { authorize: authorizeAs("viewer", client, seenRoles) },
  );

  assertEquals(response.status, 200);
  assertEquals(seenRoles, [["super_admin", "operator", "viewer"]]);
  const body = await response.json();
  assertEquals(body.result.dedup_decision, {
    action: "create",
    reason: "no_existing_identity_match",
  });
  assertEquals(body.result.is_test, true);
  assertEquals(body.result.lead_persistence_suppressed, true);
  assertEquals(body.result.calling_suppressed, true);
  assertEquals(body.result.crm_delivery_suppressed, true);
  assertEquals(body.result.writes_performed, []);
  assertEquals(body.result.can_save_mappings, false);
  assertEquals(body.result.unknown_fields[0].original_key, "opening_bucket");
  assert(operations.length > 0);
  assert(operations.every((operation) => operation.kind === "select"));
  assertEquals(
    operations.some((operation) =>
      operation.table === "field_mapping_overrides"
    ),
    false,
  );
});

// Zero-write guarantee: analyze may query dedup sources, but every mutation
// method is instrumented so a future lead/call/CRM write fails this test.
Deno.test("analyze performs no insert, update, delete, or upsert on any table", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({ action: "analyze", fixture: fixture() }),
    { authorize: authorizeAs("operator", client) },
  );

  assertEquals(response.status, 200);
  assert(operations.length > 0);
  assert(operations.every((operation) => operation.kind === "select"));
  assertEquals(
    operations.some((operation) =>
      [
        "voice_followups",
        "webhook_deliveries",
        "field_mapping_overrides",
      ].includes(operation.table)
    ),
    false,
  );
});

// Role-based access is enforced by the same server-side authorizer used by
// other admin Edge Functions; browser route state is not authorization.
Deno.test("viewer, operator, and super_admin can analyze fixtures", async () => {
  for (const role of ["viewer", "operator", "super_admin"] as const) {
    const { client } = createFakeDatabase();
    const response = await handleMetaIntakeReplayRequest(
      post({ action: "analyze", fixture: fixture() }),
      { authorize: authorizeAs(role, client) },
    );
    assertEquals(response.status, 200, `${role} should be allowed to analyze`);
  }
});

Deno.test("unauthenticated analyze is rejected before database access", async () => {
  const { operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({ action: "analyze", fixture: fixture() }),
    {
      authorize: () =>
        Promise.resolve({
          ok: false,
          response: new Response(
            JSON.stringify({ ok: false, code: "unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          ),
        }),
    },
  );

  assertEquals(response.status, 401);
  assertEquals((await response.json()).code, "unauthorized");
  assertEquals(operations, []);
});

Deno.test("dedup reports update without exposing an internal lead id", async () => {
  const { client } = createFakeDatabase({
    match: (table) =>
      table === "lead_attribution_details"
        ? { lead_id: "private-lead-id" }
        : null,
  });
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "analyze",
      fixture: {
        id: "lead-1",
        field_data: [{ name: "phone", values: ["+15555550123"] }],
      },
    }),
    { authorize: authorizeAs("operator", client) },
  );

  const body = await response.json();
  assertEquals(body.result.dedup_decision, {
    action: "update",
    reason: "platform_lead_id_match",
  });
  const serialized = JSON.stringify(body);
  assertEquals(serialized.includes("private-lead-id"), false);
  assertEquals(serialized.includes("full_json"), false);
  assertEquals(serialized.includes("raw_payload"), false);
});

Deno.test("new leadgen id returns create with a reason", async () => {
  const { client } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({ action: "analyze", fixture: fixture() }),
    { authorize: authorizeAs("operator", client) },
  );

  assertEquals(response.status, 200);
  assertEquals((await response.json()).result.dedup_decision, {
    action: "create",
    reason: "no_existing_identity_match",
  });
});

Deno.test("a leadgen-only callback reports missing_field_data without Graph access", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "analyze",
      fixture: {
        object: "page",
        entry: [{
          changes: [{
            field: "leadgen",
            value: { leadgen_id: "lead-only", form_id: "form-only" },
          }],
        }],
      },
    }),
    { authorize: authorizeAs("operator", client) },
  );

  assertEquals(response.status, 400);
  assertEquals((await response.json()).code, "missing_field_data");
  assertEquals(operations, []);
});

// Input validation rejects structurally unusable fixtures before dedup reads.
Deno.test("malformed JSON returns a clear 400 before authorization", async () => {
  const response = await handleMetaIntakeReplayRequest(
    new Request("https://example.test/meta-intake-replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ malformed",
    }),
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.ok, false);
  assertEquals(body.code, "invalid_json");
  assertEquals(body.error, "Request body must be valid UTF-8 JSON.");
});

Deno.test("empty and non-array field_data return specific 400 errors", async () => {
  for (
    const [fieldData, code, error] of [
      [[], "empty_field_data", "field_data must contain at least one field."],
      [
        { email: "lead@example.com" },
        "invalid_field_data",
        "field_data must be an array.",
      ],
    ] as const
  ) {
    const { client, operations } = createFakeDatabase();
    const response = await handleMetaIntakeReplayRequest(
      post({
        action: "analyze",
        fixture: { id: "lead-invalid", field_data: fieldData },
      }),
      { authorize: authorizeAs("operator", client) },
    );

    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.code, code);
    assertEquals(body.error, error);
    assertEquals(operations, []);
  }
});

Deno.test("missing leadgen id stays analyzable but produces a read-only reject decision", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "analyze",
      fixture: [{ name: "email", values: ["lead@example.com"] }],
      form_id: "form-array",
    }),
    { authorize: authorizeAs("operator", client) },
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.result.validation_errors, ["platform_lead_id_required"]);
  assertEquals(body.result.dedup_decision, {
    action: "reject",
    reason: "platform_lead_id_required",
  });
  assertEquals(operations, []);
});

Deno.test("viewer cannot save mapping decisions", async () => {
  const { client, operations } = createFakeDatabase();
  const seenRoles: AppRole[][] = [];
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "save_mapping",
      form_id: "form-1",
      question_label: "How many openings?",
      mapping_action: "map",
      canonical_key: "qualification_openings",
    }),
    { authorize: authorizeAs("viewer", client, seenRoles) },
  );

  assertEquals(response.status, 403);
  assertEquals(seenRoles, [["super_admin", "operator"]]);
  assertEquals(operations, []);
});

Deno.test("operator saves an allowlisted mapping through the atomic RPC", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "save_mapping",
      form_id: "form-1",
      question_label: "How many openings?",
      mapping_action: "map",
      canonical_key: "qualification_openings",
    }),
    { authorize: authorizeAs("operator", client) },
  );

  assertEquals(response.status, 200);
  assertEquals(operations, [{
    kind: "rpc",
    table: "meta_save_form_mapping",
    filters: {},
    payload: {
      p_form_id: "form-1",
      p_question_label: "How many openings?",
      p_mapping_action: "map",
      p_canonical_key: "qualification_openings",
    },
  }]);
});

Deno.test("operator can store an ignore decision without a canonical key", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "save_mapping",
      form_id: "form-1",
      question_label: "Unneeded detail",
      mapping_action: "ignore",
      canonical_key: "qualification_openings",
    }),
    { authorize: authorizeAs("operator", client) },
  );

  assertEquals(response.status, 200);
  assertEquals(operations, [{
    kind: "rpc",
    table: "meta_save_form_mapping",
    filters: {},
    payload: {
      p_form_id: "form-1",
      p_question_label: "Unneeded detail",
      p_mapping_action: "ignore",
      p_canonical_key: null,
    },
  }]);
});

Deno.test("super_admin can save an allowlisted mapping", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "save_mapping",
      form_id: "form-super",
      question_label: "Preferred contact time?",
      mapping_action: "ignore",
    }),
    { authorize: authorizeAs("super_admin", client) },
  );

  assertEquals(response.status, 200);
  assertEquals(operations[0].kind, "rpc");
  assertEquals(operations[0].table, "meta_save_form_mapping");
});

Deno.test("non-allowlisted canonical destinations are rejected before write", async () => {
  const { client, operations } = createFakeDatabase();
  const response = await handleMetaIntakeReplayRequest(
    post({
      action: "save_mapping",
      form_id: "form-1",
      question_label: "Unsafe field",
      mapping_action: "map",
      canonical_key: "phone_verified",
    }),
    { authorize: authorizeAs("super_admin", client) },
  );

  assertEquals(response.status, 400);
  assertEquals((await response.json()).code, "invalid_canonical_key");
  assertEquals(operations, []);
});
