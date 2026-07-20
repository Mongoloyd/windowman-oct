# check-governance.ps1
# Mechanical governance drift checks only — does not determine architectural truth.
# Fails non-zero on clear documentation/governance defects.

param(
    [string[]]$ScanRoots = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Set-Location $RepoRoot

$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Get-GovernanceFiles {
    param([string[]]$Roots)

    $patterns = @("*.md", "*.mdc")
    $files = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

    foreach ($root in $Roots) {
        if ([System.IO.Path]::IsPathRooted($root)) {
            $fullRoot = $root
        } else {
            $fullRoot = Join-Path $RepoRoot $root
        }
        if (-not (Test-Path $fullRoot)) { continue }
        if (Test-Path $fullRoot -PathType Leaf) {
            [void]$files.Add((Resolve-Path $fullRoot).Path)
            continue
        }
        foreach ($pattern in $patterns) {
            Get-ChildItem -Path $fullRoot -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
                ForEach-Object { [void]$files.Add($_.FullName) }
        }
    }

    return @($files)
}

if ($ScanRoots.Count -eq 0) {
    $ScanRoots = @(
        "README.md",
        "AGENTS.md",
        "claude.md",
        "docs",
        ".cursor"
    )
}

Write-Host "WindowMan governance drift check"
Write-Host "Repo: $RepoRoot"
Write-Host ""

# 4. Required canonical files exist
$requiredFiles = @(
    "AGENTS.md",
    "claude.md",
    "docs/START_HERE.md",
    ".cursor/PROTECTED_FILES.md",
    "docs/ops/DOC_STATUS_REGISTRY.md",
    "docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md"
)

Write-Host "[1/5] Required canonical files"
foreach ($rel in $requiredFiles) {
    $path = Join-Path $RepoRoot $rel
    if (-not (Test-Path $path)) {
        Add-Failure "Missing required canonical file: $rel"
        Write-Host "  FAIL  $rel"
    } else {
        Write-Host "  OK    $rel"
    }
}

# 5. Oracle discovery references
Write-Host ""
Write-Host "[2/5] Oracle protocol discovery"
$oraclePath = "docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md"
$oracleChecks = @{
    "AGENTS.md" = Join-Path $RepoRoot "AGENTS.md"
    "docs/START_HERE.md" = Join-Path $RepoRoot "docs/START_HERE.md"
    "docs/ops/DOC_STATUS_REGISTRY.md" = Join-Path $RepoRoot "docs/ops/DOC_STATUS_REGISTRY.md"
}
foreach ($label in $oracleChecks.Keys) {
    $content = Get-Content -Raw -Path $oracleChecks[$label]
    if ($content -notmatch 'ORACLE_EVOLUTION_PROTOCOL\.md') {
        Add-Failure "$label must reference docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md"
        Write-Host "  FAIL  $label"
    } else {
        Write-Host "  OK    $label"
    }
}

$scanFiles = Get-GovernanceFiles -Roots $ScanRoots
Write-Host ""
Write-Host "[3/5] Merge conflict markers ($($scanFiles.Count) files)"
$mergePattern = '^(<<<<<<<|=======|>>>>>>>)'
foreach ($file in $scanFiles) {
    $lineNum = 0
    Get-Content -Path $file | ForEach-Object {
        $lineNum++
        if ($_ -match $mergePattern) {
            $rel = $file.Substring($RepoRoot.Path.Length).TrimStart('\', '/')
            Add-Failure "Merge marker in ${rel}:${lineNum}: $_"
        }
    }
}
if (-not ($failures | Where-Object { $_ -like "Merge marker*" })) {
    Write-Host "  OK    no merge markers"
}

Write-Host ""
Write-Host "[4/5] Fragile AGENTS numeric references"
$agentsSectionPattern = 'AGENTS\.md\s*§|AGENTS\.md.*§\s*\d'
foreach ($file in $scanFiles) {
    $rel = $file.Substring($RepoRoot.Path.Length).TrimStart('\', '/')
    $lineNum = 0
    Get-Content -Path $file | ForEach-Object {
        $lineNum++
        if ($_ -match $agentsSectionPattern) {
            Add-Failure "Fragile AGENTS section reference in ${rel}:${lineNum}: $_"
        }
    }
}
if (-not ($failures | Where-Object { $_ -like "Fragile AGENTS*" })) {
    Write-Host "  OK    no AGENTS.md section-number references"
}

Write-Host ""
Write-Host "[5/5] Wrong-case Claude references (CLAUDE.md)"
$claudeAllowlist = @(
    # Intentionally empty — add relative paths here only for documented historical literals.
)
foreach ($file in $scanFiles) {
    $rel = $file.Substring($RepoRoot.Path.Length).TrimStart('\', '/')
    if ($claudeAllowlist -contains $rel) { continue }
    $lineNum = 0
    Get-Content -Path $file | ForEach-Object {
        $lineNum++
        if ($_ -cmatch 'CLAUDE\.md') {
            Add-Failure "Use claude.md (lowercase) in ${rel}:${lineNum}: $_"
        }
    }
}
if (-not ($failures | Where-Object { $_ -like "Use claude.md*" })) {
    Write-Host "  OK    no incorrect CLAUDE.md references"
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "GOVERNANCE CHECK FAILED ($($failures.Count) issue(s)):" -ForegroundColor Red
    foreach ($item in $failures) {
        Write-Host "  - $item" -ForegroundColor Red
    }
    exit 1
}

Write-Host "GOVERNANCE CHECK PASSED" -ForegroundColor Green
exit 0
