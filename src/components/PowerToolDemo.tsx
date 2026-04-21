// @ts-nocheck
// PowerToolDemo - migrated from source project
// This is a large self-contained component with its own design system
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTickerStats } from "@/hooks/useTickerStats";
import { formatPhoneDisplay, stripNonDigits, isValidUSPhone } from "@/utils/formatPhone";

const DS = {
  fontUI: "'Inter', system-ui, sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
  colors: {
    bg: "#070b12",
    surface: "#0e1420",
    cyan: "#06b6d4",
    cyanDim: "rgba(6,182,212,0.15)",
    red: "#ef4444",
    amber: "#f59e0b",
    green: "#10b981",
    text: "#f1f5f9",
    muted: "rgba(241,245,249,0.90)",
    faint: "rgba(241,245,249,0.75)",
    border: "rgba(255,255,255,0.08)",
  },
};
const DS_PAGE_STYLES = `.ds-wrapper * { box-sizing: border-box; } .ds-wrapper button:focus-visible { outline: 2px solid rgba(6,182,212,0.6); outline-offset: 2px; }`;
const T = {
  bg: "#070b12",
  surface: "#0e1420",
  card: "rgba(255,255,255,0.033)",
  border: "rgba(255,255,255,0.08)",
  cyan: "#06b6d4",
  cyanDim: "rgba(6,182,212,0.15)",
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#10b981",
  text: "#f1f5f9",
  muted: "rgba(241,245,249,0.90)",
  faint: "rgba(241,245,249,0.75)",
  fontSans: "'Inter', system-ui, sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
};
const DEMO = {
  contractor: "Sunshine Premium Windows LLC",
  date: "2026-02-28",
  city: "Pompano Beach",
  zip: "33060",
  openings: 12,
  totalPrice: 26500,
  pricePerOpening: 2208,
  score: 55,
  grade: "D+",
  hardCap: { statute: "FL §489.126", ceiling: 45 },
  pillars: [
    { label: "Safety", score: 42, status: "flag" },
    { label: "Scope", score: 60, status: "warn" },
    { label: "Price", score: 45, status: "flag" },
    { label: "Fine Print", score: 38, status: "flag" },
    { label: "Warranty", score: 58, status: "warn" },
  ],
};
const SCAN_LINES = [
  // Phase 1: Init (~0-1.5s) — mechanical, fast
  { text: "Initializing Window Man AI scanner...", ms: 0, type: "info" },
  { text: "Parsing document structure — 14 pages detected...", ms: 600, type: "info" },
  { text: "Extracting contractor identity fields...", ms: 1300, type: "info" },
  { text: "  → Contractor : Sunshine Premium Windows LLC", ms: 1700, type: "data" },
  // First warning — slight pause to register
  { text: "  → License #  : NOT FOUND ON CONTRACT ⚠", ms: 2600, type: "warn" },
  // Phase 2: Payment terms (~3-5.5s) — danger lines get dramatic pauses
  { text: "Parsing payment + deposit terms...", ms: 3300, type: "info" },
  { text: "  → Deposit clause    : EXCEEDS FL STATUTORY LIMIT", ms: 4500, type: "danger" },
  { text: "  → Payment milestones: NOT DEFINED", ms: 5100, type: "warn" },
  { text: "  → Tax inclusion     : AMBIGUOUS", ms: 5600, type: "warn" },
  // Phase 3: Hurricane compliance (~6-10s) — heaviest danger cluster
  { text: "Checking Florida hurricane compliance database...", ms: 6300, type: "info" },
  { text: "  → NOA numbers       : MISSING", ms: 7500, type: "danger" },
  { text: "  → Design pressure   : NOT LISTED", ms: 8700, type: "danger" },
  { text: "  → FL Product Approval: Partial (FL12345 only)", ms: 9300, type: "warn" },
  { text: "  → Installation method: NOT SPECIFIED", ms: 9800, type: "warn" },
  // Phase 4: Fine print (~10.5-14.5s) — relentless danger discovery
  { text: "Scanning contract fine print...", ms: 10500, type: "info" },
  { text: "  → Arbitration clause    : FOUND — limits your rights", ms: 11100, type: "warn" },
  { text: "  → Price escalation clause: FOUND — price can increase", ms: 12200, type: "danger" },
  { text: "  → Lien waiver           : MISSING — lien risk on home", ms: 13300, type: "danger" },
  { text: "  → Cancellation clause   : MISSING", ms: 14400, type: "danger" },
  { text: "  → Completion timeline   : NOT STATED", ms: 15000, type: "warn" },
  // Phase 5: Sales pressure (~15.5-17s)
  { text: "Detecting sales pressure tactics...", ms: 15700, type: "info" },
  { text: "  → 'Today only' pricing  : DETECTED", ms: 16800, type: "danger" },
  { text: "  → High-pressure language: DETECTED", ms: 17500, type: "danger" },
  // Phase 6: Warranty (~18-20s)
  { text: "Evaluating warranty terms...", ms: 18200, type: "info" },
  { text: "  → Labor warranty  : 1 YEAR — dangerously low", ms: 19300, type: "danger" },
  // ~81% — SYSTEM ALERT: pre-freeze warning flash
  { text: "⚠ THREAT LEVEL: CRITICAL — ADDITIONAL CALIBRATION REQUIRED", ms: 20000, type: "system_alert" },
  { text: "  → Transferability : NOT TRANSFERABLE", ms: 20800, type: "warn" },
  { text: "  → 'Lifetime' claim: CONTRADICTED by 10-year terms", ms: 21400, type: "warn" },
  // ~91% — TRIGGER: calibration gate freeze
  { text: "Computing final risk score...", ms: 22400, type: "info" },
  // Post-calibration resume lines
  { text: "  → Applying FL §489.126 deposit hard cap...", ms: 23000, type: "warn" },
  { text: "  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%", ms: 23600, type: "info" },
  { text: "ANALYSIS COMPLETE — 10 CRITICAL ISSUES DETECTED", ms: 24200, type: "complete" },
];

