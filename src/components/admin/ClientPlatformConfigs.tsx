import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clipboard, KeyRound, Loader2, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Search, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  fetchClientPlatformConfigs,
  maskConfigId,
  runClientPlatformValidation,
  saveClientPlatformConfig,
  setClientPlatformState,
  setClientPlatformToken,
  type CompletenessStatus,
  type ConfigReasonCode,
  type ConfigState,
  type PlatformClient,
  type PlatformConfigPayload,
  type PlatformConfigRow,
  type PlatformName,
  type ValidationStatus,
} from "@/services/clientPlatformConfigs";

const ALL = "all";
const PLATFORM_OPTIONS: PlatformName[] = ["meta", "tiktok", "google_ads", "ga4", "gtm_server", "crm_webhook", "internal", "other"];
const STATE_OPTIONS: ConfigState[] = ["draft", "incomplete", "pending_validation", "validated", "active", "paused", "retired", "invalid"];
const VALIDATION_OPTIONS: ValidationStatus[] = ["not_tested", "validation_passed", "validation_failed", "validation_stale", "requires_revalidation"];
const COMPLETENESS_OPTIONS: CompletenessStatus[] = ["complete", "warning", "incomplete"];

const emptyDraft = (clients: PlatformClient[]): PlatformConfigPayload => ({
  client_id: clients[0]?.id ?? "",
  platform_name: "meta",
  pixel_id: null,
  dataset_id: null,
  conversion_id: null,
  conversion_label: null,
  endpoint_url: null,
  config_state: "draft",
  is_active: false,
  token_present: false,
});

