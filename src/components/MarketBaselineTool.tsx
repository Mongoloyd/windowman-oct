/**
 * MarketBaselineTool.tsx — Flow B Interactive Baseline Builder
 */

import { useState, useEffect } from 'react';
import { useFunnelStore } from '../store/useFunnelStore';
import { FLORIDA_COUNTIES, IMPACT_WINDOW_BRANDS, type CountyMarketData, type BrandData } from '../store/countyData';
import { usePhoneInput } from '@/hooks/usePhoneInput';
import { isValidEmail, isValidName } from '@/utils/formatPhone';
import { supabase } from '@/integrations/supabase/client';
import { getLeadId } from '@/lib/useLeadId';
import { getUtmPayload } from '@/lib/useUtmCapture';
import { Lock } from 'lucide-react';

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface BaselineConfig {
  county:        string;
  brand:         string;
  windowCount:   number;
  installMethod: 'fin' | 'full-frame';
  projectType:   string;
}

interface BaselineResult {
  fairFloor:     number;
  fairCeiling:   number;
  fairMid:       number;
  perWindow:     number;
  brandPremium:  number;
  installAdder:  number;
  warningFlag:   string | null;
  countyData:    CountyMarketData | null;
  brandData:     BrandData | null;
  savedAt:       string;
}

// ── PRICING LOGIC ──────────────────────────────────────────────────────────────

const INSTALL_METHOD_MULTIPLIER = { fin: 1.0, 'full-frame': 1.12 };

function calculateBaseline(config: BaselineConfig): BaselineResult {
  const countyData = FLORIDA_COUNTIES.find(c => c.county === config.county) ?? null;
  const brandData  = IMPACT_WINDOW_BRANDS.find(b => b.name === config.brand) ?? null;

  const basePerWindow = countyData?.avgPerWindow ?? 1100;
  const brandAdj      = brandData ? (brandData.avgPerWindow / 1100) : 1;
  const installMult   = INSTALL_METHOD_MULTIPLIER[config.installMethod];

  const adjustedPerWindow = Math.round(basePerWindow * brandAdj * installMult);
  const p25PerWindow      = Math.round((countyData?.p25 ?? 860)  * brandAdj * installMult);
  const p75PerWindow      = Math.round((countyData?.p75 ?? 1440) * brandAdj * installMult);

  const n = config.windowCount;

  return {
    fairFloor:    p25PerWindow * n,
    fairCeiling:  p75PerWindow * n,
    fairMid:      adjustedPerWindow * n,
    perWindow:    adjustedPerWindow,
    brandPremium: brandData ? Math.round((brandData.avgPerWindow - 640) * n) : 0,
    installAdder: config.installMethod === 'full-frame'
      ? Math.round(basePerWindow * 0.12 * n) : 0,
    warningFlag: brandData?.tier === 'economy'
      ? 'Generic brand selected — contractor can substitute any quality level after signing. Ask for a specific brand name.'
      : !brandData
      ? 'No brand selected yet — specify a brand before signing any contract.'
      : null,
    countyData,
    brandData,
    savedAt: new Date().toISOString(),
  };
}

// ── SAVED BASELINE ALERT ────────────────────────────────────────────────────

