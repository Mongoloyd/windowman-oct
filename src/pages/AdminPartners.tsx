import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminPrimaryTabs } from "@/components/admin/shell/AdminPrimaryTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { invokeAdminData } from "@/services/adminDataService";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";

type Client = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

type MetaConfig = {
  id: string;
  client_id: string | null;
  pixel_id: string | null;
  test_event_code: string | null;
  is_default: boolean;
  updated_at: string;
};

type RedactedMetaConfig = {
  id: string;
  role: "default" | "client";
  client_id: string | null;
  client_slug: string | null;
  client_name: string | null;
  client_is_active: boolean | null;
  pixel_id: string | null;
  access_token_preview: string | null;
  test_event_code: string | null;
  updated_at: string;
};

type SignalLog = {
  id: string;
  client_slug: string | null;
  event_name: string | null;
  pixel_id: string | null;
  status_code: number | null;
  fired_at: string;
};

type Draft = {
  id: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  notes: string;
  pixelId: string;
  testEventCode: string;
  googleConversionId: string;
  googleVerifiedLeadLabel: string;
  googleSoldLabel: string;
  enhancedConversions: boolean;
  serverGtmUrl: string;
  serverRoutingMode: string;
};

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const PIXEL_REGEX = /^\d{6,20}$/;
const GOOGLE_CONVERSION_ID_REGEX = /^(AW-)?\d{6,20}$/;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function sanitizeText(value: string, max = 255): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, max);
}

