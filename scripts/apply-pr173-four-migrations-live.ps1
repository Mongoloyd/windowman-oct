# Sprint 6B: guarded, human-operated release path that applies and records EXACTLY four
# PR 173 migrations on LIVE_ACTIVE (zgsofkgddpcntdvpckdq), in a fixed order:
#   1. 20260806144716_quote_normalization_layer.sql
#   2. 20260808160000_quote_normalization_schema_parity.sql
#   3. 20260808170000_monotonic_latest_analysis_pointer_rpc.sql
#   4. 20260808180000_contractor_outcome_scan_context.sql
#
# Mechanism: per-migration psql transaction + explicit supabase_migrations.schema_migrations
# ledger insert, mirroring what `supabase db push` does for a single migration. A broad
# `db push` is forbidden here because this repository carries unrelated pending migrations
# (20260716134535_native_lead_atomic_rpc, 20260801143000_lead_consent_events) and known
# LIVE_ACTIVE ledger debt (20260624130000, 20260716165508) that this script must never touch.
#
# This script NEVER runs: db push, db reset, migration up, migration repair, functions deploy,
# secrets set, gen types, or any automatic rollback / down migration.
#
# Human operation only. AI agents must not execute this script.
param(
    [switch]$DryRun,
    [string]$ReleaseWorktree,
    [string]$ReleaseCommit,
    [string]$EvidencePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ForbiddenRefs = @(
    "wkrcyxcnzhwjtdpmfpaf",
    "aqyptdxsbxqpbgoecykx",
    "wm-mvp-forensic-v2-local"
)
$RequiredMergeBranch = "forensic_report_v2"
$ConfirmPhrase = "APPLY_PR173_FOUR_MIGRATIONS_TO_LIVE_ACTIVE"
$MechanismUnavailableToken = "SAFE_EXACT_APPLICATION_MECHANISM_UNAVAILABLE"
$DbUrlEnvName = "WM_PR173_MIGRATIONS_DB_URL"
$PgSslRootCertEnvName = "WM_PR173_PGSSLROOTCERT"
$LedgerTable = "supabase_migrations.schema_migrations"
$ReleaseScriptRelativePath = "scripts/apply-pr173-four-migrations-live.ps1"
$RemoteMergeRef = "origin/forensic_report_v2"
$AdvisoryLockKey1 = 173001
$AdvisoryLockKey2 = 173173

# Independently verified immutable migration payloads at release commit 8921132f.
$ApprovedImmutablePayloads = @{
    "20260806144716" = [pscustomobject]@{
        GitBlob = "1619677770a309160887945798379eb42bce1b68"
        Sha256 = "0e4171c5b8d4f6930c68164c71016dafceb391ebbc43bf98c3d62f658b24b8b6"
    }
    "20260808160000" = [pscustomobject]@{
        GitBlob = "8953d9bb293227300171ab7eef354341cc0223d1"
        Sha256 = "53812bb3cfd2c2e4b28f33027d66bb65f88ee757333b4bb2f8ff2574ad531142"
    }
    "20260808170000" = [pscustomobject]@{
        GitBlob = "0c1023cb94b4a388042437e684cfc253f4e9dcd0"
        Sha256 = "8b6c4b154df59d989ba2e7e70801a2825f1db2b1479d5006d68fe042cca6921f"
    }
    "20260808180000" = [pscustomobject]@{
        GitBlob = "759320ffea02bdd68888c356c9e4cc6cc6599fa2"
        Sha256 = "8c5088b433cbfaf99d4be3520aa28f7671e3d9f8bc6e21afe965bd943e5212de"
    }
}

$LibpqIsolationEnvironmentNames = @(
    "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGOPTIONS",
    "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR", "PGPASSFILE", "PGREQUIREAUTH", "PGCHANNELBINDING",
    "PGSSLMODE", "PGREQUIRESSL", "PGSSLNEGOTIATION", "PGSSLCERT", "PGSSLKEY", "PGSSLROOTCERT",
    "PGSSLCRL", "PGSSLCRLDIR", "PGSSLSNI", "PGTARGETSESSIONATTRS", "PGLOADBALANCEHOSTS",
    $DbUrlEnvName
)

# Hardcoded allowlist. Exactly these four migrations, in exactly this order.
# The script never discovers additional migrations dynamically.
$MigrationAllowlist = @(
    [pscustomobject]@{
        Version = "20260806144716"
        Name = "quote_normalization_layer"
        FileName = "20260806144716_quote_normalization_layer.sql"
        WrapsOwnTransaction = $false
    },
    [pscustomobject]@{
        Version = "20260808160000"
        Name = "quote_normalization_schema_parity"
        FileName = "20260808160000_quote_normalization_schema_parity.sql"
        WrapsOwnTransaction = $false
    },
    [pscustomobject]@{
        Version = "20260808170000"
        Name = "monotonic_latest_analysis_pointer_rpc"
        FileName = "20260808170000_monotonic_latest_analysis_pointer_rpc.sql"
        WrapsOwnTransaction = $true
    },
    [pscustomobject]@{
        Version = "20260808180000"
        Name = "contractor_outcome_scan_context"
        FileName = "20260808180000_contractor_outcome_scan_context.sql"
        WrapsOwnTransaction = $false
    }
)

# Unrelated versions this script observes but must never plan, apply, record, repair, or
# reconcile. Their remote ledger state must be identical before and after.
$UntouchedSentinelVersions = @(
    "20260624130000",
    "20260716134535",
    "20260716165508",
    "20260801143000"
)

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

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Output = (& git -C $Worktree @GitArgs 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) {
            Fail $ExitCode $FailureMessage
        }
        return $Output
    }
    finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }
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
        -ExitCode 52 `
        -FailureMessage "Unable to resolve Git repository provenance."
    if (-not [System.IO.Path]::IsPathRooted($GitDirectory)) {
        $GitDirectory = Join-Path $Worktree $GitDirectory
    }
    return [System.IO.Path]::GetFullPath($GitDirectory).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
}

function Get-LibpqEnvironmentSnapshot {
    $Snapshot = @{}
    foreach ($Name in $LibpqIsolationEnvironmentNames) {
        $Snapshot[$Name] = [System.Environment]::GetEnvironmentVariable(
            $Name,
            [System.EnvironmentVariableTarget]::Process
        )
    }
    return $Snapshot
}

function Set-LibpqEnvironmentFromSnapshot {
    param([Parameter(Mandatory = $true)][hashtable]$Snapshot)
    foreach ($Name in $LibpqIsolationEnvironmentNames) {
        [System.Environment]::SetEnvironmentVariable(
            $Name,
            $Snapshot[$Name],
            [System.EnvironmentVariableTarget]::Process
        )
    }
}

function Clear-LibpqTransportOverrides {
    foreach ($Name in $LibpqIsolationEnvironmentNames) {
        [System.Environment]::SetEnvironmentVariable($Name, $null, "Process")
    }
}

function Resolve-TlsConfiguration {
    if (-not (Get-Variable -Scope Script -Name PgSslRootCertPath -ErrorAction SilentlyContinue)) {
        $script:PgSslRootCertPath = $null
    }
    if ($script:PgSslRootCertPath) {
        return $script:PgSslRootCertPath
    }
    $Candidate = [System.Environment]::GetEnvironmentVariable($PgSslRootCertEnvName)
    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        Fail 41 "TLS_CONFIGURATION_REQUIRED: $PgSslRootCertEnvName must name an existing absolute CA certificate file."
    }
    $Candidate = $Candidate.Trim()
    if (-not [System.IO.Path]::IsPathRooted($Candidate)) {
        Fail 41 "TLS_CONFIGURATION_REQUIRED: $PgSslRootCertEnvName must be an absolute path to an existing CA certificate file."
    }
    $FullPath = [System.IO.Path]::GetFullPath($Candidate)
    if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        Fail 41 "TLS_CONFIGURATION_REQUIRED: $PgSslRootCertEnvName must name an existing absolute CA certificate file."
    }
    $script:PgSslRootCertPath = $FullPath
    return $FullPath
}

function Set-ApprovedChildConnectionEnvironment {
    param(
        [Parameter(Mandatory = $true)][hashtable]$OriginalSnapshot,
        [bool]$ReadOnly = $true
    )

    Clear-LibpqTransportOverrides
    $CaPath = Resolve-TlsConfiguration
    [System.Environment]::SetEnvironmentVariable("PGHOST", $script:DbConnection.Host, "Process")
    [System.Environment]::SetEnvironmentVariable("PGHOSTADDR", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGPORT", [string]$script:DbConnection.Port, "Process")
    [System.Environment]::SetEnvironmentVariable("PGDATABASE", $script:DbConnection.Database, "Process")
    [System.Environment]::SetEnvironmentVariable("PGUSER", $script:DbConnection.Username, "Process")
    [System.Environment]::SetEnvironmentVariable("PGPASSWORD", $script:DbConnection.Password, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSERVICE", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSERVICEFILE", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGPASSFILE", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLMODE", "verify-full", "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLROOTCERT", $CaPath, "Process")
    [System.Environment]::SetEnvironmentVariable("PGREQUIRESSL", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLNEGOTIATION", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLCERT", $null, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLKEY", $null, "Process")
    if ($ReadOnly) {
        [System.Environment]::SetEnvironmentVariable(
            "PGOPTIONS",
            "-c default_transaction_read_only=on",
            "Process"
        )
    } else {
        [System.Environment]::SetEnvironmentVariable("PGOPTIONS", "", "Process")
    }
}

function ConvertTo-ProcessArgumentString {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    return (($Arguments | ForEach-Object {
        if ($null -eq $_) {
            return '""'
        }
        if ($_ -match '[\s"]') {
            return '"' + ($_.Replace('"', '\"')) + '"'
        }
        return $_
    }) -join ' ')
}

function Get-ProcessArgumentListForExecutable {
    param(
        [Parameter(Mandatory = $true)][string]$ExecutablePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    if ($ExecutablePath -match '\\mock-psql\.ps1$') {
        return @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $ExecutablePath
        ) + @($Arguments)
    }
    if ($ExecutablePath -match '\.(cmd|bat)$') {
        return @("/c", $ExecutablePath) + @($Arguments)
    }
    return $Arguments
}

function Get-ProcessFilePathForExecutable {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)
    if ($ExecutablePath -match '\\mock-psql\.ps1$') {
        return (Get-Command "powershell.exe" -CommandType Application -ErrorAction Stop).Source
    }
    if ($ExecutablePath -match '\.(cmd|bat)$') {
        return "cmd.exe"
    }
    return $ExecutablePath
}

function Test-EvidencePathValid {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [AllowNull()][string]$PathValue
    )

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return
    }
    $EvidenceFullPath = [System.IO.Path]::GetFullPath($PathValue)
    if (Test-PathWithinRoot -Root $Worktree -Candidate $EvidenceFullPath) {
        Fail 95 "EvidencePath must be outside the clean release worktree."
    }
    $PrimaryRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    if (Test-PathWithinRoot -Root $PrimaryRepoRoot -Candidate $EvidenceFullPath) {
        Fail 95 "EvidencePath must be outside the primary repository."
    }
    $EvidenceParent = Split-Path -Parent $EvidenceFullPath
    if ([string]::IsNullOrWhiteSpace($EvidenceParent) -or -not (Test-Path -LiteralPath $EvidenceParent -PathType Container)) {
        Fail 95 "EvidencePath parent directory must already exist."
    }
    try {
        $ProbeFile = Join-Path $EvidenceParent (".wm-pr173-evidence-probe-" + [guid]::NewGuid().ToString("N"))
        Set-Content -LiteralPath $ProbeFile -Value "probe" -Encoding ASCII
        Remove-Item -LiteralPath $ProbeFile -Force
    }
    catch {
        Fail 95 "EvidencePath destination is not writable."
    }
}

function Get-ReleaseScriptBlobAtCommit {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string]$Commit
    )
    return Invoke-GitText -Worktree $Worktree `
        -GitArgs @("rev-parse", ($Commit + ":" + $ReleaseScriptRelativePath)) `
        -ExitCode 58 `
        -FailureMessage "Release script is absent from the release commit."
}

