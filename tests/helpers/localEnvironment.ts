import type { Page, Route } from "@playwright/test";

const LOCAL_SUPABASE_ORIGINS = new Set([
  "http://127.0.0.1:54321",
  "http://localhost:54321",
]);

const LOCAL_APP_HOSTS = new Set(["127.0.0.1", "localhost"]);
const SUPABASE_API_PREFIXES = [
  "/auth/v1/",
  "/functions/v1/",
  "/rest/v1/",
  "/storage/v1/",
];

export type LocalEnvironmentProof = {
  appBaseUrl: URL;
  supabaseUrl: URL;
};

type LocalEnvironmentOptions = {
  requireServiceRole?: boolean;
};

function blocked(reason: string): never {
  throw new Error(`BLOCKED_UNKNOWN_ENVIRONMENT: ${reason}`);
}

function requiredUrl(value: string | undefined, label: string): URL {
  const candidate = value?.trim();
  if (!candidate) blocked(`${label} is not set`);

  try {
    return new URL(candidate);
  } catch {
    return blocked(`${label} is not a valid URL`);
  }
}

function assertNoBrowserServiceRole(env: NodeJS.ProcessEnv): void {
  const exposed = Object.entries(env).some(
    ([key, value]) =>
      /^VITE_.*SERVICE_ROLE/i.test(key) && Boolean(value?.trim()),
  );

  if (exposed) {
    blocked("a service-role credential is exposed through a VITE_* variable");
  }
}

/**
 * Positively proves that both the application and Supabase target are local.
 * It never treats a missing variable as permission to continue.
 */
export function assertDisposableLocalEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  options: LocalEnvironmentOptions = {},
): LocalEnvironmentProof {
  assertNoBrowserServiceRole(env);

  const appBaseUrl = requiredUrl(
    env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8080",
    "PLAYWRIGHT_BASE_URL",
  );
  const supabaseUrl = requiredUrl(
    env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    "SUPABASE_URL/VITE_SUPABASE_URL",
  );

  if (!LOCAL_APP_HOSTS.has(appBaseUrl.hostname)) {
    blocked("the application base URL is not loopback");
  }

  if (!LOCAL_SUPABASE_ORIGINS.has(supabaseUrl.origin)) {
    blocked("the Supabase target is not the local CLI instance on port 54321");
  }

  if (
    options.requireServiceRole &&
    !env.PROPHECY_E2E_LOCAL_SERVICE_ROLE_KEY?.trim()
  ) {
    blocked(
      "PROPHECY_E2E_LOCAL_SERVICE_ROLE_KEY is required before a state-changing test",
    );
  }

  return { appBaseUrl, supabaseUrl };
}

function isSupabaseApiRequest(url: URL): boolean {
  return (
    url.hostname.endsWith(".supabase.co") ||
    SUPABASE_API_PREFIXES.some((prefix) => url.pathname.includes(prefix))
  );
}

export type LocalSupabaseFirewall = {
  assertClean: () => void;
  dispose: () => Promise<void>;
};

/**
 * Browser-request backstop. The positive environment proof remains the primary
 * gate; this additionally aborts a late redirect or runtime configuration drift
 * to a non-local Supabase API.
 */
export async function installLocalSupabaseFirewall(
  page: Page,
): Promise<LocalSupabaseFirewall> {
  const violations = new Set<string>();
  const handler = async (route: Route): Promise<void> => {
    const requestUrl = new URL(route.request().url());
    if (
      isSupabaseApiRequest(requestUrl) &&
      !LOCAL_SUPABASE_ORIGINS.has(requestUrl.origin)
    ) {
      violations.add(requestUrl.origin);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  };

  await page.route("**/*", handler);

  return {
    assertClean: () => {
      if (violations.size > 0) {
        blocked("browser attempted to contact a non-local Supabase API");
      }
    },
    dispose: () => page.unroute("**/*", handler),
  };
}
