Plan: Lovable sandbox boot failure dependency audit/fix only

Scope boundaries
- Only inspect and, if needed, edit:
  - `package.json`
  - `package-lock.json`
- Do not modify UI files, routes, Supabase functions, migrations, OTP/Twilio, scanner, report reveal, tracking, admin logic, or any unrelated files.

Current audit finding
- `package.json` already shows:
  - `"vite": "^7.3.2"`
- `package-lock.json` currently resolves:
  - root Vite range: `^7.3.2`
  - installed lockfile Vite version: `7.3.2`
  - `lovable-tagger@1.1.13` peer dependency: `vite >=5.0.0 <8.0.0`
- This means the suspected Vite 8 conflict appears already resolved in the current checked-out files.

Implementation steps after approval
1. Re-audit `package.json`
   - Confirm `devDependencies.vite` remains `^7.3.2` or another valid `>=5 <8` version.
   - If it has drifted back to `^8.x`, change only that field to `^7.3.2`.

2. Re-audit `package-lock.json`
   - Confirm the lockfile root package entry points Vite to `^7.3.2`.
   - Confirm `node_modules/vite.version` is below 8, ideally `7.3.2`.
   - Confirm `lovable-tagger` peer range remains `>=5.0.0 <8.0.0`.

3. Regenerate the lockfile only if needed
   - If `package.json` and `package-lock.json` are already consistent, avoid unnecessary lockfile churn.
   - If the lockfile is inconsistent or still resolves Vite 8, run a normal npm install/update path without `--legacy-peer-deps` to regenerate `package-lock.json` cleanly.
   - Target final state:
     ```json
     "vite": "^7.3.2"
     ```
     and lockfile Vite resolution below 8.

4. Validation checks
   - Run `npm install` without `--legacy-peer-deps` to confirm peer dependencies resolve normally.
   - Run the project build check with `npm run build`.
   - Do not run unrelated migrations or Supabase function deploys.

5. Change verification
   - Check the final changed-file list.
   - Accept only these changed files if changes are required:
     - `package.json`
     - `package-lock.json`
   - If no dependency change is needed, report that no code/config file changes were required.
   - Reject/stop if any unrelated file would be modified.

Final report format
- Exact files changed.
- Exact Vite version/range in `package.json`.
- Exact resolved Vite version in `package-lock.json`.
- Whether `npm install` passed without `--legacy-peer-deps`.
- Whether `npm run build` passed.
- Whether any files outside `package.json` / `package-lock.json` changed.