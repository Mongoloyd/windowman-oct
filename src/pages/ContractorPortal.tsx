import { Helmet } from "react-helmet-async";
import { ContractorPortalShell } from "@/components/partner/ContractorPortalShell";

export default function ContractorPortal() {
  return (
    <>
      <Helmet>
        <title>Contractor Portal | WindowMan</title>
        <meta
          name="description"
          content="Internal pilot contractor portal access model for safe account-context resolution."
        />
      </Helmet>
      <ContractorPortalShell />
    </>
  );
}