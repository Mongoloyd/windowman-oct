import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, ExternalLink, FileSearch, Loader2, RefreshCcw, Search, ShieldAlert } from "lucide-react";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchLeadEvidence, getErrorMessage, invokeAdminData, isAdminDataError, type LeadEvidenceResponse } from "@/services/adminDataService";

type LeadListRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  zip: string | null;
  latest_scan_session_id: string | null;
  latest_analysis_id: string | null;
  grade: string | null;
  status: string | null;
};

const sanitizeError = (error: unknown) => {
  if (isAdminDataError(error)) {
    if (error.status === 401 || error.status === 403) return "Your admin role is not authorized for this evidence view.";
    if (error.status === 404 || error.code === "not_found") return "Lead not found.";
    if (error.status === 400) return error.message;
  }
  return getErrorMessage(error) || "The request could not be completed.";
};

const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "—";
const shortId = (value: string | null | undefined) => value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";
const fullName = (lead: Pick<LeadListRow, "first_name" | "last_name">) => [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed lead";
type InspectorContext = { scanSessionId: string | null; analysisId: string | null; hasUrlContext: boolean };

export default function AdminLeadEvidence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlLeadId = searchParams.get("lead_id");
  const contextScanSessionId = searchParams.get("scan_session_id");
  const contextAnalysisId = searchParams.get("analysis_id");
  const hasUrlContext = Boolean(urlLeadId || contextScanSessionId || contextAnalysisId);
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(urlLeadId);

  useEffect(() => {
    document.title = "Lead Evidence Inspector · WindowMan Admin";
  }, []);

  useEffect(() => {
    if (!urlLeadId || selectedLeadId === urlLeadId) return;
    setSelectedLeadId(urlLeadId);
  }, [urlLeadId, selectedLeadId]);

  useEffect(() => {
    if (!urlLeadId) return;
    setSearch(contextScanSessionId ?? contextAnalysisId ?? urlLeadId);
  }, [urlLeadId, contextScanSessionId, contextAnalysisId]);

  const handleSelectLead = (id: string) => {
    if (selectedLeadId !== id) setSelectedLeadId(id);
    setSearchParams({ lead_id: id });
  };

  const leadsQuery = useQuery({
    queryKey: ["admin", "lead-evidence", "leads"],
    queryFn: async () => (await invokeAdminData("fetch_leads")) as LeadListRow[],
    staleTime: 30_000,
  });

  const evidenceQuery = useQuery({
    queryKey: ["admin", "lead-evidence", selectedLeadId],
    queryFn: async () => fetchLeadEvidence(selectedLeadId as string),
    enabled: Boolean(selectedLeadId),
    retry: false,
  });

  const leads = leadsQuery.data ?? [];
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) => [
      lead.id,
      lead.first_name,
      lead.last_name,
      lead.email,
      lead.phone_e164,
      lead.county,
      lead.city,
      lead.zip,
      lead.latest_scan_session_id,
      lead.latest_analysis_id,
    ].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [leads, search]);

  return (
    <AdminShell
      eyebrow="Operator · Evidence"
      title="Lead Evidence Inspector"
      subtitle="Read-only chain view for quote files, scan sessions, analyses, and existing admin report links."
      backTo="/admin/leads"
      backLabel="Back to Lead Inbox"
      nav={<AdminGlobalNav />}
      belowHeader={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ID, name, email, phone, city, ZIP, scan, analysis…" className="h-10 pl-8 text-sm font-semibold" />
          </div>
          <Button variant="outline" onClick={() => leadsQuery.refetch()} disabled={leadsQuery.isFetching}>
            {leadsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      }
    >
      {leadsQuery.isLoading ? <LoadingState label="Loading leads…" /> : leadsQuery.isError ? (
        <ErrorState title="Couldn't load leads" message={sanitizeError(leadsQuery.error)} onRetry={() => leadsQuery.refetch()} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.85fr)_minmax(0,1.15fr)]">
          <LeadList leads={filteredLeads} selectedLeadId={selectedLeadId} onSelect={handleSelectLead} />
          <EvidencePanel leadId={selectedLeadId} query={evidenceQuery} context={{ scanSessionId: contextScanSessionId, analysisId: contextAnalysisId, hasUrlContext }} />
        </div>
      )}
    </AdminShell>
  );
}

