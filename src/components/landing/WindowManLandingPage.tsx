import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadZone from "@/components/UploadZone";
import type {
  IntakeIntentChoice,
  IntakePersistedSuccessHandler,
} from "@/components/intake/universal/intakeTypes";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import type { LandingIntent } from "./landingTypes";
import LandingHeader from "./LandingHeader";
import HeroSection from "./HeroSection";
import FounderIntro from "./FounderIntro";
import MarketAsymmetrySection from "./MarketAsymmetrySection";
import SystemExplainerSection from "./SystemExplainerSection";
import VisitorIdentityRouter from "./VisitorIdentityRouter";
import ProductEducationEngine from "./ProductEducationEngine";
import IntelligenceDatabaseSection from "./IntelligenceDatabaseSection";
import TruthReportShowcase from "./TruthReportShowcase";
import TrustCredibilitySection from "./TrustCredibilitySection";
import LandingFAQSection from "./LandingFAQSection";
import FinalCTASection from "./FinalCTASection";
import LandingFooter from "./LandingFooter";
import LandingStickyCta from "./LandingStickyCta";
import FirstQuoteIntakeModal from "./FirstQuoteIntakeModal";
import { FIRST_QUOTE_INTAKE_EVENT } from "./landingHandoff";
import { WINDOWMAN_ANALYZE_QUOTE_EVENT } from "./landingTracking";
import {
  clearWindowmanUploadResume,
  readWindowmanUploadResume,
  type WindowmanUploadResume,
  writeWindowmanUploadResume,
} from "./windowmanUploadResume";

