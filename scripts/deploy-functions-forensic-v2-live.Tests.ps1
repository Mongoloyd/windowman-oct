$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Wrapper = Join-Path $PSScriptRoot "deploy-functions-forensic-v2-live.ps1"
$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ExpectedVersion = "16"
$ExpectedFunctionId = "548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7"
$ExpectedHash = "a4c7157d961b165dc6158f4dac748245f9bf322ef76eadcdbcd165f261111fc8"
$ApprovedDeployCommit = "d2c48b52a1e1fe368eaa84ae55548ae0a3565439"
$ApprovedRollbackCommit = "dd960a6f19247e693a61cf1b0913e94d4170b0cc"
$CanonicalRepository = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ApprovedReleasePath = "C:\Projects\wm-mvp-admin-recovery-release"
$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("wm-admin-deploy-tests-" + [guid]::NewGuid())
$FakeBin = Join-Path $TestRoot "fake-bin"
$DenoLog = Join-Path $TestRoot "deno.log"
$NpxLog = Join-Path $TestRoot "npx.log"
$Pr173ConfirmPhrase = "DEPLOY_PR173_FUNCTIONS_AFTER_MIGRATIONS_VERIFIED"
$Pr173Functions = @("scan-quote", "send-contractor-handoff", "dial-lead")
$Pr173RequiredMigrations = @("20260806144716", "20260808160000", "20260808170000", "20260808180000")
$Pr173UnrelatedMigration = "20260716165508"
$Pr173FakeBin = Join-Path $TestRoot "fake-bin-pr173"
$Pr173NpxLog = Join-Path $TestRoot "npx-pr173.log"
$Pr173LedgerFile = Join-Path $TestRoot "migration-ledger.txt"
$script:CanonicalTestWorktrees = New-Object System.Collections.Generic.List[string]
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
        [Console]::Error.WriteLine("FAIL: $Name`n$($_.Exception.Message)")
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

