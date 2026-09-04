import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";

type MappingOption = {
  canonical_key: string;
  label: string;
  destination: "lead" | "qualification";
};

type RecognizedField = {
  original_key: string;
  question_label: string;
  canonical_key: string;
  sanitized_value: string | null;
};

type UnknownField = {
  original_key: string;
  question_label: string;
  original_value: unknown;
};

type ReplayResult = {
  recognized_fields: RecognizedField[];
  unknown_fields: UnknownField[];
  missing_required_fields: string[];
  normalized_lead: Record<string, unknown>;
  validation_errors: string[];
  form_id: string | null;
  platform_lead_id: string | null;
  source_shape: string;
  dedup_decision: {
    action: "create" | "update" | "reject";
    reason: string;
  };
  mapping_options: MappingOption[];
  can_save_mappings: boolean;
  is_test: true;
  lead_persistence_suppressed: true;
  calling_suppressed: true;
  crm_delivery_suppressed: true;
  writes_performed: unknown[];
};

type ReplayEnvelope = {
  ok: boolean;
  code?: string;
  error?: string;
  result?: ReplayResult;
  mapping?: Record<string, unknown>;
};

type MappingAction = "" | "map" | "ignore";

type MappingDraft = {
  action: MappingAction;
  canonicalKey: string;
};

const SAMPLE_FIXTURE = JSON.stringify(
  {
    id: "sample-lead-001",
    form_id: "sample-form-001",
    created_time: "2026-09-04T12:00:00+0000",
    field_data: [
      { name: "full_name", values: ["Sample Homeowner"] },
      { name: "email", values: ["sample@example.com"] },
      { name: "phone_number", values: ["+15555550123"] },
      {
        name: "how_many_openings",
        label: "How many openings?",
        values: ["6-10"],
      },
    ],
  },
  null,
  2,
);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function functionErrorMessage(error: unknown): Promise<string> {
  const record = asRecord(error);
  const context = record?.context;
  if (context instanceof Response) {
    if (context.status === 404) {
      return "Function not found. Deploy meta-intake-replay and try again.";
    }
    const responseBody = await context.clone().json().catch(() => null);
    const body = asRecord(responseBody);
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
  }
  if (record?.status === 404) {
    return "Function not found. Deploy meta-intake-replay and try again.";
  }
  return typeof record?.message === "string"
    ? record.message
    : "The Meta Intake Lab request failed.";
}

async function invokeMetaIntakeLab(
  body: Record<string, unknown>,
): Promise<ReplayEnvelope> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  const devSecret = peekDevSecret();

  if (sessionError || (!session?.access_token && !devSecret)) {
    throw new Error("Your admin session has expired. Sign in again and retry.");
  }

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (devSecret) headers["x-dev-secret"] = devSecret;

  const { data, error } = await supabase.functions.invoke<ReplayEnvelope>(
    "meta-intake-replay",
    { body, headers },
  );

  if (error) throw new Error(await functionErrorMessage(error));
  if (!data?.ok) {
    throw new Error(data?.error || "The Meta Intake Lab request failed.");
  }
  return data;
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value);
  return serialized ?? String(value ?? "—");
}

function friendlyCode(value: string): string {
  return value.replaceAll("_", " ");
}

