import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchContractorOutcomeDetail,
  fetchContractorOutcomeIntegrityRows,
  formatOutcomeIntegrityReasons,
  maskOutcomeId,
  summarizeOutcomeHealth,
  type ContractorOutcomeIntegrityRow,
  type ContractorOutcomeStatus,
  type OutcomeIntegrityStatus,
  type OutcomeValueBasis,
} from "@/services/contractorOutcomeIntegrity";

const OUTCOME_STATUSES: Array<ContractorOutcomeStatus | "all"> = ["all", "new", "attempting_contact", "contacted", "meeting_scheduled", "scheduled", "quote_delivered", "sold_closed", "lost_dead", "disputed", "manual_review", "invalid"];
const INTEGRITY_STATUSES: Array<OutcomeIntegrityStatus | "all"> = ["all", "valid", "warning", "blocked", "needs_review"];
const VALUE_BASES: Array<OutcomeValueBasis | "all"> = ["all", "contract_total", "gross_sale_value", "true_margin", "estimated_contract_value", "unknown"];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function fmtMoney(value: number | null, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(value);
}

function statusTone(status: string) {
  if (status === "valid") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "warning") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "blocked") return "border-rose-300 bg-rose-50 text-rose-900";
  return "border-slate-300 bg-slate-100 text-slate-900";
}

function outcomeTone(status: string) {
  if (status === "sold_closed") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "lost_dead") return "border-slate-300 bg-slate-100 text-slate-900";
  if (status === "disputed" || status === "invalid") return "border-rose-300 bg-rose-50 text-rose-900";
  if (status === "manual_review") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-blue-300 bg-blue-50 text-blue-900";
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-950">{value ?? "—"}</p>
    </div>
  );
}

