export const FORBIDDEN_PROD_REF = "wkrcyxcnzhwjtdpmfpaf";
export const APPROVED_STAGING_REF = "zgsofkgddpcntdvpckdq";

export type QaHelperGuardEnv = {
  QA_HELPER_ENABLED?: string | null;
  QA_HELPER_SECRET?: string | null;
  QA_HELPER_PROJECT_REF?: string | null;
  WM_SUPABASE_PROJECT_REF?: string | null;
};

export type QaHelperGuardResult =
  | { allowed: true; reason: "approved" }
  | {
    allowed: false;
    httpStatus: 404 | 403 | 500;
    reason: string;
  };

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Constant-time string compare to avoid timing oracles on the QA helper secret. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function evaluateQaHelperGuard(args: {
  providedSecret: string | null;
  env: QaHelperGuardEnv;
}): QaHelperGuardResult {
  const { providedSecret, env } = args;

  if (
    !isNonEmptyString(env.QA_HELPER_ENABLED) ||
    env.QA_HELPER_ENABLED.trim() !== "true"
  ) {
    return { allowed: false, httpStatus: 404, reason: "not_found" };
  }

  if (!isNonEmptyString(env.QA_HELPER_SECRET)) {
    return { allowed: false, httpStatus: 500, reason: "config_error" };
  }

  if (
    !isNonEmptyString(env.QA_HELPER_PROJECT_REF) ||
    !isNonEmptyString(env.WM_SUPABASE_PROJECT_REF)
  ) {
    return { allowed: false, httpStatus: 403, reason: "wrong_project" };
  }

  const wmRef = env.WM_SUPABASE_PROJECT_REF.trim();
  const qaRef = env.QA_HELPER_PROJECT_REF.trim();

  if (wmRef === FORBIDDEN_PROD_REF || qaRef === FORBIDDEN_PROD_REF) {
    return {
      allowed: false,
      httpStatus: 403,
      reason: "forbidden_production_ref",
    };
  }

  if (qaRef !== APPROVED_STAGING_REF) {
    return { allowed: false, httpStatus: 403, reason: "wrong_project" };
  }

  if (wmRef !== qaRef) {
    return { allowed: false, httpStatus: 403, reason: "wrong_project" };
  }

  if (!isNonEmptyString(providedSecret)) {
    return { allowed: false, httpStatus: 403, reason: "forbidden" };
  }

  if (!timingSafeEqual(providedSecret.trim(), env.QA_HELPER_SECRET.trim())) {
    return { allowed: false, httpStatus: 403, reason: "forbidden" };
  }

  return { allowed: true, reason: "approved" };
}

export function readQaHelperGuardEnv(): QaHelperGuardEnv {
  return {
    QA_HELPER_ENABLED: Deno.env.get("QA_HELPER_ENABLED"),
    QA_HELPER_SECRET: Deno.env.get("QA_HELPER_SECRET"),
    QA_HELPER_PROJECT_REF: Deno.env.get("QA_HELPER_PROJECT_REF"),
    WM_SUPABASE_PROJECT_REF: Deno.env.get("WM_SUPABASE_PROJECT_REF"),
  };
}
