import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SyntheticDemo from "@/components/synthetic-demo/SyntheticDemo";
import { isSyntheticDemoVariant, VARIANT_TITLES } from "@/components/synthetic-demo/fixture";
import { createMemoryCaptureClient } from "@/components/synthetic-demo/memoryCaptureClient";

const QA_LABEL = "Visual QA — synthetic data — no lead writes";
export default function SyntheticDemoViewer() {
  const { variant } = useParams<{ variant: string }>();
  const [client] = useState(createMemoryCaptureClient);
  const [open, setOpen] = useState(true);
  const [outcome, setOutcome] = useState<"has_quote" | "no_quote" | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  return <main className="sd-viewer">
    <Helmet><title>Synthetic demo visual QA | WindowMan</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <p>{QA_LABEL}</p>
    {isSyntheticDemoVariant(variant) ? <>
      <h1>{VARIANT_TITLES[variant]}</h1>
      <button ref={openerRef} type="button" className="sd-primary" onClick={() => { setOutcome(null); setOpen(true); }}>Open {VARIANT_TITLES[variant]}</button>
      {outcome ? <section role="status"><h2>Mock {outcome === "has_quote" ? "has-quote" : "no-quote"} handoff</h2><p>No intake, upload, navigation, or lead write was performed.</p></section> : null}
      <SyntheticDemo key={variant} open={open} variant={variant} captureClient={client} openerRef={openerRef} previewLabel={QA_LABEL}
        attribution={{ sourcePath: "/visual/synthetic-demo", entryPoint: "visual_qa" }} onOpenChange={setOpen}
        onHasQuote={() => setOutcome("has_quote")} onNoQuote={() => setOutcome("no_quote")} />
    </> : <section role="alert"><h1>Unknown demo variant</h1><p>Use xray, lens, or challenge in this visual QA URL.</p></section>}
  </main>;
}
