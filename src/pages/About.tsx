import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/trackEvent";
import AboutHero from "@/components/about/AboutHero";
import MarketProblemSection from "@/components/about/MarketProblemSection";
import InformationAsymmetrySection from "@/components/about/InformationAsymmetrySection";
import WhyPricesVarySection from "@/components/about/WhyPricesVarySection";
import NotAContractorSection from "@/components/about/NotAContractorSection";
import HowWindowManWorksSection from "@/components/about/HowWindowManWorksSection";
import ArbitrageEngineSection from "@/components/about/ArbitrageEngineSection";
import ArbitrageEngine, { type FunnelStep, FUNNEL_STEPS } from "@/components/arbitrageengine";
import { WindowManIntakeLive } from "@/components/intake";
import HowWeMakeMoneySection from "@/components/about/HowWeMakeMoneySection";
import BestPriceConditionsSection from "@/components/about/BestPriceConditionsSection";
import TransparencyShiftSection from "@/components/about/TransparencyShiftSection";
import ContractorBenefitSection from "@/components/about/ContractorBenefitSection";
import InevitabilitySection from "@/components/about/InevitabilitySection";
import TrustProofSection from "@/components/about/TrustProofSection";
import AboutCTASection from "@/components/about/AboutCTASection";
import StickyCTAFooter from "@/components/StickyCTAFooter";

// Phase 3: when progressive capture is on, direct entry may only land on
// early funnel steps. Later steps depend on a backend lead row created at
// contact submit, so deep-linking past contact is clamped back to "scope".
// Module-scoped so the static set is not reallocated on every render.
const DIRECT_ENTRY_ALLOWED_STEPS: ReadonlySet<string> = new Set([
  "scope",
  "intent_filter",
  "status",
  "comp_a",
  "comp_b",
  "contact",
  "secret_capture",
]);

export default function About() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isDirectEntry = searchParams.get("startArb") === "1";
  const source = searchParams.get("src") || "unknown";
  const rawStep = searchParams.get("step") || "scope";

  const progressiveCaptureEnabled =
    import.meta.env.VITE_ARBITRAGE_PROGRESSIVE_CAPTURE === "true";

  // Fallback-safe: the live intake router only replaces ArbitrageEngine in the
  // direct-entry surface when BOTH flags are on. Otherwise the proven
  // ArbitrageEngine path renders unchanged.
  const intakeRouterEnabled =
    import.meta.env.VITE_INTAKE_ROUTER_ENABLED === "true";
  const useIntakeRouter = intakeRouterEnabled && progressiveCaptureEnabled;

  const parsedStep: FunnelStep = (FUNNEL_STEPS as string[]).includes(rawStep)
    ? (rawStep as FunnelStep)
    : "scope";
  const initialStep: FunnelStep =
    progressiveCaptureEnabled && !DIRECT_ENTRY_ALLOWED_STEPS.has(parsedStep)
      ? "scope"
      : parsedStep;

  useEffect(() => {
    trackEvent({
      event_name: "about_page_opened",
      route: "/about",
      metadata: { direct_entry: isDirectEntry, source },
    });
  }, [isDirectEntry, source]);

  const handleTrack = (eventName: string) => {
    trackEvent({
      event_name: eventName,
      route: "/about",
      metadata: { direct_entry: isDirectEntry, source },
    });
  };

  const clearDirectEntryParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("startArb");
    next.delete("step");
    next.delete("src");
    setSearchParams(next, { replace: true });
  };

  return (
    <main className="relative min-h-screen overflow-hidden pb-32" style={{ background: "linear-gradient(170deg, #dce8f4 0%, #e4edf6 30%, #eaeff8 60%, #dde6f2 100%)" }}>
      <AboutHero onTrack={handleTrack} />
      <MarketProblemSection />
      <InformationAsymmetrySection onTrack={handleTrack} />
      <WhyPricesVarySection />
      <NotAContractorSection />
      <HowWindowManWorksSection />

      {isDirectEntry ? (
        <section className="relative px-6 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            {useIntakeRouter ? (
              <WindowManIntakeLive />
            ) : (
              <ArbitrageEngine
                autoOpen
                hideBaseShell
                source={source}
                initialStep={initialStep}
                onDirectEntryClose={clearDirectEntryParams}
              />
            )}
          </div>
        </section>
      ) : (
        <ArbitrageEngineSection />
      )}

      <HowWeMakeMoneySection />
      <BestPriceConditionsSection />
      <TransparencyShiftSection />
      <ContractorBenefitSection />
      <InevitabilitySection />
      <TrustProofSection />
      <AboutCTASection onTrack={handleTrack} />
      <StickyCTAFooter
        isVisible={true}
        conversionType={null}
        onScanClick={() => navigate("/?action=scan")}
        onDemoClick={() => navigate("/?action=demo")}
        onPostConversionClick={() => { window.location.href = "tel:+15614685571"; }}
      />
    </main>
  );
}
