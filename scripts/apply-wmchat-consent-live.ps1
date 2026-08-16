# Human-operated, fail-closed release runner for the two WmChat consent migrations.
# This file is intentionally narrow. It never discovers migrations and never runs Supabase db push,
# repair, reset, function deployment, secrets, type generation, or automatic rollback.
param(
    [switch]$DryRun,
    [Parameter(Mandatory = $true)][string]$ReleaseWorktree,
    [Parameter(Mandatory = $true)][string]$ReleaseCommit,
    [string]$EvidencePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
trap {
    Fail 99 "UNHANDLED_RUNNER_ERROR at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)"
}

$ApprovedRef = "zgsofkgddpcntdvpckdq"
$ApprovedRemoteBranch = "forensic_report_v2"
$ApprovedOriginUrl = "https://github.com/Mongoloyd/wm-mvp.git"
$ConfirmPhrase = "APPLY_WMCHAT_CONSENT_MIGRATIONS_TO_LIVE_ACTIVE"
$DatabaseUrlEnvName = "WMCHAT_LIVE_DATABASE_URL"
$SslRootCertEnvName = "WMCHAT_LIVE_PGSSLROOTCERT"
$LedgerTable = "supabase_migrations.schema_migrations"
$AdvisoryKey1 = 187992347
$AdvisoryKey2 = 20260816
$ScriptRelativePath = "scripts/apply-wmchat-consent-live.ps1"
$UntouchedLedgerCount = 141
$UntouchedLedgerMinVersion = "20260317051701"
$UntouchedLedgerMaxVersion = "20260624120000"
$UntouchedLedgerFingerprint = "440b0c2521013e15bd6e02f9cf0f96d8"
$ExpectedLedgerColumns = "version:text:NO,statements:_text:YES,name:text:YES,created_by:text:YES,idempotency_key:text:YES,rollback:_text:YES"
$LibpqIsolationEnvironmentNames = @(
    "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGOPTIONS",
    "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR", "PGPASSFILE", "PGREQUIREAUTH", "PGCHANNELBINDING",
    "PGSSLMODE", "PGREQUIRESSL", "PGSSLNEGOTIATION", "PGSSLCERT", "PGSSLKEY", "PGSSLROOTCERT", "PGCLIENTENCODING",
    "PGSSLCRL", "PGSSLCRLDIR", "PGSSLSNI", "PGTARGETSESSIONATTRS", "PGLOADBALANCEHOSTS"
)
$Migrations = @(
    [ordered]@{
        version = "20260801143000"
        name = "lead_consent_events"
        file = "20260801143000_lead_consent_events.sql"
        git_blob = "2070d0e44ef1ac4d66e3e1d0f93fbfb554f35b16"
        sha256 = "75010d850353fe2db69d77999fec981723f8f236f26b3299f71c9c0aab1ba7d3"
    },
    [ordered]@{
        version = "20260816022737"
        name = "grant_wmchat_consent_read_to_service_role"
        file = "20260816022737_grant_wmchat_consent_read_to_service_role.sql"
        git_blob = "57815689795f1417ab9fb6e31a4f61f44a0368e3"
        sha256 = "091146487f6563e4996e7e0bafff7e9852448670ddb4f6b28fe75bf70a7b5137"
    }
)

function Fail([int]$Code, [string]$Message) {
    if ((Get-Variable -Scope Script -Name MutationAttempted -ErrorAction SilentlyContinue) -and
        $script:MutationAttempted -and
        (Get-Variable -Scope Script -Name ReleaseEvidence -ErrorAction SilentlyContinue) -and
        $script:ReleaseEvidence -and
        (Get-Variable -Scope Script -Name ResolvedReleaseWorktree -ErrorAction SilentlyContinue)) {
        $script:MutationAttempted = $false
        $script:ReleaseEvidence.result = "UNKNOWN_REMOTE_STATE"
        $script:ReleaseEvidence.failure = "Post-mutation state could not be proven. No retry or rollback was attempted."
        $script:ReleaseEvidence.completed_utc = (Get-Date).ToUniversalTime().ToString("o")
        Write-Evidence $script:ReleaseEvidence $script:ResolvedReleaseWorktree
        [Console]::Error.WriteLine("ERROR: UNKNOWN_REMOTE_STATE: $Message")
        exit 45
    }
    [Console]::Error.WriteLine("ERROR: $Message")
    exit $Code
}

function Test-WithinRoot([string]$Root, [string]$Candidate) {
    $RootFull = ([System.IO.Path]::GetFullPath($Root)).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $CandidateFull = [System.IO.Path]::GetFullPath($Candidate)
    return $CandidateFull.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase)
}

