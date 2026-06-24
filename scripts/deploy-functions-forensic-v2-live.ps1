# Deploy approved Forensic V2 Edge Functions to the staging target (zgsofkgddpcntdvpckdq).
# Scope: CRM emitters + TikTok dry-run dispatch lane (Sprint 3C-5A).
# Never deploy-all, never --prune, never db push/reset/secrets/typegen.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ForbiddenRefs = @("wkrcyxcnzhwjtdpmfpaf", "wm-mvp-forensic-v2-local")
$RequiredBranch = "forensic_report_v2"
$ConfirmPhrase = "DEPLOY_FORENSIC_V2_LIVE_FUNCTIONS"
$TargetFunctions = @(
    "start-upload-scan-session",
    "capture-truth-gate-lead",
    "capture-arbitrage-lead",
    "capture-power-tool-demo-lead",
    "dispatch-platform-events",
    "tiktok-capi-event"
)

function Get-BannerText {
    return @"
Target: $ApprovedRef - approved live Forensic V2 target. Some stale docs may call this staging.
Authoritative remote target: --project-ref $ApprovedRef, not supabase/config.toml project_id.
"@
}

function Write-Banner {
    Write-Host ""
    Write-Host (Get-BannerText)
    Write-Host ""
}

function Fail([int]$ExitCode, [string]$Message) {
    [Console]::Error.WriteLine("ERROR: $Message")
    exit $ExitCode
}

Write-Banner

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

try {
    $InsideWorkTree = (git -C $RepoRoot rev-parse --is-inside-work-tree 2>$null).Trim()
} catch {
    Fail 10 "Not inside a git worktree (expected repo root ancestor of $PSScriptRoot)."
}
if ($InsideWorkTree -ne "true") {
    Fail 10 "Not inside a git worktree."
}

$Branch = (git -C $RepoRoot branch --show-current).Trim()
$HeadSha = (git -C $RepoRoot rev-parse HEAD).Trim()

Write-Host "Git branch: $Branch"
Write-Host "Git HEAD:   $HeadSha"

if ($Branch -ne $RequiredBranch) {
    Fail 11 "Refusing deploy: branch must be '$RequiredBranch' (current: '$Branch')."
}

$Dirty = git -C $RepoRoot status --porcelain
if ($Dirty) {
    Write-Host ""
    Write-Host "Working tree is dirty. Short status:"
    git -C $RepoRoot status --short
    Fail 12 "Refusing deploy: working tree must be clean."
}

$ProjectRef = $env:SUPABASE_PROJECT_REF
if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    Fail 20 "SUPABASE_PROJECT_REF is unset or blank. Set it to the approved live Forensic V2 ref before running."
}
$ProjectRef = $ProjectRef.Trim()

foreach ($Forbidden in $ForbiddenRefs) {
    if ($ProjectRef -eq $Forbidden) {
        Fail 21 "Refusing deploy: SUPABASE_PROJECT_REF matches forbidden ref '$Forbidden'."
    }
}
if ($ProjectRef -ne $ApprovedRef) {
    Fail 22 "Refusing deploy: SUPABASE_PROJECT_REF must be exactly '$ApprovedRef' (got '$ProjectRef')."
}

$LinkedRefPath = Join-Path (Join-Path (Join-Path $RepoRoot "supabase") ".temp") "project-ref"
$LinkedRef = $null
if (Test-Path -LiteralPath $LinkedRefPath) {
    $LinkedRef = (Get-Content -LiteralPath $LinkedRefPath -Raw).Trim()
    Write-Host "Local linked ref (informational only): $LinkedRef"
    Write-Host "Note: supabase/.temp/project-ref is machine-local and NOT deployment truth."
    Write-Host "Authoritative remote target: --project-ref $ApprovedRef"
    if ($LinkedRef -ne $ProjectRef) {
        Fail 23 @"
Linked CLI ref conflicts with SUPABASE_PROJECT_REF.

  SUPABASE_PROJECT_REF (authoritative): $ProjectRef
  supabase/.temp/project-ref:         $LinkedRef

Fix link or unset mismatch before deploy:
  npx supabase link --project-ref $ApprovedRef
"@
    }
} else {
    Write-Host 'Local linked ref: (missing - OK; --project-ref remains authoritative)'
}

$NpxCmd = Get-Command npx -ErrorAction SilentlyContinue
if (-not $NpxCmd) {
    Fail 30 "npx not found on PATH. Node/npm/npx tooling is required before deploy."
}
$CliVersion = (& npx supabase --version 2>&1 | Out-String).Trim()
Write-Host "Supabase CLI (via npx): $CliVersion"
Write-Host "config.toml project_id is local Docker namespace only - never used as remote target."

$DeployCommands = @(
    "npx supabase functions deploy start-upload-scan-session --project-ref $ApprovedRef",
    "npx supabase functions deploy capture-truth-gate-lead --project-ref $ApprovedRef",
    "npx supabase functions deploy capture-arbitrage-lead --project-ref $ApprovedRef",
    "npx supabase functions deploy capture-power-tool-demo-lead --project-ref $ApprovedRef",
    "npx supabase functions deploy dispatch-platform-events --project-ref $ApprovedRef",
    "npx supabase functions deploy tiktok-capi-event --project-ref $ApprovedRef"
)

Write-Host ""
Write-Host "=== DEPLOY SUMMARY (CRM emitters + TikTok dry-run dispatch) ==="
Write-Host "Branch:              $Branch"
Write-Host "HEAD SHA:            $HeadSha"
Write-Host "Approved target ref: $ApprovedRef"
Write-Host "SUPABASE_PROJECT_REF: $ProjectRef"
Write-Host "Linked ref (if any): $(if ($LinkedRef) { $LinkedRef } else { '(none)' })"
Write-Host "Functions to deploy:"
foreach ($Fn in $TargetFunctions) { Write-Host "  - $Fn" }
Write-Host "Commands that will run:"
foreach ($Cmd in $DeployCommands) { Write-Host "  $Cmd" }

Write-Banner

Write-Host "Type exactly: $ConfirmPhrase"
$Typed = Read-Host "Confirmation"
if ($Typed -ne $ConfirmPhrase) {
    Fail 40 "Deploy aborted: confirmation phrase mismatch."
}

Push-Location $RepoRoot
try {
    foreach ($Fn in $TargetFunctions) {
        Write-Host ""
        Write-Host "Deploying $Fn ..."
        & npx supabase functions deploy $Fn --project-ref $ApprovedRef
        if ($LASTEXITCODE -ne 0) {
            Fail 50 "Deploy failed for $Fn (exit $LASTEXITCODE)."
        }
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Deploy complete for all approved functions."
Write-Host "Next: run TikTok 3C-5 staging dry-run smoke (see docs/ops/TIKTOK_3C5_STAGING_DRY_RUN_RUNBOOK.md)."
Write-Host "This script did NOT run smoke tests, secrets set, db push, typegen, or --prune."
exit 0
