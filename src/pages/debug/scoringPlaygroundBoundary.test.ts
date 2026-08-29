import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "ScoringPlayground.tsx",
  "scoringPlaygroundModel.ts",
  "rubricVersionSimulator.ts",
  "fixtures/goldenFixtures.ts",
  "components/GoldenRegressionStudio.tsx",
  "components/VersionDiffMatrix.tsx",
  "components/FixtureDeltaCard.tsx",
].map((name) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8"));
const routeSource = routeFiles.join("\n");
const appSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../App.tsx"), "utf8");

describe("scoring playground isolation boundary", () => {
  it("does not import scanner orchestration, Supabase, services, or measurement modules", () => {
    const forbiddenImports = [
      "scan-quote/index",
      "@supabase/supabase-js",
      "@/integrations/supabase",
      "@/services/",
      "@/lib/tracking",
      "@/lib/measurement",
    ];

    for (const forbiddenImport of forbiddenImports) {
      expect(routeSource).not.toContain(forbiddenImport);
    }
  });

  it("owns no network, persistence, cookie, or telemetry behavior", () => {
    const forbiddenRuntimeTokens = [
      "fetch(",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
      "dataLayer",
      "trackConversion(",
      "trackEvent(",
    ];

    for (const forbiddenToken of forbiddenRuntimeTokens) {
      expect(routeSource).not.toContain(forbiddenToken);
    }
  });

  it("remains reachable only through the compile-time DEV lazy boundary", () => {
    expect(appSource).toContain("const ScoringPlayground = import.meta.env.DEV");
    expect(appSource).toContain('? lazy(() => import("./pages/debug/ScoringPlayground.tsx"))');
    expect(appSource).not.toContain("GoldenRegressionStudio");
    expect(appSource).not.toContain("goldenFixtures");
  });
});
