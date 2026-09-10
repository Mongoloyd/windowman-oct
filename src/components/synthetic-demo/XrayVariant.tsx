import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Finding, QuoteEscape } from "./VariantParts";
import { SAMPLE_QUOTE } from "./fixture";
import type { VariantViewModel } from "./types";

type ImageStatus = "loading" | "ready" | "error";

export default function XrayVariant(view: VariantViewModel) {
  const [photo, setPhoto] = useState<{ status: ImageStatus; attempt: number }>({ status: "loading", attempt: 0 });
  const primaryRef = useRef<HTMLButtonElement>(null);
  const settleImage = (attempt: number, status: ImageStatus) => {
    setPhoto((current) => current.attempt === attempt ? { ...current, status } : current);
  };
  const retryImage = () => {
    // The retry control unmounts while loading; retain a reachable focus position.
    primaryRef.current?.focus({ preventScroll: true });
    setPhoto((current) => ({ status: "loading", attempt: current.attempt + 1 }));
  };

  return <>
    <div className="sd-paper-scene sd-xray-showcase" data-image-status={photo.status}>
      <p className="sd-xray-sample-disclosure">Synthetic sample—not your quote or a real contractor quote.</p>
      <img key={photo.attempt} className="sd-xray-photograph" src="/images/synthetic-demo/xray/xray-revealed.webp"
        alt="" width={1072} height={1471} loading="eager" decoding="async" draggable={false}
        onLoad={() => settleImage(photo.attempt, "ready")} onError={() => settleImage(photo.attempt, "error")} />
      <div className="sd-paper-finding"><Finding signal={SAMPLE_QUOTE.signals[0]} revealed /></div>
      {photo.status === "error" ? <div className="sd-xray-image-status sd-xray-image-error">
        <p role="alert">The sample photo could not load. You can still read the finding or choose your next step.</p>
        <button type="button" onClick={retryImage}>Retry sample photo</button>
      </div> : photo.status === "loading" ? <p className="sd-xray-image-status" role="status">Loading sample photo…</p> : null}
    </div>
    <section className="sd-xray-copy sd-body-pad">
      <h2>We look beneath the surface.</h2>
      <p>Our AI reviews your quote line by line, highlighting what's missing, unclear, or risky so you can move forward with confidence.</p>
      <button ref={primaryRef} type="button" className="sd-primary" onClick={view.onNoQuote}>Help Me Get a Quote<ArrowRight aria-hidden="true" size={22} /></button>
      <QuoteEscape onClick={view.onHasQuote} />
    </section>
  </>;
}
