# Deploy approved Forensic V2 Edge Functions to the staging target (zgsofkgddpcntdvpckdq).
# Scope: CRM emitters + TikTok dry-run dispatch lane (Sprint 3C-5A).
# Google-only mode (-GoogleAdsOnly): google-ads-conversion-event only (Sprint 4C).
# Dispatch-only mode (-DispatchOnly): dispatch-platform-events only (Sprint 4F-C).
# Admin-only mode (-AdminDataOnly): exact clean detached release worktree only (Admin Recovery 1E).
# PR 173 mode (-Pr173ExtractionOnly): scan-quote, send-contractor-handoff, dial-lead only,
#   gated on a read-only remote migration-ledger prerequisite check (Sprint 6A).
# Quote-intelligence worker mode (-QuoteIntelligenceWorkerOnly): quote-intelligence-worker only
#   (Sprint QI Worker-Only Deploy Wrapper V1).
# Never deploy-all, never --prune, never db push/reset/secrets/typegen.
param(
    [switch]$GoogleAdsOnly,
    [switch]$DispatchOnly,
    [switch]$AdminDataOnly,
    [switch]$Pr173ExtractionOnly,
    [switch]$WmChatOnly,
    [switch]$QuoteIntelligenceWorkerOnly,
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
$AdminAmbiguousExitCode = 106
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
$Pr173ConfirmPhrase = "DEPLOY_PR173_FUNCTIONS_AFTER_MIGRATIONS_VERIFIED"
$Pr173TargetFunctions = @(
    "scan-quote",
    "send-contractor-handoff",
    "dial-lead"
)
$Pr173RequiredMigrations = @(
    "20260806144716",
    "20260808160000",
    "20260808170000",
    "20260808180000"
)
$WmChatConfirmPhrase = "DEPLOY_WMCHAT_LIVE_FUNCTIONS"
$WmChatApprovedSourceCommit = "3931252356e8c0c21934c4f49ec6789a11c6acd6"
$WmChatApprovedOriginUrl = "https://github.com/Mongoloyd/wm-mvp.git"
$WmChatTargetFunctions = @(
    "start-upload-scan-session",
    "capture-truth-gate-lead"
)
$WmChatRequiredMigrations = @(
    "20260801143000",
    "20260816022737"
)
$QuoteIntelligenceWorkerConfirmPhrase = "DEPLOY_QUOTE_INTELLIGENCE_WORKER_LIVE"
$QuoteIntelligenceWorkerTargetFunctions = @(
    "quote-intelligence-worker"
)
$WmChatAmbiguousExitCode = 116
$WmChatRequiredDenoVersion = "2.1.4"
$NativeProcessDefaultTimeoutSeconds = 120
$NativeProcessDeployTimeoutSeconds = 600
$SensitiveEnvironmentNames = @(
    "SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_DATABASE_URL",
    "WMCHAT_LIVE_DATABASE_URL", "PGPASSWORD"
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

function Assert-Pr173FunctionSources {
    param([Parameter(Mandatory = $true)][string]$Worktree)

    Write-Host ""
    Write-Host "PR 173 source safeguards:"
    foreach ($Fn in $Pr173TargetFunctions) {
        $RelativeEntryPath = "supabase/functions/$Fn/index.ts"
        $EntryPath = Join-Path $Worktree $RelativeEntryPath
        if (-not (Test-Path -LiteralPath $EntryPath -PathType Leaf)) {
            Fail 102 "Refusing PR 173 deploy: function source is missing at '$EntryPath'."
        }
        Write-Host "  - $RelativeEntryPath present"
    }
}

function Assert-QuoteIntelligenceWorkerFunctionSource {
    param([Parameter(Mandatory = $true)][string]$Worktree)

    if ($QuoteIntelligenceWorkerTargetFunctions.Count -ne 1) {
        Fail 106 "Refusing quote-intelligence worker deploy: worker-only deploy set must contain exactly one function."
    }
    if ($QuoteIntelligenceWorkerTargetFunctions[0] -cne "quote-intelligence-worker") {
        Fail 106 "Refusing quote-intelligence worker deploy: worker-only deploy set must be quote-intelligence-worker."
    }

    Write-Host ""
    Write-Host "Quote-intelligence worker source safeguards:"
    foreach ($Fn in $QuoteIntelligenceWorkerTargetFunctions) {
        $RelativeEntryPath = "supabase/functions/$Fn/index.ts"
        $EntryPath = Join-Path $Worktree $RelativeEntryPath
        if (-not (Test-Path -LiteralPath $EntryPath -PathType Leaf)) {
            Fail 106 "Refusing quote-intelligence worker deploy: function source is missing at '$EntryPath'."
        }
        Write-Host "  - $RelativeEntryPath present"
    }
}

# Remote migration versions are only ever read from the REMOTE column. Every prerequisite file also
# appears in the LOCAL column, so both substring matching and a fixed column index would pass
# vacuously; the column position is therefore anchored to the header row and required to be found.
function Get-RemoteMigrationVersions {
    param([Parameter(Mandatory = $true)][string]$LedgerOutput)

    $Versions = New-Object System.Collections.Generic.List[string]
    $RemoteIndex = -1
    foreach ($Line in ($LedgerOutput -split "\r?\n")) {
        $Columns = [regex]::Split($Line, "[|\u2502]")
        if ($Columns.Count -lt 2) {
            continue
        }
        if ($RemoteIndex -lt 0) {
            for ($Index = 0; $Index -lt $Columns.Count; $Index++) {
                if ($Columns[$Index].Trim() -eq "REMOTE") {
                    $RemoteIndex = $Index
                    break
                }
            }
            continue
        }
        if ($Columns.Count -le $RemoteIndex) {
            continue
        }
        $RemoteCell = $Columns[$RemoteIndex].Trim()
        if ($RemoteCell -match '^\d{14}$') {
            [void]$Versions.Add($RemoteCell)
        }
    }

    return [pscustomobject]@{
        HeaderFound = ($RemoteIndex -ge 0)
        Versions = $Versions
    }
}

function Assert-Pr173MigrationPrerequisites {
    param([Parameter(Mandatory = $true)][string]$Worktree)

    Write-Host ""
    Write-Host "PR 173 migration prerequisite check (read-only, LIVE_ACTIVE ledger):"
    Write-Host "  npx supabase migration list --linked"

    Push-Location $Worktree
    try {
        # Empty stdin so an unexpected interactive password prompt hits EOF and fails closed
        # instead of hanging this wrapper in an ambiguous state.
        $LedgerOutput = ("" | & npx supabase migration list --linked 2>&1 | Out-String)
        $LedgerExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($LedgerExitCode -ne 0) {
        Fail 103 "Refusing PR 173 deploy: read-only remote migration list failed (exit $LedgerExitCode)."
    }

    $Parsed = Get-RemoteMigrationVersions -LedgerOutput $LedgerOutput
    if (-not $Parsed.HeaderFound) {
        Fail 104 "Refusing PR 173 deploy: remote migration ledger output had no identifiable REMOTE column header."
    }

    $Missing = New-Object System.Collections.Generic.List[string]
    foreach ($Version in $Pr173RequiredMigrations) {
        if ($Parsed.Versions -contains $Version) {
            Write-Host "  - $Version RECORDED remotely"
        } else {
            Write-Host "  - $Version MISSING remotely"
            [void]$Missing.Add($Version)
        }
    }

    if ($Missing.Count -gt 0) {
        Write-Host ""
        Write-Host "Missing remote migration versions:"
        foreach ($Version in $Missing) {
            Write-Host "  - $Version"
        }
        $MissingMessage = "Refusing PR 173 deploy: $($Missing.Count) prerequisite migration(s) are not recorded " +
            "on the linked ledger ($($Missing -join ', ')). Apply them through the separately authorized human " +
            "migration path first."
        Fail 105 $MissingMessage
    }

    Write-Host "All PR 173 prerequisite migrations are recorded remotely."
    Write-Host "This wrapper verifies migrations only; it never applies, repairs, or pushes them."
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
            -GitArgs @("hash-object", "--path", $RelativePath, "--", $CurrentPath) `
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

    $VersionProvided = -not [string]::IsNullOrWhiteSpace($CurrentVersion)
    $FunctionIdProvided = -not [string]::IsNullOrWhiteSpace($CurrentFunctionId)
    $HashProvided = -not [string]::IsNullOrWhiteSpace($CurrentDeployedHash)

    if ($Required -and -not ($VersionProvided -and $FunctionIdProvided)) {
        Fail 77 "Current deployment metadata (CurrentVersion and CurrentFunctionId) is required before a non-dry-run admin-data action."
    }
    if (($VersionProvided -or $FunctionIdProvided -or $HashProvided) -and -not ($VersionProvided -and $FunctionIdProvided)) {
        Fail 78 "CurrentVersion and CurrentFunctionId must be supplied together; CurrentDeployedHash is the optional operator-expected prior hash."
    }
    if (-not $VersionProvided) {
        return
    }

    if ($CurrentVersion -notmatch '^[1-9][0-9]*$') {
        Fail 79 "CurrentVersion must be a positive integer."
    }
    $ParsedFunctionId = [guid]::Empty
    if (-not [guid]::TryParse($CurrentFunctionId, [ref]$ParsedFunctionId)) {
        Fail 80 "CurrentFunctionId must be a valid UUID."
    }
    if ($HashProvided -and $CurrentDeployedHash -cnotmatch '^[0-9a-f]{64}$') {
        Fail 81 "CurrentDeployedHash must be a lowercase 64-character SHA-256 value."
    }
}

$script:BenignSupabaseCliStderrPatterns = @(
    '(?i)A new version of Supabase CLI is available'
)
$script:SupabaseCliResolved = $null

function Remove-AnsiEscapeSequence {
    param(
        [AllowEmptyString()]
        [string]$Text = ""
    )

    if ([string]::IsNullOrEmpty($Text)) {
        return ""
    }
    $Esc = [char]0x1B
    $Cleaned = [regex]::Replace($Text, "$Esc\[[0-9;?]*[ -/]*[@-~]", "")
    return $Cleaned.Replace([string]$Esc, "")
}

function Test-SupabaseCliStderrClassification {
    param(
        [AllowEmptyString()]
        [string]$Stderr = "",
        [string[]]$AllowedStderrPatterns = $script:BenignSupabaseCliStderrPatterns
    )

    $Stderr = Remove-AnsiEscapeSequence -Text $Stderr
    if ([string]::IsNullOrWhiteSpace($Stderr)) {
        return [pscustomobject]@{
            Status = "Clean"
            ToleratedDiagnostics = @()
            UnexpectedLines = @()
        }
    }

    $Tolerated = New-Object System.Collections.Generic.List[string]
    $Unexpected = New-Object System.Collections.Generic.List[string]
    foreach ($Line in ($Stderr -split "\r?\n")) {
        $Trimmed = $Line.Trim()
        if ([string]::IsNullOrWhiteSpace($Trimmed)) {
            continue
        }
        $IsTolerated = $false
        foreach ($Pattern in $AllowedStderrPatterns) {
            if ($Trimmed -match $Pattern) {
                $IsTolerated = $true
                break
            }
        }
        if ($IsTolerated) {
            [void]$Tolerated.Add($Trimmed)
        } else {
            [void]$Unexpected.Add($Trimmed)
        }
    }

    if ($Unexpected.Count -gt 0) {
        return [pscustomobject]@{
            Status = "Unexpected"
            ToleratedDiagnostics = @($Tolerated)
            UnexpectedLines = @($Unexpected)
        }
    }

    return [pscustomobject]@{
        Status = "ToleratedDiagnostics"
        ToleratedDiagnostics = @($Tolerated)
        UnexpectedLines = @()
    }
}

function Resolve-SupabaseCliInvocation {
    # Resolution order:
    #   1. Explicit unit-test mock override, loudly labeled.
    #   2. Repository-pinned node_modules/.bin/supabase.cmd.
    if ($script:SupabaseCliResolved) {
        return $script:SupabaseCliResolved
    }

    $Override = $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE
    if (-not [string]::IsNullOrWhiteSpace($Override)) {
        if (-not (Test-Path -LiteralPath $Override -PathType Leaf)) {
            Fail 82 "WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE is set but does not name an existing executable."
        }
        Write-Host "WARNING: TEST OVERRIDE ACTIVE - Supabase CLI is a unit-test mock injected via WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE."
        Write-Host "WARNING: This invocation is NEVER a production deployment path."
        $script:SupabaseCliResolved = [pscustomobject]@{
            FilePath = (Resolve-Path -LiteralPath $Override).Path
            LeadingArguments = @()
            SourceLabel = "TEST_OVERRIDE_MOCK_CLI"
        }
        return $script:SupabaseCliResolved
    }

    $WrapperRepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    $PinnedCli = Join-Path $WrapperRepoRoot "node_modules\.bin\supabase.cmd"
    if (Test-Path -LiteralPath $PinnedCli -PathType Leaf) {
        $script:SupabaseCliResolved = [pscustomobject]@{
            FilePath = $PinnedCli
            LeadingArguments = @()
            SourceLabel = "node_modules/.bin/supabase.cmd (repository-pinned)"
        }
        return $script:SupabaseCliResolved
    }

    Fail 82 "Repository-installed Supabase CLI is required at node_modules/.bin/supabase.cmd. Install repository dependencies from the reviewed lockfile before admin-data actions."
}

function Invoke-NativeProcessCaptured {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentTokens,
        [string]$WorkingDirectory,
        [int]$TimeoutSeconds = $NativeProcessDefaultTimeoutSeconds,
        [switch]$AllowRelativePathTokens
    )

    if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 1800) {
        Fail 82 "Refusing native CLI invocation: timeout is outside the approved 1-1800 second range."
    }
    foreach ($Token in $ArgumentTokens) {
        $IsSimpleToken = $Token -match '^-{0,2}[A-Za-z0-9][A-Za-z0-9._\-]*$'
        $IsRelativePathToken = $AllowRelativePathTokens -and
            $Token -match '^[A-Za-z0-9][A-Za-z0-9._/\-]*$' -and
            -not $Token.Contains("..") -and
            -not $Token.StartsWith("/")
        if (-not $IsSimpleToken -and -not $IsRelativePathToken) {
            Fail 82 "Refusing native CLI invocation: an argument token failed strict allowlist validation."
        }
    }

    $StdinFile = [System.IO.Path]::GetTempFileName()
    $StdoutFile = [System.IO.Path]::GetTempFileName()
    $StderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $ProcessFilePath = $FilePath
        $ProcessArgumentList = $ArgumentTokens
        if ($FilePath -match '\.(cmd|bat)$') {
            if ($FilePath.IndexOfAny([char[]]'"&|<>()^%!') -ge 0) {
                Fail 82 "Refusing native CLI invocation: batch executable path contains unsafe cmd.exe metacharacters."
            }
            $ProcessFilePath = "cmd.exe"
            $BatchCommand = if ($ArgumentTokens.Count -gt 0) {
                '""{0}" {1}"' -f $FilePath, ($ArgumentTokens -join " ")
            } else {
                '""{0}""' -f $FilePath
            }
            $ProcessArgumentList = @("/d", "/s", "/c", $BatchCommand)
        }
        $StartParameters = @{
            FilePath = $ProcessFilePath
            ArgumentList = $ProcessArgumentList
            RedirectStandardInput = $StdinFile
            RedirectStandardOutput = $StdoutFile
            RedirectStandardError = $StderrFile
            NoNewWindow = $true
            PassThru = $true
        }
        if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
            $StartParameters["WorkingDirectory"] = $WorkingDirectory
        }
        $Process = Start-Process @StartParameters
        $Completed = $Process.WaitForExit($TimeoutSeconds * 1000)
        if (-not $Completed) {
            try { $Process.Kill() } catch { }
            [void]$Process.WaitForExit()
        }
        $Stdout = Get-Content -LiteralPath $StdoutFile -Raw -ErrorAction SilentlyContinue
        $Stderr = Get-Content -LiteralPath $StderrFile -Raw -ErrorAction SilentlyContinue
        if ($null -eq $Stdout) { $Stdout = "" }
        if ($null -eq $Stderr) { $Stderr = "" }

        return [pscustomobject]@{
            ExitCode = $(if ($Completed) { $Process.ExitCode } else { 124 })
            TimedOut = (-not $Completed)
            Stdout = ($Stdout -replace "`r`n", "`n").Trim()
            Stderr = ($Stderr -replace "`r`n", "`n").Trim()
        }
    }
    finally {
        Remove-Item -LiteralPath $StdinFile,$StdoutFile,$StderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-SupabaseCliProcess {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$OperationName,
        [string[]]$AllowedStderrPatterns = $script:BenignSupabaseCliStderrPatterns,
        [int]$TimeoutSeconds = $NativeProcessDefaultTimeoutSeconds
    )

    $Cli = Resolve-SupabaseCliInvocation
    $AllTokens = @($Cli.LeadingArguments) + @($Arguments)
    $Captured = Invoke-NativeProcessCaptured `
        -FilePath $Cli.FilePath `
        -ArgumentTokens $AllTokens `
        -WorkingDirectory $WorkingDirectory `
        -TimeoutSeconds $TimeoutSeconds
    $Classification = Test-SupabaseCliStderrClassification `
        -Stderr $Captured.Stderr `
        -AllowedStderrPatterns $AllowedStderrPatterns

    return [pscustomobject]@{
        OperationName = $OperationName
        ExitCode = $Captured.ExitCode
        Stdout = $Captured.Stdout
        Stderr = $Captured.Stderr
        StderrClassification = $Classification
        CliSourceLabel = $Cli.SourceLabel
    }
}

function Get-RemoteAdminFunctionRow {
    # Read-only remote metadata discovery. Never exits; callers decide failure semantics.
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRef,
        [Parameter(Mandatory = $true)][string]$ExpectedFunction,
        [Parameter(Mandatory = $true)][string]$OperationName
    )

    $Invocation = Invoke-SupabaseCliProcess `
        -Arguments @("functions", "list", "--project-ref", $ProjectRef, "--output", "json") `
        -OperationName $OperationName

    if ($Invocation.ExitCode -ne 0) {
        return [pscustomobject]@{
            Ok = $false
            FailureCode = 83
            FailureMessage = "Unable to capture current non-secret Edge Function metadata (CLI exit $($Invocation.ExitCode)). Verify Supabase CLI authentication; the wrapper does not infer a single definitive cause."
            ToleratedDiagnostics = @()
        }
    }
    if ($Invocation.StderrClassification.Status -eq "Unexpected") {
        return [pscustomobject]@{
            Ok = $false
            FailureCode = 83
            FailureMessage = "Supabase CLI returned unexpected stderr while listing Edge Functions."
            ToleratedDiagnostics = @($Invocation.StderrClassification.ToleratedDiagnostics)
        }
    }

    $RawMetadata = $Invocation.Stdout
    $ParsedMetadata = $null
    if (-not [string]::IsNullOrWhiteSpace($RawMetadata)) {
        try {
            $ParsedMetadata = $RawMetadata | ConvertFrom-Json
        } catch {
            $ParsedMetadata = $null
        }
    }
    if ($null -eq $ParsedMetadata) {
        return [pscustomobject]@{
            Ok = $false
            FailureCode = 84
            FailureMessage = "Unable to parse current Edge Function metadata as JSON."
            ToleratedDiagnostics = @($Invocation.StderrClassification.ToleratedDiagnostics)
        }
    }

    $Rows = if ($ParsedMetadata.PSObject.Properties.Name -contains "functions") {
        @($ParsedMetadata.functions)
    } else {
        @($ParsedMetadata)
    }
    $FunctionRow = @($Rows | Where-Object {
        $RowName = if ($_.PSObject.Properties.Name -contains "name") { [string]$_.name } else { "" }
        $Slug = if ($_.PSObject.Properties.Name -contains "slug") { [string]$_.slug } else { "" }
        ($RowName -eq $ExpectedFunction) -or ($Slug -eq $ExpectedFunction)
    })
    if ($FunctionRow.Count -ne 1) {
        return [pscustomobject]@{
            Ok = $false
            FailureCode = 85
            FailureMessage = "Current metadata did not contain exactly one '$ExpectedFunction' function."
            ToleratedDiagnostics = @($Invocation.StderrClassification.ToleratedDiagnostics)
        }
    }
    $FunctionRow = $FunctionRow[0]

    $RemoteId = if ($FunctionRow.PSObject.Properties.Name -contains "id") {
        [string]$FunctionRow.id
    } else {
        ""
    }
    $RemoteVersion = if ($FunctionRow.PSObject.Properties.Name -contains "version") {
        [string]$FunctionRow.version
    } else {
        ""
    }
    $ParsedRemoteId = [guid]::Empty
    if ([string]::IsNullOrWhiteSpace($RemoteId) -or
        [string]::IsNullOrWhiteSpace($RemoteVersion) -or
        -not [guid]::TryParse($RemoteId, [ref]$ParsedRemoteId) -or
        $RemoteVersion -notmatch '^[1-9][0-9]*$') {
        return [pscustomobject]@{
            Ok = $false
            FailureCode = 85
            FailureMessage = "Current metadata for '$ExpectedFunction' is missing required id/version fields or they failed strict validation. This can indicate incomplete rows from an unauthenticated or partially authenticated Supabase CLI session."
            ToleratedDiagnostics = @($Invocation.StderrClassification.ToleratedDiagnostics)
        }
    }

    $RemoteHash = $null
    foreach ($HashProperty in @("ezbr_sha256", "sha256", "deployment_hash", "checksum")) {
        if ($FunctionRow.PSObject.Properties.Name -contains $HashProperty) {
            $CandidateHash = [string]$FunctionRow.$HashProperty
            if (-not [string]::IsNullOrWhiteSpace($CandidateHash)) {
                $RemoteHash = $CandidateHash
                break
            }
        }
    }

    return [pscustomobject]@{
        Ok = $true
        FunctionId = $RemoteId
        Version = [int64]$RemoteVersion
        RemoteHash = $RemoteHash
        ToleratedDiagnostics = @($Invocation.StderrClassification.ToleratedDiagnostics)
    }
}

function Get-VerifiedRemoteAdminMetadata {
    # Mandatory pre-action remote discovery (dry run included). Fails closed on any defect.
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRef,
        [Parameter(Mandatory = $true)][string]$ExpectedFunction
    )

    $Row = Get-RemoteAdminFunctionRow `
        -ProjectRef $ProjectRef `
        -ExpectedFunction $ExpectedFunction `
        -OperationName "pre-action functions list"
    if (-not $Row.Ok) {
        Fail $Row.FailureCode $Row.FailureMessage
    }
    foreach ($DiagnosticLine in $Row.ToleratedDiagnostics) {
        Write-Host "WARNING: Supabase CLI diagnostic (non-blocking): $DiagnosticLine"
    }

    $HasOperatorIdVersion = -not [string]::IsNullOrWhiteSpace($CurrentVersion) -and
        -not [string]::IsNullOrWhiteSpace($CurrentFunctionId)
    if ($HasOperatorIdVersion -and (
        $Row.FunctionId -ne $CurrentFunctionId -or ([string]$Row.Version) -ne $CurrentVersion
    )) {
        Fail 86 "Current deployment metadata differs from the operator-reconfirmed ID/version."
    }
    if ($Row.RemoteHash -and
        -not [string]::IsNullOrWhiteSpace($CurrentDeployedHash) -and
        $Row.RemoteHash -ne $CurrentDeployedHash) {
        Fail 87 "Current deployed hash differs from the operator-reconfirmed hash."
    }

    Write-Host "REMOTE_READ_CONFIRMED: '$ExpectedFunction' id $($Row.FunctionId), version $($Row.Version)."

    # Only authenticated remote-list values use remote_verified_* labels.
    # The operator-provided prior hash remains explicitly operator-expected.
    return [ordered]@{
        remote_verified_function_id = $Row.FunctionId
        remote_verified_version = $Row.Version
        remote_reported_hash = $(if ($Row.RemoteHash) { $Row.RemoteHash } else { "NOT_REPORTED_BY_REMOTE" })
        operator_reconfirmed_id_version = $(if ($HasOperatorIdVersion) { "SUPPLIED_AND_MATCHED" } else { "NOT_SUPPLIED" })
        operator_expected_prior_hash = $(if (-not [string]::IsNullOrWhiteSpace($CurrentDeployedHash)) { $CurrentDeployedHash } else { "NOT_SUPPLIED" })
        capture_status = "REMOTE_READ_CONFIRMED"
    }
}

function Get-SanitizedVersionLine {
    param(
        [Parameter(Mandatory = $true)][string]$Tool,
        [AllowEmptyString()][string]$Text = ""
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return "UNAVAILABLE"
    }
    $Line = (@($Text -split "\r?\n"))[0].Trim()
    $IsValid = switch ($Tool) {
        "supabase" { $Line -match '^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$'; break }
        "deno" { $Line -match '^deno\s+v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?(?:\s+\([^)]{1,64}\))?$'; break }
        "node" { $Line -match '^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$'; break }
        default { $false }
    }
    if (-not $IsValid) {
        return "UNAVAILABLE"
    }
    return $Line
}

function Get-ToolchainEvidence {
    # Sanitized versions/source labels only: no paths, environment values, or raw diagnostics.
    $CliInvocation = Invoke-SupabaseCliProcess -Arguments @("--version") -OperationName "supabase CLI version"
    if ($CliInvocation.ExitCode -ne 0 -or $CliInvocation.StderrClassification.Status -eq "Unexpected") {
        Fail 82 "Unable to record the Supabase CLI version (exit $($CliInvocation.ExitCode))."
    }
    $SupabaseVersion = Get-SanitizedVersionLine -Tool "supabase" -Text $CliInvocation.Stdout
    if ($SupabaseVersion -eq "UNAVAILABLE") {
        Fail 82 "Supabase CLI version output was empty or failed strict sanitization."
    }

    $DenoVersion = "UNAVAILABLE"
    $DenoCmd = @(Get-Command deno -CommandType Application -ErrorAction SilentlyContinue) |
        Select-Object -First 1
    if ($DenoCmd) {
        $DenoCaptured = Invoke-NativeProcessCaptured -FilePath $DenoCmd.Source -ArgumentTokens @("--version")
        if ($DenoCaptured.ExitCode -eq 0) {
            $DenoVersion = Get-SanitizedVersionLine -Tool "deno" -Text $DenoCaptured.Stdout
        }
    }

    $NodeVersion = "UNAVAILABLE"
    $NodeCmd = @(Get-Command node -CommandType Application -ErrorAction SilentlyContinue) |
        Select-Object -First 1
    if ($NodeCmd) {
        $NodeCaptured = Invoke-NativeProcessCaptured -FilePath $NodeCmd.Source -ArgumentTokens @("--version")
        if ($NodeCaptured.ExitCode -eq 0) {
            $NodeVersion = Get-SanitizedVersionLine -Tool "node" -Text $NodeCaptured.Stdout
        }
    }

    return [ordered]@{
        supabase_cli = $SupabaseVersion
        supabase_cli_source = (Resolve-SupabaseCliInvocation).SourceLabel
        deno = $DenoVersion
        node = $NodeVersion
        powershell = $PSVersionTable.PSVersion.ToString()
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
    $PrimaryRepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
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

function Write-WmChatDeployEvidence {
    param(
        [Parameter(Mandatory = $true)]$Evidence,
        [Parameter(Mandatory = $true)][string]$Worktree
    )

    $EvidenceJson = $Evidence | ConvertTo-Json -Depth 10
    Assert-EvidenceContainsNoSensitiveValues -EvidenceJson $EvidenceJson -ExitCode 117
    Write-Host ""
    Write-Host "=== SANITIZED WMCHAT DEPLOY EVIDENCE ==="
    Write-Host $EvidenceJson
    if ([string]::IsNullOrWhiteSpace($EvidencePath)) { return }

    $EvidenceFullPath = [System.IO.Path]::GetFullPath($EvidencePath)
    $PrimaryRepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    if ((Test-PathWithinRoot -Root $Worktree -Candidate $EvidenceFullPath) -or
        (Test-PathWithinRoot -Root $PrimaryRepoRoot -Candidate $EvidenceFullPath)) {
        Fail 117 "EvidencePath must be outside every repository worktree."
    }
    $EvidenceParent = Split-Path -Parent $EvidenceFullPath
    if ([string]::IsNullOrWhiteSpace($EvidenceParent) -or
        -not (Test-Path -LiteralPath $EvidenceParent -PathType Container)) {
        Fail 117 "EvidencePath parent directory must already exist."
    }
    if ((Test-Path -LiteralPath $EvidenceFullPath) -and
        ((Get-Item -LiteralPath $EvidenceFullPath -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        Fail 117 "EvidencePath must not be a reparse point."
    }
    $TemporaryPath = Join-Path $EvidenceParent (".{0}.{1}.tmp" -f ([System.IO.Path]::GetFileName($EvidenceFullPath)), [guid]::NewGuid())
    $BackupPath = Join-Path $EvidenceParent (".{0}.{1}.bak" -f ([System.IO.Path]::GetFileName($EvidenceFullPath)), [guid]::NewGuid())
    try {
        [System.IO.File]::WriteAllText(
            $TemporaryPath,
            $EvidenceJson,
            (New-Object System.Text.UTF8Encoding($false))
        )
        if (Test-Path -LiteralPath $EvidenceFullPath) {
            [System.IO.File]::Replace($TemporaryPath, $EvidenceFullPath, $BackupPath)
        } else {
            [System.IO.File]::Move($TemporaryPath, $EvidenceFullPath)
        }
    } finally {
        Remove-Item -LiteralPath $TemporaryPath,$BackupPath -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Sanitized evidence written to: $EvidenceFullPath"
}

function Get-WmChatBundleFiles {
    param([Parameter(Mandatory = $true)][string]$Worktree)

    $Pending = New-Object System.Collections.Stack
    foreach ($FunctionNameValue in $WmChatTargetFunctions) {
        $Pending.Push([System.IO.Path]::GetFullPath(
            (Join-Path $Worktree "supabase/functions/$FunctionNameValue/index.ts")
        ))
    }
    $Seen = @{}
    $Bundle = New-Object System.Collections.Generic.List[object]
    $ImportPattern = @'
(?ms)(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](?<path>\.{1,2}/[^"']+)["']
'@

    while ($Pending.Count -gt 0) {
        $CurrentPath = [System.IO.Path]::GetFullPath([string]$Pending.Pop())
        if (-not (Test-PathWithinRoot -Root $Worktree -Candidate $CurrentPath)) {
            Fail 118 "Refusing WmChat deploy: a local import escapes the release worktree."
        }
        if ($Seen.ContainsKey($CurrentPath)) { continue }
        $Seen[$CurrentPath] = $true
        if (-not (Test-Path -LiteralPath $CurrentPath -PathType Leaf)) {
            Fail 118 "Refusing WmChat deploy: imported source is missing: '$CurrentPath'."
        }

        $RelativePath = $CurrentPath.Substring($Worktree.Length).TrimStart('\', '/').Replace('\', '/')
        [void](Invoke-GitText -Worktree $Worktree `
            -GitArgs @("ls-files", "--error-unmatch", "--", $RelativePath) `
            -ExitCode 118 `
            -FailureMessage "Refusing WmChat deploy: bundle file is not committed: '$RelativePath'.")
        $ApprovedBlob = Invoke-GitText -Worktree $Worktree `
            -GitArgs @("rev-parse", "$WmChatApprovedSourceCommit`:$RelativePath") `
            -ExitCode 118 `
            -FailureMessage "Refusing WmChat deploy: '$RelativePath' is absent from approved source commit."
        $WorkingBlob = Invoke-GitText -Worktree $Worktree `
            -GitArgs @("hash-object", "--", $CurrentPath) `
            -ExitCode 118 `
            -FailureMessage "Unable to hash WmChat bundle file '$RelativePath'."
        if ($WorkingBlob -cne $ApprovedBlob) {
            Fail 118 "Refusing WmChat deploy: '$RelativePath' differs from approved source commit $WmChatApprovedSourceCommit."
        }
        [void]$Bundle.Add([ordered]@{
            path = $RelativePath
            git_blob = $ApprovedBlob
            sha256 = (Get-FileHash -LiteralPath $CurrentPath -Algorithm SHA256).Hash.ToLowerInvariant()
        })

        $Content = Get-Content -LiteralPath $CurrentPath -Raw
        foreach ($Match in [regex]::Matches($Content, $ImportPattern)) {
            $ImportPath = $Match.Groups["path"].Value
            $ResolvedImport = [System.IO.Path]::GetFullPath(
                (Join-Path (Split-Path -Parent $CurrentPath) $ImportPath)
            )
            $Pending.Push($ResolvedImport)
        }
    }

    foreach ($PinnedRelativePath in @("deno.json", "deno.lock", "supabase/config.toml")) {
        $PinnedPath = Join-Path $Worktree $PinnedRelativePath
        $ApprovedBlob = Invoke-GitText -Worktree $Worktree `
            -GitArgs @("rev-parse", "$WmChatApprovedSourceCommit`:$PinnedRelativePath") `
            -ExitCode 118 `
            -FailureMessage "Refusing WmChat deploy: approved runtime/config pin is missing: '$PinnedRelativePath'."
        $WorkingBlob = Invoke-GitText -Worktree $Worktree `
            -GitArgs @("hash-object", "--path", $PinnedRelativePath, "--", $PinnedPath) `
            -ExitCode 118 `
            -FailureMessage "Unable to hash WmChat runtime/config pin '$PinnedRelativePath'."
        if ($WorkingBlob -cne $ApprovedBlob) {
            Fail 118 "Refusing WmChat deploy: '$PinnedRelativePath' differs from approved source commit."
        }
        [void]$Bundle.Add([ordered]@{
            path = $PinnedRelativePath
            git_blob = $ApprovedBlob
            sha256 = (Get-FileHash -LiteralPath $PinnedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        })
    }
    $ConfigText = Get-Content -LiteralPath (Join-Path $Worktree "supabase/config.toml") -Raw
    foreach ($Fn in $WmChatTargetFunctions) {
        $Escaped = [regex]::Escape($Fn)
        if ($ConfigText -notmatch "(?ms)^\[functions\.$Escaped\]\s*\r?\nverify_jwt\s*=\s*false\s*$") {
            Fail 118 "Refusing WmChat deploy: config.toml does not explicitly preserve verify_jwt=false for '$Fn'."
        }
    }

    return @($Bundle | Sort-Object path)
}

