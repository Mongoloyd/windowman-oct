/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTRACTOR ONBOARDING SURFACE — Phase 12
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface for managing one contractor account cleanly,
 * and surfacing what would be needed before onboarding a second contractor
 * later. Composed entirely of:
 *
 *   • Repo-real reads via the centralized admin client (`fetchContractors`,
 *     `fetchOpportunities`, `fetchRoutes`) using TanStack Query.
 *   • Pure useMemo derivations (observed coverage, handoff visibility).
 *   • Static copy describing CURRENT system behavior only.
 *   • Local-only checklist (sessionStorage, clearly non-canonical).
 *   • Read-only quick links into existing admin tabs.
 *
 * STRICT CONSTRAINTS (Phase 12):
 *   • No new edge functions. No new endpoints. No schema changes.
 *   • No backend persistence for the readiness checklist.
 *   • No fabricated billing / portal / territory enforcement.
 *   • No editable fields without a real existing admin mutation.
 *   • Reuses existing surfaces; does not duplicate logic.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import {
  fetchContractors,
  fetchOpportunities,
  fetchRoutes,
} from "@/services/adminDataService";
import type {
  RoutingContractor,
  RoutingOpportunity,
  RoutingRoute,
} from "@/types/routingDesk";

// ─── Local-only readiness checklist (sessionStorage, non-canonical) ────
const CHECKLIST_KEY = "wm_contractor_onboarding_checklist_v1";

const DEFAULT_CHECKLIST: { id: string; label: string; hint?: string }[] = [
  {
    id: "company_confirmed",
    label: "Company name + status confirmed",
    hint: "Match Contractors tab. Active = okay to route.",
  },
  {
    id: "contact_verified",
    label: "Primary contact email + phone verified",
    hint: "Operator has reached this contact at least once.",
  },
  {
    id: "handoff_path_known",
    label: "Handoff path is known (call / text / email)",
    hint: "Operator knows what channel to use when sending a lead.",
  },
  {
    id: "coverage_aligned",
    label: "Coverage matches observed county routing",
    hint: "Counties of routed leads match where this contractor actually works.",
  },
  {
    id: "release_path_tested",
    label: "Release / contact-release path tested at least once",
    hint: "Confirm Routing Desk → release → handoff works end-to-end.",
  },
  {
    id: "second_contractor_ready",
    label: "Notes captured for onboarding a second contractor later",
    hint: "Capture any market overlaps, capacity, or restrictions.",
  },
];

type ChecklistState = Record<string, boolean>;

function loadChecklist(): ChecklistState {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(CHECKLIST_KEY);
    return raw ? (JSON.parse(raw) as ChecklistState) : {};
  } catch {
    return {};
  }
}

function saveChecklist(state: ChecklistState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    /* non-canonical, ignore quota failures */
  }
}

// ─── Component ─────────────────────────────────────────────────────────

interface Props {
  onNavigateTab?: (tab: string) => void;
}

