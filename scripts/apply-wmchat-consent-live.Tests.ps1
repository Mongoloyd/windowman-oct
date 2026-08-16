# Offline tests for apply-wmchat-consent-live.ps1. All database calls use a local fake executable.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptUnderTest = Join-Path $PSScriptRoot "apply-wmchat-consent-live.ps1"
$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ConfirmPhrase = "APPLY_WMCHAT_CONSENT_MIGRATIONS_TO_LIVE_ACTIVE"
$ApprovedRef = "zgsofkgddpcntdvpckdq"
$Failures = 0
$TestRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("wmchat-live-runner-tests-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $TestRoot | Out-Null

function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Contains([string]$Text, [string]$Needle) { Assert-True $Text.Contains($Needle) "Expected '$Needle' in output.`n$Text" }
function Invoke-Test([string]$Name, [scriptblock]$Body) {
    try { & $Body; Write-Host "PASS $Name" -ForegroundColor Green }
    catch { $script:Failures++; Write-Host "FAIL $Name`n$($_.Exception.Message)`n$($_.ScriptStackTrace)" -ForegroundColor Red }
}
function Invoke-Git([string]$Directory, [string[]]$Arguments) {
    & git -C $Directory @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "git $($Arguments -join ' ') failed" }
}

function New-FakePsql {
    $Code = @'
using System;
using System.IO;
using System.Linq;
public static class FakePsql {
  public static int Main(string[] args) {
    var sql = "";
    for (var i = 0; i < args.Length - 1; i++) if (args[i] == "-f") sql = File.ReadAllText(args[i + 1]);
    var marker = "unknown";
    var token = "WMCHAT:";
    var at = sql.IndexOf(token, StringComparison.Ordinal);
    if (at >= 0) {
      var end = sql.IndexOf(" */", at, StringComparison.Ordinal);
      if (end > at) marker = sql.Substring(at + token.Length, end - at - token.Length);
    }
    var log = Environment.GetEnvironmentVariable("WMCHAT_TEST_LOG");
    if (!String.IsNullOrEmpty(log)) File.AppendAllText(log, marker + "|" +
      Environment.GetEnvironmentVariable("PGHOST") + "|" +
      Environment.GetEnvironmentVariable("PGSSLMODE") + "|" +
      Environment.GetEnvironmentVariable("PGHOSTADDR") + "|" +
      Environment.GetEnvironmentVariable("PGOPTIONS") + "|" +
      Environment.GetEnvironmentVariable("PGPASSFILE") + Environment.NewLine);
    var stateFile = Environment.GetEnvironmentVariable("WMCHAT_TEST_STATE_FILE");
    var state = File.Exists(stateFile) ? File.ReadAllText(stateFile).Trim() : "none";
    if (marker == "after-confirmation" && Environment.GetEnvironmentVariable("WMCHAT_TEST_DRIFT") == "1") state = "base";
    if (marker == "mutation") {
      if (sql.IndexOf("CAST(1/0", StringComparison.Ordinal) >= 0 ||
          sql.IndexOf("IF NOT pg_try_advisory_lock", StringComparison.Ordinal) < 0 ||
          sql.IndexOf("LOCK TABLE supabase_migrations.schema_migrations", StringComparison.Ordinal) < 0 ||
          sql.IndexOf("wmchat_contract_ok", StringComparison.Ordinal) < 0 ||
          sql.IndexOf("version:text:NO,statements:_text:YES,name:text:YES,created_by:text:YES,idempotency_key:text:YES,rollback:_text:YES", StringComparison.Ordinal) < 0 ||
          sql.IndexOf("rolbypassrls", StringComparison.Ordinal) < 0 ||
          sql.IndexOf("440b0c2521013e15bd6e02f9cf0f96d8", StringComparison.Ordinal) < 0) return 86;
      if (!String.IsNullOrEmpty(Environment.GetEnvironmentVariable("PGOPTIONS"))) return 87;
      if (Environment.GetEnvironmentVariable("WMCHAT_TEST_MUTATION_FAIL") == "1") return 9;
      File.WriteAllText(stateFile, "both");
      return 0;
    }
    if (sql.IndexOf("BEGIN READ ONLY", StringComparison.Ordinal) < 0 ||
        (Environment.GetEnvironmentVariable("PGOPTIONS") ?? "").IndexOf("default_transaction_read_only=on", StringComparison.Ordinal) < 0) return 88;
    if (marker == "after" && Environment.GetEnvironmentVariable("WMCHAT_TEST_POST_READ_FAIL") == "1") return 10;
    string baseMd5 = Environment.GetEnvironmentVariable("WMCHAT_TEST_BASE_MD5") ?? "";
    string grantMd5 = Environment.GetEnvironmentVariable("WMCHAT_TEST_GRANT_MD5") ?? "";
    string allowed = state == "both" ? "20260801143000|lead_consent_events|" + baseMd5 + ",20260816022737|grant_wmchat_consent_read_to_service_role|" + grantMd5 : (state == "base" || state == "base_select" || state == "base_no_bypass") ? "20260801143000|lead_consent_events|" + baseMd5 : "";
    bool baseInstalled = state == "base" || state == "base_select" || state == "base_no_bypass" || state == "both" || state == "later" || state == "drift";
    bool grantInstalled = state == "both" || state == "base_select";
    Console.WriteLine("ledger_columns=version:text:NO,statements:_text:YES,name:text:YES,created_by:text:YES,idempotency_key:text:YES,rollback:_text:YES");
    Console.WriteLine("untouched_count=" + (state == "later" ? "142" : "141"));
    Console.WriteLine("untouched_min=20260317051701");
    Console.WriteLine("untouched_max=" + (state == "later" ? "20260812220206" : "20260624120000"));
    Console.WriteLine("untouched_fingerprint=" + (state == "later" ? "badbadbadbadbadbadbadbadbadbadba" : "440b0c2521013e15bd6e02f9cf0f96d8"));
    Console.WriteLine("allowed_ledger=" + allowed);
    Console.WriteLine("table=" + (baseInstalled ? "present" : "missing"));
    Console.WriteLine("rpc=" + (baseInstalled ? "present" : "missing"));
    Console.WriteLine("rls=" + (baseInstalled ? "true" : "missing"));
    foreach (var key in new[]{"columns","constraints","indexes","rpc_properties","rpc_body","client_table_privileges","function_privileges"}) Console.WriteLine(key + "=" + (baseInstalled ? "true" : "missing"));
    Console.WriteLine("policies=" + (baseInstalled ? "0" : "missing"));
    Console.WriteLine("service_select=" + (baseInstalled ? (grantInstalled ? "true" : "false") : "missing"));
    Console.WriteLine("service_direct_writes=" + (baseInstalled ? (state == "base_direct_writes" ? "true" : "false") : "missing"));
    Console.WriteLine("service_bypassrls=" + (baseInstalled ? (state == "base_no_bypass" ? "false" : "true") : "missing"));
    return 0;
  }
}
'@
    $Path = Join-Path $TestRoot "psql.exe"
    Add-Type -TypeDefinition $Code -OutputAssembly $Path -OutputType ConsoleApplication
    return $Path
}

