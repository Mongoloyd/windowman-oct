import { useMemo, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ClipboardCopy,
  Code2,
  FileJson,
  FileText,
  FlaskConical,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  RUBRIC_VERSION,
  type ExtractionResult,
  type LineItem,
} from "../../../supabase/functions/scan-quote/scoring.ts";
import {
  buildExportEnvelope,
  cloneExtraction,
  DEFAULT_EXPERIMENTAL_WEIGHTS,
  evaluatePlayground,
  getPresetExtraction,
  getWeightSum,
  parseImportedExtraction,
  QUICK_PRESETS,
  type ExperimentalWeights,
  type WeightKey,
} from "./scoringPlaygroundModel";

const SYSTEM_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

const PANEL_CLASS =
  "border-slate-800/90 bg-[#11161e] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_45px_rgba(0,0,0,0.22)]";
const INPUT_CLASS =
  "min-h-12 border-slate-700 bg-[#172131] text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500";
const BUTTON_FOCUS =
  "min-h-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0f]";

const WEIGHT_LABELS: Record<WeightKey, string> = {
  safety: "Safety",
  install: "Install",
  price: "Price",
  finePrint: "Fine Print",
  warranty: "Warranty",
};

function formatJson(extraction: ExtractionResult): string {
  return JSON.stringify(extraction, null, 2);
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ControlPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className={PANEL_CLASS}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <span className="text-blue-400">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium text-slate-400">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
  risk = false,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  risk?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <Label
        htmlFor={id}
        className={`cursor-pointer text-sm leading-5 ${risk ? "text-rose-300" : "text-slate-200"}`}
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0 data-[state=checked]:bg-blue-500"
      />
    </div>
  );
}

function PillarBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">
          {label} <span className="text-slate-500">({weight}%)</span>
        </span>
        <span className="font-semibold text-slate-100" style={{ fontFamily: MONO_FONT }}>
          {score}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800" role="meter" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function WeightControl({
  weightKey,
  value,
  onChange,
}: {
  weightKey: WeightKey;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <Label htmlFor={`weight-${weightKey}`} className="text-slate-300">
          {WEIGHT_LABELS[weightKey]}
        </Label>
        <span className="font-semibold text-blue-400" style={{ fontFamily: MONO_FONT }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        id={`weight-${weightKey}`}
        aria-label={`${WEIGHT_LABELS[weightKey]} experimental weight`}
        value={value}
        min={0}
        max={100}
        step={5}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-12 w-full cursor-pointer accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0f]"
      />
    </div>
  );
}

