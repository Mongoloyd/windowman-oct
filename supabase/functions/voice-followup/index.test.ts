import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

const SUPABASE_URL = "https://wkrcyxcnzhwjtdpmfpaf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrcmN5eGNuemh3anRkcG1mcGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTIxMDksImV4cCI6MjA4OTI4ODEwOX0._5MdqzJgBCDaGNvfqPbbrrDxAhM0Th4E9CMa6YL0aww";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/voice-followup`;

Deno.test("voice-followup rejects unauthenticated request", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      scan_session_id: "fake",
      phone_e164: "+10000000000",
    }),
  });
  const body = await res.text();
  assert(
    res.status === 401 || res.status === 403,
    `Expected 401/403 but got ${res.status}: ${body}`,
  );
});

Deno.test("voice-followup CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  // deno-lint-ignore no-unused-vars
  const body = await res.text();
  assertEquals(res.status, 200);
});