function New-Fixture {
    $Repo = Join-Path $TestRoot ("repo-" + [guid]::NewGuid())
    $Bare = Join-Path $TestRoot ("origin-" + [guid]::NewGuid() + ".git")
    New-Item -ItemType Directory -Path (Join-Path $Repo "scripts") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $Repo "supabase/migrations") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $Repo "supabase/.temp") -Force | Out-Null
    $FixtureScript = Join-Path $Repo "scripts/apply-wmchat-consent-live.ps1"
    Copy-Item $ScriptUnderTest $FixtureScript
    $FixtureSource = Get-Content -LiteralPath $FixtureScript -Raw
    $FixtureSource = $FixtureSource.Replace(
        '$ApprovedOriginUrl = "https://github.com/Mongoloyd/wm-mvp.git"',
        '$ApprovedOriginUrl = "' + $Bare + '"'
    )
    Set-Content -LiteralPath $FixtureScript -Value $FixtureSource -Encoding UTF8
    foreach ($File in @("20260801143000_lead_consent_events.sql","20260816022737_grant_wmchat_consent_read_to_service_role.sql")) {
        Copy-Item (Join-Path $SourceRoot "supabase/migrations/$File") (Join-Path $Repo "supabase/migrations/$File")
    }
    Set-Content (Join-Path $Repo ".gitignore") "supabase/.temp/"
    Set-Content (Join-Path $Repo "supabase/.temp/project-ref") $ApprovedRef
    & git init --bare $Bare | Out-Null
    & git init -b forensic_report_v2 $Repo | Out-Null
    Invoke-Git $Repo @("config","user.email","wmchat-tests@example.invalid") | Out-Null
    Invoke-Git $Repo @("config","user.name","WmChat Tests") | Out-Null
    Invoke-Git $Repo @("add",".") | Out-Null
    Invoke-Git $Repo @("commit","-m","fixture") | Out-Null
    Invoke-Git $Repo @("remote","add","origin",$Bare) | Out-Null
    Invoke-Git $Repo @("push","-u","origin","forensic_report_v2") | Out-Null
    $Commit = (& git -C $Repo rev-parse HEAD).Trim()
    Invoke-Git $Repo @("checkout","--detach",$Commit) | Out-Null
    return [pscustomobject]@{
        Repo = $Repo
        Script = Join-Path $Repo "scripts/apply-wmchat-consent-live.ps1"
        Commit = $Commit
        State = Join-Path ($Repo.Replace("repo-","state-")) "state.txt"
        Log = Join-Path $TestRoot ("psql-" + [guid]::NewGuid() + ".log")
        Ca = Join-Path $TestRoot ("ca-" + [guid]::NewGuid() + ".pem")
    }
}