function Test-ReleaseScriptIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string]$Commit,
        [Parameter(Mandatory = $true)][string]$ScriptPath
    )

    if (-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) {
        Fail 58 "Running release script path is missing."
    }
    $ScriptFullPath = (Resolve-Path -LiteralPath $ScriptPath).Path
    if (-not (Test-PathWithinRoot -Root $Worktree -Candidate $ScriptFullPath)) {
        Fail 58 "Running release script must reside inside ReleaseWorktree."
    }
    $ExpectedBlob = Get-ReleaseScriptBlobAtCommit -Worktree $Worktree -Commit $Commit
    $ActualBlob = Invoke-GitText -Worktree $Worktree `
        -GitArgs @("hash-object", "--", $ScriptFullPath) `
        -ExitCode 59 `
        -FailureMessage "Unable to hash running release script."
    if ($ActualBlob -ne $ExpectedBlob) {
        Fail 59 "Running release script blob '$ActualBlob' does not match release commit blob '$ExpectedBlob'."
    }
}

function Assert-ReleaseCommitOnFetchedMergeBranch {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Commit
    )

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot fetch origin $RequiredMergeBranch 1>$null 2>$null | Out-Null
        $FetchExitCode = $LASTEXITCODE
        $MergeRef = if ($FetchExitCode -eq 0) { $RemoteMergeRef } else { $RequiredMergeBranch }
        & git -C $RepoRoot merge-base --is-ancestor $Commit $MergeRef 1>$null 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Fail 56 "Refusing release: commit '$Commit' is not contained in freshly fetched $RemoteMergeRef."
        }
    }
    finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }
}

function New-MaterializedMigrationPayload {
    param(
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string]$Commit,
        [Parameter(Mandatory = $true)]$Migration
    )

    $Immutable = $ApprovedImmutablePayloads[$Migration.Version]
    if (-not $Immutable) {
        Fail 58 "Refusing release: migration version '$($Migration.Version)' lacks an approved immutable payload pin."
    }
    $RelativePath = "supabase/migrations/" + $Migration.FileName
    $CommittedBlob = Invoke-GitText -Worktree $Worktree `
        -GitArgs @("rev-parse", ($Commit + ":" + $RelativePath)) `
        -ExitCode 58 `
        -FailureMessage "Refusing release: '$RelativePath' is absent from release commit $Commit."
    if ($CommittedBlob -ne $Immutable.GitBlob) {
        Fail 59 ("Refusing release: Git blob for '$RelativePath' at $Commit is '$CommittedBlob'; " +
            "approved immutable blob is '$($Immutable.GitBlob)'.")
    }

    $TempPath = Join-Path (Get-SessionTempDirectory) ("wm-pr173-payload-" + $Migration.Version + ".sql")
    $Process = Start-Process `
        -FilePath "git" `
        -ArgumentList @("-C", $Worktree, "cat-file", "blob", $Immutable.GitBlob) `
        -RedirectStandardOutput $TempPath `
        -NoNewWindow `
        -Wait `
        -PassThru
    if ($Process.ExitCode -ne 0) {
        Fail 59 "Unable to materialize immutable migration payload for $($Migration.Version)."
    }

    $ActualSha256 = (Get-FileHash -LiteralPath $TempPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ActualSha256 -ne $Immutable.Sha256) {
        Fail 59 ("Refusing release: SHA-256 for materialized payload $($Migration.Version) is '$ActualSha256'; " +
            "approved immutable SHA-256 is '$($Immutable.Sha256)'.")
    }
    [void]$script:MaterializedPayloadPaths.Add($TempPath)
    return [pscustomobject]@{
        Version = $Migration.Version
        FileName = $Migration.FileName
        AbsolutePath = $TempPath
        GitBlob = $Immutable.GitBlob
        Sha256 = $Immutable.Sha256
    }
}

function Remove-SessionTempArtifacts {
    if ($script:SessionTempDirectory -and (Test-Path -LiteralPath $script:SessionTempDirectory)) {
        Remove-Item -LiteralPath $script:SessionTempDirectory -Recurse -Force -ErrorAction SilentlyContinue
        $script:SessionTempDirectory = $null
    }
}

function New-ReleasePlanSnapshot {
    param(
        [AllowEmptyCollection()][string[]]$RecordedAllowlist,
        [AllowEmptyCollection()][string[]]$BeforeSentinelState,
        [AllowEmptyCollection()][object[]]$PlannedMigrations
    )
    return [pscustomobject]@{
        RecordedAllowlist = @($RecordedAllowlist)
        BeforeSentinelState = @($BeforeSentinelState)
        PlannedVersions = @($PlannedMigrations | ForEach-Object { $_.Version })
    }
}

function Test-ReleasePlanSnapshotUnchanged {
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [Parameter(Mandatory = $true)][string[]]$CurrentRecordedAllowlist,
        [Parameter(Mandatory = $true)][string[]]$CurrentBeforeSentinelState,
        [Parameter(Mandatory = $true)][object[]]$CurrentPlannedMigrations
    )

    $CurrentPlannedVersions = @($CurrentPlannedMigrations | ForEach-Object { $_.Version })
    if (($Snapshot.RecordedAllowlist -join ",") -cne ($CurrentRecordedAllowlist -join ",")) {
        return $false
    }
    if (($Snapshot.BeforeSentinelState -join ",") -cne ($CurrentBeforeSentinelState -join ",")) {
        return $false
    }
    if (($Snapshot.PlannedVersions -join ",") -cne ($CurrentPlannedVersions -join ",")) {
        return $false
    }
    return $true
}

function New-ContractAssertionSqlFile {
    param(
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][string]$MarkerSuffix
    )

    $Definition = $ContractDefinitions[$Version]
    $SqlPath = Join-Path (Get-SessionTempDirectory) ("wm-pr173-contract-assert-" + $Version + "-" + $MarkerSuffix + ".sql")
    $Wrapped = @"
DO `$`$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
$($Definition.Sql)
    ) AS contract_checks(line)
    WHERE line !~ '^[a-z0-9_]+=OK$'
  ) THEN
    RAISE EXCEPTION 'CONTRACT_VALIDATION_FAILED';
  END IF;
END `$`$;
"@
    Set-Content -LiteralPath $SqlPath -Value $Wrapped -Encoding UTF8
    return $SqlPath
}

function New-PostConfirmationRecheckSqlFile {
    param(
        [Parameter(Mandatory = $true)]$PlanSnapshot,
        [AllowEmptyCollection()][string[]]$AllowlistVersionsList,
        [AllowEmptyCollection()][string[]]$UntouchedSentinelVersionsList
    )

    $AllowFilter = if ($AllowlistVersionsList.Count -gt 0) {
        "WHERE version IN (" + (($AllowlistVersionsList | ForEach-Object { "'$_'" }) -join ", ") + ")"
    } else {
        "WHERE false"
    }
    $SentinelFilter = if ($UntouchedSentinelVersionsList.Count -gt 0) {
        "WHERE version IN (" + (($UntouchedSentinelVersionsList | ForEach-Object { "'$_'" }) -join ", ") + ")"
    } else {
        "WHERE false"
    }
    $ExpectedRecorded = ($PlanSnapshot.RecordedAllowlist -join ",")
    $ExpectedSentinels = ($PlanSnapshot.BeforeSentinelState -join ",")

    $SqlPath = Join-Path (Get-SessionTempDirectory) "wm-pr173-post-confirm-recheck.sql"
    $Sql = @"
DO `$`$
DECLARE
  recorded text;
  sentinels text;
BEGIN
  SELECT COALESCE(string_agg(version, ',' ORDER BY version), '') INTO recorded
  FROM $LedgerTable
  $AllowFilter;
  IF recorded <> '$ExpectedRecorded' THEN
    RAISE EXCEPTION 'REMOTE_STATE_CHANGED_AFTER_CONFIRMATION';
  END IF;

  SELECT COALESCE(string_agg(version, ',' ORDER BY version), '') INTO sentinels
  FROM $LedgerTable
  $SentinelFilter;
  IF sentinels <> '$ExpectedSentinels' THEN
    RAISE EXCEPTION 'REMOTE_STATE_CHANGED_AFTER_CONFIRMATION';
  END IF;
END `$`$;
"@
    Set-Content -LiteralPath $SqlPath -Value $Sql -Encoding UTF8
    return $SqlPath
}

function Get-AdvisoryLockInlineCommand {
    return ("DO `$`$ BEGIN IF NOT pg_try_advisory_lock(" + $AdvisoryLockKey1 + ", " + $AdvisoryLockKey2 +
        ") THEN RAISE EXCEPTION 'RELEASE_ALREADY_RUNNING'; END IF; END `$`$;")
}

function Test-PsqlFailureIndicatesReleaseAlreadyRunning {
    param([Parameter(Mandatory = $true)]$Result)
    return ($Result.Stderr -like "*RELEASE_ALREADY_RUNNING*") -or ($Result.Stdout -like "*RELEASE_ALREADY_RUNNING*")
}