// The trigger line text that causes the calibration freeze
const CALIBRATION_TRIGGER_TEXT = "Computing final risk score...";

const FINDINGS = [
  {
    severity: "flag",
    pillar: "PRICE",
    title: "Deposit Risk: Upfront Payment Terms Are Unsafe",
    why: "Large Deposits Eliminate Your Leverage.",
    what: "Rewrite into milestones: small deposit → permit issued → product delivery → install complete → inspection pass.",
  },
  {
    severity: "flag",
    pillar: "SAFETY",
    title: "HVHZ Risk: Product Approvals Not Documented",
    why: "In Hurricane Zones, NOA Numbers and Design Pressure Ratings are Inspection-Critical.",
    what: "Require exact NOA numbers for every product series.",
  },
  {
    severity: "flag",
    pillar: "SAFETY",
    title: "Design Pressure Not Listed",
    why: "DP Determines If The Window Configuration Is Structurally Appropriate For Your Home.",
    what: "Require DP ratings per product type.",
  },
  {
    severity: "flag",
    pillar: "FINE PRINT",
    title: "Contract Trap: Cancellation Rights Not Stated",
    why: "Florida Consumers Typically Have a 3-Day Right To Cancel.",
    what: "Require: written cancellation window (3 business days minimum).",
  },
  {
    severity: "flag",
    pillar: "FINE PRINT",
    title: "Price Escalation Clause Detected",
    why: "This Clause Lets The Contractor Raise The Price After You've Signed.",
    what: "Demand a maximum escalation cap (e.g. 5%).",
  },
];
const COMPLIANCE = [
  { label: "Missile Impact Rating", status: "warn", detail: "Not clearly stated" },
  { label: "Design Pressure", status: "fail", detail: "DP not listed" },
  { label: "Miami-Dade NOA", status: "warn", detail: "No NOA numbers found" },
  { label: "FL Product Approval", status: "warn", detail: "Partial — FL12345 referenced" },
];
const NEXT_STEPS = [
  "Lock Permits + Inspections Into Scope.",
  "Attach NOA /FL  Approval Sheets as Exhibits Before Signing.",
  "Rewrite Payment Into 5 Milestones.",
  "Add a Written Change-Order Clause.",
  "Request Warranty PDF — Confirm 5-Year Labor Coverage.",
];
const fmt$ = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function Pill({ children, tone = "neutral", sm = false }) {
  const map = {
    danger: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.28)", color: "#ef4444" },
    warn: { bg: "rgba(245,158,11,0.13)", border: "rgba(245,158,11,0.28)", color: "#f59e0b" },
    success: { bg: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.25)", color: "#10b981" },
    cyan: { bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.28)", color: "#06b6d4" },
    neutral: { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.10)", color: T.muted },
  };
  const s = map[tone] || map.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        borderRadius: "99px",
        padding: sm ? "2px 8px" : "4px 11px",
        fontSize: sm ? "10px" : "11px",
        fontWeight: 700,
        letterSpacing: "0.4px",
        fontFamily: T.fontSans,
      }}
    >
      {children}
    </span>
  );
}
function Card({ children, style = {}, highlight = false }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${highlight ? "rgba(6,182,212,0.22)" : T.border}`,
        borderRadius: 0,
        padding: "20px",
        ...(highlight ? { boxShadow: "0 0 40px rgba(6,182,212,0.06)" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Kicker({ children }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "2.5px",
        color: "rgba(6,182,212,0.8)",
        fontFamily: T.fontMono,
        marginBottom: "6px",
      }}
    >
      {children}
    </div>
  );
}
function SectionHead({ kicker, title }) {
  return (
    <div style={{ margin: "36px 0 14px" }}>
      <Kicker>{kicker}</Kicker>
      <div style={{ fontSize: "20px", fontWeight: 700, color: T.text, fontFamily: T.fontSans }}>{title}</div>
    </div>
  );
}
function FadeIn({ children, delay = 0 }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      style={{
        opacity: on ? 1 : 0,
        transform: on ? "none" : "translateY(18px)",
        transition: "opacity 0.55s ease, transform 0.55s ease",
      }}
    >
      {children}
    </div>
  );
}

// PowerToolButton extracted to ./PowerToolButton.tsx for static import in AuditHero
// (avoids first-paint desync from lazy chunk).

/* ============================================================
   LeadModal — Single step: Name + Email only
   ============================================================ */
function LeadModal({ onComplete, onClose }) {
  const [form, setForm] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState({});
  const { total: SCAN_COUNT } = useTickerStats();
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "First name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    onComplete({ name: form.name, email: form.email });
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "468px",
          background: "#0d1117",
          border: "1px solid rgba(6,182,212,0.18)",
          borderRadius: 0,
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 90px rgba(0,0,0,0.65)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.9), transparent)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "18px 22px 0" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "6px 28px 30px" }}>
          <Kicker>WINDOW MAN AI AUDIT</Kicker>
          <h2 style={{ fontSize: "24px", fontWeight: 800, color: T.text, margin: "0 0 10px", lineHeight: 1.2 }}>
            See The AI Scanner in Real-Time
          </h2>
          <p style={{ fontSize: "14px", color: T.muted, margin: "0 0 24px", lineHeight: 1.6 }}>
            Watch WindowMan Forensically Analyze a Quote to Spot Traps, Hidden Fees and Red Flags- Revealing Just the
            Truth
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <ModalField
              label="Your First Name"
              placeholder="e.g. Sarah"
              value={form.name}
              onChange={set("name")}
              error={errors.name}
              autoFocus
            />
            <ModalField
              label="Email Address"
              placeholder="sarah@email.com"
              type="email"
              value={form.email}
              onChange={set("email")}
              error={errors.email}
            />
            <ModalBtn onClick={handleSubmit}>View Live Scan→</ModalBtn>
            <div style={{ fontSize: "11px", color: "#FFFFFF", textAlign: "center" }}>
              No spam, No Sales Pitch. Just the Truth About Your Quote.
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes ptf-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ModalField({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
  autoFocus = false,
  inputMode,
  autoComplete,
  inputRef,
}) {
  const [focused, setFocused] = useState(false);
  const fallbackRef = useRef(null);
  const ref = inputRef || fallbackRef;
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: T.muted, marginBottom: "6px" }}>
        {label}
      </label>
      <input
        ref={ref}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 0,
          background: "rgba(255,255,255,0.05)",
          color: T.text,
          border: `1.5px solid ${error ? "rgba(239,68,68,0.65)" : focused ? "rgba(6,182,212,0.55)" : "rgba(255,255,255,0.1)"}`,
          fontSize: "15px",
          outline: "none",
          boxSizing: "border-box",
          fontFamily: "'Inter', system-ui, sans-serif",
          transition: "border-color 0.15s",
        }}
      />
      {error && <div style={{ fontSize: "11px", color: T.red, marginTop: "5px" }}>{error}</div>}
    </div>
  );
}

function ModalBtn({ children, onClick, loading = false }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        padding: "14px",
        background: loading ? "rgba(6,182,212,0.38)" : "linear-gradient(135deg, #0ea5e9, #06b6d4)",
        color: loading ? "rgba(255,255,255,0.7)" : "#050e18",
        fontWeight: 800,
        fontSize: "15px",
        border: "none",
        borderRadius: 0,
        cursor: loading ? "not-allowed" : "pointer",
        boxShadow: hover && !loading ? "0 12px 40px rgba(6,182,212,0.38)" : "0 6px 24px rgba(6,182,212,0.22)",
        transition: "all 0.2s",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

/* ============================================================
   CalibrationGateModal — Zip + Phone mid-scan capture
   ============================================================ */
function CalibrationGateModal({ onSubmit }) {
  const [zipCode, setZipCode] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [errors, setErrors] = useState({});
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  // Focus first input on mount
  useEffect(() => {
    const t = setTimeout(() => firstInputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Suppress Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const handler = (e) => {
      if (e.key !== "Tab") return;
      const focusable = modal.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleZipChange = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 5);
    setZipCode(digits);
    if (errors.zipCode) setErrors((e) => ({ ...e, zipCode: "" }));
  };

  const handlePhoneChange = (val) => {
    const digits = stripNonDigits(val).slice(0, 10);
    setPhoneRaw(digits);
    if (errors.phone) setErrors((e) => ({ ...e, phone: "" }));
  };

  const handleSubmit = () => {
    const e = {};
    if (zipCode.length !== 5) e.zipCode = "Enter a valid 5-digit zip code";
    if (!isValidUSPhone(phoneRaw)) e.phone = "Enter a valid 10-digit mobile number";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    onSubmit({ zipCode, mobileNumber: phoneRaw });
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.60)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => e.stopPropagation()} // prevent any backdrop dismiss
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Finalize Local Calibration"
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#0A0A0A",
          border: "1px solid rgba(51,65,85,0.6)",
          borderRadius: 0,
          padding: "32px 28px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 60px rgba(15,31,53,0.5)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "99px",
            padding: "5px 14px",
            marginBottom: "18px",
          }}
        >
          <span style={{ fontSize: "10px" }}>🔴</span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.5px" }}>
            6 Red Flags Identified in Demo File
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#f1f5f9",
            margin: "0 0 10px",
            lineHeight: 1.2,
          }}
        >
          Finalize Local Calibration
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "13px",
            color: "rgb(148,163,184)",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          Enter Your Zip To Pull Your Local County Data, and Your Mobile to Instantly and Privately Unlock Your Report.
        </p>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "rgb(148,163,184)",
                marginBottom: "6px",
              }}
            >
              Project Zip Code
            </label>
            <input
              ref={firstInputRef}
              type="text"
              inputMode="numeric"
              placeholder="33441"
              value={zipCode}
              onChange={(e) => handleZipChange(e.target.value)}
              maxLength={5}
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 0,
                background: "rgba(255,255,255,0.05)",
                color: "#f1f5f9",
                border: `1.5px solid ${errors.zipCode ? "rgba(239,68,68,0.65)" : "rgba(255,255,255,0.1)"}`,
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            />

            {errors.zipCode && (
              <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "5px" }}>{errors.zipCode}</div>
            )}
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "rgb(148,163,184)",
                marginBottom: "6px",
              }}
            >
              Secure Mobile Number
            </label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(555) 555-5555"
              value={formatPhoneDisplay(phoneRaw)}
              onChange={(e) => handlePhoneChange(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: 0,
                background: "rgba(255,255,255,0.05)",
                color: "#f1f5f9",
                border: `1.5px solid ${errors.phone ? "rgba(239,68,68,0.65)" : "rgba(255,255,255,0.1)"}`,
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            />

            {errors.phone && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "5px" }}>{errors.phone}</div>}
            <div style={{ fontSize: "11px", color: "rgb(100,116,139)", marginTop: "8px", lineHeight: 1.5 }}>
              🔒 256-Bit Encrypted. Look For a Secure Link So You Don't Lose This
            </div>
          </div>

          <button
            onClick={handleSubmit}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
            style={{
              width: "100%",
              padding: "16px",
              background: "#C8952A",
              color: "#0a0a0a",
              fontWeight: 800,
              fontSize: "15px",
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              marginTop: "4px",
              fontFamily: "'Inter', system-ui, sans-serif",
              boxShadow: "0 6px 24px rgba(200,149,42,0.35)",
              transition: "filter 0.15s",
            }}
          >
            Calculate Final Risk Score ➔
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ScanTerminal — renders the terminal UI
   Enhanced with: Red Flag Counter, Threat Level Bar, System Alert flash
   ============================================================ */
function ScanTerminal({ lines, progress, terminalRef, firstName }) {
  const isComplete = progress === 100;

  // Red flag counter: count danger + warn lines
  const flagCount = lines.filter((l) => l.type === "danger" || l.type === "warn").length;

  // Threat level derived from flag count
  const threatLevel = flagCount >= 6 ? "CRITICAL" : flagCount >= 3 ? "ELEVATED" : "LOW";
  const threatColor = threatLevel === "CRITICAL" ? T.red : threatLevel === "ELEVATED" ? T.amber : T.green;
  const threatBarPct = Math.min((flagCount / 12) * 100, 100);

  // System alert present — flash terminal border red
  const hasSystemAlert = lines.some((l) => l.type === "system_alert");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: T.fontMono,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ width: "100%", maxWidth: "700px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.24)",
              borderRadius: "99px",
              padding: "7px 18px",
              marginBottom: "18px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: T.cyan,
                display: "inline-block",
                animation: isComplete ? "none" : "blink 1s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: "11px", color: T.cyan, letterSpacing: "2px", fontWeight: 600 }}>
              {isComplete ? "SCAN COMPLETE" : "SCANNING IN PROGRESS"}
            </span>
          </div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: T.text,
              margin: "0 0 10px",
              fontFamily: T.fontSans,
              lineHeight: 1.2,
            }}
          >
            {firstName ? `${firstName}, Your` : "Your"} <span style={{ color: T.cyan }}>Truth Report</span> Is Being
            Built
          </h1>
        </div>

        {/* Terminal card */}
        <div
          style={{
            background: "#080d14",
            border: `1px solid ${hasSystemAlert ? "rgba(239,68,68,0.6)" : "rgba(6,182,212,0.14)"}`,
            borderRadius: 0,
            overflow: "hidden",
            transition: "border-color 0.4s ease",
            boxShadow: hasSystemAlert ? "0 0 30px rgba(239,68,68,0.15), inset 0 0 30px rgba(239,68,68,0.03)" : "none",
          }}
        >
          {/* Terminal header bar */}
          <div
            style={{
              background: "rgba(6,182,212,0.055)",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(6,182,212,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
              <div
                key={c}
                style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.75 }}
              />
            ))}
            <span style={{ fontSize: "11px", color: "rgba(6,182,212,0.55)", marginLeft: "8px", flex: 1 }}>
              windowman-ai-scanner — v2.4.1
            </span>
            {/* Red Flag Counter Badge */}
            {flagCount > 0 && (
              <div
                key={flagCount}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  background: flagCount >= 6 ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.15)",
                  border: `1px solid ${flagCount >= 6 ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.35)"}`,
                  borderRadius: "99px",
                  padding: "3px 10px",
                  animation: "flagPulse 0.4s ease-out",
                }}
              >
                <span style={{ fontSize: "10px" }}>🚩</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.5px",
                    color: flagCount >= 6 ? T.red : T.amber,
                    fontFamily: T.fontMono,
                  }}
                >
                  {flagCount} {flagCount === 1 ? "FLAG" : "FLAGS"}
                </span>
              </div>
            )}
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            style={{ padding: "16px 20px", height: "300px", overflowY: "auto", scrollBehavior: "smooth" }}
          >
            {lines.map((line, i) => {
              // System alert line gets special treatment
              if (line.type === "system_alert") {
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: "13px",
                      color: T.red,
                      lineHeight: "1.95",
                      fontWeight: 700,
                      background: "rgba(239,68,68,0.08)",
                      borderLeft: `3px solid ${T.red}`,
                      padding: "2px 0 2px 10px",
                      margin: "4px 0",
                      animation: "alertFlash 0.6s ease-out",
                    }}
                  >
                    {line.text}
                  </div>
                );
              }

              const color =
                line.type === "danger"
                  ? T.red
                  : line.type === "warn"
                    ? T.amber
                    : line.type === "complete"
                      ? T.cyan
                      : line.type === "data"
                        ? T.green
                        : "rgba(241,245,249,0.55)";
              const isDataLine = line.type === "data" || line.type === "complete";
              return (
                <div
                  key={i}
                  style={{
                    fontSize: "13px",
                    color,
                    lineHeight: "1.95",
                    fontWeight: line.type === "complete" ? 700 : 400,
                  }}
                >
                  {!isDataLine && <span style={{ color: "rgba(6,182,212,0.35)", marginRight: "9px" }}>$</span>}
                  {line.text}
                </div>
              );
            })}
            {lines.length > 0 && !isComplete && (
              <div style={{ fontSize: "13px", color: T.muted, lineHeight: "1.95" }}>
                <span style={{ color: "rgba(6,182,212,0.35)", marginRight: "9px" }}>$</span>
                <span style={{ animation: "blink 0.9s step-end infinite" }}>▋</span>
              </div>
            )}
          </div>

          {/* Footer: Progress bar + Threat level */}
          <div style={{ padding: "12px 20px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {/* Progress */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
              <span style={{ fontSize: "11px", color: T.faint, letterSpacing: "1px" }}>ANALYSIS PROGRESS</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: isComplete ? T.red : T.cyan }}>{progress}%</span>
            </div>
            <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "99px" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: "99px",
                  background: isComplete
                    ? `linear-gradient(90deg, ${T.red}, #f97316)`
                    : `linear-gradient(90deg, ${T.cyan}, #38bdf8)`,
                  width: `${progress}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* Threat Level Bar */}
            {flagCount > 0 && (
              <div style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontSize: "10px", color: T.faint, letterSpacing: "1.5px", fontWeight: 600 }}>
                    THREAT LEVEL
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "1px",
                      color: threatColor,
                      animation: threatLevel === "CRITICAL" ? "pulse 1.1s ease-in-out infinite" : "none",
                    }}
                  >
                    {threatLevel}
                  </span>
                </div>
                <div
                  style={{
                    height: "4px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "99px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: "99px",
                      background:
                        threatLevel === "CRITICAL"
                          ? `linear-gradient(90deg, ${T.amber}, ${T.red})`
                          : threatLevel === "ELEVATED"
                            ? `linear-gradient(90deg, ${T.green}, ${T.amber})`
                            : T.green,
                      width: `${threatBarPct}%`,
                      transition: "width 0.5s ease, background 0.5s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes flagPulse{0%{transform:scale(1.25)}100%{transform:scale(1)}}
        @keyframes alertFlash{0%{background:rgba(239,68,68,0.25)}100%{background:rgba(239,68,68,0.08)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
      `}</style>
    </div>
  );
}