$FakePsql = New-FakePsql
function Get-TextMd5([string]$Path) {
    $Text = Get-Content -LiteralPath $Path -Raw
    $Md5 = [System.Security.Cryptography.MD5]::Create()
    try {
        return ([System.BitConverter]::ToString($Md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text)))).Replace("-","").ToLowerInvariant()
    } finally { $Md5.Dispose() }
}
function Get-GitBlobTextMd5([string]$Blob) {
    $Temp = Join-Path $TestRoot ("blob-" + [guid]::NewGuid())
    try {
        $Process = Start-Process git -ArgumentList @("-C",$SourceRoot,"cat-file","blob",$Blob) -RedirectStandardOutput $Temp -NoNewWindow -Wait -PassThru
        if ($Process.ExitCode -ne 0) { throw "Unable to materialize test blob $Blob" }
        return Get-TextMd5 $Temp
    } finally { Remove-Item $Temp -Force -ErrorAction SilentlyContinue }
}
$BasePayloadMd5 = Get-GitBlobTextMd5 "2070d0e44ef1ac4d66e3e1d0f93fbfb554f35b16"
$GrantPayloadMd5 = Get-GitBlobTextMd5 "57815689795f1417ab9fb6e31a4f61f44a0368e3"

function Invoke-Runner {
    param(
        $Fixture,
        [string]$State = "none",
        [bool]$DryRun = $true,
        [string]$InputText = "",
        [string]$ProjectRef = $ApprovedRef,
        [string]$DatabaseUrl = "postgresql://postgres.${ApprovedRef}:test-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        [switch]$MutationFail,
        [switch]$RemoteDrift,
        [switch]$PostReadFail,
        [switch]$PoisonLibpq
    )
    New-Item -ItemType Directory -Path (Split-Path $Fixture.State -Parent) -Force | Out-Null
    Set-Content $Fixture.State $State
    Set-Content $Fixture.Ca "test-ca"
    Remove-Item $Fixture.Log -Force -ErrorAction SilentlyContinue
    $Old = @{}
    foreach ($Name in @("PATH","SUPABASE_PROJECT_REF","WMCHAT_LIVE_DATABASE_URL","WMCHAT_LIVE_PGSSLROOTCERT","WMCHAT_TEST_STATE_FILE","WMCHAT_TEST_LOG","WMCHAT_TEST_MUTATION_FAIL","WMCHAT_TEST_DRIFT","WMCHAT_TEST_POST_READ_FAIL","WMCHAT_TEST_BASE_MD5","WMCHAT_TEST_GRANT_MD5","PGHOSTADDR","PGSSLMODE","PGPASSFILE","PGCLIENTENCODING")) {
        $Old[$Name] = [Environment]::GetEnvironmentVariable($Name,"Process")
    }
    try {
        $env:SUPABASE_PROJECT_REF = $ProjectRef
        $env:WMCHAT_LIVE_DATABASE_URL = $DatabaseUrl
        $env:WMCHAT_LIVE_PGSSLROOTCERT = $Fixture.Ca
        $env:PATH = "$(Split-Path -Parent $FakePsql);$($env:PATH)"
        $env:WMCHAT_TEST_STATE_FILE = $Fixture.State
        $env:WMCHAT_TEST_LOG = $Fixture.Log
        $env:WMCHAT_TEST_MUTATION_FAIL = $(if ($MutationFail) { "1" } else { "0" })
        $env:WMCHAT_TEST_DRIFT = $(if ($RemoteDrift) { "1" } else { "0" })
        $env:WMCHAT_TEST_POST_READ_FAIL = $(if ($PostReadFail) { "1" } else { "0" })
        $env:WMCHAT_TEST_BASE_MD5 = $BasePayloadMd5
        $env:WMCHAT_TEST_GRANT_MD5 = $GrantPayloadMd5
        if ($PoisonLibpq) { $env:PGHOSTADDR="203.0.113.5"; $env:PGSSLMODE="disable"; $env:PGPASSFILE="C:\attacker\.pgpass" }
        $Args = @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Fixture.Script,"-ReleaseWorktree",$Fixture.Repo,"-ReleaseCommit",$Fixture.Commit)
        $EvidenceFile = Join-Path $TestRoot ("evidence-" + [guid]::NewGuid() + ".json")
        if ($DryRun) { $Args += "-DryRun" }
        else { $Args += @("-EvidencePath", $EvidenceFile) }
        $StdIn = Join-Path $TestRoot ("stdin-" + [guid]::NewGuid() + ".txt")
        $StdOut = Join-Path $TestRoot ("stdout-" + [guid]::NewGuid() + ".txt")
        $StdErr = Join-Path $TestRoot ("stderr-" + [guid]::NewGuid() + ".txt")
        Set-Content -LiteralPath $StdIn -Value $InputText -Encoding ASCII
        $Process = Start-Process -FilePath "powershell.exe" -ArgumentList $Args `
            -RedirectStandardInput $StdIn -RedirectStandardOutput $StdOut -RedirectStandardError $StdErr `
            -NoNewWindow -Wait -PassThru
        $Output = ((Get-Content $StdOut -Raw -ErrorAction SilentlyContinue) + (Get-Content $StdErr -Raw -ErrorAction SilentlyContinue))
        $Exit = $Process.ExitCode
        Remove-Item $StdIn,$StdOut,$StdErr -Force -ErrorAction SilentlyContinue
        $Log = if (Test-Path $Fixture.Log) { Get-Content $Fixture.Log } else { @() }
        return [pscustomobject]@{ ExitCode=$Exit; Output=$Output; Log=@($Log); State=(Get-Content $Fixture.State -Raw).Trim(); Evidence=$EvidenceFile }
    } finally {
        foreach ($Name in $Old.Keys) { [Environment]::SetEnvironmentVariable($Name,$Old[$Name],"Process") }
    }
}

