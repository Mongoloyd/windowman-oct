import {
  APPROVED_STAGING_REF,
  evaluateQaHelperGuard,
  FORBIDDEN_PROD_REF,
  type QaHelperGuardEnv,
} from "./qaHelperGuard.ts";

const QA_SECRET = "test-qa-helper-secret-placeholder";

const fullEnv: QaHelperGuardEnv = {
  QA_HELPER_ENABLED: "true",
  QA_HELPER_SECRET: QA_SECRET,
  QA_HELPER_PROJECT_REF: APPROVED_STAGING_REF,
  WM_SUPABASE_PROJECT_REF: APPROVED_STAGING_REF,
};

function assertNoSecretInResult(result: unknown): void {
  const serialized = JSON.stringify(result);
  if (serialized.includes(QA_SECRET)) {
    throw new Error("result must not contain secret values");
  }
}

Deno.test("disabled returns fail-closed 404", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: QA_SECRET,
    env: { ...fullEnv, QA_HELPER_ENABLED: "false" },
  });
  assertNoSecretInResult(result);
  if (result.allowed || result.httpStatus !== 404) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("production ref denied", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: QA_SECRET,
    env: {
      ...fullEnv,
      WM_SUPABASE_PROJECT_REF: FORBIDDEN_PROD_REF,
      QA_HELPER_PROJECT_REF: APPROVED_STAGING_REF,
    },
  });
  assertNoSecretInResult(result);
  if (
    result.allowed ||
    result.httpStatus !== 403 ||
    result.reason !== "forbidden_production_ref"
  ) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("wrong project ref denied when WM ref mismatches QA ref", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: QA_SECRET,
    env: {
      ...fullEnv,
      WM_SUPABASE_PROJECT_REF: "other-project-ref",
    },
  });
  assertNoSecretInResult(result);
  if (result.allowed || result.httpStatus !== 403) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("QA_HELPER_PROJECT_REF must equal approved staging ref", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: QA_SECRET,
    env: {
      ...fullEnv,
      QA_HELPER_PROJECT_REF: "other-project-ref",
    },
  });
  assertNoSecretInResult(result);
  if (result.allowed || result.httpStatus !== 403) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("missing server secret returns config_error", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: QA_SECRET,
    env: { ...fullEnv, QA_HELPER_SECRET: null },
  });
  assertNoSecretInResult(result);
  if (result.allowed || result.httpStatus !== 500) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("missing header secret denied", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: null,
    env: fullEnv,
  });
  assertNoSecretInResult(result);
  if (result.allowed || result.httpStatus !== 403) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("bad header secret denied", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: "wrong-secret",
    env: fullEnv,
  });
  assertNoSecretInResult(result);
  if (result.allowed || result.httpStatus !== 403) {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("good staging env and good header allowed", () => {
  const result = evaluateQaHelperGuard({
    providedSecret: QA_SECRET,
    env: fullEnv,
  });
  assertNoSecretInResult(result);
  if (!result.allowed || result.reason !== "approved") {
    throw new Error(JSON.stringify(result));
  }
});