function ScoreReveal({ score }) {
  const color = score < 60 ? T.red : score < 80 ? T.amber : T.green;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.fontSans,
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "3px",
          color: "rgba(239,68,68,0.8)",
          fontFamily: T.fontMono,
          marginBottom: "8px",
        }}
      >
        RISK SCORE
      </div>
      <div style={{ fontSize: "128px", fontWeight: 800, lineHeight: 1, color }}>{score}</div>
      <div style={{ fontSize: "18px", color: T.muted, marginTop: "4px" }}>
        out of 100 — Grade: <span style={{ color: T.red, fontWeight: 800 }}>{DEMO.grade}</span>
      </div>
      <div
        style={{
          marginTop: "20px",
          fontSize: "17px",
          fontWeight: 700,
          color: T.red,
          animation: "pulse 1.1s ease-in-out infinite",
        }}
      >
        10 Critical Issues Detected
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
    </div>
  );
}

function DemoReport({ lead, onUploadQuote, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  const firstName = lead?.name?.split(" ")[0] || "there";
  const handleConversionClick = (e) => {
    e.preventDefault();
    onClose?.();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onUploadQuote?.();
      });
    });
  };
  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100vh",
        color: T.text,
        fontFamily: T.fontSans,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.7s ease",
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, rgba(245,158,11,0.14), rgba(245,158,11,0.07), rgba(245,158,11,0.14))",
          borderBottom: "1px solid rgba(245,158,11,0.28)",
          padding: "11px 20px",
          textAlign: "center",
          position: "sticky",
          top: 0,
          zIndex: 200,
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: "940px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "13px", color: "#fbbf24", fontWeight: 600 }}>
            ⚡ DEMO — Real Data.{" "}
            <a
              href="#"
              onClick={handleConversionClick}
              style={{ color: T.cyan, textDecoration: "underline", fontWeight: 700 }}
            >
              Upload YOUR Quote →
            </a>
          </span>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "#fbbf24",
                padding: "6px 14px",
                borderRadius: 0,
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Exit Demo ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ maxWidth: "940px", margin: "0 auto", padding: "44px 20px 140px" }}>
        <FadeIn delay={0}>
          <div style={{ marginBottom: "40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "13px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: T.cyan }} />
              <Kicker>WINDOW MAN AI TRUTH REPORT</Kicker>
            </div>
            <h1 style={{ fontSize: "38px", fontWeight: 800, lineHeight: 1.1, margin: "0 0 10px" }}>
              {firstName.charAt(0).toUpperCase() + firstName.slice(1)}'s WindowMan Truth Report
            </h1>
            <p style={{ color: T.muted, fontSize: "15px", margin: 0 }}>
              Forensic Consumer Protection Analysis — {DEMO.city}, FL {DEMO.zip}
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={120}>
          <Card highlight>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "24px",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", color: T.muted, marginBottom: "6px" }}>Overall Risk Score</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                  <div style={{ fontSize: "68px", fontWeight: 800, color: T.red, lineHeight: 1 }}>{DEMO.score}</div>
                  <div style={{ color: T.faint, fontSize: "17px" }}>/ 100</div>
                  <Pill tone="danger">CRITICAL</Pill>
                </div>
              </div>
              <div style={{ minWidth: "260px" }}>
                {DEMO.pillars.map((p) => {
                  const barColor = p.status === "flag" ? T.red : T.amber;
                  return (
                    <div
                      key={p.label}
                      style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "9px" }}
                    >
                      <div
                        style={{ width: "72px", fontSize: "12px", color: T.muted, textAlign: "right", flexShrink: 0 }}
                      >
                        {p.label}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: "7px",
                          background: "rgba(255,255,255,0.07)",
                          borderRadius: "99px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{ height: "100%", borderRadius: "99px", background: barColor, width: `${p.score}%` }}
                        />
                      </div>
                      <div
                        style={{
                          width: "28px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: barColor,
                          textAlign: "right",
                        }}
                      >
                        {p.score}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </FadeIn>
        <FadeIn delay={220}>
          <SectionHead kicker="CRITICAL FINDINGS" title="Do Not Sign Until These Are Fixed" />
          <div style={{ display: "grid", gap: "12px" }}>
            {FINDINGS.map((f, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 0,
                  padding: "18px",
                }}
              >
                <Pill tone="danger" sm>
                  FLAG
                </Pill>
                <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "8px", marginBottom: "8px" }}>
                  {f.title}
                </div>
                <p style={{ fontSize: "13px", color: T.muted, lineHeight: 1.6 }}>{f.why}</p>
                <p style={{ fontSize: "13px", color: T.green, marginTop: "8px", lineHeight: 1.6 }}>→ {f.what}</p>
              </div>
            ))}
          </div>
        </FadeIn>
        <FadeIn delay={300}>
          <SectionHead kicker="NEXT STEPS" title="Protect yourself before you sign" />
          <Card>
            <div style={{ display: "grid", gap: "10px", marginBottom: "28px" }}>
              {NEXT_STEPS.map((b, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 0,
                    background: "rgba(6,182,212,0.04)",
                    border: "1px solid rgba(6,182,212,0.11)",
                    display: "flex",
                    gap: "11px",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: T.cyan,
                      flexShrink: 0,
                      marginTop: "6px",
                    }}
                  />
                  <div style={{ fontSize: "13px", color: "rgba(241,245,249,0.82)", lineHeight: 1.65 }}>{b}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "28px 24px",
                borderRadius: 0,
                background: "linear-gradient(135deg, rgba(200,149,42,0.15), rgba(200,149,42,0.06))",
                border: "1px solid rgba(200,149,42,0.35)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px", color: T.text }}>
                This Was a Demo. Yours Could Be Worse.
              </div>
              <div style={{ fontSize: "14px", color: T.muted, marginBottom: "24px", lineHeight: 1.6 }}>
                Upload Your Real Quote — Get Your Actual Truth Report in 60 seconds. Free.
              </div>
              <a
                href="#"
                onClick={handleConversionClick}
                style={{
                  display: "inline-block",
                  width: "100%",
                  maxWidth: "420px",
                  padding: "18px 28px",
                  borderRadius: 0,
                  background: "linear-gradient(135deg, #C8952A, #e0a830)",
                  color: "#0a0a0a",
                  fontWeight: 800,
                  fontSize: "17px",
                  textDecoration: "none",
                  boxShadow: "0 0 30px rgba(200,149,42,0.4), 0 6px 20px rgba(0,0,0,0.3)",
                  transition: "all 0.2s ease",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 50px rgba(200,149,42,0.6), 0 8px 30px rgba(0,0,0,0.4)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 30px rgba(200,149,42,0.4), 0 6px 20px rgba(0,0,0,0.3)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                Scan My Actual Quote Now →
              </a>
            </div>
          </Card>
        </FadeIn>
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 150,
          background: "rgba(7,11,18,0.93)",
          backdropFilter: "blur(18px)",
          borderTop: "1px solid rgba(200,149,42,0.25)",
          padding: "13px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "940px",
            margin: "0 auto",
            display: "flex",
            gap: "14px",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "14px" }}>
            <span style={{ fontWeight: 700, color: T.text }}>This is a Demo.</span>{" "}
            <span style={{ color: "#C8952A", fontWeight: 600 }}>Your Real Quote Could Have Hidden Issues Too.</span>
          </div>
          <a
            href="#"
            onClick={handleConversionClick}
            style={{
              padding: "12px 24px",
              borderRadius: 0,
              background: "linear-gradient(135deg, #C8952A, #e0a830)",
              color: "#0a0a0a",
              fontWeight: 800,
              fontSize: "14px",
              textDecoration: "none",
              boxShadow: "0 0 20px rgba(200,149,42,0.35)",
              transition: "all 0.2s",
            }}
          >
            Scan My Quote — Free →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DemoScanPage — orchestrates scanning, calibration gate, reveal
   ============================================================ */
