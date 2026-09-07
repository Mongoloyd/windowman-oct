import type { FormEvent } from "react";

interface HeroSectionProps {
  zip: string;
  zipError: string;
  onZipChange: (value: string) => void;
  onCheckArea: (event: FormEvent<HTMLFormElement>) => void;
  onHaveWrittenEstimate: () => void;
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function EstimateRankCard() {
  return (
    <div className="viz" aria-label="Illustrative estimate-rank preview">
      <div className="viz-glow" />

      <div className="float-chip fc-1">
        <span className="sq" style={{ background: "var(--warn)" }} /> Missing NOA / product approval
      </div>

      <div className="card">
        <div className="card-top">
          <div className="card-title">Estimate Rank · Preview</div>
          <div className="pill pill-live">Sample</div>
        </div>
        <div className="card-body">
          <div className="rank-head">
            <div>
              <div className="rank-num">78<small>th</small></div>
              <div className="rank-label">percentile vs. verified FL installs</div>
            </div>
            <div className="pill pill-warn">Above typical</div>
          </div>

          <div className="bar"><div className="marker" style={{ left: "78%" }} /></div>
          <div className="bar-lbl"><span>Typical range</span><span>High for this scope</span></div>

          <div className="divider" />

          <div className="row"><div className="k">Price per opening</div><div className="v">$1,4XX</div></div>
          <div className="row"><div className="k">Scope items specified</div><div className="v">7 of 12</div></div>
          <div className="row"><div className="k">Warranty terms found</div><div className="v"><span className="pill pill-bad">Not stated</span></div></div>
          <div className="row"><div className="k">Fine-print items to review</div><div className="v"><span className="redact">████</span></div></div>
          <div className="row"><div className="k">Fees not itemized</div><div className="v"><span className="redact">██████</span></div></div>

          <div className="lock-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flex: "none" }} aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Full detail unlocks after you verify it's your estimate.
          </div>
        </div>
      </div>

      <div className="float-chip fc-2">
        <span className="sq" style={{ background: "var(--bad)" }} /> 3 line items unclear
      </div>
    </div>
  );
}

export default function HeroSection({
  zip,
  zipError,
  onZipChange,
  onCheckArea,
  onHaveWrittenEstimate,
}: HeroSectionProps) {
  return (
    <header className="hero">
      <div className="wrap hero-in">
        <div>
          <div className="eyebrow"><span className="dot" />Florida statewide · Impact windows &amp; doors</div>
          <h1>Don't just get a window estimate.<br /><em>Get one that's been checked.</em></h1>
          <p className="sub">
            WindowMan helps you get a first estimate, then independently reviews the price, scope,
            fees, warranty, and fine print so you can see what deserves a closer look — and helps
            you go get a second one if something doesn't look right.
          </p>

          <label className="zip-label" htmlFor="nq3-hero-zip">Florida ZIP code</label>
          <form className="zip-form" onSubmit={onCheckArea} noValidate>
            <input
              id="nq3-hero-zip"
              inputMode="numeric"
              maxLength={5}
              placeholder="e.g. 33139"
              aria-describedby={zipError ? "nq3-hero-zip-error" : undefined}
              aria-invalid={Boolean(zipError)}
              autoComplete="postal-code"
              value={zip}
              onChange={(event) => onZipChange(event.target.value.replace(/\D/g, "").slice(0, 5))}
            />
            <button className="btn btn-primary" type="submit">
              Start My Free Estimate Check
              <ArrowIcon />
            </button>
          </form>
          <div className={`zip-err${zipError ? " on" : ""}`} id="nq3-hero-zip-error" role={zipError ? "alert" : undefined}>{zipError}</div>

          <div className="microtrust">
            <div className="mt-item"><CheckIcon /><b>No estimate needed to start</b></div>
            <div className="mt-item"><CheckIcon /><b>Florida projects only</b></div>
            <div className="mt-item"><CheckIcon /><b>Free · no obligation</b></div>
          </div>

          <div>
            <button
              className="escape-hatch"
              type="button"
              onClick={onHaveWrittenEstimate}
              data-testid="nq3-escape-hatch"
            >
              Already have a written estimate? Upload it for an AI check →
            </button>
          </div>
        </div>

        <EstimateRankCard />
      </div>
    </header>
  );
}