function maskId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function HelpTip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2" aria-label="Configuration help">
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-lg">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ tone, children }: { tone: "emerald" | "amber" | "red" | "blue" | "slate"; children: string }) {
  const classes = {
    emerald: "border-emerald-300 bg-emerald-100 text-emerald-950",
    amber: "border-amber-300 bg-amber-100 text-amber-950",
    red: "border-red-300 bg-red-100 text-red-950",
    blue: "border-blue-300 bg-blue-100 text-blue-950",
    slate: "border-slate-400 bg-slate-100 text-slate-950",
  }[tone];
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-black ${classes}`}>{children}</span>;
}

function KpiCard({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <span>{label}</span>
        {help ? <HelpTip>{help}</HelpTip> : null}
      </div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function tokenConfigured(redacted: RedactedMetaConfig | null | undefined): boolean {
  return Boolean(redacted?.access_token_preview && redacted.access_token_preview !== "missing" && redacted.access_token_preview !== "—");
}

function configStatus(client: Client, meta: MetaConfig | null, redacted: RedactedMetaConfig | null, logs: SignalLog[]) {
  const lastFailure = logs.find((log) => log.client_slug === client.slug && (log.status_code ?? 0) >= 400);
  if (!client.is_active) return { label: "Paused", tone: "slate" as const };
  if (!meta?.pixel_id) return { label: "Missing Config", tone: "amber" as const };
  if (!tokenConfigured(redacted)) return { label: "Token Missing", tone: "red" as const };
  if (lastFailure) return { label: "Signal Failing", tone: "red" as const };
  return { label: "Ready", tone: "emerald" as const };
}

function buildDraft(client: Client | null, meta: MetaConfig | null): Draft {
  return {
    id: client?.id ?? null,
    name: client?.name ?? "",
    slug: client?.slug ?? "",
    isActive: client?.is_active ?? true,
    notes: "",
    pixelId: meta?.pixel_id ?? "",
    testEventCode: meta?.test_event_code ?? "",
    googleConversionId: "",
    googleVerifiedLeadLabel: "",
    googleSoldLabel: "",
    enhancedConversions: false,
    serverGtmUrl: "",
    serverRoutingMode: "not_configured",
  };
}

function validateDraft(draft: Draft, existingSlugs: string[]): string[] {
  const errors: string[] = [];
  if (!sanitizeText(draft.name, 100)) errors.push("Client name is required.");
  if (!SLUG_REGEX.test(draft.slug)) errors.push("Client slug must be lowercase letters, numbers, and hyphens.");
  if (existingSlugs.includes(draft.slug)) errors.push("Client slug is already in use.");
  if (draft.pixelId.trim() && !PIXEL_REGEX.test(draft.pixelId.trim())) errors.push("Meta Pixel ID must be 6–20 digits.");
  if (draft.googleConversionId.trim() && !GOOGLE_CONVERSION_ID_REGEX.test(draft.googleConversionId.trim())) errors.push("Google Conversion ID must look like AW-123456789 or digits only.");
  if (draft.serverGtmUrl.trim()) {
    try {
      const parsed = new URL(draft.serverGtmUrl.trim());
      if (!/^https:$/.test(parsed.protocol)) errors.push("Server GTM URL must use HTTPS.");
    } catch {
      errors.push("Server GTM URL must be a valid URL.");
    }
  }
  return errors;
}

function AdminPartnersContent() {
  const { hasWriteAccess } = useCurrentUserRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [metaConfigs, setMetaConfigs] = useState<MetaConfig[]>([]);
  const [redactedConfigs, setRedactedConfigs] = useState<RedactedMetaConfig[]>([]);
  const [signalLogs, setSignalLogs] = useState<SignalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [draft, setDraft] = useState<Draft>(() => buildDraft(null, null));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsResult, metaResult, logsResult, redactedResult] = await Promise.all([
        supabase.from("clients").select("id, name, slug, is_active, created_at").order("created_at", { ascending: false }),
        supabase.from("meta_configurations").select("id, client_id, pixel_id, test_event_code, is_default, updated_at"),
        supabase.from("capi_signal_logs").select("id, client_slug, event_name, pixel_id, status_code, fired_at").order("fired_at", { ascending: false }).limit(500),
        invokeAdminData("list_meta_configurations"),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (metaResult.error) throw metaResult.error;
      if (logsResult.error) throw logsResult.error;

      setClients((clientsResult.data ?? []) as Client[]);
      setMetaConfigs((metaResult.data ?? []) as MetaConfig[]);
      setSignalLogs((logsResult.data ?? []) as SignalLog[]);
      setRedactedConfigs(((redactedResult?.rows ?? []) as RedactedMetaConfig[]));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Failed to load partner config: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const metaByClientId = useMemo(() => {
    const map = new Map<string, MetaConfig>();
    for (const config of metaConfigs) if (config.client_id) map.set(config.client_id, config);
    return map;
  }, [metaConfigs]);

  const redactedByClientId = useMemo(() => {
    const map = new Map<string, RedactedMetaConfig>();
    for (const config of redactedConfigs) if (config.client_id) map.set(config.client_id, config);
    return map;
  }, [redactedConfigs]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => client.name.toLowerCase().includes(q) || client.slug.toLowerCase().includes(q));
  }, [clients, search]);

  const selectedMeta = selectedClient ? metaByClientId.get(selectedClient.id) ?? null : null;
  const selectedRedacted = selectedClient ? redactedByClientId.get(selectedClient.id) ?? null : null;
  const existingSlugs = clients.filter((client) => client.id !== draft.id).map((client) => client.slug);
  const validationErrors = validateDraft(draft, existingSlugs);

  const health = useMemo(() => {
    const activeClients = clients.filter((client) => client.is_active);
    const configuredMeta = activeClients.filter((client) => {
      const meta = metaByClientId.get(client.id);
      const redacted = redactedByClientId.get(client.id);
      return Boolean(meta?.pixel_id && tokenConfigured(redacted));
    });
    const missingSecrets = activeClients.filter((client) => {
      const meta = metaByClientId.get(client.id);
      const redacted = redactedByClientId.get(client.id);
      return Boolean(meta?.pixel_id && !tokenConfigured(redacted));
    });
    const failure = signalLogs.find((log) => (log.status_code ?? 0) >= 400);
    return {
      activeClients: activeClients.length,
      metaConfigured: configuredMeta.length,
      googleConfigured: 0,
      serverGtmConfigured: 0,
      missingSecrets: missingSecrets.length,
      lastFailure: failure ? formatTime(failure.fired_at) : "None",
    };
  }, [clients, metaByClientId, redactedByClientId, signalLogs]);

  function openEditor(client: Client | null) {
    if (client && !hasWriteAccess) {
      setSelectedClient(client);
      setDraft(buildDraft(client, metaByClientId.get(client.id) ?? null));
      return;
    }
    setSelectedClient(client);
    setDraft(buildDraft(client, client ? metaByClientId.get(client.id) ?? null : null));
    setEditorOpen(true);
  }

  async function saveConfig() {
    if (!hasWriteAccess) {
      toast.error("You do not have permission to edit client configs.");
      return;
    }
    const errors = validateDraft(draft, existingSlugs);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSaving(true);
    try {
      const safeName = sanitizeText(draft.name, 100);
      const safeSlug = slugify(draft.slug);
      let clientId = draft.id;

      if (clientId) {
        const { error: clientError } = await supabase
          .from("clients")
          .update({ name: safeName, slug: safeSlug, is_active: draft.isActive })
          .eq("id", clientId);
        if (clientError) throw clientError;
      } else {
        const { data, error: clientError } = await supabase
          .from("clients")
          .insert({ name: safeName, slug: safeSlug, is_active: draft.isActive })
          .select("id")
          .single();
        if (clientError) throw clientError;
        clientId = data.id;
      }

      const pixelId = draft.pixelId.trim();
      const testEventCode = sanitizeText(draft.testEventCode, 80) || null;
      const existingMeta = clientId ? metaByClientId.get(clientId) : null;
      if (pixelId) {
        if (existingMeta) {
          const { error: metaError } = await supabase
            .from("meta_configurations")
            .update({ pixel_id: pixelId, test_event_code: testEventCode, updated_at: new Date().toISOString() })
            .eq("id", existingMeta.id);
          if (metaError) throw metaError;
        } else {
          const { error: metaError } = await supabase
            .from("meta_configurations")
            .insert({ client_id: clientId, pixel_id: pixelId, test_event_code: testEventCode, is_default: false });
          if (metaError) throw metaError;
        }
      }

      toast.success("Client tracking config saved");
      setEditorOpen(false);
      setSelectedClient(null);
      await fetchAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEvent(client: Client) {
    const meta = metaByClientId.get(client.id);
    const redacted = redactedByClientId.get(client.id);
    if (!meta?.pixel_id || !tokenConfigured(redacted) || !meta.test_event_code) {
      toast.error("Test Event requires Pixel ID, configured CAPI token, and Test Event Code.");
      return;
    }
    setTesting(true);
    try {
      const result = await invokeAdminData("smoke_send_meta_event", {
        client_slug: client.slug,
        test_event_code: meta.test_event_code,
        event_name: "PageView",
      });
      if (result?.sent) toast.success("Safe Meta test event sent");
      else toast.error(result?.reason ?? "Test event was not sent");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <AdminShell
      eyebrow="Admin · Client Tracking"
      title="Client / Pixel Manager"
      subtitle={`${clients.length} client configs · secret-safe control plane`}
      belowHeader={<AdminPrimaryTabs />}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Active Clients" value={String(health.activeClients)} />
          <KpiCard label="Meta Configured" value={String(health.metaConfigured)} help="Browser pixel/dataset identifier used for PageView and event routing." />
          <KpiCard label="Google Configured" value={String(health.googleConfigured)} help="Google Ads account-level conversion destination." />
          <KpiCard label="Server GTM Configured" value={String(health.serverGtmConfigured)} help="Server-side GTM endpoint used to forward browser/server events." />
          <KpiCard label="Missing Secrets" value={String(health.missingSecrets)} help="Secure reference to the Meta access token. Raw token is not displayed." />
          <KpiCard label="Last Signal Failure" value={health.lastFailure} />
        </div>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-950" />
            <div>
              <div className="text-sm font-black text-amber-950">Secret storage path not configured</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">
                Existing Meta tokens are redacted by the admin edge function, but no Supabase Vault/secret-reference write path exists in this repo. Raw access tokens cannot be created or replaced from this UI.
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-950 shadow-sm">
            <AlertTriangle className="mr-2 inline h-4 w-4" /> {error}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-700" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients or slugs" className="border-slate-300 pl-9 text-slate-950 placeholder:text-slate-700" />
            {search ? <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1.5 inline-flex h-8 w-8 items-center justify-center text-slate-700"><X className="h-4 w-4" /></button> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchAll} disabled={loading} className="gap-2 border-slate-400 bg-white text-slate-950">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {hasWriteAccess ? (
              <Button onClick={() => openEditor(null)} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" /> Add Client
              </Button>
            ) : null}
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-700"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-xl font-black text-slate-950">Client tracking config table not found or empty</div>
              <p className="mt-2 text-sm font-semibold text-slate-700">Create/confirm client configs before enabling pixel management.</p>
            </div>
          ) : (
            <div className="wm-slim-scrollbar overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800">
                  <tr>
                    <th className="px-4 py-3">Client Name</th>
                    <th className="px-4 py-3">Client Slug <HelpTip>URL/config routing key used to associate leads and tracking config.</HelpTip></th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Meta Pixel <HelpTip>Browser pixel/dataset identifier used for PageView and event routing.</HelpTip></th>
                    <th className="px-4 py-3">Meta CAPI Secret <HelpTip>Secure reference to the Meta access token. Raw token is not displayed.</HelpTip></th>
                    <th className="px-4 py-3">Google Ads</th>
                    <th className="px-4 py-3">Server GTM</th>
                    <th className="px-4 py-3">Last Success</th>
                    <th className="px-4 py-3">Last Failure</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredClients.map((client) => {
                    const meta = metaByClientId.get(client.id) ?? null;
                    const redacted = redactedByClientId.get(client.id) ?? null;
                    const status = configStatus(client, meta, redacted, signalLogs);
                    const clientLogs = signalLogs.filter((log) => log.client_slug === client.slug);
                    const lastSuccess = clientLogs.find((log) => (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) < 300);
                    const lastFailure = clientLogs.find((log) => (log.status_code ?? 0) >= 400);
                    return (
                      <tr key={client.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-black text-slate-950">{client.name}</td>
                        <td className="px-4 py-4 font-mono text-sm font-bold text-slate-900">{client.slug}</td>
                        <td className="px-4 py-4"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                        <td className="px-4 py-4 font-mono text-sm font-bold text-slate-900">{maskId(meta?.pixel_id)}</td>
                        <td className="px-4 py-4">{tokenConfigured(redacted) ? <StatusBadge tone="emerald">Configured</StatusBadge> : <StatusBadge tone="red">Missing</StatusBadge>}</td>
                        <td className="px-4 py-4"><StatusBadge tone="slate">Not configured</StatusBadge></td>
                        <td className="px-4 py-4"><StatusBadge tone="slate">Not configured</StatusBadge></td>
                        <td className="px-4 py-4 font-bold text-slate-700">{formatTime(lastSuccess?.fired_at)}</td>
                        <td className="px-4 py-4 font-bold text-slate-700">{formatTime(lastFailure?.fired_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditor(client)} className="border-slate-400 bg-white text-slate-950"><Settings className="mr-1 h-3.5 w-3.5" /> Configure</Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button size="sm" variant="outline" disabled={testing || !meta?.pixel_id || !meta.test_event_code || !tokenConfigured(redacted)} onClick={() => sendTestEvent(client)} className="border-slate-400 bg-white text-slate-950 disabled:text-slate-700"><Send className="mr-1 h-3.5 w-3.5" /> Test Signal</Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="border border-slate-300 bg-white text-sm font-semibold text-slate-900">Sends a safe diagnostic event if backend support exists. Does not mark a lead sold.</TooltipContent>
                            </Tooltip>
                            <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/signal-dispatch?client_slug=${client.slug}`}>View Signals</Link></Button>
                            <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/attribution?client_slug=${client.slug}`}>View Attribution</Link></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Sheet open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) setSelectedClient(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-white sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-slate-950">Client configuration</SheetTitle>
            <SheetDescription className="font-semibold text-slate-700">Edit non-secret metadata only. Raw access tokens are never displayed or stored from this drawer.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {validationErrors.length > 0 ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                {validationErrors[0]}
              </div>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Client Identity</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="font-bold text-slate-700">friendly_name</Label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, slug: d.id ? d.slug : slugify(e.target.value) }))} className="border-slate-300 text-slate-950" /></div>
                <div className="space-y-1.5"><Label className="flex items-center gap-2 font-bold text-slate-700">client_slug <HelpTip>URL/config routing key used to associate leads and tracking config.</HelpTip></Label><Input value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))} className="border-slate-300 font-mono text-slate-950" /></div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-300 bg-white p-3"><Label className="font-bold text-slate-700">Active status</Label><Switch checked={draft.isActive} onCheckedChange={(value) => setDraft((d) => ({ ...d, isActive: value }))} disabled={!hasWriteAccess} /></div>
              <Textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes field not backed by current schema" className="border-slate-300 text-slate-950 placeholder:text-slate-700" disabled />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Meta Configuration</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="flex items-center gap-2 font-bold text-slate-700">Meta Pixel ID <HelpTip>Browser pixel/dataset identifier used for PageView and event routing.</HelpTip></Label><Input value={draft.pixelId} onChange={(e) => setDraft((d) => ({ ...d, pixelId: e.target.value.replace(/\D/g, "").slice(0, 20) }))} placeholder="123456789012345" className="border-slate-300 font-mono text-slate-950 placeholder:text-slate-700" /></div>
                <div className="space-y-1.5"><Label className="flex items-center gap-2 font-bold text-slate-700">Test Event Code <HelpTip>Sends a safe diagnostic event if backend support exists. Does not mark a lead sold.</HelpTip></Label><Input value={draft.testEventCode} onChange={(e) => setDraft((d) => ({ ...d, testEventCode: sanitizeText(e.target.value, 80) }))} placeholder="TEST12345" className="border-slate-300 font-mono text-slate-950 placeholder:text-slate-700" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyState label="CAPI Access Token Secret Reference" value={tokenConfigured(selectedRedacted) ? "configured · raw token hidden" : "missing"} help="Secure reference to the Meta access token. Raw token is not displayed." />
                <ReadOnlyState label="Dataset ID" value="Uses Pixel ID field" />
                <ReadOnlyState label="Last Meta success" value={formatTime(signalLogs.find((log) => log.client_slug === draft.slug && (log.status_code ?? 0) < 300)?.fired_at)} />
                <ReadOnlyState label="Last Meta failure" value={formatTime(signalLogs.find((log) => log.client_slug === draft.slug && (log.status_code ?? 0) >= 400)?.fired_at)} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Google Configuration</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DisabledField label="Google Ads Conversion ID" value={draft.googleConversionId} help="Google Ads account-level conversion destination." />
                <DisabledField label="Verified Lead Conversion Label" value={draft.googleVerifiedLeadLabel} help="Specific Google Ads conversion action label, such as verified lead or purchase." />
                <DisabledField label="Purchase/Sold Conversion Label" value={draft.googleSoldLabel} help="Specific Google Ads conversion action label, such as verified lead or purchase." />
                <ReadOnlyState label="Enhanced Conversions" value="Not configured" />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">GTM Server Configuration</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DisabledField label="Server container URL" value={draft.serverGtmUrl} help="Server-side GTM endpoint used to forward browser/server events." />
                <ReadOnlyState label="routing mode" value={draft.serverRoutingMode} />
                <ReadOnlyState label="last server hit" value="No signal logs yet" />
                <ReadOnlyState label="health state" value="Secret/config table prerequisite missing" />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Secret References</h3>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-slate-700">
                Secret storage path not configured. Token replacement requires a secure Edge Function + Vault/secret-reference schema. This UI will not accept raw access tokens.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyState label="Meta token reference" value={tokenConfigured(selectedRedacted) ? "legacy configured · token hidden" : "missing"} />
                <ReadOnlyState label="Google token reference" value="missing" />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Test / Validate</h3>
              <div className="grid gap-2 text-sm font-bold text-slate-700">
                <ChecklistItem ok={Boolean(draft.name && SLUG_REGEX.test(draft.slug))} label="Client identity valid" />
                <ChecklistItem ok={!draft.pixelId || PIXEL_REGEX.test(draft.pixelId)} label="Meta Pixel ID format valid" />
                <ChecklistItem ok={tokenConfigured(selectedRedacted)} label="CAPI token configured without exposing raw token" />
                <ChecklistItem ok={false} label="Google/GTM config tables not present" />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {hasWriteAccess ? <Button onClick={saveConfig} disabled={saving || validationErrors.length > 0} className="bg-slate-950 text-white hover:bg-slate-800">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save metadata</Button> : null}
                {selectedClient ? <Button variant="outline" disabled={testing || !selectedMeta?.pixel_id || !selectedMeta.test_event_code || !tokenConfigured(selectedRedacted)} onClick={() => sendTestEvent(selectedClient)} className="border-slate-400 bg-white text-slate-950"><Send className="mr-2 h-4 w-4" />Send Test Event</Button> : null}
                <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/signal-dispatch?client_slug=${draft.slug}`}>View Signals <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/attribution?client_slug=${draft.slug}`}>View Attribution <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}

function ReadOnlyState({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-700">{label}{help ? <HelpTip>{help}</HelpTip> : null}</div>
      <div className="mt-1 break-all text-sm font-bold text-slate-950">{value || "—"}</div>
    </div>
  );
}

function DisabledField({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2 font-bold text-slate-700">{label}<HelpTip>{help}</HelpTip></Label>
      <Input value={value} disabled placeholder="Requires client_configs schema" className="border-slate-300 bg-slate-50 text-slate-700 placeholder:text-slate-700" />
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
      <span>{label}</span>
    </div>
  );
}

export default function AdminPartners() {
  return (
    <AuthGuard>
      <AdminPartnersContent />
    </AuthGuard>
  );
}
