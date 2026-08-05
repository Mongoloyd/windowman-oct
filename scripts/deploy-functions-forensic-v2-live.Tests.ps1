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
