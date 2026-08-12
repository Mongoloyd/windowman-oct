import type { FormEvent } from "react";

interface FinalCTAProps {
  zip: string;
  zipError: string;
  onZipChange: (value: string) => void;
  onCheckArea: (event: FormEvent<HTMLFormElement>) => void;
}

function CheckIcon() {
  return (
    <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function FinalCTA({ zip, zipError, onZipChange, onCheckArea }: FinalCTAProps) {
  return (
    <section className="final">
      <div className="wrap">
        <h2 style={{ maxWidth: "640px", margin: "0 auto 14px" }}>Find out where your number lands before you sign it.</h2>
        <p className="sec-sub" style={{ margin: "0 auto" }}>Start with your ZIP code. Takes about 40 seconds.</p>
        <label className="zip-label" htmlFor="nq3-final-zip">Florida ZIP code</label>
        <form className="zip-form" onSubmit={onCheckArea} noValidate>
          <input
            id="nq3-final-zip"
            inputMode="numeric"
            maxLength={5}
            placeholder="e.g. 33139"
            aria-describedby={zipError ? "nq3-final-zip-error" : undefined}
            aria-invalid={Boolean(zipError)}
            autoComplete="postal-code"
            value={zip}
            onChange={(event) => onZipChange(event.target.value.replace(/\D/g, "").slice(0, 5))}
          />
          <button className="btn btn-primary" type="submit">
            Start My Free Estimate Check
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        <div className={`zip-err${zipError ? " on" : ""}`} id="nq3-final-zip-error" role={zipError ? "alert" : undefined}>{zipError}</div>
        <div className="microtrust">
          <div className="mt-item"><CheckIcon /><b>Free</b></div>
          <div className="mt-item"><CheckIcon /><b>No obligation</b></div>
          <div className="mt-item"><CheckIcon /><b>Independent · not a contractor</b></div>
        </div>
      </div>
    </section>
  );
}