function Invoke-GitText([string]$Worktree, [string[]]$Arguments, [string]$Failure) {
    $Output = (& git -C $Worktree @Arguments 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { Fail 31 $Failure }
    return $Output
}

function Write-Evidence($Evidence, [string]$Worktree) {
    $Json = $Evidence | ConvertTo-Json -Depth 10
    $Secret = [System.Environment]::GetEnvironmentVariable($DatabaseUrlEnvName)
    if (-not [string]::IsNullOrWhiteSpace($Secret) -and $Json.Contains($Secret)) {
        Fail 32 "Refusing to emit evidence containing database credentials."
    }
    Write-Host "=== REDACTED WMCHAT CONSENT RELEASE EVIDENCE ==="
    Write-Host $Json
    if ([string]::IsNullOrWhiteSpace($EvidencePath)) { return }
    $Full = [System.IO.Path]::GetFullPath($EvidencePath)
    $ExecutingRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    if ((Test-WithinRoot $Worktree $Full) -or (Test-WithinRoot $ExecutingRoot $Full)) {
        Fail 32 "EvidencePath must be outside every repository worktree."
    }
    $Parent = Split-Path -Parent $Full
    if ([string]::IsNullOrWhiteSpace($Parent) -or -not (Test-Path $Parent -PathType Container)) {
        Fail 32 "EvidencePath parent must already exist."
    }
    if ((Test-Path -LiteralPath $Full) -and
        ((Get-Item -LiteralPath $Full -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        Fail 32 "EvidencePath must not be a reparse point."
    }
    $TemporaryPath = Join-Path $Parent (".{0}.{1}.tmp" -f ([System.IO.Path]::GetFileName($Full)), [guid]::NewGuid())
    $BackupPath = Join-Path $Parent (".{0}.{1}.bak" -f ([System.IO.Path]::GetFileName($Full)), [guid]::NewGuid())
    try {
        [System.IO.File]::WriteAllText(
            $TemporaryPath,
            $Json,
            (New-Object System.Text.UTF8Encoding($false))
        )
        if (Test-Path -LiteralPath $Full) {
            [System.IO.File]::Replace($TemporaryPath, $Full, $BackupPath)
        } else {
            [System.IO.File]::Move($TemporaryPath, $Full)
        }
    } finally {
        Remove-Item -LiteralPath $TemporaryPath,$BackupPath -Force -ErrorAction SilentlyContinue
    }
}

function Assert-ReleaseWorktree {
    if ($ReleaseCommit -cnotmatch '^[0-9a-f]{40}$') { Fail 33 "ReleaseCommit must be an exact lowercase commit SHA." }
    if (-not (Test-Path -LiteralPath $ReleaseWorktree -PathType Container)) { Fail 33 "ReleaseWorktree does not exist." }
    $Worktree = (Resolve-Path -LiteralPath $ReleaseWorktree).Path
    $ExecutingRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    if (-not $Worktree.Equals($ExecutingRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 33 "Run this script from the exact ReleaseWorktree; cross-worktree execution is forbidden."
    }
    $Top = Invoke-GitText $Worktree @("rev-parse", "--show-toplevel") "Unable to resolve release worktree root."
    if (-not ((Resolve-Path -LiteralPath $Top).Path).Equals($Worktree, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 33 "ReleaseWorktree must be the exact Git root."
    }
    $Branch = Invoke-GitText $Worktree @("branch", "--show-current") "Unable to inspect branch state."
    if (-not [string]::IsNullOrWhiteSpace($Branch)) { Fail 33 "Release worktree must have detached HEAD." }
    $Head = Invoke-GitText $Worktree @("rev-parse", "HEAD") "Unable to inspect release HEAD."
    if ($Head -cne $ReleaseCommit) { Fail 33 "Release HEAD does not equal ReleaseCommit." }
    $Dirty = Invoke-GitText $Worktree @("status", "--porcelain=v1", "--untracked-files=all") "Unable to inspect worktree status."
    if (-not [string]::IsNullOrWhiteSpace($Dirty)) { Fail 33 "Release worktree must be completely clean." }
    $Registered = Invoke-GitText $Worktree @("worktree", "list", "--porcelain") "Unable to inspect registered worktrees."
    $Found = $false
    foreach ($Line in ($Registered -split "\r?\n")) {
        if ($Line.StartsWith("worktree ") -and
            ([System.IO.Path]::GetFullPath($Line.Substring(9))).Equals($Worktree, [System.StringComparison]::OrdinalIgnoreCase)) {
            $Found = $true
        }
    }
    if (-not $Found) { Fail 33 "Release worktree is not registered by Git." }
    $OriginUrl = Invoke-GitText $Worktree @("remote", "get-url", "origin") "Unable to resolve origin URL."
    if ($OriginUrl -cne $ApprovedOriginUrl) { Fail 34 "Origin must be exactly the approved WindowMan repository." }
    $CommonDir = Invoke-GitText $Worktree @("rev-parse", "--git-common-dir") "Unable to resolve common Git directory."
    $CommonDirFull = if ([System.IO.Path]::IsPathRooted($CommonDir)) {
        [System.IO.Path]::GetFullPath($CommonDir)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $Worktree $CommonDir))
    }
    if (-not (Test-Path -LiteralPath $CommonDirFull -PathType Container)) {
        Fail 34 "Release worktree common Git directory is missing."
    }
    & git -C $Worktree fetch --quiet origin $ApprovedRemoteBranch
    if ($LASTEXITCODE -ne 0) { Fail 34 "Unable to freshly fetch origin/$ApprovedRemoteBranch." }
    & git -C $Worktree merge-base --is-ancestor $ReleaseCommit "origin/$ApprovedRemoteBranch"
    if ($LASTEXITCODE -ne 0) { Fail 34 "ReleaseCommit is not contained in freshly fetched approved branch." }
    $CommittedScript = Invoke-GitText $Worktree @("rev-parse", "$ReleaseCommit`:$ScriptRelativePath") "Release commit does not contain this runner."
    $RunningScript = Invoke-GitText $Worktree @("hash-object", "--path=$ScriptRelativePath", "--", $PSCommandPath) "Unable to hash running script."
    if ($CommittedScript -cne $RunningScript) { Fail 34 "Running script differs from ReleaseCommit." }
    return $Worktree
}

function Assert-Target([string]$Worktree) {
    $ProjectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF.Trim() } else { "" }
    if ($ProjectRef -cne $ApprovedRef) { Fail 35 "SUPABASE_PROJECT_REF must be exactly LIVE_ACTIVE '$ApprovedRef'." }
    $LinkedPath = Join-Path $Worktree "supabase/.temp/project-ref"
    if (-not (Test-Path -LiteralPath $LinkedPath -PathType Leaf)) { Fail 35 "The release worktree is not explicitly linked to LIVE_ACTIVE." }
    if ((Get-Content -LiteralPath $LinkedPath -Raw).Trim() -cne $ApprovedRef) { Fail 35 "Linked project ref does not match LIVE_ACTIVE." }

    $UrlText = [System.Environment]::GetEnvironmentVariable($DatabaseUrlEnvName)
    if ([string]::IsNullOrWhiteSpace($UrlText)) { Fail 36 "$DatabaseUrlEnvName is required; never place it in source or command history." }
    $Match = [regex]::Match(
        $UrlText,
        '^(?<scheme>(?i:postgres(?:ql)?))://(?<userinfo>(?:[A-Za-z0-9._~!$&''()*+,;=:-]|%[0-9A-Fa-f]{2})+)@(?<host>[A-Za-z0-9.-]+)(?::(?<port>[1-9][0-9]{0,4}))?/postgres$'
    )
    if (-not $Match.Success) { Fail 36 "$DatabaseUrlEnvName is not a valid unambiguous PostgreSQL URI." }
    $Uri = $null
    if (-not [System.Uri]::TryCreate($UrlText, [System.UriKind]::Absolute, [ref]$Uri)) {
        Fail 36 "$DatabaseUrlEnvName is not a valid PostgreSQL URI."
    }
    if (-not [string]::IsNullOrEmpty($Uri.Query) -or -not [string]::IsNullOrEmpty($Uri.Fragment) -or
        $Uri.AbsolutePath -cne "/postgres" -or $Uri.HostNameType -ne [System.UriHostNameType]::Dns) {
        Fail 36 "$DatabaseUrlEnvName must name only the approved postgres database endpoint."
    }
    $RawUserInfo = $Match.Groups["userinfo"].Value
    $Separator = $RawUserInfo.IndexOf(':')
    if ($Separator -le 0 -or $Separator -ge ($RawUserInfo.Length - 1)) {
        Fail 36 "$DatabaseUrlEnvName must contain explicit non-empty user/password credentials."
    }
    try {
        $RawUsername = $RawUserInfo.Substring(0, $Separator)
        $Username = [uri]::UnescapeDataString($RawUsername)
        $Password = [uri]::UnescapeDataString($RawUserInfo.Substring($Separator + 1))
        $HostName = $Match.Groups["host"].Value.ToLowerInvariant()
    } catch { Fail 36 "$DatabaseUrlEnvName contains malformed endpoint or credential encoding." }
    if ([string]::IsNullOrEmpty($Password) -or
        -not $Uri.Host.Equals($HostName, [System.StringComparison]::OrdinalIgnoreCase)) {
        Fail 36 "$DatabaseUrlEnvName contains ambiguous credentials or host data."
    }
    $Port = if ($Match.Groups["port"].Success) { [int]$Match.Groups["port"].Value } else { 5432 }
    if ($Port -lt 1 -or $Port -gt 65535) { Fail 36 "$DatabaseUrlEnvName contains an invalid port." }
    $DirectHost = "db.$ApprovedRef.supabase.co"
    $PoolerPattern = '^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pooler\.supabase\.com$'
    if ($HostName -ceq $DirectHost) {
        if ($RawUsername -cne "postgres" -or $Username -cne "postgres") {
            Fail 36 "Direct LIVE_ACTIVE connections require the exact postgres username."
        }
    } elseif ($HostName -cmatch $PoolerPattern) {
        if ($Username -cne "postgres.$ApprovedRef") {
            Fail 36 "Pooler username does not prove the approved project ref."
        }
    } else { Fail 36 "Database host is not an approved LIVE_ACTIVE endpoint." }

    $Ca = [System.Environment]::GetEnvironmentVariable($SslRootCertEnvName)
    if ([string]::IsNullOrWhiteSpace($Ca) -or -not (Test-Path -LiteralPath $Ca -PathType Leaf)) {
        Fail 37 "$SslRootCertEnvName must name an operator-supplied CA file."
    }
    if (-not [System.IO.Path]::IsPathRooted($Ca)) { Fail 37 "$SslRootCertEnvName must be an absolute CA path." }
    return [pscustomobject]@{
        Host = $HostName; Port = $Port; Database = "postgres"; Username = $Username; Password = $Password
        SslRootCert = (Resolve-Path -LiteralPath $Ca).Path
    }
}

function Assert-MigrationPayloads([string]$Worktree, [string]$MaterializedDirectory) {
    $Facts = @()
    foreach ($Migration in $Migrations) {
        $Relative = "supabase/migrations/$($Migration.file)"
        $Path = Join-Path $Worktree $Relative
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Fail 38 "Missing allowlisted migration '$Relative'." }
        $CommittedBlob = Invoke-GitText $Worktree @("rev-parse", "$ReleaseCommit`:$Relative") "Migration is absent from ReleaseCommit."
        if ($CommittedBlob -cne $Migration.git_blob) { Fail 38 "Migration Git blob pin mismatch: $Relative." }
        $MaterializedPath = Join-Path $MaterializedDirectory $Migration.file
        $Process = Start-Process -FilePath "git" -ArgumentList @("-C", $Worktree, "cat-file", "blob", $CommittedBlob) `
            -RedirectStandardOutput $MaterializedPath -NoNewWindow -Wait -PassThru
        if ($Process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $MaterializedPath -PathType Leaf)) {
            Fail 38 "Unable to materialize immutable migration payload: $Relative."
        }
        $Sha = (Get-FileHash -LiteralPath $MaterializedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Sha -cne $Migration.sha256) { Fail 38 "Migration SHA-256 pin mismatch: $Relative." }
        $PayloadText = Get-Content -LiteralPath $MaterializedPath -Raw
        $Md5 = [System.Security.Cryptography.MD5]::Create()
        try {
            $PayloadMd5 = ([System.BitConverter]::ToString(
                $Md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($PayloadText))
            )).Replace("-", "").ToLowerInvariant()
        } finally { $Md5.Dispose() }
        $Facts += [ordered]@{
            version = $Migration.version; file = $Migration.file; git_blob = $CommittedBlob
            sha256 = $Sha; payload_md5 = $PayloadMd5; materialized_path = $MaterializedPath
        }
    }
    return $Facts
}

function Resolve-Psql {
    $Command = Get-Command psql -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $Command) { Fail 39 "A real psql executable is required." }
    return $Command.Source
}

function Set-IsolatedLibpqEnvironment($Connection) {
    foreach ($Name in $LibpqIsolationEnvironmentNames) {
        [System.Environment]::SetEnvironmentVariable($Name, $null, "Process")
    }
    [System.Environment]::SetEnvironmentVariable("PGHOST", $Connection.Host, "Process")
    [System.Environment]::SetEnvironmentVariable("PGPORT", [string]$Connection.Port, "Process")
    [System.Environment]::SetEnvironmentVariable("PGDATABASE", $Connection.Database, "Process")
    [System.Environment]::SetEnvironmentVariable("PGUSER", $Connection.Username, "Process")
    [System.Environment]::SetEnvironmentVariable("PGPASSWORD", $Connection.Password, "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLMODE", "verify-full", "Process")
    [System.Environment]::SetEnvironmentVariable("PGSSLROOTCERT", $Connection.SslRootCert, "Process")
    [System.Environment]::SetEnvironmentVariable("PGCLIENTENCODING", "UTF8", "Process")
    [System.Environment]::SetEnvironmentVariable("PGAPPNAME", "wmchat-consent-release", "Process")
}

function Invoke-Psql([string]$Psql, [string]$Sql, [string]$Marker, [bool]$ReadOnly = $true) {
    $Out = [System.IO.Path]::GetTempFileName(); $Err = [System.IO.Path]::GetTempFileName()
    $SqlFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.Environment]::SetEnvironmentVariable(
            "PGOPTIONS",
            $(if ($ReadOnly) { "-c default_transaction_read_only=on" } else { "" }),
            "Process"
        )
        $MarkedSql = "/* WMCHAT:$Marker */`n$Sql"
        Set-Content -LiteralPath $SqlFile -Value $MarkedSql -Encoding utf8NoBOM
        $Process = Start-Process -FilePath $Psql -ArgumentList @("-X", "-v", "ON_ERROR_STOP=1", "-qAt", "-f", $SqlFile) `
            -RedirectStandardOutput $Out -RedirectStandardError $Err -NoNewWindow -Wait -PassThru
        [string]$StdoutText = Get-Content $Out -Raw -ErrorAction SilentlyContinue
        [string]$StderrText = Get-Content $Err -Raw -ErrorAction SilentlyContinue
        if ($null -eq $StdoutText) { $StdoutText = "" }
        if ($null -eq $StderrText) { $StderrText = "" }
        return [pscustomobject]@{
            ExitCode = $Process.ExitCode
            Stdout = $StdoutText.Replace("`r`n", "`n").Trim()
            Stderr = $StderrText.Replace("`r`n", "`n").Trim()
        }
    } finally { Remove-Item $Out,$Err,$SqlFile -Force -ErrorAction SilentlyContinue }
}

