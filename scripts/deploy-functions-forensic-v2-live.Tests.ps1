$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Wrapper = Join-Path $PSScriptRoot "deploy-functions-forensic-v2-live.ps1"
$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ExpectedVersion = "16"
$ExpectedFunctionId = "548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7"
$ExpectedHash = "a4c7157d961b165dc6158f4dac748245f9bf322ef76eadcdbcd165f261111fc8"
$ApprovedDeployCommit = "d2c48b52a1e1fe368eaa84ae55548ae0a3565439"
$ApprovedRollbackCommit = "dd960a6f19247e693a61cf1b0913e94d4170b0cc"
$DefaultListJson = '[{"name":"admin-data","slug":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":16}]'
$CanonicalRepository = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("wm-admin-deploy-tests-" + [guid]::NewGuid())
$FakeBin = Join-Path $TestRoot "fake-bin"
$MockSupabaseDir = Join-Path $FakeBin "mock cli with spaces"

function Get-CanonicalBlobTextMd5([string]$Blob) {
    $Temp = Join-Path ([System.IO.Path]::GetTempPath()) ("wmchat-test-blob-" + [guid]::NewGuid())
    try {
        $Process = Start-Process git -ArgumentList @("-C",$CanonicalRepository,"cat-file","blob",$Blob) `
            -RedirectStandardOutput $Temp -NoNewWindow -Wait -PassThru
        if ($Process.ExitCode -ne 0) { throw "Unable to materialize canonical test blob $Blob" }
        $Text = Get-Content -LiteralPath $Temp -Raw
        $Md5 = [System.Security.Cryptography.MD5]::Create()
        try {
            return ([System.BitConverter]::ToString($Md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text)))).Replace("-","").ToLowerInvariant()
        } finally { $Md5.Dispose() }
    } finally { Remove-Item $Temp -Force -ErrorAction SilentlyContinue }
}
$WmChatBasePayloadMd5 = Get-CanonicalBlobTextMd5 "2070d0e44ef1ac4d66e3e1d0f93fbfb554f35b16"
$WmChatGrantPayloadMd5 = Get-CanonicalBlobTextMd5 "57815689795f1417ab9fb6e31a4f61f44a0368e3"
$MockSupabaseCli = Join-Path $MockSupabaseDir "supabase-mock.cmd"
$DenoLog = Join-Path $TestRoot "deno.log"
$CliLog = Join-Path $TestRoot "supabase-cli.log"
$ListCallCounterFile = Join-Path $TestRoot "list-call-counter.txt"
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
$script:CleanDeployFixture = $null

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
    Invoke-Git -Repository $Repository -GitArgs @("config", "core.autocrlf", "false") | Out-Null

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

function Get-CleanDeployFixture {
    if (-not $script:CleanDeployFixture) {
        $script:CleanDeployFixture = New-CanonicalTestWorktree -Commit $ApprovedDeployCommit
    }
    return $script:CleanDeployFixture
}

function Reset-MockSupabaseEnv {
    param([hashtable]$FakeSupabase = @{})

    Set-Content -LiteralPath $CliLog -Value "" -Encoding ASCII
    Set-Content -LiteralPath $ListCallCounterFile -Value "0" -Encoding ASCII
    Remove-Item Env:FAKE_SUPABASE_LIST_STDOUT, Env:FAKE_SUPABASE_LIST_STDERR, Env:FAKE_SUPABASE_LIST_EXIT `
        , Env:FAKE_SUPABASE_POST_LIST_STDOUT, Env:FAKE_SUPABASE_POST_LIST_STDERR, Env:FAKE_SUPABASE_POST_LIST_EXIT `
        , Env:FAKE_SUPABASE_DEPLOY_STDOUT, Env:FAKE_SUPABASE_DEPLOY_STDERR, Env:FAKE_SUPABASE_DEPLOY_EXIT `
        , Env:FAKE_SUPABASE_VERSION -ErrorAction SilentlyContinue

    if ($FakeSupabase.ContainsKey("ListStdout")) { $env:FAKE_SUPABASE_LIST_STDOUT = $FakeSupabase.ListStdout }
    if ($FakeSupabase.ContainsKey("ListStderr")) { $env:FAKE_SUPABASE_LIST_STDERR = $FakeSupabase.ListStderr }
    if ($FakeSupabase.ContainsKey("ListExit")) { $env:FAKE_SUPABASE_LIST_EXIT = [string]$FakeSupabase.ListExit }
    if ($FakeSupabase.ContainsKey("PostListStdout")) { $env:FAKE_SUPABASE_POST_LIST_STDOUT = $FakeSupabase.PostListStdout }
    if ($FakeSupabase.ContainsKey("PostListStderr")) { $env:FAKE_SUPABASE_POST_LIST_STDERR = $FakeSupabase.PostListStderr }
    if ($FakeSupabase.ContainsKey("PostListExit")) { $env:FAKE_SUPABASE_POST_LIST_EXIT = [string]$FakeSupabase.PostListExit }
    if ($FakeSupabase.ContainsKey("DeployStdout")) { $env:FAKE_SUPABASE_DEPLOY_STDOUT = $FakeSupabase.DeployStdout }
    if ($FakeSupabase.ContainsKey("DeployStderr")) { $env:FAKE_SUPABASE_DEPLOY_STDERR = $FakeSupabase.DeployStderr }
    if ($FakeSupabase.ContainsKey("DeployExit")) { $env:FAKE_SUPABASE_DEPLOY_EXIT = [string]$FakeSupabase.DeployExit }
    if ($FakeSupabase.ContainsKey("Version")) { $env:FAKE_SUPABASE_VERSION = $FakeSupabase.Version }
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
        [bool]$FailDeno = $false,
        [hashtable]$FakeSupabase = @{}
    )

    if ([string]::IsNullOrWhiteSpace($Commit)) {
        $Commit = $Fixture.Commit
    }
    Set-Content -LiteralPath $DenoLog -Value "" -Encoding ASCII
    Reset-MockSupabaseEnv -FakeSupabase $FakeSupabase

    $OriginalPath = $env:PATH
    $OriginalProjectRef = $env:SUPABASE_PROJECT_REF
    $OriginalDenoLog = $env:FAKE_DENO_LOG
    $OriginalDenoFail = $env:FAKE_DENO_FAIL
    $OriginalCliLog = $env:FAKE_SUPABASE_LOG
    $OriginalListCallsFile = $env:FAKE_SUPABASE_LIST_CALLS_FILE
    $OriginalCliOverride = $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE
    try {
        $env:PATH = "$FakeBin;$OriginalPath"
        $env:SUPABASE_PROJECT_REF = $ProjectRef
        $env:FAKE_DENO_LOG = $DenoLog
        $env:FAKE_DENO_FAIL = $(if ($FailDeno) { "1" } else { "0" })
        $env:FAKE_SUPABASE_LOG = $CliLog
        $env:FAKE_SUPABASE_LIST_CALLS_FILE = $ListCallCounterFile
        $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE = $MockSupabaseCli

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
        $CliLogText = ""
        if (Test-Path -LiteralPath $CliLog) {
            $CliLogText = Get-Content -LiteralPath $CliLog -Raw
        }
        return [pscustomobject]@{
            ExitCode = $WrapperExitCode
            Output = $Output
            DenoLog = (Get-Content -LiteralPath $DenoLog -Raw -ErrorAction SilentlyContinue)
            CliLog = $CliLogText
        }
    }
    finally {
        $env:PATH = $OriginalPath
        $env:SUPABASE_PROJECT_REF = $OriginalProjectRef
        $env:FAKE_DENO_LOG = $OriginalDenoLog
        $env:FAKE_DENO_FAIL = $OriginalDenoFail
        $env:FAKE_SUPABASE_LOG = $OriginalCliLog
        $env:FAKE_SUPABASE_LIST_CALLS_FILE = $OriginalListCallsFile
        $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE = $OriginalCliOverride
    }
}

