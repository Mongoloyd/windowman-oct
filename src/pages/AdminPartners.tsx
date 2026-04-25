/**
 * AdminPartners — White-label client management dashboard.
 * CRUD for clients + meta_configurations, realtime CAPI signal log.
 * P2: Idempotency guards, race condition handling, undo/restore, virtualized log, mobile touch targets.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { toast } from "sonner";
import {
  Plus, Check, Copy, ChevronDown, ChevronRight, X, Loader2,
  Globe, Settings, Radio, Trash2, Search, ArrowUpDown, Download,
  ArrowLeft, RotateCcw, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

/* ── Types ──────────────────────────────────────────────────── */

interface Client {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

interface MetaConfig {
  id: string;
  client_id: string | null;
  pixel_id: string | null;
  access_token: string | null;
  test_event_code: string | null;
  is_default: boolean;
  updated_at: string;
}

interface SignalLog {
  id: string;
  client_slug: string | null;
  event_name: string | null;
  pixel_id: string | null;
  status_code: number | null;
  payload: any;
  response: any;
  fired_at: string;
}

/* ── Helpers ────────────────────────────────────────────────── */

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Strip HTML tags and trim whitespace — prevents stored XSS */
function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

function relTime(iso: string) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

type SortKey = "name" | "slug" | "is_active" | "created_at";
type SortDir = "asc" | "desc";

/* ══════════════════════════════════════════════════════════════
   Client Dossier Modal
   ══════════════════════════════════════════════════════════════ */

interface DossierModalProps {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  metaConfig: MetaConfig | null;
  existingSlugs: string[];
  onSaved: () => void;
}

function ClientDossierModal({ open, onClose, client, metaConfig, existingSlugs, onSaved }: DossierModalProps) {
  const isEdit = !!client;
  const labelClass = "text-xs font-medium uppercase tracking-wider text-slate-700";
  const fieldClass = "min-w-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2";

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [tokenDirty, setTokenDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setName(client.name);
      setSlug(client.slug);
      setIsActive(client.is_active);
      setPixelId(metaConfig?.pixel_id ?? "");
      setAccessToken("");
      setTestEventCode(metaConfig?.test_event_code ?? "");
      setTokenDirty(false);
    } else {
      setName(""); setSlug(""); setIsActive(true);
      setPixelId(""); setAccessToken(""); setTestEventCode("");
      setTokenDirty(false);
    }
    setSlugError(null); setNameError(null); setTouched(false);
  }, [open, client, metaConfig]);

  useEffect(() => {
    if (!isEdit && name) setSlug(slugify(name));
  }, [name, isEdit]);

  useEffect(() => {
    if (!touched) { setNameError(null); return; }
    if (!name.trim()) { setNameError("Client name is required"); return; }
    if (name.trim().length > 100) { setNameError("Max 100 characters"); return; }
    setNameError(null);
  }, [name, touched]);

  useEffect(() => {
    if (!slug) { setSlugError(null); return; }
    if (!SLUG_REGEX.test(slug)) { setSlugError("Only lowercase letters, numbers, and hyphens"); return; }
    if (slug.length < 2) { setSlugError("Minimum 2 characters"); return; }
    const taken = existingSlugs.filter(s => s !== client?.slug).includes(slug);
    if (taken) { setSlugError("Slug already taken"); return; }
    setSlugError(null);
  }, [slug, existingSlugs, client]);

  const canSave = name.trim() && slug && !slugError && !nameError && !saving;

  async function handleSave() {
    if (saving) return; // Idempotency: prevent double-submit
    setTouched(true);
    if (!name.trim()) { setNameError("Client name is required"); return; }
    if (!canSave) return;
    setSaving(true);
    try {
      const safeName = sanitize(name);
      if (!safeName) throw new Error("Name cannot be empty after sanitization");

      let clientId: string;
      if (isEdit) {
        clientId = client!.id;
        const { error } = await supabase
          .from("clients")
          .update({ name: safeName, slug, is_active: isActive })
          .eq("id", clientId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({ name: safeName, slug, is_active: isActive })
          .select("id")
          .single();
        if (error) {
          if (error.code === "23505") { toast.error("A client with this slug already exists"); return; }
          throw error;
        }
        clientId = data.id;
      }

      if (pixelId.trim()) {
        type MetaConfigInsert = Database["public"]["Tables"]["meta_configurations"]["Insert"];
        const metaPayload: MetaConfigInsert = {
          client_id: clientId,
          pixel_id: sanitize(pixelId),
          test_event_code: testEventCode.trim() ? sanitize(testEventCode) : null,
        };
        if (tokenDirty && accessToken.trim()) {
          metaPayload.access_token = accessToken.trim();
        }
        if (metaConfig?.id) {
          const { error } = await supabase.from("meta_configurations").update(metaPayload).eq("id", metaConfig.id);
          if (error) throw error;
        } else {
          if (accessToken.trim()) metaPayload.access_token = accessToken.trim();
          const { error } = await supabase.from("meta_configurations").insert(metaPayload);
          if (error) throw error;
        }
      }

      toast.success(isEdit ? "Client updated" : "Client created");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[AdminPartners] save error:", err);
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const lpUrl = slug ? `${window.location.origin}/lp/${slug}` : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="font-sans sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 font-semibold tracking-tight">{isEdit ? "Edit Client" : "Add Client"}</DialogTitle>
          <DialogDescription className="text-slate-700">
            {isEdit ? "Update client details and CAPI configuration." : "Create a new white-label client."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className={labelClass}>Client Name</Label>
            <Input
              id="client-name" value={name} maxLength={100}
              onChange={e => { setName(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              placeholder="Acme Windows"
              className={`${fieldClass} ${nameError ? "border-destructive" : ""}`}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-slug" className={labelClass}>URL Slug</Label>
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs text-slate-700 whitespace-nowrap">/lp/</span>
              <Input
                id="client-slug" value={slug}
                onChange={e => setSlug(slugify(e.target.value))}
                placeholder="acme-windows"
                className={`${fieldClass} flex-1 ${slugError ? "border-destructive" : ""}`}
              />
            </div>
            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="client-active" className={labelClass}>Active</Label>
            <Switch id="client-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Meta Conversions API (CAPI)</p>
            <div className="space-y-1.5">
              <Label htmlFor="pixel-id" className={labelClass}>Pixel ID</Label>
              <Input id="pixel-id" value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="123456789012345" className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-token" className={labelClass}>Access Token</Label>
              <Textarea
                id="access-token" value={accessToken}
                onChange={e => { setAccessToken(e.target.value); setTokenDirty(true); }}
                placeholder={metaConfig?.access_token ? "••••••••  (unchanged)" : "Paste CAPI access token"}
                className={`${fieldClass} min-h-[100px] w-full resize-y font-mono text-sm`}
              />
              {isEdit && !tokenDirty && metaConfig?.access_token && (
                <p className="text-[11px] text-slate-700">Token on file. Only change if you paste a new one.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-event-code" className={labelClass}>Test Event Code <span className="text-slate-700">(optional)</span></Label>
              <Input id="test-event-code" value={testEventCode} onChange={e => setTestEventCode(e.target.value)} placeholder="TEST12345" className={fieldClass} />
            </div>
          </div>

          {lpUrl && <LandingPageUrl url={lpUrl} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} className="min-w-[88px]">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Landing Page URL with copy + Safari fallback ────────────── */

function LandingPageUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Safari / insecure context fallback — show manual copy modal
      setFallbackUrl(url);
    }
  }

  // Auto-select text when the fallback modal opens
  useEffect(() => {
    if (fallbackUrl && fallbackInputRef.current) {
      fallbackInputRef.current.select();
    }
  }, [fallbackUrl]);

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <Globe className="h-4 w-4 text-slate-700 shrink-0" />
        <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
        <Button size="sm" variant="ghost" className="h-11 w-11 min-w-[44px] min-h-[44px] p-0" onClick={handleCopy} aria-label="Copy URL">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Safari / iOS fallback: manual copy dialog */}
      <Dialog open={!!fallbackUrl} onOpenChange={(v) => !v && setFallbackUrl(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Landing Page URL</DialogTitle>
            <DialogDescription>
              Your browser blocked automatic clipboard access. Select the URL below and copy it manually.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={fallbackInputRef}
            readOnly
            value={fallbackUrl ?? ""}
            className="font-mono text-xs"
            onFocus={e => e.target.select()}
            aria-label="Landing page URL"
          />
          <DialogFooter>
            <Button onClick={() => setFallbackUrl(null)} className="min-h-[44px]">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Delete Confirmation ──────────────────────────────────────── */

function DeleteConfirmDialog({ open, clientName, deleting, onConfirm, onCancel }: {
  open: boolean; clientName: string; deleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate <strong>{clientName}</strong>. The client record will be preserved but marked inactive. You can restore it later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm} disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px] min-w-[44px]"
          >
            {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting…</> : "Delete Client"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ══════════════════════════════════════════════════════════════
   Sortable Column Header
   ══════════════════════════════════════════════════════════════ */

function SortableHeader({ label, sortKey, currentKey, currentDir, onSort, className }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 cursor-pointer select-none hover:text-foreground transition-colors ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "text-foreground" : "text-slate-700"}`} />
        {active && <span className="text-[9px]">{currentDir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}

/* ══════════════════════════════════════════════════════════════
   Virtualized Signal Log Row
   ══════════════════════════════════════════════════════════════ */

const LOG_ROW_HEIGHT = 40;
const LOG_VISIBLE_COUNT = 50;

function SignalLogRow({ log, expanded, onToggle }: { log: SignalLog; expanded: boolean; onToggle: () => void }) {
  const statusOk = log.status_code != null && log.status_code >= 200 && log.status_code < 300;
  return (
    <>
      <tr className="border-t hover:bg-muted/30 cursor-pointer transition-colors" onClick={onToggle}>
        <td className="px-3 py-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </td>
        <td className="px-3 py-2 font-mono">{log.event_name ?? "—"}</td>
        <td className="px-3 py-2">{log.client_slug ?? <span className="text-slate-700 italic">default</span>}</td>
        <td className="px-3 py-2 font-mono">{log.pixel_id ? `…${log.pixel_id.slice(-4)}` : "—"}</td>
        <td className="px-3 py-2 text-center">
          {log.status_code != null ? (
            <Badge variant={statusOk ? "default" : "destructive"} className={`text-[10px] ${statusOk ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}`}>
              {log.status_code}
            </Badge>
          ) : <span className="text-slate-700">—</span>}
        </td>
        <td className="px-3 py-2 text-right text-slate-700">{relTime(log.fired_at)}</td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Payload</p>
              <pre className="text-[11px] font-mono bg-background border rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.payload, null, 2) ?? "null"}
              </pre>
              {log.response && (
                <>
                  <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mt-2">Response</p>
                  <pre className="text-[11px] font-mono bg-background border rounded p-3 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(log.response, null, 2)}
                  </pre>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   Realtime Signal Log (multi-filter + CSV export + virtualization + resiliency)
   ══════════════════════════════════════════════════════════════ */

type ChannelState = "live" | "reconnecting" | "disconnected";

function SignalLogSection({ clients, sessionKey }: { clients: Client[]; sessionKey: string }) {
  const [logs, setLogs] = useState<SignalLog[]>([]);
  const [filterSlug, setFilterSlug] = useState<string>("all");
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LOG_VISIBLE_COUNT);
  const [channelState, setChannelState] = useState<ChannelState>("reconnecting");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch logs from REST (used on mount + manual refresh)
  const fetchLogs = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await supabase
        .from("capi_signal_logs")
        .select("*")
        .order("fired_at", { ascending: false })
        .limit(200);
      setLogs((data ?? []) as SignalLog[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Session-scoped: reset state when sessionKey changes
  useEffect(() => {
    setLogs([]);
    setFilterSlug("all");
    setFilterEvent("all");
    setExpandedId(null);
    setVisibleCount(LOG_VISIBLE_COUNT);
    setChannelState("reconnecting");
    fetchLogs(true);
  }, [sessionKey, fetchLogs]);

  // Realtime subscription with connection state tracking
  useEffect(() => {
    const channel = supabase
      .channel(`capi-signal-realtime-${sessionKey}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "capi_signal_logs" },
        (payload) => setLogs(prev => [payload.new as SignalLog, ...prev].slice(0, 500))
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setChannelState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setChannelState("disconnected");
        else if (status === "CLOSED") setChannelState("disconnected");
      });

    return () => { supabase.removeChannel(channel); };
  }, [sessionKey]);

  /** Unique event names for the event type filter */
  const eventNames = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) if (l.event_name) set.add(l.event_name);
    return Array.from(set).sort();
  }, [logs]);

  /** AND-logic: both filters must pass */
  const filtered = useMemo(() => {
    return logs.filter(l => {
      const slugMatch = filterSlug === "all" || (filterSlug === "default" ? !l.client_slug : l.client_slug === filterSlug);
      const eventMatch = filterEvent === "all" || l.event_name === filterEvent;
      return slugMatch && eventMatch;
    });
  }, [logs, filterSlug, filterEvent]);

  /** Virtualized slice */
  const visibleLogs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  /** Load more on scroll */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount(prev => Math.min(prev + LOG_VISIBLE_COUNT, filtered.length));
    }
  }, [filtered.length]);

  /** Build client slug→name map for CSV */
  const slugToName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) m[c.slug] = c.name;
    return m;
  }, [clients]);

  /** Stream-friendly chunked CSV export */
  function exportCsv() {
    const headers = ["id", "type", "partner_slug", "partner_name", "timestamp", "pixel_id", "status_code", "payload"];
    const chunks: string[] = [headers.join(",") + "\n"];
    const CHUNK_SIZE = 500;
    for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
      const slice = filtered.slice(i, i + CHUNK_SIZE);
      const block = slice.map(l => [
        l.id,
        l.event_name ?? "",
        l.client_slug ?? "default",
        l.client_slug ? (slugToName[l.client_slug] ?? l.client_slug) : "Default Pixel",
        new Date(l.fired_at).toISOString(),
        l.pixel_id ?? "",
        String(l.status_code ?? ""),
        JSON.stringify(l.payload ?? {}),
      ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      chunks.push(block + "\n");
    }
    const blob = new Blob(chunks, { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} signals`);
  }

  const stateLabel: Record<ChannelState, string> = { live: "Live", reconnecting: "Connecting…", disconnected: "Disconnected" };
  const stateDot: Record<ChannelState, string> = { live: "bg-emerald-500", reconnecting: "bg-amber-500 animate-pulse", disconnected: "bg-destructive" };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider">CAPI Signal Log</h2>
          <span className="text-xs text-slate-700">({filtered.length})</span>
          {/* Connection state indicator */}
          <span className="inline-flex items-center gap-1 ml-1" title={stateLabel[channelState]}>
            <span className={`w-1.5 h-1.5 rounded-full ${stateDot[channelState]}`} />
            <span className="text-[10px] text-slate-700">{stateLabel[channelState]}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual refresh button */}
          <Button
            size="sm" variant="outline"
            className="h-11 min-w-[44px] min-h-[44px] p-0 w-11"
            onClick={() => fetchLogs(false)}
            disabled={refreshing}
            title="Refresh signals"
            aria-label="Refresh signal log"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {/* Event type filter */}
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Signal type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {eventNames.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Client filter */}
          <Select value={filterSlug} onValueChange={setFilterSlug}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="default">Default Pixel</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* CSV export */}
          <Button size="sm" variant="outline" className="h-11 min-w-[44px] min-h-[44px] text-xs px-3" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-700 text-center py-8">No signals match the current filters.</p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="border rounded-lg overflow-auto max-h-[600px]"
        >
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 w-6"></th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Pixel</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map(log => (
                <SignalLogRow
                  key={log.id} log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                />
              ))}
              {visibleCount < filtered.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center">
                    <Button
                      size="sm" variant="ghost" className="text-xs h-8"
                      onClick={() => setVisibleCount(prev => Math.min(prev + LOG_VISIBLE_COUNT, filtered.length))}
                    >
                      Load more ({filtered.length - visibleCount} remaining)
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════════════════════ */

function AdminPartnersContent() {
  const { hasWriteAccess, isViewer } = useCurrentUserRole();
  const [clients, setClients] = useState<Client[]>([]);
  const [configs, setConfigs] = useState<MetaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search & sort
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Session key for scoping signal log state — changes whenever client list refreshes
  const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchAll = useCallback(async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("meta_configurations").select("*"),
    ]);
    setClients((c ?? []) as Client[]);
    setConfigs((m ?? []) as MetaConfig[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const configByClientId = useMemo(() => {
    const map: Record<string, MetaConfig> = {};
    for (const mc of configs) if (mc.client_id) map[mc.client_id] = mc;
    return map;
  }, [configs]);

  /** Filtered + sorted client list */
  const displayClients = useMemo(() => {
    let list = clients;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "slug") cmp = a.slug.localeCompare(b.slug);
      else if (sortKey === "is_active") cmp = Number(a.is_active) - Number(b.is_active);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [clients, debouncedSearch, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openCreate() {
    if (!hasWriteAccess) { toast.error("You don't have permission to create clients"); return; }
    setEditClient(null);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    if (!hasWriteAccess) { toast.error("You don't have permission to edit clients"); return; }
    setEditClient(c);
    setModalOpen(true);
  }

  /** Restore (undo soft-delete) — sets is_active back to true */
  async function handleRestore(client: Client) {
    try {
      const { error, data } = await supabase
        .from("clients")
        .update({ is_active: true })
        .eq("id", client.id)
        .select("id")
        .single();
      // Race condition: record was hard-deleted or doesn't exist
      if (error || !data) {
        toast.error("This record has already been removed and cannot be restored.");
        return;
      }
      toast.success(`"${client.name}" has been restored`);
      fetchAll();
    } catch {
      toast.error("Restore failed");
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !hasWriteAccess || deleting) return; // Idempotency guard
    setDeleting(true);
    try {
      // Race condition: check the record still exists and is active before soft-deleting
      const { data: current, error: fetchError } = await supabase
        .from("clients")
        .select("id, is_active, name")
        .eq("id", deleteTarget.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!current) {
        toast.info("This record has already been removed.");
        setDeleteTarget(null);
        fetchAll();
        return;
      }

      if (!current.is_active) {
        toast.info(`"${current.name}" was already deactivated.`);
        setDeleteTarget(null);
        fetchAll();
        return;
      }

      const { error } = await supabase.from("clients").update({ is_active: false }).eq("id", deleteTarget.id);
      if (error) throw error;

      const deletedName = deleteTarget.name;
      const deletedClient = { ...deleteTarget };
      setDeleteTarget(null);
      fetchAll();

      // Undo toast with restore action
      toast.success(`"${deletedName}" has been deactivated`, {
        action: {
          label: "Undo",
          onClick: () => handleRestore(deletedClient),
        },
        duration: 8000,
      });
    } catch (err: any) {
      console.error("[AdminPartners] delete error:", err);
      toast.error(err?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const existingSlugs = clients.map(c => c.slug);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex items-center gap-1 text-xs text-slate-700 hover:text-primary transition-colors mr-1 min-h-[44px] min-w-[44px] justify-center">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CRM</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">White-Label Partners</h1>
              <p className="text-xs text-slate-700 mt-0.5">
                {clients.length} client{clients.length !== 1 ? "s" : ""} configured
              </p>
            </div>
          </div>
          {hasWriteAccess && (
            <Button size="sm" onClick={openCreate} className="min-h-[44px] min-w-[44px]">
              <Plus className="h-4 w-4 mr-1.5" /> Add Client
            </Button>
          )}
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-8">
        {/* ── Search bar ── */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-700" />
          <Input
            placeholder="Search clients…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-11"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5 text-slate-700 hover:text-foreground" />
            </button>
          )}
        </div>

        {/* ── Client List ── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
          </div>
        ) : displayClients.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-card">
            <p className="text-sm text-slate-700">
              {debouncedSearch ? `No clients match "${debouncedSearch}"` : 'No clients yet. Click "Add Client" to get started.'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-slate-700">
                  <SortableHeader label="Client" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Slug" sortKey="slug" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2.5 text-center">Pixel Status</th>
                  <SortableHeader label="Active" sortKey="is_active" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-center" />
                  <SortableHeader label="Created" sortKey="created_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayClients.map(c => {
                  const mc = configByClientId[c.id];
                  const ready = !!(mc?.pixel_id && mc?.access_token);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">/lp/{c.slug}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={ready ? "default" : "secondary"}
                          className={ready ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}
                        >
                          {ready ? "Ready" : "Needs Setup"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {hasWriteAccess ? (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="min-h-[44px] min-w-[44px] px-3"
                              onClick={() => openEdit(c)}
                            >
                              <Settings className="h-3.5 w-3.5 mr-1" /> Manage
                            </Button>
                            {c.is_active ? (
                              <Button
                                size="sm" variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px] p-0"
                                onClick={() => setDeleteTarget(c)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                size="sm" variant="ghost"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 min-h-[44px] min-w-[44px] p-0"
                                onClick={() => handleRestore(c)}
                                title="Restore client"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-700 italic">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Signal Log ── */}
        <SignalLogSection clients={clients} sessionKey={sessionKey} />
      </div>

      {/* ── Dossier Modal ── */}
      <ClientDossierModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditClient(null); }}
        client={editClient}
        metaConfig={editClient ? configByClientId[editClient.id] ?? null : null}
        existingSlugs={existingSlugs}
        onSaved={() => {
          fetchAll();
          setSessionKey(crypto.randomUUID()); // Reset signal log session on data change
        }}
      />

      {/* ── Delete Confirmation ── */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        clientName={deleteTarget?.name ?? ""}
        deleting={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
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
