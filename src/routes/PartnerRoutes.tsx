import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import PartnerGuard from "@/components/auth/PartnerGuard";

const PartnerDossier = lazy(() => import("@/pages/PartnerDossier.tsx"));
const ContractorLogin = lazy(() => import("@/pages/ContractorLogin.tsx"));
const ContractorOpportunitiesPage = lazy(() => import("@/pages/ContractorOpportunitiesPage.tsx"));
const PartnerRevenueDashboard = lazy(() => import("@/pages/PartnerRevenueDashboard.tsx"));
const ContractorPortal = lazy(() => import("@/pages/ContractorPortal.tsx"));
const PartnerLayout = lazy(() => import("@/components/partner/PartnerLayout.tsx"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite.tsx"));
const PartnerResetPassword = lazy(() => import("@/pages/PartnerResetPassword.tsx"));
const ContractorOnboarding = lazy(() => import("@/pages/ContractorOnboarding.tsx"));
const NotFound = lazy(() => import("@/pages/NotFound.tsx"));

export function PartnerRoutes() {
  return (
    <Routes>
      <Route path="login" element={<ContractorLogin />} />
      <Route path="join" element={<ContractorLogin initialView="register" />} />
      <Route path="reset-password" element={<PartnerResetPassword />} />
      <Route path="accept-invite" element={<AcceptInvite />} />
      <Route path="onboarding" element={<ContractorOnboarding />} />
      <Route
        element={
          <PartnerGuard>
            <PartnerLayout />
          </PartnerGuard>
        }
      >
        <Route path="portal" element={<ContractorPortal />} />
        <Route path="opportunities" element={<ContractorOpportunitiesPage />} />
        <Route path="revenue" element={<PartnerRevenueDashboard />} />
        <Route path="dossier/:id?" element={<PartnerDossier />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}