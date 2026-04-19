/**
 * Vitest config for the standalone runtime PageView dedupe proof.
 *
 * Scope: this config exists ONLY to run `scripts/pageview-dedupe-test.ts`.
 * It does not affect the main `vitest.config.ts` used by `src/**` tests.
 *
 * Run with:
 *   npx vitest run --config vitest.proof.config.ts
 */
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["scripts/pageview-dedupe-test.ts"],
    },
  })
);