export default function WindowManLandingPage() {
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const [selectedIntent, setSelectedIntent] = useState<LandingIntent>(null);
  const [expandedEducationModules, setExpandedEducationModules] = useState<string[]>([]);
  const [expandedFaqItems, setExpandedFaqItems] = useState<string[]>([]);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);
  const [firstQuoteIntakeOpen, setFirstQuoteIntakeOpen] = useState(false);
  const [intakeIntent, setIntakeIntent] = useState<IntakeIntentChoice>("no_quote");
  const [uploadHandoff, setUploadHandoff] = useState(readWindowmanUploadResume);
  const [showUpload, setShowUpload] = useState(uploadHandoff !== null);
  const intakeOpenRef = useRef(false);
  const uploadPendingRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const hydratedHandoffRef = useRef<string | null>(null);

  const toggleEducationModule = useCallback((moduleId: string) => {
    setExpandedEducationModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  }, []);

  const toggleFaqItem = useCallback((itemId: string) => {
    setExpandedFaqItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }, []);

  const hydrateFunnelIdentity = useCallback((handoff: WindowmanUploadResume) => {
    if (!funnel) return;

    const identityKey = `${handoff.leadId}:${handoff.sessionId}`;
    if (hydratedHandoffRef.current === identityKey) return;
    hydratedHandoffRef.current = identityKey;

    funnel.setPhone("", "none");
    funnel.setLeadId(handoff.leadId);
    funnel.setSessionId(handoff.sessionId);
    funnel.setScanSessionId(null);
    funnel.setQuoteFileId(null);
  }, [funnel]);

  useEffect(() => {
    if (uploadHandoff) hydrateFunnelIdentity(uploadHandoff);
  }, [hydrateFunnelIdentity, uploadHandoff]);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
  }, []);

  useEffect(() => {
    const openIntake = (intent: IntakeIntentChoice) => {
      setIntakeIntent(intent);
      if (intakeOpenRef.current) return;

      intakeOpenRef.current = true;
      uploadPendingRef.current = false;
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setFirstQuoteIntakeOpen(true);
    };
    const openFirstQuoteIntake = () => openIntake("no_quote");
    const openAnalyzeQuoteIntake = (event: Event) => {
      event.preventDefault();
      openIntake("has_quote");
    };

    window.addEventListener(FIRST_QUOTE_INTAKE_EVENT, openFirstQuoteIntake);
    window.addEventListener(WINDOWMAN_ANALYZE_QUOTE_EVENT, openAnalyzeQuoteIntake);
    return () => {
      window.removeEventListener(FIRST_QUOTE_INTAKE_EVENT, openFirstQuoteIntake);
      window.removeEventListener(WINDOWMAN_ANALYZE_QUOTE_EVENT, openAnalyzeQuoteIntake);
    };
  }, []);

  const handlePersistedSuccess = useCallback<IntakePersistedSuccessHandler>((
    values,
    persisted,
  ) => {
    if (values.intent !== "has_quote") return;

    const resume = writeWindowmanUploadResume({
      leadId: persisted.leadId,
      sessionId: persisted.sessionId,
    });

    if (!resume) {
      clearWindowmanUploadResume();
      uploadPendingRef.current = false;
      setShowUpload(false);
      setUploadHandoff(null);
      return;
    }

    hydrateFunnelIdentity(resume);
    funnel?.setPhone(values.phone, "screened_valid");
    setUploadHandoff(resume);
    setShowUpload(false);
    uploadPendingRef.current = true;
  }, [funnel, hydrateFunnelIdentity]);

  const handleIntakeOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      intakeOpenRef.current = true;
      setFirstQuoteIntakeOpen(true);
      return;
    }

    const shouldRevealUpload = uploadPendingRef.current;
    intakeOpenRef.current = false;
    uploadPendingRef.current = false;
    setFirstQuoteIntakeOpen(false);

    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      openerRef.current?.focus({ preventScroll: true });
      if (shouldRevealUpload) setShowUpload(true);
    });
  }, []);

  const handleScanStart = useCallback((_fileName: string, scanSessionId: string) => {
    clearWindowmanUploadResume();
    navigate(`/report/classic/${scanSessionId}`, {
      state: { freshScan: true },
    });
  }, [navigate]);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const finalCta = document.getElementById("final-cta");
    const footer = document.getElementById("landing-footer");
    if (!hero) return;

    let heroInView = true;
    let finalInView = false;
    let footerInView = false;

    const syncSticky = () => {
      setStickyCtaVisible(!heroInView && !finalInView && !footerInView);
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroInView = entry.isIntersecting;
        syncSticky();
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" },
    );

    const bottomObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.target.id === "final-cta") finalInView = entry.isIntersecting;
        if (entry.target.id === "landing-footer") footerInView = entry.isIntersecting;
        syncSticky();
      },
      { threshold: 0.08 },
    );

    heroObserver.observe(hero);
    if (finalCta) bottomObserver.observe(finalCta);
    if (footer) bottomObserver.observe(footer);

    return () => {
      heroObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 [&_section]:scroll-mt-20">
      <LandingHeader />
      <main id="landing-main">
        <HeroSection />
        <FounderIntro />
        <MarketAsymmetrySection />
        <SystemExplainerSection />
        <VisitorIdentityRouter
          selectedIntent={selectedIntent}
          onSelectIntent={setSelectedIntent}
        />
        <ProductEducationEngine
          expandedModules={expandedEducationModules}
          onToggleModule={toggleEducationModule}
        />
        <IntelligenceDatabaseSection />
        <TruthReportShowcase />
        <TrustCredibilitySection />
        <LandingFAQSection expandedItems={expandedFaqItems} onToggleItem={toggleFaqItem} />
        <FinalCTASection />
        <section
          id="windowman-upload"
          className="relative px-5 pb-16 sm:px-8"
          hidden={!showUpload}
        >
          <div className="mx-auto max-w-3xl">
            <UploadZone
              isVisible={showUpload}
              sessionId={uploadHandoff?.sessionId}
              leadId={uploadHandoff?.leadId ?? null}
              onScanStart={handleScanStart}
            />
          </div>
        </section>
      </main>
      <LandingFooter />
      <LandingStickyCta visible={stickyCtaVisible} />
      <FirstQuoteIntakeModal
        open={firstQuoteIntakeOpen}
        onOpenChange={handleIntakeOpenChange}
        intent={intakeIntent}
        onPersistedSuccess={handlePersistedSuccess}
      />
    </div>
  );
}
