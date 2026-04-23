import { lazy, Suspense, Component, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppTrackingProvider } from "@/components/AppTrackingProvider";
import { HelmetProvider } from "react-helmet-async";
import AdminSettings from "./pages/AdminSettings";
import PublicLayout from "@/components/PublicLayout";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";
import { ScanFunnelProvider } from "@/state/scanFunnel";

// ── Static import for critical home route ────────────────────────────────────
import Index from "./pages/Index";

// ── Lazy-loaded routes ──────────────────────────────────────────────────────
const ReportClassic = lazy(() => import("./pages/ReportClassic.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Dev/internal only — not linked from any production CTA
const DemoClassic = lazy(() => import("./pages/DemoClassic.tsx"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard.tsx"));
const AdminPartners = lazy(() => import("./pages/AdminPartners.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const AdminForgotPassword = lazy(() => import("./pages/AdminForgotPassword.tsx"));
const AdminResetPassword = lazy(() => import("./pages/AdminResetPassword.tsx"));
const DevReportPreview = lazy(() => import("./pages/DevReportPreview.tsx"));
const DevTesting = lazy(() => import("./pages/DevTesting.tsx"));
const DevTesting2 = lazy(() => import("./pages/DevTesting2.tsx"));

// ── Static content pages ─────────────────────────────────────────────────────
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
const PartnerDossier = lazy(() => import("./pages/PartnerDossier.tsx"));
const ContractorLogin = lazy(() => import("./pages/ContractorLogin.tsx"));
const ContractorOpportunitiesPage = lazy(() => import("./pages/ContractorOpportunitiesPage.tsx"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite.tsx"));
const PartnerResetPassword = lazy(() => import("./pages/PartnerResetPassword.tsx"));
const ContractorOnboarding = lazy(() => import("./pages/ContractorOnboarding.tsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.tsx"));
const Estimate = lazy(() => import("./pages/Estimate.tsx"));
const Diagnosis = lazy(() => import("./pages/Diagnosis.tsx"));

// PartnerGuard removed — partner pages render publicly with preview fallback

// Redirect helper: /report/:sessionId → /report/classic/:sessionId
function ReportRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <Navigate to={`/report/classic/${sessionId}`} replace />;
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppTrackingProvider>
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/lp/:slug" element={<LandingPage />} />
                <Route path="/estimate" element={<Estimate />} />
                <Route path="/diagnosis" element={<Diagnosis />} />
                <Route path="/report/classic/:sessionId" element={<ScanFunnelProvider><ReportClassic /></ScanFunnelProvider>} />
                {/* Legacy V2 route → permanent redirect to Classic */}
                <Route path="/report/:sessionId" element={<ReportRedirect />} />
                {/* ── Admin auth (public) ── */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
                <Route path="/admin/reset-password" element={<AdminResetPassword />} />
                {/* ── Admin shell (gated) ── */}
                <Route path="/admin" element={<AdminAuthGate><AdminDashboard /></AdminAuthGate>} />
                <Route path="/admin/settings" element={<AdminAuthGate><AdminSettings /></AdminAuthGate>} />
                <Route path="/admin/partners" element={<AdminAuthGate><AdminPartners /></AdminAuthGate>} />
                <Route path="/demo-classic" element={<DemoClassic />} />
                <Route path="/dev/report-preview" element={<DevReportPreview />} />
                <Route path="/devtesting" element={<DevTesting />} />
                <Route path="/devtesting2" element={<DevTesting2 />} />
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
                <Route path="/partner/login" element={<ContractorLogin />} />
                <Route path="/partner/reset-password" element={<PartnerResetPassword />} />
                <Route path="/partner/accept-invite" element={<AcceptInvite />} />
                <Route path="/partner/onboarding" element={<ContractorOnboarding />} />
                <Route path="/partner/opportunities" element={<ContractorOpportunitiesPage />} />
                <Route path="/partner/dossier/:id?" element={<PartnerDossier />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </AppTrackingProvider>
      </BrowserRouter>
    </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
