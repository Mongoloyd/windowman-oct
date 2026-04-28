Plan to update the Supabase Migration Integrity GitHub Action

Scope
- Modify exactly one file: `.github/workflows/supabase-migration-integrity.yml`.
- Do not modify `supabase/migrations/`, `src/`, `supabase/functions/`, dependency files, `.env`, or any other workflow files.

Change
- Replace the current automatic trigger block:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

- With the manual-only trigger block:

```yaml
on:
  workflow_dispatch:
```

Preservation rules
- Preserve the rest of the workflow body exactly as-is.
- Leave job names, permissions, services, env vars, and all steps unchanged.

Verification after implementation
- Confirm the changed files list contains exactly:

```text
.github/workflows/supabase-migration-integrity.yml
```

- Report the final trigger block exactly as it appears in the file.