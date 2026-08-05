import { Helmet } from "react-helmet-async";
import { PrivacyPolicyBody } from "@/components/privacy/PrivacyPolicyBody";
import {
  PRIVACY_POLICY_DESCRIPTION,
  PRIVACY_POLICY_JSON_LD,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_URL,
} from "@/content/privacyPolicyMetadata";

export default function Privacy() {
  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>{PRIVACY_POLICY_TITLE}</title>
        <meta name="description" content={PRIVACY_POLICY_DESCRIPTION} />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large"
        />
        <link rel="canonical" href={PRIVACY_POLICY_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="WindowMan" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content={PRIVACY_POLICY_TITLE} />
        <meta property="og:description" content={PRIVACY_POLICY_DESCRIPTION} />
        <meta property="og:url" content={PRIVACY_POLICY_URL} />
        <meta property="og:image" content="https://windowman.app/og-wman.png" />
        <meta
          property="og:image:secure_url"
          content="https://windowman.app/og-wman.png"
        />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="WindowMan" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={PRIVACY_POLICY_TITLE} />
        <meta name="twitter:description" content={PRIVACY_POLICY_DESCRIPTION} />
        <meta name="twitter:image" content="https://windowman.app/og-wman.png" />
        <meta name="twitter:image:alt" content="WindowMan" />
        <script type="application/ld+json">
          {JSON.stringify(PRIVACY_POLICY_JSON_LD)}
        </script>
      </Helmet>
      <section
        aria-labelledby="privacy-policy-title"
        className="min-h-screen bg-slate-50 font-sans text-slate-950 [font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]"
      >
        <PrivacyPolicyBody contentOnly />
      </section>
    </>
  );
}
