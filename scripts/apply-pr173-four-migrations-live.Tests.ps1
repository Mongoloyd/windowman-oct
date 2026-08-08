# Tests for scripts/apply-pr173-four-migrations-live.ps1 (Sprint 6B).
#
# Every remote interaction is served by a local mock psql injected through
# WM_PR173_MIGRATIONS_PSQL_TEST_OVERRIDE. No test ever reaches a network or a real database.
# The mock logs each invocation (mode, migration/marker, PGOPTIONS) so tests can prove
# zero-mutation behavior for every failure path.
#
# Run: powershell -ExecutionPolicy Bypass -File scripts/apply-pr173-four-migrations-live.Tests.ps1

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptUnderTest = Join-Path $PSScriptRoot "apply-pr173-four-migrations-live.ps1"
$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ConfirmPhrase = "APPLY_PR173_FOUR_MIGRATIONS_TO_LIVE_ACTIVE"
$MechanismUnavailableToken = "SAFE_EXACT_APPLICATION_MECHANISM_UNAVAILABLE"
$DbUrlEnvName = "WM_PR173_MIGRATIONS_DB_URL"
$TestPassword = "redacted-test-password"
$GoodDbUrl = "postgresql://postgres.zgsofkgddpcntdvpckdq:$TestPassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
$GoodDirectDbUrl = "postgres://postgres:$TestPassword@db.zgsofkgddpcntdvpckdq.supabase.co:5432/postgres"
$AllowlistVersions = @("20260806144716", "20260808160000", "20260808170000", "20260808180000")
$AllowlistFiles = @(
    "20260806144716_quote_normalization_layer.sql",
    "20260808160000_quote_normalization_schema_parity.sql",
    "20260808170000_monotonic_latest_analysis_pointer_rpc.sql",
    "20260808180000_contractor_outcome_scan_context.sql"
)
$SentinelVersions = @("20260624130000", "20260716134535", "20260716165508", "20260801143000")
$SourceRepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ApprovedMigrationBlobs = @{
    "20260806144716_quote_normalization_layer.sql" = "1619677770a309160887945798379eb42bce1b68"
    "20260808160000_quote_normalization_schema_parity.sql" = "8953d9bb293227300171ab7eef354341cc0223d1"
    "20260808170000_monotonic_latest_analysis_pointer_rpc.sql" = "0c1023cb94b4a388042437e684cfc253f4e9dcd0"
    "20260808180000_contractor_outcome_scan_context.sql" = "759320ffea02bdd68888c356c9e4cc6cc6599fa2"
}

function Copy-ApprovedMigrationInto {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$FileName
    )
    $Destination = Join-Path $Repository ("supabase/migrations/" + $FileName)
    $Blob = $ApprovedMigrationBlobs[$FileName]
    $Parent = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $Parent)) {
        New-Item -ItemType Directory -Path $Parent -Force | Out-Null
    }
    $Process = Start-Process `
        -FilePath "git" `
        -ArgumentList @("-C", $SourceRepositoryRoot, "cat-file", "blob", $Blob) `
        -RedirectStandardOutput $Destination `
        -NoNewWindow `
        -Wait `
        -PassThru
    if ($Process.ExitCode -ne 0) {
        throw "Unable to copy approved migration blob for $FileName"
    }
}
$PgSslRootCertEnvName = "WM_PR173_PGSSLROOTCERT"

# Expected contract check names (must mirror the script's ContractDefinitions).
$ContractChecks = @{
    "20260806144716" = @(
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
    "20260808160000" = @(
        "qo_total_united_inches_column", "qo_is_stats_eligible_column",
        "qli_width_inches_column", "qli_height_inches_column",
        "qli_united_inches_column", "qli_cents_per_united_inch_column",
        "qli_quantity_numeric"
    )
    "20260808170000" = @(
        "pointer_rpc_exists", "pointer_rpc_arguments", "pointer_rpc_result_shape",
        "pointer_rpc_security_invoker", "pointer_rpc_empty_search_path",
        "pointer_rpc_execute_service_role_only",
        "service_role_leads_select_update", "service_role_analyses_select_update"
    )
    "20260808180000" = @(
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
}

$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("wm-pr173-migration-tests-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $TestRoot -Force | Out-Null
$MockBin = Join-Path $TestRoot "mock-bin"
$MockPsqlShim = Join-Path $MockBin "psql.cmd"
$MockLog = Join-Path $TestRoot "psql-invocations.log"
$MockCaCert = Join-Path $TestRoot "mock-supabase-ca.pem"
"-----BEGIN CERTIFICATE-----`nMOCK`n-----END CERTIFICATE-----" | Set-Content -LiteralPath $MockCaCert -Encoding ASCII
$ResponseDir = Join-Path $TestRoot "psql-responses"
$script:Passed = 0
$script:Failed = 0

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Contains {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Expected
    )
    Assert-True -Condition $Text.Contains($Expected) -Message "Expected output to contain: $Expected`nActual output:`n$Text"
}

function Assert-NotContains {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
        [Parameter(Mandatory = $true)][string]$Forbidden,
        [Parameter(Mandatory = $true)][string]$Context
    )
    Assert-True -Condition (-not $Text.Contains($Forbidden)) -Message "$Context leaked forbidden text."
}

function Import-ScriptFunction {
    param([Parameter(Mandatory = $true)][string]$Name)

    $Tokens = $null
    $ParseErrors = $null
    $Ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $ScriptUnderTest,
        [ref]$Tokens,
        [ref]$ParseErrors
    )
    Assert-True ($ParseErrors.Count -eq 0) "Script under test has parse errors."
    $FunctionAst = $Ast.Find({
        param($Node)
        $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
            $Node.Name -ceq $Name
    }, $true)
    Assert-True ($null -ne $FunctionAst) "Unable to find function '$Name' in script under test."
    Set-Item -Path ("Function:\global:" + $Name) -Value $FunctionAst.Body.GetScriptBlock()
}

function Invoke-Test {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Body
    )
    try {
        & $Body
        $script:Passed++
        Write-Host "PASS: $Name"
    } catch {
        $script:Failed++
        [Console]::Error.WriteLine("FAIL: $Name`n$($_.Exception.Message)`n$($_.ScriptStackTrace)")
    }
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string[]]$GitArgs
    )
    $Output = (& git -C $Repository @GitArgs 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed:`n$Output"
    }
    return $Output
}

# ---------------------------------------------------------------------------
# Fixture repository: branch forensic_report_v2, the four migration files, a copy of the
# script under test, plus a registered detached release worktree.
# ---------------------------------------------------------------------------

function New-FixtureRelease {
    param(
        [string[]]$OmitMigrations = @(),
        [string]$LinkedRef = $ApprovedRef,
        [bool]$WriteLinkedRef = $true,
        [bool]$DetachedWorktree = $true
    )

    $Repository = Join-Path $TestRoot ([guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $Repository -Force | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("init", "-q", "-b", "forensic_report_v2") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config", "user.email", "sprint6b-tests@example.invalid") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config", "user.name", "Sprint6B Tests") | Out-Null
    # Fixture files are written with LF endings; silence CRLF warnings that would otherwise
    # surface as stderr and abort the strict test harness.
    Invoke-Git -Repository $Repository -GitArgs @("config", "core.autocrlf", "false") | Out-Null

    $ScriptsDir = Join-Path $Repository "scripts"
    New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
    $FixtureScript = Join-Path $ScriptsDir "apply-pr173-four-migrations-live.ps1"
    Copy-Item -LiteralPath $ScriptUnderTest -Destination $FixtureScript

    $MigrationsDir = Join-Path $Repository "supabase/migrations"
    New-Item -ItemType Directory -Path $MigrationsDir -Force | Out-Null
    foreach ($FileName in $AllowlistFiles) {
        if ($OmitMigrations -contains $FileName) {
            continue
        }
        $SourceMigration = Join-Path $SourceRepositoryRoot ("supabase/migrations/" + $FileName)
        Copy-ApprovedMigrationInto -Repository $Repository -FileName $FileName
    }

    # The real repository gitignores supabase/.temp/, which keeps the linked-ref file from
    # dirtying the release worktree. Fixtures must replicate that.
    "supabase/.temp/" | Set-Content -LiteralPath (Join-Path $Repository ".gitignore") -Encoding ASCII

    Invoke-Git -Repository $Repository -GitArgs @("add", ".") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("commit", "-q", "-m", "sprint 6b fixture") | Out-Null
    $Commit = Invoke-Git -Repository $Repository -GitArgs @("rev-parse", "HEAD")
    Invoke-Git -Repository $Repository -GitArgs @("remote", "add", "origin", $Repository) | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("update-ref", "refs/remotes/origin/forensic_report_v2", $Commit) | Out-Null

    $WorktreePath = Join-Path $TestRoot ("release-" + [guid]::NewGuid().ToString())
    if ($DetachedWorktree) {
        Invoke-Git -Repository $Repository -GitArgs @("worktree", "add", "-q", "--detach", $WorktreePath, $Commit) | Out-Null
    } else {
        Invoke-Git -Repository $Repository -GitArgs @("worktree", "add", "-q", "-b", "attached-branch", $WorktreePath, $Commit) | Out-Null
    }

    if ($WriteLinkedRef) {
        $TempDir = Join-Path $WorktreePath "supabase/.temp"
        New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
        $LinkedRef | Set-Content -LiteralPath (Join-Path $TempDir "project-ref") -Encoding ASCII
    }

    return [pscustomobject]@{
        Repository = $Repository
        Script = Join-Path $WorktreePath "scripts/apply-pr173-four-migrations-live.ps1"
        Worktree = $WorktreePath
        Commit = $Commit
    }
}

# ---------------------------------------------------------------------------
# Mock psql responses
# ---------------------------------------------------------------------------

function Get-ContractOkText {
    param([Parameter(Mandatory = $true)][string]$Version)
    return (($ContractChecks[$Version] | ForEach-Object { "$_=OK" }) -join "`n")
}

