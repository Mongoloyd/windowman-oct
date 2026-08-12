import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import type {
  IntakeEntryPoint,
  IntakeStepId,
} from "@/components/intake/universal/intakeTypes";
import {
  NQ4_ROOT_CLASS,
  useNq4NoIndex,
  useNq4ScopedCss,
} from "./scopeNq4Css";

export type Nq4EntryPoint = Extract<
  IntakeEntryPoint,
  "hero_zip" | "footer_primary"
>;
export type Nq4StartingStep = Extract<IntakeStepId, "location" | "product">;

export interface Nq4SuccessSummary {
  readonly firstName: string;
}

export interface CampaignNq4LandingProps {
  readonly onStartIntake: (
    entryPoint: Nq4EntryPoint,
    startingStep: Nq4StartingStep,
    zipPrefill?: string,
  ) => void;
  readonly success?: Nq4SuccessSummary | null;
  readonly intakeSlot?: ReactNode;
}

interface MechanismCard {
  readonly id: string;
  readonly step: string;
  readonly amount?: string;
  readonly caption?: string;
  readonly checks?: readonly string[];
  readonly isFinal?: boolean;
}

const MECHANISM_CARDS: readonly MechanismCard[] = [
  {
    id: "given",
    step: "Your first estimate",
    amount: "$31,850",
    caption: "A price you were given",
  },
  {
    id: "checked",
    step: "WindowMan checks it",
    checks: [
      "Scope reviewed",
      "Warranty language checked",
      "Price per opening calculated",
    ],
  },
  {
    id: "benchmark",
    step: "Your Number to Beat",
    amount: "$31,850",
    caption: "A benchmark you can use when comparing",
    isFinal: true,
  },
];

const HOW_IT_WORKS = [
  {
    title: "Tell us about the project",
    body: "ZIP code, what you're replacing, and roughly how many openings.",
  },
  {
    title: "Get a written estimate from a contractor",
    body: "You'll need something in writing before anything can be checked.",
  },
  {
    title: "Have WindowMan check what it says",
    body: "Price, scope, fees, warranty, and the fine print.",
  },
  {
    title: "Use it as your benchmark when you decide to compare",
    body: "You carry a specific number into the next conversation.",
  },
] as const;

const COMPARISON_ROWS = [
  {
    typical: "Each contractor starts from scratch",
    windowman: "Your first written estimate becomes the reference point",
  },
  {
    typical: "Different scopes make totals hard to compare",
    windowman: "WindowMan checks what is and isn't stated",
  },
  {
    typical: "The headline price dominates the decision",
    windowman: "Price and scope stay together",
  },
  {
    typical: "You decide without a clear benchmark",
    windowman: "You carry a specific number into the next conversation",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Is this like Angi or Thumbtack?",
    answer:
      "Not exactly. Those are marketplaces that connect homeowners with service professionals. WindowMan starts with your written estimate, checks what it says, and helps turn it into a benchmark before you decide whether to compare. Any contractor introduction is a separate later step.",
  },
  {
    question: "Is WindowMan a window contractor?",
    answer:
      "No. WindowMan does not manufacture, sell, measure, or install windows or doors. A contractor must verify the property and provide the final construction agreement.",
  },
  {
    question: "Does this guarantee a lower price?",
    answer:
      "No. The Number to Beat is a comparison benchmark, not a savings guarantee. A contractor may improve the price or scope, match it, revise it after field verification, or decline the project.",
  },
  {
    question: "What happens after I submit?",
    answer:
      "Your project request is saved for WindowMan follow-up. No contractor is automatically hired or authorized by this form.",
  },
  {
    question: "What does it cost?",
    answer: "There is no charge to submit this project request.",
  },
] as const;

const SUCCESS_TRACKER = [
  { label: "Project request received", done: true },
  { label: "WindowMan follow-up", done: false },
  { label: "First written estimate", done: false },
  { label: "WindowMan estimate check", done: false },
  { label: "Your Number to Beat", done: false },
  { label: "Optional comparison", done: false },
] as const;