function OutcomeDetailDrawer({ row, open, onOpenChange }: { row: ContractorOutcomeIntegrityRow | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const explanations = row ? formatOutcomeIntegrityReasons(row.outcome_integrity_reasons) : [];
  const metaKeys = Array.isArray(row?.safe_metadata?.metadata_keys) ? row.safe_metadata.metadata_keys.join(", ") : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white p-5 text-slate-950 sm:max-w-4xl">
        <SheetHeader className="pr-8">
          <SheetTitle className="text-xl font-black text-slate-950">Contractor Outcome Detail</SheetTitle>
          <SheetDescription className="font-semibold text-slate-700">
            Revenue truth source: contractor_outcomes. No external dispatch occurs from this inspector.
          </SheetDescription>
        </SheetHeader>

        {!row ? (
          <div className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-700">Select an outcome to inspect.</div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-800">
              Contractor outcomes are the sold/lost source of truth. Leads are rollups only. Lead assignments are operational ownership only. external_dispatch=false.
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Outcome ID" value={maskOutcomeId(row.outcome_id)} />
              <DetailField label="Opportunity ID" value={maskOutcomeId(row.opportunity_id)} />
              <DetailField label="Lead ID" value={maskOutcomeId(row.lead_id)} />
              <DetailField label="Scan Session ID" value={maskOutcomeId(row.scan_session_id)} />
              <DetailField label="Analysis ID" value={maskOutcomeId(row.analysis_id)} />
              <DetailField label="Assignment ID" value={maskOutcomeId(row.lead_assignment_id)} />
              <DetailField label="Client Slug" value={row.client_slug} />
              <DetailField label="Assignment Client" value={row.assignment_client_slug} />
              <DetailField label="Contractor Account" value={row.contractor_account_name ?? maskOutcomeId(row.contractor_account_id)} />
              <DetailField label="Contractor Company" value={row.contractor_company_name} />
              <DetailField label="Outcome Status" value={row.outcome_status} />
              <DetailField label="Integrity Status" value={row.outcome_integrity_status} />
              <DetailField label="Sold Amount" value={fmtMoney(row.sold_amount, row.sold_currency)} />
              <DetailField label="Currency" value={row.sold_currency} />
              <DetailField label="Value Basis" value={row.value_basis} />
              <DetailField label="Lost Reason Code" value={row.lost_reason_code} />
              <DetailField label="Lost Reason" value={row.lost_reason} />
              <DetailField label="Outcome Source" value={row.outcome_source} />
              <DetailField label="Outcome Verified" value={row.outcome_verified ? "Yes" : "No"} />
              <DetailField label="Verified At" value={fmtDate(row.outcome_verified_at)} />
              <DetailField label="Future Signal Eligibility" value={row.eligible_for_future_signal ? "Eligible after Phase 3F rules" : "Not eligible"} />
              <DetailField label="No External Dispatch" value={row.safe_metadata.external_dispatch === false ? "Confirmed false" : "Not asserted"} />
              <DetailField label="Metadata Keys" value={metaKeys} />
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="text-base font-black text-slate-950">Integrity Reason Explainer</h3>
              <div className="mt-3 space-y-2">
                {row.outcome_integrity_reasons.map((reason, index) => (
                  <div key={`${reason}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Badge className="border border-slate-300 bg-white font-black text-slate-950">{reason}</Badge>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{explanations[index]}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ContractorOutcomeInspector() {
  const [rows, setRows] = useState<ContractorOutcomeIntegrityRow[]>([]);
  const [detail, setDetail] = useState<ContractorOutcomeIntegrityRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [clientSlug, setClientSlug] = useState("");
  const [outcomeStatus, setOutcomeStatus] = useState<ContractorOutcomeStatus | "all">("all");
  const [integrityStatus, setIntegrityStatus] = useState<OutcomeIntegrityStatus | "all">("all");
  const [valueBasis, setValueBasis] = useState<OutcomeValueBasis | "all">("all");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [soldOnly, setSoldOnly] = useState(false);
  const [lostOnly, setLostOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchContractorOutcomeIntegrityRows({ clientSlug, outcomeStatus, integrityStatus, valueBasis, needsReviewOnly, soldOnly, lostOnly, search });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outcome data failed to load.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientSlug, outcomeStatus, integrityStatus, valueBasis, needsReviewOnly, soldOnly, lostOnly, search]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const summary = useMemo(() => summarizeOutcomeHealth(rows), [rows]);

  async function openDetail(row: ContractorOutcomeIntegrityRow) {
    setDetail(row);
    setDetailOpen(true);
    try {
      setDetail(await fetchContractorOutcomeDetail(row.outcome_id));
    } catch {
      setDetail(row);
    }
  }

  const emptyLabel = needsReviewOnly ? "No outcomes need review." : rows.length === 0 && (clientSlug || search || outcomeStatus !== "all" || integrityStatus !== "all" || valueBasis !== "all") ? "Filters returned no results." : "No outcomes found.";

  return (
    <section className="min-h-[70vh] bg-slate-50 text-slate-950">
      <div className="space-y-5">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-600">Phase 3E · Revenue Integrity</p>
              <h2 className="text-2xl font-black text-slate-950">Outcome Inspector</h2>
            </div>
            <Button variant="outline" className="border-slate-300 bg-white font-bold text-slate-950" onClick={loadRows} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-800">
            Contractor outcomes are the revenue source of truth. Leads and assignments are context/rollups only. No external dispatch occurs from this screen.
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Total" value={summary.total} />
          <KpiCard label="Valid" value={summary.valid} />
          <KpiCard label="Warnings" value={summary.warning} />
          <KpiCard label="Blocked" value={summary.blocked} />
          <KpiCard label="Needs Review" value={summary.needsReview} />
          <KpiCard label="Sold Closed" value={summary.soldClosed} />
          <KpiCard label="Lost Dead" value={summary.lostDead} />
          <KpiCard label="Disputed" value={summary.disputed} />
          <KpiCard label="Gross Proxy" value={summary.grossProxy} />
          <KpiCard label="Missing Value / Lost Reason" value={`${summary.missingValue} / ${summary.missingLostReason}`} />
        </div>

        <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-xs font-black uppercase tracking-wide text-slate-600">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input className="border-slate-300 bg-white pl-9 text-slate-950" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Outcome, assignment, lead, scan, analysis ID" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wide text-slate-600">Client Slug</Label>
              <Input className="border-slate-300 bg-white text-slate-950" value={clientSlug} onChange={(event) => setClientSlug(event.target.value)} placeholder="all" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wide text-slate-600">Outcome Status</Label>
              <Select value={outcomeStatus} onValueChange={(value) => setOutcomeStatus(value as typeof outcomeStatus)}>
                <SelectTrigger className="border-slate-300 bg-white text-slate-950"><SelectValue /></SelectTrigger>
                <SelectContent>{OUTCOME_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wide text-slate-600">Integrity Status</Label>
              <Select value={integrityStatus} onValueChange={(value) => setIntegrityStatus(value as typeof integrityStatus)}>
                <SelectTrigger className="border-slate-300 bg-white text-slate-950"><SelectValue /></SelectTrigger>
                <SelectContent>{INTEGRITY_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wide text-slate-600">Value Basis</Label>
              <Select value={valueBasis} onValueChange={(value) => setValueBasis(value as typeof valueBasis)}>
                <SelectTrigger className="border-slate-300 bg-white text-slate-950"><SelectValue /></SelectTrigger>
                <SelectContent>{VALUE_BASES.map((basis) => <SelectItem key={basis} value={basis}>{basis}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-2 md:col-span-2">
              <Button variant={needsReviewOnly ? "default" : "outline"} className={needsReviewOnly ? "bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-950"} onClick={() => setNeedsReviewOnly((v) => !v)}>Needs review only</Button>
              <Button variant={soldOnly ? "default" : "outline"} className={soldOnly ? "bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-950"} onClick={() => setSoldOnly((v) => !v)}>Sold only</Button>
              <Button variant={lostOnly ? "default" : "outline"} className={lostOnly ? "bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-950"} onClick={() => setLostOnly((v) => !v)}>Lost only</Button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-950">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error === "You may not have internal operator permissions." ? "You may not have internal operator permissions." : "Outcome data failed to load."}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-slate-700">Created</TableHead>
                <TableHead className="text-slate-700">Outcome</TableHead>
                <TableHead className="text-slate-700">Client</TableHead>
                <TableHead className="text-slate-700">Lead / Assignment</TableHead>
                <TableHead className="text-slate-700">Contractor</TableHead>
                <TableHead className="text-slate-700">Status</TableHead>
                <TableHead className="text-slate-700">Sold</TableHead>
                <TableHead className="text-slate-700">Basis</TableHead>
                <TableHead className="text-slate-700">Lost Reason</TableHead>
                <TableHead className="text-slate-700">Integrity</TableHead>
                <TableHead className="text-slate-700">Reasons</TableHead>
                <TableHead className="text-right text-slate-700">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="h-32 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-600" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="h-32 text-center text-sm font-bold text-slate-600">{emptyLabel}</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.outcome_id} className="hover:bg-slate-50">
                  <TableCell className="font-semibold text-slate-700">{fmtDate(row.created_at)}</TableCell>
                  <TableCell className="font-black text-slate-950">{maskOutcomeId(row.outcome_id)}</TableCell>
                  <TableCell className="font-bold text-slate-800">{row.client_slug ?? "—"}</TableCell>
                  <TableCell className="text-xs font-semibold text-slate-700"><div>{maskOutcomeId(row.lead_id)}</div><div>{maskOutcomeId(row.lead_assignment_id)}</div></TableCell>
                  <TableCell className="font-semibold text-slate-700">{row.contractor_account_name ?? row.contractor_company_name ?? maskOutcomeId(row.contractor_account_id)}</TableCell>
                  <TableCell><Badge className={`border ${outcomeTone(row.outcome_status)}`}>{row.outcome_status}</Badge></TableCell>
                  <TableCell className="font-bold text-slate-900">{fmtMoney(row.sold_amount, row.sold_currency)} <span className="text-xs text-slate-500">{row.sold_currency}</span></TableCell>
                  <TableCell className="font-semibold text-slate-700">{row.value_basis}</TableCell>
                  <TableCell className="max-w-[180px] truncate font-semibold text-slate-700">{row.lost_reason ?? row.lost_reason_code ?? "—"}</TableCell>
                  <TableCell><Badge className={`border ${statusTone(row.outcome_integrity_status)}`}>{row.outcome_integrity_status}</Badge></TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs font-semibold text-slate-600">{row.outcome_integrity_reasons.join(", ")}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => void openDetail(row)}><Eye className="mr-1 h-4 w-4" />Detail</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-slate-700" />
          This inspector is read-only and prepares Phase 3F canonical revenue signal integration without sending events.
        </div>
      </div>

      <OutcomeDetailDrawer row={detail} open={detailOpen} onOpenChange={setDetailOpen} />
    </section>
  );
}