function New-FixtureRepository {
    $Repository = Join-Path $TestRoot ([guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $Repository -Force | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("init", "-q", "-b", "fixture-main") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config", "user.email", "wrapper-tests@example.invalid") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config", "user.name", "Wrapper Tests") | Out-Null

    $AdminDir = Join-Path $Repository "supabase/functions/admin-data"
    $SharedDir = Join-Path $Repository "supabase/functions/_shared"
    New-Item -ItemType Directory -Path $AdminDir, $SharedDir -Force | Out-Null
    @'
import { authorizeAdmin } from "../_shared/adminAuth.ts";
import { buildOtpObservabilityReadModel } from "../_shared/otpObservabilityReadModel.ts";
export { authorizeAdmin, buildOtpObservabilityReadModel };
'@ | Set-Content -LiteralPath (Join-Path $AdminDir "index.ts") -Encoding UTF8
    "export const authorizeAdmin = () => true;" |
        Set-Content -LiteralPath (Join-Path $SharedDir "adminAuth.ts") -Encoding UTF8
    "export const buildOtpObservabilityReadModel = () => ({});" |
        Set-Content -LiteralPath (Join-Path $SharedDir "otpObservabilityReadModel.ts") -Encoding UTF8

    Invoke-Git -Repository $Repository -GitArgs @("add", ".") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("commit", "-q", "-m", "fixture") | Out-Null
    $Commit = Invoke-Git -Repository $Repository -GitArgs @("rev-parse", "HEAD")
    Invoke-Git -Repository $Repository -GitArgs @("checkout", "-q", "--detach", $Commit) | Out-Null

    return [pscustomobject]@{
        Path = $Repository
        Commit = $Commit
    }
}

function New-CanonicalTestWorktree {
    param([Parameter(Mandatory = $true)][string]$Commit)

    $WorktreePath = Join-Path $TestRoot ("canonical-" + [guid]::NewGuid().ToString())
    Invoke-Git -Repository $CanonicalRepository `
        -GitArgs @("worktree", "add", "-q", "--detach", $WorktreePath, $Commit) | Out-Null
    $script:CanonicalTestWorktrees.Add($WorktreePath)
    return [pscustomobject]@{
        Path = $WorktreePath
        Commit = $Commit
    }
}

function Invoke-Wrapper {
    param(
        [Parameter(Mandatory = $true)]$Fixture,
        [string]$ProjectRef = $ApprovedRef,
        [string]$FunctionName = "admin-data",
        [string]$Commit,
        [bool]$DryRun = $true,
        [string[]]$AdditionalArgs = @(),
        [string]$InputText,
        [bool]$FailDeno = $false
    )

    if ([string]::IsNullOrWhiteSpace($Commit)) {
        $Commit = $Fixture.Commit
    }
    Set-Content -LiteralPath $DenoLog -Value "" -Encoding ASCII
    Set-Content -LiteralPath $NpxLog -Value "" -Encoding ASCII

    $OriginalPath = $env:PATH
    $OriginalProjectRef = $env:SUPABASE_PROJECT_REF
    $OriginalDenoLog = $env:FAKE_DENO_LOG
    $OriginalDenoFail = $env:FAKE_DENO_FAIL
    $OriginalNpxLog = $env:FAKE_NPX_LOG
    try {
        $env:PATH = "$FakeBin;$OriginalPath"
        $env:SUPABASE_PROJECT_REF = $ProjectRef
        $env:FAKE_DENO_LOG = $DenoLog
        $env:FAKE_DENO_FAIL = $(if ($FailDeno) { "1" } else { "0" })
        $env:FAKE_NPX_LOG = $NpxLog

        $Arguments = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $Wrapper,
            "-AdminDataOnly",
            "-FunctionName", $FunctionName,
            "-ReleaseWorktree", $Fixture.Path,
            "-ReleaseCommit", $Commit,
            "-CurrentVersion", $ExpectedVersion,
            "-CurrentFunctionId", $ExpectedFunctionId,
            "-CurrentDeployedHash", $ExpectedHash
        )
        if ($DryRun) {
            $Arguments += "-DryRun"
        }
        $Arguments += $AdditionalArgs

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $Output = if ($PSBoundParameters.ContainsKey("InputText")) {
                ($InputText | & powershell @Arguments 2>&1 | Out-String)
            } else {
                (& powershell @Arguments 2>&1 | Out-String)
            }
            $WrapperExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }
        return [pscustomobject]@{
            ExitCode = $WrapperExitCode
            Output = $Output
            DenoLog = (Get-Content -LiteralPath $DenoLog -Raw)
            NpxLog = (Get-Content -LiteralPath $NpxLog -Raw)
        }
    }
    finally {
        $env:PATH = $OriginalPath
        $env:SUPABASE_PROJECT_REF = $OriginalProjectRef
        $env:FAKE_DENO_LOG = $OriginalDenoLog
        $env:FAKE_DENO_FAIL = $OriginalDenoFail
        $env:FAKE_NPX_LOG = $OriginalNpxLog
    }
}

function New-Pr173FixtureRepository {
    param(
        [string]$Branch = "forensic_report_v2",
        [string[]]$OmitFunctions = @(),
        [string]$LinkedRef = $ApprovedRef,
        [bool]$WriteLinkedRef = $true
    )

    $Repository = Join-Path $TestRoot ([guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $Repository -Force | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("init", "-q", "-b", $Branch) | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config", "user.email", "wrapper-tests@example.invalid") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config", "user.name", "Wrapper Tests") | Out-Null

    $ScriptsDir = Join-Path $Repository "scripts"
    New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
    $FixtureWrapper = Join-Path $ScriptsDir "deploy-functions-forensic-v2-live.ps1"
    Copy-Item -LiteralPath $Wrapper -Destination $FixtureWrapper

    foreach ($FunctionName in $Pr173Functions) {
        if ($OmitFunctions -contains $FunctionName) {
            continue
        }
        $FunctionDir = Join-Path $Repository "supabase/functions/$FunctionName"
        New-Item -ItemType Directory -Path $FunctionDir -Force | Out-Null
        "export default () => new Response(`"fixture`");" |
            Set-Content -LiteralPath (Join-Path $FunctionDir "index.ts") -Encoding UTF8
    }

    # The real repository gitignores supabase/.temp/, which is why the linked-ref file does not
    # dirty the tree. Fixtures must replicate that or the clean-tree gate fires first.
    "supabase/.temp/" | Set-Content -LiteralPath (Join-Path $Repository ".gitignore") -Encoding ASCII

    Invoke-Git -Repository $Repository -GitArgs @("add", ".") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("commit", "-q", "-m", "pr173 fixture") | Out-Null

    if ($WriteLinkedRef) {
        $TempDir = Join-Path $Repository "supabase/.temp"
        New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
        $LinkedRef | Set-Content -LiteralPath (Join-Path $TempDir "project-ref") -Encoding ASCII
    }

    return [pscustomobject]@{
        Path = $Repository
        Wrapper = $FixtureWrapper
    }
}

# Mirrors the CLI's local/remote/time table. Rows listed as local-only carry a blank REMOTE cell,
# which is what proves the wrapper reads the REMOTE column instead of substring-matching the output.
function New-Pr173Ledger {
    param(
        [string[]]$RemoteVersions = $Pr173RequiredMigrations,
        [string[]]$LocalOnlyVersions = @(),
        [bool]$LeadingSeparator = $false,
        [bool]$OmitHeader = $false
    )

    $Prefix = if ($LeadingSeparator) { "  | " } else { "    " }
    $Lines = New-Object System.Collections.Generic.List[string]
    if (-not $OmitHeader) {
        [void]$Lines.Add("$($Prefix)     LOCAL      |     REMOTE     |     TIME (UTC)")
        [void]$Lines.Add("  ---------------+----------------+---------------------")
    }
    foreach ($Version in $RemoteVersions) {
        [void]$Lines.Add("$Prefix$Version | $Version | 2026-08-08 00:00:00")
    }
    foreach ($Version in $LocalOnlyVersions) {
        [void]$Lines.Add("$Prefix$Version |                | ")
    }
    return ($Lines -join "`r`n")
}

function Get-Pr173DeployedFunctions {
    param([Parameter(Mandatory = $true)][string]$NpxLogText)

    $Deployed = New-Object System.Collections.Generic.List[string]
    foreach ($Line in ($NpxLogText -split "\r?\n")) {
        $Match = [regex]::Match($Line, 'functions deploy (?<fn>[a-z0-9-]+)')
        if ($Match.Success) {
            [void]$Deployed.Add($Match.Groups["fn"].Value)
        }
    }
    return $Deployed
}

