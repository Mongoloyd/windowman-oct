# List Edge Functions on staging (remote read-only). Asserts link target first.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$StagingRef = 'zgsofkgddpcntdvpckdq'
$RepoRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$AssertScript = Join-Path $PSScriptRoot 'assert-staging.ps1'

& $AssertScript
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Push-Location $RepoRoot
try {
    & npx supabase functions list --project-ref $StagingRef
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