function New-StandardResponses {
    # Baseline: nothing recorded yet, sentinels partially recorded, clean drift, all
    # post-apply/final contracts pass, ledger after-state shows the four plus sentinels.
    param(
        [string[]]$RecordedBefore = @(),
        [string[]]$RecordedSentinels = @("20260801143000")
    )

    $Responses = @{}
    $Responses["ledger-columns"] = "name`nstatements`nversion"
    $Responses["before-ledger-table"] = "supabase_migrations.schema_migrations"
    $Responses["before-ledger-state"] = ((@($RecordedBefore) + @($RecordedSentinels)) | Sort-Object) -join "`n"
    $Responses["after-ledger-table"] = "supabase_migrations.schema_migrations"
    $Responses["after-ledger-state"] = ((@($AllowlistVersions) + @($RecordedSentinels)) | Sort-Object) -join "`n"
    $Responses["drift-20260806144716"] = "normalization_layer_objects=ABSENT"
    $Responses["drift-20260808170000"] = "pointer_rpc=ABSENT"
    $Responses["drift-20260808180000"] = "outcome_integrity_fn=STALE_CONTRACT_PRESENT"
    foreach ($Version in $AllowlistVersions) {
        $Responses["contract-$Version-preflight"] = Get-ContractOkText -Version $Version
        $Responses["contract-$Version-postapply"] = Get-ContractOkText -Version $Version
        $Responses["contract-$Version-final"] = Get-ContractOkText -Version $Version
        $Responses["record-verify-$Version"] = "1"
    }
    return $Responses
}

function Write-MockResponses {
    param([Parameter(Mandatory = $true)][hashtable]$Responses)

    if (Test-Path -LiteralPath $ResponseDir) {
        Remove-Item -LiteralPath $ResponseDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $ResponseDir -Force | Out-Null
    foreach ($Key in $Responses.Keys) {
        $Responses[$Key] | Set-Content -LiteralPath (Join-Path $ResponseDir ("read-" + $Key + ".out")) -Encoding UTF8
    }
}

function Get-MockLogEntries {
    if (-not (Test-Path -LiteralPath $MockLog)) {
        return @()
    }
    $Entries = New-Object System.Collections.Generic.List[object]
    foreach ($Line in (Get-Content -LiteralPath $MockLog)) {
        if ([string]::IsNullOrWhiteSpace($Line)) {
            continue
        }
        $Match = [regex]::Match(
            $Line,
            '^MODE=(?<mode>[A-Z_]+) MARKER=(?<marker>\S+) PGOPTIONS=(?<pg>.*?) PGHOSTADDR=(?<hostaddr>.*?) PGSSLMODE=(?<sslmode>.*?) PGSSLROOTCERT=(?<sslroot>.*?) PGSERVICE=(?<pgservice>.*?) RAW_DB_URL_PRESENT=(?<raw>True|False) ARGS_JSON=(?<args>\[.*\])$'
        )
        if (-not $Match.Success) {
            throw "Unparseable mock psql log line: $Line"
        }
        [void]$Entries.Add([pscustomobject]@{
            Mode = $Match.Groups["mode"].Value
            Marker = $Match.Groups["marker"].Value
            PgOptions = $Match.Groups["pg"].Value
            PgHostAddr = $Match.Groups["hostaddr"].Value
            PgSslMode = $Match.Groups["sslmode"].Value
            PgSslRootCert = $Match.Groups["sslroot"].Value
            PgService = $Match.Groups["pgservice"].Value
            RawDbUrlPresent = [System.Convert]::ToBoolean($Match.Groups["raw"].Value)
            Arguments = @($Match.Groups["args"].Value | ConvertFrom-Json)
        })
    }
    return ,$Entries.ToArray()
}

function Invoke-Release {
    param(
        [Parameter(Mandatory = $true)]$Fixture,
        [string]$ProjectRef = $ApprovedRef,
        [string]$DbUrl = $GoodDbUrl,
        [bool]$DryRun = $true,
        [string]$Commit,
        [string]$Worktree,
        [string]$InputText,
        [hashtable]$Responses,
        [string]$ApplyFailVersion = "",
        [string]$RecordFailVersion = "",
        [string]$ContractFailVersion = "",
        [string]$RecordVerifyFailVersion = "",
        [bool]$UseMockPsql = $true,
        [string]$PathOverride,
        [string]$EvidencePath,
        [bool]$AdvisoryLockContention = $false,
        [bool]$RemoteStateDriftAfterConfirm = $false,
        [bool]$ConnectionAmbiguous = $false,
        [hashtable]$PoisonEnvironment = $null,
        [string]$SslRootCertOverride
    )

    if ([string]::IsNullOrWhiteSpace($Commit)) { $Commit = $Fixture.Commit }
    if ([string]::IsNullOrWhiteSpace($Worktree)) { $Worktree = $Fixture.Worktree }
    if (-not $PSBoundParameters.ContainsKey("Responses")) { $Responses = New-StandardResponses }
    Write-MockResponses -Responses $Responses
    Set-Content -LiteralPath $MockLog -Value "" -Encoding ASCII

    $OriginalPath = $env:PATH
    $OriginalProjectRef = $env:SUPABASE_PROJECT_REF
    $OriginalDbUrl = $env:WM_PR173_MIGRATIONS_DB_URL
    $OriginalPgSsl = $env:WM_PR173_PGSSLROOTCERT
    $OriginalMockLog = $env:FAKE_PSQL_LOG
    $OriginalMockDir = $env:FAKE_PSQL_DIR
    $OriginalApplyFail = $env:FAKE_APPLY_FAIL_VERSION
    $OriginalRecordFail = $env:FAKE_RECORD_FAIL_VERSION
    $OriginalContractFail = $env:FAKE_CONTRACT_FAIL_VERSION
    $OriginalRecordVerifyFail = $env:FAKE_RECORD_VERIFY_FAIL_VERSION
    $OriginalLockContention = $env:FAKE_ADVISORY_LOCK_CONTENTION
    $OriginalRemoteDrift = $env:FAKE_REMOTE_STATE_DRIFT_AFTER_CONFIRM
    $OriginalConnectionLoss = $env:FAKE_CONNECTION_AMBIGUOUS
    try {
        if (-not [string]::IsNullOrWhiteSpace($PathOverride)) {
            $env:PATH = $PathOverride
        } elseif ($UseMockPsql) {
            $env:PATH = "$MockBin;$OriginalPath"
        } else {
            $env:PATH = $OriginalPath
        }
        $env:SUPABASE_PROJECT_REF = $ProjectRef
        $env:WM_PR173_MIGRATIONS_DB_URL = $DbUrl
        if ($PSBoundParameters.ContainsKey("SslRootCertOverride")) {
            $env:WM_PR173_PGSSLROOTCERT = $SslRootCertOverride
        } else {
            $env:WM_PR173_PGSSLROOTCERT = $MockCaCert
        }
        $env:WM_PR173_MIGRATIONS_PSQL_TEST_OVERRIDE = $null
        if ($UseMockPsql) {
            $env:FAKE_PSQL_LOG = $MockLog
            $env:FAKE_PSQL_DIR = $ResponseDir
        } else {
            $env:FAKE_PSQL_LOG = $null
            $env:FAKE_PSQL_DIR = $null
        }
        $env:FAKE_APPLY_FAIL_VERSION = $ApplyFailVersion
        $env:FAKE_RECORD_FAIL_VERSION = $RecordFailVersion
        $env:FAKE_CONTRACT_FAIL_VERSION = $ContractFailVersion
        $env:FAKE_RECORD_VERIFY_FAIL_VERSION = $RecordVerifyFailVersion
        $env:FAKE_ADVISORY_LOCK_CONTENTION = $(if ($PSBoundParameters.ContainsKey("AdvisoryLockContention") -and $AdvisoryLockContention) { "1" } else { "" })
        $env:FAKE_REMOTE_STATE_DRIFT_AFTER_CONFIRM = $(if ($PSBoundParameters.ContainsKey("RemoteStateDriftAfterConfirm") -and $RemoteStateDriftAfterConfirm) { "1" } else { "" })
        $env:FAKE_CONNECTION_AMBIGUOUS = $(if ($PSBoundParameters.ContainsKey("ConnectionAmbiguous") -and $ConnectionAmbiguous) { "1" } else { "" })
        if ($PoisonEnvironment) {
            foreach ($Key in $PoisonEnvironment.Keys) {
                [System.Environment]::SetEnvironmentVariable($Key, $PoisonEnvironment[$Key], "Process")
            }
        }

        $Arguments = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $Fixture.Script,
            "-ReleaseWorktree", $Worktree,
            "-ReleaseCommit", $Commit
        )
        if ($DryRun) {
            $Arguments += "-DryRun"
        }
        if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) {
            $Arguments += @("-EvidencePath", $EvidencePath)
        }

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $Output = if ($PSBoundParameters.ContainsKey("InputText")) {
                ($InputText | & powershell @Arguments 2>&1 | Out-String -Width 4096)
            } else {
                (& powershell @Arguments 2>&1 | Out-String -Width 4096)
            }
            $ReleaseExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }

        $Entries = Get-MockLogEntries
        $MockLogText = Get-Content -LiteralPath $MockLog -Raw -ErrorAction SilentlyContinue
        if ($null -eq $MockLogText) { $MockLogText = "" }
        return [pscustomobject]@{
            ExitCode = $ReleaseExitCode
            Output = $Output
            Log = $Entries
            MockLogText = $MockLogText
            Applies = @($Entries | Where-Object { $_.Mode -eq "APPLY" } | ForEach-Object { $_.Marker })
            Records = @($Entries | Where-Object { $_.Mode -eq "RECORD" } | ForEach-Object { $_.Marker })
            Reads = @($Entries | Where-Object { $_.Mode -eq "READ" } | ForEach-Object { $_.Marker })
        }
    }
    finally {
        $env:PATH = $OriginalPath
        $env:SUPABASE_PROJECT_REF = $OriginalProjectRef
        $env:WM_PR173_MIGRATIONS_DB_URL = $OriginalDbUrl
        $env:WM_PR173_PGSSLROOTCERT = $OriginalPgSsl
        $env:FAKE_PSQL_LOG = $OriginalMockLog
        $env:FAKE_PSQL_DIR = $OriginalMockDir
        $env:FAKE_APPLY_FAIL_VERSION = $OriginalApplyFail
        $env:FAKE_RECORD_FAIL_VERSION = $OriginalRecordFail
        $env:FAKE_CONTRACT_FAIL_VERSION = $OriginalContractFail
        $env:FAKE_RECORD_VERIFY_FAIL_VERSION = $OriginalRecordVerifyFail
        $env:FAKE_ADVISORY_LOCK_CONTENTION = $OriginalLockContention
        $env:FAKE_REMOTE_STATE_DRIFT_AFTER_CONFIRM = $OriginalRemoteDrift
        $env:FAKE_CONNECTION_AMBIGUOUS = $OriginalConnectionLoss
        if ($PoisonEnvironment) {
            foreach ($Key in $PoisonEnvironment.Keys) {
                [System.Environment]::SetEnvironmentVariable($Key, $null, "Process")
            }
        }
    }
}

