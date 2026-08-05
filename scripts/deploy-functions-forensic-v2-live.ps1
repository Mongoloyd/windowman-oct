# Deploy approved Forensic V2 Edge Functions to the staging target (zgsofkgddpcntdvpckdq).
# Scope: CRM emitters + TikTok dry-run dispatch lane (Sprint 3C-5A).
# Google-only mode (-GoogleAdsOnly): google-ads-conversion-event only (Sprint 4C).
# Dispatch-only mode (-DispatchOnly): dispatch-platform-events only (Sprint 4F-C).
# Admin-only mode (-AdminDataOnly): exact clean detached release worktree only (Admin Recovery 1E).
# Never deploy-all, never --prune, never db push/reset/secrets/typegen.
param(
    [switch]$GoogleAdsOnly,
    [switch]$DispatchOnly,
    [switch]$AdminDataOnly,
    [switch]$DryRun,
    [string]$FunctionName,
    [string]$ReleaseWorktree,
    [string]$ReleaseCommit,
    [ValidateSet("Deploy", "Rollback")]
    [string]$AdminOperation = "Deploy",
    [ValidateSet("Artifact", "Version")]
    [string]$RollbackMethod = "Artifact",
    [int]$RollbackVersion,
    [string]$CurrentVersion,
    [string]$CurrentFunctionId,
    [string]$CurrentDeployedHash,
    [string]$EvidencePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ScriptBoundParameters = @{} + $PSBoundParameters

$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ForbiddenRefs = @(
    "wkrcyxcnzhwjtdpmfpaf",
    "aqyptdxsbxqpbgoecykx",
    "wm-mvp-forensic-v2-local"
)
$RequiredBranch = "forensic_report_v2"
$ConfirmPhrase = "DEPLOY_FORENSIC_V2_LIVE_FUNCTIONS"
$AdminDeployConfirmPhrase = "DEPLOY_ADMIN_DATA_LIVE"
$AdminRollbackConfirmPhrase = "ROLLBACK_ADMIN_DATA_LIVE"
$AdminFunctionName = "admin-data"
$ApprovedAdminDeployCommit = "d2c48b52a1e1fe368eaa84ae55548ae0a3565439"
$ApprovedAdminRollbackVersion = 16
$ApprovedAdminRollbackCommit = "dd960a6f19247e693a61cf1b0913e94d4170b0cc"
$DefaultTargetFunctions = @(
    "start-upload-scan-session",
    "capture-truth-gate-lead",
    "capture-arbitrage-lead",
    "capture-power-tool-demo-lead",
    "dispatch-platform-events",
    "tiktok-capi-event"
)
$GoogleAdsOnlyTargetFunctions = @(
    "google-ads-conversion-event"
)
$DispatchOnlyTargetFunctions = @(
    "dispatch-platform-events"
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

function Invoke-GitText {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string[]]$GitArgs,
        [Parameter(Mandatory = $true)][int]$ExitCode,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    $Output = (& git -C $Worktree @GitArgs 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        Fail $ExitCode $FailureMessage
    }
    return $Output
}

function Test-PathWithinRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Candidate
    )

    $RootFull = [System.IO.Path]::GetFullPath($Root)
    $CandidateFull = [System.IO.Path]::GetFullPath($Candidate)
    $RootPrefix = $RootFull.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) +
        [System.IO.Path]::DirectorySeparatorChar
    return $CandidateFull.Equals($RootFull, [System.StringComparison]::OrdinalIgnoreCase) -or
        $CandidateFull.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-AbsoluteGitDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string]$GitDirectoryArgument
    )

    $GitDirectory = Invoke-GitText -Worktree $Worktree `
        -GitArgs @("rev-parse", $GitDirectoryArgument) `
        -ExitCode 65 `
        -FailureMessage "Unable to resolve Git repository provenance."
    if (-not [System.IO.Path]::IsPathRooted($GitDirectory)) {
        $GitDirectory = Join-Path $Worktree $GitDirectory
    }
    return [System.IO.Path]::GetFullPath($GitDirectory).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Get-AdminBundleFiles {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string]$Commit
    )

    $EntryPath = Join-Path $Worktree "supabase/functions/admin-data/index.ts"
    if (-not (Test-Path -LiteralPath $EntryPath -PathType Leaf)) {
        Fail 66 "Refusing admin-data action: function source is missing at '$EntryPath'."
    }

    $Pending = New-Object System.Collections.Stack
    $Pending.Push([System.IO.Path]::GetFullPath($EntryPath))
    $Seen = @{}
    $Bundle = New-Object System.Collections.Generic.List[string]
    $ImportPattern = @'
(?ms)(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](?<path>\.{1,2}/[^"']+)["']
'@

    while ($Pending.Count -gt 0) {
        $CurrentPath = [string]$Pending.Pop()
        $CurrentPath = [System.IO.Path]::GetFullPath($CurrentPath)
        if (-not (Test-PathWithinRoot -Root $Worktree -Candidate $CurrentPath)) {
            Fail 67 "Refusing admin-data action: local import escapes the release worktree."
        }
        if ($Seen.ContainsKey($CurrentPath)) {
            continue
        }
        $Seen[$CurrentPath] = $true

        if (-not (Test-Path -LiteralPath $CurrentPath -PathType Leaf)) {
            Fail 68 "Refusing admin-data action: imported local file is missing: '$CurrentPath'."
        }

        $RelativePath = $CurrentPath.Substring($Worktree.Length).TrimStart('\', '/').Replace('\', '/')
        [void](Invoke-GitText -Worktree $Worktree `
            -GitArgs @("ls-files", "--error-unmatch", "--", $RelativePath) `
            -ExitCode 69 `
            -FailureMessage "Refusing admin-data action: local bundle file is not committed: '$RelativePath'.")

        $CommittedBlob = Invoke-GitText -Worktree $Worktree `
            -GitArgs @("rev-parse", "$Commit`:$RelativePath") `
            -ExitCode 70 `
            -FailureMessage "Refusing admin-data action: '$RelativePath' is absent from release commit $Commit."
        $WorkingBlob = Invoke-GitText -Worktree $Worktree `
            -GitArgs @("hash-object", "--", $CurrentPath) `
            -ExitCode 71 `
            -FailureMessage "Unable to hash local bundle file '$RelativePath'."
        if ($WorkingBlob -ne $CommittedBlob) {
            Fail 72 "Refusing admin-data action: working file hash differs from release commit for '$RelativePath'."
        }

        $Bundle.Add($RelativePath)
        $Content = Get-Content -LiteralPath $CurrentPath -Raw
        foreach ($Match in [regex]::Matches($Content, $ImportPattern)) {
            $ImportPath = $Match.Groups["path"].Value
            $ResolvedImport = [System.IO.Path]::GetFullPath(
                (Join-Path (Split-Path -Parent $CurrentPath) $ImportPath)
            )
            $Pending.Push($ResolvedImport)
        }
    }

    $AdminAuthRelative = "supabase/functions/_shared/adminAuth.ts"
    if (-not $Bundle.Contains($AdminAuthRelative)) {
        Fail 73 "Refusing admin-data action: expected adminAuth.ts dependency is absent from the local bundle."
    }
    $AdminAuthBlob = Invoke-GitText -Worktree $Worktree `
        -GitArgs @("rev-parse", "$Commit`:$AdminAuthRelative") `
        -ExitCode 74 `
        -FailureMessage "Unable to resolve committed adminAuth.ts hash."
    Write-Host "adminAuth.ts committed/working blob match: $AdminAuthBlob"

    return @($Bundle | Sort-Object)
}

function Invoke-AdminValidation {
    param([Parameter(Mandatory = $true)][string]$Worktree)

    $DenoCmd = Get-Command deno -ErrorAction SilentlyContinue
    if (-not $DenoCmd) {
        Fail 75 "deno not found on PATH. Admin-data validation is mandatory."
    }

    $ValidationCommands = @(
        @{
            Name = "admin-data Deno tests"
            Args = @("test", "--no-lock", "supabase/functions/admin-data")
        },
        @{
            Name = "OTP observability focused tests"
            Args = @("test", "--no-lock", "supabase/functions/_shared/otpObservability.test.ts")
        },
        @{
            Name = "complete admin-data Deno check"
            Args = @("check", "--no-lock", "supabase/functions/admin-data/index.ts")
        }
    )

    Push-Location $Worktree
    try {
        foreach ($Validation in $ValidationCommands) {
            Write-Host "Validation: $($Validation.Name)"
            & $DenoCmd.Source @($Validation.Args)
            if ($LASTEXITCODE -ne 0) {
                Fail 76 "Refusing admin-data action: '$($Validation.Name)' failed (exit $LASTEXITCODE)."
            }
        }
    }
    finally {
        Pop-Location
    }
}

function Assert-AdminMetadataInputs {
    param([Parameter(Mandatory = $true)][bool]$Required)

    $AnyProvided = -not [string]::IsNullOrWhiteSpace($CurrentVersion) -or
        -not [string]::IsNullOrWhiteSpace($CurrentFunctionId) -or
        -not [string]::IsNullOrWhiteSpace($CurrentDeployedHash)
    if ($Required -and -not $AnyProvided) {
        Fail 77 "Current deployment metadata is required before a non-dry-run admin-data action."
    }
    if ($AnyProvided -and (
        [string]::IsNullOrWhiteSpace($CurrentVersion) -or
        [string]::IsNullOrWhiteSpace($CurrentFunctionId) -or
        [string]::IsNullOrWhiteSpace($CurrentDeployedHash)
    )) {
        Fail 78 "CurrentVersion, CurrentFunctionId, and CurrentDeployedHash must be supplied together."
    }
    if (-not $AnyProvided) {
        return
    }

    if ($CurrentVersion -notmatch '^[1-9][0-9]*$') {
        Fail 79 "CurrentVersion must be a positive integer."
    }
    $ParsedFunctionId = [guid]::Empty
    if (-not [guid]::TryParse($CurrentFunctionId, [ref]$ParsedFunctionId)) {
        Fail 80 "CurrentFunctionId must be a valid UUID."
    }
    if ($CurrentDeployedHash -cnotmatch '^[0-9a-f]{64}$') {
        Fail 81 "CurrentDeployedHash must be a lowercase 64-character SHA-256 value."
    }
}

function Get-RemoteAdminMetadata {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRef,
        [Parameter(Mandatory = $true)][string]$ExpectedFunction
    )

    $NpxCmd = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $NpxCmd) {
        Fail 82 "npx not found on PATH. Remote metadata capture is mandatory before a real admin-data action."
    }

    $RawMetadata = (& npx supabase functions list --project-ref $ProjectRef --output json 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        Fail 83 "Unable to capture current non-secret Edge Function metadata."
    }
    try {
        $ParsedMetadata = $RawMetadata | ConvertFrom-Json
    } catch {
        Fail 84 "Unable to parse current Edge Function metadata as JSON."
    }

    $Rows = if ($ParsedMetadata.PSObject.Properties.Name -contains "functions") {
        @($ParsedMetadata.functions)
    } else {
        @($ParsedMetadata)
    }
    $FunctionRow = @($Rows | Where-Object {
        ($_.name -eq $ExpectedFunction) -or ($_.slug -eq $ExpectedFunction)
    })
    if ($FunctionRow.Count -ne 1) {
        Fail 85 "Current metadata did not contain exactly one '$ExpectedFunction' function."
    }
    $FunctionRow = $FunctionRow[0]

    $RemoteId = [string]$FunctionRow.id
    $RemoteVersion = [string]$FunctionRow.version
    if ($RemoteId -ne $CurrentFunctionId -or $RemoteVersion -ne $CurrentVersion) {
        Fail 86 "Current deployment metadata differs from the operator-reconfirmed ID/version."
    }

    $RemoteHash = $null
    foreach ($HashProperty in @("sha256", "deployment_hash", "checksum")) {
        if ($FunctionRow.PSObject.Properties.Name -contains $HashProperty) {
            $CandidateHash = [string]$FunctionRow.$HashProperty
            if (-not [string]::IsNullOrWhiteSpace($CandidateHash)) {
                $RemoteHash = $CandidateHash
                break
            }
        }
    }
    if ($RemoteHash -and $RemoteHash -ne $CurrentDeployedHash) {
        Fail 87 "Current deployed hash differs from the operator-reconfirmed hash."
    }

    return [ordered]@{
        version = $RemoteVersion
        function_id = $RemoteId
        deployed_hash = $(if ($RemoteHash) { $RemoteHash } else { $CurrentDeployedHash })
        deployed_hash_source = $(if ($RemoteHash) { "remote-list" } else { "operator-reconfirmed" })
        capture_status = "REMOTE_READ_CONFIRMED"
    }
}

function Write-AdminEvidence {
    param(
        [Parameter(Mandatory = $true)]$Evidence,
        [Parameter(Mandatory = $true)][string]$Worktree
    )

    $EvidenceJson = $Evidence | ConvertTo-Json -Depth 8
    Write-Host ""
    Write-Host "=== SANITIZED ADMIN-DATA EVIDENCE ==="
    Write-Host $EvidenceJson

    if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
        return
    }
    $EvidenceFullPath = [System.IO.Path]::GetFullPath($EvidencePath)
    if (Test-PathWithinRoot -Root $Worktree -Candidate $EvidenceFullPath) {
        Fail 88 "EvidencePath must be outside the clean release worktree."
    }
    $PrimaryRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    if (Test-PathWithinRoot -Root $PrimaryRepoRoot -Candidate $EvidenceFullPath) {
        Fail 88 "EvidencePath must be outside the primary repository."
    }
    $EvidenceParent = Split-Path -Parent $EvidenceFullPath
    if ([string]::IsNullOrWhiteSpace($EvidenceParent) -or -not (Test-Path -LiteralPath $EvidenceParent -PathType Container)) {
        Fail 89 "EvidencePath parent directory must already exist."
    }
    Set-Content -LiteralPath $EvidenceFullPath -Value $EvidenceJson -Encoding UTF8
    Write-Host "Sanitized evidence written to: $EvidenceFullPath"
}

function Invoke-AdminDataMode {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

    if ($GoogleAdsOnly -or $DispatchOnly) {
        Fail 60 "SAFETY STOP: -AdminDataOnly is mutually exclusive with all other deployment modes."
    }
    if ([string]::IsNullOrWhiteSpace($FunctionName)) {
        Fail 61 "FunctionName is required for -AdminDataOnly."
    }
    if ($FunctionName -cnotmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$' -or $FunctionName -cne $AdminFunctionName) {
        Fail 62 "Refusing admin-data action: FunctionName must be exactly '$AdminFunctionName'."
    }

    $ProjectRef = $env:SUPABASE_PROJECT_REF
    if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
        Fail 20 "SUPABASE_PROJECT_REF is unset or blank."
    }
    $ProjectRef = $ProjectRef.Trim()
    if ($ProjectRef -cne $ApprovedRef) {
        Fail 22 "Refusing admin-data action: project ref must be exactly '$ApprovedRef'."
    }

    if ([string]::IsNullOrWhiteSpace($ReleaseWorktree) -or -not (Test-Path -LiteralPath $ReleaseWorktree -PathType Container)) {
        Fail 63 "ReleaseWorktree must name an existing directory; no fallback checkout is allowed."
    }
    if ([string]::IsNullOrWhiteSpace($ReleaseCommit) -or $ReleaseCommit -cnotmatch '^[0-9a-f]{40}$') {
        Fail 64 "ReleaseCommit must be an exact lowercase 40-character commit SHA."
    }

    $ResolvedWorktree = (Resolve-Path -LiteralPath $ReleaseWorktree).Path
    $InsideWorkTree = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("rev-parse", "--is-inside-work-tree") `
        -ExitCode 65 `
        -FailureMessage "ReleaseWorktree is not a Git worktree."
    if ($InsideWorkTree -ne "true") {
        Fail 65 "ReleaseWorktree is not a Git worktree."
    }
    $WorktreeRoot = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("rev-parse", "--show-toplevel") `
        -ExitCode 65 `
        -FailureMessage "Unable to resolve release worktree root."
    $WorktreeRoot = (Resolve-Path -LiteralPath $WorktreeRoot).Path
    if (-not $WorktreeRoot.Equals($ResolvedWorktree, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 65 "ReleaseWorktree must point to the exact Git worktree root."
    }

    $CanonicalRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $CanonicalCommonDirectory = Get-AbsoluteGitDirectory `
        -Worktree $CanonicalRepoRoot `
        -GitDirectoryArgument "--git-common-dir"
    $ReleaseCommonDirectory = Get-AbsoluteGitDirectory `
        -Worktree $ResolvedWorktree `
        -GitDirectoryArgument "--git-common-dir"
    if (-not $ReleaseCommonDirectory.Equals($CanonicalCommonDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 65 "ReleaseWorktree does not belong to the canonical repository."
    }

    $RegisteredWorktrees = Invoke-GitText -Worktree $CanonicalRepoRoot `
        -GitArgs @("worktree", "list", "--porcelain") `
        -ExitCode 65 `
        -FailureMessage "Unable to inspect canonical registered worktrees."
    $IsRegisteredWorktree = $false
    foreach ($WorktreeLine in ($RegisteredWorktrees -split "\r?\n")) {
        if ($WorktreeLine.StartsWith("worktree ")) {
            $RegisteredPath = [System.IO.Path]::GetFullPath($WorktreeLine.Substring(9))
            if ($RegisteredPath.Equals($ResolvedWorktree, [System.StringComparison]::OrdinalIgnoreCase)) {
                $IsRegisteredWorktree = $true
                break
            }
        }
    }
    if (-not $IsRegisteredWorktree) {
        Fail 65 "ReleaseWorktree is not registered by the canonical repository."
    }

    $Branch = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("branch", "--show-current") `
        -ExitCode 65 `
        -FailureMessage "Unable to inspect release worktree branch state."
    if (-not [string]::IsNullOrWhiteSpace($Branch)) {
        Fail 90 "Refusing admin-data action: release worktree must have detached HEAD (found branch '$Branch')."
    }
    $HeadSha = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("rev-parse", "HEAD") `
        -ExitCode 65 `
        -FailureMessage "Unable to inspect release worktree HEAD."
    if ($HeadSha -cne $ReleaseCommit) {
        Fail 91 "Refusing admin-data action: HEAD '$HeadSha' does not equal requested commit '$ReleaseCommit'."
    }
    if ($AdminOperation -eq "Deploy" -and $ReleaseCommit -cne $ApprovedAdminDeployCommit) {
        Fail 91 "Deploy requires approved release commit '$ApprovedAdminDeployCommit'."
    }
    $Dirty = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("status", "--porcelain=v1", "--untracked-files=all") `
        -ExitCode 65 `
        -FailureMessage "Unable to inspect release worktree status."
    if (-not [string]::IsNullOrWhiteSpace($Dirty)) {
        Fail 92 "Refusing admin-data action: release worktree has staged, unstaged, or untracked files."
    }

    if ($AdminOperation -eq "Rollback") {
        if ($RollbackMethod -eq "Artifact") {
            if ($ReleaseCommit -cne $ApprovedAdminRollbackCommit) {
                Fail 93 "Artifact rollback requires approved commit '$ApprovedAdminRollbackCommit'."
            }
            if ($ScriptBoundParameters.ContainsKey("RollbackVersion")) {
                Fail 94 "RollbackVersion cannot be combined with artifact rollback."
            }
        } else {
            if ($ReleaseCommit -cne $ApprovedAdminDeployCommit) {
                Fail 95 "Version rollback preparation requires approved release evidence commit '$ApprovedAdminDeployCommit'."
            }
            if ($RollbackVersion -ne $ApprovedAdminRollbackVersion) {
                Fail 95 "Version rollback preparation allows only recorded version $ApprovedAdminRollbackVersion."
            }
            if (-not $DryRun) {
                Fail 96 "Version rollback is preparation-only; use approved artifact rollback for wrapper execution."
            }
        }
    } elseif ($ScriptBoundParameters.ContainsKey("RollbackVersion")) {
        Fail 97 "RollbackVersion is valid only for rollback operation."
    }

    Assert-AdminMetadataInputs -Required (-not $DryRun)
    $BundleFiles = Get-AdminBundleFiles -Worktree $ResolvedWorktree -Commit $ReleaseCommit
    Invoke-AdminValidation -Worktree $ResolvedWorktree
    $PostValidationDirty = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("status", "--porcelain=v1", "--untracked-files=all") `
        -ExitCode 65 `
        -FailureMessage "Unable to re-inspect release worktree after validation."
    if (-not [string]::IsNullOrWhiteSpace($PostValidationDirty)) {
        Fail 92 "Refusing admin-data action: validation modified the clean release worktree."
    }

    $DeployCommand = "npx supabase functions deploy $AdminFunctionName --project-ref $ApprovedRef"
    $CurrentMetadata = if ($DryRun) {
        [ordered]@{
            version = $(if ([string]::IsNullOrWhiteSpace($CurrentVersion)) { "NOT_SUPPLIED" } else { $CurrentVersion })
            function_id = $(if ([string]::IsNullOrWhiteSpace($CurrentFunctionId)) { "NOT_SUPPLIED" } else { $CurrentFunctionId })
            deployed_hash = $(if ([string]::IsNullOrWhiteSpace($CurrentDeployedHash)) { "NOT_SUPPLIED" } else { $CurrentDeployedHash })
            deployed_hash_source = "operator-expected"
            capture_status = "REMOTE_NOT_QUERIED_DRY_RUN"
        }
    } else {
        Get-RemoteAdminMetadata -ProjectRef $ProjectRef -ExpectedFunction $AdminFunctionName
    }

    $IntendedAction = if ($AdminOperation -eq "Rollback" -and $RollbackMethod -eq "Version") {
        "Prepare human dashboard rollback of admin-data to recorded version $ApprovedAdminRollbackVersion"
    } elseif ($AdminOperation -eq "Rollback") {
        "Redeploy approved rollback artifact commit $ApprovedAdminRollbackCommit"
    } else {
        "Deploy admin-data from exact release commit $ReleaseCommit"
    }
    $Evidence = [ordered]@{
        project_ref = $ProjectRef
        function_name = $AdminFunctionName
        operation = $AdminOperation
        rollback_method = $(if ($AdminOperation -eq "Rollback") { $RollbackMethod } else { "NOT_APPLICABLE" })
        rollback_version = $(if ($AdminOperation -eq "Rollback" -and $RollbackMethod -eq "Version") { $ApprovedAdminRollbackVersion } else { $null })
        current_deployment = $CurrentMetadata
        release_commit = $ReleaseCommit
        release_worktree = $ResolvedWorktree
        detached_head = $true
        clean_worktree = $true
        validation_status = "PASSED"
        bundle_files = $BundleFiles
        intended_action = $IntendedAction
        command = $(if ($AdminOperation -eq "Rollback" -and $RollbackMethod -eq "Version") {
            "NO CLI COMMAND: human Supabase Dashboard version rollback preparation only"
        } else {
            $DeployCommand
        })
        dry_run = [bool]$DryRun
    }

    Write-Host ""
    Write-Host "=== ADMIN-DATA ACTION SUMMARY ==="
    Write-Host "Project ref:          $ProjectRef"
    Write-Host "Function:             $AdminFunctionName"
    Write-Host "Operation:            $AdminOperation"
    Write-Host "Release worktree:     $ResolvedWorktree"
    Write-Host "Exact release commit: $ReleaseCommit"
    Write-Host "Validation status:    PASSED"
    Write-Host "Expected bundle files:"
    foreach ($BundleFile in $BundleFiles) {
        Write-Host "  - $BundleFile"
    }
    Write-Host "Intended action:      $IntendedAction"
    Write-Host "Intended command:     $($Evidence.command)"
    Write-AdminEvidence -Evidence $Evidence -Worktree $ResolvedWorktree

    if ($DryRun) {
        Write-Host ""
        Write-Host ("DRY RUN {0} NO DEPLOYMENT PERFORMED" -f [char]0x2014)
        exit 0
    }

    $AdminConfirmPhrase = if ($AdminOperation -eq "Rollback") {
        $AdminRollbackConfirmPhrase
    } else {
        $AdminDeployConfirmPhrase
    }
    Write-Host ""
    Write-Host "Type exactly: $AdminConfirmPhrase"
    $Typed = Read-Host "Confirmation"
    if ($Typed -ne $AdminConfirmPhrase) {
        Fail 98 "Admin-data action aborted: confirmation phrase mismatch."
    }

    Push-Location $ResolvedWorktree
    try {
        & npx supabase functions deploy $AdminFunctionName --project-ref $ApprovedRef
        if ($LASTEXITCODE -ne 0) {
            Fail 99 "Admin-data $AdminOperation failed (exit $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "Admin-data $AdminOperation complete. Run the separately authorized production smoke test."
    exit 0
}

if ($AdminDataOnly) {
    Invoke-AdminDataMode
}
if ($DryRun -or
    -not [string]::IsNullOrWhiteSpace($FunctionName) -or
    -not [string]::IsNullOrWhiteSpace($ReleaseWorktree) -or
    -not [string]::IsNullOrWhiteSpace($ReleaseCommit) -or
    $ScriptBoundParameters.ContainsKey("AdminOperation") -or
    $ScriptBoundParameters.ContainsKey("RollbackMethod") -or
    $ScriptBoundParameters.ContainsKey("RollbackVersion") -or
    -not [string]::IsNullOrWhiteSpace($CurrentVersion) -or
    -not [string]::IsNullOrWhiteSpace($CurrentFunctionId) -or
    -not [string]::IsNullOrWhiteSpace($CurrentDeployedHash) -or
    -not [string]::IsNullOrWhiteSpace($EvidencePath)) {
    Fail 59 "Admin-data parameters require -AdminDataOnly."
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

if ($GoogleAdsOnly -and $DispatchOnly) {
    Fail 15 "SAFETY STOP: -GoogleAdsOnly and -DispatchOnly are mutually exclusive."
}

if ($GoogleAdsOnly) {
    $TargetFunctions = $GoogleAdsOnlyTargetFunctions
    $DeployCommands = @(
        "npx supabase functions deploy google-ads-conversion-event --project-ref $ApprovedRef"
    )
    $DeploySummaryTitle = "Google Ads 4C dry-run sender only"
    $DeployNextStep = "Next: run Google Ads 4C direct dry-run smoke (see docs/ops/GOOGLE_ADS_4C_DRY_RUN_SCAFFOLD_RUNBOOK.md)."
} elseif ($DispatchOnly) {
    $TargetFunctions = $DispatchOnlyTargetFunctions
    $DeployCommands = @(
        "npx supabase functions deploy dispatch-platform-events --project-ref $ApprovedRef"
    )
    $DeploySummaryTitle = "Dispatch platform events worker only"
    $DeployNextStep = "Next: run Google Ads 4F-C scoped dispatch dry-run smoke."
} else {
    $TargetFunctions = $DefaultTargetFunctions
    $DeployCommands = @(
        "npx supabase functions deploy start-upload-scan-session --project-ref $ApprovedRef",
        "npx supabase functions deploy capture-truth-gate-lead --project-ref $ApprovedRef",
        "npx supabase functions deploy capture-arbitrage-lead --project-ref $ApprovedRef",
        "npx supabase functions deploy capture-power-tool-demo-lead --project-ref $ApprovedRef",
        "npx supabase functions deploy dispatch-platform-events --project-ref $ApprovedRef",
        "npx supabase functions deploy tiktok-capi-event --project-ref $ApprovedRef"
    )
    $DeploySummaryTitle = "CRM emitters + TikTok dry-run dispatch"
    $DeployNextStep = "Next: run TikTok 3C-5 staging dry-run smoke (see docs/ops/TIKTOK_3C5_STAGING_DRY_RUN_RUNBOOK.md)."
}

Write-Host ""
Write-Host "=== DEPLOY SUMMARY ($DeploySummaryTitle) ==="
Write-Host "Branch:              $Branch"
Write-Host "HEAD SHA:            $HeadSha"
Write-Host "Approved target ref: $ApprovedRef"
Write-Host "SUPABASE_PROJECT_REF: $ProjectRef"
Write-Host "Linked ref (if any): $(if ($LinkedRef) { $LinkedRef } else { '(none)' })"
Write-Host "GoogleAdsOnly mode:  $(if ($GoogleAdsOnly) { 'true' } else { 'false' })"
Write-Host "DispatchOnly mode:   $(if ($DispatchOnly) { 'true' } else { 'false' })"
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
Write-Host $DeployNextStep
Write-Host "This script did NOT run smoke tests, secrets set, db push, typegen, or --prune."
exit 0