const SUPPORT_LINE = "WindowMan doesn't sell or install windows · No obligation";
const PRIMARY_CTA_LABEL = "Start My Estimate Request →";
const HERO_ZIP_ERROR_ID = "nq4-hero-zip-error";
const FLORIDA_ZIP_ERROR = "Enter a valid 5-digit Florida ZIP code.";
const LEGAL_FOOTER =
  "© 2026 WindowMan. WindowMan is software and quote-intelligence support. WindowMan does not manufacture, sell, measure, or install windows or doors, and is not a law firm, insurance company, government agency, or building department. A contractor must inspect the property, verify conditions, and provide final pricing and the construction agreement.";

function isFloridaZip(value: string) {
  return /^3[2-4]\d{3}$/.test(value.trim());
}

function Nq4Header() {
  return (
    <header className="nq4-header">
      <div className="nq4-logo">
        WINDOW<span>MAN</span>
      </div>
      <div className="nq4-header-note">Software · Not a contractor</div>
    </header>
  );
}

function MechanismGraphic() {
  return (
    <div className="nq4-mech">
      <span className="nq4-mech-label">
        Illustrative example — not customer data
      </span>
      <div className="nq4-mech-track">
        {MECHANISM_CARDS.map((card, index) => (
          <Fragment key={card.id}>
            {index > 0 ? (
              <div className="nq4-mech-arrow" aria-hidden="true" />
            ) : null}
            <div
              className={
                card.isFinal ? "nq4-mech-card is-final" : "nq4-mech-card"
              }
            >
              <p className="nq4-mech-step">{card.step}</p>
              {card.amount ? (
                <p className="nq4-mech-num">{card.amount}</p>
              ) : null}
              {card.isFinal ? (
                <div className="nq4-mech-rule" aria-hidden="true" />
              ) : null}
              {card.caption ? (
                <p className="nq4-mech-caption">{card.caption}</p>
              ) : null}
              {card.checks ? (
                <ul className="nq4-mech-checks">
                  {card.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Nq4SuccessView({ firstName }: Nq4SuccessSummary) {
  return (
    <main className="nq4-shell nq4-success-wrap" data-testid="nq4-success">
      <p className="nq4-eyebrow">The Number to Beat</p>
      <h1>You&rsquo;re in, {firstName}.</h1>
      <p className="nq4-lead">Your project request was saved.</p>

      <ul className="nq4-tracker" data-testid="nq4-success-tracker">
        {SUCCESS_TRACKER.map((row) => (
          <li
            key={row.label}
            className={row.done ? "is-done" : undefined}
            data-done={row.done}
          >
            <span className="nq4-tracker-mark" aria-hidden="true">
              {row.done ? "✓" : ""}
            </span>
            <span>
              {row.label}
              <span className="nq4-visually-hidden">
                {row.done ? " — complete" : " — not started"}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="nq4-panel nq4-success-panel">
        <h2>Four things your written estimate should identify</h2>
        <p>
          Product and series · Opening count · Installation scope · Final
          project price
        </p>
      </div>

      <p className="nq4-support">
        WindowMan will follow up using the contact details you provided.
      </p>
    </main>
  );
}

export function CampaignNq4Landing({
  onStartIntake,
  success = null,
  intakeSlot = null,
}: CampaignNq4LandingProps) {
  useNq4ScopedCss();
  useNq4NoIndex();
  const [heroZip, setHeroZip] = useState("");
  const [heroZipError, setHeroZipError] = useState("");

  const submitHeroZip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedZip = heroZip.trim();
    if (!isFloridaZip(trimmedZip)) {
      setHeroZipError(FLORIDA_ZIP_ERROR);
      event.currentTarget.querySelector("input")?.focus();
      return;
    }

    setHeroZipError("");
    onStartIntake("hero_zip", "product", trimmedZip);
  };

  return (
    <div
      className={NQ4_ROOT_CLASS}
      data-campaign-variant="nq4"
      data-page-path="/nq4"
    >
      <Nq4Header />

      {success ? (
        <Nq4SuccessView firstName={success.firstName} />
      ) : (
        <main data-testid="nq4-landing">
          <section className="nq4-shell nq4-hero">
            <div className="nq4-hero-grid">
              <div>
                <p className="nq4-eyebrow">The Number to Beat</p>
                <h1>Give the next contractor a real number to beat.</h1>
                <p className="nq4-lead">
                  Start with one written estimate. WindowMan checks its price,
                  scope, fees, warranty, and fine print so you can turn it into
                  a benchmark before you decide whether to compare.
                </p>
                <form
                  className="nq4-zip-form"
                  noValidate
                  onSubmit={submitHeroZip}
                >
                  <label className="nq4-zip-label" htmlFor="nq4-hero-zip">
                    Florida ZIP code
                  </label>
                  <div className="nq4-zip-controls">
                    <input
                      id="nq4-hero-zip"
                      className="nq4-zip-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      autoComplete="postal-code"
                      placeholder="Enter your Florida ZIP code"
                      value={heroZip}
                      aria-invalid={Boolean(heroZipError)}
                      aria-describedby={
                        heroZipError ? HERO_ZIP_ERROR_ID : undefined
                      }
                      data-testid="nq4-hero-zip"
                      onChange={(event) => {
                        setHeroZip(
                          event.target.value.replace(/\D/g, "").slice(0, 5),
                        );
                        setHeroZipError("");
                      }}
                    />
                    <button
                      className="nq4-zip-submit"
                      type="submit"
                      data-testid="nq4-check-area"
                    >
                      Check My Area
                    </button>
                  </div>
                  {heroZipError ? (
                    <p
                      className="nq4-zip-error"
                      id={HERO_ZIP_ERROR_ID}
                      role="alert"
                    >
                      {heroZipError}
                    </p>
                  ) : null}
                </form>
                <p className="nq4-support">{SUPPORT_LINE}</p>
              </div>

              <MechanismGraphic />
            </div>
          </section>

          <section className="nq4-shell nq4-section">
            <p className="nq4-kicker">How it works</p>
            <h2>Four steps, in order.</h2>
            <div className="nq4-steps">
              {HOW_IT_WORKS.map((step, index) => (
                <div className="nq4-step" key={step.title}>
                  <span className="nq4-step-n" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="nq4-shell nq4-section">
            <p className="nq4-kicker">
              Why quote shopping doesn&rsquo;t create competition
            </p>
            <h2>
              Three contractors pricing without a shared benchmark isn&rsquo;t real
              competition.
            </h2>

            <div className="nq4-compare-head" aria-hidden="true">
              <div>Typical quote shopping</div>
              <div>WindowMan Number-to-Beat process</div>
            </div>

            <div className="nq4-compare">
              {COMPARISON_ROWS.map((row) => (
                <div className="nq4-compare-row" key={row.typical}>
                  <div className="nq4-compare-cell is-typical">
                    <p className="nq4-compare-tag">Typical quote shopping</p>
                    <p>{row.typical}</p>
                  </div>
                  <div className="nq4-compare-cell is-wm">
                    <p className="nq4-compare-tag">
                      WindowMan Number-to-Beat process
                    </p>
                    <p>{row.windowman}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="nq4-shell nq4-section">
            <p className="nq4-kicker">What WindowMan is</p>
            <h2>Plainly stated.</h2>
            <div className="nq4-panel">
              <p>
                WindowMan is software and quote-intelligence support. We do not
                manufacture, sell, measure, or install windows or doors. There
                is no charge to submit this project request. A contractor must
                inspect the property, verify conditions, and provide final
                pricing and the construction agreement.
              </p>
            </div>
            <div className="nq4-panel">
              <p>
                This page sends your request to WindowMan. It does not
                distribute your contact details to a group of contractors. Any
                contractor introduction is a later, separate step.
              </p>
            </div>
          </section>

          <section className="nq4-shell nq4-section">
            <p className="nq4-kicker">Straight answers</p>
            <h2>Before you send anything.</h2>
            <div className="nq4-faq">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <div className="nq4-faq-body">
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="nq4-section nq4-close">
            <div className="nq4-shell">
              <h2>Start with one number instead of three guesses.</h2>
              <p className="nq4-lead">
                Tell us where the project is and what you&rsquo;re replacing.
                That&rsquo;s the whole form.
              </p>
              <button
                type="button"
                className="nq4-cta"
                onClick={() => onStartIntake("footer_primary", "location")}
                data-testid="nq4-cta-footer"
              >
                {PRIMARY_CTA_LABEL}
              </button>
              <p className="nq4-support">{SUPPORT_LINE}</p>
            </div>
          </section>
        </main>
      )}

      <footer className="nq4-footer">
        <div className="nq4-shell">
          <p>{LEGAL_FOOTER}</p>
        </div>
      </footer>

      {intakeSlot}
    </div>
  );
}

export default CampaignNq4Landing;