function DemoScanPage({ lead, onUploadQuote, onClose, onCalibrationComplete }) {
  const [phase, setPhase] = useState("scanning");
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [isCalibrationGateOpen, setIsCalibrationGateOpen] = useState(false);
  const terminalRef = useRef(null);
  const timersRef = useRef([]);

  // Refs for timer-sensitive state to avoid stale closures
  const isDemoPausedRef = useRef(false);
  const hasCalibrationBeenSubmittedRef = useRef(false);
  // Track the index of the trigger line so we know where to resume
  const triggerLineIndexRef = useRef(-1);

  const firstName = lead?.name?.split(" ")[0] || "";

  // Find the trigger line index once
  const triggerIndex = SCAN_LINES.findIndex((line) =>
    line.text.startsWith(CALIBRATION_TRIGGER_TEXT.replace("...", "")),
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Main scanning effect
  useEffect(() => {
    if (phase !== "scanning") return;

    // Reset refs on fresh scan start
    isDemoPausedRef.current = false;
    hasCalibrationBeenSubmittedRef.current = false;

    const timers = SCAN_LINES.map((line, i) => {
      const tid = setTimeout(() => {
        // If paused, don't render any more lines
        if (isDemoPausedRef.current) return;

        setLines((prev) => [...prev, line]);
        setProgress(Math.round(((i + 1) / SCAN_LINES.length) * 100));
        requestAnimationFrame(() => {
          if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        });

        // Check if this is the trigger line
        if (i === triggerIndex && !hasCalibrationBeenSubmittedRef.current) {
          // Freeze: cancel all future timers
          isDemoPausedRef.current = true;
          triggerLineIndexRef.current = i;

          // Cancel remaining timers (those for lines after this one + transition)
          timersRef.current.forEach((tid2) => clearTimeout(tid2));
          timersRef.current = [];

          setIsCalibrationGateOpen(true);
        }
      }, line.ms);
      return tid;
    });

    // Transition timer (only fires if no freeze happened)
    const transitionTimer = setTimeout(
      () => {
        if (!isDemoPausedRef.current) {
          setPhase("revealing");
        }
      },
      SCAN_LINES[SCAN_LINES.length - 1].ms + 1400,
    );

    timersRef.current = [...timers, transitionTimer];

    return () => clearTimers();
  }, [phase]);

  // Score reveal counter
  useEffect(() => {
    if (phase !== "revealing") return;
    const target = DEMO.score;
    const duration = 1300;
    const tickMs = 16;
    const increment = target / (duration / tickMs);
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(current + increment, target);
      setScoreDisplay(Math.round(current));
      if (current >= target) {
        clearInterval(interval);
        setTimeout(() => setPhase("report"), 900);
      }
    }, tickMs);
    return () => clearInterval(interval);
  }, [phase]);

  // Handle calibration submit — resume the scan
  const handleCalibrationSubmit = useCallback(
    ({ zipCode, mobileNumber }) => {
      // Update refs
      hasCalibrationBeenSubmittedRef.current = true;
      isDemoPausedRef.current = false;

      // Close modal
      setIsCalibrationGateOpen(false);

      // Lift data up to parent
      onCalibrationComplete?.({ zipCode, mobileNumber });

      // Get remaining lines after the trigger
      const resumeFromIndex = triggerLineIndexRef.current + 1;
      const remainingLines = SCAN_LINES.slice(resumeFromIndex);

      // Add the "[DONE] Risk Score Computed" line
      const doneConfirmLine = { text: "[DONE] Risk Score Computed", type: "complete" };

      // Print the trigger line's progress stays at 90%, now resume
      // Schedule remaining lines with compressed timing
      const baseDelay = 200; // start after 200ms
      const perLine = 350; // 350ms between lines

      const newTimers = [];

      remainingLines.forEach((line, i) => {
        const tid = setTimeout(
          () => {
            setLines((prev) => [...prev, line]);
            setProgress(Math.round(((resumeFromIndex + i + 1) / SCAN_LINES.length) * 100));
            requestAnimationFrame(() => {
              if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            });
          },
          baseDelay + i * perLine,
        );
        newTimers.push(tid);
      });

      // After all remaining lines, add the DONE line
      const afterAllLines = baseDelay + remainingLines.length * perLine;
      newTimers.push(
        setTimeout(() => {
          setLines((prev) => [...prev, doneConfirmLine]);
          setProgress(100);
          requestAnimationFrame(() => {
            if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          });
        }, afterAllLines),
      );

      // Transition to reveal after DONE line
      newTimers.push(
        setTimeout(() => {
          setPhase("revealing");
        }, afterAllLines + 1200),
      );

      timersRef.current = newTimers;
    },
    [onCalibrationComplete],
  );

  if (phase === "scanning" || isCalibrationGateOpen) {
    return (
      <div style={{ position: "relative" }}>
        <div
          style={{
            filter: isCalibrationGateOpen ? "blur(6px)" : "none",
            pointerEvents: isCalibrationGateOpen ? "none" : "auto",
            transition: "filter 0.3s ease",
          }}
        >
          <ScanTerminal lines={lines} progress={progress} terminalRef={terminalRef} firstName={firstName} />
        </div>
        {isCalibrationGateOpen && <CalibrationGateModal onSubmit={handleCalibrationSubmit} />}
      </div>
    );
  }
  if (phase === "revealing") return <ScoreReveal score={scoreDisplay} />;
  return <DemoReport lead={lead} onUploadQuote={onUploadQuote} onClose={onClose} />;
}