function Measure-CliInvocations {
    param(
        [Parameter(Mandatory = $true)][string]$LogText,
        [Parameter(Mandatory = $true)][string]$Needle
    )
    if ([string]::IsNullOrWhiteSpace($LogText)) {
        return 0
    }
    return @($LogText -split "\r?\n" | Where-Object { $_ -like "*$Needle*" }).Count
}

function Invoke-CliResolutionProbe {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("Pinned", "NpxPresent", "Missing")]
        [string]$Mode,
        [bool]$ResolveTwice = $false
    )

    $ProbeRoot = Join-Path $TestRoot ("resolution-" + [guid]::NewGuid().ToString())
    $ProbeScripts = Join-Path $ProbeRoot "scripts"
    $ProbeBin = Join-Path $ProbeRoot "probe-bin"
    $NpxInvocationLog = Join-Path $ProbeRoot "npx-invoked.txt"
    New-Item -ItemType Directory -Path $ProbeScripts, $ProbeBin -Force | Out-Null

    $Tokens = $null
    $Errors = $null
    $WrapperAst = [System.Management.Automation.Language.Parser]::ParseFile($Wrapper, [ref]$Tokens, [ref]$Errors)
    Assert-True ($Errors.Count -eq 0) "Cannot build resolution probe from a wrapper with parse errors."
    $FunctionTexts = New-Object System.Collections.Generic.List[string]
    foreach ($Name in @("Fail", "Resolve-SupabaseCliInvocation")) {
        $FunctionAst = @($WrapperAst.FindAll({
            param($Node)
            $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $Node.Name -eq $Name
        }, $true))
        Assert-True ($FunctionAst.Count -eq 1) "Expected exactly one production helper named '$Name'."
        [void]$FunctionTexts.Add($FunctionAst[0].Extent.Text)
    }

    if ($Mode -eq "Pinned") {
        $PinnedDir = Join-Path $ProbeRoot "node_modules/.bin"
        New-Item -ItemType Directory -Path $PinnedDir -Force | Out-Null
        "@echo off`r`nexit /b 0`r`n" |
            Set-Content -LiteralPath (Join-Path $PinnedDir "supabase.cmd") -Encoding ASCII
    } elseif ($Mode -eq "NpxPresent") {
        "@echo off`r`necho invoked>>`"$NpxInvocationLog`"`r`nexit /b 0`r`n" |
            Set-Content -LiteralPath (Join-Path $ProbeBin "npx.cmd") -Encoding ASCII
    }

    $ProbePath = Join-Path $ProbeScripts "probe.ps1"
    $ProbeSource = @(
        'Set-StrictMode -Version Latest',
        '$ErrorActionPreference = "Stop"',
        '$script:SupabaseCliResolved = $null',
        ($FunctionTexts -join "`r`n`r`n"),
        '$First = Resolve-SupabaseCliInvocation',
        $(if ($ResolveTwice) {
            '$env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE = "Z:\definitely-missing\mock.cmd"' +
                "`r`n" + '$Second = Resolve-SupabaseCliInvocation'
        } else {
            '$Second = $First'
        }),
        '[ordered]@{',
        '  first_source = $First.SourceLabel',
        '  first_leading = @($First.LeadingArguments)',
        '  second_source = $Second.SourceLabel',
        '  cache_same_instance = [object]::ReferenceEquals($First, $Second)',
        '} | ConvertTo-Json -Compress'
    ) -join "`r`n"
    Set-Content -LiteralPath $ProbePath -Value $ProbeSource -Encoding UTF8

    $PowerShellExe = (Get-Command powershell -CommandType Application -ErrorAction Stop).Source
    $OriginalPath = $env:PATH
    $OriginalOverride = $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE
    try {
        $env:PATH = $ProbeBin
        Remove-Item Env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE -ErrorAction SilentlyContinue
        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $Output = (& $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $ProbePath 2>&1 | Out-String)
            $ExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }
        return [pscustomobject]@{
            ExitCode = $ExitCode
            Output = $Output
            NpxInvoked = (Test-Path -LiteralPath $NpxInvocationLog -PathType Leaf)
        }
    }
    finally {
        $env:PATH = $OriginalPath
        $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE = $OriginalOverride
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
    Invoke-Git -Repository $Repository -GitArgs @("config", "core.autocrlf", "false") | Out-Null

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

function New-WmChatFixtureRepository {
    $Repository = Join-Path $TestRoot ("wmchat-release-" + [guid]::NewGuid())
    $BareOrigin = Join-Path $TestRoot ("wmchat-origin-" + [guid]::NewGuid() + ".git")
    if (-not $script:WmChatFixtureTemplate) {
        $script:WmChatFixtureTemplate = Join-Path $TestRoot "wmchat-fixture-template"
        & git -c core.autocrlf=false clone --quiet --no-local $CanonicalRepository $script:WmChatFixtureTemplate
        if ($LASTEXITCODE -ne 0) { throw "Unable to clone canonical repo for WmChat fixture." }
    }
    Copy-Item -LiteralPath $script:WmChatFixtureTemplate -Destination $Repository -Recurse
    Invoke-Git -Repository $Repository -GitArgs @("config","user.email","wmchat-wrapper@example.invalid") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config","user.name","WmChat Wrapper Tests") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("config","core.autocrlf","false") | Out-Null
    Copy-Item -LiteralPath $Wrapper -Destination (Join-Path $Repository "scripts/deploy-functions-forensic-v2-live.ps1") -Force
    Copy-Item -LiteralPath (Join-Path $CanonicalRepository "scripts/apply-wmchat-consent-live.ps1") `
        -Destination (Join-Path $Repository "scripts/apply-wmchat-consent-live.ps1") -Force
    $DeployFixturePath = Join-Path $Repository "scripts/deploy-functions-forensic-v2-live.ps1"
    $DeployFixtureSource = Get-Content -LiteralPath $DeployFixturePath -Raw
    $DeployFixtureSource = $DeployFixtureSource.Replace(
        '$WmChatApprovedOriginUrl = "https://github.com/Mongoloyd/wm-mvp.git"',
        '$WmChatApprovedOriginUrl = "' + $BareOrigin + '"'
    )
    Set-Content -LiteralPath $DeployFixturePath -Value $DeployFixtureSource -Encoding UTF8
    $MigrationFixturePath = Join-Path $Repository "scripts/apply-wmchat-consent-live.ps1"
    $MigrationFixtureSource = Get-Content -LiteralPath $MigrationFixturePath -Raw
    $MigrationFixtureSource = $MigrationFixtureSource.Replace(
        '$ApprovedOriginUrl = "https://github.com/Mongoloyd/wm-mvp.git"',
        '$ApprovedOriginUrl = "' + $BareOrigin + '"'
    )
    Set-Content -LiteralPath $MigrationFixturePath -Value $MigrationFixtureSource -Encoding UTF8
    Invoke-Git -Repository $Repository -GitArgs @("add","scripts/deploy-functions-forensic-v2-live.ps1","scripts/apply-wmchat-consent-live.ps1") | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("commit","-q","-m","wmchat runner fixture") | Out-Null
    $Commit = Invoke-Git -Repository $Repository -GitArgs @("rev-parse","HEAD")
    & git init --bare --quiet $BareOrigin
    if ($LASTEXITCODE -ne 0) { throw "Unable to create WmChat fake origin." }
    Invoke-Git -Repository $Repository -GitArgs @("remote","set-url","origin",$BareOrigin) | Out-Null
    Invoke-Git -Repository $Repository -GitArgs @("push","-q","origin","HEAD:refs/heads/forensic_report_v2") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $Repository "supabase/.temp") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $Repository "supabase/.temp/project-ref") -Value $ApprovedRef -Encoding ASCII
    Invoke-Git -Repository $Repository -GitArgs @("checkout","-q","--detach",$Commit) | Out-Null
    return [pscustomobject]@{
        Path = $Repository
        Commit = $Commit
        Script = Join-Path $Repository "scripts/deploy-functions-forensic-v2-live.ps1"
    }
}

