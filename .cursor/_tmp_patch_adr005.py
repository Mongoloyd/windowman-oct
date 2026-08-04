from pathlib import Path

p = Path("docs/adr/ADR-005-server-minted-quote-intake-capability.md")
c = p.read_text(encoding="utf-8")

old = """Because four referenced governing documents are absent at baseline, this ADR:

- retains `NEEDS REPO VERIFICATION` for their contents;
- does not invent or paraphrase their contents;
- retains implementation blocking under §2;
- treats `AGENTS.md` and `.cursor/PROTECTED_FILES.md` as the operative protected-path authority.

---

## 1. Decision"""

new = """Because four referenced governing documents are absent at baseline, this ADR:

- retained `NEEDS REPO VERIFICATION` for their contents at baseline;
- did not invent or paraphrase their contents at baseline;
- retained implementation blocking under §2;
- treated `AGENTS.md` and `.cursor/PROTECTED_FILES.md` as the operative protected-path authority when those four files were absent.

### 0.4 Current governance status

At baseline `73a3d7d`, the four upstream governance documents were **Absent** (see §0.3).

At `d828b157`, the four documents were committed with `Status: Proposed`.

In the current adoption sprint, the four documents were accepted, registered as **CANONICAL** in
[`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md), and routed through
[`START_HERE.md`](../START_HERE.md).

This adoption satisfies ADR-005 prerequisites **1–4 only**.

ADR-005 remains `Status: Proposed`.

Prerequisites **5–38** remain unresolved or require separate verification, operator decisions,
planning, or protected implementation authority.

Governance adoption operator commit: **`PENDING OPERATOR COMMIT`** (this sprint does not commit).

---

## 1. Decision"""

if old not in c:
    raise SystemExit("old block not found")
c = c.replace(old, new, 1)

old2 = """1. `docs/architecture/PROTECTED_SYSTEMS.md` is merged and canonical.
2. `docs/architecture/ROUTE_SCAN.md` is merged and canonical.
3. `docs/adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md` is merged and canonical.
4. `docs/adr/ADR-004-quote-disposition-and-ledger-layer-separation.md` is merged and canonical.
5. The branch, migrations, generated types, policies, grants, Edge Functions, browser call sites, and deployed Supabase target are reconciled."""

new2 = """1. `docs/architecture/PROTECTED_SYSTEMS.md` is merged and canonical.  
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [`PROTECTED_SYSTEMS.md`](../architecture/PROTECTED_SYSTEMS.md); `Status: Accepted`; registry: CANONICAL; routed: [`START_HERE.md`](../START_HERE.md); adoption commit: `PENDING OPERATOR COMMIT`.
2. `docs/architecture/ROUTE_SCAN.md` is merged and canonical.  
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [`ROUTE_SCAN.md`](../architecture/ROUTE_SCAN.md); `Status: Accepted`; registry: CANONICAL; routed: [`START_HERE.md`](../START_HERE.md); adoption commit: `PENDING OPERATOR COMMIT`.
3. `docs/adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md` is merged and canonical.  
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [ADR-003](./ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md); `Status: Accepted`; registry: CANONICAL; routed: [`START_HERE.md`](../START_HERE.md); adoption commit: `PENDING OPERATOR COMMIT`.
4. `docs/adr/ADR-004-quote-disposition-and-ledger-layer-separation.md` is merged and canonical.  
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [ADR-004](./ADR-004-quote-disposition-and-ledger-layer-separation.md); `Status: Accepted`; registry: CANONICAL; routed: [`START_HERE.md`](../START_HERE.md); adoption commit: `PENDING OPERATOR COMMIT`.
5. The branch, migrations, generated types, policies, grants, Edge Functions, browser call sites, and deployed Supabase target are reconciled.  
   **Status:** `OPEN` — requires repository and deployed-state verification beyond this governance adoption sprint."""

if old2 not in c:
    raise SystemExit("old2 block not found")
c = c.replace(old2, new2, 1)

old3 = """At baseline `73a3d7d`, prerequisites 1–4 are unavailable because the four referenced
documents are absent from the repository. Existing protected authority is provided by
`AGENTS.md` and `.cursor/PROTECTED_FILES.md`."""

new3 = """At baseline `73a3d7d`, prerequisites 1–4 were unavailable because the four referenced documents were **Absent** from the repository. Existing protected authority was provided by `AGENTS.md` and `.cursor/PROTECTED_FILES.md`.

At `d828b157`, the four documents existed in the repository but remained `Status: Proposed` and were not registry-canonical.

After this adoption sprint and its operator commit (`PENDING OPERATOR COMMIT`), prerequisites **1–4** are **satisfied**. Prerequisites **5–38** remain implementation blockers. Facts that still depend on repository or deployed-state verification must stop with `NEEDS REPO VERIFICATION`. This ADR is **not** implementation-ready."""

if old3 not in c:
    raise SystemExit("old3 block not found")
c = c.replace(old3, new3, 1)

p.write_text(c, encoding="utf-8")
print("ADR-005 patched ok")
