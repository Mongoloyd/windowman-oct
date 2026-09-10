const DEFAULT_FUNCTION_URL =
  "https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/capture-quote-education-demo-lead";

const previewBaseUrl = process.env.PREVIEW_BASE_URL;
const functionUrl = process.env.FUNCTION_URL || DEFAULT_FUNCTION_URL;
const maxAttempts = Number.parseInt(process.env.MAX_ATTEMPTS || "24", 10);
const retryDelayMs = Number.parseInt(process.env.RETRY_DELAY_MS || "10000", 10);

if (!previewBaseUrl) {
  throw new Error("PREVIEW_BASE_URL is required.");
}

if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
  throw new Error("MAX_ATTEMPTS must be a positive integer.");
}

if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) {
  throw new Error("RETRY_DELAY_MS must be a non-negative integer.");
}

const previewUrl = new URL(previewBaseUrl);
const requestedHeaders = [
  "apikey",
  "authorization",
  "content-type",
  "x-client-info",
];

const wait = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

async function withRetry(label, operation) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${label} attempt ${attempt}/${maxAttempts} failed: ${message}`);

      if (attempt < maxAttempts) {
        await wait(retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function checkPreviewRoute(pathname) {
  const url = new URL(pathname, previewUrl);
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  await response.body?.cancel();
  console.log(`Preview route OK: ${url} (HTTP ${response.status})`);
}

function commaSeparatedHeader(response, name) {
  return (response.headers.get(name) || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function checkFunctionPreflight() {
  const response = await fetch(functionUrl, {
    method: "OPTIONS",
    headers: {
      Origin: previewUrl.origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": requestedHeaders.join(","),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`${functionUrl} returned HTTP ${response.status}`);
  }

  const allowedOrigin = response.headers.get("access-control-allow-origin");
  if (allowedOrigin !== "*" && allowedOrigin !== previewUrl.origin) {
    throw new Error(
      `Unexpected access-control-allow-origin: ${allowedOrigin || "missing"}`,
    );
  }

  const allowedMethods = commaSeparatedHeader(
    response,
    "access-control-allow-methods",
  ).map((value) => value.toUpperCase());
  for (const method of ["POST", "OPTIONS"]) {
    if (!allowedMethods.includes(method)) {
      throw new Error(`Missing allowed method: ${method}`);
    }
  }

  const allowedHeaders = commaSeparatedHeader(
    response,
    "access-control-allow-headers",
  );
  for (const header of requestedHeaders) {
    if (!allowedHeaders.includes(header)) {
      throw new Error(`Missing allowed header: ${header}`);
    }
  }

  await response.body?.cancel();
  console.log(
    `Quote education preflight OK: ${functionUrl} ` +
      `(HTTP ${response.status}, origin ${previewUrl.origin})`,
  );
}

await withRetry("NQ3 preview", () => checkPreviewRoute("/nq3"));
await withRetry("NQ4 preview", () => checkPreviewRoute("/nq4"));
await withRetry("Quote education CORS preflight", checkFunctionPreflight);