function Resolve-WmChatDenoTool {
    $Deno = Get-Command deno -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $Deno) { Fail 118 "Deno $WmChatRequiredDenoVersion is required for frozen WmChat validation." }
    $VersionResult = Invoke-NativeProcessCaptured `
        -FilePath $Deno.Source -ArgumentTokens @("--version") -TimeoutSeconds 30
    $VersionLine = if ($VersionResult.Stdout) { (@($VersionResult.Stdout -split "\r?\n"))[0].Trim() } else { "" }
    if ($VersionResult.ExitCode -ne 0 -or
        $VersionResult.TimedOut -or
        $VersionLine -notmatch ('^deno\s+' + [regex]::Escape($WmChatRequiredDenoVersion) + '(?:\s|$)')) {
        Fail 118 "Deno must resolve to the reviewed version $WmChatRequiredDenoVersion."
    }
    $HelpResult = Invoke-NativeProcessCaptured `
        -FilePath $Deno.Source -ArgumentTokens @("test", "--help") -TimeoutSeconds 30
    if ($HelpResult.ExitCode -ne 0 -or $HelpResult.TimedOut -or -not $HelpResult.Stdout.Contains("--frozen")) {
        Fail 118 "The reviewed Deno executable does not prove frozen-lockfile support."
    }
    return [pscustomobject]@{
        Source = $Deno.Source
        Version = $WmChatRequiredDenoVersion
        SourceLabel = "PATH application (exact version required)"
    }
}

