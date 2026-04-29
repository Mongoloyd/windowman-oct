import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BrainCircuit,
  Cpu,
  Scan,
  ChevronRight,
  FileText,
  Zap,
  Shield,
  Search,
  ShieldCheck,
  Activity,
  ShieldAlert,
  ZoomIn,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type LineItemStatus = "critical" | "caution" | "verified" | "neutral";

type LineItem = {
  id: string | number;
  label: string;
  cost: string;
  status: LineItemStatus;
  note?: string;
};

type ScenarioSpecs = {
  stc: string;
  uFactor: string;
  shgc: string;
  frame: string;
};

type AlertLevel = "critical" | "caution" | "verified";

type QuoteScenario = {
  id: "predatory" | "vague" | "fair";
  label: string;
  client: string;
  contractor: string;
  license: string;
  date: string;
  quoteRef: string;
  specifiedBrand: string;
  noaCode: string;
  licenseAnomaly: boolean;
  alertLevel: AlertLevel;
  summaryTitle: string;
  summaryText: string;
  integrityScore: number;
  finePrintTrap: boolean;
  subtotal: string;
  total: string;
  specs: ScenarioSpecs;
  lineItems: LineItem[];
};

// ═══════════════════════════════════════════════════════════════
// SCENARIO DATA
// ═══════════════════════════════════════════════════════════════