function Invoke-Pr173Wrapper {
    param(
        [Parameter(Mandatory = $true)]$Fixture,
        [string]$ProjectRef = $ApprovedRef,
        [bool]$DryRun = $true,
        [string[]]$AdditionalArgs = @(),
        [string]$InputText,
        [string]$Ledger,
        [int]$LedgerExitCode = 0,
        [string]$FailDeployFunction = "",
        [bool]$IncludeModeSwitch = $true
    )

    if (-not $PSBoundParameters.ContainsKey("Ledger")) {
        $Ledger = New-Pr173Ledger
    }
    Set-Content -LiteralPath $Pr173NpxLog -Value "" -Encoding ASCII
    Set-Content -LiteralPath $Pr173LedgerFile -Value $Ledger -Encoding ASCII

    $OriginalPath = $env:PATH
    $OriginalProjectRef = $env:SUPABASE_PROJECT_REF
    $OriginalNpxLog = $env:FAKE_NPX_LOG
    $OriginalLedgerFile = $env:FAKE_LEDGER_FILE
    $OriginalLedgerExit = $env:FAKE_LEDGER_EXIT
    $OriginalDeployFail = $env:FAKE_DEPLOY_FAIL_FUNCTION
    try {
        $env:PATH = "$Pr173FakeBin;$OriginalPath"
        $env:SUPABASE_PROJECT_REF = $ProjectRef
        $env:FAKE_NPX_LOG = $Pr173NpxLog
        $env:FAKE_LEDGER_FILE = $Pr173LedgerFile
        $env:FAKE_LEDGER_EXIT = [string]$LedgerExitCode
        $env:FAKE_DEPLOY_FAIL_FUNCTION = $FailDeployFunction

        $Arguments = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $Fixture.Wrapper
        )
        if ($IncludeModeSwitch) {
            $Arguments += "-Pr173ExtractionOnly"
        }
        if ($DryRun) {
            $Arguments += "-DryRun"
        }
        $Arguments += $AdditionalArgs

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $Output = if ($PSBoundParameters.ContainsKey("InputText")) {
                ($InputText | & powershell @Arguments 2>&1 | Out-String)
            } else {
                (& powershell @Arguments 2>&1 | Out-String)
            }
            $WrapperExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }

        return [pscustomobject]@{
            ExitCode = $WrapperExitCode
            Output = $Output
            NpxLog = (Get-Content -LiteralPath $Pr173NpxLog -Raw)
            Deployed = @(Get-Pr173DeployedFunctions -NpxLogText (Get-Content -LiteralPath $Pr173NpxLog -Raw))
        }
    }
    finally {
        $env:PATH = $OriginalPath
        $env:SUPABASE_PROJECT_REF = $OriginalProjectRef
        $env:FAKE_NPX_LOG = $OriginalNpxLog
        $env:FAKE_LEDGER_FILE = $OriginalLedgerFile
        $env:FAKE_LEDGER_EXIT = $OriginalLedgerExit
        $env:FAKE_DEPLOY_FAIL_FUNCTION = $OriginalDeployFail
    }
}