function Test-PsqlFailureIndicatesRemoteStateChanged {
    param([Parameter(Mandatory = $true)]$Result)
    return ($Result.Stderr -like "*REMOTE_STATE_CHANGED_AFTER_CONFIRMATION*") -or `
        ($Result.Stdout -like "*REMOTE_STATE_CHANGED_AFTER_CONFIRMATION*")
}

function Test-PsqlConnectionAmbiguous {
    param([Parameter(Mandatory = $true)]$Result)
    if ($Result.ConnectionAmbiguous) {
        return $true
    }
    $Combined = ($Result.Stderr + "`n" + $Result.Stdout).ToLowerInvariant()
    return ($Combined -match 'could not connect') -or ($Combined -match 'connection refused') -or `
        ($Combined -match 'server closed the connection') -or ($Combined -match 'timeout expired')
}

function Emit-UnknownRemoteStateEvidence {
    param(
        [Parameter(Mandatory = $true)]$EvidenceBase,
        [Parameter(Mandatory = $true)][string]$Worktree,
        [Parameter(Mandatory = $true)][string]$Detail
    )
    $EvidenceBase["result"] = "UNKNOWN_REMOTE_STATE"
    $EvidenceBase["unknown_remote_state_detail"] = $Detail
    $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
    Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $Worktree
    Fail 91 "UNKNOWN_REMOTE_STATE: $Detail"
}

# ---------------------------------------------------------------------------
# psql resolution and invocation
# ---------------------------------------------------------------------------

$script:PsqlResolved = $null
$script:SessionTempDirectory = $null
$script:DbConnection = $null
$script:PgSslRootCertPath = $null
$script:RunningScriptPath = $MyInvocation.MyCommand.Path
$script:MaterializedPayloadPaths = New-Object System.Collections.Generic.List[string]
$script:ChildProcessInvocationCount = 0

function ConvertFrom-ApprovedDatabaseUrl {
    param([Parameter(Mandatory = $true)][string]$Value)

    # Validate the raw URI grammar before System.Uri can normalize it. Userinfo permits only
    # RFC 3986 unreserved, percent-encoded, sub-delimiter, and colon characters.
    $CanonicalMatch = [regex]::Match(
        $Value,
        '^(?<scheme>(?i:postgres(?:ql)?))://(?<userinfo>(?:[A-Za-z0-9._~!$&''()*+,;=:-]|%[0-9A-Fa-f]{2})+)@(?<host>[A-Za-z0-9.-]+)(?::(?<port>[1-9][0-9]{0,4}))?/postgres$'
    )
    if (-not $CanonicalMatch.Success) {
        Fail 31 "$DbUrlEnvName is not a valid unambiguous Postgres connection string."
    }

    $Uri = $null
    if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$Uri)) {
        Fail 31 "$DbUrlEnvName is not a valid Postgres connection string."
    }

    $Scheme = $Uri.Scheme.ToLowerInvariant()
    if ($Scheme -notin @("postgres", "postgresql")) {
        Fail 31 "$DbUrlEnvName must use the postgres:// or postgresql:// scheme."
    }
    if (-not [string]::IsNullOrEmpty($Uri.Fragment) -or -not [string]::IsNullOrEmpty($Uri.Query)) {
        Fail 31 "$DbUrlEnvName must not contain a query string or fragment."
    }
    if ($Uri.HostNameType -ne [System.UriHostNameType]::Dns) {
        Fail 32 "Refusing release: database host is not an approved LIVE_ACTIVE endpoint."
    }
    if ($Uri.AbsolutePath -cne "/postgres") {
        Fail 31 "$DbUrlEnvName database must be exactly 'postgres'."
    }

    $UserInfo = $CanonicalMatch.Groups["userinfo"].Value
    $SeparatorIndex = $UserInfo.IndexOf(":")
    if ($SeparatorIndex -le 0 -or $SeparatorIndex -ge ($UserInfo.Length - 1)) {
        Fail 31 "$DbUrlEnvName must contain an explicit username and password."
    }

    $RawUsername = $UserInfo.Substring(0, $SeparatorIndex)
    try {
        $Username = [System.Uri]::UnescapeDataString($RawUsername)
        $Password = [System.Uri]::UnescapeDataString($UserInfo.Substring($SeparatorIndex + 1))
        $HostName = $CanonicalMatch.Groups["host"].Value.ToLowerInvariant()
    }
    catch {
        Fail 31 "$DbUrlEnvName contains malformed endpoint or credential encoding."
    }
    if ([string]::IsNullOrEmpty($Password)) {
        Fail 31 "$DbUrlEnvName must contain a non-empty password."
    }
    if (-not $Uri.Host.Equals($HostName, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 31 "$DbUrlEnvName contains an ambiguous database host."
    }
    $PortGroup = $CanonicalMatch.Groups["port"]
    if ($PortGroup.Success) {
        $Port = [int]$PortGroup.Value
    }
    else {
        $Port = 5432
    }
    if ($Port -lt 1 -or $Port -gt 65535) {
        Fail 31 "$DbUrlEnvName contains an invalid port."
    }

    $DirectHost = "db.$ApprovedRef.supabase.co"
    $PoolerHostPattern = '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pooler\.supabase\.com$'
    if ($HostName -ceq $DirectHost) {
        if ($RawUsername -cne "postgres" -or $Username -cne "postgres") {
            Fail 32 "Refusing release: direct LIVE_ACTIVE connections require the exact approved username."
        }
        $EndpointType = "DIRECT"
    }
    elseif ($HostName -cmatch $PoolerHostPattern) {
        if ($Username -cne "postgres.$ApprovedRef") {
            Fail 32 "Refusing release: pooler connection username does not prove the approved LIVE_ACTIVE project."
        }
        $EndpointType = "SUPABASE_POOLER"
    }
    else {
        Fail 32 "Refusing release: database host is not an approved LIVE_ACTIVE endpoint."
    }

    return [pscustomobject]@{
        EndpointType = $EndpointType
        Host = $HostName
        Port = $Port
        Database = "postgres"
        Username = $Username
        Password = $Password
    }
}

function Resolve-PsqlInvocation {
    if ($script:PsqlResolved) {
        return $script:PsqlResolved
    }

    if (-not [string]::IsNullOrWhiteSpace($env:FAKE_PSQL_LOG)) {
        $MockHarnessRoot = Split-Path $env:FAKE_PSQL_LOG -Parent
        $MockScript = Join-Path $MockHarnessRoot "mock-bin\mock-psql.ps1"
        if (-not (Test-Path -LiteralPath $MockScript -PathType Leaf)) {
            $MockScript = Join-Path $MockHarnessRoot "mock-bin\psql.cmd"
        }
        if (Test-Path -LiteralPath $MockScript -PathType Leaf) {
            $script:PsqlResolved = [pscustomobject]@{
                FilePath = (Resolve-Path -LiteralPath $MockScript).Path
                SourceLabel = "mock psql test harness"
            }
            return $script:PsqlResolved
        }
    }

    $PsqlCommand = @(Get-Command "psql" -CommandType Application -ErrorAction SilentlyContinue) | Select-Object -First 1
    if (-not $PsqlCommand) {
        [Console]::Error.WriteLine($MechanismUnavailableToken)
        Fail 40 ("psql is not available on PATH. The only documented mechanism that guarantees exact " +
            "four-migration selection plus correct supabase_migrations.schema_migrations recording is a " +
            "per-migration psql transaction with an explicit ledger insert. Broad 'supabase db push' is " +
            "forbidden because this repository has unrelated pending migrations and unreconciled ledger " +
            "debt. Result: $MechanismUnavailableToken. Install PostgreSQL client tools, then rerun.")
    }
    $script:PsqlResolved = [pscustomobject]@{
        FilePath = $PsqlCommand.Source
        SourceLabel = "psql on PATH"
    }
    return $script:PsqlResolved
}

function Get-SessionTempDirectory {
    if (-not $script:SessionTempDirectory) {
        $script:SessionTempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("wm-pr173-release-" + [guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $script:SessionTempDirectory -Force | Out-Null
    }
    return $script:SessionTempDirectory
}

function Invoke-Psql {
    # Runs psql with connection fields inherited through temporary process environment variables.
    # Neither the raw connection URI nor its password is ever placed in a child command line.
    param(
        [Parameter(Mandatory = $true)][string]$SqlFilePath,
        [Parameter(Mandatory = $true)][string]$OperationName,
        [bool]$ReadOnly = $true,
        [bool]$SingleTransaction = $false,
        [string[]]$ExtraArguments = @()
    )

    $Psql = Resolve-PsqlInvocation
    $Arguments = @(
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--set", "ON_ERROR_STOP=1"
    )
    if ($SingleTransaction) {
        $Arguments += "--single-transaction"
    }
    $Arguments += $ExtraArguments
    $Arguments += @("--file", $SqlFilePath)

    $StdoutFile = [System.IO.Path]::GetTempFileName()
    $StderrFile = [System.IO.Path]::GetTempFileName()
    $OriginalLibpqEnvironment = Get-LibpqEnvironmentSnapshot
    try {
        Set-ApprovedChildConnectionEnvironment -OriginalSnapshot $OriginalLibpqEnvironment -ReadOnly $ReadOnly
        if (-not (Get-Variable -Scope Script -Name ChildProcessInvocationCount -ErrorAction SilentlyContinue)) {
            $script:ChildProcessInvocationCount = 0
        }
        $script:ChildProcessInvocationCount++

        $ProcessFilePath = Get-ProcessFilePathForExecutable -ExecutablePath $Psql.FilePath
        $ProcessArgumentList = @(Get-ProcessArgumentListForExecutable -ExecutablePath $Psql.FilePath -Arguments $Arguments)
        $Process = Start-Process `
            -FilePath $ProcessFilePath `
            -ArgumentList (ConvertTo-ProcessArgumentString -Arguments $ProcessArgumentList) `
            -RedirectStandardOutput $StdoutFile `
            -RedirectStandardError $StderrFile `
            -NoNewWindow `
            -Wait `
            -PassThru
        $Stdout = (Get-Content -LiteralPath $StdoutFile -Raw -ErrorAction SilentlyContinue)
        $Stderr = (Get-Content -LiteralPath $StderrFile -Raw -ErrorAction SilentlyContinue)
        if ($null -eq $Stdout) { $Stdout = "" }
        if ($null -eq $Stderr) { $Stderr = "" }

        return [pscustomobject]@{
            OperationName = $OperationName
            ExitCode = $Process.ExitCode
            Stdout = ($Stdout -replace "`r`n", "`n").Trim()
            Stderr = ($Stderr -replace "`r`n", "`n").Trim()
            ConnectionAmbiguous = $false
        }
    }
    finally {
        Set-LibpqEnvironmentFromSnapshot -Snapshot $OriginalLibpqEnvironment
        Remove-Item -LiteralPath $StdoutFile -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $StderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-PsqlSessionChain {
    param(
        [Parameter(Mandatory = $true)][string]$OperationName,
        [Parameter(Mandatory = $true)][string[]]$SqlFilePaths,
        [Parameter(Mandatory = $true)][string[]]$InlineCommands,
        [bool]$ReadOnly = $false
    )

    $Psql = Resolve-PsqlInvocation
    $Arguments = @(
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--set", "ON_ERROR_STOP=1"
    )
    foreach ($Command in $InlineCommands) {
        $Arguments += @("-c", $Command)
    }
    foreach ($SqlFilePath in $SqlFilePaths) {
        $Arguments += @("--file", $SqlFilePath)
    }

    $StdoutFile = [System.IO.Path]::GetTempFileName()
    $StderrFile = [System.IO.Path]::GetTempFileName()
    $OriginalLibpqEnvironment = Get-LibpqEnvironmentSnapshot
    try {
        Set-ApprovedChildConnectionEnvironment -OriginalSnapshot $OriginalLibpqEnvironment -ReadOnly $ReadOnly
        if (-not (Get-Variable -Scope Script -Name ChildProcessInvocationCount -ErrorAction SilentlyContinue)) {
            $script:ChildProcessInvocationCount = 0
        }
        $script:ChildProcessInvocationCount++

        $ProcessFilePath = Get-ProcessFilePathForExecutable -ExecutablePath $Psql.FilePath
        $ProcessArgumentList = @(Get-ProcessArgumentListForExecutable -ExecutablePath $Psql.FilePath -Arguments $Arguments)
        $Process = Start-Process `
            -FilePath $ProcessFilePath `
            -ArgumentList (ConvertTo-ProcessArgumentString -Arguments $ProcessArgumentList) `
            -RedirectStandardOutput $StdoutFile `
            -RedirectStandardError $StderrFile `
            -NoNewWindow `
            -Wait `
            -PassThru
        $Stdout = (Get-Content -LiteralPath $StdoutFile -Raw -ErrorAction SilentlyContinue)
        $Stderr = (Get-Content -LiteralPath $StderrFile -Raw -ErrorAction SilentlyContinue)
        if ($null -eq $Stdout) { $Stdout = "" }
        if ($null -eq $Stderr) { $Stderr = "" }

        return [pscustomobject]@{
            OperationName = $OperationName
            ExitCode = $Process.ExitCode
            Stdout = ($Stdout -replace "`r`n", "`n").Trim()
            Stderr = ($Stderr -replace "`r`n", "`n").Trim()
            ConnectionAmbiguous = $false
        }
    }
    finally {
        Set-LibpqEnvironmentFromSnapshot -Snapshot $OriginalLibpqEnvironment
        Remove-Item -LiteralPath $StdoutFile -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $StderrFile -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-PsqlRead {
    # Read-only query. SQL is written to a marker-named temp file so mutation and read
    # invocations remain distinguishable in audits and tests.
    param(
        [Parameter(Mandatory = $true)][string]$Marker,
        [Parameter(Mandatory = $true)][string]$Sql
    )

    $SqlFile = Join-Path (Get-SessionTempDirectory) ("wm-pr173-read-" + $Marker + ".sql")
    Set-Content -LiteralPath $SqlFile -Value $Sql -Encoding UTF8
    $Result = Invoke-Psql -SqlFilePath $SqlFile -OperationName "read $Marker" -ReadOnly $true
    if ($Result.ExitCode -ne 0) {
        if (Test-PsqlConnectionAmbiguous -Result $Result) {
            throw [System.InvalidOperationException]::new("UNKNOWN_REMOTE_STATE")
        }
        Fail 60 "Read-only remote query '$Marker' failed (psql exit $($Result.ExitCode))."
    }
    # Unary comma keeps zero/one-line results as real arrays through function return.
    return ,@($Result.Stdout -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { $_.Trim() })
}

# ---------------------------------------------------------------------------
# Remote reads: ledger and contracts (metadata only - never customer/lead/quote rows)
# ---------------------------------------------------------------------------

$AllObservedVersions = @($MigrationAllowlist | ForEach-Object { $_.Version }) + $UntouchedSentinelVersions
$ObservedVersionInList = ($AllObservedVersions | ForEach-Object { "'$_'" }) -join ", "

function Get-RemoteLedgerState {
    param([Parameter(Mandatory = $true)][string]$Marker)

    $TableLines = Invoke-PsqlRead -Marker ($Marker + "-ledger-table") -Sql @"
SELECT COALESCE(to_regclass('$LedgerTable')::text, 'MISSING');
"@
    if ($TableLines.Count -ne 1) {
        Fail 61 "Malformed ledger-table probe output ($($TableLines.Count) lines)."
    }
    if ($TableLines[0] -eq "MISSING") {
        Fail 62 "Remote ledger table $LedgerTable does not exist. Stopping: this is not a recognizable Supabase migration ledger."
    }
    if ($TableLines[0] -ne $LedgerTable) {
        Fail 61 "Malformed ledger-table probe output: '$($TableLines[0])'."
    }

    $Recorded = Invoke-PsqlRead -Marker ($Marker + "-ledger-state") -Sql @"
SELECT version FROM $LedgerTable WHERE version IN ($ObservedVersionInList) ORDER BY version;
"@
    foreach ($Line in $Recorded) {
        if ($Line -notmatch '^\d{14}$' -or ($AllObservedVersions -notcontains $Line)) {
            Fail 61 "Malformed remote ledger output line: '$Line'. Stopping with zero mutations."
        }
    }
    return ,@($Recorded)
}

function Get-RemoteLedgerColumns {
    $Columns = Invoke-PsqlRead -Marker "ledger-columns" -Sql @"
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
ORDER BY column_name;
"@
    foreach ($Line in $Columns) {
        if ($Line -notmatch '^[a-z_][a-z0-9_]*$') {
            Fail 61 "Malformed ledger-columns output line: '$Line'."
        }
    }
    if ($Columns -notcontains "version") {
        Fail 63 "Remote ledger table has no 'version' column. Stopping: cannot record migrations safely."
    }
    return ,@($Columns)
}

# Contract definitions. Every check line returned by the SQL must read '<name>=OK'.
$ContractDefinitions = [ordered]@{}

$ContractDefinitions["20260806144716"] = [pscustomobject]@{
    ExpectedChecks = @(
        "qo_table", "qli_table", "nf_table",
        "qo_rls", "qli_rls", "nf_rls",
        "qo_service_role_policy", "qo_internal_select_policy",
        "qli_service_role_policy", "qli_internal_select_policy",
        "nf_service_role_policy", "nf_internal_select_policy",
        "qo_authenticated_select", "qo_authenticated_no_insert", "qo_anon_no_select", "qo_service_role_insert",
        "qli_authenticated_select", "qli_authenticated_no_insert", "qli_anon_no_select", "qli_service_role_insert",
        "nf_authenticated_select", "nf_authenticated_no_insert", "nf_anon_no_select", "nf_service_role_insert",
        "qo_policy_count", "qli_policy_count", "nf_policy_count",
        "qo_no_anon_or_public_policies", "qli_no_anon_or_public_policies", "nf_no_anon_or_public_policies",
        "qo_no_extra_permissive_policies", "qli_no_extra_permissive_policies", "nf_no_extra_permissive_policies",
        "qo_service_role_policy_semantics", "qli_service_role_policy_semantics", "nf_service_role_policy_semantics",
        "qo_internal_select_policy_semantics", "qli_internal_select_policy_semantics", "nf_internal_select_policy_semantics"
    )
    Sql = @"
SELECT 'qo_table=' || CASE WHEN to_regclass('public.quote_observations') IS NOT NULL THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_table=' || CASE WHEN to_regclass('public.quote_line_items') IS NOT NULL THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_table=' || CASE WHEN to_regclass('public.normalization_failures') IS NOT NULL THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_rls=' || CASE WHEN COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.quote_observations')), false) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_rls=' || CASE WHEN COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.quote_line_items')), false) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_rls=' || CASE WHEN COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.normalization_failures')), false) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_service_role_policy=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_observations' AND policyname = 'quote_observations_service_role_all') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_internal_select_policy=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_observations' AND policyname = 'quote_observations_select_internal') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_service_role_policy=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_line_items' AND policyname = 'quote_line_items_service_role_all') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_internal_select_policy=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_line_items' AND policyname = 'quote_line_items_select_internal') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_service_role_policy=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'normalization_failures' AND policyname = 'normalization_failures_service_role_all') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_internal_select_policy=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'normalization_failures' AND policyname = 'normalization_failures_select_internal') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_authenticated_select=' || CASE WHEN to_regclass('public.quote_observations') IS NULL THEN 'FAIL' WHEN has_table_privilege('authenticated', 'public.quote_observations', 'SELECT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_authenticated_no_insert=' || CASE WHEN to_regclass('public.quote_observations') IS NULL THEN 'FAIL' WHEN NOT has_table_privilege('authenticated', 'public.quote_observations', 'INSERT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_anon_no_select=' || CASE WHEN to_regclass('public.quote_observations') IS NULL THEN 'FAIL' WHEN NOT has_table_privilege('anon', 'public.quote_observations', 'SELECT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_service_role_insert=' || CASE WHEN to_regclass('public.quote_observations') IS NULL THEN 'FAIL' WHEN has_table_privilege('service_role', 'public.quote_observations', 'INSERT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_authenticated_select=' || CASE WHEN to_regclass('public.quote_line_items') IS NULL THEN 'FAIL' WHEN has_table_privilege('authenticated', 'public.quote_line_items', 'SELECT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_authenticated_no_insert=' || CASE WHEN to_regclass('public.quote_line_items') IS NULL THEN 'FAIL' WHEN NOT has_table_privilege('authenticated', 'public.quote_line_items', 'INSERT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_anon_no_select=' || CASE WHEN to_regclass('public.quote_line_items') IS NULL THEN 'FAIL' WHEN NOT has_table_privilege('anon', 'public.quote_line_items', 'SELECT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_service_role_insert=' || CASE WHEN to_regclass('public.quote_line_items') IS NULL THEN 'FAIL' WHEN has_table_privilege('service_role', 'public.quote_line_items', 'INSERT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_authenticated_select=' || CASE WHEN to_regclass('public.normalization_failures') IS NULL THEN 'FAIL' WHEN has_table_privilege('authenticated', 'public.normalization_failures', 'SELECT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_authenticated_no_insert=' || CASE WHEN to_regclass('public.normalization_failures') IS NULL THEN 'FAIL' WHEN NOT has_table_privilege('authenticated', 'public.normalization_failures', 'INSERT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_anon_no_select=' || CASE WHEN to_regclass('public.normalization_failures') IS NULL THEN 'FAIL' WHEN NOT has_table_privilege('anon', 'public.normalization_failures', 'SELECT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_service_role_insert=' || CASE WHEN to_regclass('public.normalization_failures') IS NULL THEN 'FAIL' WHEN has_table_privilege('service_role', 'public.normalization_failures', 'INSERT') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_policy_count=' || CASE WHEN (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_observations') = 2 THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_policy_count=' || CASE WHEN (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_line_items') = 2 THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_policy_count=' || CASE WHEN (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'normalization_failures') = 2 THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_no_anon_or_public_policies=' || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies p, unnest(p.roles) AS role_name WHERE p.schemaname = 'public' AND p.tablename = 'quote_observations' AND role_name IN ('anon', 'public')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_no_anon_or_public_policies=' || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies p, unnest(p.roles) AS role_name WHERE p.schemaname = 'public' AND p.tablename = 'quote_line_items' AND role_name IN ('anon', 'public')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_no_anon_or_public_policies=' || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies p, unnest(p.roles) AS role_name WHERE p.schemaname = 'public' AND p.tablename = 'normalization_failures' AND role_name IN ('anon', 'public')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_no_extra_permissive_policies=' || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_observations' AND permissive AND policyname NOT IN ('quote_observations_service_role_all', 'quote_observations_select_internal')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_no_extra_permissive_policies=' || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_line_items' AND permissive AND policyname NOT IN ('quote_line_items_service_role_all', 'quote_line_items_select_internal')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_no_extra_permissive_policies=' || CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'normalization_failures' AND permissive AND policyname NOT IN ('normalization_failures_service_role_all', 'normalization_failures_select_internal')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_service_role_policy_semantics=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_observations' AND policyname = 'quote_observations_service_role_all' AND cmd = 'ALL' AND 'service_role' = ANY (roles) AND permissive AND qual = 'true' AND with_check = 'true') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_service_role_policy_semantics=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_line_items' AND policyname = 'quote_line_items_service_role_all' AND cmd = 'ALL' AND 'service_role' = ANY (roles) AND permissive AND qual = 'true' AND with_check = 'true') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_service_role_policy_semantics=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'normalization_failures' AND policyname = 'normalization_failures_service_role_all' AND cmd = 'ALL' AND 'service_role' = ANY (roles) AND permissive AND qual = 'true' AND with_check = 'true') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_internal_select_policy_semantics=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_observations' AND policyname = 'quote_observations_select_internal' AND cmd = 'SELECT' AND 'authenticated' = ANY (roles) AND permissive AND qual = '((SELECT public.is_internal_operator()))' AND with_check IS NULL) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_internal_select_policy_semantics=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quote_line_items' AND policyname = 'quote_line_items_select_internal' AND cmd = 'SELECT' AND 'authenticated' = ANY (roles) AND permissive AND qual = '((SELECT public.is_internal_operator()))' AND with_check IS NULL) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'nf_internal_select_policy_semantics=' || CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'normalization_failures' AND policyname = 'normalization_failures_select_internal' AND cmd = 'SELECT' AND 'authenticated' = ANY (roles) AND permissive AND qual = '((SELECT public.is_internal_operator()))' AND with_check IS NULL) THEN 'OK' ELSE 'FAIL' END;
"@
}

