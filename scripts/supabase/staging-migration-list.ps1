# List migrations on linked staging project (remote read-only). Asserts link target first.
# migration list does not support --project-ref; --linked is used after assert-staging passes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$AssertScript = Join-Path $PSScriptRoot 'assert-staging.ps1'

& $AssertScript
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Push-Location $RepoRoot
try {
    & npx supabase migration list --linked
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