function SavedBaselineAlert({ savedAt }: { savedAt: string }) {
  return (
    <div className="flex items-center gap-2 p-2 px-3 mb-3 border border-emerald-200 bg-emerald-50" style={{ borderLeft: '2px solid hsl(var(--color-emerald))' }}>
      <span className="text-emerald-600" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.1em' }}>
        ✓ BASELINE SAVED — Returns when you visit again
      </span>
      <span className="text-muted-foreground ml-auto" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9 }}>
        {new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

interface MarketBaselineToolProps {
  onLeadCaptured?: () => void;
}

export default function MarketBaselineTool({ onLeadCaptured }: MarketBaselineToolProps) {
  const { county: storeCounty, windowCount: storeWindowCount } = useFunnelStore();

  const savedBaseline = (() => {
    try { return JSON.parse(localStorage.getItem('wm_baseline_config') || 'null'); } catch { return null; }
  })();

  const [config, setConfig] = useState<BaselineConfig>({
    county:        savedBaseline?.county       ?? storeCounty ?? 'Broward',
    brand:         savedBaseline?.brand        ?? 'PGT WinGuard',
    windowCount:   savedBaseline?.windowCount  ?? (storeWindowCount ? parseInt(storeWindowCount) : 10),
    installMethod: savedBaseline?.installMethod ?? 'fin',
    projectType:   savedBaseline?.projectType  ?? 'Full home replacement',
  });

  const [result, setResult]         = useState<BaselineResult>(() => calculateBaseline(config));
  const [justSaved, setJustSaved]   = useState(false);
  const [activeTab, setActiveTab]   = useState<'build' | 'compare' | 'checklist'>('build');

  // ── LEAD CAPTURE GATE STATE ───────────────────────────────────────────────
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('wm_baseline_unlocked') === 'true');
  const [gateForm, setGateForm] = useState({ firstName: '', email: '' });
  const phone = usePhoneInput();
  const [tcpaConsent, setTcpaConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Fire onLeadCaptured for returning users who already unlocked
  useEffect(() => {
    if (unlocked) onLeadCaptured?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGateSubmit = async () => {
    setGateError(null);
    if (!isValidName(gateForm.firstName)) { setGateError('Please enter your first name.'); return; }
    if (!isValidEmail(gateForm.email)) { setGateError('Please enter a valid email.'); return; }
    if (!phone.isValid) { setGateError('Please enter a valid 10-digit phone number.'); return; }
    if (!tcpaConsent) { setGateError('Please agree to the terms to continue.'); return; }

    setSubmitting(true);
    try {
      const utmPayload = getUtmPayload();
      const { error } = await supabase.from('leads').insert({
        session_id: getLeadId(),
        first_name: gateForm.firstName.trim(),
        email: gateForm.email.trim().toLowerCase(),
        phone_e164: phone.e164!,
        county: config.county,
        window_count: config.windowCount,
        source: 'flow-b-baseline',
        status: 'new',
        ...utmPayload,
      });
      if (error) throw error;

      localStorage.setItem('wm_baseline_unlocked', 'true');
      setUnlocked(true);
      onLeadCaptured?.();
    } catch (err: any) {
      console.error('[GateSubmit] Error:', err);
      setGateError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const monoFont = "'JetBrains Mono',monospace";
  const bodyFont = "'DM Sans',sans-serif";
  const dispFont = "'Barlow Condensed',sans-serif";

  useEffect(() => {
    const newResult = calculateBaseline(config);
    setResult(newResult);
  }, [config]);

  const saveBaseline = () => {
    localStorage.setItem('wm_baseline_config',  JSON.stringify(config));
    localStorage.setItem('wm_baseline_result',  JSON.stringify(result));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const printBaseline = () => {
    const text = [
      `WINDOWMAN MARKET BASELINE — ${config.county.toUpperCase()} COUNTY`,
      `Generated: ${new Date().toLocaleDateString()}`,
      ``,
      `YOUR CONFIGURATION:`,
      `  County:         ${config.county}`,
      `  Window Brand:   ${config.brand}`,
      `  Window Count:   ${config.windowCount}`,
      `  Install Method: ${config.installMethod === 'full-frame' ? 'Full Frame Replacement' : 'Fin Installation'}`,
      `  Project Type:   ${config.projectType}`,
      ``,
      `YOUR FAIR-MARKET RANGE:`,
      `  Floor (P25):  $${result.fairFloor.toLocaleString()}`,
      `  Midpoint:     $${result.fairMid.toLocaleString()}`,
      `  Ceiling (P75): $${result.fairCeiling.toLocaleString()}`,
      `  Per Window:   $${result.perWindow.toLocaleString()}`,
      ``,
      `QUESTIONS TO ASK YOUR CONTRACTOR:`,
      `  1. What specific brand and NOA number are you installing?`,
      `  2. Is the permit listed as a separate line item with a dollar amount?`,
      `  3. What is the labor warranty period?`,
      `  4. What installation method are you using (fin or full frame)?`,
      ``,
      `Powered by WindowMan.app — AI-Powered Impact Window Quote Intelligence`,
    ].join('\n');

    const blob    = new Blob([text], { type: 'text/plain' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `windowman_baseline_${config.county.replace(' ','-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const update = (key: keyof BaselineConfig, value: string | number) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  return (
    <div id="market-baseline" className="bg-background text-foreground" style={{
      minHeight: '100vh',
      padding: '40px 20px', fontFamily: bodyFont,
    }}>
      {/* Header */}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="text-primary" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.16em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="bg-primary" style={{ width: 18, height: 1 }} />
          MARKET BASELINE TOOL — FLOW B
        </div>
        <div style={{ fontFamily: dispFont, fontWeight: 900, fontSize: 'clamp(26px,5vw,42px)', textTransform: 'uppercase', lineHeight: 1, marginBottom: 8 }}>
          BUILD YOUR FAIR-MARKET BASELINE
        </div>
        <div className="text-muted-foreground" style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 24, maxWidth: 540 }}>
          Configure your project below. The moment your contractor opens their briefcase, you'll already know the number they're hoping you don't.
        </div>

        {justSaved && <SavedBaselineAlert savedAt={result.savedAt} />}

        {/* Tabs */}
        <div className="border-b border-border" style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
          {(['build','compare','checklist'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontFamily: monoFont, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                color: activeTab === tab ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                borderBottom: activeTab === tab ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                transition: 'all 0.12s ease',
              }}
            >
              {tab === 'build' ? 'BUILD' : tab === 'compare' ? 'BRAND COMPARE' : 'CONTRACTOR CHECKLIST'}
            </button>
          ))}
        </div>

        {/* ── BUILD TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'build' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* LEFT: Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* County */}
              <div>
                <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', marginBottom: 6 }}>COUNTY</div>
                <select
                  value={config.county}
                  onChange={e => update('county', e.target.value)}
                  className="text-foreground bg-card border border-border outline-none"
                  style={{
                    fontFamily: bodyFont, fontSize: 13,
                    padding: '10px 12px', width: '100%', borderRadius: 0,
                  }}
                >
                  {FLORIDA_COUNTIES
                    .filter(c => c.avgScansMonth > 10)
                    .sort((a, b) => b.avgScansMonth - a.avgScansMonth)
                    .map(c => <option key={c.slug} value={c.county}>{c.county}</option>)
                  }
                </select>
              </div>

              {/* Brand */}
              <div>
                <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', marginBottom: 6 }}>WINDOW BRAND</div>
                {IMPACT_WINDOW_BRANDS.map(brand => (
                  <button
                    key={brand.name}
                    onClick={() => update('brand', brand.name)}
                    className={`w-full text-left border transition-all ${
                      config.brand === brand.name
                        ? 'bg-primary/5 border-primary text-primary'
                        : 'bg-card border-border text-foreground'
                    }`}
                    style={{
                      padding: '10px 12px',
                      fontFamily: bodyFont, fontSize: 13, cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 4, borderRadius: 0,
                    }}
                  >
                    <span style={{ fontWeight: config.brand === brand.name ? 600 : 400 }}>
                      {brand.name}
                    </span>
                    <span style={{
                      fontFamily: monoFont, fontSize: 9,
                      color: brand.tier === 'premium' ? 'hsl(var(--color-emerald))' :
                             brand.tier === 'mid'     ? 'hsl(var(--color-gold-accent))' : 'hsl(var(--color-vivid-orange))',
                      letterSpacing: '0.08em',
                    }}>
                      ${brand.avgPerWindow}/win · {brand.tier.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>

              {/* Window count slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em' }}>WINDOW COUNT</div>
                  <div className="text-foreground" style={{ fontFamily: dispFont, fontWeight: 800, fontSize: 20 }}>{config.windowCount}</div>
                </div>
                <input
                  type="range" min={1} max={40} step={1}
                  value={config.windowCount}
                  onChange={e => update('windowCount', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'hsl(var(--primary))' }}
                />
                <div className="text-muted-foreground" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: monoFont, fontSize: 9, marginTop: 2 }}>
                  <span>1</span><span>20</span><span>40</span>
                </div>
              </div>

              {/* Install method */}
              <div>
                <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', marginBottom: 6 }}>INSTALLATION METHOD</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(['fin', 'full-frame'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => update('installMethod', method)}
                      className={`border transition-all ${
                        config.installMethod === method
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-card border-border text-foreground'
                      }`}
                      style={{
                        padding: '10px', fontFamily: bodyFont, fontSize: 12, cursor: 'pointer', borderRadius: 0,
                        fontWeight: config.installMethod === method ? 600 : 400,
                      }}
                    >
                      <div>{method === 'fin' ? 'Fin Installation' : 'Full Frame'}</div>
                      <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, marginTop: 3 }}>
                        {method === 'fin' ? 'Standard · Lower cost' : '+12% · More thorough'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Live result (blur-gated) */}
            <div style={{ position: 'relative' }}>
              {/* Pricing card — blurred when locked */}
              <div style={!unlocked ? { filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' } : undefined}>
                <div className="glass-card-strong" style={{
                  borderTop: '2px solid hsl(var(--primary))', padding: 20, marginBottom: 12,
                }}>
                  <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', marginBottom: 16 }}>
                    YOUR FAIR-MARKET RANGE
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 10, marginBottom: 4 }}>FAIR FLOOR (25th pct)</div>
                    <div style={{ fontFamily: dispFont, fontWeight: 800, fontSize: 28, color: 'hsl(var(--color-emerald))' }}>
                      ${result.fairFloor.toLocaleString()}
                    </div>
                  </div>
                  <div className="border-b border-border my-3" />
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-primary" style={{ fontFamily: monoFont, fontSize: 10, marginBottom: 4 }}>YOUR FAIR MIDPOINT</div>
                    <div className="text-foreground" style={{ fontFamily: dispFont, fontWeight: 900, fontSize: 40 }}>
                      ${result.fairMid.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, marginTop: 2 }}>
                      ${result.perWindow.toLocaleString()}/window · {config.windowCount} windows
                    </div>
                  </div>
                  <div className="border-b border-border my-3" />
                  <div style={{ marginBottom: 16 }}>
                    <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 10, marginBottom: 4 }}>FAIR CEILING (75th pct)</div>
                    <div style={{ fontFamily: dispFont, fontWeight: 800, fontSize: 28, color: 'hsl(var(--color-gold-accent))' }}>
                      ${result.fairCeiling.toLocaleString()}
                    </div>
                  </div>

                  {result.installAdder > 0 && (
                    <div className="text-muted-foreground" style={{ fontSize: 12, marginBottom: 6 }}>
                      Full-frame install adds ~<span style={{ color: 'hsl(var(--color-gold-accent))' }}>${result.installAdder.toLocaleString()}</span>
                    </div>
                  )}

                  {result.warningFlag && (
                    <div style={{
                      background: 'hsl(var(--color-vivid-orange) / 0.06)', border: '1px solid hsl(var(--color-vivid-orange) / 0.2)',
                      borderLeft: '2px solid hsl(var(--color-vivid-orange))', padding: '10px 12px', marginTop: 12,
                    }}>
                      <div style={{ fontFamily: monoFont, fontSize: 9, color: 'hsl(var(--color-vivid-orange))', letterSpacing: '0.1em', marginBottom: 4 }}>▲ FLAG</div>
                      <div className="text-muted-foreground" style={{ fontSize: 12 }}>{result.warningFlag}</div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={saveBaseline}
                    className="btn-depth-primary flex-1"
                    style={{
                      fontFamily: bodyFont, fontWeight: 700, fontSize: 13,
                      padding: '11px', borderRadius: 2,
                      background: justSaved ? 'hsl(var(--color-emerald))' : undefined,
                    }}
                  >
                    {justSaved ? '✓ SAVED' : 'SAVE BASELINE'}
                  </button>
                  <button
                    onClick={printBaseline}
                    className="text-muted-foreground bg-transparent border border-border hover:bg-muted transition-colors"
                    style={{
                      fontFamily: bodyFont, fontWeight: 600, fontSize: 12,
                      padding: '11px 14px', borderRadius: 2, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⬇ DOWNLOAD
                  </button>
                </div>
                <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, marginTop: 8, textAlign: 'center', letterSpacing: '0.06em' }}>
                  Share this baseline with your contractor before they quote
                </div>
              </div>

              {/* ── LEAD CAPTURE GATE OVERLAY ─────────────────────────────── */}
              {!unlocked && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', zIndex: 10,
                  background: 'hsl(var(--background) / 0.6)', borderRadius: 'var(--radius-card)',
                }}>
                  <div className="card-raised-hero" style={{ padding: 24, maxWidth: 340, width: '100%' }}>
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <Lock size={28} style={{ color: 'hsl(var(--primary))', margin: '0 auto 8px' }} />
                      <div style={{ fontFamily: dispFont, fontWeight: 800, fontSize: 20, textTransform: 'uppercase', lineHeight: 1.15, marginBottom: 6 }}>
                        Your Baseline is Ready
                      </div>
                      <div className="text-muted-foreground" style={{ fontSize: 13, lineHeight: 1.5 }}>
                        Enter your details to unlock your personalized fair-market range.
                      </div>
                    </div>

                    {/* Form fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>FIRST NAME</label>
                        <input
                          type="text"
                          value={gateForm.firstName}
                          onChange={e => setGateForm(p => ({ ...p, firstName: e.target.value }))}
                          placeholder="Jane"
                          className="wm-input-well w-full text-foreground"
                          style={{ fontFamily: bodyFont, fontSize: 14, padding: '10px 12px' }}
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>EMAIL</label>
                        <input
                          type="email"
                          value={gateForm.email}
                          onChange={e => setGateForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="jane@example.com"
                          className="wm-input-well w-full text-foreground"
                          style={{ fontFamily: bodyFont, fontSize: 14, padding: '10px 12px' }}
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>MOBILE NUMBER</label>
                        <input
                          type="tel"
                          value={phone.displayValue}
                          onChange={phone.handleChange}
                          placeholder="(555) 123-4567"
                          className="wm-input-well w-full text-foreground"
                          style={{ fontFamily: bodyFont, fontSize: 14, padding: '10px 12px' }}
                        />
                      </div>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginTop: 4 }}>
                        <input
                          type="checkbox"
                          checked={tcpaConsent}
                          onChange={e => setTcpaConsent(e.target.checked)}
                          style={{ marginTop: 3, accentColor: 'hsl(var(--primary))' }}
                        />
                        <span className="text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.4 }}>
                          I agree to receive calls/texts about my project. Msg & data rates may apply. Reply STOP to opt out.
                        </span>
                      </label>

                      {gateError && (
                        <div style={{ color: 'hsl(var(--color-danger))', fontSize: 12, fontFamily: monoFont, textAlign: 'center' }}>
                          {gateError}
                        </div>
                      )}

                      <button
                        onClick={handleGateSubmit}
                        disabled={submitting}
                        className="btn-depth-primary w-full"
                        style={{
                          fontFamily: bodyFont, fontWeight: 700, fontSize: 14,
                          padding: '13px', borderRadius: 'var(--radius-btn)',
                          opacity: submitting ? 0.6 : 1,
                        }}
                      >
                        {submitting ? 'Unlocking…' : 'Unlock My Baseline →'}
                      </button>

                      <div className="text-muted-foreground" style={{ fontSize: 10, textAlign: 'center', fontFamily: monoFont, letterSpacing: '0.04em' }}>
                        You'll receive your baseline instantly. No spam.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BRAND COMPARE TAB ─────────────────────────────────────────── */}
        {activeTab === 'compare' && (
          <div>
            <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.1em', marginBottom: 16 }}>
              BRAND COMPARISON FOR {config.windowCount} WINDOWS · {config.county.toUpperCase()}
            </div>
            {IMPACT_WINDOW_BRANDS.map(brand => {
              const brandResult = calculateBaseline({ ...config, brand: brand.name });
              const isSelected  = config.brand === brand.name;
              return (
                <div
                  key={brand.name}
                  onClick={() => update('brand', brand.name)}
                  className={`border transition-all cursor-pointer ${
                    isSelected ? 'bg-primary/5 border-primary' : 'bg-card border-border'
                  }`}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 60px',
                    gap: 0, padding: '12px 14px', marginBottom: 4,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div className={isSelected ? 'text-primary' : 'text-foreground'} style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600 }}>
                      {brand.name}
                    </div>
                    <div className="text-muted-foreground" style={{ fontFamily: monoFont, fontSize: 9, marginTop: 2 }}>
                      {brand.warranty}yr warranty · NOA: {brand.noaStatus}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: dispFont, fontWeight: 800, fontSize: 16,
                    color: brand.tier === 'premium' ? 'hsl(var(--color-emerald))' : brand.tier === 'mid' ? 'hsl(var(--color-gold-accent))' : 'hsl(var(--color-vivid-orange))' }}>
                    ${brandResult.perWindow.toLocaleString()}
                  </div>
                  <div className="text-foreground" style={{ textAlign: 'right', fontFamily: dispFont, fontWeight: 700, fontSize: 14 }}>
                    ${brandResult.fairMid.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground" style={{ textAlign: 'right', fontFamily: monoFont, fontSize: 9 }}>
                    {brand.tier.toUpperCase()}
                  </div>
                  {isSelected && (
                    <div className="text-primary" style={{ fontFamily: monoFont, fontSize: 9, textAlign: 'right' }}>
                      ◈ SELECTED
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONTRACTOR CHECKLIST TAB ───────────────────────────────────── */}
        {activeTab === 'checklist' && (
          <div>
            <div className="text-muted-foreground" style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              Print or save this. When the contractor arrives, ask these five questions before accepting any quote.
            </div>
            {[
              {
                badge: '▲ CRITICAL',   badgeColor: 'hsl(var(--color-danger))',
                q: 'What specific brand AND model number are you installing?',
                why: 'Without a named brand, your contractor can install any quality after signing. The brand is the product you\'re actually buying.',
                script: '"Please add the brand, model, and NOA number to the contract before I sign."',
              },
              {
                badge: '▲ CRITICAL',   badgeColor: 'hsl(var(--color-danger))',
                q: 'Is the permit listed as a separate line item with a dollar amount?',
                why: '"Permit included" is one of the most expensive phrases in a window contract. Without a dollar amount, they control whether a permit is pulled.',
                script: '"Can you show me the permit as a separate line item? I\'d like to confirm it\'s being pulled before work begins."',
              },
              {
                badge: '⚡ IMPORTANT', badgeColor: 'hsl(var(--color-gold-accent))',
                q: 'What is the labor warranty period?',
                why: 'Florida state minimum is 3 years for full replacement. Many contractors quote 1 year. That gap is not an accident.',
                script: '"What is the labor warranty and does it remain valid if I file a manufacturer warranty claim?"',
              },
              {
                badge: '⚡ IMPORTANT', badgeColor: 'hsl(var(--color-gold-accent))',
                q: 'Is this a fin installation, full frame replacement, or something else?',
                why: 'Installation method affects energy efficiency, water intrusion risk, and cost. If not specified, they choose the cheapest method after signing.',
                script: '"Please add the installation method to the contract language."',
              },
              {
                badge: '◎ TECHNICAL', badgeColor: 'hsl(var(--primary))',
                q: 'Is the installation crew licensed and insured in Florida?',
                why: 'Unlicensed subcontractors void your homeowner\'s insurance in Florida if damage occurs during installation.',
                script: '"Can you provide the license number and COI for the crew installing the windows?"',
              },
            ].map((item, i) => (
              <div key={i} className="glass-card-strong" style={{
                borderLeft: '2px solid hsl(var(--border))',
                padding: '16px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{
                    fontFamily: monoFont, fontSize: 9, color: item.badgeColor,
                    background: `color-mix(in srgb, ${item.badgeColor} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${item.badgeColor} 25%, transparent)`,
                    padding: '2px 7px', borderRadius: 2, letterSpacing: '0.1em',
                  }}>
                    {item.badge}
                  </span>
                </div>
                <div className="text-foreground" style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  {item.q}
                </div>
                <div className="text-muted-foreground" style={{ fontFamily: bodyFont, fontSize: 13, lineHeight: 1.65, marginBottom: 10 }}>
                  {item.why}
                </div>
                <div className="text-secondary-foreground bg-muted" style={{
                  fontFamily: bodyFont, fontSize: 12, fontStyle: 'italic',
                  padding: '8px 12px', borderLeft: '2px solid hsl(var(--primary))',
                }}>
                  "{item.script}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