$ContractDefinitions["20260808160000"] = [pscustomobject]@{
    ExpectedChecks = @(
        "qo_total_united_inches_column", "qo_is_stats_eligible_column",
        "qli_width_inches_column", "qli_height_inches_column",
        "qli_united_inches_column", "qli_cents_per_united_inch_column",
        "qli_quantity_numeric"
    )
    Sql = @"
SELECT 'qo_total_united_inches_column=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_observations' AND column_name = 'total_united_inches') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qo_is_stats_eligible_column=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_observations' AND column_name = 'is_stats_eligible') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_width_inches_column=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_line_items' AND column_name = 'width_inches') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_height_inches_column=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_line_items' AND column_name = 'height_inches') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_united_inches_column=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_line_items' AND column_name = 'united_inches') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_cents_per_united_inch_column=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_line_items' AND column_name = 'cents_per_united_inch') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'qli_quantity_numeric=' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_line_items' AND column_name = 'quantity' AND data_type = 'numeric') THEN 'OK' ELSE 'FAIL' END;
"@
}

$ContractDefinitions["20260808170000"] = [pscustomobject]@{
    ExpectedChecks = @(
        "pointer_rpc_exists", "pointer_rpc_arguments", "pointer_rpc_result_shape",
        "pointer_rpc_security_invoker", "pointer_rpc_empty_search_path",
        "pointer_rpc_execute_service_role_only",
        "service_role_leads_select_update", "service_role_analyses_select_update"
    )
    Sql = @"
SELECT 'pointer_rpc_exists=' || CASE WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NOT NULL THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'pointer_rpc_arguments=' || CASE WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NULL THEN 'FAIL' WHEN pg_get_function_identity_arguments(to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)')) = 'p_lead_id uuid, p_analysis_id uuid' THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'pointer_rpc_result_shape=' || CASE WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NULL THEN 'FAIL' WHEN pg_get_function_result(to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)')) = 'TABLE(updated boolean, outcome text, latest_analysis_id uuid)' THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'pointer_rpc_security_invoker=' || CASE WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NULL THEN 'FAIL' WHEN NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'pointer_rpc_empty_search_path=' || CASE WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NULL THEN 'FAIL' WHEN EXISTS (SELECT 1 FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value) WHERE p.oid = to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') AND split_part(cfg.value, '=', 1) = 'search_path' AND btrim(split_part(cfg.value, '=', 2), '"') = '') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'pointer_rpc_execute_service_role_only=' || CASE
    WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NULL THEN 'FAIL'
    WHEN EXISTS (
        SELECT 1
        FROM pg_proc p,
             aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
        LEFT JOIN pg_roles role_grantee ON role_grantee.oid = acl.grantee
        WHERE p.oid = to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)')
          AND acl.privilege_type = 'EXECUTE'
          AND acl.grantee <> p.proowner
          AND COALESCE(role_grantee.rolname, 'PUBLIC') <> 'service_role'
    ) THEN 'FAIL'
    WHEN NOT EXISTS (
        SELECT 1
        FROM pg_proc p,
             aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
        JOIN pg_roles role_grantee ON role_grantee.oid = acl.grantee
        WHERE p.oid = to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)')
          AND acl.privilege_type = 'EXECUTE'
          AND role_grantee.rolname = 'service_role'
    ) THEN 'FAIL'
    ELSE 'OK' END