/* ============================================================
   PowerToolFlow — top-level orchestrator
   ============================================================ */
const PowerToolFlow = React.forwardRef<
  unknown,
  { onUploadQuote?: () => void; triggerOpen?: boolean; onToolClose?: () => void }
>(function PowerToolFlow({ onUploadQuote, triggerOpen, onToolClose }, _ref) {
  const [state, setState] = useState("idle");
  const [lead, setLead] = useState(null);
  const [calibrationData, setCalibrationData] = useState(null);

  useEffect(() => {
    if (state !== "idle") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [state]);

  const openModal = () => {
    console.log({ event: "wm_power_tool_opened" });
    setState("modal");
  };
  const closeAll = () => {
    setState("idle");
    onToolClose?.();
  };
  useEffect(() => {
    if (triggerOpen && state === "idle") openModal();
  }, [triggerOpen]);

  const handleLeadComplete = (formData) => {
    setLead(formData);
    setState("demo");
  };
  const handleCalibrationComplete = useCallback((data) => {
    setCalibrationData(data);
    console.log({ event: "wm_calibration_submitted", zipCode: data.zipCode });
  }, []);

  return (
    <div
      id="power-tool-isolated-container"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        color: "#0f172a",
        backgroundColor: "transparent",
      }}
    >
      <div className="ds-wrapper" style={{ fontFamily: DS.fontUI }}>
        <style>{DS_PAGE_STYLES}</style>
        <PowerToolButton onClick={openModal} />
      </div>
      {state === "modal" &&
        createPortal(<LeadModal onComplete={handleLeadComplete} onClose={closeAll} />, document.body)}
      {state === "demo" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              overflowY: "auto",
              background: T.bg,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            <DemoScanPage
              lead={lead}
              onUploadQuote={onUploadQuote}
              onClose={closeAll}
              onCalibrationComplete={handleCalibrationComplete}
            />
          </div>,
          document.body,
        )}
    </div>
  );
});

export default PowerToolFlow;

export { LeadModal, DemoScanPage };
