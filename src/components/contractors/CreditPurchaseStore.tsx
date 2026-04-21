/**
 * CreditPurchaseStore.tsx
 * 
 * Design constraints (enforced):
 *   - System OS font stack only — no imports, no web fonts
 *   - Glassmorphic 3D layered aesthetic
 *   - Tactile push-button interactions (translate + shadow on active)
 *   - Continuous, high-contrast loading animation during Stripe handoff
 * 
 * Place at: src/components/contractors/CreditPurchaseStore.tsx
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

type CheckoutState = "idle" | "loading" | "redirecting" | "error";

interface PackDef {
  id: string;
  name: string;
  badge?: string;
  credits: number | null;
  price: string;
  interval?: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
  exclusive?: boolean;
  cta: string;
}

// ── Pack definitions (must match edge function CREDIT_PACKS keys) ──────────

const PACKS: PackDef[] = [
  {
    id: "pack_10_credits",
    name: "Starter",
    credits: 10,
    price: "$500",
    blurb: "10 verified, AI-audited homeowner leads",
    features: [
      "Full homeowner contact reveal",
      "AI Truth Report attached to every lead",
      "County benchmark pricing included",
    ],
    cta: "Buy Starter Pack",
  },
  {
    id: "pack_25_credits",
    name: "Growth",
    badge: "Best Value",
    credits: 25,
    price: "$1,125",
    blurb: "25 verified leads — 10% per-lead savings",
    features: [
      "Full homeowner contact reveal",
      "AI Truth Report attached to every lead",
      "County benchmark pricing included",
      "Priority lead routing queue",
    ],
    highlight: true,
    cta: "Buy Growth Pack",
  },
  {
    id: "pack_50_credits",
    name: "Pro",
    credits: 50,
    price: "$2,000",
    blurb: "50 verified leads — maximum closing velocity",
    features: [
      "Full homeowner contact reveal",
      "AI Truth Report attached to every lead",
      "County benchmark pricing included",
      "Priority lead routing queue",
      "Dedicated account support",
    ],
    cta: "Buy Pro Pack",
  },
  {
    id: "syndicate_broward",
    name: "Syndicate Access",
    badge: "3 seats — Broward",
    credits: null,
    price: "$1,000",
    interval: "/mo",
    blurb: "Exclusive recurring membership — Broward County data pool",
    features: [
      "Round-robin fresh lead ingress (automated)",
      "Aged lead second-chance pool access",
      "Competitor quote intelligence on every deal",
      "Shared Meta pixel algorithm optimization",
      "Unlimited lead credits included",
    ],
    exclusive: true,
    cta: "Claim Your Seat",
  },
];

// ── Spinner component ──────────────────────────────────────────────────────

function Spinner({ color = "#ffffff" }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        border: `2.5px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "wm-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ── Feature list item ──────────────────────────────────────────────────────

function FeatureItem({ text, exclusive }: { text: string; exclusive?: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 13,
        lineHeight: 1.5,
        color: exclusive ? "rgba(167,243,208,0.9)" : "rgba(203,213,225,0.85)",
        marginBottom: 6,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          marginTop: 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: exclusive
            ? "rgba(16,185,129,0.25)"
            : "rgba(148,163,184,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          color: exclusive ? "#34d399" : "#94a3b8",
        }}
      >
        ✓
      </span>
      {text}
    </li>
  );
}

// ── Pack card ──────────────────────────────────────────────────────────────

interface PackCardProps {
  pack: PackDef;
  isActive: boolean;
  state: CheckoutState;
  onBuy: (id: string) => void;
}

function PackCard({ pack, isActive, state, onBuy }: PackCardProps) {
  const [pressed, setPressed] = useState(false);
  const isBusy = isActive && (state === "loading" || state === "redirecting");
  const isError = isActive && state === "error";

  // ── Per-tier style tokens
  const borderColor = pack.exclusive
    ? "rgba(16,185,129,0.3)"
    : pack.highlight
    ? "rgba(251,191,36,0.3)"
    : "rgba(255,255,255,0.08)";

  const glowColor = pack.exclusive
    ? "rgba(16,185,129,0.12)"
    : pack.highlight
    ? "rgba(251,191,36,0.08)"
    : "transparent";

  const btnBg = pack.exclusive
    ? "linear-gradient(135deg, #059669 0%, #0d9488 100%)"
    : pack.highlight
    ? "linear-gradient(135deg, #d97706 0%, #dc2626 100%)"
    : "linear-gradient(135deg, #334155 0%, #1e293b 100%)";

  const btnShadowNormal = pack.exclusive
    ? "0 6px 0 0 rgba(4,120,87,0.8), 0 8px 24px rgba(16,185,129,0.2)"
    : pack.highlight
    ? "0 6px 0 0 rgba(180,83,9,0.8), 0 8px 24px rgba(251,191,36,0.15)"
    : "0 6px 0 0 rgba(15,23,42,0.8), 0 8px 16px rgba(0,0,0,0.3)";

  const btnShadowPressed = pack.exclusive
    ? "0 1px 0 0 rgba(4,120,87,0.8)"
    : pack.highlight
    ? "0 1px 0 0 rgba(180,83,9,0.8)"
    : "0 1px 0 0 rgba(15,23,42,0.8)";

  const badgeBg = pack.exclusive
    ? "rgba(16,185,129,0.18)"
    : pack.highlight
    ? "rgba(251,191,36,0.18)"
    : "rgba(255,255,255,0.08)";

  const badgeColor = pack.exclusive
    ? "#34d399"
    : pack.highlight
    ? "#fbbf24"
    : "#94a3b8";

  // Button label + contents based on state
  const btnContent = isBusy ? (
    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
      <Spinner color={pack.exclusive ? "#a7f3d0" : "#ffffff"} />
      <span style={{ fontSize: 13, letterSpacing: "0.04em" }}>
        {state === "redirecting" ? "Opening Stripe…" : "Processing…"}
      </span>
    </span>
  ) : isError ? (
    <span style={{ fontSize: 13, letterSpacing: "0.04em", color: "#fca5a5" }}>
      ✕ Error — retry
    </span>
  ) : (
    <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.03em" }}>
      {pack.cta}
    </span>
  );

  return (
    <div
      style={{
        position: "relative",
        background: pack.exclusive
          ? "linear-gradient(160deg, rgba(6,78,59,0.35) 0%, rgba(4,47,46,0.25) 100%)"
          : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: pack.exclusive ? "28px 24px" : "24px 20px",
        boxShadow: `0 4px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px ${glowColor}`,
        display: "flex",
        flexDirection: "column",
        gap: 0,
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
        // Syndicate card gets a subtle scale-up
        transform: pack.exclusive ? "scale(1.02)" : "scale(1)",
      }}
    >
      {/* Badge */}
      {pack.badge && (
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "3px 10px",
            borderRadius: 20,
            background: badgeBg,
            border: `1px solid ${badgeColor}33`,
            color: badgeColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          {pack.badge}
        </div>
      )}

      {/* Tier name */}
      <div
        style={{
          fontSize: pack.exclusive ? 22 : 19,
          fontWeight: 700,
          color: "#f1f5f9",
          letterSpacing: "-0.02em",
          marginBottom: 4,
        }}
      >
        {pack.name}
      </div>

      {/* Price */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 2,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: pack.exclusive ? "#34d399" : pack.highlight ? "#fbbf24" : "#e2e8f0",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {pack.price}
        </span>
        {pack.interval && (
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
            {pack.interval}
          </span>
        )}
        {pack.credits && (
          <span style={{ fontSize: 12, color: "#475569", marginLeft: 6 }}>
            · {pack.credits} credits
          </span>
        )}
      </div>

      {/* Blurb */}
      <p
        style={{
          fontSize: 13,
          color: "rgba(148,163,184,0.8)",
          lineHeight: 1.5,
          marginBottom: 16,
          marginTop: 0,
        }}
      >
        {pack.blurb}
      </p>

      {/* Feature list */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 20px 0",
          flex: 1,
        }}
      >
        {pack.features.map((f) => (
          <FeatureItem key={f} text={f} exclusive={pack.exclusive} />
        ))}
      </ul>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${borderColor}, transparent)`,
          marginBottom: 18,
        }}
      />

      {/* CTA — tactile push-button */}
      <button
        disabled={state !== "idle" && isActive}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        onClick={() => !isBusy && onBuy(pack.id)}
        style={{
          // 3D push-button base
          background: isError
            ? "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)"
            : btnBg,
          border: "none",
          borderRadius: 10,
          padding: "12px 20px",
          cursor: isBusy ? "wait" : "pointer",
          color: "#ffffff",
          width: "100%",
          // Physical depth: translate + shadow simulate being pushed down
          transform: pressed || isBusy ? "translateY(4px)" : "translateY(0)",
          boxShadow: pressed || isBusy ? btnShadowPressed : btnShadowNormal,
          transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.2s ease",
          outline: "none",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          // Inner bevel for the 3D top-face effect
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shine layer — top highlight to complete the 3D slab illusion */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 60%)",
            pointerEvents: "none",
            borderRadius: 10,
          }}
        />
        {btnContent}
      </button>

      {/* Error detail (only shown during error state for this card) */}
      {isError && (
        <p
          style={{
            fontSize: 11,
            color: "#f87171",
            textAlign: "center",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Payment session failed. No charge was made.
        </p>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function CreditPurchaseStore() {
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [activePack, setActivePack] = useState<string | null>(null);

  const handlePurchase = async (packId: string) => {
    setActivePack(packId);
    setCheckoutState("loading");

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          pack_code: packId,
          origin: window.location.origin,
        },
      });

      if (error || !data?.url) {
        throw new Error(data?.message || error?.message || "Could not create checkout session.");
      }

      setCheckoutState("redirecting");

      // Give user 500ms to see the "redirecting" state — feels intentional, not broken
      await new Promise((r) => setTimeout(r, 500));
      window.location.href = data.url;
    } catch {
      setCheckoutState("error");
      // Auto-reset after 4 seconds
      setTimeout(() => {
        setCheckoutState("idle");
        setActivePack(null);
      }, 4000);
    }
  };

  // Separate syndicate from credit packs for layout
  const creditPacks = PACKS.filter((p) => !p.exclusive);
  const syndicatePack = PACKS.find((p) => p.exclusive)!;

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes wm-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes wm-pulse-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "32px 20px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.03em",
              marginBottom: 8,
              marginTop: 0,
            }}
          >
            Partner Access
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "rgba(148,163,184,0.7)",
              margin: 0,
              maxWidth: 480,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}
          >
            One-time credit packs for on-demand lead unlocks, or lock in a monthly
            Syndicate seat for continuous, automated pipeline access.
          </p>
        </div>

        {/* Credit pack grid — 3 columns on wide, 1 on mobile */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {creditPacks.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              isActive={activePack === pack.id}
              state={checkoutState}
              onBuy={handlePurchase}
            />
          ))}
        </div>

        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#475569",
            }}
          >
            Recurring Membership
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Syndicate card — full width, elevated */}
        <PackCard
          pack={syndicatePack}
          isActive={activePack === syndicatePack.id}
          state={checkoutState}
          onBuy={handlePurchase}
        />

        {/* Trust footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            marginTop: 28,
            flexWrap: "wrap",
          }}
        >
          {["Powered by Stripe", "256-bit SSL", "Cancel anytime"].map((label) => (
            <span
              key={label}
              style={{
                fontSize: 11,
                color: "#334155",
                fontWeight: 500,
                letterSpacing: "0.03em",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

export default CreditPurchaseStore;