export default function MetaIntakeLab() {
  const [fixtureText, setFixtureText] = useState(SAMPLE_FIXTURE);
  const [formId, setFormId] = useState("");
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [savedMessages, setSavedMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Meta Intake Lab · WindowMan Admin";
  }, []);

  const activeFormId = formId.trim() || result?.form_id || "";
  const normalizedJson = useMemo(
    () => result ? JSON.stringify(result.normalized_lead, null, 2) : "",
    [result],
  );

  const replay = async () => {
    if (isReplaying) return;
    setError(null);
    setSavedMessages({});

    let fixture: unknown;
    try {
      fixture = JSON.parse(fixtureText);
    } catch (_parseError) {
      setError("Fixture JSON is invalid. Your pasted data is still here so you can correct it.");
      return;
    }

    setIsReplaying(true);
    try {
      const response = await invokeMetaIntakeLab({
        action: "analyze",
        fixture,
        ...(formId.trim() ? { form_id: formId.trim() } : {}),
      });
      if (!response.result) throw new Error("The replay returned no analysis result.");
      setResult(response.result);
      setMappingDrafts({});
      if (!formId.trim() && response.result.form_id) {
        setFormId(response.result.form_id);
      }
    } catch (replayError) {
      setResult(null);
      setError(replayError instanceof Error ? replayError.message : "Replay failed.");
    } finally {
      setIsReplaying(false);
    }
  };

  const saveMapping = async (field: UnknownField) => {
    if (!result?.can_save_mappings || savingLabel || !activeFormId) return;
    const draft = mappingDrafts[field.question_label];
    if (!draft?.action || (draft.action === "map" && !draft.canonicalKey)) return;

    setSavingLabel(field.question_label);
    setError(null);
    try {
      await invokeMetaIntakeLab({
        action: "save_mapping",
        form_id: activeFormId,
        question_label: field.question_label,
        mapping_action: draft.action,
        canonical_key: draft.action === "ignore" ? null : draft.canonicalKey,
      });
      setSavedMessages((current) => ({
        ...current,
        [field.question_label]: draft.action === "ignore"
          ? "Saved as ignored for this form."
          : `Saved mapping to ${draft.canonicalKey}.`,
      }));
      setMappingDrafts((current) => {
        const next = { ...current };
        delete next[field.question_label];
        return next;
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Mapping save failed.");
    } finally {
      setSavingLabel(null);
    }
  };

  return (
    <AdminShell
      eyebrow="Operator · Intake QA"
      title="Meta Intake Lab"
      subtitle="Replay sanitized fixtures through the live Facebook normalizer without creating or modifying leads."
      backTo="/admin/command-center"
      backLabel="Back to Command Center"
      nav={<AdminGlobalNav />}
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div>
              <h2 className="font-display text-base font-extrabold text-blue-950">Safe replay boundary</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-blue-900">
                Replay never writes a lead, starts a phone call, syncs a CRM, or contacts Meta. Only an explicit mapping decision can write to the isolated override table.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.55)] sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 shadow-sm">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold text-foreground">Fixture input</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Paste a Graph lead object, an enriched webhook fixture containing field_data, or the field_data array itself.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <label htmlFor="meta-fixture" className="text-sm font-extrabold text-foreground">
                Meta fixture JSON
              </label>
              <Textarea
                id="meta-fixture"
                value={fixtureText}
                onChange={(event) => setFixtureText(event.target.value)}
                spellCheck={false}
                className="mt-2 min-h-[360px] resize-y border-slate-400 bg-slate-50 font-mono text-xs leading-5 focus-visible:ring-blue-500"
                aria-describedby="meta-fixture-help"
              />
              <p id="meta-fixture-help" className="mt-2 text-xs font-semibold text-muted-foreground">
                Use sanitized test data whenever possible. A normal Meta leadgen callback has no field_data and will be rejected here by design.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="meta-form-id" className="text-sm font-extrabold text-foreground">
                  Form ID override
                </label>
                <Input
                  id="meta-form-id"
                  value={formId}
                  onChange={(event) => setFormId(event.target.value)}
                  placeholder="Optional unless mapping"
                  className="mt-2 min-h-11 border-slate-400"
                />
                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  The fixture form_id is used automatically. Enter one here to override it or to map a raw field_data array.
                </p>
              </div>

              <div className="grid gap-2">
                <Button onClick={replay} disabled={isReplaying || !fixtureText.trim()} className="min-h-11">
                  {isReplaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                  {isReplaying ? "Replaying…" : "Replay fixture"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={isReplaying}
                  onClick={() => {
                    setFixtureText(SAMPLE_FIXTURE);
                    setFormId("");
                    setResult(null);
                    setError(null);
                    setMappingDrafts({});
                    setSavedMessages({});
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset sample
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {!result && !isReplaying && (
          <section className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-slate-400 bg-slate-50 p-8 text-center">
            <div>
              <FileJson className="mx-auto h-8 w-8 text-slate-500" />
              <h2 className="mt-3 font-display text-lg font-extrabold text-slate-900">No replay result yet</h2>
              <p className="mt-1 max-w-lg text-sm font-semibold text-slate-600">
                Run the sample or paste a sanitized fixture to see recognition, unknown fields, the normalized preview, and the read-only duplicate decision.
              </p>
            </div>
          </section>
        )}

        {isReplaying && (
          <section aria-live="polite" className="flex min-h-52 items-center justify-center rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="flex items-center gap-3 text-sm font-extrabold text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Running the shared normalizer and read-only duplicate check…
            </div>
          </section>
        )}

        {result && !isReplaying && (
          <div className="space-y-5">
            <ReplayProof result={result} />

            <div className="grid gap-5 lg:grid-cols-2">
              <ResultCard title="Recognized fields" tone="green" count={result.recognized_fields.length}>
                {result.recognized_fields.length === 0 ? (
                  <EmptyResult text="No known fields were found in field_data." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Meta field</TableHead>
                          <TableHead>Canonical destination</TableHead>
                          <TableHead>Sanitized value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.recognized_fields.map((field, index) => (
                          <TableRow key={`${field.original_key}-${index}`}>
                            <TableCell className="font-mono text-xs font-bold">{field.original_key}</TableCell>
                            <TableCell className="font-mono text-xs text-emerald-800">{field.canonical_key}</TableCell>
                            <TableCell className="max-w-56 break-words text-sm">{field.sanitized_value ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </ResultCard>

              <ResultCard title="Contact completeness" tone="amber" count={result.missing_required_fields.length}>
                {result.missing_required_fields.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Name, phone, and email are present.
                  </p>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-amber-950">These contact fields are absent:</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {result.missing_required_fields.map((field) => (
                        <li key={field} className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-900">
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.validation_errors.length > 0 && (
                  <div className="mt-4 border-t border-amber-200 pt-3">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">Live import blockers</p>
                    <ul className="mt-2 space-y-1 text-sm font-semibold text-amber-950">
                      {result.validation_errors.map((item) => <li key={item}>• {friendlyCode(item)}</li>)}
                    </ul>
                  </div>
                )}
              </ResultCard>
            </div>

            <UnknownFields
              fields={result.unknown_fields}
              options={result.mapping_options}
              canSave={result.can_save_mappings}
              formId={activeFormId}
              drafts={mappingDrafts}
              savingLabel={savingLabel}
              savedMessages={savedMessages}
              onAction={(questionLabel, action) => {
                setMappingDrafts((current) => ({
                  ...current,
                  [questionLabel]: {
                    action,
                    canonicalKey: action === "map"
                      ? current[questionLabel]?.canonicalKey ?? ""
                      : "",
                  },
                }));
                setSavedMessages((current) => {
                  const next = { ...current };
                  delete next[questionLabel];
                  return next;
                });
              }}
              onCanonicalKey={(questionLabel, canonicalKey) =>
                setMappingDrafts((current) => ({
                  ...current,
                  [questionLabel]: {
                    action: "map",
                    canonicalKey,
                  },
                }))}
              onSave={saveMapping}
            />

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_40px_-30px_rgba(15,23,42,0.55)]">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h2 className="font-display text-lg font-extrabold text-foreground">Normalized lead preview</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">Unknown fields are excluded. This preview is not persisted.</p>
              </div>
              <pre className="max-h-[560px] overflow-auto bg-slate-950 p-4 text-xs leading-5 text-slate-100 sm:p-5">{normalizedJson}</pre>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function ReplayProof({ result }: { result: ReplayResult }) {
  const proof = [
    ["Test mode", result.is_test],
    ["Lead writes suppressed", result.lead_persistence_suppressed],
    ["Calling suppressed", result.calling_suppressed],
    ["CRM delivery suppressed", result.crm_delivery_suppressed],
  ] as const;

  return (
    <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-950">
            <CheckCircle2 className="h-5 w-5" /> Replay completed safely
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">
            Source: {friendlyCode(result.source_shape)} · Form: {result.form_id ?? "not supplied"}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {proof.map(([label, passed]) => (
            <span key={label} className="flex min-h-9 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 text-xs font-extrabold text-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5" /> {label}: {passed ? "confirmed" : "not confirmed"}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-emerald-300 bg-white p-3">
        <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">Read-only dedup decision</p>
        <p className="mt-1 text-base font-extrabold text-emerald-950">
          {result.dedup_decision.action.toUpperCase()} · {friendlyCode(result.dedup_decision.reason)}
        </p>
      </div>
    </section>
  );
}

function ResultCard({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: "green" | "amber";
  count: number;
  children: ReactNode;
}) {
  const toneClasses = tone === "green"
    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
    : "border-amber-300 bg-amber-50 text-amber-950";
  return (
    <section className={`rounded-xl border p-4 shadow-sm sm:p-5 ${toneClasses}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        <span className="rounded-md border border-current/20 bg-white px-2 py-1 text-xs font-extrabold">{count}</span>
      </div>
      <div className="rounded-lg border border-current/15 bg-white p-3">{children}</div>
    </section>
  );
}

function UnknownFields({
  fields,
  options,
  canSave,
  formId,
  drafts,
  savingLabel,
  savedMessages,
  onAction,
  onCanonicalKey,
  onSave,
}: {
  fields: UnknownField[];
  options: MappingOption[];
  canSave: boolean;
  formId: string;
  drafts: Record<string, MappingDraft>;
  savingLabel: string | null;
  savedMessages: Record<string, string>;
  onAction: (questionLabel: string, action: MappingAction) => void;
  onCanonicalKey: (questionLabel: string, canonicalKey: string) => void;
  onSave: (field: UnknownField) => void;
}) {
  return (
    <section className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div>
          <h2 className="font-display text-lg font-extrabold text-red-950">Unknown fields · {fields.length}</h2>
          <p className="mt-1 text-sm font-semibold text-red-900">
            These questions are not recognized by the live adapter. Saved decisions are suggestions only and do not alter live normalization yet.
          </p>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-white p-4 text-sm font-bold text-emerald-900">
          <CheckCircle2 className="mr-2 inline h-4 w-4" /> Every field is recognized.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {fields.map((field, index) => {
            const draft = drafts[field.question_label] ?? {
              action: "",
              canonicalKey: "",
            };
            const saving = savingLabel === field.question_label;
            const canSubmit = draft.action === "ignore" ||
              (draft.action === "map" && Boolean(draft.canonicalKey));
            return (
              <article key={`${field.original_key}-${index}`} className="rounded-lg border border-red-300 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)] lg:items-end">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-red-700">{field.original_key}</p>
                    <h3 className="mt-1 break-words text-base font-extrabold text-slate-950">{field.question_label}</h3>
                    <p className="mt-2 break-words rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                      {displayValue(field.original_value)}
                    </p>
                  </div>
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`mapping-action-${index}`} className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                          Mapping action
                        </label>
                        <select
                          id={`mapping-action-${index}`}
                          value={draft.action}
                          onChange={(event) =>
                            onAction(
                              field.question_label,
                              event.target.value as MappingAction,
                            )}
                          disabled={!canSave || saving}
                          className="mt-2 min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Choose an action…</option>
                          <option value="map">Map to canonical key</option>
                          <option value="ignore">Ignore for now</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`canonical-key-${index}`} className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                          Canonical destination
                        </label>
                        <select
                          id={`canonical-key-${index}`}
                          value={draft.canonicalKey}
                          onChange={(event) =>
                            onCanonicalKey(
                              field.question_label,
                              event.target.value,
                            )}
                          disabled={!canSave || saving || draft.action !== "map"}
                          className="mt-2 min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                        >
                          <option value="">Choose a destination…</option>
                          {options.map((option) => (
                            <option key={option.canonical_key} value={option.canonical_key}>
                              {option.label} · {option.destination}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 border-slate-400"
                        disabled={!canSave || !formId || !canSubmit || saving || Boolean(savingLabel && !saving)}
                        onClick={() => onSave(field)}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? "Saving…" : "Save decision"}
                      </Button>
                    </div>
                    {!formId && <p className="mt-2 text-xs font-bold text-red-800">Enter a Form ID before saving.</p>}
                    {!canSave && <p className="mt-2 text-xs font-bold text-slate-600">Viewer access is replay-only. An operator can save this decision.</p>}
                    {savedMessages[field.question_label] && (
                      <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {savedMessages[field.question_label]}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmptyResult({ text }: { text: string }) {
  return <p className="text-sm font-semibold text-muted-foreground">{text}</p>;
}
