import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ExpectedAuthLinkType = "recovery" | "invite" | "signup" | "magiclink";
type AuthLinkSource = "existing_session" | "pkce_code" | "hash_tokens" | "none";

export interface FinalizeSupabaseAuthLinkOptions {
  expectedType?: ExpectedAuthLinkType;
  cleanUrl?: boolean;
}

export interface FinalizeSupabaseAuthLinkResult {
  ok: boolean;
  session: Session | null;
  type: string | null;
  source: AuthLinkSource;
  error: string | null;
}

const SAFE_SEARCH_PARAMS = new Set(["token", "invite_token", "next"]);
const AUTH_SEARCH_PARAMS = new Set([
  "code",
  "type",
  "error",
  "error_code",
  "error_description",
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
]);

function readHashParams(hash: string): URLSearchParams {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(normalized);
}

function cleanAuthUrl() {
  const current = new URL(window.location.href);
  const cleaned = new URL(window.location.pathname, window.location.origin);

  for (const [key, value] of current.searchParams.entries()) {
    if (SAFE_SEARCH_PARAMS.has(key)) {
      cleaned.searchParams.append(key, value);
    }
  }

  for (const key of AUTH_SEARCH_PARAMS) {
    cleaned.searchParams.delete(key);
  }

  window.history.replaceState({}, document.title, `${cleaned.pathname}${cleaned.search}`);
}

function normalizeError(error: unknown): string {
  if (!error) return "Unable to finalize auth link.";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Unable to finalize auth link.";
}

export async function finalizeSupabaseAuthLink(
  options: FinalizeSupabaseAuthLinkOptions = {},
): Promise<FinalizeSupabaseAuthLinkResult> {
  const search = new URLSearchParams(window.location.search);
  const hash = readHashParams(window.location.hash);
  const code = search.get("code");
  const queryType = search.get("type");
  const hashType = hash.get("type");
  const type = queryType ?? hashType;
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const hasCode = Boolean(code);
  const hashHasAccessToken = Boolean(accessToken);

  let source: AuthLinkSource = "none";
  let session: Session | null = null;
  let error: string | null = null;

  try {
    if (code) {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        error = exchangeError.message;
      } else {
        session = data.session ?? null;
        source = "pkce_code";
      }
    } else {
      const { data: existing } = await supabase.auth.getSession();
      session = existing.session ?? null;

      if (!session && accessToken && refreshToken) {
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          error = setSessionError.message;
        } else {
          session = data.session ?? null;
          source = "hash_tokens";
        }
      } else if (session) {
        source = "existing_session";
      }
    }

    const { data: finalSessionData, error: finalSessionError } = await supabase.auth.getSession();
    if (finalSessionError && !error) error = finalSessionError.message;
    session = finalSessionData.session ?? session;

    if (session && source === "none") source = "existing_session";

    if (options.cleanUrl && session && source !== "none") {
      cleanAuthUrl();
    }
  } catch (err) {
    error = normalizeError(err);
  }

  const ok = Boolean(session) && !error;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[supabase-auth-link] finalized", {
      hasCode,
      hashHasAccessToken,
      hashType,
      pathname: window.location.pathname,
      source,
      hasSession: Boolean(session),
    });
  }

  return {
    ok,
    session,
    type,
    source,
    error,
  };
}