function platformLabel(value: string) {
  const labels: Record<string, string> = {
    meta: "Meta",
    tiktok: "TikTok",
    google_ads: "Google Ads",
    ga4: "GA4",
    gtm_server: "GTM Server",
    crm_webhook: "CRM Webhook",
    internal: "Internal",
    other: "Other",
  };
  return labels[value] ?? value;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

function fmtRelative(value: string | null | undefined) {
  if (!value) return "—";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function statusClasses(status: CompletenessStatus | ValidationStatus | ConfigState) {
  if (["complete", "validation_passed", "validated", "active"].includes(status)) return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (["warning", "requires_revalidation", "validation_stale", "pending_validation", "paused"].includes(status)) return "border-amber-300 bg-amber-100 text-amber-950";
  if (["incomplete", "validation_failed", "invalid", "retired"].includes(status)) return "border-rose-300 bg-rose-100 text-rose-950";
  return "border-slate-300 bg-slate-100 text-slate-900";
}

function StatusBadge({ value }: { value: string }) {
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", statusClasses(value as never))}>{value.replace(/_/g, " ")}</Badge>;
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-700">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label className="text-xs font-black uppercase tracking-wide text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function reasonLabel(code: string) {
  return code.replace(/_/g, " ");
}

function destinationSummary(row: PlatformConfigRow) {
  const ids = [
    row.pixel_id ? `pixel ${maskConfigId(row.pixel_id)}` : null,
    row.dataset_id ? `dataset ${maskConfigId(row.dataset_id)}` : null,
    row.conversion_id ? `conversion ${maskConfigId(row.conversion_id)}` : null,
    row.conversion_label ? `label ${maskConfigId(row.conversion_label)}` : null,
  ].filter(Boolean);
  return ids.length ? ids.join(" · ") : "—";
}

function buildDraft(row: PlatformConfigRow | null, clients: PlatformClient[]): PlatformConfigPayload {
  if (!row) return emptyDraft(clients);
  return {
    id: row.id,
    client_id: row.client_id,
    platform_name: row.platform_name,
    pixel_id: row.pixel_id,
    dataset_id: row.dataset_id,
    conversion_id: row.conversion_id,
    conversion_label: row.conversion_label,
    endpoint_url: row.endpoint_url,
    config_state: row.config_state,
    is_active: row.is_active,
    token_present: Boolean(row.token_secret_id),
  };
}

function computeKpis(clients: PlatformClient[], rows: PlatformConfigRow[]) {
  return {
    totalClients: clients.length,
    totalConfigs: rows.length,
    activeConfigs: rows.filter((r) => r.is_active || r.config_state === "active").length,
    completeConfigs: rows.filter((r) => r.readiness?.completeness === "complete").length,
    incompleteConfigs: rows.filter((r) => r.readiness?.completeness === "incomplete").length,
    missingTokens: rows.filter((r) => r.readiness?.reasons.includes("missing_token")).length,
    validationRequired: rows.filter((r) => ["not_tested", "requires_revalidation", "validation_stale"].includes(r.validation_status)).length,
    inactivePaused: rows.filter((r) => !r.is_active || r.config_state === "paused").length,
  };
}

export function ClientPlatformConfigs() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlatformConfigRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<PlatformConfigPayload | null>(null);
  const [token, setToken] = useState("");
  const [filters, setFilters] = useState({
    client: ALL,
    platform: ALL,
    state: ALL,
    completeness: ALL,
    validation: ALL,
    activeOnly: false,
    missingTokenOnly: false,
    requiresValidationOnly: false,
    search: "",
  });

  const configQ = useQuery({ queryKey: ["client-platform-configs"], queryFn: fetchClientPlatformConfigs, staleTime: 20_000 });
  const clients = configQ.data?.clients ?? [];
  const rows = configQ.data?.configs ?? [];
  const kpis = useMemo(() => computeKpis(clients, rows), [clients, rows]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["client-platform-configs"] });

  const saveMutation = useMutation({
    mutationFn: saveClientPlatformConfig,
    onSuccess: () => { toast.success("Platform config metadata saved"); setDrawerOpen(false); invalidate(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const tokenMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => setClientPlatformToken(id, value),
    onSuccess: () => { setToken(""); toast.success("Token rotated through Vault"); invalidate(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const validationMutation = useMutation({
    mutationFn: runClientPlatformValidation,
    onSuccess: (data) => { toast.success(`Local validation ${data.validation_status.replace("validation_", "")}`); invalidate(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const stateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: ConfigState }) => setClientPlatformState(id, state),
    onSuccess: (_, vars) => { toast.success(`Config moved to ${vars.state.replace(/_/g, " ")}`); invalidate(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.client !== ALL && row.client_id !== filters.client) return false;
      if (filters.platform !== ALL && row.platform_name !== filters.platform) return false;
      if (filters.state !== ALL && row.config_state !== filters.state) return false;
      if (filters.completeness !== ALL && row.readiness?.completeness !== filters.completeness) return false;
      if (filters.validation !== ALL && row.validation_status !== filters.validation) return false;
      if (filters.activeOnly && !row.is_active) return false;
      if (filters.missingTokenOnly && !row.readiness?.reasons.includes("missing_token")) return false;
      if (filters.requiresValidationOnly && !["not_tested", "requires_revalidation", "validation_stale"].includes(row.validation_status)) return false;
      if (!q) return true;
      return [row.clients?.name, row.clients?.slug, row.platform_name, row.pixel_id, row.dataset_id, row.conversion_id, row.conversion_label, row.endpoint_url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [filters, rows]);

  function openRow(row: PlatformConfigRow | null) {
    setSelected(row);
    setDraft(buildDraft(row, clients));
    setToken("");
    setDrawerOpen(true);
  }

  function updateDraft<K extends keyof PlatformConfigPayload>(key: K, value: PlatformConfigPayload[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  function copySlug() {
    const slug = selected?.clients?.slug;
    if (!slug) return;
    navigator.clipboard.writeText(slug).then(() => toast.success("client_slug copied"));
  }

  const selectedClient = draft ? clients.find((c) => c.id === draft.client_id) ?? selected?.clients ?? null : null;
  const activeReasonCodes = selected?.readiness?.reasons ?? [];
  const checklist = selected?.readiness?.required ?? {};
  const lastUpdated = selected?.updated_at ? fmtRelative(selected.updated_at) : "New config";

  return (
    <section className="w-full space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Client Platform Configs</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">
            Configure client-level Meta, TikTok, Google, GTM, and webhook destinations used by the Revenue Dispatch Readiness Matrix.
          </p>
          <p className="mt-2 text-xs font-bold uppercase text-slate-500">Read-only validation only · no external platform calls · no event dispatch</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => configQ.refetch()} disabled={configQ.isFetching}>
            {configQ.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={() => openRow(null)} disabled={clients.length === 0}>Add Config</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Total clients" value={kpis.totalClients} />
        <KpiCard label="Total configs" value={kpis.totalConfigs} />
        <KpiCard label="Active" value={kpis.activeConfigs} />
        <KpiCard label="Complete" value={kpis.completeConfigs} />
        <KpiCard label="Incomplete" value={kpis.incompleteConfigs} />
        <KpiCard label="Missing tokens" value={kpis.missingTokens} />
        <KpiCard label="Validation req." value={kpis.validationRequired} />
        <KpiCard label="Inactive/paused" value={kpis.inactivePaused} />
      </div>

      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input className="pl-9" placeholder="Search client, platform, destination IDs, endpoint" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <Select value={filters.client} onValueChange={(value) => setFilters({ ...filters, client: value })}>
            <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All clients</SelectItem>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.slug}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.platform} onValueChange={(value) => setFilters({ ...filters, platform: value })}>
            <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All platforms</SelectItem>{PLATFORM_OPTIONS.map((p) => <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.state} onValueChange={(value) => setFilters({ ...filters, state: value })}>
            <SelectTrigger><SelectValue placeholder="Lifecycle" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All states</SelectItem>{STATE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.validation} onValueChange={(value) => setFilters({ ...filters, validation: value })}>
            <SelectTrigger><SelectValue placeholder="Validation" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All validation</SelectItem>{VALIDATION_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800"><Switch checked={filters.activeOnly} onCheckedChange={(checked) => setFilters({ ...filters, activeOnly: checked })} /> Active only</label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800"><Switch checked={filters.missingTokenOnly} onCheckedChange={(checked) => setFilters({ ...filters, missingTokenOnly: checked })} /> Missing token only</label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-800"><Switch checked={filters.requiresValidationOnly} onCheckedChange={(checked) => setFilters({ ...filters, requiresValidationOnly: checked })} /> Requires validation only</label>
          <Select value={filters.completeness} onValueChange={(value) => setFilters({ ...filters, completeness: value })}>
            <SelectTrigger className="h-9 w-[210px]"><SelectValue placeholder="Completeness" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All completeness</SelectItem>{COMPLETENESS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Client</TableHead>
              <TableHead>client_slug</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead>Completeness</TableHead>
              <TableHead>Validation</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Destination IDs</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Validated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configQ.isLoading ? (
              <TableRow><TableCell colSpan={13} className="h-28 text-center font-bold text-slate-700"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading platform configs…</TableCell></TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="h-28 text-center font-bold text-slate-700">No platform configs match the current filters.</TableCell></TableRow>
            ) : filteredRows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="min-w-[180px] font-black text-slate-950">{row.clients?.name ?? "Unknown client"}</TableCell>
                <TableCell className="font-mono text-xs font-bold text-slate-700">{row.clients?.slug ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="font-black text-slate-900">{platformLabel(row.platform_name)}</Badge></TableCell>
                <TableCell><StatusBadge value={row.config_state} /></TableCell>
                <TableCell><StatusBadge value={row.readiness?.completeness ?? "incomplete"} /></TableCell>
                <TableCell><StatusBadge value={row.validation_status} /></TableCell>
                <TableCell className="font-bold">{row.is_active ? "Yes" : "No"}</TableCell>
                <TableCell>{row.token_secret_id ? <span className="font-black text-emerald-800">Present</span> : <span className="font-black text-rose-800">Missing</span>}</TableCell>
                <TableCell className="min-w-[220px] text-xs font-bold text-slate-700">{destinationSummary(row)}</TableCell>
                <TableCell className="font-bold">{row.endpoint_url ? "Present" : "—"}</TableCell>
                <TableCell className="min-w-[140px] text-xs font-bold text-slate-700">{fmtRelative(row.updated_at)}</TableCell>
                <TableCell className="min-w-[140px] text-xs font-bold text-slate-700">{fmtRelative(row.validated_at)}</TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => openRow(row)}>Open</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-slate-950">{selected ? "Edit Platform Config" : "Add Platform Config"}</SheetTitle>
            <SheetDescription className="font-semibold text-slate-700">{selectedClient ? `${selectedClient.name} · ${selectedClient.slug}` : "Choose a client and platform."} · {lastUpdated}</SheetDescription>
          </SheetHeader>

          {draft && (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client display">
                  <Select value={draft.client_id} onValueChange={(value) => updateDraft("client_id", value)} disabled={Boolean(selected)}>
                    <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.slug}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="client_slug">
                  <div className="flex gap-2"><Input readOnly value={selectedClient?.slug ?? ""} /><Button variant="outline" size="icon" onClick={copySlug} disabled={!selectedClient?.slug}><Clipboard className="h-4 w-4" /></Button></div>
                </Field>
                <Field label="platform_name">
                  <Select value={draft.platform_name} onValueChange={(value) => updateDraft("platform_name", value as PlatformName)} disabled={Boolean(selected)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATFORM_OPTIONS.map((p) => <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="config_state">
                  <Select value={draft.config_state} onValueChange={(value) => updateDraft("config_state", value as ConfigState)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="is_active">
                  <label className="flex h-10 items-center gap-3 rounded-md border border-slate-300 px-3 text-sm font-black text-slate-900"><Switch checked={draft.is_active} onCheckedChange={(checked) => updateDraft("is_active", checked)} /> {draft.is_active ? "Active" : "Inactive"}</label>
                </Field>
                <Field label="validation_status"><div className="flex h-10 items-center"><StatusBadge value={selected?.validation_status ?? "not_tested"} /></div></Field>
                <Field label="pixel_id"><Input value={draft.pixel_id ?? ""} onChange={(e) => updateDraft("pixel_id", e.target.value)} /></Field>
                <Field label="dataset_id"><Input value={draft.dataset_id ?? ""} onChange={(e) => updateDraft("dataset_id", e.target.value)} /></Field>
                <Field label="conversion_id"><Input value={draft.conversion_id ?? ""} onChange={(e) => updateDraft("conversion_id", e.target.value)} /></Field>
                <Field label="conversion_label"><Input value={draft.conversion_label ?? ""} onChange={(e) => updateDraft("conversion_label", e.target.value)} /></Field>
                <Field label="endpoint_url"><Input className="sm:col-span-2" value={draft.endpoint_url ?? ""} onChange={(e) => updateDraft("endpoint_url", e.target.value)} placeholder="https://…" /></Field>
                <Field label="token_present"><div className="flex h-10 items-center font-black text-slate-950">{selected?.token_secret_id ? "Yes" : "No"}</div></Field>
                <Field label="token_last_rotated_at"><Input readOnly value={fmtDate(selected?.token_last_rotated_at)} /></Field>
                <Field label="token_fingerprint_prefix"><Input readOnly value={selected?.token_fingerprint_prefix ?? "—"} /></Field>
                <Field label="validated_at"><Input readOnly value={fmtDate(selected?.validated_at)} /></Field>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-700"><ShieldCheck className="h-4 w-4" /> Validation panel</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(checklist).map(([key, ok]) => (
                    <div key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-sm font-bold text-slate-800">
                      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <XCircle className="h-4 w-4 text-rose-700" />}
                      {key.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["missing_token", "token_present", "token_not_validated", "token_validation_stale", "token_validation_failed", "missing_pixel_id", "missing_dataset_id", "missing_conversion_id", "missing_conversion_label", "missing_endpoint_url", "missing_client", "missing_client_slug", "inactive_config", "paused_config", "retired_config", "unknown_platform", "validation_required", "validation_passed", "validation_failed", "config_complete", "config_incomplete", "config_warning"] as ConfigReasonCode[]).map((code) => (
                    <Badge key={code} variant="outline" className={cn("border font-black", activeReasonCodes.includes(code) ? "border-amber-300 bg-amber-100 text-amber-950" : "border-slate-300 bg-white text-slate-600")}>{reasonLabel(code)}</Badge>
                  ))}
                </div>
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-800">{JSON.stringify(selected?.validation_summary ?? {}, null, 2)}</pre>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-700"><KeyRound className="h-4 w-4" /> Token replacement</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste new token; it is sent only to the Edge Function and cleared after save" autoComplete="off" />
                  <Button disabled={!selected?.id || token.length < 20 || tokenMutation.isPending} onClick={() => selected?.id && tokenMutation.mutate({ id: selected.id, value: token })}>
                    {tokenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Set/replace token
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                <Button variant="outline" onClick={() => selected?.id && validationMutation.mutate(selected.id)} disabled={!selected?.id || validationMutation.isPending}>{validationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Run local validation</Button>
                <Button variant="outline" onClick={() => selected?.id && stateMutation.mutate({ id: selected.id, state: "paused" })} disabled={!selected?.id}><PauseCircle className="h-4 w-4" /> Pause</Button>
                <Button variant="outline" onClick={() => selected?.id && stateMutation.mutate({ id: selected.id, state: "retired" })} disabled={!selected?.id}>Retire</Button>
                <Button variant="outline" onClick={() => selected?.id && stateMutation.mutate({ id: selected.id, state: "active" })} disabled={!selected?.id}><PlayCircle className="h-4 w-4" /> Activate</Button>
                <Button onClick={() => draft && saveMutation.mutate(draft)} disabled={!draft.client_id || saveMutation.isPending}>{saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save metadata</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
