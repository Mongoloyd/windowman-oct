# Supabase Type Generation Workflow

## When to regenerate

- After **any** Supabase migration is applied (new tables, altered columns, new functions, policy changes)
- After **any** manual schema change in Supabase dashboard
- Before releasing any PR that touches Supabase queries, RPCs, or edge functions
- Lovable auto-regenerates this file after migration approval — manual regeneration is needed only for dashboard changes

## Exact command sequence

```bash
# From project root — requires Supabase CLI and project access
# Use the staging ref from SUPABASE_TARGETING.md (npm run typegen uses package.json)
npx supabase gen types typescript \
  --project-id <SUPABASE_PROJECT_REF> \
  > src/integrations/supabase/types.ts
```

Or use the package.json shortcut:

```bash
npm run typegen
```

To check for staleness without overwriting:

```bash
npm run typegen:check
```

A non-zero exit code means types are stale.

## Files expected to change

- `src/integrations/supabase/types.ts` — the sole generated file

## Pre-commit verification checklist

1. **No compile errors**: Run `npm run build` — if new columns/tables were added, any code referencing them should now compile cleanly.
2. **No type regressions**: If columns were renamed or removed, search the codebase for old names.
3. **Relationship accuracy**: Check that `Relationships` arrays in the generated types reflect actual FK constraints in the database.
4. **Do not hand-edit**: This file is auto-generated. All changes must come from the database schema.

## Known type-drift risks

- `types.ts` declares `Relationships` arrays based on FK constraints at generation time.
- Some tables (e.g., `leads.latest_analysis_id`, `leads.contractor_id`) reference other tables via application logic but lack formal FK constraints — these will NOT appear in Relationships arrays.
- Tables in reserved schemas (`auth.users`) cannot be referenced by FKs from public schema tables.
- No CI-level type-drift guard exists yet (deferred — would require Supabase CLI in CI).
- See `docs/db/FK_HARDENING_PLAN.md` for the full audit of logical vs formal relationships.