# ---------------------------------------------------------------------------
# Mock psql: never reaches a network. Dispatches on the --file argument's name.
# ---------------------------------------------------------------------------

New-Item -ItemType Directory -Path $MockBin -Force | Out-Null
@'
param()

function Get-InvocationModeFromFileName {
    param([Parameter(Mandatory = $true)][string]$FileName)
    if ($FileName -match '^wm-pr173-read-(?<m>.+)\.sql$') {
        return @{ Mode = "READ"; Marker = $Matches["m"] }
    }
    if ($FileName -match '^wm-pr173-record-(?<v>\d{14})\.sql$') {
        return @{ Mode = "RECORD"; Marker = $Matches["v"] }
    }
    if ($FileName -match '^wm-pr173-apply-wrap-(?<v>\d{14})\.sql$') {
        return @{ Mode = "APPLY"; Marker = $Matches["v"] }
    }
    if ($FileName -match '^wm-pr173-payload-(?<v>\d{14})\.sql$') {
        return @{ Mode = "APPLY"; Marker = $Matches["v"] }
    }
    if ($FileName -match '^(?<v>\d{14})_') {
        return @{ Mode = "APPLY"; Marker = $Matches["v"] }
    }
    if ($FileName -match '^wm-pr173-post-confirm-recheck\.sql$') {
        return @{ Mode = "READ"; Marker = "post-confirm-recheck" }
    }
    if ($FileName -match '^wm-pr173-contract-assert-(?<v>\d{14})-(?<s>.+)\.sql$') {
        return @{ Mode = "CONTRACT_ASSERT"; Marker = ($Matches["v"] + "-" + $Matches["s"]) }
    }
    if ($FileName -match '^wm-pr173-record-verify-(?<v>\d{14})\.sql$') {
        return @{ Mode = "RECORD_VERIFY"; Marker = $Matches["v"] }
    }
    return @{ Mode = "OTHER"; Marker = $FileName }
}

function Write-MockLogLine {
    param(
        [Parameter(Mandatory = $true)][string]$Mode,
        [Parameter(Mandatory = $true)][string]$Marker
    )
    $ArgsJson = ConvertTo-Json -Compress -InputObject @($args)
    $RawDbUrlPresent = -not [string]::IsNullOrEmpty($env:WM_PR173_MIGRATIONS_DB_URL)
    $Line = "MODE=$Mode MARKER=$Marker PGOPTIONS=$($env:PGOPTIONS) PGHOSTADDR=$($env:PGHOSTADDR) PGSSLMODE=$($env:PGSSLMODE) PGSSLROOTCERT=$($env:PGSSLROOTCERT) PGSERVICE=$($env:PGSERVICE) RAW_DB_URL_PRESENT=$RawDbUrlPresent ARGS_JSON=$ArgsJson"
    Add-Content -LiteralPath $env:FAKE_PSQL_LOG -Value $Line -Encoding ASCII
}

function Invoke-MockFile {
    param(
        [Parameter(Mandatory = $true)][string]$SqlFile,
        [Parameter(Mandatory = $true)][hashtable]$Dispatch
    )
    $FileName = [System.IO.Path]::GetFileName($SqlFile)
    Write-MockLogLine -Mode $Dispatch.Mode -Marker $Dispatch.Marker
    switch ($Dispatch.Mode) {
        "READ" {
            if ($Dispatch.Marker -eq "post-confirm-recheck" -and $env:FAKE_REMOTE_STATE_DRIFT_AFTER_CONFIRM -eq "1") {
                [Console]::Error.WriteLine("REMOTE_STATE_CHANGED_AFTER_CONFIRMATION")
                exit 4
            }
            $ResponseFile = Join-Path $env:FAKE_PSQL_DIR ("read-" + $Dispatch.Marker + ".out")
            if (Test-Path -LiteralPath $ResponseFile) {
                $Content = Get-Content -LiteralPath $ResponseFile -Raw
                if ($null -ne $Content) {
                    [Console]::Out.Write($Content)
                }
            }
            $ExitFile = Join-Path $env:FAKE_PSQL_DIR ("read-" + $Dispatch.Marker + ".exit")
            if (Test-Path -LiteralPath $ExitFile) {
                exit ([int](Get-Content -LiteralPath $ExitFile -Raw).Trim())
            }
            if ($env:FAKE_CONNECTION_AMBIGUOUS -eq "1" -and $Dispatch.Marker -eq "after-ledger-state") {
                [Console]::Error.WriteLine("could not connect to server: connection refused")
                exit 2
            }
            return
        }
        "APPLY" {
            if ($env:FAKE_APPLY_FAIL_VERSION -eq $Dispatch.Marker) {
                [Console]::Error.WriteLine("mock psql: simulated apply failure for $($Dispatch.Marker)")
                exit 3
            }
            return
        }
        "RECORD" {
            if ($env:FAKE_RECORD_FAIL_VERSION -eq $Dispatch.Marker) {
                [Console]::Error.WriteLine("mock psql: simulated ledger record failure for $($Dispatch.Marker)")
                exit 3
            }
            return
        }
        "CONTRACT_ASSERT" {
            $Version = $Dispatch.Marker.Split("-")[0]
            if ($env:FAKE_CONTRACT_FAIL_VERSION -eq $Version) {
                [Console]::Error.WriteLine("CONTRACT_VALIDATION_FAILED")
                exit 4
            }
            return
        }
        "RECORD_VERIFY" {
            if ($env:FAKE_RECORD_VERIFY_FAIL_VERSION -eq $Dispatch.Marker) {
                [Console]::Error.WriteLine("LEDGER_RECORD_VERIFY_FAILED")
                exit 4
            }
            return
        }
        default {
            [Console]::Error.WriteLine("mock psql: unrecognized invocation for $FileName")
            exit 91
        }
    }
}

$InlineCommands = New-Object System.Collections.Generic.List[string]
$SqlFiles = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "-c") {
        if (($i + 1) -lt $args.Count) {
            [void]$InlineCommands.Add([string]$args[$i + 1])
            $i++
        }
        continue
    }
    if ($args[$i] -eq "--file") {
        if (($i + 1) -lt $args.Count) {
            [void]$SqlFiles.Add([string]$args[$i + 1])
            $i++
        }
        continue
    }
}

if ($InlineCommands.Count -gt 0 -or $SqlFiles.Count -gt 1) {
    if ($env:FAKE_ADVISORY_LOCK_CONTENTION -eq "1") {
        Write-MockLogLine -Mode "SESSION" -Marker "advisory-lock-contention"
        [Console]::Error.WriteLine("RELEASE_ALREADY_RUNNING")
        exit 4
    }
    foreach ($Command in $InlineCommands) {
        Write-MockLogLine -Mode "SESSION" -Marker "inline-command"
    }
    foreach ($SqlFile in $SqlFiles) {
        $Dispatch = Get-InvocationModeFromFileName -FileName ([System.IO.Path]::GetFileName($SqlFile))
        switch ($Dispatch.Mode) {
            "READ" {
                Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
            }
            "APPLY" {
                Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
            }
            "RECORD" {
                Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
            }
            "CONTRACT_ASSERT" {
                Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
            }
            "RECORD_VERIFY" {
                Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
            }
            default {
                Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
            }
        }
    }
    exit 0
}

$FileIndex = -1
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "--file") {
        $FileIndex = $i + 1
        break
    }
}
if ($FileIndex -lt 0 -or $FileIndex -ge $args.Count) {
    [Console]::Error.WriteLine("mock psql: no --file argument")
    exit 90
}
$SqlFile = [string]$args[$FileIndex]
$Dispatch = Get-InvocationModeFromFileName -FileName ([System.IO.Path]::GetFileName($SqlFile))
Invoke-MockFile -SqlFile $SqlFile -Dispatch $Dispatch
exit 0
'@ | Set-Content -LiteralPath (Join-Path $MockBin "mock-psql.ps1") -Encoding ASCII
@'
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mock-psql.ps1" %*
exit /b %ERRORLEVEL%
'@ | Set-Content -LiteralPath $MockPsqlShim -Encoding ASCII

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