function Get-RemoteState([string]$Psql, [string]$Marker) {
    $Sql = @"
BEGIN READ ONLY;
SELECT 'ledger_columns=' || COALESCE(string_agg(
  column_name || ':' || udt_name || ':' || is_nullable,
  ',' ORDER BY ordinal_position
), '') FROM information_schema.columns
WHERE table_schema='supabase_migrations' AND table_name='schema_migrations';
SELECT 'untouched_count=' || count(*)::text FROM $LedgerTable
WHERE version NOT IN ('20260801143000','20260816022737');
SELECT 'untouched_min=' || COALESCE(min(version),'') FROM $LedgerTable
WHERE version NOT IN ('20260801143000','20260816022737');
SELECT 'untouched_max=' || COALESCE(max(version),'') FROM $LedgerTable
WHERE version NOT IN ('20260801143000','20260816022737');
SELECT 'untouched_fingerprint=' || COALESCE(md5(string_agg(
  version || ':' || COALESCE(name,'') || ':' || COALESCE(array_to_string(statements,E'\n'),''),
  E'\n' ORDER BY version
)), '') FROM $LedgerTable
WHERE version NOT IN ('20260801143000','20260816022737');
SELECT 'allowed_ledger=' || COALESCE(string_agg(
  version || '|' || COALESCE(name,'') || '|' || md5(COALESCE(array_to_string(statements,E'\n'),'')),
  ',' ORDER BY version
), '') FROM $LedgerTable WHERE version IN ('20260801143000','20260816022737');
SELECT 'table=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE 'present' END;
SELECT 'rpc=' || CASE WHEN to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') IS NULL THEN 'missing' ELSE 'present' END;
SELECT 'rls=' || COALESCE((SELECT relrowsecurity::text FROM pg_class WHERE oid=to_regclass('public.lead_consent_events')), 'missing');
SELECT 'columns=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE (
  (SELECT count(*)=13 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='id' AND udt_name='uuid' AND is_nullable='NO' AND column_default LIKE '%gen_random_uuid%')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='lead_id' AND udt_name='uuid' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='session_id' AND udt_name='text' AND is_nullable='YES')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='submission_id' AND udt_name='uuid' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='purpose' AND udt_name='text' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='decision' AND udt_name='text' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='consent_schema_version' AND udt_name='text' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='privacy_policy_version' AND udt_name='text' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='terms_version' AND udt_name='text' AND is_nullable='YES')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='disclosure_version' AND udt_name='text' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='source' AND udt_name='text' AND is_nullable='NO')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='metadata' AND udt_name='jsonb' AND is_nullable='NO' AND column_default LIKE '%{}%jsonb%')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='created_at' AND udt_name='timestamptz' AND is_nullable='NO' AND column_default='now()')
)::text END;
SELECT 'constraints=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE (
  (SELECT count(*)=5 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events'))
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_pkey' AND contype='p' AND pg_get_constraintdef(oid,true)='PRIMARY KEY (id)')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_lead_id_fkey' AND contype='f' AND pg_get_constraintdef(oid,true) LIKE 'FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE%')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_purpose_check' AND contype='c' AND pg_get_constraintdef(oid,true) LIKE '%service_communications%' AND pg_get_constraintdef(oid,true) LIKE '%marketing_communications%' AND pg_get_constraintdef(oid,true) LIKE '%contractor_sharing%')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_decision_check' AND contype='c' AND pg_get_constraintdef(oid,true) LIKE '%granted%' AND pg_get_constraintdef(oid,true) LIKE '%declined%' AND pg_get_constraintdef(oid,true) LIKE '%withdrawn%')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_lead_id_submission_id_purpose_key' AND contype='u' AND pg_get_constraintdef(oid,true)='UNIQUE (lead_id, submission_id, purpose)')
)::text END;
SELECT 'indexes=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE (
  (SELECT count(*)=3 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname IN ('idx_lead_consent_events_lead_id','idx_lead_consent_events_purpose','idx_lead_consent_events_created_at'))
  AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname='idx_lead_consent_events_lead_id' AND i.indkey::text='2' AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL)
  AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname='idx_lead_consent_events_purpose' AND i.indkey::text='5' AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL)
  AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname='idx_lead_consent_events_created_at' AND i.indkey::text='13' AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL)
)::text END;
SELECT 'policies=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE (SELECT count(*)::text FROM pg_policy WHERE polrelid=to_regclass('public.lead_consent_events')) END;
SELECT 'rpc_properties=' || CASE WHEN to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') IS NULL THEN 'missing' ELSE (
  SELECT (p.prosecdef AND p.prorettype='void'::regtype AND p.prokind='f' AND 'search_path=""'=ANY(COALESCE(p.proconfig,ARRAY[]::text[])))::text
  FROM pg_proc p WHERE p.oid=to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)')
) END;
SELECT 'rpc_body=' || CASE WHEN to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') IS NULL THEN 'missing' ELSE (
  SELECT (p.prosrc LIKE '%consent_submission_conflict%' AND p.prosrc LIKE '%ON CONFLICT (lead_id, submission_id, purpose) DO NOTHING%' AND p.prosrc LIKE '%jsonb_to_recordset%')::text
  FROM pg_proc p WHERE p.oid=to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)')
) END;
SELECT 'client_table_privileges=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE (NOT (
  has_table_privilege('anon',to_regclass('public.lead_consent_events'),'SELECT') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'INSERT') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'UPDATE') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'DELETE') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'TRUNCATE') OR
  has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'SELECT') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'INSERT') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'UPDATE') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'DELETE') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'TRUNCATE') OR
  EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=to_regclass('public.lead_consent_events') AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE'))
))::text END;
SELECT 'service_select=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'SELECT')::text END;
SELECT 'service_direct_writes=' || CASE WHEN to_regclass('public.lead_consent_events') IS NULL THEN 'missing' ELSE (
  has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'INSERT') OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'UPDATE') OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'DELETE') OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'TRUNCATE')
)::text END;
SELECT 'service_bypassrls=' || COALESCE((
  SELECT rolbypassrls::text FROM pg_roles WHERE rolname='service_role'
), 'missing');
SELECT 'function_privileges=' || CASE WHEN to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') IS NULL THEN 'missing' ELSE (
  has_function_privilege('service_role',to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'),'EXECUTE') AND
  NOT has_function_privilege('anon',to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'),'EXECUTE') AND
  NOT has_function_privilege('authenticated',to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'),'EXECUTE') AND
  NOT EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') AND a.grantee=0 AND a.privilege_type='EXECUTE')
)::text END;
ROLLBACK;
"@
    $Result = Invoke-Psql $Psql $Sql $Marker
    if ($Result.ExitCode -ne 0) { Fail 40 "Read-only remote contract check failed before any authorized mutation (psql exit $($Result.ExitCode))." }
    $State = @{}
    foreach ($Line in ($Result.Stdout -split "\n")) {
        if ($Line -notmatch '^(?<key>[a-z_]+)=(?<value>.*)$') { Fail 40 "Malformed remote contract output." }
        $State[$Matches.key] = $Matches.value
    }
    foreach ($Key in @(
        "ledger_columns","untouched_count","untouched_min","untouched_max","untouched_fingerprint","allowed_ledger",
        "table","rpc","rls","columns","constraints","indexes","policies","rpc_properties","rpc_body",
        "client_table_privileges","service_select","service_direct_writes","service_bypassrls","function_privileges"
    )) {
        if (-not $State.ContainsKey($Key)) { Fail 40 "Remote contract output omitted '$Key'." }
    }
    return $State
}

function Get-Plan($State, $MigrationFacts) {
    if ($State.ledger_columns -cne $ExpectedLedgerColumns -or
        [int]$State.untouched_count -ne $UntouchedLedgerCount -or
        $State.untouched_min -cne $UntouchedLedgerMinVersion -or
        $State.untouched_max -cne $UntouchedLedgerMaxVersion -or
        $State.untouched_fingerprint -cne $UntouchedLedgerFingerprint) {
        Fail 41 "The full untouched LIVE_ACTIVE migration ledger fingerprint changed; manual reconciliation required."
    }
    $ExpectedRows = @{}
    foreach ($Migration in $Migrations) {
        $Fact = @($MigrationFacts | Where-Object { $_.version -eq $Migration.version })[0]
        $ExpectedRows[$Migration.version] = "$($Migration.version)|$($Migration.name)|$($Fact.payload_md5)"
    }
    $Recorded = @()
    foreach ($Row in @($State.allowed_ledger -split ',' | Where-Object { $_ })) {
        if ($Row -notmatch '^(?<version>\d{14})\|[a-z0-9_]+\|[0-9a-f]{32}$' -or
            -not $ExpectedRows.ContainsKey($Matches.version) -or $Row -cne $ExpectedRows[$Matches.version]) {
            Fail 41 "An allowlisted migration ledger row is malformed or does not match its immutable payload."
        }
        $Recorded += $Matches.version
    }
    $Base = $Recorded -contains "20260801143000"
    $Grant = $Recorded -contains "20260816022737"
    if ($Grant -and -not $Base) { Fail 41 "Remote ledger has the grant without its base migration." }
    if (-not $Base) {
        if ($State.table -ne "missing" -or $State.rpc -ne "missing" -or $State.indexes -ne "missing") { Fail 41 "Schema exists without the base ledger row; manual reconciliation required." }
        return @($Migrations)
    }
    $BaseContract = $State.table -eq "present" -and $State.rls -eq "true" -and $State.rpc -eq "present" -and
        $State.columns -eq "true" -and $State.indexes -eq "true" -and $State.constraints -eq "true" -and
        $State.policies -eq "0" -and $State.rpc_properties -eq "true" -and $State.rpc_body -eq "true" -and
        $State.client_table_privileges -eq "true" -and $State.service_bypassrls -eq "true" -and
        $State.service_direct_writes -eq "false" -and
        $State.function_privileges -eq "true"
    if (-not $BaseContract) { Fail 41 "Recorded base migration does not match its fail-closed contract." }
    if (-not $Grant) { return @($Migrations[1]) }
    if ($State.service_select -ne "true") { Fail 41 "Recorded grant migration is missing service-role SELECT." }
    return @()
}

function Get-WmChatContractPredicateSql {
    return @'
to_regclass('public.lead_consent_events') IS NOT NULL
AND COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.lead_consent_events')),false)
AND (SELECT count(*)=13 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='id' AND udt_name='uuid' AND is_nullable='NO' AND column_default LIKE '%gen_random_uuid%')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='lead_id' AND udt_name='uuid' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='session_id' AND udt_name='text' AND is_nullable='YES')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='submission_id' AND udt_name='uuid' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='purpose' AND udt_name='text' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='decision' AND udt_name='text' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='consent_schema_version' AND udt_name='text' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='privacy_policy_version' AND udt_name='text' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='terms_version' AND udt_name='text' AND is_nullable='YES')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='disclosure_version' AND udt_name='text' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='source' AND udt_name='text' AND is_nullable='NO')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='metadata' AND udt_name='jsonb' AND is_nullable='NO' AND column_default LIKE '%{}%jsonb%')
AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lead_consent_events' AND column_name='created_at' AND udt_name='timestamptz' AND is_nullable='NO' AND column_default='now()')
AND (SELECT count(*)=5 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events'))
AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_pkey' AND contype='p' AND pg_get_constraintdef(oid,true)='PRIMARY KEY (id)')
AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_lead_id_fkey' AND contype='f' AND pg_get_constraintdef(oid,true) LIKE 'FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE%')
AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_purpose_check' AND contype='c' AND pg_get_constraintdef(oid,true) LIKE '%service_communications%' AND pg_get_constraintdef(oid,true) LIKE '%marketing_communications%' AND pg_get_constraintdef(oid,true) LIKE '%contractor_sharing%')
AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_decision_check' AND contype='c' AND pg_get_constraintdef(oid,true) LIKE '%granted%' AND pg_get_constraintdef(oid,true) LIKE '%declined%' AND pg_get_constraintdef(oid,true) LIKE '%withdrawn%')
AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.lead_consent_events') AND conname='lead_consent_events_lead_id_submission_id_purpose_key' AND contype='u' AND pg_get_constraintdef(oid,true)='UNIQUE (lead_id, submission_id, purpose)')
AND (SELECT count(*)=3 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname IN ('idx_lead_consent_events_lead_id','idx_lead_consent_events_purpose','idx_lead_consent_events_created_at'))
AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname='idx_lead_consent_events_lead_id' AND i.indkey::text='2' AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL)
AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname='idx_lead_consent_events_purpose' AND i.indkey::text='5' AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL)
AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid WHERE i.indrelid=to_regclass('public.lead_consent_events') AND x.relname='idx_lead_consent_events_created_at' AND i.indkey::text='13' AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL)
AND NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('public.lead_consent_events'))
AND to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') IS NOT NULL
AND (SELECT p.prosecdef AND p.prorettype='void'::regtype AND p.prokind='f' AND 'search_path=""'=ANY(COALESCE(p.proconfig,ARRAY[]::text[])) AND p.prosrc LIKE '%consent_submission_conflict%' AND p.prosrc LIKE '%ON CONFLICT (lead_id, submission_id, purpose) DO NOTHING%' AND p.prosrc LIKE '%jsonb_to_recordset%' FROM pg_proc p WHERE p.oid=to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'))
AND NOT (has_table_privilege('anon',to_regclass('public.lead_consent_events'),'SELECT') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'INSERT') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'UPDATE') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'DELETE') OR has_table_privilege('anon',to_regclass('public.lead_consent_events'),'TRUNCATE'))
AND NOT (has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'SELECT') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'INSERT') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'UPDATE') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'DELETE') OR has_table_privilege('authenticated',to_regclass('public.lead_consent_events'),'TRUNCATE'))
AND NOT EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=to_regclass('public.lead_consent_events') AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE'))
AND has_function_privilege('service_role',to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'),'EXECUTE')
AND NOT has_function_privilege('anon',to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'),'EXECUTE')
AND NOT has_function_privilege('authenticated',to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)'),'EXECUTE')
AND NOT EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') AND a.grantee=0 AND a.privilege_type='EXECUTE')
AND COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role'),false)
AND NOT (has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'INSERT')
  OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'UPDATE')
  OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'DELETE')
  OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'TRUNCATE'))
