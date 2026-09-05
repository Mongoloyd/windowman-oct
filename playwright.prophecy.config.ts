import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || "http://127.0.0.1:8080";

// The Prophecy suite is state-changing. For the default local run, expose the
// same Vite URL that `npm run dev:all` reads so the spec can prove the target
// before it submits anything. Remote previews must provide an explicit URL.
if (!externalBaseURL) {
  const localEnv = loadEnv("development", process.cwd(), "");
  if (localEnv.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = localEnv.VITE_SUPABASE_URL;
    process.env.SUPABASE_URL = localEnv.VITE_SUPABASE_URL;
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
  testMatch: "prophecy-funnel.spec.ts",
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