try {
    Invoke-Test "dry run with empty remote ledger plans all four in order with zero mutation" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $true
        Assert-True ($Result.ExitCode -eq 0) "Dry run failed (exit $($Result.ExitCode)):`n$($Result.Output)"
        Assert-Contains $Result.Output "DRY RUN - ZERO SQL MUTATION, ZERO LEDGER MUTATION PERFORMED."
        Assert-Contains $Result.Output "Target project:        LIVE_ACTIVE $ApprovedRef"
        Assert-Contains $Result.Output "Repository commit:     $($Fixture.Commit)"
        foreach ($FileName in $AllowlistFiles) {
            Assert-Contains $Result.Output $FileName
        }
        Assert-Contains $Result.Output "sha256:"
        Assert-Contains $Result.Output "Missing from remote ledger: 20260806144716, 20260808160000, 20260808170000, 20260808180000"
        Assert-Contains $Result.Output "1. apply 20260806144716_quote_normalization_layer.sql"
        Assert-Contains $Result.Output "4. apply 20260808180000_contractor_outcome_scan_context.sql"
        Assert-Contains $Result.Output "Expected verification checks after application:"
        Assert-Contains $Result.Output "pointer_rpc_execute_service_role_only"
        Assert-True ($Result.Applies.Count -eq 0) "Dry run applied SQL: $($Result.Applies -join ',')"
        Assert-True ($Result.Records.Count -eq 0) "Dry run recorded ledger rows: $($Result.Records -join ',')"
        foreach ($Entry in $Result.Log) {
            Assert-True ($Entry.Mode -eq "READ") "Dry run made a non-read psql call: $($Entry.Mode) $($Entry.Marker)"
            Assert-True ($Entry.PgOptions.Contains("default_transaction_read_only=on")) `
                "Dry run read '$($Entry.Marker)' was not server-enforced read-only."
        }
        Assert-True (-not $Result.Output.Contains("redacted-test-password")) "Output leaked the connection string."
    }

    Invoke-Test "wrong, forbidden, and blank project refs fail closed with zero remote calls" {
        $Fixture = New-FixtureRelease
        foreach ($Ref in @("wkrcyxcnzhwjtdpmfpaf", "aqyptdxsbxqpbgoecykx", "wm-mvp-forensic-v2-local", "not-a-project", "")) {
            $Result = Invoke-Release -Fixture $Fixture -ProjectRef $Ref
            Assert-True ($Result.ExitCode -ne 0) "Project ref '$Ref' was unexpectedly accepted."
            Assert-True ($Result.Log.Count -eq 0) "Project ref '$Ref' reached the database ($($Result.Log.Count) calls)."
        }
    }

    Invoke-Test "connection strings that do not provably target LIVE_ACTIVE fail closed" {
        $Fixture = New-FixtureRelease
        foreach ($Url in @(
            "postgresql://postgres:pw@db.wkrcyxcnzhwjtdpmfpaf.supabase.co:5432/postgres",
            "postgresql://postgres.aqyptdxsbxqpbgoecykx:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
            "postgresql://postgres:pw@db.someotherproject.supabase.co:5432/postgres",
            "https://zgsofkgddpcntdvpckdq.supabase.co",
            "postgresql://postgres:pw@127.0.0.1:5432/postgres",
            "postgresql://postgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:5432/wrong_database",
            "postgresql://postgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:5432/postgres?sslmode=require",
            "postgresql://postgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:5432/postgres#fragment",
            "postgresql://postgres@db.zgsofkgddpcntdvpckdq.supabase.co:5432/postgres",
            "postgresql://%70ostgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:5432/postgres",
            ""
        )) {
            $Result = Invoke-Release -Fixture $Fixture -DbUrl $Url
            Assert-True ($Result.ExitCode -ne 0) "DB URL '$Url' was unexpectedly accepted."
            Assert-True ($Result.Log.Count -eq 0) "DB URL '$Url' reached the database."
        }
    }

    Invoke-Test "attacker host carrying the approved pooler username is rejected with zero mutation calls" {
        $Fixture = New-FixtureRelease
        $AttackerUrl = "postgresql://postgres.zgsofkgddpcntdvpckdq:password@attacker.example/postgres"
        $Result = Invoke-Release -Fixture $Fixture -DbUrl $AttackerUrl -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 32) "Attacker URL gave exit $($Result.ExitCode)."
        Assert-True ($Result.Applies.Count -eq 0) "Attacker URL made APPLY calls."
        Assert-True ($Result.Records.Count -eq 0) "Attacker URL made RECORD calls."
        Assert-True ($Result.Log.Count -eq 0) "Attacker URL reached mock psql."
        Assert-NotContains $Result.Output $AttackerUrl "Attacker rejection output"
        Assert-NotContains $Result.Output "password" "Attacker rejection output"
    }

    Invoke-Test "approved direct and project-scoped Supabase pooler endpoints are accepted" {
        foreach ($Url in @($GoodDirectDbUrl, $GoodDbUrl)) {
            $Fixture = New-FixtureRelease
            $Result = Invoke-Release -Fixture $Fixture -DbUrl $Url -DryRun $true
            Assert-True ($Result.ExitCode -eq 0) "Approved endpoint failed (exit $($Result.ExitCode)):`n$($Result.Output)"
            Assert-True ($Result.Reads.Count -gt 0) "Approved endpoint made no mock read calls."
            Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) `
                "Approved endpoint dry run mutated."
        }
    }

    Invoke-Test "wrong or missing pooler project username and lookalike pooler host are rejected" {
        $Fixture = New-FixtureRelease
        foreach ($Url in @(
            "postgresql://postgres.wrongproject:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
            "postgresql://postgres:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
            "postgresql://postgres.zgsofkgddpcntdvpckdq:pw@pooler.supabase.com.attacker.example:6543/postgres"
        )) {
            $Result = Invoke-Release -Fixture $Fixture -DbUrl $Url -DryRun $false -InputText $ConfirmPhrase
            Assert-True ($Result.ExitCode -eq 32) "Unapproved pooler identity was accepted: $Url"
            Assert-True ($Result.Log.Count -eq 0) "Unapproved pooler identity reached mock psql."
            Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) `
                "Unapproved pooler identity mutated."
        }
    }

    Invoke-Test "dot-segment database paths are rejected before URI normalization" {
        $Fixture = New-FixtureRelease
        foreach ($Url in @(
            "postgresql://postgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:5432/foo/../postgres",
            "postgresql://postgres.zgsofkgddpcntdvpckdq:pw@aws-0-us-east-1.pooler.supabase.com:6543/foo/../postgres"
        )) {
            $Result = Invoke-Release -Fixture $Fixture -DbUrl $Url -DryRun $false -InputText $ConfirmPhrase
            Assert-True ($Result.ExitCode -eq 31) "Dot-segment database path was accepted: $Url"
            Assert-True ($Result.Log.Count -eq 0) "Dot-segment database path reached mock psql."
            Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) `
                "Dot-segment database path mutated."
        }
    }

    Invoke-Test "unencoded malformed credential characters are rejected before URI normalization" {
        $Fixture = New-FixtureRelease
        foreach ($Url in @(
            "postgresql://postgres:raw password@db.zgsofkgddpcntdvpckdq.supabase.co:5432/postgres",
            "postgresql://postgres.zgsofkgddpcntdvpckdq:raw|password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
        )) {
            $Result = Invoke-Release -Fixture $Fixture -DbUrl $Url -DryRun $false -InputText $ConfirmPhrase
            Assert-True ($Result.ExitCode -eq 31) "Malformed unencoded credential was accepted."
            Assert-True ($Result.Log.Count -eq 0) "Malformed unencoded credential reached mock psql."
            Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) `
                "Malformed unencoded credential mutated."
        }
    }

    Invoke-Test "zero leading-zero and out-of-range ports are rejected before URI normalization" {
        $Fixture = New-FixtureRelease
        foreach ($Url in @(
            "postgresql://postgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:0/postgres",
            "postgresql://postgres.zgsofkgddpcntdvpckdq:pw@aws-0-us-east-1.pooler.supabase.com:00000/postgres",
            "postgresql://postgres:pw@db.zgsofkgddpcntdvpckdq.supabase.co:65536/postgres"
        )) {
            $Result = Invoke-Release -Fixture $Fixture -DbUrl $Url -DryRun $false -InputText $ConfirmPhrase
            Assert-True ($Result.ExitCode -eq 31) "Invalid raw port was accepted."
            Assert-True ($Result.Log.Count -eq 0) "Invalid raw port reached mock psql."
            Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Invalid raw port mutated."
        }
    }

    Invoke-Test "missing or mismatched linked project fails before any remote call" {
        $MissingLink = New-FixtureRelease -WriteLinkedRef $false
        $Result = Invoke-Release -Fixture $MissingLink
        Assert-True ($Result.ExitCode -eq 23) "Missing linked ref gave exit $($Result.ExitCode)."
        Assert-True ($Result.Log.Count -eq 0) "Missing linked ref reached the database."

        $WrongLink = New-FixtureRelease -LinkedRef "wkrcyxcnzhwjtdpmfpaf"
        $WrongResult = Invoke-Release -Fixture $WrongLink
        Assert-True ($WrongResult.ExitCode -eq 24) "Wrong linked ref gave exit $($WrongResult.ExitCode)."
        Assert-True ($WrongResult.Log.Count -eq 0) "Wrong linked ref reached the database."
    }

    Invoke-Test "dirty worktree, wrong commit, attached branch, and unmerged commit are rejected" {
        $Dirty = New-FixtureRelease
        "dirty" | Set-Content -LiteralPath (Join-Path $Dirty.Worktree "untracked.txt")
        $DirtyResult = Invoke-Release -Fixture $Dirty
        Assert-True ($DirtyResult.ExitCode -eq 57) "Dirty worktree gave exit $($DirtyResult.ExitCode)."
        Assert-True ($DirtyResult.Log.Count -eq 0) "Dirty worktree reached the database."

        $Fixture = New-FixtureRelease
        $WrongCommit = Invoke-Release -Fixture $Fixture -Commit ("0" * 40)
        Assert-True ($WrongCommit.ExitCode -eq 55) "Wrong commit gave exit $($WrongCommit.ExitCode)."
        Assert-True ($WrongCommit.Log.Count -eq 0) "Wrong commit reached the database."

        $Attached = New-FixtureRelease -DetachedWorktree $false
        $AttachedResult = Invoke-Release -Fixture $Attached
        Assert-True ($AttachedResult.ExitCode -eq 54) "Attached-branch worktree gave exit $($AttachedResult.ExitCode)."
        Assert-True ($AttachedResult.Log.Count -eq 0) "Attached-branch worktree reached the database."

        # A commit that exists but is not merged into forensic_report_v2.
        $Unmerged = New-FixtureRelease
        $OrphanCommit = Invoke-Git -Repository $Unmerged.Repository `
            -GitArgs @("commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "unmerged")
        $OrphanWorktree = Join-Path $TestRoot ("release-" + [guid]::NewGuid().ToString())
        Invoke-Git -Repository $Unmerged.Repository `
            -GitArgs @("worktree", "add", "-q", "--detach", $OrphanWorktree, $OrphanCommit) | Out-Null
        $OrphanTemp = Join-Path $OrphanWorktree "supabase/.temp"
        New-Item -ItemType Directory -Path $OrphanTemp -Force | Out-Null
        $ApprovedRef | Set-Content -LiteralPath (Join-Path $OrphanTemp "project-ref") -Encoding ASCII
        $UnmergedResult = Invoke-Release -Fixture $Unmerged -Commit $OrphanCommit -Worktree $OrphanWorktree
        Assert-True ($UnmergedResult.ExitCode -eq 56) "Unmerged commit gave exit $($UnmergedResult.ExitCode)."
        Assert-True ($UnmergedResult.Log.Count -eq 0) "Unmerged commit reached the database."
    }

    Invoke-Test "missing allowlisted migration file blocks the release before any remote call" {
        foreach ($Omitted in $AllowlistFiles) {
            $Fixture = New-FixtureRelease -OmitMigrations @($Omitted)
            $Result = Invoke-Release -Fixture $Fixture
            Assert-True ($Result.ExitCode -eq 58) "Missing '$Omitted' gave exit $($Result.ExitCode)."
            Assert-Contains $Result.Output "migration file is missing"
            Assert-True ($Result.Log.Count -eq 0) "Missing '$Omitted' reached the database."
        }
    }

    Invoke-Test "correctly installed prefix plans only the remaining suffix" {
        $Fixture = New-FixtureRelease
        $Responses = New-StandardResponses -RecordedBefore @("20260806144716", "20260808160000")
        $Result = Invoke-Release -Fixture $Fixture -Responses $Responses -DryRun $true
        Assert-True ($Result.ExitCode -eq 0) "Prefix dry run failed (exit $($Result.ExitCode)):`n$($Result.Output)"
        Assert-Contains $Result.Output "20260806144716 RECORDED"
        Assert-Contains $Result.Output "20260808160000 RECORDED"
        Assert-Contains $Result.Output "Missing from remote ledger: 20260808170000, 20260808180000"
        Assert-Contains $Result.Output "1. apply 20260808170000_monotonic_latest_analysis_pointer_rpc.sql"
        Assert-Contains $Result.Output "2. apply 20260808180000_contractor_outcome_scan_context.sql"
        Assert-True (-not $Result.Output.Contains("apply 20260806144716_quote_normalization_layer.sql")) `
            "Recorded prefix migration was re-planned."
        Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Prefix dry run mutated."
    }

    Invoke-Test "later migration recorded with missing earlier dependency stops with zero mutation" {
        $Fixture = New-FixtureRelease
        $Responses = New-StandardResponses -RecordedBefore @("20260808170000")
        $Result = Invoke-Release -Fixture $Fixture -Responses $Responses -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 64) "Out-of-order ledger gave exit $($Result.ExitCode)."
        Assert-Contains $Result.Output "Manual reconciliation required"
        Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Out-of-order ledger mutated."
    }

    Invoke-Test "schema installed without its ledger version stops for reconciliation" {
        $Fixture = New-FixtureRelease
        $TableDrift = New-StandardResponses
        $TableDrift["drift-20260806144716"] = "normalization_layer_objects=PRESENT"
        $Result = Invoke-Release -Fixture $Fixture -Responses $TableDrift -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 65) "Table drift gave exit $($Result.ExitCode)."
        Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Table drift mutated."

        $RepairedDrift = New-StandardResponses
        $RepairedDrift["drift-20260808180000"] = "outcome_integrity_fn=REPAIRED_CONTRACT_PRESENT"
        $RepairedResult = Invoke-Release -Fixture $Fixture -Responses $RepairedDrift -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($RepairedResult.ExitCode -eq 65) "Repaired-function drift gave exit $($RepairedResult.ExitCode)."
        Assert-True ($RepairedResult.Applies.Count -eq 0 -and $RepairedResult.Records.Count -eq 0) "Repaired-function drift mutated."
    }

    Invoke-Test "recorded migration whose installed contract disagrees stops with zero mutation" {
        $Fixture = New-FixtureRelease
        $Responses = New-StandardResponses -RecordedBefore @("20260806144716")
        $BrokenContract = (Get-ContractOkText -Version "20260806144716") -replace "qo_rls=OK", "qo_rls=FAIL"
        $Responses["contract-20260806144716-preflight"] = $BrokenContract
        $Result = Invoke-Release -Fixture $Fixture -Responses $Responses -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 66) "Contract disagreement gave exit $($Result.ExitCode)."
        Assert-Contains $Result.Output "qo_rls"
        Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Contract disagreement mutated."
    }

    Invoke-Test "malformed or missing remote ledger output stops with zero mutation" {
        $Fixture = New-FixtureRelease

        $Garbage = New-StandardResponses
        $Garbage["before-ledger-state"] = "this-is-not-a-version"
        $GarbageResult = Invoke-Release -Fixture $Fixture -Responses $Garbage -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($GarbageResult.ExitCode -eq 61) "Malformed ledger output gave exit $($GarbageResult.ExitCode)."
        Assert-True ($GarbageResult.Applies.Count -eq 0 -and $GarbageResult.Records.Count -eq 0) "Malformed ledger output mutated."

        $NoTable = New-StandardResponses
        $NoTable["before-ledger-table"] = "MISSING"
        $NoTableResult = Invoke-Release -Fixture $Fixture -Responses $NoTable -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($NoTableResult.ExitCode -eq 62) "Missing ledger table gave exit $($NoTableResult.ExitCode)."
        Assert-True ($NoTableResult.Applies.Count -eq 0 -and $NoTableResult.Records.Count -eq 0) "Missing ledger table mutated."

        $NoVersionColumn = New-StandardResponses
        $NoVersionColumn["ledger-columns"] = "name`nstatements"
        $NoVersionResult = Invoke-Release -Fixture $Fixture -Responses $NoVersionColumn -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($NoVersionResult.ExitCode -eq 63) "Ledger without version column gave exit $($NoVersionResult.ExitCode)."
        Assert-True ($NoVersionResult.Applies.Count -eq 0 -and $NoVersionResult.Records.Count -eq 0) "Ledger without version column mutated."
    }

    Invoke-Test "wrong confirmation phrases cause zero mutations" {
        $Fixture = New-FixtureRelease
        foreach ($Typed in @(
            "WRONG_CONFIRMATION",
            "",
            $ConfirmPhrase.ToLowerInvariant(),
            " $ConfirmPhrase ",
            "$ConfirmPhrase$ConfirmPhrase",
            "DEPLOY_FORENSIC_V2_LIVE_FUNCTIONS",
            "DEPLOY_PR173_FUNCTIONS_AFTER_MIGRATIONS_VERIFIED"
        )) {
            $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $Typed
            Assert-True ($Result.ExitCode -eq 70) "Confirmation '$Typed' gave exit $($Result.ExitCode)."
            Assert-Contains $Result.Output "confirmation phrase mismatch"
            Assert-True ($Result.Applies.Count -eq 0) "Confirmation '$Typed' applied SQL: $($Result.Applies -join ',')"
            Assert-True ($Result.Records.Count -eq 0) "Confirmation '$Typed' recorded ledger rows."
        }
    }

    Invoke-Test "exact confirmation applies and records exactly four migrations in order" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 0) "Confirmed release failed (exit $($Result.ExitCode)):`n$($Result.Output)"
        Assert-Contains $Result.Output "Type exactly: $ConfirmPhrase"
        Assert-True (($Result.Applies -join ",") -ceq ($AllowlistVersions -join ",")) `
            "Unexpected apply sequence: $($Result.Applies -join ',')"
        Assert-True (($Result.Records -join ",") -ceq ($AllowlistVersions -join ",")) `
            "Unexpected record sequence: $($Result.Records -join ',')"

        # Per migration: apply must precede its ledger record, and the pair must complete
        # before the next migration's apply.
        $MutationSequence = @($Result.Log | Where-Object { $_.Mode -in @("APPLY", "RECORD") } |
            ForEach-Object { "$($_.Mode):$($_.Marker)" })
        $ExpectedSequence = @($AllowlistVersions | ForEach-Object { @("APPLY:$_", "RECORD:$_") }) | ForEach-Object { $_ }
        Assert-True (($MutationSequence -join ",") -ceq ($ExpectedSequence -join ",")) `
            "Apply/record interleaving broke atomic per-migration ordering: $($MutationSequence -join ',')"

        foreach ($Entry in $Result.Log) {
            if ($Entry.Mode -eq "READ") {
                if ($Entry.Marker -match '^(before|after|contract-.+-preflight|contract-.+-postapply|contract-.+-final|drift|ledger-columns|record-verify)') {
                    Assert-True ($Entry.PgOptions.Contains("default_transaction_read_only=on")) `
                        "Read '$($Entry.Marker)' was not read-only."
                }
            } else {
                Assert-True (-not $Entry.PgOptions.Contains("default_transaction_read_only=on")) `
                    "Mutation '$($Entry.Mode):$($Entry.Marker)' ran in a read-only session."
            }
        }
        foreach ($Sentinel in $SentinelVersions) {
            Assert-True ($Result.Applies -notcontains $Sentinel -and $Result.Records -notcontains $Sentinel) `
                "Unrelated version $Sentinel was touched."
        }
        Assert-Contains $Result.Output "VERIFIED_COMPLETE"
        Assert-Contains $Result.Output "PR 173 four-migration release complete and verified on LIVE_ACTIVE."
        Assert-True (-not $Result.Output.Contains("redacted-test-password")) "Output leaked the connection string."
    }

    Invoke-Test "database URI and password never enter child arguments logs output or JSON evidence" {
        $Fixture = New-FixtureRelease
        $SecretPassword = "s6b-credential-sentinel-98421"
        $SecretUrl = "postgresql://postgres:$SecretPassword@db.$ApprovedRef.supabase.co:5432/postgres"

        $SuccessEvidence = Join-Path $TestRoot "secret-success-evidence.json"
        $Success = Invoke-Release -Fixture $Fixture -DbUrl $SecretUrl -DryRun $false `
            -InputText $ConfirmPhrase -EvidencePath $SuccessEvidence
        Assert-True ($Success.ExitCode -eq 0) "Secret-sentinel success run failed: $($Success.Output)"
        $SuccessArguments = (($Success.Log | ForEach-Object { $_.Arguments }) -join "`n")
        $SuccessEvidenceText = Get-Content -LiteralPath $SuccessEvidence -Raw
        Assert-True (@($Success.Log | Where-Object { $_.RawDbUrlPresent }).Count -eq 0) `
            "Source database URI was inherited by a successful psql child."
        foreach ($Sensitive in @($SecretUrl, $SecretPassword, "postgres:$SecretPassword")) {
            Assert-NotContains $SuccessArguments $Sensitive "Successful child arguments"
            Assert-NotContains $Success.MockLogText $Sensitive "Successful mock log"
            Assert-NotContains $Success.Output $Sensitive "Successful stdout/stderr"
            Assert-NotContains $SuccessEvidenceText $Sensitive "Successful JSON evidence"
        }

        $FailureEvidence = Join-Path $TestRoot "secret-failure-evidence.json"
        $Failure = Invoke-Release -Fixture $Fixture -DbUrl $SecretUrl -DryRun $false `
            -InputText $ConfirmPhrase -ApplyFailVersion "20260806144716" -EvidencePath $FailureEvidence
        Assert-True ($Failure.ExitCode -eq 80) "Secret-sentinel failure run gave exit $($Failure.ExitCode)."
        $FailureArguments = (($Failure.Log | ForEach-Object { $_.Arguments }) -join "`n")
        $FailureEvidenceText = Get-Content -LiteralPath $FailureEvidence -Raw
        Assert-True (@($Failure.Log | Where-Object { $_.RawDbUrlPresent }).Count -eq 0) `
            "Source database URI was inherited by a failed psql child."
        foreach ($Sensitive in @($SecretUrl, $SecretPassword, "postgres:$SecretPassword")) {
            Assert-NotContains $FailureArguments $Sensitive "Failed child arguments"
            Assert-NotContains $Failure.MockLogText $Sensitive "Failed mock log"
            Assert-NotContains $Failure.Output $Sensitive "Failed stdout/stderr"
            Assert-NotContains $FailureEvidenceText $Sensitive "Failed JSON evidence"
        }
    }

    Invoke-Test "connection environment variables are restored after psql success and failure" {
        $script:LibpqIsolationEnvironmentNames = @(
            "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGOPTIONS",
            "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR", "PGPASSFILE", "PGREQUIREAUTH", "PGCHANNELBINDING",
            "PGSSLMODE", "PGREQUIRESSL", "PGSSLNEGOTIATION", "PGSSLCERT", "PGSSLKEY", "PGSSLROOTCERT",
            "PGSSLCRL", "PGSSLCRLDIR", "PGSSLSNI", "PGTARGETSESSIONATTRS", "PGLOADBALANCEHOSTS",
            $DbUrlEnvName
        )
        Import-ScriptFunction -Name "Get-LibpqEnvironmentSnapshot"
        Import-ScriptFunction -Name "Set-LibpqEnvironmentFromSnapshot"
        function Fail { param([int]$ExitCode, [string]$Message) throw $Message }
        Import-ScriptFunction -Name "Clear-LibpqTransportOverrides"
        Import-ScriptFunction -Name "Resolve-TlsConfiguration"
        Import-ScriptFunction -Name "Set-ApprovedChildConnectionEnvironment"
        Import-ScriptFunction -Name "Get-ProcessArgumentListForExecutable"
        Import-ScriptFunction -Name "Get-ProcessFilePathForExecutable"
        Import-ScriptFunction -Name "ConvertTo-ProcessArgumentString"
        Import-ScriptFunction -Name "Resolve-PsqlInvocation"
        Import-ScriptFunction -Name "Invoke-Psql"

        $SqlFile = Join-Path $TestRoot "20260806144716_environment_restore.sql"
        "SELECT 1;" | Set-Content -LiteralPath $SqlFile -Encoding ASCII
        $script:PsqlResolved = [pscustomobject]@{
            FilePath = $MockPsqlShim
            SourceLabel = "mock psql test harness"
        }
        $script:ChildProcessInvocationCount = 0
        $script:PgSslRootCertPath = $null
        $script:DbConnection = [pscustomobject]@{
            Host = "db.$ApprovedRef.supabase.co"
            Port = 5432
            Database = "postgres"
            Username = "postgres"
            Password = "environment-only-secret"
        }
        $env:WM_PR173_PGSSLROOTCERT = $MockCaCert

        $Names = @(
            "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGOPTIONS",
            "PGSERVICE", "PGSSLMODE", "PGSSLROOTCERT", $DbUrlEnvName
        )
        $BeforeTest = @{}
        foreach ($Name in $Names) {
            $BeforeTest[$Name] = [System.Environment]::GetEnvironmentVariable($Name, "Process")
        }
        try {
            $env:FAKE_PSQL_LOG = $MockLog
            $env:FAKE_PSQL_DIR = $ResponseDir

            $SuccessExpected = @{
                PGHOST = $null
                PGPORT = "before-success-port"
                PGDATABASE = "before-success-database"
                PGUSER = "before-success-user"
                PGPASSWORD = "before-success-password"
                PGOPTIONS = "before-success-options"
                WM_PR173_MIGRATIONS_DB_URL = "before-success-source-uri"
            }
            foreach ($Name in $Names) {
                [System.Environment]::SetEnvironmentVariable($Name, $SuccessExpected[$Name], "Process")
            }
            $env:FAKE_APPLY_FAIL_VERSION = ""
            $Success = Invoke-Psql -SqlFilePath $SqlFile -OperationName "environment success" -ReadOnly $true
            Assert-True ($Success.ExitCode -eq 0) "Direct Invoke-Psql success path failed."
            foreach ($Name in $Names) {
                $Actual = [System.Environment]::GetEnvironmentVariable($Name, "Process")
                Assert-True ($Actual -ceq $SuccessExpected[$Name]) "$Name was not restored after success."
            }

            $FailureExpected = @{
                PGHOST = "before-failure-host"
                PGPORT = $null
                PGDATABASE = "before-failure-database"
                PGUSER = "before-failure-user"
                PGPASSWORD = "before-failure-password"
                PGOPTIONS = "before-failure-options"
                WM_PR173_MIGRATIONS_DB_URL = "before-failure-source-uri"
            }
            foreach ($Name in $Names) {
                [System.Environment]::SetEnvironmentVariable($Name, $FailureExpected[$Name], "Process")
            }
            $env:FAKE_APPLY_FAIL_VERSION = "20260806144716"
            $Failure = Invoke-Psql -SqlFilePath $SqlFile -OperationName "environment failure" -ReadOnly $false
            Assert-True ($Failure.ExitCode -eq 3) "Direct Invoke-Psql failure simulation did not fail."
            foreach ($Name in $Names) {
                $Actual = [System.Environment]::GetEnvironmentVariable($Name, "Process")
                Assert-True ($Actual -ceq $FailureExpected[$Name]) "$Name was not restored after failure."
            }
        }
        finally {
            foreach ($Name in $Names) {
                [System.Environment]::SetEnvironmentVariable($Name, $BeforeTest[$Name], "Process")
            }
            $env:FAKE_APPLY_FAIL_VERSION = ""
        }
    }

    Invoke-Test "apply failure stops on the first failing migration with no ledger record" {
        $Fixture = New-FixtureRelease
        $FirstFail = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase `
            -ApplyFailVersion "20260806144716"
        Assert-True ($FirstFail.ExitCode -eq 80) "First apply failure gave exit $($FirstFail.ExitCode)."
        Assert-True (($FirstFail.Applies -join ",") -ceq "20260806144716") `
            "Apply continued after first failure: $($FirstFail.Applies -join ',')"
        Assert-True ($FirstFail.Records.Count -eq 0) "Failed migration was recorded in the ledger."
        Assert-Contains $FirstFail.Output "No automatic rollback was attempted"

        $MidFail = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase `
            -ApplyFailVersion "20260808160000"
        Assert-True ($MidFail.ExitCode -eq 80) "Mid apply failure gave exit $($MidFail.ExitCode)."
        Assert-True (($MidFail.Applies -join ",") -ceq "20260806144716,20260808160000") `
            "Unexpected applies after mid failure: $($MidFail.Applies -join ',')"
        Assert-True (($MidFail.Records -join ",") -ceq "20260806144716") `
            "Unexpected records after mid failure: $($MidFail.Records -join ',')"
    }

    Invoke-Test "post-apply contract validation failure stops without recording the version" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase `
            -ContractFailVersion "20260806144716"
        Assert-True ($Result.ExitCode -eq 81) "Validation failure gave exit $($Result.ExitCode)."
        Assert-True ($Result.Applies.Count -le 1) "Applies continued after validation failure: $($Result.Applies -join ',')"
        Assert-True ($Result.Records.Count -eq 0) "Version was recorded despite failed validation."
        Assert-Contains $Result.Output "NOT recorded in the"
    }

    Invoke-Test "ledger record failure stops before any later migration" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase `
            -RecordFailVersion "20260806144716"
        Assert-True ($Result.ExitCode -eq 82) "Record failure gave exit $($Result.ExitCode)."
        Assert-True (($Result.Applies -join ",") -ceq "20260806144716") `
            "Applies continued after record failure: $($Result.Applies -join ',')"
        Assert-Contains $Result.Output "reconcile manually before rerunning"
    }

    Invoke-Test "post-application verification failures are surfaced with no rollback" {
        $Fixture = New-FixtureRelease

        $MissingAfter = New-StandardResponses
        $MissingAfter["after-ledger-state"] = ((@("20260806144716", "20260808160000", "20260808170000") + @("20260801143000")) | Sort-Object) -join "`n"
        $MissingResult = Invoke-Release -Fixture $Fixture -Responses $MissingAfter -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($MissingResult.ExitCode -eq 90) "Missing after-version gave exit $($MissingResult.ExitCode)."
        Assert-Contains $MissingResult.Output "ledger missing 20260808180000"
        Assert-Contains $MissingResult.Output "No automatic rollback was attempted"

        $SentinelChanged = New-StandardResponses
        $SentinelChanged["after-ledger-state"] = ((@($AllowlistVersions) + @("20260801143000", "20260716134535")) | Sort-Object) -join "`n"
        $SentinelResult = Invoke-Release -Fixture $Fixture -Responses $SentinelChanged -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($SentinelResult.ExitCode -eq 90) "Changed sentinel state gave exit $($SentinelResult.ExitCode)."
        Assert-Contains $SentinelResult.Output "unrelated ledger state changed"
    }

    Invoke-Test "all four already recorded verifies with zero mutation and no confirmation prompt" {
        $Fixture = New-FixtureRelease
        $Responses = New-StandardResponses -RecordedBefore $AllowlistVersions
        $Result = Invoke-Release -Fixture $Fixture -Responses $Responses -DryRun $false
        Assert-True ($Result.ExitCode -eq 0) "Already-complete run failed (exit $($Result.ExitCode)):`n$($Result.Output)"
        Assert-Contains $Result.Output "ALREADY_COMPLETE_NO_MUTATION"
        Assert-Contains $Result.Output "ZERO SQL MUTATION, ZERO LEDGER MUTATION PERFORMED."
        Assert-True (-not $Result.Output.Contains("Type exactly:")) "Already-complete run prompted for confirmation."
        Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Already-complete run mutated."
    }

    Invoke-Test "missing psql reports SAFE_EXACT_APPLICATION_MECHANISM_UNAVAILABLE" {
        $Fixture = New-FixtureRelease
        $GitDirectory = Split-Path -Parent (Get-Command git -CommandType Application | Select-Object -First 1).Source
        $PowerShellDirectory = Split-Path -Parent (Get-Command powershell -CommandType Application | Select-Object -First 1).Source
        $MinimalPath = "$GitDirectory;$PowerShellDirectory;$env:SystemRoot\System32;$env:SystemRoot"
        $Result = Invoke-Release -Fixture $Fixture -UseMockPsql $false -PathOverride $MinimalPath
        Assert-True ($Result.ExitCode -eq 40) "Missing psql gave exit $($Result.ExitCode)."
        Assert-Contains $Result.Output $MechanismUnavailableToken
        Assert-True ($Result.Log.Count -eq 0) "Missing psql still reached the database."
    }

    Invoke-Test "poisoned libpq transport variables cannot redirect the mock child connection" {
        $Fixture = New-FixtureRelease
        $Poison = @{
            PGHOSTADDR = "203.0.113.50"
            PGSERVICE = "attacker"
            PGSERVICEFILE = "C:\attacker\.pg_service.conf"
            PGPASSFILE = "C:\attacker\.pgpass"
            PGSSLMODE = "disable"
            PGSSLROOTCERT = "C:\attacker\wrong.pem"
        }
        $Result = Invoke-Release -Fixture $Fixture -DryRun $true -PoisonEnvironment $Poison
        Assert-True ($Result.ExitCode -eq 0) "Poisoned libpq dry run failed."
        Assert-True ($Result.Reads.Count -gt 0) "Poisoned libpq dry run made no reads."
        foreach ($Entry in $Result.Log) {
            Assert-True ([string]::IsNullOrEmpty($Entry.PgHostAddr)) "PGHOSTADDR reached child: $($Entry.PgHostAddr)"
            Assert-True ($Entry.PgSslMode -eq "verify-full") "PGSSLMODE was not verify-full."
            Assert-True ($Entry.PgSslRootCert -eq $MockCaCert) "Approved CA path did not reach child."
            Assert-True ([string]::IsNullOrEmpty($Entry.PgService)) "PGSERVICE reached child."
        }
    }

    Invoke-Test "missing or invalid CA configuration produces zero child calls" {
        $Fixture = New-FixtureRelease
        $NoCa = Invoke-Release -Fixture $Fixture -DryRun $true -SslRootCertOverride ""
        Assert-True ($NoCa.ExitCode -eq 41) "Missing CA should fail closed."
        Assert-True ($NoCa.Log.Count -eq 0) "Missing CA reached mock psql."
        Assert-Contains $NoCa.Output "TLS_CONFIGURATION_REQUIRED"

        $InvalidCa = Invoke-Release -Fixture $Fixture -DryRun $true -SslRootCertOverride (Join-Path $TestRoot "missing-ca.pem")
        Assert-True ($InvalidCa.ExitCode -eq 41) "Invalid CA should fail closed."
        Assert-True ($InvalidCa.Log.Count -eq 0) "Invalid CA reached mock psql."
    }

    Invoke-Test "WM_PR173_MIGRATIONS_PSQL_TEST_OVERRIDE cannot select an executable" {
        $Source = Get-Content -LiteralPath $ScriptUnderTest -Raw
        Assert-True (-not $Source.Contains("WM_PR173_MIGRATIONS_PSQL_TEST_OVERRIDE")) `
            "Production script still references executable override env var."
    }

    Invoke-Test "running script must match release commit and reside in the release worktree" {
        $Fixture = New-FixtureRelease
        $OutsideScript = Join-Path $TestRoot "outside-release-script.ps1"
        Copy-Item -LiteralPath $Fixture.Script -Destination $OutsideScript
        $Result = Invoke-Release -Fixture $Fixture -DryRun $true
        Assert-True ($Result.ExitCode -eq 0) "In-worktree script should pass dry run."

        $BadScriptFixture = New-FixtureRelease
        $OutsideOnly = Join-Path $TestRoot ("outside-" + [guid]::NewGuid().ToString() + ".ps1")
        Copy-Item -LiteralPath $BadScriptFixture.Script -Destination $OutsideOnly
        "# mutated" | Add-Content -LiteralPath $OutsideOnly
        $Previous = $BadScriptFixture.Script
        $BadScriptFixture | Add-Member -NotePropertyName Script -NotePropertyValue $OutsideOnly -Force
        $OutsideResult = Invoke-Release -Fixture $BadScriptFixture -DryRun $true
        Assert-True ($OutsideResult.ExitCode -ne 0) "Script outside worktree should fail."
    }

    Invoke-Test "advisory lock contention produces zero APPLY or RECORD calls" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase -AdvisoryLockContention $true
        Assert-True ($Result.ExitCode -eq 71) "Lock contention gave exit $($Result.ExitCode)."
        Assert-True ($Result.Applies.Count -eq 0) "Lock contention still applied SQL."
        Assert-True ($Result.Records.Count -eq 0) "Lock contention still recorded ledger rows."
    }

    Invoke-Test "remote state change after confirmation produces zero APPLY or RECORD calls" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase -RemoteStateDriftAfterConfirm $true
        Assert-True ($Result.ExitCode -eq 72) "Remote drift gave exit $($Result.ExitCode)."
        Assert-True ($Result.Applies.Count -eq 0) "Remote drift still applied SQL."
        Assert-True ($Result.Records.Count -eq 0) "Remote drift still recorded ledger rows."
    }

    Invoke-Test "invalid evidence destination fails before mutation" {
        $Fixture = New-FixtureRelease
        $InsideRepo = Join-Path $Fixture.Worktree "evidence.json"
        $OutsideOkParent = Join-Path $TestRoot "evidence-parent"
        New-Item -ItemType Directory -Path $OutsideOkParent -Force | Out-Null
        $OutsideOk = Join-Path $OutsideOkParent "evidence.json"
        foreach ($BadPath in @($InsideRepo, (Join-Path $TestRoot "missing-parent\evidence.json"))) {
            $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase -EvidencePath $BadPath
            Assert-True ($Result.ExitCode -eq 95) "Bad evidence path '$BadPath' was accepted (exit $($Result.ExitCode))."
            Assert-True ($Result.Applies.Count -eq 0 -and $Result.Records.Count -eq 0) "Bad evidence path mutated."
        }
    }

    Invoke-Test "lost post-mutation connection reports UNKNOWN_REMOTE_STATE" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase -ConnectionAmbiguous $true
        Assert-True ($Result.ExitCode -eq 91) "Ambiguous connection gave exit $($Result.ExitCode)."
        Assert-Contains $Result.Output "UNKNOWN_REMOTE_STATE"
    }

    Invoke-Test "paths containing spaces work for psql file arguments" {
        $Fixture = New-FixtureRelease
        $SpacedDir = Join-Path $TestRoot "space dir"
        New-Item -ItemType Directory -Path $SpacedDir -Force | Out-Null
        $SpacedSql = Join-Path $SpacedDir "wm-pr173-payload-20260806144716.sql"
        "SELECT 1;" | Set-Content -LiteralPath $SpacedSql -Encoding ASCII
        $script:LibpqIsolationEnvironmentNames = @(
            "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGOPTIONS",
            "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR", "PGPASSFILE", "PGREQUIREAUTH", "PGCHANNELBINDING",
            "PGSSLMODE", "PGREQUIRESSL", "PGSSLNEGOTIATION", "PGSSLCERT", "PGSSLKEY", "PGSSLROOTCERT",
            "PGSSLCRL", "PGSSLCRLDIR", "PGSSLSNI", "PGTARGETSESSIONATTRS", "PGLOADBALANCEHOSTS",
            $DbUrlEnvName
        )
        Import-ScriptFunction -Name "Get-LibpqEnvironmentSnapshot"
        Import-ScriptFunction -Name "Set-LibpqEnvironmentFromSnapshot"
        function Fail { param([int]$ExitCode, [string]$Message) throw $Message }
        Import-ScriptFunction -Name "Clear-LibpqTransportOverrides"
        Import-ScriptFunction -Name "Resolve-TlsConfiguration"
        Import-ScriptFunction -Name "Set-ApprovedChildConnectionEnvironment"
        Import-ScriptFunction -Name "Get-ProcessArgumentListForExecutable"
        Import-ScriptFunction -Name "Get-ProcessFilePathForExecutable"
        Import-ScriptFunction -Name "ConvertTo-ProcessArgumentString"
        Import-ScriptFunction -Name "Resolve-PsqlInvocation"
        Import-ScriptFunction -Name "Invoke-Psql"
        $MockScriptPath = Join-Path $MockBin "mock-psql.ps1"
        $script:PsqlResolved = [pscustomobject]@{ FilePath = $MockScriptPath; SourceLabel = "mock psql test harness" }
        $script:ChildProcessInvocationCount = 0
        $script:PgSslRootCertPath = $null
        $script:DbConnection = [pscustomobject]@{
            Host = "db.$ApprovedRef.supabase.co"
            Port = 5432
            Database = "postgres"
            Username = "postgres"
            Password = "space-path-secret"
        }
        $env:WM_PR173_PGSSLROOTCERT = $MockCaCert
        $script:PgSslRootCertPath = $MockCaCert
        $env:FAKE_PSQL_LOG = $MockLog
        $env:FAKE_PSQL_DIR = $ResponseDir
        $Result = Invoke-Psql -SqlFilePath $SpacedSql -OperationName "space path apply" -ReadOnly $false
        Assert-True ($Result.ExitCode -eq 0) "Spaced SQL path failed with exit $($Result.ExitCode)."
    }

    Invoke-Test "ledger verification count other than exactly one fails closed" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase -RecordVerifyFailVersion "20260806144716"
        Assert-True ($Result.ExitCode -eq 83) "Record verify failure gave exit $($Result.ExitCode)."
    }

    Invoke-Test "wrong Git blob or SHA-256 pin blocks execution before remote calls" {
        $Repository = Join-Path $TestRoot ([guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $Repository -Force | Out-Null
        Invoke-Git -Repository $Repository -GitArgs @("init", "-q", "-b", "forensic_report_v2") | Out-Null
        Invoke-Git -Repository $Repository -GitArgs @("config", "user.email", "bad@example.invalid") | Out-Null
        Invoke-Git -Repository $Repository -GitArgs @("config", "user.name", "Bad Fixture") | Out-Null
        $ScriptsDir = Join-Path $Repository "scripts"
        New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
        Copy-Item -LiteralPath $ScriptUnderTest -Destination (Join-Path $ScriptsDir "apply-pr173-four-migrations-live.ps1")
        $MigrationsDir = Join-Path $Repository "supabase/migrations"
        New-Item -ItemType Directory -Path $MigrationsDir -Force | Out-Null
        foreach ($FileName in $AllowlistFiles) {
            "-- wrong blob body for $FileName" | Set-Content -LiteralPath (Join-Path $MigrationsDir $FileName) -Encoding UTF8
        }
        "supabase/.temp/" | Set-Content -LiteralPath (Join-Path $Repository ".gitignore") -Encoding ASCII
        Invoke-Git -Repository $Repository -GitArgs @("add", ".") | Out-Null
        Invoke-Git -Repository $Repository -GitArgs @("commit", "-q", "-m", "wrong blob fixture") | Out-Null
        $Commit = Invoke-Git -Repository $Repository -GitArgs @("rev-parse", "HEAD")
        Invoke-Git -Repository $Repository -GitArgs @("remote", "add", "origin", $Repository) | Out-Null
        Invoke-Git -Repository $Repository -GitArgs @("update-ref", "refs/remotes/origin/forensic_report_v2", $Commit) | Out-Null
        $WorktreePath = Join-Path $TestRoot ("release-" + [guid]::NewGuid().ToString())
        Invoke-Git -Repository $Repository -GitArgs @("worktree", "add", "-q", "--detach", $WorktreePath, $Commit) | Out-Null
        $TempDir = Join-Path $WorktreePath "supabase/.temp"
        New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
        $ApprovedRef | Set-Content -LiteralPath (Join-Path $TempDir "project-ref") -Encoding ASCII
        $Fixture = [pscustomobject]@{
            Repository = $Repository
            Script = Join-Path $WorktreePath "scripts/apply-pr173-four-migrations-live.ps1"
            Worktree = $WorktreePath
            Commit = $Commit
        }
        $Result = Invoke-Release -Fixture $Fixture -DryRun $true
        Assert-True ($Result.ExitCode -eq 59) "Wrong blob fixture gave exit $($Result.ExitCode)."
        Assert-True ($Result.Log.Count -eq 0) "Wrong blob fixture reached mock psql."
    }

    Invoke-Test "mutable working-tree migration edits cannot alter the immutable applied payload" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $true
        Assert-True ($Result.ExitCode -eq 0) "Dry run failed."
        Assert-Contains $Result.Output "0e4171c5b8d4f6930c68164c71016dafceb391ebbc43bf98c3d62f658b24b8b6"
        $MutatedPath = Join-Path $Fixture.Worktree "supabase/migrations/20260806144716_quote_normalization_layer.sql"
        "SELECT 'MUTATED';" | Set-Content -LiteralPath $MutatedPath -Encoding UTF8
        $DirtyResult = Invoke-Release -Fixture $Fixture -DryRun $true
        Assert-True ($DirtyResult.ExitCode -eq 57) "Dirty worktree should be rejected after mutation."
    }

    Invoke-Test "altered RLS semantics fail verification during locked session" {
        $Fixture = New-FixtureRelease
        $Result = Invoke-Release -Fixture $Fixture -DryRun $false -InputText $ConfirmPhrase -ContractFailVersion "20260806144716"
        Assert-True ($Result.ExitCode -eq 81) "RLS semantics failure should stop before record."
        Assert-True ($Result.Records.Count -eq 0) "RLS semantics failure recorded ledger rows."
    }

    Invoke-Test "missing internal-operator gate fails verification" {
        $Fixture = New-FixtureRelease
        $Responses = New-StandardResponses -RecordedBefore @($AllowlistVersions)
        $Broken = Get-ContractOkText -Version "20260808180000"
        $Broken = $Broken -replace "outcome_integrity_internal_operator_gate=OK", "outcome_integrity_internal_operator_gate=FAIL"
        $Responses["contract-20260808180000-preflight"] = $Broken
        $Result = Invoke-Release -Fixture $Fixture -Responses $Responses -DryRun $false -InputText $ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 66) "Missing operator gate should fail preflight (exit $($Result.ExitCode))."
        Assert-True ($Result.Applies.Count -eq 0) "Missing operator gate mutated."
    }

    Invoke-Test "allowlist stays exactly four fixed migrations and no broad Supabase CLI mutation exists" {
        $Source = Get-Content -LiteralPath $ScriptUnderTest -Raw
        $VersionMatches = @([regex]::Matches($Source, 'Version = "(?<v>\d{14})"') | ForEach-Object { $_.Groups["v"].Value })
        Assert-True (($VersionMatches -join ",") -ceq ($AllowlistVersions -join ",")) `
            "Unexpected allowlist versions: $($VersionMatches -join ',')"
        $FileMatches = @([regex]::Matches($Source, '(?m)^\s*FileName = "(?<f>202608\d{8}_[^"]+\.sql)"') | ForEach-Object { $_.Groups["f"].Value })
        Assert-True (($FileMatches -join ",") -ceq ($AllowlistFiles -join ",")) `
            "Unexpected allowlist filenames: $($FileMatches -join ',')"
        Assert-True (-not $Source.Contains("Get-ChildItem")) "Script discovers migrations dynamically."
        foreach ($Line in ($Source -split "\r?\n")) {
            $IsInvocation = $Line -match '(^|\s)&\s' -or $Line -match 'Start-Process'
            if (-not $IsInvocation) {
                continue
            }
            foreach ($Forbidden in @("db push", "db reset", "migration up", "migration repair", "functions deploy", "secrets set", "gen types", "supabase")) {
                Assert-True (-not $Line.Contains($Forbidden)) "Script invokes a forbidden operation: $Line"
            }
        }
    }
}
finally {
    Remove-Item -LiteralPath $TestRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Sprint 6B release-path tests: $script:Passed passed, $script:Failed failed"
if ($script:Failed -ne 0) {
    exit 1
}
exit 0
