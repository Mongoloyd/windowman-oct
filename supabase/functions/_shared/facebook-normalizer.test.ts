import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  FACEBOOK_CANONICAL_MAPPING_OPTIONS,
  inspectFacebookPayload,
  normalizePayload,
  prepareFacebookReplayFixture,
} from "./facebook-normalizer.ts";

function inspectFields(fieldData: unknown[]) {
  return inspectFacebookPayload({
    id: "lead-edge-cases",
    form_id: "form-edge-cases",
    field_data: fieldData,
  });
}

Deno.test("normalizePayload preserves the existing Facebook importer contract", () => {
  const body = {
    platform_lead_id: "lead-123",
    campaign_id: "campaign-1",
    campaign_name: "Fall Campaign",
    adset_id: "adset-1",
    ad_id: "ad-1",
    form_id: "form-1",
    created_time: "2026-09-04T12:00:00+0000",
    client_slug: "direct-client",
    county: "Miami-Dade",
    field_data: [
      { name: "email", values: [" LEAD@Example.com "] },
      { name: "phone_number", values: ["(555) 555-0123"] },
      { name: "full_name", values: ["Ada Lovelace"] },
    ],
  };

  const result = normalizePayload(body);
  assert(result.ok);
  if (!result.ok) return;

  assertEquals(result.payload.platformLeadId, "lead-123");
  assertEquals(result.payload.sourcePlatform, "facebook");
  assertEquals(result.payload.sourceChannel, "lead_ads");
  assertEquals(result.payload.sourceDetail, "facebook_lead_ads");
  assertEquals(result.payload.email, "lead@example.com");
  assertEquals(result.payload.phoneE164, "+15555550123");
  assertEquals(result.payload.fullName, "Ada Lovelace");
  assertEquals(result.payload.firstName, "Ada");
  assertEquals(result.payload.lastName, "Lovelace");
  assertEquals(result.payload.county, "Miami-Dade");
  assertEquals(result.payload.utmSource, "facebook");
  assertEquals(result.payload.utmMedium, "lead_ad");
  assertEquals(result.payload.platformCreatedTime, "2026-09-04T12:00:00.000Z");
  assertEquals(result.payload.rawPayload, body);
});

// Field alias normalization: these aliases feed both the live importer and replay.
Deno.test("email aliases normalize casing and punctuation to email", () => {
  for (const alias of ["email_address", "Email", "E-MAIL"]) {
    const inspection = inspectFields([
      { name: alias, values: [" LEAD@Example.COM "] },
    ]);

    assertEquals(inspection.unknown_fields, []);
    assertEquals(inspection.normalized_lead.email, "lead@example.com");
    assertEquals(inspection.recognized_fields[0].canonical_key, "email");
    assertEquals(
      inspection.recognized_fields[0].sanitized_value,
      "lead@example.com",
    );
  }
});

Deno.test("phone aliases normalize to phone_e164", () => {
  for (
    const alias of ["phone_number", "mobile_phone", "best_phone_number"]
  ) {
    const inspection = inspectFields([
      { name: alias, values: ["(555) 555-0123"] },
    ]);

    assertEquals(inspection.unknown_fields, []);
    assertEquals(inspection.normalized_lead.phone_e164, "+15555550123");
    assertEquals(inspection.recognized_fields[0].canonical_key, "phone_e164");
    assertEquals(
      inspection.recognized_fields[0].sanitized_value,
      "+15555550123",
    );
  }
});

Deno.test("known field keys tolerate uppercase, separators, and surrounding whitespace", () => {
  const inspection = inspectFields([
    { name: "  EMAIL  ", values: ["lead@example.com"] },
    { name: " Full-Name ", values: ["Grace Hopper"] },
    { name: " BEST PHONE NUMBER ", values: ["555 555 0123"] },
  ]);

  assertEquals(inspection.unknown_fields, []);
  assertEquals(inspection.normalized_lead.first_name, "Grace");
  assertEquals(inspection.normalized_lead.last_name, "Hopper");
  assertEquals(inspection.normalized_lead.phone_e164, "+15555550123");
});

// Missing required field detection remains descriptive; import validity still
// requires at least one of phone or email, while the lab reports each gap.
Deno.test("name with no phone or email flags both missing contact fields", () => {
  const inspection = inspectFields([
    { name: "full_name", values: ["Test Lead"] },
  ]);

  assertEquals(inspection.missing_required_fields, ["phone", "email"]);
  assertEquals(inspection.validation_errors, ["email_or_phone_required"]);
});

Deno.test("phone without email flags only email", () => {
  const inspection = inspectFields([
    { name: "full_name", values: ["Test Lead"] },
    { name: "phone", values: ["+15555550123"] },
  ]);

  assertEquals(inspection.missing_required_fields, ["email"]);
  assertEquals(inspection.validation_errors, []);
});

Deno.test("email without phone flags only phone", () => {
  const inspection = inspectFields([
    { name: "full_name", values: ["Test Lead"] },
    { name: "email", values: ["lead@example.com"] },
  ]);

  assertEquals(inspection.missing_required_fields, ["phone"]);
  assertEquals(inspection.validation_errors, []);
});

Deno.test("name, phone, and email produce no missing required fields", () => {
  const inspection = inspectFields([
    { name: "full_name", values: ["Test Lead"] },
    { name: "phone", values: ["+15555550123"] },
    { name: "email", values: ["lead@example.com"] },
  ]);

  assertEquals(inspection.missing_required_fields, []);
});