UNION ALL SELECT 'service_role_leads_select_update=' || CASE WHEN to_regclass('public.leads') IS NULL THEN 'FAIL' WHEN has_table_privilege('service_role', 'public.leads', 'SELECT') AND has_table_privilege('service_role', 'public.leads', 'UPDATE') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'service_role_analyses_select_update=' || CASE WHEN to_regclass('public.analyses') IS NULL THEN 'FAIL' WHEN has_table_privilege('service_role', 'public.analyses', 'SELECT') AND has_table_privilege('service_role', 'public.analyses', 'UPDATE') THEN 'OK' ELSE 'FAIL' END;
"@
}

$ContractDefinitions["20260808180000"] = [pscustomobject]@{
    ExpectedChecks = @(
        "outcome_integrity_fn_exists",
        "outcome_integrity_no_stale_column_reference",
        "outcome_integrity_uses_opportunity_scan_session",
        "outcome_integrity_security_definer",
        "outcome_integrity_search_path_public",
        "outcome_integrity_internal_operator_gate",
        "outcome_integrity_authenticated_execute",
        "outcome_integrity_service_role_execute",
        "outcome_integrity_anon_no_execute",
        "outcome_integrity_public_no_execute"
    )
    Sql = @"
SELECT 'outcome_integrity_fn_exists=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NOT NULL THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_no_stale_column_reference=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN pg_get_functiondef(to_regprocedure('public.admin_contractor_outcome_integrity()')) NOT LIKE '%latest_scan_session_id%' THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_uses_opportunity_scan_session=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN pg_get_functiondef(to_regprocedure('public.admin_contractor_outcome_integrity()')) LIKE '%opp.scan_session_id%' THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_security_definer=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.admin_contractor_outcome_integrity()')) THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_search_path_public=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN pg_get_functiondef(to_regprocedure('public.admin_contractor_outcome_integrity()')) LIKE '%SET search_path = public%' THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_internal_operator_gate=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN pg_get_functiondef(to_regprocedure('public.admin_contractor_outcome_integrity()')) LIKE '%public.is_internal_operator()%' THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_authenticated_execute=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN has_function_privilege('authenticated', to_regprocedure('public.admin_contractor_outcome_integrity()'), 'EXECUTE') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_service_role_execute=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN has_function_privilege('service_role', to_regprocedure('public.admin_contractor_outcome_integrity()'), 'EXECUTE') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_anon_no_execute=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN NOT has_function_privilege('anon', to_regprocedure('public.admin_contractor_outcome_integrity()'), 'EXECUTE') THEN 'OK' ELSE 'FAIL' END
UNION ALL SELECT 'outcome_integrity_public_no_execute=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FAIL' WHEN NOT has_function_privilege('PUBLIC', to_regprocedure('public.admin_contractor_outcome_integrity()'), 'EXECUTE') THEN 'OK' ELSE 'FAIL' END;
"@
}

function Test-InstalledContract {
    # Returns @{ Passed = bool; Failures = string[] } for one migration's installed contract.
    param(
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][string]$MarkerSuffix
    )

    $Definition = $ContractDefinitions[$Version]
    $Lines = Invoke-PsqlRead -Marker ("contract-" + $Version + "-" + $MarkerSuffix) -Sql $Definition.Sql

    $Failures = New-Object System.Collections.Generic.List[string]
    $SeenChecks = New-Object System.Collections.Generic.List[string]
    foreach ($Line in $Lines) {
        if ($Line -notmatch '^(?<name>[a-z0-9_]+)=(?<verdict>OK|FAIL)$') {
            Fail 61 "Malformed contract check output for $Version : '$Line'."
        }
        $CheckName = $Matches["name"]
        if ($Definition.ExpectedChecks -notcontains $CheckName) {
            Fail 61 "Unexpected contract check name for $Version : '$CheckName'."
        }
        [void]$SeenChecks.Add($CheckName)
        if ($Matches["verdict"] -ne "OK") {
            [void]$Failures.Add($CheckName)
        }
    }
    foreach ($Expected in $Definition.ExpectedChecks) {
        if ($SeenChecks -notcontains $Expected) {
            [void]$Failures.Add($Expected + " (missing from output)")
        }
    }

    return [pscustomobject]@{
        Passed = ($Failures.Count -eq 0)
        Failures = @($Failures)
    }
}

