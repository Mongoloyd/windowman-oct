import { BarChart3, Receipt, ShieldCheck } from "lucide-react";
import { useState } from "react";
import "./wmchat-trust-cards.css";

const WM_CHAT_TRUST_CARDS = [
  {
    id: "cost-gaps",
    eyebrow: "Price + fees",
    title: "Find Costly Gaps",
    detail:
      "Flags unclear fees, bundled pricing, and missing line-item detail.",
    tone: "amber",
    Icon: Receipt,
  },
  {
    id: "ratings-scope",
    eyebrow: "Product + scope",
    title: "Check Ratings & Scope",
    detail:
      "Checks whether promised products, ratings, and installation work are written into the quote.",
    tone: "emerald",
    Icon: ShieldCheck,
  },
  {
    id: "real-evidence",
    eyebrow: "Real comparisons",
    title: "Compare Real Evidence",
    detail:
      "Compares the quote with available project and community benchmarks—not internet guesses.",
    tone: "cyan",
    Icon: BarChart3,
  },
] as const;

export function WmChatTrustCards() {
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  return (
    <aside
      aria-label="What WindowMan checks"
      className="wmchat-trust-rail mx-auto mt-5 w-[calc(100%+24px)] -translate-x-3"
    >
      <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#7799b5]">
        Proof before questions
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {WM_CHAT_TRUST_CARDS.map(
          ({ id, eyebrow, title, detail, tone, Icon }, index) => {
            const isOpen = openCardId === id;
            return (
              <li key={id} className="min-w-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${title}. ${isOpen ? "Hide details" : "Show details"}`}
                  onClick={() => setOpenCardId(isOpen ? null : id)}
                  className="wmchat-trust-card block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0f]"
                  data-open={isOpen ? "true" : "false"}
                  data-tone={tone}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className="sr-only">
                    {isOpen ? `${title}: ${detail}` : `${title}. Tap for details.`}
                  </span>
                  <span className="wmchat-trust-card-inner" aria-hidden="true">
                    <span className="wmchat-trust-card-face wmchat-trust-card-front">
                      <span className="wmchat-trust-glass">
                        <Icon className="wmchat-trust-icon" strokeWidth={1.8} />
                        <span className="wmchat-trust-eyebrow">{eyebrow}</span>
                        <span className="wmchat-trust-title">{title}</span>
                        <span className="wmchat-trust-action">Tap for proof</span>
                      </span>
                    </span>
                    <span className="wmchat-trust-card-face wmchat-trust-card-back">
                      <span className="wmchat-trust-glass wmchat-trust-glass-back">
                        <span className="wmchat-trust-back-title">{title}</span>
                        <span className="wmchat-trust-detail">{detail}</span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          },
        )}
      </ul>
    </aside>
  );
}