// Unknown field preservation lets admins map new Meta questions without
// contaminating the canonical lead preview.
Deno.test("unknown fields preserve their original key and raw value but stay out of normalized_lead", () => {
  const inspection = inspectFields([
    { name: "email", values: ["lead@example.com"] },
    {
      name: "Favorite_Window_Color",
      label: "Favorite window color?",
      values: ["Bronze", "Black"],
    },
  ]);

  assertEquals(inspection.unknown_fields, [{
    original_key: "Favorite_Window_Color",
    question_label: "Favorite window color?",
    original_value: ["Bronze", "Black"],
  }]);
  assertEquals(
    Object.hasOwn(inspection.normalized_lead, "Favorite_Window_Color"),
    false,
  );
  assertEquals(
    Object.hasOwn(inspection.normalized_lead, "favorite_window_color"),
    false,
  );
});

// Invalid values on a recognized email key stay recognized, sanitize to null,
// and are reported as missing rather than being reclassified as an unknown key.
Deno.test("invalid email sanitizes to null and is reported missing", () => {
  const inspection = inspectFields([
    { name: "full_name", values: ["Test Lead"] },
    { name: "phone", values: ["+15555550123"] },
    { name: "Email", values: ["not-an-email"] },
  ]);

  assertEquals(inspection.normalized_lead.email, null);
  assertEquals(inspection.missing_required_fields, ["email"]);
  assertEquals(inspection.unknown_fields, []);
  assertEquals(
    inspection.recognized_fields.find((field) =>
      field.canonical_key === "email"
    )
      ?.sanitized_value,
    null,
  );
});

Deno.test("inspection separates recognized fields from unknown qualification questions", () => {
  const inspection = inspectFacebookPayload({
    id: "lead-456",
    form_id: "form-9",
    field_data: [
      { name: "email", values: ["homeowner@example.com"] },
      { name: "full_name", values: ["Home Owner"] },
      {
        name: "how_many_openings",
        label: "How many openings?",
        values: ["6-10"],
      },
    ],
  });

  assertEquals(inspection.recognized_fields, [
    {
      original_key: "email",
      question_label: "email",
      canonical_key: "email",
      sanitized_value: "homeowner@example.com",
    },
    {
      original_key: "full_name",
      question_label: "full_name",
      canonical_key: "first_name + last_name",
      sanitized_value: "Home Owner",
    },
  ]);
  assertEquals(inspection.unknown_fields, [
    {
      original_key: "how_many_openings",
      question_label: "How many openings?",
      original_value: ["6-10"],
    },
  ]);
  assertEquals(inspection.missing_required_fields, ["phone"]);
  assertEquals(inspection.validation_errors, []);
  assertEquals(inspection.normalized_lead.first_name, "Home");
  assertEquals(inspection.normalized_lead.last_name, "Owner");
  assertEquals(inspection.normalized_lead.window_count, undefined);
});

Deno.test("raw field_data can be inspected without fabricating a lead ID", () => {
  const prepared = prepareFacebookReplayFixture(
    [{ name: "email", values: ["lead@example.com"] }],
    "form-manual",
  );
  assert(prepared.ok);
  if (!prepared.ok) return;

  const inspection = inspectFacebookPayload(prepared.fixture.body);
  assertEquals(prepared.fixture.source_shape, "field_data_array");
  assertEquals(inspection.form_id, "form-manual");
  assertEquals(inspection.platform_lead_id, null);
  assertEquals(inspection.validation_errors, ["platform_lead_id_required"]);
});

Deno.test("an enriched webhook fixture is flattened without calling Meta", () => {
  const prepared = prepareFacebookReplayFixture({
    object: "page",
    entry: [{
      changes: [{
        field: "leadgen",
        value: {
          leadgen_id: "lead-nested",
          form_id: "form-nested",
          field_data: [{ name: "phone", values: ["+15555550123"] }],
        },
      }],
    }],
  });
  assert(prepared.ok);
  if (!prepared.ok) return;

  assertEquals(prepared.fixture.source_shape, "nested_object");
  const normalized = normalizePayload(prepared.fixture.body);
  assert(normalized.ok);
  if (normalized.ok) {
    assertEquals(normalized.payload.platformLeadId, "lead-nested");
    assertEquals(normalized.payload.formId, "form-nested");
  }
});

Deno.test("a standard leadgen callback without field_data fails closed", () => {
  const prepared = prepareFacebookReplayFixture({
    object: "page",
    entry: [{
      changes: [{
        field: "leadgen",
        value: { leadgen_id: "lead-only", form_id: "form-only" },
      }],
    }],
  });

  assertEquals(prepared, { ok: false, error: "missing_field_data" });
});

Deno.test("empty and non-array field_data are rejected explicitly", () => {
  assertEquals(
    prepareFacebookReplayFixture({ id: "lead-empty", field_data: [] }),
    { ok: false, error: "empty_field_data" },
  );
  assertEquals(
    prepareFacebookReplayFixture({
      id: "lead-invalid",
      field_data: { email: "lead@example.com" },
    }),
    { ok: false, error: "invalid_field_data" },
  );
});

Deno.test("mapping options reserve bucket answers for qualification_openings", () => {
  const keys = FACEBOOK_CANONICAL_MAPPING_OPTIONS.map((option) =>
    option.canonical_key
  );
  assert(keys.includes("qualification_openings"));
  assertEquals(keys.includes("window_count" as never), false);
});