New-Item -ItemType Directory -Path $FakeBin -Force | Out-Null
@'
@echo off
echo %*>>"%FAKE_DENO_LOG%"
if "%FAKE_DENO_FAIL%"=="1" exit /b 9
exit /b 0
'@ | Set-Content -LiteralPath (Join-Path $FakeBin "deno.cmd") -Encoding ASCII
@'
@echo off
echo %*>>"%FAKE_NPX_LOG%"
echo %* | findstr /C:"functions list" >nul
if not errorlevel 1 (
  echo [{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":16}]
  exit /b 0
)
exit /b 97
'@ | Set-Content -LiteralPath (Join-Path $FakeBin "npx.cmd") -Encoding ASCII

# PR 173 tests use a separate fake bin so the admin-mode shims above stay byte-identical.
# This shim never reaches the network: it only echoes a local ledger file and logs deploy calls.
New-Item -ItemType Directory -Path $Pr173FakeBin -Force | Out-Null
@'
@echo off
echo %*>>"%FAKE_NPX_LOG%"
echo %* | findstr /C:"migration list" >nul
if not errorlevel 1 goto ledger
echo %* | findstr /C:"functions deploy" >nul
if not errorlevel 1 goto deploy
echo %* | findstr /C:"--version" >nul
if not errorlevel 1 goto version
exit /b 97

:ledger
type "%FAKE_LEDGER_FILE%"
exit /b %FAKE_LEDGER_EXIT%

:deploy
if "%FAKE_DEPLOY_FAIL_FUNCTION%"=="" exit /b 0
echo %* | findstr /C:"deploy %FAKE_DEPLOY_FAIL_FUNCTION% " >nul
if not errorlevel 1 exit /b 1
exit /b 0

:version
echo 2.113.0
exit /b 0
'@ | Set-Content -LiteralPath (Join-Path $Pr173FakeBin "npx.cmd") -Encoding ASCII

try {
    Assert-True (Test-Path -LiteralPath $ApprovedReleasePath -PathType Container) `
        "Approved release worktree is missing: $ApprovedReleasePath"
    $CleanDetached = [pscustomobject]@{
        Path = (Resolve-Path -LiteralPath $ApprovedReleasePath).Path
        Commit = $ApprovedDeployCommit
    }

    Invoke-Test "approved project and admin-data are accepted" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached
        Assert-True ($Result.ExitCode -eq 0) "Expected success, got $($Result.ExitCode): $($Result.Output)"
        Assert-Contains $Result.Output "Function:             admin-data"
        Assert-Contains $Result.Output "Project ref:          $ApprovedRef"
    }

    Invoke-Test "prohibited and unlisted projects fail closed" {
        foreach ($Ref in @("wkrcyxcnzhwjtdpmfpaf", "aqyptdxsbxqpbgoecykx", "not-a-project", "")) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached -ProjectRef $Ref
            Assert-True ($Result.ExitCode -ne 0) "Project '$Ref' was unexpectedly accepted."
        }
    }

    Invoke-Test "unlisted and injected function names fail closed" {
        foreach ($Name in @("scan-quote", "admin-data; whoami", "admin-data --project-ref bad", "")) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached -FunctionName $Name
            Assert-True ($Result.ExitCode -ne 0) "Function '$Name' was unexpectedly accepted."
        }
    }

    Invoke-Test "dirty worktree is rejected" {
        $DirtyFixture = New-CanonicalTestWorktree -Commit $ApprovedDeployCommit
        $DirtyPath = Join-Path $DirtyFixture.Path "untracked.txt"
        "dirty" | Set-Content -LiteralPath $DirtyPath
        $Result = Invoke-Wrapper -Fixture $DirtyFixture
        Assert-True ($Result.ExitCode -ne 0) "Dirty worktree was unexpectedly accepted."
        Assert-Contains $Result.Output "staged, unstaged, or untracked"
    }

    Invoke-Test "wrong exact commit is rejected" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached -Commit ("0" * 40)
        Assert-True ($Result.ExitCode -ne 0) "Wrong commit was unexpectedly accepted."
        Assert-Contains $Result.Output "does not equal"
    }

    Invoke-Test "alternate matching deploy commit is rejected" {
        $AlternateCommit = Invoke-Git -Repository $CanonicalRepository -GitArgs @("rev-parse", "$ApprovedDeployCommit^")
        $AlternateFixture = New-CanonicalTestWorktree -Commit $AlternateCommit
        $Result = Invoke-Wrapper -Fixture $AlternateFixture
        Assert-True ($Result.ExitCode -ne 0) "Alternate deploy commit was unexpectedly accepted."
        Assert-Contains $Result.Output "Deploy requires approved release commit"
    }

    Invoke-Test "unrelated repository is rejected" {
        $Unrelated = New-FixtureRepository
        $Result = Invoke-Wrapper -Fixture $Unrelated
        Assert-True ($Result.ExitCode -ne 0) "Unrelated repository was unexpectedly accepted."
        Assert-Contains $Result.Output "does not belong to the canonical repository"
    }

    Invoke-Test "attached checkout cannot substitute for detached release worktree" {
        $Attached = [pscustomobject]@{
            Path = $CanonicalRepository
            Commit = $ApprovedDeployCommit
        }
        $Result = Invoke-Wrapper -Fixture $Attached
        Assert-True ($Result.ExitCode -ne 0) "Attached checkout was unexpectedly accepted."
        Assert-Contains $Result.Output "must have detached HEAD"
    }

    Invoke-Test "clean detached worktree is accepted" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached
        Assert-True ($Result.ExitCode -eq 0) "Detached clean worktree failed: $($Result.Output)"
        Assert-Contains $Result.Output '"detached_head":  true'
        Assert-Contains $Result.Output '"clean_worktree":  true'
    }

    Invoke-Test "missing function source is rejected" {
        $MissingSource = New-CanonicalTestWorktree -Commit $ApprovedDeployCommit
        Invoke-Git -Repository $MissingSource.Path -GitArgs @("sparse-checkout", "init", "--cone") | Out-Null
        Invoke-Git -Repository $MissingSource.Path -GitArgs @("sparse-checkout", "set", "scripts") | Out-Null
        $Result = Invoke-Wrapper -Fixture $MissingSource
        Assert-True ($Result.ExitCode -ne 0) "Missing source was unexpectedly accepted."
        Assert-Contains $Result.Output "function source is missing"
    }

    Invoke-Test "failed Deno validation blocks action" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FailDeno:$true
        Assert-True ($Result.ExitCode -ne 0) "Failed Deno validation was unexpectedly accepted."
        Assert-Contains $Result.Output "admin-data Deno tests"
        Assert-True ([string]::IsNullOrWhiteSpace($Result.NpxLog)) "npx ran after failed validation."
    }

    Invoke-Test "dry run performs no remote command and prints exact action" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached
        Assert-True ($Result.ExitCode -eq 0) "Dry run failed: $($Result.Output)"
        Assert-Contains $Result.Output "DRY RUN"
        Assert-Contains $Result.Output "NO DEPLOYMENT PERFORMED"
        Assert-Contains $Result.Output "npx supabase functions deploy admin-data --project-ref $ApprovedRef"
        Assert-True ([string]::IsNullOrWhiteSpace($Result.NpxLog)) "Dry run invoked npx: $($Result.NpxLog)"
    }

    Invoke-Test "rollback preparation uses the same project allowlist" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -ProjectRef "aqyptdxsbxqpbgoecykx" `
            -AdditionalArgs @("-AdminOperation", "Rollback", "-RollbackMethod", "Version", "-RollbackVersion", "16")
        Assert-True ($Result.ExitCode -ne 0) "Rollback accepted prohibited project."
        Assert-Contains $Result.Output "project ref must be exactly"
    }

    Invoke-Test "recorded version rollback preparation is dry-run only" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -AdditionalArgs @("-AdminOperation", "Rollback", "-RollbackMethod", "Version", "-RollbackVersion", "16")
        Assert-True ($Result.ExitCode -eq 0) "Version rollback preparation failed: $($Result.Output)"
        Assert-Contains $Result.Output "human Supabase Dashboard version rollback preparation only"
        Assert-True ([string]::IsNullOrWhiteSpace($Result.NpxLog)) "Rollback dry run invoked npx."
    }

    Invoke-Test "secret-like environment values are never printed" {
        $Secret = "DO_NOT_PRINT_TEST_SECRET_9f31"
        $OriginalAccessToken = $env:SUPABASE_ACCESS_TOKEN
        try {
            $env:SUPABASE_ACCESS_TOKEN = $Secret
            $Result = Invoke-Wrapper -Fixture $CleanDetached
            Assert-True ($Result.ExitCode -eq 0) "Dry run failed unexpectedly."
            Assert-True (-not $Result.Output.Contains($Secret)) "Secret-like environment value appeared in output."
        } finally {
            $env:SUPABASE_ACCESS_TOKEN = $OriginalAccessToken
        }
    }

    Invoke-Test "non-dry action requires separate exact human confirmation" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached -DryRun:$false -InputText "WRONG_CONFIRMATION"
        Assert-True ($Result.ExitCode -ne 0) "Non-dry action accepted wrong confirmation."
        Assert-Contains $Result.Output "DEPLOY_ADMIN_DATA_LIVE"
        Assert-Contains $Result.Output "confirmation phrase mismatch"
        Assert-True ($Result.NpxLog.Contains("functions list")) "Current metadata was not captured before confirmation."
        Assert-True (-not $Result.NpxLog.Contains("functions deploy")) "Deployment ran despite wrong confirmation."
    }

    Invoke-Test "artifact rollback requires separate rollback confirmation" {
        $RollbackFixture = New-CanonicalTestWorktree -Commit $ApprovedRollbackCommit
        $Result = Invoke-Wrapper -Fixture $RollbackFixture `
            -DryRun:$false `
            -InputText "WRONG_CONFIRMATION" `
            -AdditionalArgs @("-AdminOperation", "Rollback", "-RollbackMethod", "Artifact")
        Assert-True ($Result.ExitCode -ne 0) "Artifact rollback accepted wrong confirmation."
        Assert-Contains $Result.Output "ROLLBACK_ADMIN_DATA_LIVE"
        Assert-Contains $Result.Output "confirmation phrase mismatch"
        Assert-True ($Result.NpxLog.Contains("functions list")) "Rollback metadata was not captured."
        Assert-True (-not $Result.NpxLog.Contains("functions deploy")) "Rollback deployed despite wrong confirmation."
    }

    Invoke-Test "existing deployment modes and allowlists remain present" {
        $Source = Get-Content -LiteralPath $Wrapper -Raw
        foreach ($ExistingFunction in @(
            "start-upload-scan-session",
            "capture-truth-gate-lead",
            "capture-arbitrage-lead",
            "capture-power-tool-demo-lead",
            "dispatch-platform-events",
            "tiktok-capi-event",
            "google-ads-conversion-event"
        )) {
            Assert-True $Source.Contains('"' + $ExistingFunction + '"') "Existing allowlist entry missing: $ExistingFunction"
        }
        Assert-True (-not $Source.Contains('"admin-data",' )) "admin-data was added to an existing default list."
    }

    Invoke-Test "PR 173 dry run selects exactly three functions in order and deploys nothing" {
        $Fixture = New-Pr173FixtureRepository
        $Result = Invoke-Pr173Wrapper -Fixture $Fixture
        Assert-True ($Result.ExitCode -eq 0) "PR 173 dry run failed: $($Result.Output)"
        Assert-Contains $Result.Output "PR 173 extraction, handoff, and dial functions only"
        foreach ($FunctionName in $Pr173Functions) {
            Assert-Contains $Result.Output "npx supabase functions deploy $FunctionName --project-ref $ApprovedRef"
        }

        $Listed = New-Object System.Collections.Generic.List[string]
        foreach ($Line in ($Result.Output -split "\r?\n")) {
            $Match = [regex]::Match($Line, '^\s*-\s(?<fn>scan-quote|send-contractor-handoff|dial-lead)\s*$')
            if ($Match.Success) {
                [void]$Listed.Add($Match.Groups["fn"].Value)
            }
        }
        Assert-True (($Listed -join ",") -ceq "scan-quote,send-contractor-handoff,dial-lead") `
            "Unexpected PR 173 function selection or order: $($Listed -join ',')"
        Assert-True ($Result.Deployed.Count -eq 0) "PR 173 dry run deployed: $($Result.Deployed -join ',')"
        Assert-Contains $Result.Output "DRY RUN"
        Assert-Contains $Result.Output "NO DEPLOYMENT PERFORMED"
        Assert-Contains $Result.Output "prerequisites only"
        Assert-Contains $Result.Output "never applies, repairs, or pushes migrations"
    }

    Invoke-Test "complete mocked migration ledger passes the prerequisite gate" {
        $Fixture = New-Pr173FixtureRepository
        $Result = Invoke-Pr173Wrapper -Fixture $Fixture
        Assert-True ($Result.ExitCode -eq 0) "Complete ledger was rejected: $($Result.Output)"
        foreach ($Version in $Pr173RequiredMigrations) {
            Assert-Contains $Result.Output "$Version RECORDED remotely"
        }
        Assert-True ($Result.NpxLog.Contains("migration list --linked")) "Read-only ledger check did not run."
    }

    Invoke-Test "each missing prerequisite migration fails before any deployment" {
        $Fixture = New-Pr173FixtureRepository
        foreach ($Missing in $Pr173RequiredMigrations) {
            $Remaining = @($Pr173RequiredMigrations | Where-Object { $_ -ne $Missing })
            # The missing version still appears in the LOCAL column, so a substring check would pass.
            $Ledger = New-Pr173Ledger -RemoteVersions $Remaining -LocalOnlyVersions @($Missing)
            $Result = Invoke-Pr173Wrapper -Fixture $Fixture -Ledger $Ledger
            Assert-True ($Result.ExitCode -eq 105) `
                "Missing migration $Missing gave exit $($Result.ExitCode): $($Result.Output)"
            Assert-Contains $Result.Output "$Missing MISSING remotely"
            Assert-True ($Result.Deployed.Count -eq 0) `
                "Missing migration $Missing still deployed: $($Result.Deployed -join ',')"
            Assert-True (-not $Result.Output.Contains("db push")) "Wrapper suggested applying migrations."
        }
    }

    Invoke-Test "unrelated migration versions are not required" {
        $Fixture = New-Pr173FixtureRepository
        $Ledger = New-Pr173Ledger -LocalOnlyVersions @($Pr173UnrelatedMigration)
        $Result = Invoke-Pr173Wrapper -Fixture $Fixture -Ledger $Ledger
        Assert-True ($Result.ExitCode -eq 0) `
            "Unrelated unrecorded migration blocked the gate: $($Result.Output)"
        Assert-True (-not $Result.Output.Contains("$Pr173UnrelatedMigration MISSING")) `
            "Unrelated migration was treated as a prerequisite."
    }

    # A leading table separator shifts every cell right by one. Anchoring the REMOTE column to the
    # header row is what stops the LOCAL cell from being read as remote proof and passing vacuously.
    Invoke-Test "leading-separator ledger is read from the REMOTE column, not by position" {
        $Fixture = New-Pr173FixtureRepository
        $Missing = "20260808160000"
        $Remaining = @($Pr173RequiredMigrations | Where-Object { $_ -ne $Missing })
        $ShiftedMissing = New-Pr173Ledger -RemoteVersions $Remaining `
            -LocalOnlyVersions @($Missing) `
            -LeadingSeparator $true
        $Result = Invoke-Pr173Wrapper -Fixture $Fixture -Ledger $ShiftedMissing
        Assert-True ($Result.ExitCode -eq 105) `
            "Leading-separator ledger with a local-only version gave exit $($Result.ExitCode): $($Result.Output)"
        Assert-Contains $Result.Output "$Missing MISSING remotely"
        Assert-True ($Result.Deployed.Count -eq 0) "Leading-separator false pass deployed functions."

        $ShiftedComplete = New-Pr173Ledger -LeadingSeparator $true
        $CompleteResult = Invoke-Pr173Wrapper -Fixture $Fixture -Ledger $ShiftedComplete
        Assert-True ($CompleteResult.ExitCode -eq 0) `
            "Leading-separator complete ledger was rejected: $($CompleteResult.Output)"
    }

    Invoke-Test "unreadable and failing ledger reads fail closed" {
        $Fixture = New-Pr173FixtureRepository
        $Unparseable = Invoke-Pr173Wrapper -Fixture $Fixture -Ledger "Connecting to remote database..."
        Assert-True ($Unparseable.ExitCode -eq 104) "Unparseable ledger gave exit $($Unparseable.ExitCode)."
        Assert-True ($Unparseable.Deployed.Count -eq 0) "Unparseable ledger deployed functions."

        # Tabular rows without a REMOTE header must not be trusted by position.
        $Headerless = Invoke-Pr173Wrapper -Fixture $Fixture -Ledger (New-Pr173Ledger -OmitHeader $true)
        Assert-True ($Headerless.ExitCode -eq 104) "Headerless ledger gave exit $($Headerless.ExitCode)."
        Assert-True ($Headerless.Deployed.Count -eq 0) "Headerless ledger deployed functions."

        $Failed = Invoke-Pr173Wrapper -Fixture $Fixture -LedgerExitCode 1
        Assert-True ($Failed.ExitCode -eq 103) "Failed ledger read gave exit $($Failed.ExitCode)."
        Assert-True ($Failed.Deployed.Count -eq 0) "Failed ledger read deployed functions."
    }

    Invoke-Test "wrong PR 173 confirmation deploys nothing" {
        $Fixture = New-Pr173FixtureRepository
        foreach ($Typed in @(
            "WRONG_CONFIRMATION",
            "",
            "$Pr173ConfirmPhrase$Pr173ConfirmPhrase",
            " $Pr173ConfirmPhrase ",
            "DEPLOY_FORENSIC_V2_LIVE_FUNCTIONS",
            $Pr173ConfirmPhrase.ToLowerInvariant()
        )) {
            $Result = Invoke-Pr173Wrapper -Fixture $Fixture -DryRun:$false -InputText $Typed
            Assert-True ($Result.ExitCode -ne 0) "Confirmation '$Typed' was unexpectedly accepted."
            Assert-Contains $Result.Output "confirmation phrase mismatch"
            Assert-True ($Result.Deployed.Count -eq 0) `
                "Confirmation '$Typed' deployed: $($Result.Deployed -join ',')"
        }
    }

    Invoke-Test "exact confirmation runs exactly three sequential deployments in order" {
        $Fixture = New-Pr173FixtureRepository
        $Result = Invoke-Pr173Wrapper -Fixture $Fixture -DryRun:$false -InputText $Pr173ConfirmPhrase
        Assert-True ($Result.ExitCode -eq 0) "Confirmed PR 173 deploy failed: $($Result.Output)"
        Assert-Contains $Result.Output "Type exactly: $Pr173ConfirmPhrase"
        Assert-True (($Result.Deployed -join ",") -ceq "scan-quote,send-contractor-handoff,dial-lead") `
            "Unexpected deployment sequence: $($Result.Deployed -join ',')"
        Assert-True ($Result.Deployed.Count -eq 3) "Expected exactly 3 deployments, saw $($Result.Deployed.Count)."
        Assert-True (-not $Result.NpxLog.Contains("--prune")) "Deployment used --prune."
        Assert-True (-not $Result.NpxLog.Contains("--jobs")) "Deployment used parallel jobs."
        Assert-Contains $Result.Output "separate human-operated actions"
    }

    Invoke-Test "first deployment failure stops the remaining deployments" {
        $Fixture = New-Pr173FixtureRepository
        $Result = Invoke-Pr173Wrapper -Fixture $Fixture `
            -DryRun:$false `
            -InputText $Pr173ConfirmPhrase `
            -FailDeployFunction "scan-quote"
        Assert-True ($Result.ExitCode -ne 0) "Failed deployment reported success."
        Assert-Contains $Result.Output "Deploy failed for scan-quote"
        Assert-True (($Result.Deployed -join ",") -ceq "scan-quote") `
            "Deployment continued past the first failure: $($Result.Deployed -join ',')"
    }

    Invoke-Test "PR 173 mode is mutually exclusive with every specialized mode" {
        $Fixture = New-Pr173FixtureRepository
        foreach ($ModeArgs in @(
            @("-GoogleAdsOnly"),
            @("-DispatchOnly"),
            @("-GoogleAdsOnly", "-DispatchOnly"),
            @("-AdminDataOnly")
        )) {
            $Result = Invoke-Pr173Wrapper -Fixture $Fixture -AdditionalArgs $ModeArgs
            Assert-True ($Result.ExitCode -ne 0) "Mode combination '$($ModeArgs -join ' ')' was accepted."
            Assert-Contains $Result.Output "mutually exclusive"
            Assert-True ($Result.Deployed.Count -eq 0) "Invalid mode combination deployed functions."
        }
    }

    Invoke-Test "admin-only parameters and bare -DryRun still require -AdminDataOnly" {
        $Fixture = New-Pr173FixtureRepository
        foreach ($AdminArgs in @(
            @("-FunctionName", "admin-data"),
            @("-ReleaseWorktree", $Fixture.Path),
            @("-ReleaseCommit", ("a" * 40)),
            @("-AdminOperation", "Rollback"),
            @("-RollbackMethod", "Version"),
            @("-RollbackVersion", "16"),
            @("-CurrentVersion", $ExpectedVersion),
            @("-CurrentFunctionId", $ExpectedFunctionId),
            @("-CurrentDeployedHash", $ExpectedHash),
            @("-EvidencePath", (Join-Path $TestRoot "evidence.json"))
        )) {
            $Result = Invoke-Pr173Wrapper -Fixture $Fixture -AdditionalArgs $AdminArgs
            Assert-True ($Result.ExitCode -eq 59) `
                "Admin parameter '$($AdminArgs -join ' ')' gave exit $($Result.ExitCode)."
            Assert-True ($Result.Deployed.Count -eq 0) "Admin parameter combination deployed functions."
        }

        $BareDryRun = Invoke-Pr173Wrapper -Fixture $Fixture -IncludeModeSwitch $false
        Assert-True ($BareDryRun.ExitCode -eq 59) "Bare -DryRun gave exit $($BareDryRun.ExitCode)."
        Assert-True ($BareDryRun.Deployed.Count -eq 0) "Bare -DryRun deployed functions."
    }

    Invoke-Test "PR 173 mode keeps wrong and forbidden project refs blocked" {
        $Fixture = New-Pr173FixtureRepository
        foreach ($Ref in @("wkrcyxcnzhwjtdpmfpaf", "aqyptdxsbxqpbgoecykx", "wm-mvp-forensic-v2-local", "not-a-project", "")) {
            $Result = Invoke-Pr173Wrapper -Fixture $Fixture -ProjectRef $Ref
            Assert-True ($Result.ExitCode -ne 0) "Project ref '$Ref' was unexpectedly accepted."
            Assert-True ($Result.Deployed.Count -eq 0) "Project ref '$Ref' deployed functions."
        }
    }

    Invoke-Test "PR 173 mode requires the approved linked ref for the read-only ledger check" {
        $MissingLink = New-Pr173FixtureRepository -WriteLinkedRef $false
        $Result = Invoke-Pr173Wrapper -Fixture $MissingLink
        Assert-True ($Result.ExitCode -eq 101) "Missing linked ref gave exit $($Result.ExitCode)."
        Assert-True (-not $Result.NpxLog.Contains("migration list")) "Ledger was queried without a linked ref."

        # A mismatched link is already caught by the pre-existing Fail 23 conflict gate, which runs
        # first for every mode. Exit 101 covers the missing-file case that legacy modes tolerate.
        $WrongLink = New-Pr173FixtureRepository -LinkedRef "wkrcyxcnzhwjtdpmfpaf"
        $WrongResult = Invoke-Pr173Wrapper -Fixture $WrongLink
        Assert-True ($WrongResult.ExitCode -eq 23) "Wrong linked ref gave exit $($WrongResult.ExitCode)."
        Assert-True (-not $WrongResult.NpxLog.Contains("migration list")) "Ledger was queried with a wrong linked ref."
        Assert-True ($WrongResult.Deployed.Count -eq 0) "Wrong linked ref deployed functions."
    }

    Invoke-Test "PR 173 mode keeps dirty worktrees and wrong branches blocked" {
        $Dirty = New-Pr173FixtureRepository
        "dirty" | Set-Content -LiteralPath (Join-Path $Dirty.Path "untracked.txt")
        $DirtyResult = Invoke-Pr173Wrapper -Fixture $Dirty
        Assert-True ($DirtyResult.ExitCode -eq 12) "Dirty worktree gave exit $($DirtyResult.ExitCode)."
        Assert-True ($DirtyResult.Deployed.Count -eq 0) "Dirty worktree deployed functions."

        $WrongBranch = New-Pr173FixtureRepository -Branch "feature/pr173-s6a-deploy-wrapper"
        $BranchResult = Invoke-Pr173Wrapper -Fixture $WrongBranch
        Assert-True ($BranchResult.ExitCode -eq 11) "Wrong branch gave exit $($BranchResult.ExitCode)."
        Assert-True ($BranchResult.Deployed.Count -eq 0) "Wrong branch deployed functions."
    }

    Invoke-Test "missing PR 173 function source blocks deployment" {
        foreach ($Omitted in $Pr173Functions) {
            $Fixture = New-Pr173FixtureRepository -OmitFunctions @($Omitted)
            $Result = Invoke-Pr173Wrapper -Fixture $Fixture
            Assert-True ($Result.ExitCode -eq 102) `
                "Missing '$Omitted' source gave exit $($Result.ExitCode): $($Result.Output)"
            Assert-Contains $Result.Output "function source is missing"
            Assert-True ($Result.Deployed.Count -eq 0) "Missing source deployed functions."
        }
    }

    Invoke-Test "PR 173 allowlist stays exactly three functions with no bulk mutation" {
        $Source = Get-Content -LiteralPath $Wrapper -Raw
        $AllowlistMatch = [regex]::Match($Source, '(?ms)^\$Pr173TargetFunctions = @\((?<body>.*?)^\)')
        Assert-True $AllowlistMatch.Success "PR 173 allowlist declaration not found."
        $Entries = @([regex]::Matches($AllowlistMatch.Groups["body"].Value, '"(?<fn>[^"]+)"') |
            ForEach-Object { $_.Groups["fn"].Value })
        Assert-True (($Entries -join ",") -ceq "scan-quote,send-contractor-handoff,dial-lead") `
            "Unexpected PR 173 allowlist: $($Entries -join ',')"
        # Scoped to real CLI invocations so the wrapper's own safety banner text is not flagged.
        foreach ($Line in ($Source -split "\r?\n")) {
            if ($Line -notmatch '&\s+npx') {
                continue
            }
            foreach ($Forbidden in @("--prune", "--jobs", "db push", "db reset", "secrets set", "gen types")) {
                Assert-True (-not $Line.Contains($Forbidden)) "Wrapper invokes a forbidden operation: $Line"
            }
            if ($Line.Contains("functions deploy")) {
                Assert-True ($Line.Contains("--project-ref")) "Deploy invocation lacks an explicit ref: $Line"
                Assert-True ($Line -match 'functions deploy \$') "Deploy invocation is not name-scoped: $Line"
            }
        }
    }
}
finally {
    foreach ($WorktreePath in $script:CanonicalTestWorktrees) {
        if (Test-Path -LiteralPath $WorktreePath) {
            try {
                Invoke-Git -Repository $CanonicalRepository `
                    -GitArgs @("worktree", "remove", "--force", $WorktreePath) | Out-Null
            } catch {
                [Console]::Error.WriteLine("WARNING: failed to remove test worktree '$WorktreePath': $($_.Exception.Message)")
            }
        }
    }
    Remove-Item -LiteralPath $TestRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Wrapper tests: $script:Passed passed, $script:Failed failed"
if ($script:Failed -ne 0) {
    exit 1
}
exit 0