function Invoke-WmChatWrapper {
    param(
        [Parameter(Mandatory=$true)]$Fixture,
        [bool]$DryRun=$true,
        [string]$InputText="",
        [string]$ProjectRef=$ApprovedRef,
        [switch]$FailFirstDeploy,
        [switch]$NoVersionAdvance,
        [switch]$SecondFunctionDrift,
        [switch]$OmitMigration,
        [switch]$ConsentContractFailureAfterConfirmation,
        [switch]$OmitEvidencePath,
        [string[]]$AdditionalArgs=@()
    )
    $Bin = Join-Path $TestRoot ("wmchat-bin-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $Bin | Out-Null
    $Cli = Join-Path $Bin "supabase.cmd"
    $Deno = Join-Path $Bin "deno.cmd"
    $Psql = Join-Path $Bin "psql.cmd"
    $State = Join-Path $Bin "state.txt"
    $Log = Join-Path $Bin "cli.log"
    $DenoLog = Join-Path $Bin "deno.log"
    Set-Content $State "0" -Encoding ASCII
    @'
@echo off
setlocal EnableDelayedExpansion
echo %*>>"%WMCHAT_CLI_LOG%"
echo %* | findstr /C:"migration list --linked" >nul
if not errorlevel 1 goto ledger
echo %* | findstr /C:"functions list" >nul
if not errorlevel 1 goto list
echo %* | findstr /C:"functions download" >nul
if not errorlevel 1 goto download
echo %* | findstr /C:"functions deploy" >nul
if not errorlevel 1 goto deploy
echo %* | findstr /C:"--version" >nul
if not errorlevel 1 echo 2.113.0&exit /b 0
exit /b 90
:ledger
echo LOCAL          ^| REMOTE         ^| TIME (UTC)
echo 20260801143000 ^| 20260801143000 ^| 2026-08-01
if not defined FAKE_WMCHAT_OMIT_MIGRATION echo 20260816022737 ^| 20260816022737 ^| 2026-08-16
exit /b 0
:list
set /p S=<"%WMCHAT_CLI_STATE%"
set UVER=58
set CVER=53
set UHASH=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
set CHASH=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
if !S! GEQ 1 set UVER=59&set UHASH=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
if !S! GEQ 2 set CVER=54&set CHASH=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
if "%WMCHAT_SECOND_FUNCTION_DRIFT%"=="1" if !S! GEQ 1 set CVER=55&set CHASH=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
if "%WMCHAT_NO_VERSION_ADVANCE%"=="1" set UVER=58&set CVER=53&set UHASH=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&set CHASH=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
echo [{"name":"start-upload-scan-session","slug":"start-upload-scan-session","id":"11111111-1111-4111-8111-111111111111","version":!UVER!,"sha256":"!UHASH!"},{"name":"capture-truth-gate-lead","slug":"capture-truth-gate-lead","id":"22222222-2222-4222-8222-222222222222","version":!CVER!,"sha256":"!CHASH!"}]
exit /b 0
:download
mkdir "supabase\functions\%3" 2>nul
>"supabase\functions\%3\index.ts" echo // reviewed rollback fixture for %3
exit /b 0
:deploy
echo %* | findstr /C:"start-upload-scan-session" >nul
if not errorlevel 1 (
  if "%WMCHAT_FAIL_FIRST_DEPLOY%"=="1" exit /b 7
  >"%WMCHAT_CLI_STATE%" echo 1
  exit /b 0
)
echo %* | findstr /C:"capture-truth-gate-lead" >nul
if not errorlevel 1 (
  >"%WMCHAT_CLI_STATE%" echo 2
  exit /b 0
)
exit /b 91
'@ | Set-Content -LiteralPath $Cli -Encoding ASCII
    @'
@echo off
echo %*>>"%WMCHAT_DENO_LOG%"
exit /b 0
'@ | Set-Content -LiteralPath $Deno -Encoding ASCII
    @'
@echo off
echo ledger_columns=version:text:NO,statements:_text:YES,name:text:YES,created_by:text:YES,idempotency_key:text:YES,rollback:_text:YES
echo untouched_count=141
echo untouched_min=20260317051701
echo untouched_max=20260624120000
echo untouched_fingerprint=440b0c2521013e15bd6e02f9cf0f96d8
echo allowed_ledger=20260801143000^|lead_consent_events^|%WMCHAT_TEST_BASE_MD5%,20260816022737^|grant_wmchat_consent_read_to_service_role^|%WMCHAT_TEST_GRANT_MD5%
echo table=present
echo rpc=present
echo rls=true
echo columns=true
echo constraints=true
echo indexes=true
echo policies=0
echo rpc_properties=true
echo rpc_body=true
echo client_table_privileges=true
echo service_select=true
set PSQL_CALLS=0
if exist "%FAKE_WMCHAT_PSQL_CALLS_FILE%" set /p PSQL_CALLS=<"%FAKE_WMCHAT_PSQL_CALLS_FILE%"
set /a PSQL_CALLS+=1
> "%FAKE_WMCHAT_PSQL_CALLS_FILE%" echo !PSQL_CALLS!
if defined FAKE_WMCHAT_CONSENT_CONTRACT_FAILURE_AFTER if !PSQL_CALLS! GEQ 2 (echo service_direct_writes=true) else (echo service_direct_writes=false)
if not defined FAKE_WMCHAT_CONSENT_CONTRACT_FAILURE_AFTER echo service_direct_writes=false
echo service_bypassrls=true
echo function_privileges=true
exit /b 0
'@ | Set-Content -LiteralPath $Psql -Encoding ASCII
    $Ca=Join-Path $Bin "ca.pem";Set-Content $Ca "test-ca" -Encoding ASCII
    $PinnedCliDirectory = Join-Path $Fixture.Path "node_modules/.bin"
    New-Item -ItemType Directory -Path $PinnedCliDirectory -Force | Out-Null
    Copy-Item -LiteralPath $Cli -Destination (Join-Path $PinnedCliDirectory "supabase.cmd") -Force

    $Old = @{}
    foreach($Name in @("PATH","SUPABASE_PROJECT_REF","WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE","WMCHAT_CLI_LOG","WMCHAT_CLI_STATE","WMCHAT_DENO_LOG","WMCHAT_FAIL_FIRST_DEPLOY","WMCHAT_NO_VERSION_ADVANCE","WMCHAT_SECOND_FUNCTION_DRIFT","WMCHAT_MIGRATION_PSQL_TEST_OVERRIDE","WMCHAT_LIVE_DATABASE_URL","WMCHAT_LIVE_PGSSLROOTCERT","WMCHAT_TEST_BASE_MD5","WMCHAT_TEST_GRANT_MD5","FAKE_WMCHAT_OMIT_MIGRATION","FAKE_WMCHAT_CONSENT_CONTRACT_FAILURE_AFTER","FAKE_WMCHAT_PSQL_CALLS_FILE")) {
        $Old[$Name]=[Environment]::GetEnvironmentVariable($Name,"Process")
    }
    try {
        $env:PATH="$Bin;$($env:PATH)"
        $env:SUPABASE_PROJECT_REF=$ProjectRef
        $env:WM_ADMIN_WRAPPER_SUPABASE_CLI_TEST_OVERRIDE=$null
        $env:WMCHAT_CLI_LOG=$Log
        $env:WMCHAT_CLI_STATE=$State
        $env:WMCHAT_DENO_LOG=$DenoLog
        $env:WMCHAT_FAIL_FIRST_DEPLOY=$(if($FailFirstDeploy){"1"}else{"0"})
        $env:WMCHAT_NO_VERSION_ADVANCE=$(if($NoVersionAdvance){"1"}else{"0"})
        $env:WMCHAT_SECOND_FUNCTION_DRIFT=$(if($SecondFunctionDrift){"1"}else{"0"})
        $env:FAKE_WMCHAT_OMIT_MIGRATION=$(if($OmitMigration){"1"}else{"0"})
        $env:FAKE_WMCHAT_CONSENT_CONTRACT_FAILURE_AFTER=$(if($ConsentContractFailureAfterConfirmation){"1"}else{"0"})
        $env:FAKE_WMCHAT_PSQL_CALLS_FILE=(Join-Path $Bin "psql-calls.txt")
        $env:WMCHAT_MIGRATION_PSQL_TEST_OVERRIDE=$null
        $env:WMCHAT_TEST_BASE_MD5=$WmChatBasePayloadMd5
        $env:WMCHAT_TEST_GRANT_MD5=$WmChatGrantPayloadMd5
        $env:WMCHAT_LIVE_DATABASE_URL="postgresql://postgres.${ApprovedRef}:test-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
        $env:WMCHAT_LIVE_PGSSLROOTCERT=$Ca
        $Arguments=@("-NoProfile","-ExecutionPolicy","Bypass","-File",$Fixture.Script,"-WmChatOnly","-ReleaseWorktree",$Fixture.Path,"-ReleaseCommit",$Fixture.Commit)+$AdditionalArgs
        $EvidenceFile=Join-Path $Bin "wmchat-deploy-evidence.json"
        if($DryRun){$Arguments+="-DryRun"}
        elseif(-not $OmitEvidencePath){$Arguments+=@("-EvidencePath",$EvidenceFile)}
        $In=Join-Path $Bin "stdin.txt";$Out=Join-Path $Bin "stdout.txt";$Err=Join-Path $Bin "stderr.txt"
        Set-Content $In $InputText -Encoding ASCII
        $P=Start-Process powershell.exe -ArgumentList $Arguments -RedirectStandardInput $In -RedirectStandardOutput $Out -RedirectStandardError $Err -NoNewWindow -Wait -PassThru
        $Output=((Get-Content $Out -Raw -ErrorAction SilentlyContinue)+(Get-Content $Err -Raw -ErrorAction SilentlyContinue))
        return [pscustomobject]@{
            ExitCode=$P.ExitCode
            Output=$Output
            CliLog=@($(if(Test-Path $Log){Get-Content $Log}else{@()}))
            DenoLog=@($(if(Test-Path $DenoLog){Get-Content $DenoLog}else{@()}))
            State=(Get-Content $State -Raw).Trim()
            EvidencePath=$EvidenceFile
        }
    } finally {
        foreach($Name in $Old.Keys){[Environment]::SetEnvironmentVariable($Name,$Old[$Name],"Process")}
    }
}

New-Item -ItemType Directory -Path $FakeBin, $MockSupabaseDir -Force | Out-Null
@'
@echo off
echo %*>>"%FAKE_DENO_LOG%"
if "%FAKE_DENO_FAIL%"=="1" exit /b 9
exit /b 0
'@ | Set-Content -LiteralPath (Join-Path $FakeBin "deno.cmd") -Encoding ASCII
@'
@echo off
setlocal EnableDelayedExpansion
echo %*>>"%FAKE_SUPABASE_LOG%"
set "joined=%*"

echo !joined! | findstr /C:"--version" >nul
if not errorlevel 1 (
  if defined FAKE_SUPABASE_VERSION (
    echo !FAKE_SUPABASE_VERSION!
  ) else (
    echo 2.101.0-test
  )
  exit /b 0
)

echo !joined! | findstr /C:"functions list" >nul
if not errorlevel 1 goto :functions_list

echo !joined! | findstr /C:"functions deploy" >nul
if not errorlevel 1 goto :functions_deploy

exit /b 97

:functions_list
set CALLN=0
if defined FAKE_SUPABASE_LIST_CALLS_FILE if exist "%FAKE_SUPABASE_LIST_CALLS_FILE%" (
  set /p CALLN=<"%FAKE_SUPABASE_LIST_CALLS_FILE%"
)
set /a CALLN+=1
if defined FAKE_SUPABASE_LIST_CALLS_FILE echo !CALLN!>"%FAKE_SUPABASE_LIST_CALLS_FILE%"

if !CALLN! GEQ 2 (
  if defined FAKE_SUPABASE_POST_LIST_STDOUT goto :emit_post_list
  if defined FAKE_SUPABASE_LIST_STDOUT goto :emit_custom_list
  echo [{"name":"admin-data","slug":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":17}]
  goto :after_list_emit
)
if defined FAKE_SUPABASE_LIST_STDOUT goto :emit_custom_list
echo [{"name":"admin-data","slug":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":16}]
goto :after_list_emit

:emit_post_list
if /I "!FAKE_SUPABASE_POST_LIST_STDOUT!"=="__EMPTY__" goto :after_list_emit
echo !FAKE_SUPABASE_POST_LIST_STDOUT!
goto :after_list_emit

:emit_custom_list
if /I "!FAKE_SUPABASE_LIST_STDOUT!"=="__EMPTY__" goto :after_list_emit
echo !FAKE_SUPABASE_LIST_STDOUT!
goto :after_list_emit

:after_list_emit
if !CALLN! GEQ 2 (
  if defined FAKE_SUPABASE_POST_LIST_STDERR echo !FAKE_SUPABASE_POST_LIST_STDERR! 1>&2
  if defined FAKE_SUPABASE_POST_LIST_EXIT exit /b !FAKE_SUPABASE_POST_LIST_EXIT!
)
if defined FAKE_SUPABASE_LIST_STDERR echo !FAKE_SUPABASE_LIST_STDERR! 1>&2
if defined FAKE_SUPABASE_LIST_EXIT exit /b !FAKE_SUPABASE_LIST_EXIT!
exit /b 0

:functions_deploy
echo !joined! | findstr /C:"admin-data" >nul
if errorlevel 1 exit /b 98
echo !joined! | findstr /C:"zgsofkgddpcntdvpckdq" >nul
if errorlevel 1 exit /b 98
if defined FAKE_SUPABASE_DEPLOY_STDOUT echo !FAKE_SUPABASE_DEPLOY_STDOUT!
if defined FAKE_SUPABASE_DEPLOY_STDERR echo !FAKE_SUPABASE_DEPLOY_STDERR! 1>&2
if defined FAKE_SUPABASE_DEPLOY_EXIT exit /b !FAKE_SUPABASE_DEPLOY_EXIT!
exit /b 0
'@ | Set-Content -LiteralPath $MockSupabaseCli -Encoding ASCII

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
    $CleanDetached = Get-CleanDeployFixture

    Invoke-Test "repository-pinned Supabase CLI resolution is preferred and process-cached" {
        $Result = Invoke-CliResolutionProbe -Mode Pinned -ResolveTwice:$true
        Assert-True ($Result.ExitCode -eq 0) "Pinned resolution probe failed: $($Result.Output)"
        $Resolved = $Result.Output.Trim() | ConvertFrom-Json
        Assert-True ($Resolved.first_source -eq "node_modules/.bin/supabase.cmd (repository-pinned)") `
            "Pinned source label was not selected: $($Resolved.first_source)"
        Assert-True ($Resolved.first_leading.Count -eq 0) "Pinned CLI unexpectedly had leading arguments."
        Assert-True ($Resolved.cache_same_instance -eq $true) "Resolved invocation was not cached in-process."
        Assert-True ($Resolved.second_source -eq $Resolved.first_source) "Cache was replaced by later environment input."
    }

    Invoke-Test "npx on PATH is ignored when repository CLI is missing" {
        $Result = Invoke-CliResolutionProbe -Mode NpxPresent
        Assert-True ($Result.ExitCode -eq 82) "npx-on-PATH probe gave exit $($Result.ExitCode): $($Result.Output)"
        Assert-True (-not $Result.NpxInvoked) "Resolver invoked the fake npx executable."
        Assert-Contains $Result.Output "Repository-installed Supabase CLI is required"
        Assert-Contains $Result.Output "reviewed lockfile"
    }

    Invoke-Test "admin CLI resolver contains no network-capable fallback" {
        $Tokens = $null
        $Errors = $null
        $WrapperAst = [System.Management.Automation.Language.Parser]::ParseFile($Wrapper, [ref]$Tokens, [ref]$Errors)
        Assert-True ($Errors.Count -eq 0) "Cannot inspect resolver fallback policy with parse errors."
        $ResolverFunctions = @($WrapperAst.FindAll({
            param($Node)
            $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
                $Node.Name -eq "Resolve-SupabaseCliInvocation"
        }, $true))
        Assert-True ($ResolverFunctions.Count -eq 1) "Expected exactly one Resolve-SupabaseCliInvocation function."
        $ResolverText = $ResolverFunctions[0].Extent.Text
        foreach ($ForbiddenPattern in @(
            '(?i)Get-Command\s+["'']?npx',
            '--no-install',
            '(?i)Get-Command\s+["'']?supabase',
            '(?i)\b(?:npm|bunx|pnpm|yarn)\b',
            '(?i)Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|\bcurl(?:\.exe)?\b|\bwget(?:\.exe)?\b|https?://'
        )) {
            Assert-True ($ResolverText -notmatch $ForbiddenPattern) `
                "Resolver retained forbidden fallback pattern '$ForbiddenPattern'."
        }
    }

    Invoke-Test "missing approved CLI resolution paths fail closed" {
        $Result = Invoke-CliResolutionProbe -Mode Missing
        Assert-True ($Result.ExitCode -eq 82) "Missing CLI paths gave exit $($Result.ExitCode): $($Result.Output)"
        Assert-Contains $Result.Output "Repository-installed Supabase CLI is required"
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
        Assert-True ([string]::IsNullOrWhiteSpace($Result.CliLog)) "Supabase CLI ran after failed validation."
    }

    Invoke-Test "dry run queries mocked remote metadata and performs no deployment" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached
        Assert-True ($Result.ExitCode -eq 0) "Dry run failed: $($Result.Output)"
        Assert-Contains $Result.Output "DRY RUN"
        Assert-Contains $Result.Output "NO DEPLOYMENT PERFORMED"
        Assert-Contains $Result.Output "supabase functions deploy admin-data --project-ref $ApprovedRef"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions list") -eq 1) "Dry run did not perform exactly one metadata read."
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 0) "Dry run invoked deploy."
        Assert-Contains $Result.Output '"capture_status":  "REMOTE_READ_CONFIRMED"'
        Assert-Contains $Result.Output "TEST OVERRIDE ACTIVE"
        Assert-Contains $Result.Output "NEVER a production deployment path"
    }

    Invoke-Test "empty stderr is classified clean through metadata capture" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached
        Assert-True ($Result.ExitCode -eq 0) "Clean stderr path failed: $($Result.Output)"
        Assert-True (-not $Result.Output.Contains("unexpected stderr")) "Empty stderr was not clean."
    }

    Invoke-Test "ANSI is removed before reviewed advisory classification" {
        $AnsiWarning = ([char]0x1B) + "[33mWarning" + ([char]0x1B) + "[0m A new version of Supabase CLI is available"
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStderr = $AnsiWarning }
        Assert-True ($Result.ExitCode -eq 0) "ANSI advisory was rejected: $($Result.Output)"
        Assert-Contains $Result.Output "non-blocking"
        Assert-True (-not $Result.Output.Contains(([char]0x1B))) "ANSI escape remained in output."
    }

    Invoke-Test "reviewed CLI update advisory is tolerated and preserved as warning" {
        $Advisory = "A new version of Supabase CLI is available: v2.111.0 (currently installed v2.101.0)"
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStderr = $Advisory }
        Assert-True ($Result.ExitCode -eq 0) "Reviewed advisory was rejected."
        Assert-Contains $Result.Output $Advisory
        Assert-Contains $Result.Output "non-blocking"
    }

    Invoke-Test "unexpected pre-action stderr fails closed before mutation" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStderr = "unexpected diagnostic from CLI" }
        Assert-True ($Result.ExitCode -eq 83) "Unexpected stderr gave exit $($Result.ExitCode)."
        Assert-Contains $Result.Output "unexpected stderr"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 0) "Deploy ran after unexpected stderr."
    }

    Invoke-Test "stdout stderr and exit code remain distinct" {
        $Advisory = "A new version of Supabase CLI is available"
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{
            ListStdout = $DefaultListJson
            ListStderr = $Advisory
            ListExit = 7
        }
        Assert-True ($Result.ExitCode -eq 83) "Native exit 7 was not preserved as metadata failure."
        Assert-Contains $Result.Output "CLI exit 7"
        Assert-True (-not $Result.Output.Contains($DefaultListJson)) "Raw stdout leaked."
        Assert-True (-not $Result.Output.Contains($Advisory)) "Raw stderr leaked on nonzero exit."
    }

    Invoke-Test "metadata nonzero exit fails closed without raw authentication diagnostics" {
        $SecretLikeStderr = "Authentication failed: secret-token-abc123"
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{
            ListExit = 1
            ListStderr = $SecretLikeStderr
        }
        Assert-True ($Result.ExitCode -eq 83) "Nonzero metadata exit gave $($Result.ExitCode)."
        Assert-Contains $Result.Output "Unable to capture current non-secret Edge Function metadata"
        Assert-True (-not $Result.Output.Contains($SecretLikeStderr)) "Authentication stderr leaked."
    }

    Invoke-Test "malformed metadata JSON fails closed" {
        foreach ($Payload in @("__EMPTY__", "not-json")) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStdout = $Payload }
            Assert-True ($Result.ExitCode -eq 84) "Malformed payload '$Payload' gave $($Result.ExitCode)."
            Assert-Contains $Result.Output "Unable to parse current Edge Function metadata as JSON"
        }
    }

    Invoke-Test "missing and duplicate admin-data rows fail closed" {
        $Cases = @(
            '[{"name":"scan-quote","id":"11111111-1111-1111-1111-111111111111","version":1}]',
            '[{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":16},{"slug":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":16}]'
        )
        foreach ($Payload in $Cases) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStdout = $Payload }
            Assert-True ($Result.ExitCode -eq 85) "Invalid cardinality gave $($Result.ExitCode)."
            Assert-Contains $Result.Output "did not contain exactly one 'admin-data' function"
        }
    }

    Invoke-Test "missing or malformed metadata identity and version fail closed" {
        foreach ($Payload in @(
            '[{"name":"admin-data"}]',
            '[{"name":"admin-data","id":"not-a-uuid","version":16}]',
            '[{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":0}]',
            '[{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":"1.5"}]'
        )) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStdout = $Payload }
            Assert-True ($Result.ExitCode -eq 85) "Malformed metadata gave $($Result.ExitCode)."
            Assert-Contains $Result.Output "missing required id/version fields"
        }
    }

    Invoke-Test "operator-reconfirmed metadata mismatch fails closed" {
        foreach ($Payload in @(
            '[{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":17}]',
            '[{"name":"admin-data","id":"11111111-1111-1111-1111-111111111111","version":16}]'
        )) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ ListStdout = $Payload }
            Assert-True ($Result.ExitCode -eq 86) "Mismatch gave $($Result.ExitCode)."
            Assert-Contains $Result.Output "differs from the operator-reconfirmed ID/version"
        }
    }

    Invoke-Test "toolchain evidence is sanitized and source-labeled" {
        $Secret = "TOOLCHAIN_SECRET_MUST_NOT_APPEAR"
        $OriginalToken = $env:SUPABASE_ACCESS_TOKEN
        try {
            $env:SUPABASE_ACCESS_TOKEN = $Secret
            $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ Version = "2.101.0-test" }
            Assert-True ($Result.ExitCode -eq 0) "Toolchain evidence path failed."
            Assert-Contains $Result.Output '"supabase_cli":  "2.101.0-test"'
            Assert-Contains $Result.Output '"supabase_cli_source":  "TEST_OVERRIDE_MOCK_CLI"'
            Assert-Contains $Result.Output '"powershell":'
            Assert-True (-not $Result.Output.Contains($Secret)) "Environment value leaked."
            $ToolchainMatch = [regex]::Match($Result.Output, '(?ms)"toolchain"\s*:\s*\{.*?\}')
            Assert-True $ToolchainMatch.Success "Sanitized toolchain evidence object was not found."
            Assert-True (-not $ToolchainMatch.Value.Contains($MockSupabaseCli)) "Absolute CLI path leaked into toolchain evidence."
            Assert-True (-not $ToolchainMatch.Value.Contains($env:USERPROFILE)) "Home directory leaked into toolchain evidence."
        } finally {
            $env:SUPABASE_ACCESS_TOKEN = $OriginalToken
        }
    }

    Invoke-Test "unsanitized Supabase version evidence fails without echoing raw output" {
        $HostileVersion = "2.101.0 C:\Users\operator\secret-token"
        $Result = Invoke-Wrapper -Fixture $CleanDetached -FakeSupabase @{ Version = $HostileVersion }
        Assert-True ($Result.ExitCode -eq 82) "Unsanitized version gave exit $($Result.ExitCode)."
        Assert-Contains $Result.Output "failed strict sanitization"
        Assert-True (-not $Result.Output.Contains($HostileVersion)) "Raw unsanitized version leaked."
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
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 0) "Rollback dry run invoked deploy."
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
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions list") -eq 1) "Current metadata was not captured before confirmation."
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 0) "Deployment ran despite wrong confirmation."
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
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions list") -eq 1) "Rollback metadata was not captured."
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 0) "Rollback deployed despite wrong confirmation."
    }

    Invoke-Test "deploy nonzero exit is not retried" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -DryRun:$false `
            -InputText "DEPLOY_ADMIN_DATA_LIVE" `
            -FakeSupabase @{ DeployExit = 9 }
        Assert-True ($Result.ExitCode -eq 99) "Deploy failure gave $($Result.ExitCode)."
        Assert-Contains $Result.Output "failed (exit 9)"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 1) "Deploy was retried."
    }

    Invoke-Test "deploy exit zero plus benign stderr proceeds to post-check" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -DryRun:$false `
            -InputText "DEPLOY_ADMIN_DATA_LIVE" `
            -FakeSupabase @{
                DeployStdout = "deployed"
                DeployStderr = "A new version of Supabase CLI is available"
                PostListStdout = '[{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":17}]'
            }
        Assert-True ($Result.ExitCode -eq 0) "Benign deploy diagnostic failed: $($Result.Output)"
        Assert-Contains $Result.Output "VERIFIED_VERSION_INCREASED"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions list") -eq 2) "Post-check did not run."
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 1) "Deploy count was not one."
    }

    Invoke-Test "deploy exit zero plus unexpected stderr is ambiguous without retry" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -DryRun:$false `
            -InputText "DEPLOY_ADMIN_DATA_LIVE" `
            -FakeSupabase @{ DeployStderr = "unexpected deploy diagnostic" }
        Assert-True ($Result.ExitCode -eq 106) "Unexpected deploy stderr gave $($Result.ExitCode)."
        Assert-Contains $Result.Output "DEPLOYMENT STATE AMBIGUOUS"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 1) "Ambiguous deploy was retried."
    }

    Invoke-Test "unchanged post-deploy version is ambiguous without retry" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -DryRun:$false `
            -InputText "DEPLOY_ADMIN_DATA_LIVE" `
            -FakeSupabase @{ PostListStdout = $DefaultListJson }
        Assert-True ($Result.ExitCode -eq 106) "Unchanged version gave $($Result.ExitCode)."
        Assert-Contains $Result.Output "DEPLOYMENT STATE AMBIGUOUS"
        Assert-Contains $Result.Output "did not increase"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 1) "Ambiguous deploy was retried."
    }

    Invoke-Test "changed post-deploy function ID is ambiguous" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -DryRun:$false `
            -InputText "DEPLOY_ADMIN_DATA_LIVE" `
            -FakeSupabase @{ PostListStdout = '[{"name":"admin-data","id":"11111111-1111-1111-1111-111111111111","version":17}]' }
        Assert-True ($Result.ExitCode -eq 106) "Changed ID gave $($Result.ExitCode)."
        Assert-Contains $Result.Output "DEPLOYMENT STATE AMBIGUOUS"
        Assert-Contains $Result.Output "differs from pre-action ID"
    }

    Invoke-Test "missing duplicate and malformed post-deploy metadata are ambiguous" {
        foreach ($Payload in @(
            "not-json",
            '[{"name":"scan-quote","id":"11111111-1111-1111-1111-111111111111","version":17}]',
            '[{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":17},{"name":"admin-data","id":"548b11d4-03c3-4ef3-ab0f-a3cfe28d96d7","version":18}]'
        )) {
            $Result = Invoke-Wrapper -Fixture $CleanDetached `
                -DryRun:$false `
                -InputText "DEPLOY_ADMIN_DATA_LIVE" `
                -FakeSupabase @{ PostListStdout = $Payload }
            Assert-True ($Result.ExitCode -eq 106) "Bad post metadata gave $($Result.ExitCode)."
            Assert-Contains $Result.Output "DEPLOYMENT STATE AMBIGUOUS"
            Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 1) "Ambiguous result retried deploy."
        }
    }

    Invoke-Test "post-deploy metadata nonzero exit is ambiguous" {
        $Result = Invoke-Wrapper -Fixture $CleanDetached `
            -DryRun:$false `
            -InputText "DEPLOY_ADMIN_DATA_LIVE" `
            -FakeSupabase @{ PostListExit = 4 }
        Assert-True ($Result.ExitCode -eq 106) "Post-list failure gave $($Result.ExitCode)."
        Assert-Contains $Result.Output "DEPLOYMENT STATE AMBIGUOUS"
        Assert-True ((Measure-CliInvocations -LogText $Result.CliLog -Needle "functions deploy") -eq 1) "Post-list failure retried deploy."
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

    Invoke-Test "WmChat dry run verifies exact scope and performs zero deploys" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture
        Assert-True ($Result.ExitCode -eq 0) "Exit $($Result.ExitCode): $($Result.Output)"
        Assert-Contains $Result.Output "DRY RUN - NO DEPLOYMENT PERFORMED"
        Assert-Contains $Result.Output "start-upload-scan-session, capture-truth-gate-lead"
        Assert-True ((@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})).Count -eq 0) "Dry run deployed."
        Assert-True ($Result.DenoLog.Count -eq 3) "Frozen validation did not run exactly three commands."
        Assert-True (-not (($Result.DenoLog -join "`n") -match '--no-lock')) "Validation bypassed the lockfile."
    }
    Invoke-Test "WmChat missing migration fails before deployment" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -OmitMigration
        Assert-True ($Result.ExitCode -eq 120) "Exit $($Result.ExitCode): $($Result.Output)"
        Assert-True ($Result.State -eq "0") "Missing migration deployed functions."
        Assert-True ((@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})).Count -eq 0) "Missing migration reached deployment."
    }
    Invoke-Test "WmChat consent contract failure blocks deployment and recheck" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -ConsentContractFailureAfterConfirmation -DryRun:$false -InputText "DEPLOY_WMCHAT_LIVE_FUNCTIONS"
        Assert-True ($Result.ExitCode -eq 120) "Exit $($Result.ExitCode): $($Result.Output)"
        Assert-True ($Result.State -eq "0") "Consent recheck deployed functions."
        Assert-True ((@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})).Count -eq 0) "Consent failure reached deployment."
    }

    Invoke-Test "WmChat exact confirmation deploys two functions in verified order" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -DryRun:$false -InputText "DEPLOY_WMCHAT_LIVE_FUNCTIONS"
        Assert-True ($Result.ExitCode -eq 0) "Exit $($Result.ExitCode): $($Result.Output)"
        $Deploys=@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})
        $Downloads=@($Result.CliLog | Where-Object {$_ -like '*functions download*'})
        Assert-True ($Downloads.Count -eq 2) "Expected exactly two rollback source downloads."
        Assert-True ($Downloads[0] -like '*start-upload-scan-session*' -and $Downloads[1] -like '*capture-truth-gate-lead*') "Rollback artifacts were not captured in exact order."
        Assert-True ($Deploys.Count -eq 2) "Expected exactly two deploys: $($Deploys -join ';')"
        Assert-True ($Deploys[0] -like '*start-upload-scan-session*') "Upload function was not first."
        Assert-True ($Deploys[1] -like '*capture-truth-gate-lead*') "Capture function was not second."
        Assert-True ((@($Deploys | Where-Object {$_ -like '*--no-verify-jwt*'})).Count -eq 2) "Public-function JWT mode was not explicit on both deploys."
        Assert-True ($Result.State -eq "2") "Both mocked deployments did not complete."
        Assert-Contains $Result.Output '"result":  "VERIFIED"'
        Assert-True (Test-Path -LiteralPath $Result.EvidencePath -PathType Leaf) "Final evidence file is missing."
        $Evidence=Get-Content -LiteralPath $Result.EvidencePath -Raw | ConvertFrom-Json
        Assert-True ($Evidence.result -ceq "VERIFIED") "Final evidence is not VERIFIED."
        Assert-True (@($Evidence.bundle_files).Count -gt 0) "Bundle evidence is empty."
        foreach($File in @($Evidence.bundle_files)) {
            Assert-True ([string]$File.git_blob -match '^[0-9a-f]{40}$') "Bundle Git blob is not pinned."
            Assert-True ([string]$File.sha256 -match '^[0-9a-f]{64}$') "Bundle SHA-256 is not pinned."
        }
        Assert-True (@($Evidence.rollback.artifacts).Count -eq 2) "Rollback artifact evidence is not an exact two-function array."
        Assert-True ($Evidence.rollback.artifacts[0].function_name -ceq "start-upload-scan-session") "Upload rollback evidence is not first."
        Assert-True ($Evidence.rollback.artifacts[1].function_name -ceq "capture-truth-gate-lead") "Capture rollback evidence is not second."
        foreach($Artifact in @($Evidence.rollback.artifacts)) {
            Assert-True (Test-Path -LiteralPath $Artifact.external_directory -PathType Container) "Rollback source directory is missing."
            Assert-True (@($Artifact.files).Count -gt 0) "Rollback source artifact is empty."
            foreach($File in @($Artifact.files)) {
                Assert-True ([string]$File.sha256 -match '^[0-9a-f]{64}$') "Rollback source SHA-256 is missing."
            }
        }
        $EvidenceName=[System.IO.Path]::GetFileName($Result.EvidencePath)
        $EvidenceParent=Split-Path -Parent $Result.EvidencePath
        Assert-True ((@(Get-ChildItem -LiteralPath $EvidenceParent -Force | Where-Object { $_.Name -like ".$EvidenceName.*.tmp" -or $_.Name -like ".$EvidenceName.*.bak" })).Count -eq 0) "Atomic evidence left temporary files."
    }

    Invoke-Test "WmChat confirmation is case-sensitive" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -DryRun:$false -InputText "deploy_wmchat_live_functions"
        Assert-True ($Result.ExitCode -eq 127) "Exit $($Result.ExitCode): $($Result.Output)"
        Assert-True ($Result.State -eq "0") "Wrong confirmation deployed."
    }

    Invoke-Test "WmChat non-dry release requires an external evidence path" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -DryRun:$false -OmitEvidencePath -InputText "DEPLOY_WMCHAT_LIVE_FUNCTIONS"
        Assert-True ($Result.ExitCode -eq 127) "Exit $($Result.ExitCode): $($Result.Output)"
        Assert-Contains $Result.Output "EvidencePath is mandatory"
        Assert-True ((@($Result.CliLog | Where-Object {$_ -like '*functions download*' -or $_ -like '*functions deploy*'})).Count -eq 0) "Missing evidence path reached rollback download or deploy."
    }

    Invoke-Test "WmChat first deployment failure is ambiguous and blocks capture deployment" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -DryRun:$false -InputText "DEPLOY_WMCHAT_LIVE_FUNCTIONS" -FailFirstDeploy
        Assert-True ($Result.ExitCode -eq 116) "Exit $($Result.ExitCode): $($Result.Output)"
        Assert-Contains $Result.Output "UNKNOWN_REMOTE_STATE"
        $Deploys=@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})
        Assert-True ($Deploys.Count -eq 1) "Failure retried or advanced: $($Deploys -join ';')"
        Assert-True (-not (($Deploys -join '') -like '*capture-truth-gate-lead*')) "Capture deployed after first failure."
        $Evidence=Get-Content -LiteralPath $Result.EvidencePath -Raw | ConvertFrom-Json
        Assert-True ($Evidence.result -ceq "UNKNOWN_REMOTE_STATE") "Ambiguous result was not persisted."
        Assert-True ($Evidence.post_attempt_metadata.function_name -ceq "start-upload-scan-session") "Post-attempt metadata was discarded."
        Assert-True ([int]$Evidence.post_attempt_metadata.version -eq 58) "Unexpected ambiguous post-attempt version."
    }

    Invoke-Test "WmChat unchanged post-deploy version is ambiguous and never advances" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -DryRun:$false -InputText "DEPLOY_WMCHAT_LIVE_FUNCTIONS" -NoVersionAdvance
        Assert-True ($Result.ExitCode -eq 116) "Exit $($Result.ExitCode): $($Result.Output)"
        $Deploys=@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})
        Assert-True ($Deploys.Count -eq 1) "Ambiguous first deploy advanced or retried."
    }

    Invoke-Test "WmChat refreshes each function immediately before deployment" {
        $Fixture=New-WmChatFixtureRepository
        $Result=Invoke-WmChatWrapper -Fixture $Fixture -DryRun:$false -InputText "DEPLOY_WMCHAT_LIVE_FUNCTIONS" -SecondFunctionDrift
        Assert-True ($Result.ExitCode -eq 116) "Exit $($Result.ExitCode): $($Result.Output)"
        $Deploys=@($Result.CliLog | Where-Object {$_ -like '*functions deploy*'})
        Assert-True ($Deploys.Count -eq 1 -and $Deploys[0] -like '*start-upload-scan-session*') "Second-function drift was not stopped before its deploy."
        Assert-True ($Result.State -eq "1") "Unexpected deployment state after second-function drift."
        $Evidence=Get-Content -LiteralPath $Result.EvidencePath -Raw | ConvertFrom-Json
        Assert-True ($Evidence.ambiguous_function -ceq "capture-truth-gate-lead") "Drifted function was not identified."
        Assert-True ([int]$Evidence.pre_deploy_metadata.version -eq 55) "Immediate pre-deploy drift metadata was not preserved."
    }

    Invoke-Test "WmChat fetch refreshes the exact approved remote-tracking ref" {
        $Fixture=New-WmChatFixtureRepository
        $StaleCommit=(Invoke-Git -Repository $Fixture.Path -GitArgs @("rev-parse","$($Fixture.Commit)^" )).Trim()
        Invoke-Git -Repository $Fixture.Path -GitArgs @("update-ref","refs/remotes/origin/forensic_report_v2",$StaleCommit) | Out-Null
        $Result=Invoke-WmChatWrapper -Fixture $Fixture
        Assert-True ($Result.ExitCode -eq 0) "Fresh tracking-ref proof failed: $($Result.Output)"
        $Refreshed=(Invoke-Git -Repository $Fixture.Path -GitArgs @("rev-parse","refs/remotes/origin/forensic_report_v2")).Trim()
        Assert-True ($Refreshed -ceq $Fixture.Commit) "Approved remote-tracking ref remained stale."
    }

    Invoke-Test "WmChat mode rejects wrong target and every other mode combination" {
        $Wrong=New-WmChatFixtureRepository
        $WrongResult=Invoke-WmChatWrapper -Fixture $Wrong -ProjectRef "wrong"
        Assert-True ($WrongResult.ExitCode -eq 125) "Wrong target exit $($WrongResult.ExitCode)."
        $ModeFixture=New-WmChatFixtureRepository
        foreach($Other in @("-GoogleAdsOnly","-DispatchOnly","-Pr173ExtractionOnly","-AdminDataOnly")) {
            $Result=Invoke-WmChatWrapper -Fixture $ModeFixture -AdditionalArgs @($Other)
            Assert-True ($Result.ExitCode -eq 124 -or $Result.ExitCode -eq 60) "Mode $Other exit $($Result.ExitCode)."
            Assert-True ($Result.State -eq "0") "Mode combination deployed."
        }
    }

    Invoke-Test "WmChat allowlist remains exactly two and legacy allowlists are unchanged" {
        $Source=Get-Content -LiteralPath $Wrapper -Raw
        $Match=[regex]::Match($Source,'(?ms)^\$WmChatTargetFunctions = @\((?<body>.*?)^\)')
        Assert-True $Match.Success "WmChat allowlist missing."
        $Entries=@([regex]::Matches($Match.Groups['body'].Value,'"(?<fn>[^"]+)"')|ForEach-Object{$_.Groups['fn'].Value})
        Assert-True (($Entries -join ',') -ceq 'start-upload-scan-session,capture-truth-gate-lead') "Unexpected WmChat allowlist."
        Assert-True ($Source.Contains('$DefaultTargetFunctions = @(')) "Legacy default mode was removed."
        Assert-True ($Source.Contains('$Pr173TargetFunctions = @(')) "Legacy PR173 mode was removed."
        $DeployCalls = [regex]::Matches($Source, '(?ms)Invoke-SupabaseCliProcess\s+`?\s*-\s*Arguments\s+@\((?<args>.*?)\)')
        Assert-True ($DeployCalls.Count -gt 0) "No wrapped CLI calls found."
        foreach ($Call in $DeployCalls) {
            if ($Call.Groups["args"].Value -match '"functions"\s*,\s*"deploy"') {
                Assert-True ($Call.Groups["args"].Value -match '\$[A-Za-z][A-Za-z0-9_]*') "Deploy call lacks a function-name variable."
                Assert-True ($Call.Groups["args"].Value -match '"--project-ref"') "Deploy call lacks an explicit project ref."
            }
        }
        foreach($Token in @("wmchatIntake.test.ts","consentCapture_test.ts","contracts/schemas.test.ts","--no-verify-jwt","New-WmChatRollbackArtifacts","post-confirm metadata","immediate pre-deploy metadata","exact next version","File]::Replace","sha256","post_attempt_metadata")) {
            Assert-Contains $Source $Token
        }
        Assert-True ($Source.Contains("WmChat live mode forbids executable test overrides")) "WmChat executable override rejection is missing."
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
