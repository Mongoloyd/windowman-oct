import {
  buildStoredDemoMetadata,
  FIXTURE_ID,
  HANDOFF_VERSION,
  parseAction,
  parseCampaignHandoff,
  parseCreateMetadata,
} from "./contract.ts";

Deno.test("accepts only the sibling action contract", () => {
  for (
    const action of ["create", "update_zip", "update_phone", "update_intake"]
  ) {
    if (!parseAction(action)) {
      throw new Error(`expected ${action} to be accepted`);
    }
  }
  if (parseAction("update_identity") !== null) {
    throw new Error("unexpected action accepted");
  }
});

Deno.test("requires an allowlisted variant, fixture, host and entry point", () => {
  const valid = parseCreateMetadata({
    variant: "lens",
    fixture_id: FIXTURE_ID,
    host_page: "/nq3",
    entry_point: "nq3_hero_quote_lens",
  });
  if (!valid.ok || valid.value.hostPage !== "/nq3") {
    throw new Error("valid metadata rejected");
  }

  const missingHost = parseCreateMetadata({
    variant: "lens",
    fixture_id: FIXTURE_ID,
    entry_point: "nq3_hero_quote_lens",
  });
  if (missingHost.ok || missingHost.code !== "invalid_host_page") {
    throw new Error("missing host_page was not rejected cleanly");
  }

  for (
    const body of [
      {
        variant: "other",
        fixture_id: FIXTURE_ID,
        host_page: "/nq3",
        entry_point: "entry",
      },
      {
        variant: "lens",
        fixture_id: "other",
        host_page: "/nq3",
        entry_point: "entry",
      },
      {
        variant: "lens",
        fixture_id: FIXTURE_ID,
        host_page: "/admin",
        entry_point: "entry",
      },
      {
        variant: "lens",
        fixture_id: FIXTURE_ID,
        host_page: "/nq3",
        entry_point: "bad/entry",
      },
    ]
  ) {
    if (parseCreateMetadata(body).ok) {
      throw new Error("invalid metadata accepted");
    }
  }
});

Deno.test("server metadata overrides forged demo values and strips PII", () => {
  const parsed = parseCreateMetadata({
    variant: "challenge",
    fixture_id: FIXTURE_ID,
    host_page: "/nq4",
    entry_point: "nq4_hero_quote_challenge",
  });
  if (!parsed.ok) throw new Error("fixture rejected");
  const stored = buildStoredDemoMetadata({
    query_params: {
      utm_source: "paid",
      email: "private@example.test",
      synthetic_demo_variant: "forged",
    },
    attribution: {
      referrer: "https://example.test/private@example.test",
      gclid: "click-1",
      synthetic_demo_host_path: "/forged",
    },
  }, parsed.value);
  if (stored.queryParams.synthetic_demo_variant !== "challenge") {
    throw new Error("variant not server-owned");
  }
  if (stored.attribution.synthetic_demo_host_path !== "/nq4") {
    throw new Error("host not server-owned");
  }
  if (JSON.stringify(stored).includes("private@example.test")) {
    throw new Error("PII crossed metadata boundary");
  }
  if (stored.attribution.gclid !== "click-1") {
    throw new Error("approved attribution lost");
  }
});

Deno.test("validates the NQ handoff without free-form or partial values", () => {
  const quoteHolder = parseCampaignHandoff({
    handoff_version: HANDOFF_VERSION,
    source_path: "/nq3",
    wm_intent: "has_quote",
  });
  if (!quoteHolder.ok || quoteHolder.value?.wm_intent !== "has_quote") {
    throw new Error("quote handoff rejected");
  }

  const noQuote = parseCampaignHandoff({
    handoff_version: HANDOFF_VERSION,
    source_path: "/nq4",
    wm_intent: "no_quote",
    product_scope: "Impact windows",
    openings_bucket: "6–10",
    campaign_timing: "1–3 months",
  });
  if (!noQuote.ok || noQuote.value?.openings_bucket !== "6–10") {
    throw new Error("no-quote handoff rejected");
  }

  for (
    const invalid of [
      {
        handoff_version: HANDOFF_VERSION,
        source_path: "/nq4",
        wm_intent: "no_quote",
      },
      {
        handoff_version: HANDOFF_VERSION,
        source_path: "/nq4",
        wm_intent: "has_quote",
        product_scope: "Impact windows",
      },
      {
        handoff_version: HANDOFF_VERSION,
        source_path: "/nq4",
        wm_intent: "has_quote",
        note: "call me",
      },
    ]
  ) {
    if (parseCampaignHandoff(invalid).ok) {
      throw new Error("invalid handoff accepted");
    }
  }
});