try {
    Invoke-Test "dry run plans exactly two migrations and performs no mutation" {
        $F=New-Fixture; $R=Invoke-Runner $F
        Assert-True ($R.ExitCode -eq 0) "Exit $($R.ExitCode): $($R.Output)"
        Assert-Contains $R.Output "20260801143000, 20260816022737"
        Assert-Contains $R.Output "DRY RUN - NO MIGRATIONS APPLIED"
        Assert-Contains $R.Output '"result":  "DRY_RUN_VERIFIED"'
        Assert-Contains $R.Output '"completed_utc"'
        Assert-True (-not (($R.Log -join "`n").Contains("mutation"))) "Dry run invoked mutation."
    }
    Invoke-Test "base-only state safely resumes with grant only" {
        foreach($StateName in @("base","base_select")) {
            $F=New-Fixture; $R=Invoke-Runner $F -State $StateName
            Assert-True ($R.ExitCode -eq 0) "State $StateName exit $($R.ExitCode): $($R.Output)"
            Assert-Contains $R.Output "Missing migrations: 20260816022737"
        }
    }
    Invoke-Test "both-recorded state verifies and plans nothing" {
        $F=New-Fixture; $R=Invoke-Runner $F -State both
        Assert-True ($R.ExitCode -eq 0) "Exit $($R.ExitCode): $($R.Output)"
        Assert-Contains $R.Output "Missing migrations: (none)"
        Assert-Contains $R.Output '"result":  "DRY_RUN_VERIFIED"'

        $F2=New-Fixture; $R2=Invoke-Runner $F2 -State both -DryRun:$false
        Assert-True ($R2.ExitCode -eq 0) "Already-complete exit $($R2.ExitCode): $($R2.Output)"
        $Evidence=Get-Content -LiteralPath $R2.Evidence -Raw | ConvertFrom-Json
        Assert-True ($Evidence.result -ceq "VERIFIED") "Already-complete evidence was not terminal."
        Assert-True (-not [string]::IsNullOrWhiteSpace([string]$Evidence.completed_utc)) "Already-complete evidence omitted completion time."
        Assert-True (-not (($R2.Log -join "`n").Contains("mutation"))) "Already-complete run invoked mutation."
    }
    Invoke-Test "impossible later-migration and schema-without-ledger states fail closed" {
        foreach($StateName in @("later","drift","base_no_bypass")) {
            $F=New-Fixture; $R=Invoke-Runner $F -State $StateName
            Assert-True ($R.ExitCode -eq 41) "State $StateName exit $($R.ExitCode): $($R.Output)"
            Assert-True (-not (($R.Log -join "`n").Contains("mutation"))) "State $StateName mutated."
        }
    }
    Invoke-Test "wrong project target fails before psql" {
        $F=New-Fixture; $R=Invoke-Runner $F -ProjectRef "wrongprojectref"
        Assert-True ($R.ExitCode -eq 35) "Exit $($R.ExitCode): $($R.Output)"
        Assert-True ($R.Log.Count -eq 0) "Wrong target reached psql."
    }
    Invoke-Test "confirmation is exact and fail-closed" {
        $F=New-Fixture; $R=Invoke-Runner $F -DryRun:$false -InputText $ConfirmPhrase.ToLowerInvariant()
        Assert-True ($R.ExitCode -eq 43) "Exit $($R.ExitCode): $($R.Output)"
        Assert-True ($R.State -eq "none") "Wrong phrase mutated state."
    }
    Invoke-Test "exact confirmation applies once and verifies" {
        $F=New-Fixture; $R=Invoke-Runner $F -DryRun:$false -InputText $ConfirmPhrase
        Assert-True ($R.ExitCode -eq 0) $R.Output
        Assert-True ($R.State -eq "both") "Successful release did not reach both state."
        Assert-Contains $R.Output "installed and verified"
        Assert-True ((@($R.Log | Where-Object { $_ -like 'mutation|*' })).Count -eq 1) "Mutation count was not one."
        $Evidence=Get-Content -LiteralPath $R.Evidence -Raw | ConvertFrom-Json
        Assert-True ($Evidence.result -ceq "VERIFIED") "Final evidence was not atomically replaced with VERIFIED."
        $EvidenceName=[System.IO.Path]::GetFileName($R.Evidence)
        Assert-True ((@(Get-ChildItem -LiteralPath (Split-Path -Parent $R.Evidence) -Force | Where-Object { $_.Name -like ".$EvidenceName.*.tmp" -or $_.Name -like ".$EvidenceName.*.bak" })).Count -eq 0) "Atomic evidence left temporary files."
    }
    Invoke-Test "remote drift after confirmation prevents mutation" {
        $F=New-Fixture; $R=Invoke-Runner $F -DryRun:$false -InputText $ConfirmPhrase -RemoteDrift
        Assert-True ($R.ExitCode -eq 44) "Exit $($R.ExitCode): $($R.Output)"
        Assert-True (-not (($R.Log -join "`n").Contains("mutation"))) "Drift still mutated."
    }
    Invoke-Test "direct service-role writes fail the base contract" {
        $F=New-Fixture; $R=Invoke-Runner $F -State "base_direct_writes"
        Assert-True ($R.ExitCode -eq 41) "Exit $($R.ExitCode): $($R.Output)"
        Assert-True (-not (($R.Log -join "`n").Contains("mutation"))) "Invalid direct-write state mutated."
    }
    Invoke-Test "ambiguous mutation failure never retries" {
        $F=New-Fixture; $R=Invoke-Runner $F -DryRun:$false -InputText $ConfirmPhrase -MutationFail
        Assert-True ($R.ExitCode -eq 45) "Exit $($R.ExitCode): $($R.Output)"
        Assert-Contains $R.Output "UNKNOWN_REMOTE_STATE"
        Assert-True ((@($R.Log | Where-Object { $_ -like 'mutation|*' })).Count -eq 1) "Mutation was retried."
    }
    Invoke-Test "libpq environment is isolated and TLS is verify-full" {
        $F=New-Fixture; $R=Invoke-Runner $F -PoisonLibpq
        Assert-True ($R.ExitCode -eq 0) $R.Output
        foreach ($Line in $R.Log) {
            Assert-Contains $Line "aws-0-us-east-1.pooler.supabase.com|verify-full|"
            Assert-Contains $Line "default_transaction_read_only=on|"
            Assert-True (-not $Line.EndsWith("C:\attacker\.pgpass")) "PGPASSFILE leaked into child connection."
        }
    }
    Invoke-Test "strict target grammar rejects query strings, wrong database, and wrong usernames" {
        $BadUrls=@(
            "postgresql://postgres.${ApprovedRef}:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=disable",
            "postgresql://postgres.${ApprovedRef}:pw@aws-0-us-east-1.pooler.supabase.com:6543/other",
            "postgresql://postgres.wrong:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
            "postgresql://postgres.${ApprovedRef}:pw@db.${ApprovedRef}.supabase.co:5432/postgres"
        )
        foreach($Url in $BadUrls){
            $F=New-Fixture;$R=Invoke-Runner $F -DatabaseUrl $Url
            Assert-True ($R.ExitCode -eq 36) "Unsafe URL was accepted: $Url`n$($R.Output)"
            Assert-True ($R.Log.Count -eq 0) "Unsafe URL reached psql."
        }
    }
    Invoke-Test "post-mutation read uncertainty records UNKNOWN_REMOTE_STATE without retry" {
        $F=New-Fixture;$R=Invoke-Runner $F -DryRun:$false -InputText $ConfirmPhrase -PostReadFail
        Assert-True ($R.ExitCode -eq 45) "Exit $($R.ExitCode): $($R.Output)"
        Assert-Contains $R.Output "UNKNOWN_REMOTE_STATE"
        Assert-True ((@($R.Log|Where-Object{$_ -like 'mutation|*'})).Count -eq 1) "Mutation was retried."
        Assert-True (Test-Path -LiteralPath $R.Evidence) "Unknown-state evidence was not persisted."
        $Evidence=Get-Content -LiteralPath $R.Evidence -Raw
        Assert-Contains $Evidence '"result":  "UNKNOWN_REMOTE_STATE"'
        Assert-True (-not $Evidence.Contains("test-password")) "Evidence leaked database credentials."
    }
    Invoke-Test "dirty or attached release worktree is rejected" {
        $F=New-Fixture; Set-Content (Join-Path $F.Repo "untracked.txt") "dirty"
        $Dirty=Invoke-Runner $F
        Assert-True ($Dirty.ExitCode -eq 33) "Dirty exit $($Dirty.ExitCode): $($Dirty.Output)"
        Remove-Item (Join-Path $F.Repo "untracked.txt")
        Invoke-Git $F.Repo @("switch","forensic_report_v2") | Out-Null
        $Attached=Invoke-Runner $F
        Assert-True ($Attached.ExitCode -eq 33) "Attached exit $($Attached.ExitCode): $($Attached.Output)"
    }
    Invoke-Test "migration payload tampering fails before remote reads" {
        $F=New-Fixture; Add-Content (Join-Path $F.Repo "supabase/migrations/20260801143000_lead_consent_events.sql") "-- tamper"
        $R=Invoke-Runner $F
        Assert-True ($R.ExitCode -eq 33 -or $R.ExitCode -eq 38) "Exit $($R.ExitCode): $($R.Output)"
        Assert-True ($R.Log.Count -eq 0) "Tampered payload reached psql."
    }
    Invoke-Test "source contains a fixed two-migration allowlist and no broad mutation call" {
        $Source=Get-Content $ScriptUnderTest -Raw
        Assert-True (([regex]::Matches($Source,'file = "202608\d{8}_[^"]+\.sql"')).Count -eq 2) "Allowlist is not exactly two files."
        Assert-True (-not ($Source -match '(?m)^\s*&\s*supabase\s+(db push|migration up|migration repair)')) "Broad Supabase mutation found."
        Assert-True (-not $Source.Contains("Get-ChildItem")) "Runner dynamically discovers migrations."
        Assert-True (-not $Source.Contains("WMCHAT_MIGRATION_PSQL_TEST_OVERRIDE")) "Live-usable psql override remains."
        Assert-True (-not $Source.Contains("CAST(1/0")) "Constant-folding lock failure remains."
        foreach($Token in @("IF NOT pg_try_advisory_lock",'LOCK TABLE $LedgerTable IN SHARE ROW EXCLUSIVE MODE',"default_transaction_read_only=on","untouched_fingerprint","wmchat_contract_ok","service_bypassrls","DRY_RUN_VERIFIED","completed_utc","File]::Replace","UNKNOWN_REMOTE_STATE")) {
            Assert-Contains $Source $Token
        }
    }
} finally {
    Remove-Item $TestRoot -Recurse -Force -ErrorAction SilentlyContinue
}

if ($Failures -gt 0) { Write-Error "$Failures test(s) failed."; exit 1 }
Write-Host "All apply-wmchat-consent-live tests passed."
