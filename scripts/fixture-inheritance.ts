/**
 * Thin re-export shim. The pure analyzer now lives at
 * src/test/fixtureInheritance.ts so it can be safely imported by both
 * Bun-run scripts and the Vite/browser dev cockpit.
 *
 * Existing imports of `./fixture-inheritance.ts` from
 * scripts/scanner-fixture-report.ts continue to work unchanged.
 */

export {
  RISKY_INHERITED_FIELDS,
  RISKY_INHERITED_LINE_ITEM_FIELDS,
  analyzeFixtureInheritance,
  buildAllInheritanceReports,
  type InheritanceReport,
} from "../src/test/fixtureInheritance.ts";