export function ContractorOnboardingSurface({ onNavigateTab }: Props) {
  const { data: contractors, isLoading: contractorsLoading } = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 30_000,
  });

  const { data: opps } = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });

  const { data: routes } = useQuery({
    queryKey: ["admin", "routes", "all"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });

  // ─── Active contractor selection ─────────────────────────────────────
  // Today's system is single-contractor-first. We pick the first ACTIVE
  // contractor and let the operator switch if more exist.
  const sortedContractors = useMemo(() => {
    const arr = (contractors as RoutingContractor[] | undefined) ?? [];
    return [...arr].sort((a, b) => {
      // Active first, then alphabetical.
      const aActive = a.status === "active" ? 0 : 1;
      const bActive = b.status === "active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (a.company_name ?? "").localeCompare(b.company_name ?? "");
    });
  }, [contractors]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeContractor = useMemo<RoutingContractor | null>(() => {
    if (!sortedContractors.length) return null;
    if (selectedId) {
      return sortedContractors.find((c) => c.id === selectedId) ?? sortedContractors[0];
    }
    return sortedContractors[0];
  }, [sortedContractors, selectedId]);

  // ─── Observed coverage (operator-view) ────────────────────────────────
  // Since contractor-specific service-area is not always backed by repo-real
  // data exposed to admin reads, we derive an OBSERVED coverage view from
  // routes pointing at this contractor + their parent opportunity counties.
  const observedCoverage = useMemo(() => {
    if (!activeContractor) return { counties: [] as string[], routedCount: 0, withCounty: 0 };
    const oppsArr = (opps as RoutingOpportunity[] | undefined) ?? [];
    const routesArr = (routes as RoutingRoute[] | undefined) ?? [];
    const oppById = new Map(oppsArr.map((o) => [o.id, o]));

    const counties = new Set<string>();
    let routedCount = 0;
    let withCounty = 0;
    for (const r of routesArr) {
      if (r.contractor_id !== activeContractor.id) continue;
      routedCount++;
      const opp = oppById.get(r.opportunity_id);
      const county = opp?.county?.trim();
      if (county && county.length > 0) {
        counties.add(county);
        withCounty++;
      }
    }
    return {
      counties: Array.from(counties).sort(),
      routedCount,
      withCounty,
    };
  }, [activeContractor, opps, routes]);

  // ─── Handoff visibility ─────────────────────────────────────────────
  const handoff = useMemo(() => {
    if (!activeContractor) {
      return { hasEmail: false, hasContact: false, missing: [] as string[] };
    }
    const missing: string[] = [];
    if (!activeContractor.contact_name) missing.push("Contact name");
    if (!activeContractor.email) missing.push("Email");
    return {
      hasEmail: !!activeContractor.email,
      hasContact: !!activeContractor.contact_name,
      missing,
    };
  }, [activeContractor]);

  // ─── Local checklist state ──────────────────────────────────────────
  const [checklist, setChecklist] = useState<ChecklistState>({});
  useEffect(() => {
    setChecklist(loadChecklist());
  }, []);
  const toggleChecklist = useCallback((id: string) => {
    setChecklist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveChecklist(next);
      return next;
    });
  }, []);
  const checklistDoneCount = useMemo(
    () => DEFAULT_CHECKLIST.filter((it) => checklist[it.id]).length,
    [checklist]
  );

  // ─── Helpers ─────────────────────────────────────────────────────────
  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const goTab = useCallback(
    (tab: string) => {
      if (onNavigateTab) onNavigateTab(tab);
      else toast.info(`Open the “${tab}” tab to continue`);
    },
    [onNavigateTab]
  );

  // ─── Render ──────────────────────────────────────────────────────────
  if (contractorsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Contractor Onboarding
            </h2>
            <p className="text-xs text-slate-700 mt-1 max-w-2xl leading-relaxed">
              Internal operator surface to manage one contractor account cleanly and
              prepare the system for onboarding a second contractor later. All
              displayed data is repo-real or clearly labeled operator-view.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Internal · Operator Use
          </Badge>
        </div>
      </div>

      {/* ── Contractor selector ──────────────────────────────────── */}
      {sortedContractors.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Building2 className="mx-auto h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-700">
              No contractors found in the marketplace registry yet.
            </p>
          </CardContent>
        </Card>
      ) : sortedContractors.length > 1 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCircle2 className="h-4 w-4" />
              Active Contractor ({sortedContractors.length} available)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sortedContractors.map((c) => {
                const isActive = activeContractor?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:bg-muted/40 text-slate-700"
                    }`}
                  >
                    {c.company_name}
                    {c.status !== "active" && (
                      <span className="ml-1.5 text-[10px] uppercase opacity-70">
                        · {c.status}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeContractor && (
        <>
          {/* ── Profile ──────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCircle2 className="h-4 w-4" />
                Contractor Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField label="Company Name" value={activeContractor.company_name} />
              <ProfileField
                label="Status"
                value={
                  <Badge
                    variant={activeContractor.status === "active" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {activeContractor.status}
                  </Badge>
                }
              />
              <ProfileField label="Contact Name" value={activeContractor.contact_name ?? "—"} />
              <ProfileField
                label="Contractor ID"
                value={
                  <code className="text-[11px] font-mono text-slate-700">
                    {activeContractor.id}
                  </code>
                }
              />
            </CardContent>
          </Card>

          {/* ── Handoff Contact Details ──────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="h-4 w-4" />
                Handoff Contact Details
              </CardTitle>
              <p className="text-[11px] text-slate-700 mt-1">
                What the operator uses when routing a lead to this contractor today.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ContactRow
                icon={Mail}
                label="Email"
                value={activeContractor.email ?? null}
                onCopy={() =>
                  activeContractor.email && copyText(activeContractor.email, "Email")
                }
              />
              <ContactRow
                icon={UserCircle2}
                label="Contact"
                value={activeContractor.contact_name ?? null}
                onCopy={() =>
                  activeContractor.contact_name &&
                  copyText(activeContractor.contact_name, "Contact name")
                }
              />
              <ContactRow
                icon={Phone}
                label="Phone"
                value={null}
                hint="Phone is not surfaced through the current admin read; check Contractors tab if needed."
              />
              {handoff.missing.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-700">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      Missing handoff info:
                    </span>{" "}
                    {handoff.missing.join(", ")}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Coverage / Market Presence (observed) ────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Observed Coverage{" "}
                <span className="text-[10px] uppercase tracking-wider text-slate-700 font-normal">
                  (operator view)
                </span>
              </CardTitle>
              <p className="text-[11px] text-slate-700 mt-1">
                Counties derived from opportunities actually routed to this
                contractor. Contractor-declared service area is not separately
                modeled in the current admin read.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Routes Observed" value={observedCoverage.routedCount} />
                <Stat label="With County" value={observedCoverage.withCounty} />
                <Stat label="Counties Covered" value={observedCoverage.counties.length} />
              </div>
              {observedCoverage.counties.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {observedCoverage.counties.map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px]">
                      {c}
                    </Badge>
                  ))}
                  {observedCoverage.routedCount > observedCoverage.withCounty && (
                    <Badge variant="secondary" className="text-[10px]">
                      Unknown County ×
                      {observedCoverage.routedCount - observedCoverage.withCounty}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-700 italic">
                  No routed opportunities observed for this contractor yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Routing Assumptions / Current System Use ─────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Routing Assumptions · Current System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-relaxed text-slate-700">
              <Assumption>
                Routing is <span className="text-foreground">operator-controlled</span>{" "}
                today via the Routing Desk. There is no automated round-robin or
                shared-market allocation.
              </Assumption>
              <Assumption>
                Ownership and release timestamps are tracked on each route
                (`viewed_at`, `responded_at`, `interested_at`,
                `contact_released_at`). Operator-view "stale" derivations live in
                Outcome Tracking and Pilot Ops.
              </Assumption>
              <Assumption>
                Contractor handoff happens via the channels shown above. There is
                no contractor self-serve portal in this phase.
              </Assumption>
              <Assumption>
                Territory/exclusivity is{" "}
                <span className="text-foreground">not enforced</span> today.
                Coverage shown above is observed from real routes only.
              </Assumption>
              <Assumption>
                Onboarding a second contractor later will require: declared
                service counties, capacity expectations, handoff channel, and an
                operator-agreed routing rule. None of these are automated yet.
              </Assumption>
            </CardContent>
          </Card>

          {/* ── Onboarding Readiness Checklist ───────────────────── */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Onboarding Readiness
                </CardTitle>
                <p className="text-[11px] text-slate-700 mt-1">
                  Local-only · stored in this browser session. Not saved to the
                  backend.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {checklistDoneCount}/{DEFAULT_CHECKLIST.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEFAULT_CHECKLIST.map((item) => {
                const done = !!checklist[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    className={`w-full text-left rounded-md border p-3 transition-colors flex items-start gap-3 ${
                      done
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border bg-background hover:bg-muted/40"
                    }`}
                  >
                    <CheckCircle2
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        done ? "text-emerald-600" : "text-slate-700"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-medium ${
                          done ? "line-through text-slate-700" : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </p>
                      {item.hint && (
                        <p className="text-[11px] text-slate-700 mt-0.5">
                          {item.hint}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* ── Handoff snippet (copy-to-clipboard) ──────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Operator Handoff Snippet
              </CardTitle>
              <p className="text-[11px] text-slate-700 mt-1">
                Reusable internal note when handing a lead to {activeContractor.company_name}.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-3">
                <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-700 leading-relaxed">
{`Routing to: ${activeContractor.company_name}
Contact: ${activeContractor.contact_name ?? "—"}
Email: ${activeContractor.email ?? "—"}
Status: ${activeContractor.status}
Notes: Operator-controlled handoff. Confirm receipt + capacity before sending next.`}
                </pre>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      copyText(
                        `Routing to: ${activeContractor.company_name}\nContact: ${activeContractor.contact_name ?? "—"}\nEmail: ${activeContractor.email ?? "—"}\nStatus: ${activeContractor.status}\nNotes: Operator-controlled handoff. Confirm receipt + capacity before sending next.`,
                        "Handoff snippet"
                      )
                    }
                  >
                    <Copy className="h-3 w-3 mr-1.5" />
                    Copy
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Quick Links ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickLink label="Routing Desk" onClick={() => goTab("routing")} />
          <QuickLink label="Active Pipeline" onClick={() => goTab("pipeline")} />
          <QuickLink label="Outcome Tracking" onClick={() => goTab("outcomes")} />
          <QuickLink label="Pilot Ops / Launch Control" onClick={() => goTab("launch")} />
          <QuickLink label="Pilot Readiness" onClick={() => goTab("pilot")} />
          <QuickLink label="Contractors (Accounts)" onClick={() => goTab("contractors")} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-700 font-semibold">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  hint,
  onCopy,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  hint?: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-3">
      <Icon className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-700 font-semibold">
          {label}
        </p>
        {value ? (
          <p className="text-sm text-foreground truncate">{value}</p>
        ) : (
          <p className="text-sm text-slate-700 italic">
            {hint ?? "Not on file"}
          </p>
        )}
      </div>
      {value && onCopy && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onCopy}
          title={`Copy ${label.toLowerCase()}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-700 mt-1.5 font-semibold">
        {label}
      </p>
    </div>
  );
}

function Assumption({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <ChevronRight className="h-3.5 w-3.5 text-slate-700 shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-md border bg-background hover:bg-muted/40 px-3 py-2 text-xs text-foreground transition-colors"
    >
      <span>{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
    </button>
  );
}
