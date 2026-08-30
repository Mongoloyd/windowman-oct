# Technical Debt

- [ ] **Low-Priority Refactor (Maintenance):** Consolidate hard-cap predicate definitions into a single shared source module. Currently duplicated across canonical scorer (`scoring.ts`) and diagnostic observability layer (`scoringDiagnostics.ts`). Retain parity test coverage upon consolidation.
