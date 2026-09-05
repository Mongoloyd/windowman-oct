import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || "http://127.0.0.1:8080";

// The Prophecy suite is state-changing. For the default local run, expose the
// same Vite URL that `npm run dev:all` reads so the spec can prove the target
// before it submits anything. Remote previews must provide an explicit URL.
if (!externalBaseURL) {
  const localEnv = loadEnv("development", process.cwd(), "");
  const viteServiceRole = Object.entries(localEnv).some(
    ([key, value]) =>
      /^VITE_.*SERVICE_ROLE/i.test(key) && Boolean(value?.trim()),
  );
  if (viteServiceRole) {
    throw new Error(
      "BLOCKED_UNKNOWN_ENVIRONMENT: service-role credentials must not use VITE_* variables",
    );
  }

  if (localEnv.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = localEnv.VITE_SUPABASE_URL;
    process.env.SUPABASE_URL = localEnv.VITE_SUPABASE_URL;
  }
  for (const key of [
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ] as const) {
    if (localEnv[key]) process.env[key] = localEnv[key];
  }
  const localPublicKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (localPublicKey) {
    process.env.SUPABASE_ANON_KEY = localPublicKey;
  } else {
    delete process.env.SUPABASE_ANON_KEY;
  }

  // Never inherit an unrelated machine-level service-role credential into a
  // local state-changing suite. DB row proof is opt-in with a dedicated local
  // credential; browser traffic never receives it.
  const localServiceRole = process.env.PROPHECY_E2E_LOCAL_SERVICE_ROLE_KEY;
  if (localServiceRole) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = localServiceRole;
  } else {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

export default defineConfig({
  testDir: "./tests",
  testMatch: ["prophecy-funnel.spec.ts", "report-access-security.spec.ts"],
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev:all",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "prophecy-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
