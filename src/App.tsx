import { lazy, Suspense, Component, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppTrackingProvider } from "@/components/AppTrackingProvider";
import ConsentBanner from "@/components/consentBanner";
import { HelmetProvider } from "react-helmet-async";
import { ScanFunnelProvider } from "@/state/scanFunnel";
import { isAdminDashboardTab, PUBLIC_ROOT_ROUTE_DENYLIST } from "@/routes/adminDashboardTabs";

// ── Lazy-loaded routes ──────────────────────────────────────────────────────
const Index = lazy(() => import("./pages/Index"));
const ReportClassic = lazy(() => import("./pages/ReportClassic.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AdminRoutes = lazy(() =>
  import("@/routes/AdminRoutes").then((module) => ({ default: module.AdminRoutes })),
);
const PartnerRoutes = lazy(() =>
  import("@/routes/PartnerRoutes").then((module) => ({ default: module.PartnerRoutes })),
);

// Dev/internal only — not linked from any production CTA
const WindowManIntakePreview = lazy(
  () => import("@/components/intake/WindowManIntakePreview"),
);
const DevReportPreview = lazy(() => import("./pages/DevReportPreview.tsx"));
const DevTesting = lazy(() => import("./pages/DevTesting.tsx"));
const PreUploadIntake = lazy(() => import("@/components/forensic-report/PreUploadIntake"));
const VisualPreUploadIntake = lazy(() => import("./pages/VisualPreUploadIntake.tsx"));
const VisualOracleLab = lazy(() => import("./pages/VisualOracleLab.tsx"));

// ── Static content pages ─────────────────────────────────────────────────────
const PublicLayout = lazy(() => import("@/components/PublicLayout"));
const About = lazy(() => import("./pages/About.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Disclaimer = lazy(() => import("./pages/Disclaimer.tsx"));
const HowWeBeatWindowQuotes = lazy(() => import("./pages/HowWeBeatWindowQuotes.tsx"));
const Contractors = lazy(() => import("./pages/Contractors.tsx"));
const Contractors2 = lazy(() => import("./pages/Contractors2.tsx"));
const Contractors3 = lazy(() => import("./pages/contractors3/Contractors3.tsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.tsx"));
const Estimate = lazy(() => import("./pages/Estimate.tsx"));
const Diagnosis = lazy(() => import("./pages/Diagnosis.tsx"));
const NextdoorHome = lazy(() => import("./pages/NextdoorHome.tsx"));
const WindowManLanding = lazy(() => import("./pages/WindowManLanding.tsx"));
const PricingSearchLanding = lazy(() => import("./pages/PricingSearchLanding.tsx"));
const WindowPricesLanding = lazy(() => import("./pages/WindowPricesLanding.tsx"));
const WindowPriceAuditLanding = lazy(() => import("./pages/WindowPriceAuditLanding.tsx"));
const TruthReportLanding = lazy(() => import("./pages/TruthReportLanding.tsx"));
const AiDemoLanding = lazy(() => import("./pages/AiDemoLanding.tsx"));
const ScanFunnelPage = lazy(() => import("./pages/ScanFunnelPage.tsx"));
const CampaignNqLanding = lazy(() => import("./pages/CampaignNQ/CampaignNqLanding.tsx"));
const CampaignNq2Landing = lazy(() => import("./pages/CampaignNQ2/CampaignNq2Landing.tsx"));
const CampaignNq3Landing = lazy(() => import("./pages/CampaignNQ3/NoQuoteLanding.tsx"));
const CampaignNq4Page = lazy(() => import("./pages/CampaignNQ4/CampaignNq4Page.tsx"));
const WmChatPage = lazy(() => import("./pages/WmChat/WmChatPage.tsx"));

// PartnerGuard removed — partner pages render publicly with preview fallback

// Redirect helper: /report/:sessionId → /report/classic/:sessionId
function ReportRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Navigate to={`/report/classic/${sessionId}`} replace />;
}

function DevAdminAliasRedirect() {
  const { devAdminAlias } = useParams<{ devAdminAlias: string }>();

  if (!import.meta.env.DEV || !devAdminAlias) {
    return <NotFound />;
  }

  if (devAdminAlias.includes("/") || PUBLIC_ROOT_ROUTE_DENYLIST.has(devAdminAlias)) {
    return <NotFound />;
  }

  if (!isAdminDashboardTab(devAdminAlias)) {
    return <NotFound />;
  }

  return <Navigate to={`/admin/${devAdminAlias}`} replace />;
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Loading…</p>
      </div>
    </div>
  );
}

// ── Error boundary for lazy-loaded route chunk failures ───────────────────────
class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <p className="text-sm text-muted-foreground font-mono">
              Something went wrong loading this page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Click to reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();
const isDevMode = import.meta.env.DEV;
// Presentation-only visibility switch for the Sprint 1 `/scan` visual foundation.
// Exact lowercase "true" mounts the route; anything else leaves it unmounted.
// This flag is not authorization and must not gate backend intake or reveal.
const isScanRouteMounted = import.meta.env.VITE_SCAN_ROUTE_MOUNTED === "true";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppTrackingProvider>
          <ConsentBanner />
          <ScanFunnelProvider>
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/quote-check" element={<PricingSearchLanding />} />
                <Route path="/window-prices" element={<WindowPricesLanding />} />
                <Route path="/window-price-audit" element={<WindowPriceAuditLanding />} />
                <Route path="/truth-report" element={<TruthReportLanding />} />
                <Route path="/ai-demo" element={<AiDemoLanding />} />
                <Route path="/lp/:slug" element={<LandingPage />} />
                <Route path="/estimate" element={<Estimate />} />
                <Route path="/diagnosis" element={<Diagnosis />} />
                <Route path="/report/classic/:sessionId" element={<ReportClassic />} />
                {/* Legacy V2 route → permanent redirect to Classic */}
                <Route path="/report/:sessionId" element={<ReportRedirect />} />
                <Route path="/admin/*" element={<AdminRoutes />} />
                {/* Visual lab — unlisted mock QA; not production funnel */}
                <Route path="/visual/report-preview" element={<DevReportPreview />} />
                <Route path="/visual/pre-upload-intake" element={<VisualPreUploadIntake />} />
                {/* Temporary Visual Lab Route — Sprint C.1.
                    Visual-only intake scaffold preview.
                    Remove or gate before production use. */}
                <Route path="/visual/intake-preview" element={<WindowManIntakePreview />} />
                {/* Fixture-only Window Oracle — synthetic data; unlisted; no Supabase. */}
                <Route path="/visual/oracle-lab" element={<VisualOracleLab />} />
                {isDevMode && (
                  <>
                    <Route path="/dev/report-preview" element={<DevReportPreview />} />
                    <Route path="/devtesting" element={<DevTesting />} />
                    <Route path="/dialer" element={<Navigate to="/admin/dialer" replace />} />
                    <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
                    <Route path="/partners" element={<Navigate to="/admin/partners" replace />} />
                    <Route path=":devAdminAlias" element={<DevAdminAliasRedirect />} />
                  </>
                )}
                {isDevMode && (
                  <>
                    {/* Sandbox visual QA harness — unlisted, noindex, mock-only. */}
                    <Route path="/sandbox/report-preview" element={<DevReportPreview />} />
                    <Route path="/sandbox/intake" element={<PreUploadIntake />} />
                  </>
                )}
                <Route path="/contractors3" element={<Contractors3 />} />
                

                {/* ── Static content pages (shared PublicNavbar via PublicLayout) ── */}
                <Route element={<PublicLayout />}>
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/disclaimer" element={<Disclaimer />} />
                  <Route path="/how-we-beat-window-quotes" element={<HowWeBeatWindowQuotes />} />
                  <Route path="/contractors" element={<Contractors />} />
                  <Route path="/contractors2" element={<Contractors2 />} />
                </Route>
                <Route path="/partner/*" element={<PartnerRoutes />} />
                <Route path="/nextdoor" element={<NextdoorHome />} />
                <Route path="/windowman" element={<WindowManLanding />} />
                <Route path="/nq" element={<CampaignNqLanding />} />
                <Route path="/nq2" element={<CampaignNq2Landing />} />
                <Route path="/nq3" element={<CampaignNq3Landing />} />
                <Route path="/nq4" element={<CampaignNq4Page />} />
                <Route path="/wmchat" element={<WmChatPage />} />
                {isScanRouteMounted && (
                  <Route path="/scan" element={<ScanFunnelPage />} />
                )}
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RouteErrorBoundary>
          </ScanFunnelProvider>
        </AppTrackingProvider>
      </BrowserRouter>
    </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