export default function ScoringPlayground() {
  const initialPreset = QUICK_PRESETS[0];
  const [activePreset, setActivePreset] = useState(initialPreset.key);
  const [extraction, setExtraction] = useState<ExtractionResult>(() =>
    getPresetExtraction(initialPreset.key),
  );
  const [weights, setWeights] = useState<ExperimentalWeights>(() => ({
    ...DEFAULT_EXPERIMENTAL_WEIGHTS,
  }));
  const [selectedLineItemIndex, setSelectedLineItemIndex] = useState(0);
  const [jsonInput, setJsonInput] = useState(() => formatJson(extraction));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const outcome = useMemo(() => evaluatePlayground(extraction, weights), [extraction, weights]);
  const weightSum = getWeightSum(weights);

  const commitExtraction = (mutate: (draft: ExtractionResult) => void) => {
    const next = cloneExtraction(extraction);
    mutate(next);
    setExtraction(next);
    setJsonInput(formatJson(next));
    setJsonError(null);
    setActivePreset("custom");
  };

  const loadPreset = (key: string) => {
    const next = getPresetExtraction(key);
    setExtraction(next);
    setWeights({ ...DEFAULT_EXPERIMENTAL_WEIGHTS });
    setSelectedLineItemIndex(0);
    setJsonInput(formatJson(next));
    setJsonError(null);
    setActivePreset(key);
  };

  const updateTopLevel = <K extends keyof ExtractionResult>(
    key: K,
    value: ExtractionResult[K],
  ) => commitExtraction((draft) => {
    draft[key] = value;
  });

  const updateLineItem = <K extends keyof LineItem>(key: K, value: LineItem[K]) => {
    commitExtraction((draft) => {
      if (!draft.line_items[selectedLineItemIndex]) return;
      draft.line_items[selectedLineItemIndex][key] = value;
    });
  };

  const addLineItem = () => {
    commitExtraction((draft) => {
      draft.line_items.push({ description: "New impact opening" });
    });
    setSelectedLineItemIndex(extraction.line_items.length);
  };

  const removeLineItem = () => {
    commitExtraction((draft) => {
      draft.line_items.splice(selectedLineItemIndex, 1);
    });
    setSelectedLineItemIndex((current) => Math.max(0, current - 1));
  };

  const updateWeight = (key: WeightKey, value: number) => {
    setWeights((current) => ({ ...current, [key]: value }));
  };

  const importJson = () => {
    try {
      const next = parseImportedExtraction(jsonInput);
      setExtraction(next);
      setSelectedLineItemIndex(0);
      setJsonInput(formatJson(next));
      setJsonError(null);
      setActivePreset("custom");
      toast.success("Local fixture imported");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fixture import failed.";
      setJsonError(message);
      toast.error("Fixture import rejected");
    }
  };

  const exportExperiment = async () => {
    try {
      const envelope = buildExportEnvelope(extraction, weights);
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(JSON.stringify(envelope, null, 2));
      toast.success("Experiment JSON copied");
    } catch {
      toast.error("Clipboard is unavailable in this browser");
    }
  };

  const selectedLineItem = extraction.line_items[selectedLineItemIndex];
  const penalties = outcome.kind === "scored"
    ? Object.entries(outcome.trace.pillars).flatMap(([pillar, trace]) =>
        trace.penalties.map((penalty) => ({ pillar, ...penalty })),
      )
    : [];

  const uniqueContext = outcome.kind === "scored"
    ? {
        brands: [...new Set(extraction.line_items.map((item) => item.brand).filter(Boolean))],
        series: [...new Set(extraction.line_items.map((item) => item.series).filter(Boolean))],
        noaNumbers: [...new Set(extraction.line_items.map((item) => item.noa_number).filter(Boolean))],
        dpRatings: [...new Set(extraction.line_items.map((item) => item.dp_rating).filter(Boolean))],
      }
    : null;

  return (
    <div
      className="min-h-screen bg-[#070a0f] text-slate-100 motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none"
      style={{ fontFamily: SYSTEM_FONT }}
      data-testid="scoring-playground"
    >
      <Helmet>
        <title>Master Control Room | WindowMan DEV</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <main className="mx-auto max-w-[2062px] px-4 py-6 sm:px-6 lg:px-7 lg:py-8">
        <header className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <FlaskConical className="h-7 w-7 text-blue-400" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Master Control Room
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-400 sm:text-base">
              Canonical rubric {RUBRIC_VERSION} · Math X-Ray · local fixture import · weight experiments
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2" aria-label="Canonical fixture presets">
            {QUICK_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                onClick={() => loadPreset(preset.key)}
                aria-pressed={activePreset === preset.key}
                className={`${BUTTON_FOCUS} border-slate-700 bg-transparent px-4 text-slate-100 hover:border-blue-400 hover:bg-blue-500/10 ${
                  activePreset === preset.key ? "border-blue-400 bg-blue-500/15 text-blue-100" : ""
                }`}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => loadPreset(initialPreset.key)}
              className={`${BUTTON_FOCUS} px-4 text-slate-300 hover:bg-slate-800 hover:text-white`}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset All
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="space-y-5 lg:col-span-3" aria-label="Scoring inputs">
            <ControlPanel title="Document" icon={<FileText className="h-4 w-4" />}>
              <ToggleRow
                id="is-window-door-related"
                label="Window / door related"
                checked={extraction.is_window_door_related}
                onCheckedChange={(checked) => updateTopLevel("is_window_door_related", checked)}
              />
              <TextField
                id="document-type"
                label="Document type"
                value={extraction.document_type}
                onChange={(value) => updateTopLevel("document_type", value)}
              />
              <TextField
                id="confidence"
                label="Extraction confidence (0–1)"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={extraction.confidence}
                onChange={(value) => updateTopLevel("confidence", Number(value))}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="total-price"
                  label="Total price ($)"
                  type="number"
                  min={0}
                  value={extraction.total_quoted_price}
                  onChange={(value) => updateTopLevel("total_quoted_price", parseOptionalNumber(value))}
                />
                <TextField
                  id="opening-count"
                  label="Openings"
                  type="number"
                  min={0}
                  value={extraction.opening_count}
                  onChange={(value) => updateTopLevel("opening_count", parseOptionalNumber(value))}
                />
              </div>
              <TextField
                id="contractor-name"
                label="Contractor name (fixture only)"
                value={extraction.contractor_name}
                onChange={(value) => updateTopLevel("contractor_name", value || undefined)}
              />
            </ControlPanel>

            <ControlPanel title="Line Items" icon={<Code2 className="h-4 w-4" />}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="line-item-selector" className="text-xs text-slate-400">
                    Active item
                  </Label>
                  <select
                    id="line-item-selector"
                    value={selectedLineItemIndex}
                    onChange={(event) => setSelectedLineItemIndex(Number(event.target.value))}
                    className={`${INPUT_CLASS} w-full rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {extraction.line_items.map((item, index) => (
                      <option key={`${index}-${item.description}`} value={index}>
                        {index + 1}. {item.description || "Untitled item"}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="outline" aria-label="Add line item" onClick={addLineItem} className={`${BUTTON_FOCUS} mt-6 border-slate-700 bg-transparent px-3 text-slate-100 hover:bg-slate-800`}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" aria-label="Remove selected line item" onClick={removeLineItem} disabled={!selectedLineItem} className={`${BUTTON_FOCUS} mt-6 border-slate-700 bg-transparent px-3 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {selectedLineItem ? (
                <>
                  <TextField id="item-description" label="Description" value={selectedLineItem.description} onChange={(value) => updateLineItem("description", value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField id="item-quantity" label="Quantity" type="number" min={0} value={selectedLineItem.quantity} onChange={(value) => updateLineItem("quantity", parseOptionalNumber(value))} />
                    <TextField id="item-unit-price" label="Unit price" type="number" min={0} value={selectedLineItem.unit_price} onChange={(value) => updateLineItem("unit_price", parseOptionalNumber(value))} />
                    <TextField id="item-brand" label="Brand" value={selectedLineItem.brand} onChange={(value) => updateLineItem("brand", value || undefined)} />
                    <TextField id="item-series" label="Series" value={selectedLineItem.series} onChange={(value) => updateLineItem("series", value || undefined)} />
                    <TextField id="item-dp" label="DP rating" value={selectedLineItem.dp_rating} onChange={(value) => updateLineItem("dp_rating", value || undefined)} />
                    <TextField id="item-noa" label="NOA number" value={selectedLineItem.noa_number} onChange={(value) => updateLineItem("noa_number", value || undefined)} />
                  </div>
                  <ToggleRow id="item-glass-complete" label="Glass package complete" checked={selectedLineItem.glass_spec_complete === true} onCheckedChange={(checked) => updateLineItem("glass_spec_complete", checked)} />
                </>
              ) : (
                <p className="text-sm text-slate-500">No line items. Add one to continue the production gate.</p>
              )}
            </ControlPanel>

            <ControlPanel title="Safety & Evidence" icon={<ShieldCheck className="h-4 w-4" />}>
              <ToggleRow id="hvhz-zone" label="HVHZ zone identified" checked={extraction.hvhz_zone === true} onCheckedChange={(checked) => updateTopLevel("hvhz_zone", checked)} />
              <ToggleRow id="opening-glass" label="Opening-level glass specs" checked={extraction.opening_level_glass_specs_present === true} onCheckedChange={(checked) => updateTopLevel("opening_level_glass_specs_present", checked)} />
              <ToggleRow id="blanket-glass" label="Blanket glass language" risk checked={extraction.blanket_glass_language_present === true} onCheckedChange={(checked) => updateTopLevel("blanket_glass_language_present", checked)} />
              <ToggleRow id="generic-product" label="Generic product description" risk checked={extraction.generic_product_description_present === true} onCheckedChange={(checked) => updateTopLevel("generic_product_description_present", checked)} />
              <ToggleRow id="manufacturer-compliance" label="Manufacturer install compliance" checked={extraction.manufacturer_install_compliance_stated === true} onCheckedChange={(checked) => updateTopLevel("manufacturer_install_compliance_stated", checked)} />
              <ToggleRow id="code-compliance" label="Code-compliant install stated" checked={extraction.code_compliance_install_statement_present === true} onCheckedChange={(checked) => updateTopLevel("code_compliance_install_statement_present", checked)} />
              <ToggleRow id="licensing-proof" label="Licensing proof mentioned" checked={extraction.licensing_proof_mentioned === true} onCheckedChange={(checked) => updateTopLevel("licensing_proof_mentioned", checked)} />
            </ControlPanel>

            <ControlPanel title="Installation Scope" icon={<CheckCircle2 className="h-4 w-4" />}>
              <ToggleRow id="permits-included" label="Permits included" checked={extraction.permits?.included === true} onCheckedChange={(checked) => commitExtraction((draft) => { draft.permits = { ...draft.permits, included: checked }; })} />
              <ToggleRow id="disposal-included" label="Disposal included" checked={extraction.installation?.disposal_included === true} onCheckedChange={(checked) => commitExtraction((draft) => { draft.installation = { ...draft.installation, disposal_included: checked }; })} />
              <ToggleRow id="accessories-mentioned" label="Accessories mentioned" checked={extraction.installation?.accessories_mentioned === true} onCheckedChange={(checked) => commitExtraction((draft) => { draft.installation = { ...draft.installation, accessories_mentioned: checked }; })} />
              <TextField id="scope-detail" label="Installation scope" value={extraction.installation?.scope_detail} onChange={(value) => commitExtraction((draft) => { draft.installation = { ...draft.installation, scope_detail: value || undefined }; })} />
              <TextField id="wall-repair" label="Wall / stucco repair scope" value={extraction.wall_repair_scope} onChange={(value) => updateTopLevel("wall_repair_scope", value || undefined)} />
              <ToggleRow id="stucco-included" label="Stucco repair included" checked={extraction.stucco_repair_included === true} onCheckedChange={(checked) => updateTopLevel("stucco_repair_included", checked)} />
              <ToggleRow id="drywall-included" label="Drywall repair included" checked={extraction.drywall_repair_included === true} onCheckedChange={(checked) => updateTopLevel("drywall_repair_included", checked)} />
              <ToggleRow id="paint-included" label="Paint touch-up included" checked={extraction.paint_touchup_included === true} onCheckedChange={(checked) => updateTopLevel("paint_touchup_included", checked)} />
              <ToggleRow id="opening-schedule" label="Opening schedule present" checked={extraction.opening_schedule_present === true} onCheckedChange={(checked) => updateTopLevel("opening_schedule_present", checked)} />
              <TextField id="anchoring-method" label="Anchoring method" value={extraction.anchoring_method_text} onChange={(value) => updateTopLevel("anchoring_method_text", value || undefined)} />
              <TextField id="waterproofing-method" label="Waterproofing method" value={extraction.waterproofing_method_text} onChange={(value) => updateTopLevel("waterproofing_method_text", value || undefined)} />
              <ToggleRow id="sealant-specified" label="Sealant specified" checked={extraction.sealant_specified === true} onCheckedChange={(checked) => updateTopLevel("sealant_specified", checked)} />
            </ControlPanel>

            <ControlPanel title="Fine Print & Payment" icon={<AlertTriangle className="h-4 w-4" />}>
              <TextField id="deposit-percent" label="Deposit percent" type="number" min={0} max={100} value={extraction.deposit_percent} onChange={(value) => updateTopLevel("deposit_percent", parseOptionalNumber(value))} />
              <TextField id="cancellation-policy" label="Cancellation policy" value={extraction.cancellation_policy} onChange={(value) => updateTopLevel("cancellation_policy", value || undefined)} />
              <TextField id="payment-schedule" label="Payment schedule" value={extraction.payment_schedule_text} onChange={(value) => updateTopLevel("payment_schedule_text", value || undefined)} />
              <ToggleRow id="final-before-inspection" label="Final payment before inspection" risk checked={extraction.final_payment_before_inspection === true} onCheckedChange={(checked) => updateTopLevel("final_payment_before_inspection", checked)} />
              <ToggleRow id="subject-remeasure" label="Subject to remeasure" risk checked={extraction.subject_to_remeasure_present === true} onCheckedChange={(checked) => updateTopLevel("subject_to_remeasure_present", checked)} />
              <ToggleRow id="terms-present" label="Terms and conditions present" checked={extraction.terms_conditions_present === true} onCheckedChange={(checked) => updateTopLevel("terms_conditions_present", checked)} />
              <ToggleRow id="written-change-order" label="Written change order required" checked={extraction.written_change_order_required === true} onCheckedChange={(checked) => updateTopLevel("written_change_order_required", checked)} />
              <ToggleRow id="homeowner-approval" label="Homeowner approval required" checked={extraction.homeowner_approval_required_for_change_orders === true} onCheckedChange={(checked) => updateTopLevel("homeowner_approval_required_for_change_orders", checked)} />
              <ToggleRow id="unilateral-adjustment" label="Unilateral price adjustment" risk checked={extraction.unilateral_price_adjustment_allowed === true} onCheckedChange={(checked) => updateTopLevel("unilateral_price_adjustment_allowed", checked)} />
              <ToggleRow id="substrate-clause" label="Substrate condition clause" checked={extraction.substrate_condition_clause_present === true} onCheckedChange={(checked) => updateTopLevel("substrate_condition_clause_present", checked)} />
              <ToggleRow id="rot-pricing" label="Rot unit pricing" checked={extraction.rot_unit_pricing_present === true} onCheckedChange={(checked) => updateTopLevel("rot_unit_pricing_present", checked)} />
              <ToggleRow id="buck-pricing" label="Buck replacement pricing" checked={extraction.buck_replacement_unit_pricing_present === true} onCheckedChange={(checked) => updateTopLevel("buck_replacement_unit_pricing_present", checked)} />
            </ControlPanel>

            <ControlPanel title="Warranty" icon={<ShieldCheck className="h-4 w-4" />}>
              <ToggleRow
                id="warranty-present"
                label="Warranty section present"
                checked={!!extraction.warranty}
                onCheckedChange={(checked) => commitExtraction((draft) => {
                  draft.warranty = checked ? (draft.warranty ?? { details: "Warranty provided" }) : undefined;
                })}
              />
              {extraction.warranty ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField id="labor-years" label="Labor years" type="number" min={0} value={extraction.warranty.labor_years} onChange={(value) => commitExtraction((draft) => { draft.warranty = { ...draft.warranty, labor_years: parseOptionalNumber(value) }; })} />
                    <TextField id="manufacturer-years" label="Manufacturer years" type="number" min={0} value={extraction.warranty.manufacturer_years} onChange={(value) => commitExtraction((draft) => { draft.warranty = { ...draft.warranty, manufacturer_years: parseOptionalNumber(value) }; })} />
                  </div>
                  <ToggleRow id="warranty-transferable" label="Transferable" checked={extraction.warranty.transferable === true} onCheckedChange={(checked) => commitExtraction((draft) => { draft.warranty = { ...draft.warranty, transferable: checked }; })} />
                  <TextField id="warranty-details" label="Warranty details" value={extraction.warranty.details} onChange={(value) => commitExtraction((draft) => { draft.warranty = { ...draft.warranty, details: value || undefined }; })} />
                </>
              ) : null}
              <ToggleRow id="warranty-execution" label="Execution details present" checked={extraction.warranty_execution_details_present === true} onCheckedChange={(checked) => updateTopLevel("warranty_execution_details_present", checked)} />
              <TextField id="callback-process" label="Callback process" value={extraction.callback_process_text} onChange={(value) => updateTopLevel("callback_process_text", value || undefined)} />
              <ToggleRow id="stucco-excluded" label="Post-install stucco excluded" risk checked={extraction.post_install_stucco_excluded === true} onCheckedChange={(checked) => updateTopLevel("post_install_stucco_excluded", checked)} />
              <ToggleRow id="paint-excluded" label="Post-install paint excluded" risk checked={extraction.post_install_paint_excluded === true} onCheckedChange={(checked) => updateTopLevel("post_install_paint_excluded", checked)} />
            </ControlPanel>
          </section>

          <section className="space-y-5 lg:col-span-5" aria-label="Canonical scoring result">
            {outcome.kind === "terminal" ? (
              <Card className={`${PANEL_CLASS} border-amber-500/40`} data-testid="terminal-outcome">
                <CardContent className="p-7">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="mt-1 h-8 w-8 shrink-0 text-amber-300" />
                    <div>
                      <Badge className="mb-3 bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">
                        Production gate: {outcome.gate.analysisStatus}
                      </Badge>
                      <h2 className="text-2xl font-bold text-white">No grade is produced</h2>
                      <p className="mt-2 text-slate-300">{outcome.gate.reason}</p>
                      <p className="mt-4 text-sm text-slate-500">
                        This local fixture follows the same fail-closed classification gate as the scanner.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className={PANEL_CLASS}>
                  <CardContent className="grid gap-6 p-7 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
                        Canonical production result
                      </p>
                      <div className="mt-2 flex items-end gap-4">
                        <span className="text-7xl font-bold leading-none text-blue-400" data-testid="canonical-grade">
                          {outcome.canonical.letterGrade}
                        </span>
                        <div className="pb-1">
                          <p className="text-base text-slate-400">Weighted score</p>
                          <p className="text-xl font-semibold text-white" style={{ fontFamily: MONO_FONT }}>
                            {outcome.canonical.weightedAverage.toFixed(2)} / 100
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-slate-500">
                        Rubric {RUBRIC_VERSION} · immutable scorer output
                      </p>
                    </div>

                    <div className="min-w-44 rounded-lg border border-blue-500/25 bg-blue-500/[0.07] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                        Local experiment
                      </p>
                      {outcome.experiment.kind === "ready" ? (
                        <>
                          <p className="mt-2 text-3xl font-bold text-white" data-testid="experiment-grade">
                            {outcome.experiment.result.finalGrade}
                          </p>
                          <p className="text-sm text-slate-400">
                            {outcome.experiment.result.weightedAverage.toFixed(2)} / 100
                          </p>
                          <p className="mt-2 text-xs text-slate-500">Not production behavior</p>
                        </>
                      ) : outcome.experiment.kind === "invalid_weights" ? (
                        <p className="mt-3 text-sm text-rose-300" role="alert">
                          Weights total {outcome.experiment.weightSum}%. Set them to 100%.
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-rose-300" role="alert">
                          Diagnostics parity failed. Experiment disabled.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <ControlPanel title="Pillar Breakdown" icon={<Beaker className="h-4 w-4" />}>
                  <PillarBar label="Safety" score={outcome.canonical.pillarScores.safety} weight={DEFAULT_EXPERIMENTAL_WEIGHTS.safety} />
                  <PillarBar label="Install" score={outcome.canonical.pillarScores.install} weight={DEFAULT_EXPERIMENTAL_WEIGHTS.install} />
                  <PillarBar label="Price" score={outcome.canonical.pillarScores.price} weight={DEFAULT_EXPERIMENTAL_WEIGHTS.price} />
                  <PillarBar label="Fine Print" score={outcome.canonical.pillarScores.finePrint} weight={DEFAULT_EXPERIMENTAL_WEIGHTS.finePrint} />
                  <PillarBar label="Warranty" score={outcome.canonical.pillarScores.warranty} weight={DEFAULT_EXPERIMENTAL_WEIGHTS.warranty} />
                </ControlPanel>

                <Accordion type="multiple" defaultValue={["math"]} className="rounded-lg border border-slate-800 bg-[#0d1219] px-5">
                  <AccordionItem value="math" className="border-slate-800">
                    <AccordionTrigger className="min-h-14 text-sm font-semibold text-slate-100 hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400">
                      Math X-Ray
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pb-3 text-xs" style={{ fontFamily: MONO_FONT }}>
                        {Object.entries(outcome.canonical.pillarScores).map(([key, score]) => (
                          <div key={key} className="flex justify-between gap-4 rounded-md bg-slate-900/70 px-3 py-2">
                            <span className="text-slate-400">
                              {WEIGHT_LABELS[key as WeightKey]}: {score} × {DEFAULT_EXPERIMENTAL_WEIGHTS[key as WeightKey]}%
                            </span>
                            <span className="text-blue-300">
                              {(score * DEFAULT_EXPERIMENTAL_WEIGHTS[key as WeightKey] / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <Separator className="bg-slate-800" />
                        <div className="flex justify-between text-sm font-bold text-white">
                          <span>Canonical weighted average</span>
                          <span>{outcome.canonical.weightedAverage.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-300">
                          <span>Applied hard cap</span>
                          <span>{outcome.canonical.hardCapApplied ?? "None"}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="grid gap-5 md:grid-cols-2">
                  <ControlPanel title={`Hard-cap signals (${outcome.trace.hardCaps.filter((cap) => cap.applied).length})`} icon={<AlertTriangle className="h-4 w-4" />}>
                    {outcome.trace.hardCaps.filter((cap) => cap.applied).length ? (
                      outcome.trace.hardCaps.filter((cap) => cap.applied).map((cap) => (
                        <div key={cap.cap} className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] p-3">
                          <p className="text-xs font-semibold text-rose-200">{cap.cap}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{cap.reason}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">None</p>
                    )}
                  </ControlPanel>

                  <ControlPanel title={`Deductions (${penalties.length})`} icon={<FileJson className="h-4 w-4" />}>
                    {penalties.length ? (
                      penalties.slice(0, 8).map((penalty) => (
                        <div key={`${penalty.pillar}-${penalty.rule}`} className="flex gap-3 text-xs">
                          <span className="font-semibold text-amber-300" style={{ fontFamily: MONO_FONT }}>−{penalty.points}</span>
                          <span className="leading-5 text-slate-400">{penalty.reason}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">None</p>
                    )}
                  </ControlPanel>
                </div>

                <Card className={PANEL_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Canonical trace summary</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {penalties.length} deterministic deductions across five pillars. Diagnostics parity is{" "}
                      <span className={outcome.trace.parityOk ? "text-emerald-300" : "text-rose-300"}>
                        {outcome.trace.parityOk ? "confirmed" : "not confirmed"}
                      </span>.
                    </p>
                  </CardContent>
                </Card>

                <Accordion type="multiple" className="rounded-lg border border-slate-800 bg-[#0d1219] px-5">
                  <AccordionItem value="forensic" className="border-slate-800">
                    <AccordionTrigger className="min-h-14 text-sm font-semibold text-slate-100 hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400">
                      Forensic deduction ledger
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pb-4">
                        {Object.entries(outcome.trace.pillars).map(([pillar, trace]) => (
                          <div key={pillar}>
                            <p className="mb-2 text-sm font-semibold capitalize text-blue-300">{pillar}</p>
                            {trace.penalties.length ? (
                              <ul className="space-y-2">
                                {trace.penalties.map((penalty) => (
                                  <li key={penalty.rule} className="text-xs leading-5 text-slate-400">
                                    <span className="text-slate-200">{penalty.rule}</span>: −{penalty.points} · {penalty.reason}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-600">No deductions</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="context" className="border-slate-800">
                    <AccordionTrigger className="min-h-14 text-sm font-semibold text-slate-100 hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400">
                      Extracted context
                    </AccordionTrigger>
                    <AccordionContent>
                      <dl className="grid gap-3 pb-4 text-xs sm:grid-cols-2" style={{ fontFamily: MONO_FONT }}>
                        <div><dt className="text-slate-500">Contractor</dt><dd className="mt-1 text-slate-200">{extraction.contractor_name ?? "—"}</dd></div>
                        <div><dt className="text-slate-500">License evidence</dt><dd className="mt-1 text-slate-200">{extraction.licensing_proof_mentioned === true ? "Mentioned" : "Not confirmed"}</dd></div>
                        <div><dt className="text-slate-500">Brands</dt><dd className="mt-1 text-slate-200">{uniqueContext?.brands.join(", ") || "—"}</dd></div>
                        <div><dt className="text-slate-500">Series</dt><dd className="mt-1 text-slate-200">{uniqueContext?.series.join(", ") || "—"}</dd></div>
                        <div><dt className="text-slate-500">NOA numbers</dt><dd className="mt-1 text-slate-200">{uniqueContext?.noaNumbers.join(", ") || "—"}</dd></div>
                        <div><dt className="text-slate-500">DP ratings</dt><dd className="mt-1 text-slate-200">{uniqueContext?.dpRatings.join(", ") || "—"}</dd></div>
                      </dl>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="caps" className="border-0">
                    <AccordionTrigger className="min-h-14 text-sm font-semibold text-slate-100 hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400">
                      Hard-cap evaluation details
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pb-4">
                        {outcome.trace.hardCaps.map((cap) => (
                          <div key={cap.cap} className="grid gap-2 rounded-md bg-slate-900/70 p-3 text-xs sm:grid-cols-[1fr_auto]">
                            <div>
                              <p className="font-semibold text-slate-200">{cap.cap}</p>
                              <p className="mt-1 text-slate-500">{cap.reason}</p>
                            </div>
                            <Badge variant="outline" className={cap.applied ? "border-rose-500/40 text-rose-300" : "border-slate-700 text-slate-500"}>
                              {cap.applied ? `Max ${cap.resultingMaxGrade}` : "Not triggered"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}
          </section>

          <aside className="space-y-5 lg:col-span-4" aria-label="Weight and JSON tools">
            <ControlPanel title="Pillar Weights" icon={<Beaker className="h-4 w-4" />}>
              <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                <span className="text-xs text-slate-500">Local experiment only</span>
                <Badge
                  variant="outline"
                  className={weightSum === 100 ? "border-emerald-500/40 text-emerald-300" : "border-rose-500/40 text-rose-300"}
                  aria-live="polite"
                >
                  Σ = {weightSum}%
                </Badge>
              </div>
              {(Object.keys(WEIGHT_LABELS) as WeightKey[]).map((key) => (
                <WeightControl key={key} weightKey={key} value={weights[key]} onChange={(value) => updateWeight(key, value)} />
              ))}
              {weightSum !== 100 ? (
                <p className="rounded-md border border-rose-500/30 bg-rose-500/[0.07] p-3 text-sm text-rose-200" role="alert">
                  Experimental output is disabled until weights total exactly 100%.
                </p>
              ) : null}
              <Separator className="bg-slate-800" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => setWeights({ ...DEFAULT_EXPERIMENTAL_WEIGHTS })} className={`${BUTTON_FOCUS} border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Weights
                </Button>
                <Button type="button" onClick={exportExperiment} className={`${BUTTON_FOCUS} bg-blue-600 text-white hover:bg-blue-500`}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Export Experiment
                </Button>
              </div>
            </ControlPanel>

            <ControlPanel title="Import Fixture JSON" icon={<FileJson className="h-4 w-4" />}>
              <p className="text-xs leading-5 text-slate-500">
                Paste one canonical ExtractionResult fixture. Do not paste persisted report payloads, full_json, sessions, or customer contact data.
              </p>
              <Textarea
                aria-label="Fixture JSON"
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                className="min-h-64 border-slate-700 bg-[#172131] text-xs text-slate-200 focus-visible:ring-blue-500"
                style={{ fontFamily: MONO_FONT }}
              />
              {jsonError ? (
                <p className="rounded-md border border-rose-500/30 bg-rose-500/[0.07] p-3 text-sm text-rose-200" role="alert">
                  {jsonError}
                </p>
              ) : null}
              <Button type="button" onClick={importJson} disabled={!jsonInput.trim()} className={`${BUTTON_FOCUS} w-full bg-blue-600 text-white hover:bg-blue-500`}>
                <FileJson className="mr-2 h-4 w-4" />
                Import & Score Locally
              </Button>
            </ControlPanel>

            <Card className="border-blue-500/25 bg-blue-500/[0.05] text-slate-200">
              <CardContent className="p-5 text-xs leading-5">
                <p className="font-semibold text-blue-200">Isolation guarantee</p>
                <p className="mt-2 text-slate-400">
                  This DEV-only instrument performs deterministic calculations in React memory. It does not upload, persist, authorize, track, or change the production rubric.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