function Get-DriftProbe {
    # Detects installed-schema-without-ledger drift for a not-yet-recorded migration.
    # Returns 'PLAN_OK' or a stop reason string.
    param([Parameter(Mandatory = $true)][string]$Version)

    switch ($Version) {
        "20260806144716" {
            $Lines = Invoke-PsqlRead -Marker "drift-20260806144716" -Sql @"
SELECT 'normalization_layer_objects=' || CASE WHEN to_regclass('public.quote_observations') IS NOT NULL OR to_regclass('public.quote_line_items') IS NOT NULL OR to_regclass('public.normalization_failures') IS NOT NULL THEN 'PRESENT' ELSE 'ABSENT' END;
"@
            if ($Lines.Count -ne 1 -or $Lines[0] -notmatch '^normalization_layer_objects=(PRESENT|ABSENT)$') {
                Fail 61 "Malformed drift probe output for 20260806144716."
            }
            if ($Lines[0].EndsWith("=PRESENT")) {
                return "Normalization tables already exist but version 20260806144716 is not in the remote ledger."
            }
            return "PLAN_OK"
        }
        "20260808160000" {
            # Explicitly idempotent parity migration; its columns legitimately pre-exist when the
            # final revision of 20260806144716 was just planned or applied. No drift stop.
            return "PLAN_OK"
        }
        "20260808170000" {
            $Lines = Invoke-PsqlRead -Marker "drift-20260808170000" -Sql @"
SELECT 'pointer_rpc=' || CASE WHEN to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NOT NULL THEN 'PRESENT' ELSE 'ABSENT' END;
"@
            if ($Lines.Count -ne 1 -or $Lines[0] -notmatch '^pointer_rpc=(PRESENT|ABSENT)$') {
                Fail 61 "Malformed drift probe output for 20260808170000."
            }
            if ($Lines[0].EndsWith("=PRESENT")) {
                return "Pointer RPC already exists but version 20260808170000 is not in the remote ledger."
            }
            return "PLAN_OK"
        }
        "20260808180000" {
            $Lines = Invoke-PsqlRead -Marker "drift-20260808180000" -Sql @"
SELECT 'outcome_integrity_fn=' || CASE WHEN to_regprocedure('public.admin_contractor_outcome_integrity()') IS NULL THEN 'FUNCTION_MISSING' WHEN pg_get_functiondef(to_regprocedure('public.admin_contractor_outcome_integrity()')) LIKE '%latest_scan_session_id%' THEN 'STALE_CONTRACT_PRESENT' ELSE 'REPAIRED_CONTRACT_PRESENT' END;
"@
            if ($Lines.Count -ne 1 -or $Lines[0] -notmatch '^outcome_integrity_fn=(FUNCTION_MISSING|STALE_CONTRACT_PRESENT|REPAIRED_CONTRACT_PRESENT)$') {
                Fail 61 "Malformed drift probe output for 20260808180000."
            }
            if ($Lines[0].EndsWith("=FUNCTION_MISSING")) {
                return "admin_contractor_outcome_integrity() is missing entirely; expected the 20260427170000 baseline before this repair."
            }
            if ($Lines[0].EndsWith("=REPAIRED_CONTRACT_PRESENT")) {
                return "admin_contractor_outcome_integrity() already carries the repaired contract but version 20260808180000 is not in the remote ledger."
            }
            return "PLAN_OK"
        }
        default {
            Fail 61 "Unknown drift probe version '$Version'."
        }
    }
}

# ---------------------------------------------------------------------------
# Ledger recording
# ---------------------------------------------------------------------------

function New-LedgerRecordSql {
    param(
        [Parameter(Mandatory = $true)]$Migration,
        [Parameter(Mandatory = $true)][string]$FileContent,
        [Parameter(Mandatory = $true)][string[]]$LedgerColumns
    )

    if ($Migration.Version -notmatch '^\d{14}$') {
        Fail 82 "Refusing ledger record: version failed strict validation."
    }
    if ($Migration.Name -notmatch '^[a-z0-9_]+$') {
        Fail 82 "Refusing ledger record: migration name failed strict validation."
    }

    $Tag = $null
    for ($Attempt = 0; $Attempt -lt 16; $Attempt++) {
        $Candidate = "wm_pr173_" + [guid]::NewGuid().ToString("N").Substring(0, 12)
        if (-not $FileContent.Contains('$' + $Candidate + '$')) {
            $Tag = $Candidate
            break
        }
    }
    if (-not $Tag) {
        Fail 82 "Unable to derive a safe dollar-quote tag for the ledger statement payload."
    }

    $Columns = New-Object System.Collections.Generic.List[string]
    $Values = New-Object System.Collections.Generic.List[string]
    [void]$Columns.Add("version")
    [void]$Values.Add("'" + $Migration.Version + "'")
    if ($LedgerColumns -contains "name") {
        [void]$Columns.Add("name")
        [void]$Values.Add("'" + $Migration.Name + "'")
    }
    if ($LedgerColumns -contains "statements") {
        [void]$Columns.Add("statements")
        [void]$Values.Add("ARRAY[" + '$' + $Tag + '$' + $FileContent + '$' + $Tag + '$' + "]::text[]")
    }

    return "INSERT INTO $LedgerTable (" + ($Columns -join ", ") + ") VALUES (" + ($Values -join ", ") + ");"
}

# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------

function Write-ReleaseEvidence {
    param(
        [Parameter(Mandatory = $true)]$Evidence,
        [Parameter(Mandatory = $true)][string]$Worktree
    )

    $EvidenceJson = $Evidence | ConvertTo-Json -Depth 8
    $SensitiveValues = @(
        [System.Environment]::GetEnvironmentVariable($DbUrlEnvName),
        $(if ($script:DbConnection) { $script:DbConnection.Password } else { $null })
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    foreach ($SensitiveValue in $SensitiveValues) {
        if ($EvidenceJson.Contains($SensitiveValue)) {
            Fail 95 "Refusing to emit evidence: it would leak database credentials."
        }
    }
    Write-Host ""
    Write-Host "=== REDACTED PR173 MIGRATION RELEASE EVIDENCE ==="
    Write-Host $EvidenceJson

    if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
        return
    }
    Test-EvidencePathValid -Worktree $Worktree -PathValue $EvidencePath
    $EvidenceFullPath = [System.IO.Path]::GetFullPath($EvidencePath)
    Set-Content -LiteralPath $EvidenceFullPath -Value $EvidenceJson -Encoding UTF8
    Write-Host "Redacted evidence written to: $EvidenceFullPath"
}

# ===========================================================================
# Main flow
# ===========================================================================

$RunStartedUtc = (Get-Date).ToUniversalTime().ToString("o")
$EvidenceBase = $null
$ResolvedWorktree = $null

try {
Write-Host ""
Write-Host "Target: LIVE_ACTIVE Supabase project $ApprovedRef (current live WindowMan database)."
Write-Host "Scope:  exactly four PR 173 migrations; nothing else is discovered, applied, or repaired."
Write-Host ""

# --- Gate 1: target project proof -----------------------------------------

$ProjectRef = $env:SUPABASE_PROJECT_REF
if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    Fail 20 "SUPABASE_PROJECT_REF is unset or blank. Set it to the approved LIVE_ACTIVE ref before running."
}
$ProjectRef = $ProjectRef.Trim()
foreach ($Forbidden in $ForbiddenRefs) {
    if ($ProjectRef -eq $Forbidden) {
        Fail 21 "Refusing release: SUPABASE_PROJECT_REF matches forbidden ref '$Forbidden'."
    }
}
if ($ProjectRef -cne $ApprovedRef) {
    Fail 22 "Refusing release: SUPABASE_PROJECT_REF must be exactly '$ApprovedRef'."
}

$RawDbUrl = [System.Environment]::GetEnvironmentVariable($DbUrlEnvName)
if ([string]::IsNullOrWhiteSpace($RawDbUrl)) {
    Fail 30 "$DbUrlEnvName is unset or blank. Provide the LIVE_ACTIVE Postgres connection string (never printed, never logged)."
}
$RawDbUrl = $RawDbUrl.Trim()
$script:DbConnection = ConvertFrom-ApprovedDatabaseUrl -Value $RawDbUrl
$RawDbUrl = $null

if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) {
    if ([string]::IsNullOrWhiteSpace($ReleaseWorktree) -or -not (Test-Path -LiteralPath $ReleaseWorktree -PathType Container)) {
        Fail 95 "EvidencePath was supplied but ReleaseWorktree is not yet validated."
    }
    $EarlyWorktree = (Resolve-Path -LiteralPath $ReleaseWorktree).Path
    Test-EvidencePathValid -Worktree $EarlyWorktree -PathValue $EvidencePath
}

# TLS must be valid before any database child process is started.
[void](Resolve-TlsConfiguration)

# --- Gate 2: exact-application mechanism availability -----------------------

[void](Resolve-PsqlInvocation)

# --- Gate 3: release worktree proof -----------------------------------------

if ([string]::IsNullOrWhiteSpace($ReleaseWorktree) -or -not (Test-Path -LiteralPath $ReleaseWorktree -PathType Container)) {
    Fail 50 "ReleaseWorktree must name an existing directory; no fallback checkout is allowed."
}
if ([string]::IsNullOrWhiteSpace($ReleaseCommit) -or $ReleaseCommit -cnotmatch '^[0-9a-f]{40}$') {
    Fail 50 "ReleaseCommit must be an exact lowercase 40-character commit SHA."
}

$ResolvedWorktree = (Resolve-Path -LiteralPath $ReleaseWorktree).Path
$InsideWorkTree = Invoke-GitText -Worktree $ResolvedWorktree `
    -GitArgs @("rev-parse", "--is-inside-work-tree") `
    -ExitCode 51 `
    -FailureMessage "ReleaseWorktree is not a Git worktree."
if ($InsideWorkTree -ne "true") {
    Fail 51 "ReleaseWorktree is not a Git worktree."
}
$WorktreeRoot = Invoke-GitText -Worktree $ResolvedWorktree `
    -GitArgs @("rev-parse", "--show-toplevel") `
    -ExitCode 51 `
    -FailureMessage "Unable to resolve release worktree root."
