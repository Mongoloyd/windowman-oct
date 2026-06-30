import { Helmet } from "react-helmet-async";
import WindowManLandingPage from "@/components/landing/WindowManLandingPage";

export default function WindowManLanding() {
  return (
    <>
      <Helmet>
        <title>WindowMan — Review Your Impact Window Quote Before You Sign</title>
        <meta
          name="description"
          content="WindowMan helps homeowners understand impact-window quotes before signing. Review scope, pricing signals, warranty language, payment terms, and sample Truth Report examples."
        />
        <meta
          property="og:title"
          content="Review your impact-window quote before you sign | WindowMan"
        />
        <meta
          property="og:description"
          content="Quote intelligence for homeowners — understand scope, pricing signals, risk language, and what to ask before signing."
        />
        <link rel="canonical" href="/windowman" />
      </Helmet>
      <WindowManLandingPage />
    </>
  );
}