'@
}

function New-MutationSql($Plan, $BeforeState, $MigrationFacts) {
    $ExpectedAllowedBefore = $BeforeState.allowed_ledger
    if ($ExpectedAllowedBefore -notmatch '^(?:|20260801143000\|[a-z0-9_]+\|[0-9a-f]{32})$') {
        Fail 42 "Unable to safely quote pre-mutation ledger state."
    }
    $ExpectedRows = @()
    foreach ($Migration in $Migrations) {
        $Fact = @($MigrationFacts | Where-Object { $_.version -eq $Migration.version })[0]
        $ExpectedRows += "$($Migration.version)|$($Migration.name)|$($Fact.payload_md5)"
    }
    $ExpectedAllowedAfter = $ExpectedRows -join ','
    $ContractPredicate = Get-WmChatContractPredicateSql
    $Parts = New-Object System.Collections.Generic.List[string]
    [void]$Parts.Add("BEGIN;")
    [void]$Parts.Add("DO `$wm_lock`$ BEGIN IF NOT pg_try_advisory_lock($AdvisoryKey1,$AdvisoryKey2) THEN RAISE EXCEPTION 'WMCHAT_RELEASE_ALREADY_RUNNING'; END IF; END `$wm_lock`$;")
    [void]$Parts.Add("LOCK TABLE $LedgerTable IN SHARE ROW EXCLUSIVE MODE;")
    [void]$Parts.Add(@"
CREATE OR REPLACE FUNCTION pg_temp.wmchat_contract_ok(expect_service_select boolean)
RETURNS boolean LANGUAGE sql AS `$wm_contract`$
SELECT ($ContractPredicate)
AND (expect_service_select IS NULL OR has_table_privilege('service_role',to_regclass('public.lead_consent_events'),'SELECT') = expect_service_select);
`$wm_contract`$;
DO `$wm_pre`$
DECLARE v_allowed text; v_count bigint; v_min text; v_max text; v_fingerprint text; v_ledger_columns text;
BEGIN
  SELECT COALESCE(string_agg(column_name || ':' || udt_name || ':' || is_nullable,',' ORDER BY ordinal_position),'')
  INTO v_ledger_columns FROM information_schema.columns
  WHERE table_schema='supabase_migrations' AND table_name='schema_migrations';
  SELECT count(*), min(version), max(version), md5(string_agg(version || ':' || COALESCE(name,'') || ':' || COALESCE(array_to_string(statements,E'\n'),''), E'\n' ORDER BY version))
  INTO v_count,v_min,v_max,v_fingerprint FROM $LedgerTable WHERE version NOT IN ('20260801143000','20260816022737');
  SELECT COALESCE(string_agg(version || '|' || COALESCE(name,'') || '|' || md5(COALESCE(array_to_string(statements,E'\n'),'')),',' ORDER BY version),'')
  INTO v_allowed FROM $LedgerTable WHERE version IN ('20260801143000','20260816022737');
  IF v_ledger_columns <> '$ExpectedLedgerColumns' OR v_count <> $UntouchedLedgerCount OR v_min <> '$UntouchedLedgerMinVersion' OR v_max <> '$UntouchedLedgerMaxVersion' OR v_fingerprint <> '$UntouchedLedgerFingerprint' OR v_allowed <> '$ExpectedAllowedBefore' THEN
    RAISE EXCEPTION 'REMOTE_STATE_CHANGED_AFTER_CONFIRMATION';
  END IF;
  IF '$($BeforeState.table)' = 'missing' THEN
    IF to_regclass('public.lead_consent_events') IS NOT NULL OR to_regprocedure('public.persist_lead_consent_batch(uuid,text,uuid,text,text,text,text,jsonb)') IS NOT NULL OR to_regclass('public.idx_lead_consent_events_lead_id') IS NOT NULL OR to_regclass('public.idx_lead_consent_events_purpose') IS NOT NULL OR to_regclass('public.idx_lead_consent_events_created_at') IS NOT NULL THEN
      RAISE EXCEPTION 'REMOTE_SCHEMA_CHANGED_AFTER_CONFIRMATION';
    END IF;
  ELSIF NOT pg_temp.wmchat_contract_ok($($BeforeState.service_select)) THEN
    RAISE EXCEPTION 'REMOTE_CONTRACT_CHANGED_AFTER_CONFIRMATION';
  END IF;
END `$wm_pre`$;
"@)
    foreach ($Migration in $Plan) {
        $Fact = @($MigrationFacts | Where-Object { $_.version -eq $Migration.version })[0]
        $Content = Get-Content -LiteralPath $Fact.materialized_path -Raw
        $Tag = "wmchat_$($Migration.version)"
        if ($Content.Contains("`$$Tag`$")) { Fail 42 "Unable to safely quote migration payload." }
        [void]$Parts.Add($Content)
        $ExpectedSelect = if ($Migration.version -eq "20260816022737") { "true" } else { "NULL" }
        [void]$Parts.Add("DO `$wm_step`$ BEGIN IF NOT pg_temp.wmchat_contract_ok($ExpectedSelect) THEN RAISE EXCEPTION 'WMCHAT_CONSENT_CONTRACT_INCOMPLETE_$($Migration.version)'; END IF; END `$wm_step`$;")
        [void]$Parts.Add("INSERT INTO $LedgerTable (version,name,statements) VALUES ('$($Migration.version)','$($Migration.name)',ARRAY[`$$Tag`$$Content`$$Tag`$]::text[]);")
    }
    [void]$Parts.Add(@"
DO `$wm_final`$
DECLARE v_allowed text; v_count bigint; v_fingerprint text;
BEGIN
  SELECT count(*), md5(string_agg(version || ':' || COALESCE(name,'') || ':' || COALESCE(array_to_string(statements,E'\n'),''), E'\n' ORDER BY version))
  INTO v_count,v_fingerprint FROM $LedgerTable WHERE version NOT IN ('20260801143000','20260816022737');
  SELECT COALESCE(string_agg(version || '|' || COALESCE(name,'') || '|' || md5(COALESCE(array_to_string(statements,E'\n'),'')),',' ORDER BY version),'')
  INTO v_allowed FROM $LedgerTable WHERE version IN ('20260801143000','20260816022737');
  IF v_count <> $UntouchedLedgerCount OR v_fingerprint <> '$UntouchedLedgerFingerprint' OR v_allowed <> '$ExpectedAllowedAfter' OR
     (SELECT count(*) FROM $LedgerTable WHERE version='20260801143000') <> 1 OR
     (SELECT count(*) FROM $LedgerTable WHERE version='20260816022737') <> 1 OR
     NOT pg_temp.wmchat_contract_ok(true) THEN
    RAISE EXCEPTION 'WMCHAT_FINAL_CONTRACT_OR_LEDGER_INVALID';
  END IF;
END `$wm_final`$;
"@)
    [void]$Parts.Add("COMMIT;")
    [void]$Parts.Add("SELECT pg_advisory_unlock($AdvisoryKey1,$AdvisoryKey2);")
    return ($Parts -join "`n")
}

$MaterializedDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("wmchat-consent-payload-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $MaterializedDirectory | Out-Null
$script:MutationAttempted = $false
$script:ReleaseEvidence = $null
$script:ResolvedReleaseWorktree = $null
try {
$Worktree = Assert-ReleaseWorktree
$script:ResolvedReleaseWorktree = $Worktree
$Connection = Assert-Target $Worktree
$MigrationFacts = Assert-MigrationPayloads $Worktree $MaterializedDirectory
$Psql = Resolve-Psql
Set-IsolatedLibpqEnvironment $Connection
$Before = Get-RemoteState $Psql "before"
$Plan = @(Get-Plan $Before $MigrationFacts)
$Evidence = [ordered]@{
    result = $(if ($DryRun) { "DRY_RUN_VERIFIED" } elseif ($Plan.Count -eq 0) { "VERIFIED" } else { "PREPARED" })
    project_ref = $ApprovedRef
    release_commit = $ReleaseCommit
    detached_clean_registered_worktree = $true
    tls = "verify-full"
        migrations = @($MigrationFacts | ForEach-Object { [ordered]@{ version=$_.version; file=$_.file; git_blob=$_.git_blob; sha256=$_.sha256 } })
    untouched_ledger_before = [ordered]@{
        count = [int]$Before.untouched_count; min = $Before.untouched_min; max = $Before.untouched_max
        fingerprint = $Before.untouched_fingerprint
    }
    allowlisted_ledger_before = $Before.allowed_ledger
    contract_before = [ordered]@{
        table=$Before.table; rpc=$Before.rpc; rls=$Before.rls; columns=$Before.columns
        constraints=$Before.constraints; indexes=$Before.indexes; policies=$Before.policies
        rpc_properties=$Before.rpc_properties; rpc_body=$Before.rpc_body
        client_table_privileges=$Before.client_table_privileges; service_select=$Before.service_select
        service_direct_writes=$Before.service_direct_writes; service_bypassrls=$Before.service_bypassrls
        function_privileges=$Before.function_privileges
    }
    planned_versions = @($Plan | ForEach-Object { $_.version })
    dry_run = [bool]$DryRun
    rollback = [ordered]@{
        automatic = $false
        guidance = "Do not drop consent evidence or run a down migration. Stop, preserve evidence, and use a separately approved forward repair."
    }
}
if ($Evidence.result -ne "PREPARED") {
    $Evidence.completed_utc = (Get-Date).ToUniversalTime().ToString("o")
}
$script:ReleaseEvidence = $Evidence
Write-Host "=== WMCHAT CONSENT LIVE RELEASE PLAN ==="
Write-Host "Target: $ApprovedRef"
Write-Host "Release commit: $ReleaseCommit"
Write-Host "Exact migrations: $($Migrations.version -join ', ')"
Write-Host "Missing migrations: $(if ($Plan.Count) { $Plan.version -join ', ' } else { '(none)' })"
Write-Evidence $Evidence $Worktree
if ($DryRun) { Write-Host "DRY RUN - NO MIGRATIONS APPLIED"; exit 0 }
if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    Fail 43 "EvidencePath is mandatory for a non-dry LIVE_ACTIVE migration run."
}
if ($Plan.Count -eq 0) { Write-Host "Both migrations are already installed and verified."; exit 0 }

Write-Host "Type exactly: $ConfirmPhrase"
$Typed = Read-Host "Confirmation"
if ($Typed -cne $ConfirmPhrase) { Fail 43 "Migration release aborted: confirmation phrase mismatch." }
$Recheck = Get-RemoteState $Psql "after-confirmation"
$StateKeys = @($Before.Keys | Sort-Object)
$BeforeFingerprint = ($StateKeys | ForEach-Object { "$_=$($Before[$_])" }) -join "`n"
$RecheckFingerprint = ($StateKeys | ForEach-Object { "$_=$($Recheck[$_])" }) -join "`n"
if ($RecheckFingerprint -cne $BeforeFingerprint) { Fail 44 "REMOTE_STATE_CHANGED_AFTER_CONFIRMATION; zero mutations performed." }
$MutationSql = New-MutationSql $Plan $Before $MigrationFacts
$script:MutationAttempted = $true
$Mutation = Invoke-Psql $Psql $MutationSql "mutation" $false
if ($Mutation.ExitCode -ne 0) {
    Fail 45 "UNKNOWN_REMOTE_STATE after mutation attempt. Inspect LIVE_ACTIVE before any retry."
}
$After = Get-RemoteState $Psql "after"
$FinalPlan = @(Get-Plan $After $MigrationFacts)
if ($FinalPlan.Count -ne 0) { Fail 45 "Final ledger/contract verification did not reach the exact complete state." }
$script:MutationAttempted = $false
$Evidence.result = "VERIFIED"
$Evidence.allowlisted_ledger_after = $After.allowed_ledger
$Evidence.untouched_ledger_after_fingerprint = $After.untouched_fingerprint
$Evidence.contract_after = [ordered]@{
    table=$After.table; rpc=$After.rpc; rls=$After.rls; columns=$After.columns
    constraints=$After.constraints; indexes=$After.indexes; policies=$After.policies
    rpc_properties=$After.rpc_properties; rpc_body=$After.rpc_body
    client_table_privileges=$After.client_table_privileges; service_select=$After.service_select
    service_direct_writes=$After.service_direct_writes; service_bypassrls=$After.service_bypassrls
    function_privileges=$After.function_privileges
}
$Evidence.completed_utc = (Get-Date).ToUniversalTime().ToString("o")
Write-Evidence $Evidence $Worktree
Write-Host "WmChat consent migrations are installed and verified. No production lead was created."
exit 0
} finally {
    Remove-Item -LiteralPath $MaterializedDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
