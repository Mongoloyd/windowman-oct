export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-08-01";
export const PRIVACY_POLICY_LAST_REVIEWED = "2026-08-01";
export const PRIVACY_POLICY_URL = "https://windowman.app/privacy";
export const PRIVACY_POLICY_TITLE =
  "WindowMan Privacy Policy | Quote Uploads, Tracking & Data Use";
export const PRIVACY_POLICY_DESCRIPTION =
  "Learn how WindowMan collects, processes, protects, retains, and shares information from quote uploads, lead forms, analytics, advertising attribution, and contractor introductions.";

export const PRIVACY_POLICY_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://windowman.app/privacy#webpage",
  url: "https://windowman.app/privacy",
  name: "WindowMan Privacy Policy",
  description:
    "How WindowMan collects, uses, processes, retains, protects, and shares information.",
  datePublished: PRIVACY_POLICY_EFFECTIVE_DATE,
  dateModified: PRIVACY_POLICY_LAST_REVIEWED,
  lastReviewed: PRIVACY_POLICY_LAST_REVIEWED,
  inLanguage: "en-US",
  isPartOf: {
    "@type": "WebSite",
    "@id": "https://windowman.app/#website",
    url: "https://windowman.app",
    name: "WindowMan",
  },
  publisher: {
    "@type": "Organization",
    "@id": "https://windowman.app/#organization",
    name: "WindowMan",
    url: "https://windowman.app",
  },
} as const;

export type PrivacyRetentionRow = {
  category: string;
  standard: string;
};

export const PRIVACY_RETENTION_ROWS: PrivacyRetentionRow[] = [
  {
    category: "Browser attribution data",
    standard:
      "Stored in browser local storage for up to 30 days.",
  },
  {
    category: "Uploaded quote documents",
    standard:
      "Retained while needed to process the quote, provide requested report access, support the user, resolve disputes, maintain security, or comply with law.",
  },
  {
    category: "Extracted quote and analysis records",
    standard:
      "Retained while needed to provide reports, support account or session continuity, improve service reliability, resolve disputes, or comply with law.",
  },
  {
    category: "Contact and lead information",
    standard:
      "Retained while the service relationship or reasonable follow-up remains active and as needed for support, legal compliance, dispute resolution, or suppression-list management.",
  },
  {
    category: "Verification and security records",
    standard:
      "Retained as needed to protect accounts, prevent fraud, document verification, and investigate security incidents.",
  },
  {
    category: "Consent records",
    standard:
      "Retained as needed to document the consent or opt-out instruction and demonstrate compliance.",
  },
  {
    category: "Advertising and event logs",
    standard:
      "Retained according to operational, attribution, audit, security, and vendor retention requirements.",
  },
  {
    category: "Opt-out and suppression records",
    standard:
      "Retained as needed to ensure that an opt-out request continues to be honored.",
  },
  {
    category: "Backups",
    standard:
      "Retained until replaced or deleted under applicable backup-rotation procedures.",
  },
];
