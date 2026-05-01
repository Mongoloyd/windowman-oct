/**
 * Dev-only floating panel to switch between report preview states.
 * Only rendered when IS_DEV_MODE is true. Tree-shaken in production.
 */

import { useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, ChevronUp, ChevronDown, BarChart3, FlaskConical, Beaker } from "lucide-react";
import { DEV_PREVIEW_CONFIGS, type DevPreviewState } from "./fixtures";
import { RubricComparison } from "@/components/dev/RubricComparison";

const DevQuoteGenerator = lazy(() => import("@/components/dev/DevQuoteGenerator").then(m => ({ default: m.DevQuoteGenerator })));
const ScannerLab = lazy(() => import("@/components/dev/scanner-lab/ScannerLab").then(m => ({ default: m.ScannerLab })));

interface DevPreviewPanelProps {
  currentState: DevPreviewState;
  onChange: (state: DevPreviewState) => void;
  sessionId?: string | null;
  onScanStart?: (fileName: string, scanSessionId: string) => void;
}

const STATES = Object.entries(DEV_PREVIEW_CONFIGS) as [DevPreviewState, typeof DEV_PREVIEW_CONFIGS[DevPreviewState]][];

export default function DevPreviewPanel({ currentState, onChange, sessionId, onScanStart }: DevPreviewPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRubricStats, setShowRubricStats] = useState(false);
  const [showQuoteGen, setShowQuoteGen] = useState(false);
  const [showScannerLab, setShowScannerLab] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[9999]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              background: "#0F1F35",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "12px 0",
              marginBottom: 8,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              width: 240,
            }}
          >
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              color: "#C8952A",
              letterSpacing: "0.12em",
              fontWeight: 700,
              padding: "0 14px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              DEV PREVIEW STATE
            </p>
            {STATES.map(([key, config]) => {
              const isActive = currentState === key;
              return (
                <button
                  key={key}
                  onClick={() => { onChange(key); if (key !== "none") setIsOpen(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 14px",
                    background: isActive ? "rgba(200,149,42,0.15)" : "transparent",
                    border: "none",
                    borderLeft: isActive ? "3px solid #C8952A" : "3px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#C8952A" : "#E5E7EB", lineHeight: 1.3 }}>
                    {config.label}
                  </p>
                  <p style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.3 }}>
                    {config.description}
                  </p>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => setShowQuoteGen(!showQuoteGen)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: showQuoteGen ? "#C8952A" : "#0F1F35",
            color: "white",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
          title="OCR Bypass"
        >
          <FlaskConical size={14} />
        </button>
        <button
          onClick={() => setShowRubricStats(!showRubricStats)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: showRubricStats ? "#C8952A" : "#0F1F35",
            color: "white",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
          title="Rubric Stats"
        >
          <BarChart3 size={14} />
        </button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: currentState !== "none" ? "#C8952A" : "#0F1F35",
            color: "white",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            transition: "all 0.15s",
          }}
        >
          <Bug size={14} />
          {currentState !== "none" ? DEV_PREVIEW_CONFIGS[currentState].label : "DEV"}
          {isOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {/* Rubric Stats Panel */}
      <AnimatePresence>
        {showRubricStats && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", bottom: 60, left: 4, zIndex: 9998 }}
          >
            <RubricComparison />
          </motion.div>
        )}
      </AnimatePresence>

      {/* OCR Bypass Panel */}
      <AnimatePresence>
        {showQuoteGen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", bottom: 60, left: 4, zIndex: 9998, maxHeight: "70vh", overflowY: "auto" }}
          >
            <Suspense fallback={null}>
              <DevQuoteGenerator sessionId={sessionId} onScanStart={onScanStart} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
