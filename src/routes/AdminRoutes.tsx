import { lazy } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { isAdminDashboardTab } from "@/routes/adminDashboardTabs";

const AdminDashboard = lazy(() => import("@/components/AdminDashboard.tsx"));
const AdminAuthGate = lazy(() =>
  import("@/components/admin/AdminAuthGate").then((module) => ({
    default: module.AdminAuthGate,
  })),
);
const AdminPartners = lazy(() => import("@/pages/AdminPartners.tsx"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin.tsx"));
const AdminForgotPassword = lazy(() => import("@/pages/AdminForgotPassword.tsx"));
const AdminResetPassword = lazy(() => import("@/pages/AdminResetPassword.tsx"));
const AdminHealth = lazy(() => import("@/pages/AdminHealth.tsx"));
const AdminLeadInbox = lazy(() => import("@/pages/AdminLeadInbox.tsx"));
const AdminLeadDossierPage = lazy(() => import("@/pages/AdminLeadDossierPage.tsx"));
const AdminLeadReport = lazy(() => import("@/pages/AdminLeadReport.tsx"));
const AdminLeadEvidence = lazy(() => import("@/pages/AdminLeadEvidence.tsx"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings.tsx"));
const DemoClassic = lazy(() => import("@/pages/DemoClassic.tsx"));
const DevReportPreview = lazy(() => import("@/pages/DevReportPreview.tsx"));
const DevTesting = lazy(() => import("@/pages/DevTesting.tsx"));
const NotFound = lazy(() => import("@/pages/NotFound.tsx"));

function AdminDashboardTabRoute() {
  const { tab } = useParams<{ tab: string }>();

  if (!tab || !isAdminDashboardTab(tab)) {
    return <NotFound />;
  }

  return <AdminAuthGate><AdminDashboard initialTab={tab} /></AdminAuthGate>;
}

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminAuthGate><AdminDashboard /></AdminAuthGate>} />
      <Route path="login" element={<AdminLogin />} />
      <Route path="forgot-password" element={<AdminForgotPassword />} />
      <Route path="reset-password" element={<AdminResetPassword />} />
      <Route path="health" element={<AdminHealth />} />
      <Route path="command-center" element={<AdminAuthGate><AdminDashboard initialTab="mission-control" /></AdminAuthGate>} />
      <Route path="launch" element={<AdminAuthGate><AdminDashboard initialTab="launch" /></AdminAuthGate>} />
      <Route path="command" element={<AdminAuthGate><AdminDashboard initialTab="command" /></AdminAuthGate>} />
      <Route path="pipeline" element={<AdminAuthGate><AdminDashboard initialTab="pipeline" /></AdminAuthGate>} />
      <Route path="routing" element={<AdminAuthGate><AdminDashboard initialTab="routing" /></AdminAuthGate>} />
      <Route path="lead-assignments" element={<AdminAuthGate><AdminDashboard initialTab="lead-assignments" /></AdminAuthGate>} />
      <Route path="lead-release" element={<AdminAuthGate><AdminDashboard initialTab="lead-release" /></AdminAuthGate>} />
      <Route path="syndicate-health" element={<AdminAuthGate><AdminDashboard initialTab="syndicate-health" /></AdminAuthGate>} />
      <Route path="contractor-performance" element={<AdminAuthGate><AdminDashboard initialTab="contractor-performance" /></AdminAuthGate>} />
      <Route path="ghosts" element={<AdminAuthGate><AdminDashboard initialTab="ghosts" /></AdminAuthGate>} />
      <Route path="needs-review" element={<AdminAuthGate><AdminDashboard initialTab="needs-review" /></AdminAuthGate>} />
      <Route path="contractors" element={<AdminAuthGate><AdminDashboard initialTab="contractors" /></AdminAuthGate>} />
      <Route path="outcomes" element={<AdminAuthGate><AdminDashboard initialTab="outcomes" /></AdminAuthGate>} />
      <Route path="outcome-inspector" element={<AdminAuthGate><AdminDashboard initialTab="outcome-inspector" /></AdminAuthGate>} />
      <Route path="attribution" element={<AdminAuthGate><AdminDashboard initialTab="attribution" /></AdminAuthGate>} />
      <Route path="signal-dispatch" element={<AdminAuthGate><AdminDashboard initialTab="signal-dispatch" /></AdminAuthGate>} />
      <Route path="dialer" element={<AdminAuthGate><AdminDashboard initialTab="engine" /></AdminAuthGate>} />
      <Route path="delivery-inspector" element={<AdminAuthGate><AdminDashboard initialTab="delivery-inspector" /></AdminAuthGate>} />
      <Route path="session-diag" element={<AdminAuthGate><AdminDashboard initialTab="session-diag" /></AdminAuthGate>} />
      <Route path="leads" element={<AdminAuthGate><AdminLeadInbox /></AdminAuthGate>} />
      <Route path="leads/:id" element={<AdminAuthGate><AdminLeadDossierPage /></AdminAuthGate>} />
      <Route path="leads/:id/report" element={<AdminAuthGate><AdminLeadReport /></AdminAuthGate>} />
      <Route path="lead-evidence" element={<AdminAuthGate><AdminLeadEvidence /></AdminAuthGate>} />
      <Route path="settings" element={<AdminAuthGate><AdminSettings /></AdminAuthGate>} />
      <Route path="partners" element={<AdminAuthGate><AdminPartners /></AdminAuthGate>} />
      <Route path="lab/demo-classic" element={<AdminAuthGate><DemoClassic /></AdminAuthGate>} />
      <Route path="lab/report-preview" element={<AdminAuthGate><DevReportPreview /></AdminAuthGate>} />
      <Route path="lab/devtesting" element={<AdminAuthGate><DevTesting /></AdminAuthGate>} />
      <Route path=":tab" element={<AdminDashboardTabRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}