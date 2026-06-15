const ALLOWED_EXACT_ORIGINS = new Set<string>([
  "https://windowman.app",
  "https://windowman.netlify.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);

const NETLIFY_PREVIEW_ORIGIN =
  /^https:\/\/[a-z0-9-]+--windowman\.netlify\.app$/;

const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

export function getOriginFromRequest(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  const trimmed = origin.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin || origin === "null") return false;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  return NETLIFY_PREVIEW_ORIGIN.test(origin);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = getOriginFromRequest(req);
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
