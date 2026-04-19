/**
 * Vitest config for the standalone runtime PageView dedupe proof.
 *
 * Scope: this config exists ONLY to run `scripts/pageview-dedupe-test.ts`.
 * It does not affect the main `vitest.config.ts` used by `src/**` tests.
 *
 * Run with:
 *   npx vitest run --config vitest.proof.config.ts
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["scripts/pageview-dedupe-test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