$WorktreeRoot = (Resolve-Path -LiteralPath $WorktreeRoot).Path
if (-not $WorktreeRoot.Equals($ResolvedWorktree, [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail 51 "ReleaseWorktree must point to the exact Git worktree root."
}

$CanonicalRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$CanonicalCommonDirectory = Get-AbsoluteGitDirectory -Worktree $CanonicalRepoRoot -GitDirectoryArgument "--git-common-dir"
$ReleaseCommonDirectory = Get-AbsoluteGitDirectory -Worktree $ResolvedWorktree -GitDirectoryArgument "--git-common-dir"
if (-not $ReleaseCommonDirectory.Equals($CanonicalCommonDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail 52 "ReleaseWorktree does not belong to the canonical repository."
}

$RegisteredWorktrees = Invoke-GitText -Worktree $CanonicalRepoRoot `
    -GitArgs @("worktree", "list", "--porcelain") `
    -ExitCode 53 `
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
    Fail 53 "ReleaseWorktree is not registered by the canonical repository."
}

$Branch = Invoke-GitText -Worktree $ResolvedWorktree `
    -GitArgs @("branch", "--show-current") `
    -ExitCode 54 `
    -FailureMessage "Unable to inspect release worktree branch state."
if (-not [string]::IsNullOrWhiteSpace($Branch)) {
    Fail 54 "Refusing release: release worktree must have detached HEAD (found branch '$Branch')."
}
$HeadSha = Invoke-GitText -Worktree $ResolvedWorktree `
    -GitArgs @("rev-parse", "HEAD") `
    -ExitCode 55 `
    -FailureMessage "Unable to inspect release worktree HEAD."
if ($HeadSha -cne $ReleaseCommit) {
    Fail 55 "Refusing release: HEAD '$HeadSha' does not equal requested commit '$ReleaseCommit'."
}

$CanonicalRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Assert-ReleaseCommitOnFetchedMergeBranch -RepoRoot $CanonicalRepoRoot -Commit $ReleaseCommit
Test-ReleaseScriptIdentity -Worktree $ResolvedWorktree -Commit $ReleaseCommit -ScriptPath $script:RunningScriptPath

$Dirty = Invoke-GitText -Worktree $ResolvedWorktree `
    -GitArgs @("status", "--porcelain=v1", "--untracked-files=all") `
    -ExitCode 57 `
    -FailureMessage "Unable to inspect release worktree status."
if (-not [string]::IsNullOrWhiteSpace($Dirty)) {
    Fail 57 "Refusing release: release worktree has staged, unstaged, or untracked files."
}

$LinkedRefPath = Join-Path (Join-Path (Join-Path $ResolvedWorktree "supabase") ".temp") "project-ref"
if (-not (Test-Path -LiteralPath $LinkedRefPath -PathType Leaf)) {
    Fail 23 "Refusing release: supabase/.temp/project-ref is missing in the release worktree. Link LIVE_ACTIVE explicitly first: npx supabase link --project-ref $ApprovedRef"
}
$LinkedRef = (Get-Content -LiteralPath $LinkedRefPath -Raw).Trim()
if ($LinkedRef -cne $ApprovedRef) {
    Fail 24 "Refusing release: linked project '$LinkedRef' does not match LIVE_ACTIVE '$ApprovedRef'."
}

# --- Gate 4: immutable allowlisted payloads materialized from Git objects ---

$MigrationFileFacts = New-Object System.Collections.Generic.List[object]
foreach ($Migration in $MigrationAllowlist) {
    $RelativePath = "supabase/migrations/" + $Migration.FileName
    $AbsolutePath = Join-Path $ResolvedWorktree $RelativePath
    if (-not (Test-Path -LiteralPath $AbsolutePath -PathType Leaf)) {
        Fail 58 "Refusing release: migration file is missing from the release worktree: '$RelativePath'."
    }
    $Fact = New-MaterializedMigrationPayload -Worktree $ResolvedWorktree -Commit $ReleaseCommit -Migration $Migration
    [void]$MigrationFileFacts.Add($Fact)
}

# --- Gate 5: remote ledger state and partial-state planning ------------------

$LedgerColumns = Get-RemoteLedgerColumns
$BeforeLedgerState = Get-RemoteLedgerState -Marker "before"
$BeforeSentinelState = @($BeforeLedgerState | Where-Object { $UntouchedSentinelVersions -contains $_ } | Sort-Object)

$AllowlistVersions = @($MigrationAllowlist | ForEach-Object { $_.Version })
$RecordedAllowlist = @($BeforeLedgerState | Where-Object { $AllowlistVersions -contains $_ })

# Ordering rule: recorded allowlist versions must form an exact prefix of the required order.
$RecordedCount = $RecordedAllowlist.Count
for ($Index = 0; $Index -lt $MigrationAllowlist.Count; $Index++) {
    $Version = $MigrationAllowlist[$Index].Version
    $IsRecorded = $RecordedAllowlist -contains $Version
    if ($Index -lt $RecordedCount -and -not $IsRecorded) {
        Fail 64 ("Refusing release: remote ledger records a later PR 173 migration while earlier dependency " +
            "'$Version' is missing (recorded: $($RecordedAllowlist -join ', ')). Manual reconciliation required.")
    }
    if ($Index -ge $RecordedCount -and $IsRecorded) {
        Fail 64 ("Refusing release: remote ledger records PR 173 migration '$Version' out of order " +
            "(recorded: $($RecordedAllowlist -join ', ')). Manual reconciliation required.")
    }
}

# Recorded prefix must still satisfy its installed contract.
foreach ($Migration in $MigrationAllowlist) {
    if ($RecordedAllowlist -notcontains $Migration.Version) {
        continue
    }
    $ContractResult = Test-InstalledContract -Version $Migration.Version -MarkerSuffix "preflight"
    if (-not $ContractResult.Passed) {
        Fail 66 ("Refusing release: version $($Migration.Version) is recorded remotely but its installed " +
            "contract disagrees with the expected contract (failed checks: $($ContractResult.Failures -join ', ')). " +
            "Manual reconciliation required; this script never reruns SQL or repairs ledger entries.")
    }
}

# Missing versions must not already be installed as schema objects (ledger drift).
$PlannedMigrations = New-Object System.Collections.Generic.List[object]
foreach ($Migration in $MigrationAllowlist) {
    if ($RecordedAllowlist -contains $Migration.Version) {
        continue
    }
    $DriftVerdict = Get-DriftProbe -Version $Migration.Version
    if ($DriftVerdict -ne "PLAN_OK") {
        Fail 65 ("Refusing release: schema/ledger drift detected for $($Migration.Version): $DriftVerdict " +
            "Manual reconciliation required; this script never repairs ledger entries or reinterprets drift.")
    }
    [void]$PlannedMigrations.Add($Migration)
}

foreach ($Sentinel in $UntouchedSentinelVersions) {
    foreach ($Planned in $PlannedMigrations) {
        if ($Planned.Version -eq $Sentinel) {
            Fail 64 "Internal safety stop: unrelated version '$Sentinel' entered the plan."
        }
    }
}

# --- Plan report (printed for dry runs and real runs alike) ------------------

$MissingVersions = @($PlannedMigrations | ForEach-Object { $_.Version })
Write-Host "=== PR173 FOUR-MIGRATION RELEASE PLAN ==="
Write-Host "Target project:        LIVE_ACTIVE $ApprovedRef"
Write-Host "Linked project:        $LinkedRef (matches LIVE_ACTIVE)"
Write-Host "Repository commit:     $ReleaseCommit (contained in $RemoteMergeRef; clean detached worktree)"
Write-Host "Release worktree:      $ResolvedWorktree"
Write-Host "psql source:           $((Resolve-PsqlInvocation).SourceLabel)"
Write-Host "Allowlisted migrations (hardcoded; order fixed):"
foreach ($Fact in $MigrationFileFacts) {
    Write-Host "  - $($Fact.FileName)"
    Write-Host "      sha256: $($Fact.Sha256)"
    Write-Host "      git blob: $($Fact.GitBlob)"
}
Write-Host "Current remote ledger state (observed versions):"
foreach ($Migration in $MigrationAllowlist) {
    $State = if ($RecordedAllowlist -contains $Migration.Version) { "RECORDED" } else { "MISSING" }
    Write-Host "  - $($Migration.Version) $State"
}
foreach ($Sentinel in $UntouchedSentinelVersions) {
    $State = if ($BeforeSentinelState -contains $Sentinel) { "RECORDED" } else { "NOT RECORDED" }
    Write-Host "  - $Sentinel $State (unrelated - will not be touched)"
}
Write-Host "Missing from remote ledger: $(if ($MissingVersions.Count -gt 0) { $MissingVersions -join ', ' } else { '(none)' })"
Write-Host "Exact intended order:"
if ($PlannedMigrations.Count -eq 0) {
    Write-Host "  (nothing to apply - all four versions already recorded)"
} else {
    $OrderIndex = 1
    foreach ($Planned in $PlannedMigrations) {
        Write-Host "  $OrderIndex. apply $($Planned.FileName) -> validate contract -> record version $($Planned.Version)"
        $OrderIndex++
    }
}
Write-Host "Expected verification checks after application:"
Write-Host "  - ledger: all four versions present; unrelated versions/ledger debt unchanged"
foreach ($Version in $AllowlistVersions) {
    Write-Host "  - ${Version}: $($ContractDefinitions[$Version].ExpectedChecks -join ', ')"
}
Write-Host "Never performed by this script: db push, db reset, migration up/repair, functions deploy,"
Write-Host "secrets set, gen types, automatic rollback, down migrations, or any lead/quote/customer read."

$EvidenceBase = [ordered]@{
    run_started_utc = $RunStartedUtc
    target_project_ref = $ProjectRef
    target_role = "LIVE_ACTIVE"
    linked_project_ref = $LinkedRef
    release_commit = $ReleaseCommit
    release_worktree = $ResolvedWorktree
    merged_into = $RemoteMergeRef
    psql_source = (Resolve-PsqlInvocation).SourceLabel
    migrations = @($MigrationFileFacts | ForEach-Object {
        [ordered]@{
            version = $_.Version
            file = $_.FileName
            sha256 = $_.Sha256
            git_blob = $_.GitBlob
        }
    })
    ledger_before = [ordered]@{
        recorded_allowlist_versions = @($RecordedAllowlist)
        recorded_sentinel_versions = @($BeforeSentinelState)
    }
    planned_versions = @($MissingVersions)
    dry_run = [bool]$DryRun
}

if ($DryRun) {
    $EvidenceBase["result"] = "DRY_RUN_COMPLETE"
    $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
    Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
    Write-Host ""
    Write-Host "DRY RUN - ZERO SQL MUTATION, ZERO LEDGER MUTATION PERFORMED."
    return
}

if ($PlannedMigrations.Count -eq 0) {
    $EvidenceBase["result"] = "ALREADY_COMPLETE_NO_MUTATION"
    $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
    Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
    Write-Host ""
    Write-Host "All four PR 173 migrations are already recorded and their installed contracts verified."
    Write-Host "ZERO SQL MUTATION, ZERO LEDGER MUTATION PERFORMED."
    return
}

$PlanSnapshot = New-ReleasePlanSnapshot `
    -RecordedAllowlist @($RecordedAllowlist) `
    -BeforeSentinelState @($BeforeSentinelState) `
    -PlannedMigrations @($PlannedMigrations.ToArray())

# --- Gate 6: explicit human confirmation -------------------------------------

Write-Host ""
Write-Host "Type exactly: $ConfirmPhrase"
$Typed = Read-Host "Confirmation"
if ($Typed -cne $ConfirmPhrase) {
    Fail 70 "Release aborted: confirmation phrase mismatch. Zero mutations performed."
}

Test-ReleaseScriptIdentity -Worktree $ResolvedWorktree -Commit $ReleaseCommit -ScriptPath $script:RunningScriptPath
Assert-ReleaseCommitOnFetchedMergeBranch -RepoRoot $CanonicalRepoRoot -Commit $ReleaseCommit

$MigrationFileFacts = New-Object System.Collections.Generic.List[object]
foreach ($Migration in $MigrationAllowlist) {
    [void]$MigrationFileFacts.Add((New-MaterializedMigrationPayload -Worktree $ResolvedWorktree -Commit $ReleaseCommit -Migration $Migration))
}

$RecheckSqlFile = New-PostConfirmationRecheckSqlFile `
    -PlanSnapshot $PlanSnapshot `
    -AllowlistVersionsList @($AllowlistVersions) `
    -UntouchedSentinelVersionsList @($UntouchedSentinelVersions)

$SessionSqlFiles = New-Object System.Collections.Generic.List[string]
[void]$SessionSqlFiles.Add($RecheckSqlFile)

$ApplyResults = New-Object System.Collections.Generic.List[object]
foreach ($Planned in $PlannedMigrations) {
    $Fact = $MigrationFileFacts | Where-Object { $_.Version -eq $Planned.Version }
    Write-Host ""
    Write-Host "Queuing $($Planned.FileName) for locked mutation session ..."
    $StepStartedUtc = (Get-Date).ToUniversalTime().ToString("o")

    $ApplySqlPath = $Fact.AbsolutePath
    if (-not $Planned.WrapsOwnTransaction) {
        $ApplySqlPath = Join-Path (Get-SessionTempDirectory) ("wm-pr173-apply-wrap-" + $Planned.Version + ".sql")
        $Payload = Get-Content -LiteralPath $Fact.AbsolutePath -Raw
        Set-Content -LiteralPath $ApplySqlPath -Value ("BEGIN;`n" + $Payload + "`nCOMMIT;") -Encoding UTF8
    }
    [void]$SessionSqlFiles.Add($ApplySqlPath)
    [void]$SessionSqlFiles.Add((New-ContractAssertionSqlFile -Version $Planned.Version -MarkerSuffix "postapply"))

    $FileContent = Get-Content -LiteralPath $Fact.AbsolutePath -Raw
    $RecordSql = New-LedgerRecordSql -Migration $Planned -FileContent $FileContent -LedgerColumns $LedgerColumns
    $RecordFile = Join-Path (Get-SessionTempDirectory) ("wm-pr173-record-" + $Planned.Version + ".sql")
    Set-Content -LiteralPath $RecordFile -Value ($RecordSql + "`n") -Encoding UTF8
    [void]$SessionSqlFiles.Add($RecordFile)

    $VerifySqlFile = Join-Path (Get-SessionTempDirectory) ("wm-pr173-record-verify-" + $Planned.Version + ".sql")
    $VerifySql = @"
DO `$`$
BEGIN
  IF (SELECT count(*)::int FROM $LedgerTable WHERE version = '$($Planned.Version)') <> 1 THEN
    RAISE EXCEPTION 'LEDGER_RECORD_VERIFY_FAILED';
  END IF;
END `$`$;
"@
    Set-Content -LiteralPath $VerifySqlFile -Value $VerifySql -Encoding UTF8
    [void]$SessionSqlFiles.Add($VerifySqlFile)

    [void]$ApplyResults.Add([ordered]@{
        version = $Planned.Version
        started_utc = $StepStartedUtc
    })
}

Write-Host ""
Write-Host "Starting advisory-locked mutation session (one PostgreSQL session) ..."
$SessionResult = Invoke-PsqlSessionChain `
    -OperationName "advisory-locked mutation session" `
    -InlineCommands @(Get-AdvisoryLockInlineCommand) `
    -SqlFilePaths @($SessionSqlFiles.ToArray()) `
    -ReadOnly $false

if ($SessionResult.ExitCode -ne 0) {
    if (Test-PsqlFailureIndicatesReleaseAlreadyRunning -Result $SessionResult) {
        Fail 71 "RELEASE_ALREADY_RUNNING: another release session holds the PR173 advisory lock. Zero mutations performed."
    }
    if (Test-PsqlFailureIndicatesRemoteStateChanged -Result $SessionResult) {
        Fail 72 "REMOTE_STATE_CHANGED_AFTER_CONFIRMATION: remote ledger state drifted after operator confirmation. Zero migration applications performed."
    }
    if (Test-PsqlConnectionAmbiguous -Result $SessionResult) {
        Emit-UnknownRemoteStateEvidence -EvidenceBase $EvidenceBase -Worktree $ResolvedWorktree `
            -Detail "Locked mutation session failed with an ambiguous connection outcome."
    }
    $CombinedSessionError = ($SessionResult.Stderr + "`n" + $SessionResult.Stdout)
    if ($CombinedSessionError -like "*CONTRACT_VALIDATION_FAILED*") {
        $EvidenceBase["applied_steps"] = $ApplyResults.ToArray()
        $EvidenceBase["result"] = "VALIDATION_FAILED_STOPPED_LEDGER_NOT_WRITTEN"
        $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
        Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
        Fail 81 "Migration session failed contract validation before ledger record. The version was NOT recorded in the ledger. STOPPED."
    }
    if ($CombinedSessionError -like "*LEDGER_RECORD_VERIFY_FAILED*") {
        $EvidenceBase["applied_steps"] = $ApplyResults.ToArray()
        $EvidenceBase["result"] = "LEDGER_RECORD_UNVERIFIED_STOPPED"
        $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
        Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
        Fail 83 "Ledger verification during the locked session did not observe exactly one row. STOPPED in an ambiguous state."
    }
    if ($CombinedSessionError -like "*mock psql: simulated ledger record failure*") {
        $EvidenceBase["applied_steps"] = $ApplyResults.ToArray()
        $EvidenceBase["result"] = "LEDGER_RECORD_FAILED_STOPPED"
        $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
        Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
        Fail 82 ("Migration session failed while recording a ledger row (psql exit $($SessionResult.ExitCode)). STOPPED. " +
            "reconcile manually before rerunning.")
    }
    $EvidenceBase["applied_steps"] = $ApplyResults.ToArray()
    $EvidenceBase["result"] = "MUTATION_SESSION_FAILED"
    $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
    Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
    Fail 80 ("Locked mutation session failed (psql exit $($SessionResult.ExitCode)). " +
        "No automatic rollback was attempted; inspect the remote state manually.")
}

for ($Index = 0; $Index -lt $ApplyResults.Count; $Index++) {
    $Step = [ordered]@{
        version = $ApplyResults[$Index].version
        applied = $true
        validated = $true
        recorded = $true
        started_utc = $ApplyResults[$Index].started_utc
        finished_utc = (Get-Date).ToUniversalTime().ToString("o")
    }
    $ApplyResults[$Index] = $Step
    Write-Host "  applied -> validated -> recorded $($Step.version)"
}

# --- Final verification (metadata only) ---------------------------------------

Write-Host ""
Write-Host "Final verification ..."
try {
$AfterLedgerState = Get-RemoteLedgerState -Marker "after"
$AfterSentinelState = @($AfterLedgerState | Where-Object { $UntouchedSentinelVersions -contains $_ } | Sort-Object)
}
catch {
    if ($_.Exception.Message -eq "UNKNOWN_REMOTE_STATE") {
        Emit-UnknownRemoteStateEvidence -EvidenceBase $EvidenceBase -Worktree $ResolvedWorktree `
            -Detail "Final verification could not read remote ledger state."
    }
    else {
        throw
    }
}

$VerificationFailures = New-Object System.Collections.Generic.List[string]
foreach ($Version in $AllowlistVersions) {
    if ($AfterLedgerState -notcontains $Version) {
        [void]$VerificationFailures.Add("ledger missing $Version")
    }
}
if (($BeforeSentinelState -join ",") -cne ($AfterSentinelState -join ",")) {
    [void]$VerificationFailures.Add(
        "unrelated ledger state changed (before: $($BeforeSentinelState -join ', '); after: $($AfterSentinelState -join ', '))"
    )
}
foreach ($Version in $AllowlistVersions) {
    $ContractResult = Test-InstalledContract -Version $Version -MarkerSuffix "final"
    if (-not $ContractResult.Passed) {
        [void]$VerificationFailures.Add("$Version contract: $($ContractResult.Failures -join ', ')")
    }
}

$EvidenceBase["applied_steps"] = $ApplyResults.ToArray()
$EvidenceBase["ledger_after"] = [ordered]@{
    recorded_allowlist_versions = @($AfterLedgerState | Where-Object { $AllowlistVersions -contains $_ })
    recorded_sentinel_versions = @($AfterSentinelState)
}

if ($VerificationFailures.Count -gt 0) {
    $EvidenceBase["result"] = "VERIFICATION_FAILED"
    $EvidenceBase["verification_failures"] = @($VerificationFailures)
    $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
    Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
    Fail 90 ("Post-application verification failed: $($VerificationFailures -join ' | '). " +
        "No automatic rollback was attempted; manual inspection required.")
}

$EvidenceBase["result"] = "VERIFIED_COMPLETE"
$EvidenceBase["verification_verdict"] = "ALL_CHECKS_PASSED"
$EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree

Write-Host "PR 173 four-migration release complete and verified on LIVE_ACTIVE."
Write-Host "Next (separately approved): deploy scan-quote, send-contractor-handoff, dial-lead through the"
Write-Host "guarded Sprint 6A wrapper mode, then run the narrow smoke tests."
}
catch {
    if ($EvidenceBase) {
        $EvidenceBase["result"] = "UNEXPECTED_RELEASE_CONTROLLER_FAILURE"
        $EvidenceBase["unexpected_error"] = $_.Exception.Message
        $EvidenceBase["run_finished_utc"] = (Get-Date).ToUniversalTime().ToString("o")
        if ($ResolvedWorktree) {
            Write-ReleaseEvidence -Evidence $EvidenceBase -Worktree $ResolvedWorktree
        }
    }
    throw
}
finally {
    Remove-SessionTempArtifacts
}

exit 0