const quoteScenarios: QuoteScenario[] = [
  {
    id: "predatory",
    label: "Predatory Trap",
    client: "Nexus Residential Holdings",
    contractor: "Elite Panes & Glass",
    license: "LIC# ABC-99120",
    date: "October 24, 2026",
    quoteRef: "#WIN-9928-EXT",
    specifiedBrand: "Custom Vinyl Series (Unspecified)",
    noaCode: "Missing",
    licenseAnomaly: true,
    alertLevel: "critical",
    summaryTitle: "CRITICAL RISK: DO NOT SIGN.",
    summaryText:
      "This quote contains a predatory 75% upfront deposit requirement, flags for an invalid license format, and specifies materials (DP-15) that fail local coastal building codes.",
    integrityScore: 35,
    finePrintTrap: true,
    subtotal: "$28,390.75",
    total: "$30,804.00",
    specs: { stc: "32", uFactor: "0.27", shgc: "0.21", frame: "VINYL" },
    lineItems: [
      { id: 1, label: "Series 8000 Vinyl Double-Hung (Qty: 12)", cost: "$9,600.00", status: "neutral" },
      {
        id: 2,
        label: "Structural DP-15 Performance Rating",
        cost: "$1,200.00",
        status: "critical",
        note: "Substandard DP rating for Coastal Zone. Minimum DP-40 required by local code.",
      },
      {
        id: 3,
        label: "Custom Aluminum Exterior Capping",
        cost: "$14,200.00",
        status: "critical",
        note: "Price variance 450% above regional labor average.",
      },
      {
        id: 4,
        label: "Pre-Installation Deposit (75%)",
        cost: "$20,662.50",
        status: "critical",
        note: "Excessive deposit flag. Industry standard is 10-33%.",
      },
    ],
  },
  {
    id: "vague",
    label: "Vague & Undefined",
    client: "Nexus Residential Holdings",
    contractor: "Coastal Breeze Installs",
    license: "CGC1529981",
    date: "October 24, 2026",
    quoteRef: "#WIN-1004-CBI",
    specifiedBrand: "Not Specified",
    noaCode: "Missing",
    licenseAnomaly: false,
    alertLevel: "caution",
    summaryTitle: "CAUTION REQUIRED: REQUEST REVISIONS.",
    summaryText:
      'Do not sign this agreement as written. This quote lacks specific manufacturer brands, omits NOA approval codes, and uses vague "allowances," which legally permits the contractor to install cheaper, substandard materials at a premium price.',
    integrityScore: 62,
    finePrintTrap: false,
    subtotal: "$20,000.00",
    total: "$20,000.00",
    specs: { stc: "NOT SPECIFIED", uFactor: "NOT SPECIFIED", shgc: "NOT SPECIFIED", frame: "NOT SPECIFIED" },
    lineItems: [
      {
        id: 1,
        label: "Impact Window Package - Whole House (Qty: 10)",
        cost: "$14,500.00",
        status: "caution",
        note: '"Package" pricing hides individual unit costs and manufacturer details. Demands an itemized breakdown.',
      },
      {
        id: 2,
        label: "Permit & Engineering Allowance",
        cost: "$1,500.00",
        status: "caution",
        note: '"Allowance" means this is an estimate, not a fixed cost. You are liable for any overages.',
      },
      { id: 3, label: "Standard Installation & Haul Away", cost: "$4,000.00", status: "neutral" },
      {
        id: 4,
        label: "Pre-Installation Deposit (40%)",
        cost: "$8,000.00",
        status: "caution",
        note: "Slightly elevated deposit. Recommend negotiating down to 30%.",
      },
    ],
  },
  {
    id: "fair",
    label: "Fair Market Standard",
    client: "Nexus Residential Holdings",
    contractor: "Precision Impact Windows",
    license: "CGC1530092",
    date: "October 24, 2026",
    quoteRef: "#WIN-7731-PIW",
    specifiedBrand: "PGT Winguard Aluminum Series",
    noaCode: "NOA-230114.05 (Verified Active)",
    licenseAnomaly: false,
    alertLevel: "verified",
    summaryTitle: "VERIFIED & FAIR: PROCEED WITH CONFIDENCE.",
    summaryText:
      "This quote is fully transparent. It specifies premium verifiable brands (PGT), meets all stringent South Florida hurricane codes (DP-70), and requests an industry-standard 25% deposit. Pricing is within 4% of the regional fair market average.",
    integrityScore: 98,
    finePrintTrap: false,
    subtotal: "$12,050.00",
    total: "$12,050.00",
    specs: { stc: "34", uFactor: "0.24", shgc: "0.19", frame: "ALUMINUM" },
    lineItems: [
      {
        id: 1,
        label: "PGT Winguard Aluminum Single Hung (Qty: 10)",
        cost: "$11,200.00",
        status: "verified",
        note: "Brand and NOA code match active state registry.",
      },
      {
        id: 2,
        label: "Structural DP-70 Performance Upgrade",
        cost: "Included",
        status: "verified",
        note: "Exceeds local coastal code requirements.",
      },
      {
        id: 3,
        label: "Permits, Engineering, & Notice of Commencement",
        cost: "$850.00",
        status: "verified",
        note: "Fixed cost. No hidden allowances.",
      },
      {
        id: 4,
        label: "Pre-Installation Deposit (25%)",
        cost: "$3,012.50",
        status: "verified",
        note: "Industry standard deposit structure.",
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const INITIAL_SCANNER_STATE = {
  scanProgress: 0,
  activeAnomalies: [] as Array<string | number>,
  isScanning: false,
  isComplete: false,
};

const SCAN_STEP = 2;
const SCAN_DELAY = 40;
const ITEM_START = 24;
const ITEM_RANGE = 56;
const LICENSE_TRIGGER = 14;
const FINEPRINT_TRIGGER = 84;

// ═══════════════════════════════════════════════════════════════
// TRUST SCORE WIDGET
// ═══════════════════════════════════════════════════════════════

const TrustScoreWidget = ({
  isScanning,
  integrityScore,
  alertLevel,
}: {
  isScanning: boolean;
  integrityScore: number;
  alertLevel: AlertLevel;
}) => {
  const score = integrityScore;

  const [currentCheck, setCurrentCheck] = useState(0);
  const [logs, setLogs] = useState([{ id: 1, text: "DBPR Database Connection: ESTABLISHED", type: "success" }]);

  const backgroundChecks = [
    { label: "BBB Rating", status: "A+", detail: "No unresolved complaints" },
    { label: "GL Insurance", status: "VALID", detail: "$2M Aggregate Policy" },
    { label: "Workers Comp", status: "EXEMPT", detail: "Verified via Sunbiz.org" },
    { label: "Litigation History", status: "CLEAN", detail: "0 matches in Civil Court" },
  ];

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setCurrentCheck((prev) => {
          const next = (prev + 1) % backgroundChecks.length;
          const newLog = {
            id: Date.now(),
            text: `Querying ${backgroundChecks[next].label}... MATCH FOUND`,
            type: "info",
          };
          setLogs((currentLogs) => [newLog, ...currentLogs].slice(0, 5));
          return next;
        });
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [isScanning]);

  return (
    <div
      className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg overflow-hidden shadow-xl flex flex-col"
      data-testid="orange-scanner-trust-score"
    >
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div>
          <h4 className="text-[10px] text-slate-200 mb-1">Contractor Integrity Score</h4>
          <div className="text-3xl font-black font-mono flex items-baseline">
            <span
              className={`transition-colors duration-500 ${score < 70 ? "text-red-500" : score < 85 ? "text-orange-400" : "text-cyan-400"}`}
            >
              {score}
            </span>
            <span className="text-xs text-slate-200 ml-1">/100</span>
          </div>
        </div>
        <div className="relative h-12 w-12 flex items-center justify-center">
          <Activity
            className={`absolute transition-colors duration-500 opacity-20 ${isScanning ? "animate-ping" : ""} ${score < 70 ? "text-red-500" : "text-cyan-500"}`}
            size={40}
          />
          <ShieldCheck
            className={`transition-colors duration-500 ${score < 70 ? "text-red-500" : score < 85 ? "text-orange-400" : "text-cyan-400"}`}
            size={24}
          />
        </div>
      </div>

      <div className="p-4 space-y-3 bg-black/20">
        <div className="flex items-center gap-2 text-[10px] text-slate-200 font-bold uppercase mb-2">
          <Search size={12} className={isScanning ? "animate-spin" : ""} />
          Deep Web Background Audit
        </div>
        {backgroundChecks.map((check, index) => (
          <div
            key={index}
            className={`flex justify-between items-center text-xs p-2 rounded transition-all duration-300 ${currentCheck === index ? "bg-cyan-500/10 border border-cyan-500/30 scale-[1.02] text-cyan-400" : "border border-transparent text-slate-200"}`}
          >
            <span className="text-slate-300 font-medium">{check.label}</span>
            <div className="text-right">
              <div className="font-bold text-cyan-400 tracking-wider">{check.status}</div>
              <div className="text-[9px] text-slate-400 uppercase">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-slate-950 font-mono text-[9px] md:text-[10px] h-24 flex flex-col justify-end border-t border-slate-800/80 shadow-inner">
        <div className="flex flex-col-reverse gap-1">
          {logs.map((log, idx) => (
            <div
              key={log.id}
              className={`leading-tight transition-opacity duration-300 ${idx === 0 ? "text-cyan-400" : "text-slate-300"}`}
            >
              <span className="text-slate-400 mr-2">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
              {log.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FINE PRINT SCANNER
// ═══════════════════════════════════════════════════════════════

const FinePrintScanner = ({ scanProgress, isScanning }: { scanProgress: number; isScanning: boolean }) => {
  const [zoomActive, setZoomActive] = useState(false);

  useEffect(() => {
    if (scanProgress > 82) setZoomActive(true);
    else setZoomActive(false);
  }, [scanProgress]);

  const traps = [
    "Subject to 15% price increase upon delivery based on material surcharges.",
    "Contractor holds zero liability for structural rot discovered during tear-out.",
    "Failure to provide water/power access results in $500/day mobilization fee.",
  ];

  return (
    <div className="mt-8 pt-6 border-t border-slate-200 relative pb-10" data-testid="orange-scanner-fineprint">
      <h5 className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
        <ZoomIn size={10} /> Standard Terms & Conditions (v2.04)
      </h5>
      <div className="text-[6px] leading-[8px] text-slate-400 font-serif select-none">
        {traps.map((text, i) => (
          <p key={i} className="mb-1 opacity-60 italic">
            {text}
          </p>
        ))}
        <p className="opacity-30">
          All warranties are non-transferable and subject to arbitration in the state of Delaware. Customer agrees to
          indemnify... [Content Truncated]
        </p>
      </div>

      {zoomActive && isScanning && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-none w-[110%]"
          style={{ top: `${Math.min(50, (scanProgress - 82) * 4)}px` }}
        >
          <div className="w-full h-24 bg-white/95 shadow-[0_20px_50px_rgba(239,68,68,0.3)] border-y-2 border-red-500 backdrop-blur-md relative overflow-hidden flex flex-col justify-center px-8 animate-in zoom-in duration-300">
            <div className="text-red-600 font-bold text-xs uppercase mb-1 flex items-center gap-2">
              <ShieldAlert size={14} className="animate-pulse" /> Hidden Liability Detected
            </div>
            <div className="text-slate-900 font-bold text-lg leading-tight tracking-tight">
              {scanProgress > 88 ? (
                <span className="bg-red-200 px-1 italic">"...responsible for ALL structural rot costs"</span>
              ) : (
                <span className="bg-red-200 px-1">"Subject to 15% price increase..."</span>
              )}
            </div>
            <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-red-500" />
            <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-red-500" />
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-red-500" />
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-red-500" />
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// VERDICT HOLOGRAM
// ═══════════════════════════════════════════════════════════════

const VerdictHologram = React.forwardRef<
  HTMLDivElement,
  {
    isOpen: boolean;
    alertLevel: AlertLevel;
    summaryTitle: string;
    summaryText: string;
    integrityScore: number;
    activeAnomalies: Array<string | number>;
    onScanClick: () => void;
    onDemoClick: () => void;
  }
>(
  (
    { isOpen, alertLevel, summaryTitle, summaryText, integrityScore, activeAnomalies, onScanClick, onDemoClick },
    ref,
  ) => {
    if (!isOpen) return null;

    const themeMap = {
      critical: {
        border: "border-red-500/50",
        glow: "shadow-[0_0_50px_rgba(239,68,68,0.4)]",
        overlay: "from-red-500/10",
        iconColor: "text-red-500",
        headline: "DO NOT SIGN",
        headlineColor: "text-red-500",
        riskCards: [
          { title: "Structural Safety", text: "Substandard DP-15 rating in a Coastal Zone." },
          { title: "Financial Risk", text: "Excessive 75% deposit is 3x the industry standard." },
          { title: "Legal Trap", text: "Hidden 15% surcharge found in fine print." },
        ],
      },
      caution: {
        border: "border-amber-500/50",
        glow: "shadow-[0_0_50px_rgba(245,158,11,0.4)]",
        overlay: "from-amber-500/10",
        iconColor: "text-amber-500",
        headline: "REQUEST REVISIONS",
        headlineColor: "text-amber-500",
        riskCards: [
          { title: "Missing Specifications", text: "No manufacturer brand or NOA code specified." },
          { title: "Vague Pricing", text: '"Allowance" terms expose you to unlimited cost overages.' },
          { title: "Elevated Deposit", text: "40% deposit exceeds recommended 30% threshold." },
        ],
      },
      verified: {
        border: "border-emerald-500/50",
        glow: "shadow-[0_0_50px_rgba(16,185,129,0.4)]",
        overlay: "from-emerald-500/10",
        iconColor: "text-emerald-500",
        headline: "PROCEED WITH CONFIDENCE",
        headlineColor: "text-emerald-500",
        riskCards: [
          { title: "Brand Verified", text: "PGT Winguard with active NOA confirmation." },
          { title: "Code Compliant", text: "DP-70 exceeds all coastal zone requirements." },
          { title: "Fair Pricing", text: "Within 4% of regional fair market average." },
        ],
      },
    };

    const theme = themeMap[alertLevel];

    return (
      <div
        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
        style={{ perspective: "1000px" }}
      >
        <div
          ref={ref}
          tabIndex={-1}
          aria-live="polite"
          className={`relative pointer-events-auto bg-slate-900/60 backdrop-blur-xl border-2 ${theme.border} p-4 md:p-8 rounded-xl ${theme.glow} w-[85%] max-w-md max-h-[85vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-700 delay-300 flex flex-col items-center text-center ring-1 ring-white/20 outline-none`}
          data-testid="orange-scanner-verdict-cta"
        >
          <div
            className={`absolute inset-0 bg-gradient-to-t ${theme.overlay} to-transparent pointer-events-none animate-pulse rounded-xl`}
          />

          <h2 className="text-xl md:text-3xl font-black text-white tracking-tighter mb-2 italic">
            VERDICT: <span className={theme.headlineColor}>{theme.headline}</span>
          </h2>

          <p className="text-slate-300 text-xs md:text-sm mb-4 md:mb-8 max-w-md">{summaryText}</p>

          <div className="w-full space-y-2 md:space-y-3 mb-4 md:mb-8">
            {theme.riskCards.map((card, i) => (
              <div
                key={i}
                className={`${alertLevel === "verified" ? "bg-emerald-500/10 border-emerald-500/20" : alertLevel === "caution" ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"} border p-3 rounded flex items-center gap-3 text-left`}
              >
                {alertLevel === "verified" ? (
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert size={20} className={`${theme.iconColor} shrink-0`} />
                )}
                <div>
                  <div
                    className={`text-[10px] uppercase font-bold tracking-wider ${alertLevel === "verified" ? "text-emerald-400" : alertLevel === "caution" ? "text-amber-400" : "text-red-400"}`}
                  >
                    {card.title}
                  </div>
                  <div className="text-xs text-white">{card.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Decision Gate */}
          <div className="w-full mt-4 md:mt-8">
            <p className="text-slate-300 text-sm mb-4 text-center">This was a demo estimate. Choose your next step.</p>
            <div className="flex flex-col md:flex-row gap-4 w-full">
              <button
                onClick={onScanClick}
                aria-label="I have a quote"
                data-testid="orange-scanner-have-quote"
                className="w-full md:flex-1 h-11 md:h-14 rounded-xl border backdrop-blur-md px-6 font-black text-sm md:text-base tracking-wide transition-all duration-300 active:scale-[0.98] bg-cyan-500 text-slate-950 border-cyan-300/40 hover:bg-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
              >
                I Have a Quote
              </button>
              <button
                onClick={onDemoClick}
                aria-label="I want a quote"
                data-testid="orange-scanner-want-quote"
                className="w-full md:flex-1 h-11 md:h-14 rounded-xl border backdrop-blur-md px-6 font-black text-sm md:text-base tracking-wide transition-all duration-300 active:scale-[0.98] bg-white/10 text-white border-white/20 hover:bg-white/15 shadow-[0_0_24px_rgba(255,255,255,0.08)]"
              >
                I Want a Quote
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  },
);
VerdictHologram.displayName = "VerdictHologram";

// ═══════════════════════════════════════════════════════════════
// SCAN CTA
// ═══════════════════════════════════════════════════════════════

const ScanCTA = () => {
  return (
    <div className="max-w-6xl mx-auto mt-20 mb-12 group w-full relative z-10">
      <div className="relative bg-slate-900/50 border border-cyan-500/30 rounded-2xl p-1 overflow-hidden transition-all duration-500 hover:border-cyan-400 hover:shadow-[0_0_50px_rgba(34,211,238,0.15)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.1),transparent)]" />
        <div className="relative bg-slate-950 rounded-xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Consumer Protection Active
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-tight">
              Don't Get Ripped Off By <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase">
                Contractor Jargon.
              </span>
            </h2>
            <p className="text-slate-300 max-w-md mx-auto md:mx-0 text-sm md:text-base font-medium leading-relaxed">
              Our AI Exposes Hidden Surcharges, Substandard Hurricane Ratings, and Predatory Deposit Traps in Seconds.
            </p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center">
            <button
              onClick={() => {
                document.getElementById("truth-gate-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="relative px-8 py-5 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xl rounded-xl transition-all duration-300 transform group-hover:scale-105 shadow-[0_0_30px_rgba(8,145,178,0.4)] flex items-center gap-4 overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="relative uppercase tracking-tight flex flex-col items-center md:items-start text-center md:text-left">
                Scan Your Estimate
                <span className="opacity-60 block text-xs tracking-widest mt-1">Get the Truth</span>
              </span>
              <ArrowRight
                className="relative group-hover:translate-x-2 transition-transform hidden sm:block"
                size={24}
              />
            </button>
            <div className="mt-4 flex items-center justify-center gap-6 opacity-40">
              <div className="text-[10px] uppercase font-bold flex items-center gap-1 text-slate-50">
                <ShieldCheck size={12} /> SECURE OTP
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-50 flex items-center gap-1">
                <Zap size={12} /> INSTANT SCAN
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SAFE CALLBACK WRAPPERS
// ═══════════════════════════════════════════════════════════════

let warnedScanMissing = false;
let warnedDemoMissing = false;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function OrangeScanner({
  onScanClick,
  onDemoClick,
}: { onScanClick?: () => void; onDemoClick?: () => void } = {}) {
  const navigate = useNavigate();

  // --- State ---
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeAnomalies, setActiveAnomalies] = useState<Array<string | number>>([]);
  const [isComplete, setIsComplete] = useState(false);
  const verdictRef = useRef<HTMLDivElement | null>(null);
  const hasRunOnce = useRef(false);

  // --- Derived scenario with fallbacks ---
  const currentScenario = quoteScenarios.length > 0 ? quoteScenarios[scenarioIndex % quoteScenarios.length] : null;
  const safeScenario = {
    ...currentScenario,
    lineItems: Array.isArray(currentScenario?.lineItems) ? currentScenario.lineItems : [],
    integrityScore: typeof currentScenario?.integrityScore === "number" ? currentScenario.integrityScore : 50,
    specs: {
      stc: currentScenario?.specs?.stc ?? "NOT SPECIFIED",
      uFactor: currentScenario?.specs?.uFactor ?? "NOT SPECIFIED",
      shgc: currentScenario?.specs?.shgc ?? "NOT SPECIFIED",
      frame: currentScenario?.specs?.frame ?? "NOT SPECIFIED",
    },
  };

  // --- Reset helper ---
  const resetScannerState = (nextIsScanning: boolean) => {
    setScanProgress(0);
    setActiveAnomalies([]);
    setIsComplete(false);
    setIsScanning(nextIsScanning);
  };

  // --- Safe callback wrappers ---
  const safeInvokeScanClick = () => {
    console.info("demo_cta_clicked", { scenarioId: safeScenario.id, button: "have_quote" });
    if (typeof onScanClick === "function") {
      onScanClick();
      return;
    }
    if (!warnedScanMissing) {
      console.warn("OrangeScanner: onScanClick callback is undefined.");
      warnedScanMissing = true;
    }
  };

  const safeInvokeDemoClick = () => {
    console.info("demo_cta_clicked", {
      scenarioId: safeScenario.id,
      button: "want_quote",
    });
    navigate("/about?startArb=1&step=scope&src=orange-scanner");
  };

  // --- Start scan (no timer engine here) ---
  const startScan = () => {
    if (isScanning) return;

    // Advance scenario on re-runs
    if (hasRunOnce.current) {
      setScenarioIndex((prev) => (prev + 1) % quoteScenarios.length);
    }
    hasRunOnce.current = true;

    resetScannerState(true);
    console.info("demo_run_started", {
      scenarioId:
        quoteScenarios[
          (hasRunOnce.current && scenarioIndex + 1 < quoteScenarios.length
            ? scenarioIndex + 1
            : hasRunOnce.current
              ? 0
              : scenarioIndex) % quoteScenarios.length
        ].id,
    });
  };

  // --- useEffect scan engine ---
  useEffect(() => {
    if (!isScanning || isComplete) return;

    if (scanProgress >= 100) {
      setScanProgress(100);
      setIsScanning(false);
      setIsComplete(true);
      console.info("demo_scan_completed", {
        scenarioId: safeScenario.id,
        integrityScore: safeScenario.integrityScore,
      });
      // Focus verdict
      setTimeout(() => verdictRef.current?.focus(), 100);
      return;
    }

    const timeout = setTimeout(() => {
      setScanProgress((prev) => Math.min(prev + SCAN_STEP, 100));

      // Deterministic anomaly triggers
      const itemCount = safeScenario.lineItems.length;
      const stepSize = ITEM_RANGE / Math.max(itemCount, 1);

      // License trigger
      if (scanProgress >= LICENSE_TRIGGER && safeScenario.licenseAnomaly) {
        setActiveAnomalies((prev) => (prev.includes("license") ? prev : [...prev, "license"]));
      }

      // Line item triggers
      safeScenario.lineItems.forEach((item, index) => {
        const triggerPoint = ITEM_START + stepSize * (index + 1);
        if (scanProgress >= triggerPoint && (item.status === "critical" || item.status === "caution")) {
          setActiveAnomalies((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
        }
      });

      // Fine print trigger
      if (scanProgress >= FINEPRINT_TRIGGER && safeScenario.finePrintTrap) {
        setActiveAnomalies((prev) => (prev.includes("fineprint_trap") ? prev : [...prev, "fineprint_trap"]));
      }
    }, SCAN_DELAY);

    return () => clearTimeout(timeout);
  }, [isScanning, scanProgress, isComplete]);

  // --- Fallback for empty scenarios (after all hooks) ---
  if (!currentScenario) {
    return (
      <div className="min-h-[400px] bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Demo scenarios unavailable.
      </div>
    );
  }

  const activePhase = scanProgress === 0 ? -1 : scanProgress < 33 ? 0 : scanProgress < 66 ? 1 : 2;

  // --- Alert level styling helpers ---
  const alertColorMap = {
    critical: {
      bg: "bg-red-50/80",
      border: "border-red-500",
      text: "text-red-900",
      flagBg: "bg-red-500/5",
      flagBorder: "border-red-500",
      flagTitle: "text-red-400",
      flagIcon: "text-red-500",
      itemBg: "bg-red-500/10",
      itemBorder: "border-red-500",
    },
    caution: {
      bg: "bg-amber-50/80",
      border: "border-amber-500",
      text: "text-amber-900",
      flagBg: "bg-orange-500/5",
      flagBorder: "border-orange-500",
      flagTitle: "text-orange-400",
      flagIcon: "text-orange-500",
      itemBg: "bg-orange-500/10",
      itemBorder: "border-orange-500",
    },
    verified: {
      bg: "bg-emerald-50/80",
      border: "border-emerald-500",
      text: "text-emerald-900",
      flagBg: "bg-emerald-500/5",
      flagBorder: "border-emerald-500",
      flagTitle: "text-emerald-400",
      flagIcon: "text-emerald-500",
      itemBg: "bg-emerald-500/10",
      itemBorder: "border-emerald-500",
    },
  };

  const statusColorMap: Record<LineItemStatus, { bg: string; border: string; label: string; labelColor: string }> = {
    critical: { bg: "bg-red-500/10", border: "border-red-500", label: "AUDIT FLAG:", labelColor: "text-red-400" },
    caution: {
      bg: "bg-orange-500/10",
      border: "border-orange-500",
      label: "AUDIT FLAG:",
      labelColor: "text-orange-400",
    },
    verified: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500",
      label: "VERIFIED:",
      labelColor: "text-emerald-400",
    },
    neutral: { bg: "", border: "", label: "", labelColor: "" },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-start p-4 md:p-8 overflow-hidden font-sans relative selection:bg-cyan-500/30">
      {/* Background ambient lighting */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-900/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl w-full flex flex-col gap-8 relative z-10">
        {/* Holographic HUD */}
        <div className="w-full relative mx-auto max-w-4xl" style={{ perspective: "1000px" }}>
          <div
            className="border border-cyan-500/40 bg-cyan-950/40 backdrop-blur-md rounded-xl p-4 md:p-6 shadow-[0_0_30px_rgba(6,182,212,0.15)] flex items-center justify-between relative overflow-hidden"
            style={{ transform: "rotateX(5deg) translateZ(10px)" }}
          >
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(cyan 1px, transparent 1px), linear-gradient(90deg, cyan 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            ></div>

            <div className="flex items-center gap-2 md:gap-6 relative z-10 w-full justify-between">
              {[
                { label: "DATA EXTRACTION", icon: <FileText size={18} /> },
                { label: "CONTEXTUAL INJECTION", icon: <Cpu size={18} /> },
                { label: "COMPLIANCE DETECTION", icon: <BrainCircuit size={18} /> },
              ].map((phase, idx) => {
                const isActive = activePhase === idx;
                const isPast = activePhase > idx || scanProgress === 100;

                return (
                  <React.Fragment key={phase.label}>
                    <div
                      className={`flex flex-col items-center gap-1 md:gap-2 transition-all duration-500 ${
                        isActive
                          ? "text-cyan-300 scale-105 font-black drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                          : isPast
                            ? "text-cyan-400 font-bold"
                            : "font-medium text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 tracking-widest text-[10px] md:text-sm uppercase text-center">
                        <span className="hidden md:block">{phase.icon}</span>
                        {phase.label}
                      </div>
                      <div
                        className={`h-4 overflow-hidden text-[8px] md:text-[10px] font-mono hidden sm:block ${
                          isActive ? "text-cyan-100" : "text-slate-500"
                        }`}
                      >
                        {isActive && isScanning ? (
                          <div className="animate-pulse">
                            10101001 1101
                            <br />
                            00111010 0110
                          </div>
                        ) : (
                          "00000000 0000"
                        )}
                      </div>
                    </div>
                    {idx < 2 && (
                      <ChevronRight
                        className={`hidden sm:block transition-colors duration-500 ${isPast ? "text-cyan-400" : "text-slate-500"}`}
                        size={20}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* MOBILE/TABLET TOP CTA */}
          <div className="lg:hidden w-full mb-2 z-20 relative">
            <button
              onClick={startScan}
              disabled={isScanning}
              className={`w-full flex items-center justify-center gap-2 px-6 py-5 rounded-lg font-bold text-sm tracking-widest uppercase transition-all duration-300 ${
                isScanning
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 shadow-inner"
                  : "bg-cyan-500 text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isScanning ? (
                <>
                  <Scan className="animate-spin" size={18} /> Analyzing Contract...
                </>
              ) : isComplete ? (
                <>
                  <Zap size={18} /> Re-run AI Audit
                </>
              ) : (
                <>
                  <Search size={18} /> Run Demo Audit
                </>
              )}
            </button>
          </div>

          {/* LEFT: Interactive Document Area (Scanner Bed) */}
          <div className="lg:col-span-8 relative" style={{ perspective: "1200px" }}>
            <div
              className="w-full transition-all duration-1000 ease-in-out origin-center"
              style={{
                transform: isComplete
                  ? "rotateX(20deg) scale(0.9) translateY(-2rem)"
                  : isScanning
                    ? "scale(1.01)"
                    : "scale(1)",
                opacity: isComplete ? 0.35 : 1,
                filter: isComplete ? "blur(2px)" : "none",
              }}
            >
              <div
                className="relative w-full bg-slate-950 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden min-h-[600px] font-sans border-2 border-slate-800"
                style={{
                  boxShadow: isScanning
                    ? "0 25px 50px -12px rgba(249, 115, 22, 0.15)"
                    : "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                }}
              >
                {/* The Laser Scanner Line */}
                {scanProgress > 0 && scanProgress < 100 && (
                  <div
                    className="absolute left-0 right-0 z-50 pointer-events-none"
                    style={{
                      top: `${scanProgress}%`,
                      transform: "translateY(-50%) rotate(-0.5deg)",
                    }}
                  >
                    <div className="h-1 w-full bg-white shadow-[0_0_10px_2px_#fff]"></div>
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-16 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent blur-[8px]"></div>
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-32 bg-gradient-to-r from-transparent via-red-500/20 to-transparent blur-[16px]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-2 bg-yellow-300 shadow-[0_0_30px_10px_rgba(250,204,21,0.8)] rounded-full blur-[2px]"></div>
                  </div>
                )}

                {/* SVG Filter for Paper Grain */}
                <svg className="hidden">
                  <filter id="paperGrain">
                    <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 -1 1" />
                  </filter>
                </svg>

                {/* Physical Paper Sheet */}
                <div
                  className="relative bg-[#f9f7f2] text-slate-800 w-full h-full min-h-[750px] origin-center font-sans shadow-xl"
                  style={{ transform: "rotate(0.3deg) scale(0.98)", top: "10px" }}
                >
                  {/* Layer 1: Grain */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-[0.06] contrast-150 mix-blend-multiply"
                    style={{ filter: "url(#paperGrain)" }}
                  ></div>
                  {/* Layer 2: Coffee Ring */}
                  <div className="absolute top-10 right-10 opacity-[0.15] pointer-events-none rotate-[25deg] scale-150">
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" stroke="#634832" strokeWidth="2">
                      <circle cx="50" cy="50" r="45" strokeDasharray="10 5 20 2" />
                      <circle cx="50" cy="50" r="42" opacity="0.5" />
                    </svg>
                  </div>
                  {/* Layer 3: Fold Line */}
                  <div className="absolute top-[55%] left-0 w-full h-[2px] pointer-events-none z-10">
                    <div className="h-[1px] bg-black/10 w-full"></div>
                    <div className="h-[1px] bg-white/50 w-full"></div>
                  </div>
                  {/* Layer 4: Blue "Received" Stamp */}
                  <div className="absolute bottom-20 left-8 -rotate-12 border-[3px] border-blue-700/50 p-2 px-4 rounded-sm pointer-events-none mix-blend-multiply opacity-80 z-10">
                    <div className="text-blue-700/60 font-black text-2xl tracking-tighter uppercase leading-none font-mono">
                      RECV OCT 2026
                      <br />
                      <span className="text-xs tracking-normal font-sans">Compliance Dept</span>
                    </div>
                  </div>

                  {/* Content Container */}
                  <div className="relative z-10">
                    {/* Document Header */}
                    <div className="p-8 md:p-10 pb-6 border-b-2 border-slate-300 relative">
                      <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight mb-4 uppercase italic">
                        Window Estimate
                      </h1>

                      <div className="flex flex-col sm:flex-row justify-between text-slate-600 text-sm font-medium gap-4">
                        <div className="space-y-1">
                          <p>
                            <span className="text-slate-400 uppercase text-xs">Client:</span> {safeScenario.client}
                          </p>
                          <p>
                            <span className="text-slate-400 uppercase text-xs">Contractor:</span>{" "}
                            {safeScenario.contractor}
                          </p>
                          <div className="relative inline-block">
                            <span className="text-slate-400 uppercase text-xs">License:</span>
                            <span
                              className={`ml-1 px-1 rounded transition-colors duration-500 ${activeAnomalies.includes("license") ? "bg-red-200 text-red-800 font-bold" : ""}`}
                            >
                              {safeScenario.license}
                            </span>
                            {activeAnomalies.includes("license") && (
                              <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-red-500 rounded p-2 text-red-400 text-xs shadow-lg z-20 animate-in fade-in slide-in-from-top-2">
                                <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />
                                Format Anomaly: Regional licenses strictly numeric.
                              </div>
                            )}
                          </div>
                          <p>
                            <span className="text-slate-400 uppercase text-xs">Specified Brand:</span>{" "}
                            {safeScenario.specifiedBrand}
                          </p>
                          <p>
                            <span className="text-slate-400 uppercase text-xs">NOA Code:</span> {safeScenario.noaCode}
                          </p>
                        </div>
                        <div className="sm:text-right space-y-1">
                          <p>
                            <span className="text-slate-400 uppercase text-xs">Date:</span> {safeScenario.date}
                          </p>
                          <p>
                            <span className="text-slate-400 uppercase text-xs">Quote Ref:</span> {safeScenario.quoteRef}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Executive Summary Alert Box */}
                    {(isScanning || isComplete) && (
                      <div
                        className={`mx-8 md:mx-10 mt-4 p-4 rounded-lg border-l-4 ${alertColorMap[safeScenario.alertLevel].border} ${alertColorMap[safeScenario.alertLevel].bg}`}
                      >
                        <h3 className={`font-bold text-sm mb-1 ${alertColorMap[safeScenario.alertLevel].text}`}>
                          {safeScenario.summaryTitle}
                        </h3>
                        <p className={`text-xs ${alertColorMap[safeScenario.alertLevel].text} opacity-90`}>
                          {safeScenario.summaryText}
                        </p>
                      </div>
                    )}

                    {/* Document Table */}
                    <div className="p-8 md:p-10 pt-4 relative">
                      <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                        <div className="col-span-8 md:col-span-9">Description of Services</div>
                        <div className="col-span-4 md:col-span-3 text-right">Cost</div>
                      </div>

                      <div className="flex flex-col gap-1 relative">
                        {safeScenario.lineItems.map((item) => {
                          const isRevealedAnomaly = activeAnomalies.includes(item.id);
                          const colors = statusColorMap[item.status];
                          const isAnomalyStatus = item.status === "critical" || item.status === "caution";

                          return (
                            <div key={`${safeScenario.id}-${item.id}`}>
                              <div className="relative grid grid-cols-12 gap-4 py-4 border-b border-slate-200/50 text-slate-700 items-center transition-colors hover:bg-slate-100/50">
                                <div className="col-span-8 md:col-span-9 font-medium text-sm md:text-base leading-snug">
                                  {item.label}
                                </div>
                                <div className="col-span-4 md:col-span-3 text-right font-mono font-semibold">
                                  {item.cost}
                                </div>

                                {/* Anomaly highlight background */}
                                {isAnomalyStatus && (
                                  <div
                                    className={`absolute inset-0 pointer-events-none transition-all duration-500 ${isRevealedAnomaly ? `${colors.bg} border-l-4 ${colors.border}` : "bg-transparent border-l-4 border-transparent"}`}
                                  >
                                    <div
                                      className={`absolute left-4 md:left-auto md:-right-8 top-full md:top-1/2 mt-2 md:mt-0 md:-translate-y-1/2 transition-all duration-700 ease-out transform z-30 ${isRevealedAnomaly ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0 hidden md:block"}`}
                                    >
                                      <div className="relative">
                                        <div
                                          className={`bg-slate-950 border ${colors.border} backdrop-blur-xl rounded px-3 py-2 flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] w-max max-w-[200px] md:max-w-xs`}
                                        >
                                          <AlertTriangle
                                            className={`${colors.labelColor} animate-pulse shrink-0`}
                                            size={16}
                                          />
                                          <div className="flex flex-col">
                                            <span
                                              className={`${colors.labelColor} font-bold text-[10px] tracking-wider uppercase`}
                                            >
                                              {colors.label}
                                            </span>
                                            <span className="text-slate-300 text-[10px] leading-tight">
                                              {item.note}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Verified item inline flag */}
                                {item.status === "verified" && isRevealedAnomaly && item.note && (
                                  <div className="absolute inset-0 pointer-events-none bg-emerald-500/5 border-l-4 border-emerald-500 transition-all duration-500">
                                    <div className="absolute left-4 md:left-auto md:-right-8 top-full md:top-1/2 mt-2 md:mt-0 md:-translate-y-1/2 z-30 translate-x-0 opacity-100">
                                      <div className="relative">
                                        <div className="bg-slate-950 border border-emerald-500 backdrop-blur-xl rounded px-3 py-2 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)] w-max max-w-[200px] md:max-w-xs">
                                          <CheckCircle2 className="text-emerald-400 shrink-0" size={16} />
                                          <div className="flex flex-col">
                                            <span className="text-emerald-400 font-bold text-[10px] tracking-wider uppercase">
                                              VERIFIED:
                                            </span>
                                            <span className="text-slate-300 text-[10px] leading-tight">
                                              {item.note}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Totals */}
                      <div className="mt-8 flex justify-end">
                        <div className="w-full md:w-1/2">
                          <div className="flex justify-between py-2 text-slate-500 text-sm border-b border-slate-200">
                            <span>Subtotal</span>
                            <span className="font-mono">{safeScenario.subtotal}</span>
                          </div>
                          <div className="flex justify-between py-4 text-slate-800 font-black text-xl border-t-4 border-slate-900 mt-1">
                            <span>TOTAL ESTIMATE</span>
                            <span className="font-mono">{safeScenario.total}</span>
                          </div>
                        </div>
                      </div>

                      {/* Fine Print Scanner — only for predatory */}
                      {safeScenario.finePrintTrap && (
                        <FinePrintScanner scanProgress={scanProgress} isScanning={isScanning} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Post-scan overlay */}
                {isComplete && (
                  <div className="absolute inset-0 bg-cyan-900/5 pointer-events-none transition-opacity duration-1000 border-[3px] border-cyan-500/20 z-40"></div>
                )}
              </div>
            </div>

            {/* The Hologram Finale */}
            <VerdictHologram
              ref={verdictRef}
              isOpen={isComplete}
              alertLevel={safeScenario.alertLevel}
              summaryTitle={safeScenario.summaryTitle}
              summaryText={safeScenario.summaryText}
              integrityScore={safeScenario.integrityScore}
              activeAnomalies={activeAnomalies}
              onScanClick={safeInvokeScanClick}
              onDemoClick={safeInvokeDemoClick}
            />
          </div>

          {/* RIGHT: Sidebar Controls & Diagnostics */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <button
              onClick={startScan}
              disabled={isScanning}
              className={`w-full flex items-center justify-center gap-2 px-6 py-5 rounded-lg font-bold text-sm tracking-widest uppercase transition-all duration-300 ${
                isScanning
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 shadow-inner"
                  : "bg-cyan-500 text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isScanning ? (
                <>
                  <Scan className="animate-spin" size={18} /> Analyzing Contract...
                </>
              ) : isComplete ? (
                <>
                  <Zap size={18} /> Re-run AI Audit
                </>
              ) : (
                <>
                  <Search size={18} /> Run Demo Audit
                </>
              )}
            </button>

            {/* Trust Score Widget */}
            <TrustScoreWidget
              isScanning={isScanning}
              integrityScore={safeScenario.integrityScore}
              alertLevel={safeScenario.alertLevel}
            />

            {/* Audit Log Panel */}
            <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5 flex flex-col min-h-[250px] flex-1 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200 flex items-center gap-2">
                  <Shield size={16} className={isScanning ? "text-cyan-400 animate-pulse" : "text-cyan-600"} />
                  Live Audit Log
                </h3>
                <span className="text-[10px] font-mono bg-slate-800 px-2 py-1 rounded text-cyan-400">
                  {activeAnomalies.length} FLAGS
                </span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {!isScanning && activeAnomalies.length === 0 && scanProgress === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs italic space-y-2 py-4">
                    <Search size={32} />
                    <p>Awaiting scan initialization...</p>
                  </div>
                )}

                {/* License mismatch — gated by scenario */}
                {activeAnomalies.includes("license") && safeScenario.licenseAnomaly && (
                  <div className="border-l-2 border-red-500 pl-3 py-1 bg-red-500/5 rounded-r p-2 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> License Mismatch
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed font-mono">
                      Format contains alphabetical characters. Local registry requires numeric-only identifiers. Risk:
                      Unlicensed Contractor.
                    </div>
                  </div>
                )}

                {/* Fine print — gated by scenario */}
                {activeAnomalies.includes("fineprint_trap") && safeScenario.finePrintTrap && (
                  <div className="border-l-2 border-red-500 pl-3 py-1 bg-red-500/5 rounded-r p-2 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <ShieldAlert size={12} /> Predatory Clause Detected
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed font-mono">
                      Hidden liability shift found in Fine Print. Contractor disclaims structural rot responsibility and
                      claims arbitrary 15% material surcharges.
                    </div>
                  </div>
                )}

                {/* Line item findings — scenario-driven */}
                {safeScenario.lineItems.map((item) => {
                  if (!activeAnomalies.includes(item.id) || !item.note) return null;
                  const isAnomaly = item.status === "critical" || item.status === "caution";
                  const isVerified = item.status === "verified";
                  if (!isAnomaly && !isVerified) return null;

                  return (
                    <div
                      key={`log-${safeScenario.id}-${item.id}`}
                      className={`border-l-2 ${isAnomaly ? (item.status === "critical" ? "border-red-500 bg-red-500/5" : "border-orange-500 bg-orange-500/5") : "border-emerald-500 bg-emerald-500/5"} pl-3 py-1 rounded-r p-2 animate-in slide-in-from-right-4 duration-300`}
                    >
                      <div
                        className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${isAnomaly ? (item.status === "critical" ? "text-red-400" : "text-orange-400") : "text-emerald-400"}`}
                      >
                        {isAnomaly ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                        {isAnomaly ? `Item Variance: #${item.id}` : `Verified: #${item.id}`}
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed font-mono">{item.note}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metadata Footer Box */}
            <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
              <h4 className="text-[10px] uppercase tracking-widest text-slate-200 mb-3 font-bold">
                Extracted Metadata Specs
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-slate-300">
                <div className="flex justify-between border-b border-cyan-900/30 pb-1">
                  <span>STC RATING:</span> <span className="text-white">{safeScenario.specs.stc}</span>
                </div>
                <div className="flex justify-between border-b border-cyan-900/30 pb-1">
                  <span>U-FACTOR:</span> <span className="text-white">{safeScenario.specs.uFactor}</span>
                </div>
                <div className="flex justify-between border-b border-cyan-900/30 pb-1">
                  <span>SHGC:</span> <span className="text-white">{safeScenario.specs.shgc}</span>
                </div>
                <div className="flex justify-between border-b border-cyan-900/30 pb-1">
                  <span>FRAME:</span> <span className="text-white">{safeScenario.specs.frame}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* THE TRUTH REPORT CTA */}
        <ScanCTA />
      </div>

      {/* Global CSS for custom animations/scrollbars */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.6);
        }
      `,
        }}
      />
    </div>
  );
}
