# Fail closed unless supabase/.temp/project-ref is staging.
# No remote Supabase commands. Safe to run from any directory.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedStagingRef = 'zgsofkgddpcntdvpckdq'
$RepoRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$ProjectRefPath = Join-Path (Join-Path (Join-Path $RepoRoot 'supabase') '.temp') 'project-ref'

if (-not (Test-Path -LiteralPath $ProjectRefPath)) {
    Write-Error @"
Supabase link state not found: $ProjectRefPath

Run from repo root:
  npx supabase link --project-ref $ExpectedStagingRef

Then re-run:
  powershell -ExecutionPolicy Bypass -File scripts/supabase/assert-staging.ps1
"@
    exit 2
}

$ActualRef = (Get-Content -LiteralPath $ProjectRefPath -Raw).Trim()

if ($ActualRef -ne $ExpectedStagingRef) {
    Write-Error @"
Supabase CLI is not linked to staging.

  Expected: $ExpectedStagingRef
  Actual:   $ActualRef
  File:     $ProjectRefPath

To link staging:
  npx supabase link --project-ref $ExpectedStagingRef
"@
    exit 3
}

Write-Output "OK: Supabase CLI target is staging $ExpectedStagingRef"
exit 0