function Protect-SensitiveText([string]$Text) {
    $Protected = if ($null -eq $Text) { "" } else { $Text }
    foreach ($Name in $SensitiveEnvironmentNames) {
        $Value = [System.Environment]::GetEnvironmentVariable($Name, "Process")
        if (-not [string]::IsNullOrWhiteSpace($Value) -and $Value.Length -ge 8) {
            $Protected = $Protected.Replace($Value, "[REDACTED]")
        }
    }
    return $Protected
}

function Assert-EvidenceContainsNoSensitiveValues([string]$EvidenceJson, [int]$ExitCode) {
    foreach ($Name in $SensitiveEnvironmentNames) {
        $Value = [System.Environment]::GetEnvironmentVariable($Name, "Process")
        if (-not [string]::IsNullOrWhiteSpace($Value) -and $Value.Length -ge 8 -and $EvidenceJson.Contains($Value)) {
            [Console]::Error.WriteLine("ERROR: Refusing to emit evidence containing a sensitive environment value.")
            exit $ExitCode
        }
    }
}

function Invoke-WmChatValidation {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)]$DenoTool
    )
    $Checks = @(
        @("test", "--frozen", "--allow-env", "supabase/functions/start-upload-scan-session/index_test.ts", "supabase/functions/start-upload-scan-session/contracts/schemas.test.ts"),
        @("test", "--frozen", "--allow-env", "supabase/functions/capture-truth-gate-lead/index_test.ts", "supabase/functions/_shared/wmchatIntake.test.ts", "supabase/functions/_shared/consentCapture_test.ts"),
        @("check", "--frozen", "supabase/functions/start-upload-scan-session/index.ts", "supabase/functions/capture-truth-gate-lead/index.ts")
    )
    Push-Location $Worktree
    try {
        foreach ($Arguments in $Checks) {
            $Check = Invoke-NativeProcessCaptured `
                -FilePath $DenoTool.Source `
                -ArgumentTokens $Arguments `
                -WorkingDirectory $Worktree `
                -TimeoutSeconds 300 `
                -AllowRelativePathTokens
            if ($Check.ExitCode -ne 0 -or $Check.TimedOut) { Fail 118 "Frozen WmChat Deno validation failed." }
        }
    } finally { Pop-Location }
    $Dirty = Invoke-GitText -Worktree $Worktree `
        -GitArgs @("status", "--porcelain=v1", "--untracked-files=all") `
        -ExitCode 118 -FailureMessage "Unable to recheck the release worktree after validation."
    if (-not [string]::IsNullOrWhiteSpace($Dirty)) { Fail 118 "Validation modified the release worktree." }
}

function Get-WmChatMigrationLedger {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [switch]$ReturnFailure
    )

    $Invocation = Invoke-SupabaseCliProcess `
        -Arguments @("migration", "list", "--linked") `
        -WorkingDirectory $Worktree `
        -OperationName "WmChat remote migration ledger"
    if ($Invocation.ExitCode -ne 0 -or $Invocation.StderrClassification.Status -eq "Unexpected") {
        if ($ReturnFailure) { return [ordered]@{ ok=$false; reason="Unable to verify the linked migration ledger." } }
        Fail 119 "Unable to verify the linked LIVE_ACTIVE migration ledger."
    }
    $Parsed = Get-RemoteMigrationVersions -LedgerOutput $Invocation.Stdout
    if (-not $Parsed.HeaderFound) {
        if ($ReturnFailure) { return [ordered]@{ ok=$false; reason="Remote migration output did not contain an identifiable REMOTE column." } }
        Fail 119 "Remote migration output did not contain an identifiable REMOTE column."
    }
    foreach ($Version in $WmChatRequiredMigrations) {
        if ($Parsed.Versions -notcontains $Version) {
            if ($ReturnFailure) { return [ordered]@{ ok=$false; reason="Required WmChat migration '$Version' is not recorded remotely." } }
            Fail 120 "Required WmChat migration '$Version' is not recorded remotely. Run the separate consent migration runner first."
        }
    }
    if ($ReturnFailure) { return [ordered]@{ ok=$true; versions=@($Parsed.Versions) } }
    return @($Parsed.Versions)
}

function Assert-WmChatConsentContract {
    param(
        [Parameter(Mandatory=$true)][string]$Worktree,
        [switch]$ReturnFailure
    )
    $Runner = Join-Path $Worktree "scripts/apply-wmchat-consent-live.ps1"
    if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) {
        if ($ReturnFailure) { return [ordered]@{ ok=$false; reason="The reviewed consent contract runner is missing." } }
        Fail 120 "The reviewed WmChat consent contract runner is missing from the release worktree."
    }
    $In=[System.IO.Path]::GetTempFileName();$Out=[System.IO.Path]::GetTempFileName();$Err=[System.IO.Path]::GetTempFileName()
    try {
        $Arguments=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$Runner,"-DryRun","-ReleaseWorktree",$Worktree,"-ReleaseCommit",$ReleaseCommit)
        $Process=Start-Process -FilePath "powershell.exe" -ArgumentList $Arguments `
            -RedirectStandardInput $In -RedirectStandardOutput $Out -RedirectStandardError $Err -NoNewWindow -PassThru
        $Completed=$Process.WaitForExit($NativeProcessDefaultTimeoutSeconds * 1000)
        if (-not $Completed) {
            try { $Process.Kill() } catch { }
            [void]$Process.WaitForExit()
        }
        $ContractOutput=[string](Get-Content -LiteralPath $Out -Raw -ErrorAction SilentlyContinue)
        $ContractError=[string](Get-Content -LiteralPath $Err -Raw -ErrorAction SilentlyContinue)
        $SafeError=(Protect-SensitiveText $ContractError).Trim()
        if ($SafeError.Length -gt 240) { $SafeError=$SafeError.Substring(0,240) }
        if (-not $Completed -or $Process.ExitCode -ne 0) {
            $Reason = if (-not $Completed) {
                "The read-only consent contract verifier timed out."
            } elseif ([string]::IsNullOrWhiteSpace($SafeError)) {
                "The read-only consent contract verifier exited $($Process.ExitCode)."
            } else {
                "The read-only consent contract verifier exited $($Process.ExitCode): $SafeError"
            }
            if ($ReturnFailure) { return [ordered]@{ ok=$false; reason=$Reason } }
            Fail 120 "$Reason No deployment was attempted."
        }
        if (-not $ContractOutput.Contains('"result":  "DRY_RUN_VERIFIED"') -or
            -not $ContractOutput.Contains('"planned_versions":  [') -or
            -not $ContractOutput.Contains('DRY RUN - NO MIGRATIONS APPLIED')) {
            if ($ReturnFailure) { return [ordered]@{ ok=$false; reason="The consent contract verifier returned an unrecognized result." } }
            Fail 120 "The consent contract verifier returned an unrecognized result."
        }
        if ($ReturnFailure) { return [ordered]@{ ok=$true } }
    } finally { Remove-Item -LiteralPath $In,$Out,$Err -Force -ErrorAction SilentlyContinue }
}

function Get-WmChatRemoteFunctionMetadata {
    param(
        [Parameter(Mandatory = $true)][string]$FunctionNameValue,
        [Parameter(Mandatory = $true)][string]$OperationName,
        [switch]$ReturnFailure
    )

    $Row = Get-RemoteAdminFunctionRow `
        -ProjectRef $ApprovedRef `
        -ExpectedFunction $FunctionNameValue `
        -OperationName $OperationName
    if (-not $Row.Ok) {
        if ($ReturnFailure) { return [ordered]@{ ok=$false; reason=$Row.FailureMessage } }
        Fail 121 $Row.FailureMessage
    }
    if ([string]::IsNullOrWhiteSpace([string]$Row.RemoteHash) -or
        [string]$Row.RemoteHash -cnotmatch '^[0-9a-f]{64}$') {
        if ($ReturnFailure) { return [ordered]@{ ok=$false; reason="Remote deployed hash was absent or malformed." } }
        Fail 121 "Remote metadata for '$FunctionNameValue' did not include a strict SHA-256 deployed hash."
    }
    return [ordered]@{
        ok = $true
        function_name = $FunctionNameValue
        function_id = $Row.FunctionId
        version = [int64]$Row.Version
        deployed_hash = [string]$Row.RemoteHash
    }
}

