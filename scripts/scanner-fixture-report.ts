/**
 * Scanner Diagnostics — runs SCENARIO_FIXTURES through the real
 * deterministic computeGrade() and prints expected vs actual.
 *
 * Read-only. No network, no Supabase, no DOM, no production side effects.
 *
 * Usage: bun run scripts/scanner-fixture-report.ts
 *        (wired as `npm run scanner:fixtures`)
 */

import { SCENARIO_FIXTURES } from "../src/test/createMockQuote.ts";
import {
  computeGrade,
  type ExtractionResult,
} from "../supabase/functions/scan-quote/scoring.ts";
import {
  analyzeFixtureInheritance,
} from "./fixture-inheritance.ts";

const showInheritance = process.argv.includes("--inheritance");

type Row = {
  key: string;
  label: string;
  expected: string | undefined;
  expectedTerminal: string | undefined;
  actual: string;
  weighted: number | null;
  hardCap: string | null;
  pillars: {
    safety: number | null;
    install: number | null;
    price: number | null;
    finePrint: number | null;
    warranty: number | null;
  };
  status: "PASS" | "FAIL" | "SKIP";
};

const rows: Row[] = [];

// Optional CLI filter:  --scenario=gradeC   (or)   --scenario=gradeC,finePrintTrap
const filterArg = process.argv.find((a) => a.startsWith("--scenario="));
const filterKeys = filterArg
  ? filterArg.replace("--scenario=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const fixturesToRun = filterKeys
  ? SCENARIO_FIXTURES.filter((f: any) => filterKeys.includes(f.key))
  : SCENARIO_FIXTURES;

if (filterKeys && fixturesToRun.length === 0) {
  console.error(`No fixtures matched: ${filterKeys.join(", ")}`);
  process.exit(2);
}

for (const fx of fixturesToRun) {
  const key = (fx as any).key ?? (fx as any).id ?? "(unknown)";
  const label = (fx as any).label ?? (fx as any).name ?? "";
  const expected = (fx as any).expectedGrade as string | undefined;
  const expectedTerminal = (fx as any).expectedTerminal as string | undefined;
  const extraction = (fx as any).extraction as ExtractionResult | undefined;

  if (!extraction || expectedTerminal) {
    rows.push({
      key,
      label,
      expected,
      expectedTerminal,
      actual: "—",
      weighted: null,
      hardCap: null,
      pillars: { safety: null, install: null, price: null, finePrint: null, warranty: null },
      status: "SKIP",
    });
    continue;
  }

  const result = computeGrade(extraction);
  const actual = (result as any).letterGrade ?? (result as any).grade ?? "?";
  const weighted = (result as any).weightedAverage ?? (result as any).weighted ?? null;
  const hardCapRaw = (result as any).hardCapApplied ?? null;
  const hardCap = Array.isArray(hardCapRaw) ? hardCapRaw.join(",") : hardCapRaw;

  const p = (result as any).pillars ?? (result as any).pillarScores ?? {};
  const pillars = {
    safety: p.safety?.score ?? p.safety ?? null,
    install: p.install?.score ?? p.install ?? null,
    price: p.price?.score ?? p.price ?? null,
    finePrint: p.finePrint?.score ?? p.fine_print?.score ?? p.finePrint ?? null,
    warranty: p.warranty?.score ?? p.warranty ?? null,
  };

  const status: "PASS" | "FAIL" =
    expected && actual === expected ? "PASS" : "FAIL";

  rows.push({
    key,
    label,
    expected,
    expectedTerminal,
    actual,
    weighted: typeof weighted === "number" ? Number(weighted.toFixed(2)) : weighted,
    hardCap,
    pillars,
    status,
  });
}

// ── Print per-scenario detail ──────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("SCANNER FIXTURE DIAGNOSTIC REPORT");
console.log("═══════════════════════════════════════════════════════════════\n");

for (const r of rows) {
  const tag =
    r.status === "PASS" ? "✅ PASS" : r.status === "SKIP" ? "⏭  SKIP" : "❌ FAIL";
  console.log(`${tag}  [${r.key}] ${r.label}`);
  console.log(
    `   expected: ${r.expected ?? "(terminal:" + (r.expectedTerminal ?? "—") + ")"}` +
      `   actual: ${r.actual}` +
      `   weighted: ${r.weighted ?? "—"}` +
      `   hardCap: ${r.hardCap ?? "—"}`,
  );
  console.log(
    `   pillars: safety=${r.pillars.safety} install=${r.pillars.install} ` +
      `price=${r.pillars.price} finePrint=${r.pillars.finePrint} warranty=${r.pillars.warranty}`,
  );
  console.log("");
}

// ── Summary ────────────────────────────────────────────────────────────────
const total = rows.length;
const passing = rows.filter((r) => r.status === "PASS").length;
const failing = rows.filter((r) => r.status === "FAIL").length;
const skipped = rows.filter((r) => r.status === "SKIP").length;
const mismatches = rows.filter((r) => r.status === "FAIL");

console.log("───────────────────────────────────────────────────────────────");
console.log("SUMMARY");
console.log("───────────────────────────────────────────────────────────────");
console.log(`total:    ${total}`);
console.log(`passing:  ${passing}`);
console.log(`failing:  ${failing}`);
console.log(`skipped:  ${skipped} (terminal/non-graded scenarios)`);
if (mismatches.length > 0) {
  console.log(`\nMismatches:`);
  for (const m of mismatches) {
    console.log(`  - ${m.key}: expected ${m.expected} → actual ${m.actual}`);
  }
} else {
  console.log(`\nNo mismatches. 🎯`);
}
console.log("");

// Exit non-zero if any mismatch — useful for CI later, but does not fail build.
if (failing > 0) process.exitCode = 1;