function LeadList({ leads, selectedLeadId, onSelect }: { leads: LeadListRow[]; selectedLeadId: string | null; onSelect: (id: string) => void }) {
  if (leads.length === 0) {
    return <EmptyState title="No leads match" message="Try another search term or refresh the lead list." />;
  }
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-extrabold text-foreground">Leads</h2>
        <p className="text-sm font-semibold text-muted-foreground">Select one lead to fetch evidence on demand.</p>
      </div>
      <div className="max-h-[72vh] overflow-auto">
        {leads.map((lead) => (
          <button key={lead.id} onClick={() => onSelect(lead.id)} className={`block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selectedLeadId === lead.id ? "bg-muted" : "bg-card"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-foreground">{fullName(lead)}</p>
                <p className="truncate text-xs font-semibold text-muted-foreground">{lead.email ?? "No email"} · {lead.phone_e164 ?? "No phone"}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{[lead.city, lead.county, lead.state, lead.zip].filter(Boolean).join(", ") || "No location"}</p>
              </div>
              <span className="rounded border border-border px-2 py-1 text-xs font-bold text-muted-foreground">{lead.grade ?? lead.status ?? "—"}</span>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Lead {shortId(lead.id)}</span>
              <span>Created {formatDate(lead.created_at)}</span>
              <span>Scan {shortId(lead.latest_scan_session_id)}</span>
              <span>Analysis {shortId(lead.latest_analysis_id)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EvidencePanel({ leadId, query, context }: { leadId: string | null; query: UseQueryResult<LeadEvidenceResponse, Error>; context: InspectorContext }) {
  if (!leadId) return <EmptyState title="No lead selected" message="Choose a lead to inspect quote files, scan sessions, and analysis metadata." icon="search" />;
  if (query.isLoading) return <LoadingState label="Loading selected lead evidence…" />;
  if (query.isError) return <ErrorState title={isAdminDataError(query.error) && query.error.code === "not_found" ? "Lead not found" : "Couldn't load evidence"} message={sanitizeError(query.error)} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyState title="No evidence returned" message="The selected lead returned no evidence payload." />;

  const evidence = query.data;
  return (
    <div className="space-y-5">
      {context.hasUrlContext && <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-950">Opened from Command Center context.</div>}
      <LeadSummary evidence={evidence} />
      <QuoteFiles evidence={evidence} />
      <ScanSessions evidence={evidence} highlightId={context.scanSessionId} />
      <Analyses evidence={evidence} highlightId={context.analysisId} />
    </div>
  );
}

function LeadSummary({ evidence }: { evidence: LeadEvidenceResponse }) {
  const { lead } = evidence;
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-foreground">{fullName(lead)}</h2>
          <p className="text-sm font-semibold text-muted-foreground">{lead.email ?? "No email"} · {lead.phone_e164 ?? "No phone"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to={`/admin/leads/${lead.id}`}>Lead dossier</Link></Button>
          {lead.latest_analysis_id && <Button asChild size="sm"><Link to={`/admin/leads/${lead.id}/report`}>Report</Link></Button>}
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Lead ID" value={lead.id} />
        <Info label="Created" value={formatDate(lead.created_at)} />
        <Info label="Updated" value={formatDate(lead.updated_at)} />
        <Info label="Location" value={[lead.city, lead.county, lead.state, lead.zip].filter(Boolean).join(", ") || "—"} />
        <Info label="Latest scan" value={lead.latest_scan_session_id ?? "—"} />
        <Info label="Latest analysis" value={lead.latest_analysis_id ?? "—"} />
        <Info label="Grade" value={lead.grade ?? "—"} />
        <Info label="Status" value={lead.status ?? "—"} />
      </dl>
    </section>
  );
}

function QuoteFiles({ evidence }: { evidence: LeadEvidenceResponse }) {
  if (evidence.quote_files.length === 0) return <EmptySection title="Quote files" message="No quote files were found for this lead." />;
  return (
    <EvidenceTable title="Quote files">
      <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Storage path</TableHead><TableHead>Status</TableHead><TableHead>Related scan</TableHead><TableHead>Created</TableHead><TableHead>Signed link</TableHead></TableRow></TableHeader>
      <TableBody>{evidence.quote_files.map((file) => <TableRow key={file.id}><TableCell className="font-mono text-xs">{shortId(file.id)}</TableCell><TableCell className="max-w-[260px] truncate font-mono text-xs">{file.storage_path}</TableCell><TableCell>{file.status ?? "—"}</TableCell><TableCell className="font-mono text-xs">{shortId(file.related_scan_session_id)}</TableCell><TableCell>{formatDate(file.created_at)}</TableCell><TableCell>{file.signed_url ? <Button asChild variant="outline" size="sm"><a href={file.signed_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open · {file.signed_url_expires_in}s</a></Button> : <span className="text-xs font-semibold text-muted-foreground">{file.signed_url_error ?? "No link"}</span>}</TableCell></TableRow>)}</TableBody>
    </EvidenceTable>
  );
}

function ScanSessions({ evidence, highlightId }: { evidence: LeadEvidenceResponse; highlightId: string | null }) {
  if (evidence.scan_sessions.length === 0) return <EmptySection title="Scan sessions" message="No scan sessions were found for this lead." />;
  return <EvidenceTable title="Scan sessions"><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Lead</TableHead><TableHead>Quote file</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody>{evidence.scan_sessions.map((session) => <TableRow key={session.id} className={session.id === highlightId ? "bg-primary/10 ring-1 ring-primary/30" : undefined}><TableCell className="font-mono text-xs">{shortId(session.id)}</TableCell><TableCell className="font-mono text-xs">{shortId(session.lead_id)}</TableCell><TableCell className="font-mono text-xs">{shortId(session.quote_file_id)}</TableCell><TableCell>{session.status}</TableCell><TableCell>{formatDate(session.created_at)}</TableCell><TableCell>{formatDate(session.updated_at)}</TableCell></TableRow>)}</TableBody></EvidenceTable>;
}

function Analyses({ evidence, highlightId }: { evidence: LeadEvidenceResponse; highlightId: string | null }) {
  if (evidence.analyses.length === 0) return <EmptySection title="Analyses" message="No analyses were found for this lead." />;
  return <EvidenceTable title="Analyses"><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Scan</TableHead><TableHead>Grade</TableHead><TableHead>Status</TableHead><TableHead>Confidence</TableHead><TableHead>Document</TableHead><TableHead>Flags</TableHead><TableHead>Safe summaries</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody>{evidence.analyses.map((analysis) => <TableRow key={analysis.id} className={analysis.id === highlightId ? "bg-primary/10 ring-1 ring-primary/30" : undefined}><TableCell className="font-mono text-xs">{shortId(analysis.id)}</TableCell><TableCell className="font-mono text-xs">{shortId(analysis.scan_session_id)}</TableCell><TableCell>{analysis.grade ?? "—"}</TableCell><TableCell>{analysis.analysis_status}</TableCell><TableCell>{analysis.confidence_score ?? "—"}</TableCell><TableCell>{analysis.document_type ?? "—"} · {analysis.document_is_window_door_related == null ? "unknown" : analysis.document_is_window_door_related ? "window/door" : "other"} · Δ {analysis.dollar_delta ?? "—"}</TableCell><TableCell>{analysis.flags_summary.count} ({Object.entries(analysis.flags_summary.severities).map(([k, v]) => `${k}:${v}`).join(", ") || "none"})</TableCell><TableCell>Preview {analysis.preview_summary.present ? analysis.preview_summary.top_level_keys.join(", ") || "present" : "absent"}; Proof {analysis.proof_summary.present ? analysis.proof_summary.top_level_keys.join(", ") || "present" : "absent"}</TableCell><TableCell>{formatDate(analysis.updated_at)}</TableCell></TableRow>)}</TableBody></EvidenceTable>;
}

function EvidenceTable({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-border bg-card shadow-sm"><div className="border-b border-border px-4 py-3"><h2 className="font-display text-lg font-extrabold text-foreground">{title}</h2></div><Table>{children}</Table></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-mono text-xs text-foreground">{value}</dd></div>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-card"><div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{label}</div></div>;
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  const Icon = title.toLowerCase().includes("authorized") ? ShieldAlert : AlertCircle;
  return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><div className="flex items-start gap-2"><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-extrabold">{title}</p><p className="mt-1 font-semibold opacity-90">{message}</p><Button variant="outline" size="sm" onClick={onRetry} className="mt-3">Retry</Button></div></div></div>;
}

function EmptyState({ title, message }: { title: string; message: string; icon?: "search" }) {
  return <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-card p-8 text-center shadow-sm"><div><FileSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-display text-lg font-extrabold text-foreground">{title}</h2><p className="mt-1 max-w-md text-sm font-semibold text-muted-foreground">{message}</p></div></div>;
}

function EmptySection({ title, message }: { title: string; message: string }) {
  return <section className="rounded-lg border border-border bg-card p-4 shadow-sm"><h2 className="font-display text-lg font-extrabold text-foreground">{title}</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">{message}</p></section>;
}