function New-WmChatRollbackArtifacts {
    param(
        [Parameter(Mandatory=$true)][string]$Worktree,
        [Parameter(Mandatory=$true)][string]$ExternalEvidencePath,
        [Parameter(Mandatory=$true)]$BeforeMetadata
    )
    $EvidenceFullPath = [System.IO.Path]::GetFullPath($ExternalEvidencePath)
    $ArtifactRoot = $EvidenceFullPath + ".rollback-artifacts"
    $PrimaryRepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    if ((Test-PathWithinRoot -Root $Worktree -Candidate $ArtifactRoot) -or
        (Test-PathWithinRoot -Root $PrimaryRepoRoot -Candidate $ArtifactRoot) -or
        (Test-Path -LiteralPath $ArtifactRoot)) {
        Fail 121 "Rollback artifact directory must be a new external path."
    }
    New-Item -ItemType Directory -Path $ArtifactRoot | Out-Null
    $Artifacts = New-Object System.Collections.Generic.List[object]
    for ($Index=0; $Index -lt $WmChatTargetFunctions.Count; $Index++) {
        $Fn=$WmChatTargetFunctions[$Index]
        $FunctionRoot=Join-Path $ArtifactRoot $Fn
        New-Item -ItemType Directory -Path $FunctionRoot | Out-Null
        $Invocation=Invoke-SupabaseCliProcess `
            -Arguments @("functions","download",$Fn,"--project-ref",$ApprovedRef,"--use-api") `
            -WorkingDirectory $FunctionRoot `
            -OperationName "WmChat rollback artifact download for $Fn"
        if($Invocation.ExitCode -ne 0 -or $Invocation.StderrClassification.Status -eq "Unexpected") {
            Fail 121 "Unable to preserve a reviewed rollback source artifact for '$Fn'."
        }
        $DownloadedRoot=Join-Path $FunctionRoot "supabase/functions/$Fn"
        if(-not (Test-Path -LiteralPath $DownloadedRoot -PathType Container)) {
            Fail 121 "Rollback download for '$Fn' did not produce the exact expected function directory."
        }
        $Files=@(Get-ChildItem -LiteralPath $DownloadedRoot -File -Recurse | Sort-Object FullName)
        if($Files.Count -eq 0) { Fail 121 "Rollback artifact for '$Fn' is empty." }
        $FileEvidence=@()
        foreach($File in $Files) {
            if(($File.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                Fail 121 "Rollback artifact contains an unsafe reparse point."
            }
            $Relative=$File.FullName.Substring($DownloadedRoot.Length).TrimStart('\','/').Replace('\','/')
            $FileEvidence += [ordered]@{
                path=$Relative
                sha256=(Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
        $AfterDownload=Get-WmChatRemoteFunctionMetadata -FunctionNameValue $Fn -OperationName "post-download metadata for $Fn"
        $Pre=$BeforeMetadata[$Index]
        if($AfterDownload.function_id -cne $Pre.function_id -or $AfterDownload.version -ne $Pre.version -or
            $AfterDownload.deployed_hash -cne $Pre.deployed_hash) {
            Fail 121 "Remote function metadata changed while preserving rollback artifact for '$Fn'."
        }
        [void]$Artifacts.Add([ordered]@{
            function_name=$Fn; function_id=$Pre.function_id; version=$Pre.version
            deployed_hash=$Pre.deployed_hash; external_directory=$DownloadedRoot; files=$FileEvidence
        })
    }
    return $Artifacts.ToArray()
}

function Assert-WmChatReleaseWorktree {
    if ([string]::IsNullOrWhiteSpace($ReleaseWorktree) -or
        -not (Test-Path -LiteralPath $ReleaseWorktree -PathType Container)) {
        Fail 122 "ReleaseWorktree must name the exact detached release worktree."
    }
    if ([string]::IsNullOrWhiteSpace($ReleaseCommit) -or $ReleaseCommit -cnotmatch '^[0-9a-f]{40}$') {
        Fail 122 "ReleaseCommit must be an exact lowercase 40-character commit SHA."
    }
    $ResolvedWorktree = (Resolve-Path -LiteralPath $ReleaseWorktree).Path
    $ExecutingRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    if (-not $ResolvedWorktree.Equals($ExecutingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 122 "Run this script from the exact ReleaseWorktree; cross-worktree execution is forbidden."
    }
    $Top = Invoke-GitText -Worktree $ResolvedWorktree -GitArgs @("rev-parse", "--show-toplevel") `
        -ExitCode 122 -FailureMessage "Unable to resolve the release worktree root."
    if (-not ((Resolve-Path -LiteralPath $Top).Path).Equals($ResolvedWorktree, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 122 "ReleaseWorktree must be the exact Git worktree root."
    }
    $Branch = Invoke-GitText -Worktree $ResolvedWorktree -GitArgs @("branch", "--show-current") `
        -ExitCode 122 -FailureMessage "Unable to inspect release worktree branch state."
    if (-not [string]::IsNullOrWhiteSpace($Branch)) {
        Fail 122 "WmChat release worktree must have detached HEAD."
    }
    $Head = Invoke-GitText -Worktree $ResolvedWorktree -GitArgs @("rev-parse", "HEAD") `
        -ExitCode 122 -FailureMessage "Unable to inspect release HEAD."
    if ($Head -cne $ReleaseCommit) { Fail 122 "Release HEAD does not equal ReleaseCommit." }
    $Dirty = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("status", "--porcelain=v1", "--untracked-files=all") `
        -ExitCode 122 -FailureMessage "Unable to inspect release worktree status."
    if (-not [string]::IsNullOrWhiteSpace($Dirty)) { Fail 122 "Release worktree must be completely clean." }

    $Registered = Invoke-GitText -Worktree $ResolvedWorktree -GitArgs @("worktree", "list", "--porcelain") `
        -ExitCode 122 -FailureMessage "Unable to inspect registered worktrees."
    $Found = $false
    foreach ($Line in ($Registered -split "\r?\n")) {
        if ($Line.StartsWith("worktree ") -and
            ([System.IO.Path]::GetFullPath($Line.Substring(9))).Equals($ResolvedWorktree, [System.StringComparison]::OrdinalIgnoreCase)) {
            $Found = $true
        }
    }
    if (-not $Found) { Fail 122 "ReleaseWorktree is not registered by Git." }

    $OriginUrl = Invoke-GitText -Worktree $ResolvedWorktree -GitArgs @("remote","get-url","origin") `
        -ExitCode 123 -FailureMessage "Unable to resolve WmChat release origin."
    if ($OriginUrl -cne $WmChatApprovedOriginUrl) {
        Fail 123 "WmChat release origin must be exactly the approved WindowMan repository."
    }
    $ApprovedTrackingRef = "refs/remotes/origin/$RequiredBranch"
    $ApprovedFetchRefspec = "+refs/heads/$($RequiredBranch):$ApprovedTrackingRef"
    & git -C $ResolvedWorktree fetch --quiet origin $ApprovedFetchRefspec
    if ($LASTEXITCODE -ne 0) { Fail 123 "Unable to freshly fetch origin/$RequiredBranch." }
    & git -C $ResolvedWorktree merge-base --is-ancestor $ReleaseCommit $ApprovedTrackingRef
    if ($LASTEXITCODE -ne 0) { Fail 123 "ReleaseCommit is not contained in freshly fetched origin/$RequiredBranch." }
    & git -C $ResolvedWorktree cat-file -e "$WmChatApprovedSourceCommit^{commit}"
    if ($LASTEXITCODE -ne 0) { Fail 123 "Approved WmChat source commit is unavailable locally." }
    & git -C $ResolvedWorktree merge-base --is-ancestor $WmChatApprovedSourceCommit $ReleaseCommit
    if ($LASTEXITCODE -ne 0) { Fail 123 "Approved WmChat source commit is not an ancestor of ReleaseCommit." }

    $ScriptRelative = "scripts/deploy-functions-forensic-v2-live.ps1"
    $CommittedScriptBlob = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("rev-parse", "$ReleaseCommit`:$ScriptRelative") `
        -ExitCode 123 -FailureMessage "Release commit does not contain this runner."
    $RunningScriptBlob = Invoke-GitText -Worktree $ResolvedWorktree `
        -GitArgs @("hash-object", "--path", "scripts/deploy-functions-forensic-v2-live.ps1", "--", $PSCommandPath) `
        -ExitCode 123 -FailureMessage "Unable to hash the running release script."
    if ($CommittedScriptBlob -cne $RunningScriptBlob) { Fail 123 "Running script differs from the exact release commit." }
    return $ResolvedWorktree
}

function Invoke-WmChatDeployMode {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    if (-not [string]::IsNullOrWhiteSpace($env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE) -or
        -not [string]::IsNullOrWhiteSpace($env:WMCHAT_MIGRATION_PSQL_TEST_OVERRIDE)) {
        Fail 124 "WmChat live mode forbids executable test overrides. Use reviewed tools from PATH/repository dependencies."
    }
    if ($GoogleAdsOnly -or $DispatchOnly -or $AdminDataOnly -or $Pr173ExtractionOnly -or $QuoteIntelligenceWorkerOnly) {
        Fail 124 "SAFETY STOP: -WmChatOnly is mutually exclusive with every other deployment mode."
    }
    if (-not [string]::IsNullOrWhiteSpace($FunctionName) -or
        $ScriptBoundParameters.ContainsKey("AdminOperation") -or
        $ScriptBoundParameters.ContainsKey("RollbackMethod") -or
        $ScriptBoundParameters.ContainsKey("RollbackVersion") -or
        -not [string]::IsNullOrWhiteSpace($CurrentVersion) -or
        -not [string]::IsNullOrWhiteSpace($CurrentFunctionId) -or
        -not [string]::IsNullOrWhiteSpace($CurrentDeployedHash)) {
        Fail 124 "Admin/legacy deployment parameters cannot be combined with -WmChatOnly."
    }
    $ProjectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF.Trim() } else { "" }
    if ($ProjectRef -cne $ApprovedRef) { Fail 125 "SUPABASE_PROJECT_REF must be exactly '$ApprovedRef'." }

    $ResolvedWorktree = Assert-WmChatReleaseWorktree
    $LinkedRefPath = Join-Path $ResolvedWorktree "supabase/.temp/project-ref"
    if (-not (Test-Path -LiteralPath $LinkedRefPath -PathType Leaf)) {
        Fail 126 "WmChat mode requires an explicit local link to LIVE_ACTIVE."
    }
    $LinkedRef = (Get-Content -LiteralPath $LinkedRefPath -Raw).Trim()
    if ($LinkedRef -cne $ApprovedRef) { Fail 126 "Linked project ref does not match LIVE_ACTIVE." }

    $WmChatDenoTool = Resolve-WmChatDenoTool
    $BundleFiles = Get-WmChatBundleFiles -Worktree $ResolvedWorktree
    Invoke-WmChatValidation -Worktree $ResolvedWorktree -DenoTool $WmChatDenoTool
    $Toolchain = Get-ToolchainEvidence
    $LedgerVersions = Get-WmChatMigrationLedger -Worktree $ResolvedWorktree
    Assert-WmChatConsentContract -Worktree $ResolvedWorktree
    $Before = @()
    foreach ($Fn in $WmChatTargetFunctions) {
        $Before += Get-WmChatRemoteFunctionMetadata -FunctionNameValue $Fn -OperationName "pre-deploy metadata for $Fn"
    }
    if (-not $DryRun -and [string]::IsNullOrWhiteSpace($EvidencePath)) {
        Fail 127 "EvidencePath is mandatory for a non-dry WmChat live deployment."
    }
    $RollbackArtifacts = if ($DryRun) { @() } else {
        @(New-WmChatRollbackArtifacts -Worktree $ResolvedWorktree -ExternalEvidencePath $EvidencePath -BeforeMetadata $Before)
    }
    $Evidence = [ordered]@{
        result = "PREPARED"
        project_ref = $ApprovedRef
        release_commit = $ReleaseCommit
        approved_function_source_commit = $WmChatApprovedSourceCommit
        detached_clean_registered_worktree = $true
        linked_ref = $LinkedRef
        required_migrations = $WmChatRequiredMigrations
        remote_ledger_verified = @($WmChatRequiredMigrations | ForEach-Object { $LedgerVersions -contains $_ })
        bundle_files = $BundleFiles
        functions_before = $Before
        deployment_order = $WmChatTargetFunctions
        toolchain = [ordered]@{
            deno = "deno $($WmChatDenoTool.Version)"
            deno_source = $WmChatDenoTool.SourceLabel
            supabase_cli = $Toolchain.supabase_cli
            supabase_cli_source = $Toolchain.supabase_cli_source
            powershell = $Toolchain.powershell
        }
        dry_run = [bool]$DryRun
        rollback = [ordered]@{
            automatic = $false
            artifacts = $RollbackArtifacts
            instruction = "Do not retry automatically. Preserve this evidence and the external rollback artifacts; any rollback requires separate approval."
        }
    }
    Write-Host "=== WMCHAT LIVE FUNCTION RELEASE ==="
    Write-Host "Target: $ApprovedRef"
    Write-Host "Release commit: $ReleaseCommit"
    Write-Host "Pinned function source: $WmChatApprovedSourceCommit"
    Write-Host "Functions (exact order): $($WmChatTargetFunctions -join ', ')"
    Write-Host "Required migrations recorded: $($WmChatRequiredMigrations -join ', ')"
    Write-WmChatDeployEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
    if ($DryRun) {
        Write-Host "DRY RUN - NO DEPLOYMENT PERFORMED"
        exit 0
    }
    Write-Host "Type exactly: $WmChatConfirmPhrase"
    $Typed = Read-Host "Confirmation"
    if ($Typed -cne $WmChatConfirmPhrase) { Fail 127 "WmChat deploy aborted: confirmation phrase mismatch." }

    $LedgerRecheck = Get-WmChatMigrationLedger -Worktree $ResolvedWorktree
    Assert-WmChatConsentContract -Worktree $ResolvedWorktree
    $BeforeRecheck = @()
    foreach ($Fn in $WmChatTargetFunctions) {
        $BeforeRecheck += Get-WmChatRemoteFunctionMetadata -FunctionNameValue $Fn -OperationName "post-confirm metadata for $Fn"
    }
    for ($Index = 0; $Index -lt $Before.Count; $Index++) {
        if ($BeforeRecheck[$Index].function_name -cne $Before[$Index].function_name -or
            $BeforeRecheck[$Index].function_id -cne $Before[$Index].function_id -or
            $BeforeRecheck[$Index].version -ne $Before[$Index].version -or
            $BeforeRecheck[$Index].deployed_hash -cne $Before[$Index].deployed_hash) {
            Fail 127 "Remote function metadata changed after confirmation; zero deployments were attempted."
        }
    }
    foreach ($Version in $WmChatRequiredMigrations) {
        if ($LedgerRecheck -notcontains $Version) { Fail 127 "Migration ledger changed after confirmation." }
    }

    $After = New-Object System.Collections.Generic.List[object]
    for ($Index = 0; $Index -lt $WmChatTargetFunctions.Count; $Index++) {
        $Fn = $WmChatTargetFunctions[$Index]
        $Pre = $Before[$Index]
        $ImmediatePre = Get-WmChatRemoteFunctionMetadata -FunctionNameValue $Fn `
            -OperationName "immediate pre-deploy metadata for $Fn" -ReturnFailure
        $PreDeployDrift = (-not $ImmediatePre.ok) -or
            $ImmediatePre.function_name -cne $Pre.function_name -or
            $ImmediatePre.function_id -cne $Pre.function_id -or
            $ImmediatePre.version -ne $Pre.version -or
            $ImmediatePre.deployed_hash -cne $Pre.deployed_hash
        if ($PreDeployDrift) {
            $Reason = "Remote function metadata changed immediately before deploying '$Fn'."
            $Evidence["result"] = "UNKNOWN_REMOTE_STATE"
            $Evidence["completed_functions"] = @($After | ForEach-Object { $_ })
            $Evidence["ambiguous_function"] = $Fn
            $Evidence["pre_deploy_metadata"] = $ImmediatePre
            $Evidence["reason"] = $Reason
            $Evidence["automatic_retry"] = $false
            Write-WmChatDeployEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
            [Console]::Error.WriteLine("UNKNOWN_REMOTE_STATE: $Reason No deploy or retry was attempted for this function.")
            exit $WmChatAmbiguousExitCode
        }
        $Invocation = Invoke-SupabaseCliProcess `
            -Arguments @("functions", "deploy", $Fn, "--project-ref", $ApprovedRef, "--no-verify-jwt") `
            -WorkingDirectory $ResolvedWorktree `
            -OperationName "WmChat deploy $Fn" `
            -TimeoutSeconds $NativeProcessDeployTimeoutSeconds
        $AmbiguousReason = $null
        if ($Invocation.ExitCode -ne 0) {
            $AmbiguousReason = "Deploy command for '$Fn' exited $($Invocation.ExitCode)."
        } elseif ($Invocation.StderrClassification.Status -eq "Unexpected") {
            $AmbiguousReason = "Deploy command for '$Fn' returned unexpected stderr."
        }
        $Post = Get-WmChatRemoteFunctionMetadata -FunctionNameValue $Fn `
            -OperationName "post-deploy metadata for $Fn" -ReturnFailure
        if (-not $Post.ok) {
            $MetadataReason = "Post-deploy metadata for '$Fn' could not be proven: $($Post.reason)"
            $AmbiguousReason = if ($AmbiguousReason) { "$AmbiguousReason $MetadataReason" } else { $MetadataReason }
        }
        if (-not $AmbiguousReason -and
            ($Post.function_id -cne $Pre.function_id -or
             $Post.version -ne ($Pre.version + 1) -or
             $Post.deployed_hash -ceq $Pre.deployed_hash)) {
            $AmbiguousReason = "Post-deploy identity, exact next version, or changed deployed hash verification failed for '$Fn'."
        }
        if ($AmbiguousReason) {
            $Evidence["result"] = "UNKNOWN_REMOTE_STATE"
            $Evidence["completed_functions"] = @($After | ForEach-Object { $_ })
            $Evidence["ambiguous_function"] = $Fn
            $Evidence["post_attempt_metadata"] = $Post
            $Evidence["reason"] = $AmbiguousReason
            $Evidence["automatic_retry"] = $false
            Write-WmChatDeployEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
            [Console]::Error.WriteLine("UNKNOWN_REMOTE_STATE: $AmbiguousReason No retry or rollback was attempted.")
            exit $WmChatAmbiguousExitCode
        }
        [void]$After.Add($Post)
        $Evidence["completed_functions"] = @($After | ForEach-Object { $_ })
        $Evidence["last_verified_function"] = $Fn
        Write-WmChatDeployEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
    }

    $FinalVerificationReasons = New-Object System.Collections.Generic.List[string]
    try {
        $FinalLedger = Get-WmChatMigrationLedger -Worktree $ResolvedWorktree -ReturnFailure
        if (-not $FinalLedger.ok) { [void]$FinalVerificationReasons.Add([string]$FinalLedger.reason) }
    } catch {
        [void]$FinalVerificationReasons.Add("Final migration-ledger verification raised an unexpected local error.")
    }
    try {
        $FinalConsent = Assert-WmChatConsentContract -Worktree $ResolvedWorktree -ReturnFailure
        if (-not $FinalConsent.ok) { [void]$FinalVerificationReasons.Add([string]$FinalConsent.reason) }
    } catch {
        [void]$FinalVerificationReasons.Add("Final consent-contract verification raised an unexpected local error.")
    }
    $FinalFunctions = New-Object System.Collections.Generic.List[object]
    for ($Index = 0; $Index -lt $WmChatTargetFunctions.Count; $Index++) {
        $Fn = $WmChatTargetFunctions[$Index]
        $Expected = $After[$Index]
        try {
            $Fresh = Get-WmChatRemoteFunctionMetadata -FunctionNameValue $Fn `
                -OperationName "final pre-VERIFIED metadata for $Fn" -ReturnFailure
        } catch {
            $Fresh = [ordered]@{ ok=$false; reason="Final metadata verification raised an unexpected local error." }
        }
        [void]$FinalFunctions.Add($Fresh)
        if (-not $Fresh.ok) {
            [void]$FinalVerificationReasons.Add("Final metadata for '$Fn' could not be proven.")
        } elseif ($Fresh.function_name -cne $Expected.function_name -or
                  $Fresh.function_id -cne $Expected.function_id -or
                  $Fresh.version -ne $Expected.version -or
                  $Fresh.deployed_hash -cne $Expected.deployed_hash) {
            [void]$FinalVerificationReasons.Add("Final metadata for '$Fn' changed after its verified deployment.")
        }
    }
    if ($FinalVerificationReasons.Count -gt 0) {
        $Evidence["result"] = "UNKNOWN_REMOTE_STATE"
        $Evidence["functions_after_attempt"] = @($After | ForEach-Object { $_ })
        $Evidence["final_function_observations"] = @($FinalFunctions | ForEach-Object { $_ })
        $Evidence["reason"] = ($FinalVerificationReasons -join " ")
        $Evidence["automatic_retry"] = $false
        $Evidence["completed_utc"] = (Get-Date).ToUniversalTime().ToString("o")
        Write-WmChatDeployEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
        [Console]::Error.WriteLine("UNKNOWN_REMOTE_STATE: Final post-deployment verification failed. No retry or rollback was attempted.")
        exit $WmChatAmbiguousExitCode
    }
    $Evidence["result"] = "VERIFIED"
    $Evidence["functions_after"] = @($FinalFunctions | ForEach-Object { $_ })
    $Evidence["completed_utc"] = (Get-Date).ToUniversalTime().ToString("o")
    Write-WmChatDeployEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
    Write-Host "WmChat live function release verified. No smoke lead was created."
    exit 0
}

function Invoke-AdminDataMode {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

    if ($GoogleAdsOnly -or $DispatchOnly -or $Pr173ExtractionOnly -or $WmChatOnly -or $QuoteIntelligenceWorkerOnly) {
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

    $CanonicalRepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
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

    $Toolchain = Get-ToolchainEvidence
    $ResolvedCli = Resolve-SupabaseCliInvocation
    $DeployCommand = "supabase functions deploy $AdminFunctionName --project-ref $ApprovedRef (cli: $($ResolvedCli.SourceLabel))"
    # Every admin-data action, including -DryRun, requires read-only remote metadata verification.
    $CurrentMetadata = Get-VerifiedRemoteAdminMetadata -ProjectRef $ProjectRef -ExpectedFunction $AdminFunctionName

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
        toolchain = $Toolchain
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
    Write-Host "Toolchain:            Supabase CLI $($Toolchain.supabase_cli) [$($Toolchain.supabase_cli_source)]; Deno $($Toolchain.deno); Node $($Toolchain.node); PowerShell $($Toolchain.powershell)"
    Write-Host "Remote metadata:      REMOTE_READ_CONFIRMED (id $($CurrentMetadata.remote_verified_function_id), version $($CurrentMetadata.remote_verified_version))"
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

    $PreActionFunctionId = [string]$CurrentMetadata.remote_verified_function_id
    $PreActionVersion = [int64]$CurrentMetadata.remote_verified_version

    $DeployInvocation = Invoke-SupabaseCliProcess `
        -Arguments @("functions", "deploy", $AdminFunctionName, "--project-ref", $ApprovedRef) `
        -WorkingDirectory $ResolvedWorktree `
        -OperationName "admin-data $AdminOperation"
    if ($DeployInvocation.ExitCode -ne 0) {
        Fail 99 "Admin-data $AdminOperation failed (exit $($DeployInvocation.ExitCode))."
    }
    if ($DeployInvocation.StderrClassification.Status -eq "ToleratedDiagnostics") {
        foreach ($DiagnosticLine in $DeployInvocation.StderrClassification.ToleratedDiagnostics) {
            Write-Host "WARNING: Supabase CLI diagnostic (non-blocking): $DiagnosticLine"
        }
    }

    # Never retry after a deployment attempt. Any inability to prove final state is ambiguous.
    $AmbiguousReason = $null
    $PostRow = $null
    if ($DeployInvocation.StderrClassification.Status -eq "Unexpected") {
        $AmbiguousReason = "The $AdminOperation command exited zero but produced unexpected stderr."
    } else {
        $PostRow = Get-RemoteAdminFunctionRow `
            -ProjectRef $ProjectRef `
            -ExpectedFunction $AdminFunctionName `
            -OperationName "post-action functions list"
        if (-not $PostRow.Ok) {
            $AmbiguousReason = "Post-action metadata verification failed: $($PostRow.FailureMessage)"
        } elseif ($PostRow.FunctionId -ne $PreActionFunctionId) {
            $AmbiguousReason = "Post-action function ID '$($PostRow.FunctionId)' differs from pre-action ID '$PreActionFunctionId'."
        } elseif ($PostRow.Version -le $PreActionVersion) {
            $AmbiguousReason = "Post-action version $($PostRow.Version) did not increase beyond pre-action version $PreActionVersion."
        }
    }

    if ($AmbiguousReason) {
        $Evidence["post_action_verification"] = [ordered]@{
            status = "AMBIGUOUS"
            reason = $AmbiguousReason
            observed_function_id = $(if ($PostRow -and $PostRow.Ok) { $PostRow.FunctionId } else { "UNVERIFIED" })
            observed_version = $(if ($PostRow -and $PostRow.Ok) { $PostRow.Version } else { "UNVERIFIED" })
            automatic_retry = $false
            automatic_rollback = $false
        }
        Write-AdminEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
        [Console]::Error.WriteLine(("DEPLOYMENT STATE AMBIGUOUS {0} MANUAL REMOTE INSPECTION REQUIRED" -f [char]0x2014))
        [Console]::Error.WriteLine("Reason: $AmbiguousReason")
        [Console]::Error.WriteLine("The wrapper did not retry, did not roll back, and did not issue a second deployment.")
        exit $AdminAmbiguousExitCode
    }

    foreach ($DiagnosticLine in $PostRow.ToleratedDiagnostics) {
        Write-Host "WARNING: Supabase CLI diagnostic (non-blocking): $DiagnosticLine"
    }
    $Evidence["post_action_verification"] = [ordered]@{
        status = "VERIFIED_VERSION_INCREASED"
        function_id = $PostRow.FunctionId
        previous_version = $PreActionVersion
        new_version = $PostRow.Version
        remote_reported_hash = $(if ($PostRow.RemoteHash) { $PostRow.RemoteHash } else { "NOT_REPORTED_BY_REMOTE" })
    }
    Write-AdminEvidence -Evidence $Evidence -Worktree $ResolvedWorktree
    Write-Host "Post-action verification: function $($PostRow.FunctionId) version $PreActionVersion -> $($PostRow.Version)."
    Write-Host "Admin-data $AdminOperation complete. Run the separately authorized production smoke test."
    exit 0
}

if ($QuoteIntelligenceWorkerOnly -and ($AdminDataOnly -or $WmChatOnly)) {
    Fail 105 "SAFETY STOP: -QuoteIntelligenceWorkerOnly is mutually exclusive with -AdminDataOnly and -WmChatOnly."
}

if ($AdminDataOnly) {
    Invoke-AdminDataMode
}
if ($WmChatOnly) {
    Invoke-WmChatDeployMode
}
$LegacyScopedDeployMode = $GoogleAdsOnly -or $DispatchOnly -or $Pr173ExtractionOnly -or $QuoteIntelligenceWorkerOnly
if (($DryRun -and -not $LegacyScopedDeployMode) -or
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

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

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

# PR 173 mode reads the remote migration ledger through 'migration list --linked', which is the only
# read-only remote listing the installed CLI supports (no --project-ref). The linked ref is therefore
# a hard precondition for this mode only; it never replaces the authoritative --project-ref below.
if ($Pr173ExtractionOnly -and $LinkedRef -cne $ApprovedRef) {
    Fail 101 @"
PR 173 mode requires the CLI to be linked to the approved target.

  Required linked ref: $ApprovedRef
  supabase/.temp/project-ref: $(if ($LinkedRef) { $LinkedRef } else { '(missing)' })

Link the approved project, then re-run:
  npx supabase link --project-ref $ApprovedRef
"@
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
if ($Pr173ExtractionOnly -and ($GoogleAdsOnly -or $DispatchOnly -or $QuoteIntelligenceWorkerOnly)) {
    Fail 100 "SAFETY STOP: -Pr173ExtractionOnly is mutually exclusive with all other deployment modes."
}
if ($QuoteIntelligenceWorkerOnly -and ($GoogleAdsOnly -or $DispatchOnly)) {
    Fail 105 "SAFETY STOP: -QuoteIntelligenceWorkerOnly is mutually exclusive with all other deployment modes."
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
} elseif ($Pr173ExtractionOnly) {
    $TargetFunctions = $Pr173TargetFunctions
    $DeployCommands = @(
        "npx supabase functions deploy scan-quote --project-ref $ApprovedRef",
        "npx supabase functions deploy send-contractor-handoff --project-ref $ApprovedRef",
        "npx supabase functions deploy dial-lead --project-ref $ApprovedRef"
    )
    $DeploySummaryTitle = "PR 173 extraction, handoff, and dial functions only"
    $DeployNextStep = "Next: smoke tests and migration application remain separate human-operated actions; this wrapper performed neither."
} elseif ($QuoteIntelligenceWorkerOnly) {
    $TargetFunctions = $QuoteIntelligenceWorkerTargetFunctions
    if ($TargetFunctions.Count -ne 1 -or $TargetFunctions[0] -cne "quote-intelligence-worker") {
        Fail 106 "Refusing quote-intelligence worker deploy: deploy set must resolve to quote-intelligence-worker only."
    }
    $DeployCommands = @(
        "npx supabase functions deploy quote-intelligence-worker --project-ref $ApprovedRef"
    )
    $DeploySummaryTitle = "Quote-intelligence worker only"
    $DeployNextStep = "Next: human operator sets QUOTE_INTELLIGENCE_WORKER_SECRET, then runs auth/no-work smoke. Cron activation remains unauthorized."
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

if ($Pr173ExtractionOnly) {
    Assert-Pr173FunctionSources -Worktree $RepoRoot
    Assert-Pr173MigrationPrerequisites -Worktree $RepoRoot
}
if ($QuoteIntelligenceWorkerOnly) {
    Assert-QuoteIntelligenceWorkerFunctionSource -Worktree $RepoRoot
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
Write-Host "Pr173ExtractionOnly mode: $(if ($Pr173ExtractionOnly) { 'true' } else { 'false' })"
Write-Host "QuoteIntelligenceWorkerOnly mode: $(if ($QuoteIntelligenceWorkerOnly) { 'true' } else { 'false' })"
Write-Host "Functions to deploy:"
foreach ($Fn in $TargetFunctions) { Write-Host "  - $Fn" }
Write-Host "Commands that will run:"
foreach ($Cmd in $DeployCommands) { Write-Host "  $Cmd" }

Write-Banner

if ($Pr173ExtractionOnly -and $DryRun) {
    Write-Host "Migrations $($Pr173RequiredMigrations -join ', ') are prerequisites only."
    Write-Host "This wrapper never applies, repairs, or pushes migrations."
    Write-Host ("DRY RUN {0} NO DEPLOYMENT PERFORMED" -f [char]0x2014)
    exit 0
}
if ($QuoteIntelligenceWorkerOnly -and $DryRun) {
    Write-Host "Quote-intelligence worker deploy set is exactly: quote-intelligence-worker"
    Write-Host ("DRY RUN {0} NO DEPLOYMENT PERFORMED" -f [char]0x2014)
    exit 0
}

$ModeConfirmPhrase = if ($Pr173ExtractionOnly) {
    $Pr173ConfirmPhrase
} elseif ($QuoteIntelligenceWorkerOnly) {
    $QuoteIntelligenceWorkerConfirmPhrase
} else {
    $ConfirmPhrase
}
Write-Host "Type exactly: $ModeConfirmPhrase"
$Typed = Read-Host "Confirmation"
# Legacy modes keep their existing case-insensitive comparison; PR 173 and QI worker require an exact match.
if ($Typed -ne $ModeConfirmPhrase -or
    ($Pr173ExtractionOnly -and $Typed -cne $Pr173ConfirmPhrase) -or
    ($QuoteIntelligenceWorkerOnly -and $Typed -cne $QuoteIntelligenceWorkerConfirmPhrase)) {
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
