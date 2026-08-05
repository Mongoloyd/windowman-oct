/**
 * Structured Privacy Policy copy — single source for React page and static prerender.
 */

export const privacyIntroParagraphs: string[] = [
  'WindowMan ("WindowMan," "we," "us," or "our") operates this service.',
  "This Privacy Policy explains how we collect, use, process, retain, disclose, and protect information when you visit windowman.app, submit a lead form, upload a contractor estimate, request a WindowMan analysis, communicate with us, or request an introduction to a contractor.",
  "WindowMan provides AI-assisted quote-review and homeowner decision-support services. WindowMan is not a contractor, licensed installer, engineering firm, law firm, building department, insurance advisor, public adjuster, or government agency.",
];

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: Array<{
    subtitle: string;
    bullets?: string[];
    paragraphs?: string[];
  }>;
};

export const privacyPolicySections: PrivacySection[] = [
  {
    id: "scope",
    title: "1. Scope of This Policy",
    paragraphs: ["This Privacy Policy applies to information processed through:"],
    bullets: [
      "windowman.app and its public pages.",
      "WindowMan quote-review and document-upload workflows.",
      "WindowMan contact, intake, and account-verification forms.",
      "Meta Instant Forms or other advertising-platform lead forms used by WindowMan.",
      "Email, telephone, and text-message communications with WindowMan.",
      "Optional contractor-introduction services.",
      "Analytics, attribution, security, and advertising-measurement systems used to operate and evaluate the service.",
    ],
    subsections: [
      {
        subtitle: "",
        paragraphs: [
          "When you submit information through a third-party platform such as Meta, that platform also processes your interaction under its own privacy policy. After the platform transfers your submitted information to WindowMan, this Privacy Policy governs WindowMan's processing of that information.",
        ],
      },
    ],
  },
  {
    id: "collect",
    title: "2. Information We Collect",
    paragraphs: ["The information we collect depends on how you interact with the service."],
    subsections: [
      {
        subtitle: "Contact Information",
        bullets: [
          "First name and last name.",
          "Email address.",
          "Mobile telephone number.",
          "Mailing address or property address when provided.",
          "Preferred contact method.",
          "Communications preferences.",
        ],
      },
      {
        subtitle: "Project and Property Information",
        bullets: [
          "Property location.",
          "County or service area.",
          "Window and door project details.",
          "Product, installation, and permit information.",
          "Project timing.",
          "Window count.",
          "Estimated project value or quote range.",
          "Information about existing or requested contractor estimates.",
          "Preferences related to quote review or contractor introductions.",
        ],
      },
      {
        subtitle: "Uploaded Documents",
        bullets: [
          "Contractor estimates.",
          "Quotes and proposals.",
          "Product schedules.",
          "Financing terms.",
          "Warranty information.",
          "Images or scans of project paperwork.",
          "Other documents submitted for analysis.",
        ],
        paragraphs: [
          "Uploaded documents may contain information about you, your property, a contractor, or another person. You should upload a document only when you have the right or authority to provide it for analysis.",
        ],
      },
      {
        subtitle: "Extracted, Derived, and Analytical Information",
        bullets: [
          "Contractor and company names.",
          "Pricing and line-item information.",
          "Product descriptions.",
          "Window and door specifications.",
          "Permit, code, safety, warranty, and installation details.",
          "Missing or unclear scope information.",
          "Quote comparisons.",
          "Risk flags.",
          "Price benchmarks.",
          "Report grades, summaries, and analytical results.",
          "Confidence scores and document classifications.",
        ],
      },
      {
        subtitle: "Account, Session, and Verification Information",
        bullets: [
          "Lead identifiers.",
          "Session identifiers.",
          "Scan-session identifiers.",
          "Account identifiers.",
          "Verification status.",
          "Telephone-verification records.",
          "Authentication and access-control records.",
          "Report-access status.",
          "Fraud-prevention and rate-limit information.",
        ],
      },
      {
        subtitle: "Website, Device, and Network Information",
        bullets: [
          "Internet Protocol address.",
          "Browser type.",
          "Device type.",
          "Operating system.",
          "User-agent information.",
          "Referral source.",
          "Pages viewed.",
          "Route and page activity.",
          "Timestamps.",
          "Form-interaction activity.",
          "Error, security, and diagnostic information.",
        ],
      },
      {
        subtitle: "Advertising and Attribution Information",
        bullets: [
          "UTM campaign parameters.",
          "Landing-page and capture-page URLs.",
          "Referring URLs.",
          "URL query parameters.",
          "Meta click identifiers.",
          "Google click identifiers.",
          "TikTok click identifiers.",
          "Microsoft advertising click identifiers.",
          "Nextdoor campaign and lead identifiers.",
          "Meta browser identifiers such as _fbp and _fbc.",
          "Other campaign, conversion, and attribution identifiers.",
        ],
      },
    ],
  },
  {
    id: "sources",
    title: "3. Sources of Information",
    bullets: [
      "Directly from you.",
      "From documents you upload.",
      "Automatically from your browser or device.",
      "From advertising links and campaign parameters.",
      "From Meta Instant Forms or other advertising-platform lead forms.",
      "From communications you send to us.",
      "From contractors or service providers when you authorize or request an introduction.",
      "From vendors that support hosting, storage, communications, analytics, security, identity verification, or advertising measurement.",
    ],
    subsections: [
      {
        subtitle: "Lead Forms and First-Party Collection",
        paragraphs: [
          "Information you submit through a WindowMan website form is collected directly by WindowMan. Information you elect to submit through a Meta Instant Form or another advertising-platform lead form is collected by that platform and transferred to WindowMan; after WindowMan receives it, WindowMan processes it as first-party lead information under this Privacy Policy.",
          "The privacy policy or consent language linked from a form supplements, and does not replace, the disclosures and choices presented at the point of collection.",
        ],
      },
    ],
  },
  {
    id: "use",
    title: "4. How We Use Information",
    paragraphs: ["We may use information to:"],
    bullets: [
      "Provide quote analysis and educational insights.",
      "Extract, organize, classify, and evaluate quote information.",
      "Generate WindowMan reports.",
      "Identify missing, unclear, or potentially concerning quote terms.",
      "Compare project information with market or pricing benchmarks.",
      "Deliver verification codes and service-related communications.",
      "Provide customer support.",
      "Maintain account and session continuity.",
      "Process privacy requests.",
      "Detect abuse, fraud, security threats, and service errors.",
      "Improve product reliability and user experience.",
      "Measure advertising and campaign performance.",
      "Attribute leads and conversions to advertising campaigns.",
      "Prevent duplicate event reporting.",
      "Maintain internal records.",
      "Enforce our agreements.",
      "Comply with legal obligations.",
      "Facilitate contractor introductions only when you provide the required authorization.",
    ],
    subsections: [
      {
        subtitle: "Purpose Limitation for Advertising-Platform Leads",
        paragraphs: [
          "WindowMan uses Lead Generation Data received through Meta or another advertising platform to provide, follow up on, and measure the service or offer described at the point of collection. If WindowMan wants to use that information for a materially different purpose, we will obtain any additional consent required by applicable law and the terms presented to you.",
        ],
      },
    ],
  },
  {
    id: "ai",
    title: "5. AI and Document Processing",
    paragraphs: [
      "When you upload a quote or related document, WindowMan may transmit the document or portions of its contents to contracted artificial-intelligence processing providers, including the Google Gemini API.",
      "We use AI processing to:",
    ],
    bullets: [
      "Identify document type.",
      "Extract text and line-item information.",
      "Organize pricing and specifications.",
      "Detect missing or unclear information.",
      "Assist in generating the WindowMan analysis.",
    ],
    subsections: [
      {
        subtitle: "",
        paragraphs: [
          "AI-generated extraction and analysis may contain errors, omissions, or incorrect interpretations.",
          "WindowMan reports are informational decision-support tools. They are not: engineering reports; building inspections; legal advice; financial advice; insurance advice; public-adjusting services; licensed professional opinions; or guarantees of contractor pricing, code compliance, product performance, or project outcome.",
          "You should verify important information with the appropriate licensed professional, government authority, product manufacturer, or contractor.",
          "Our use of AI providers is governed by the service configuration, contractual terms, and data-processing terms applicable to those providers.",
        ],
      },
    ],
  },
  {
    id: "analytics",
    title: "6. Analytics, Advertising, and Attribution",
    paragraphs: [
      "WindowMan uses analytics and advertising-measurement technologies to understand website activity, attribute advertising campaigns, measure lead outcomes, prevent duplicate reporting, and improve campaign performance.",
      "These technologies may include:",
    ],
    bullets: [
      "Google Tag Manager.",
      "Meta Pixel.",
      "Meta Conversions API.",
      "Campaign and click identifiers.",
      "Browser storage.",
      "Server-side event processing.",
      "Other analytics or advertising tools configured through our tag-management system.",
    ],
    subsections: [
      {
        subtitle: "Browser Attribution Storage",
        paragraphs: [
          "WindowMan may store campaign, referral, and advertising-attribution information in your browser's local storage for up to 30 days.",
          "This information may include: UTM parameters; landing-page information; referring URLs; advertising click identifiers; campaign identifiers; and browser advertising identifiers.",
        ],
      },
      {
        subtitle: "Meta Pixel",
        paragraphs: [
          "Where enabled, the Meta Pixel may receive page-view and browser information for advertising attribution and measurement.",
        ],
      },
      {
        subtitle: "Meta Conversions API",
        paragraphs: [
          "WindowMan may use Meta's server-side Conversions API to report advertising events.",
          "Information transmitted for conversion measurement may include: event name; event time; page or source URL; Meta browser identifiers such as _fbp and _fbc; Internet Protocol address; user-agent information; hashed email address; hashed telephone number; hashed or pseudonymous external identifiers; and a deduplication event identifier.",
          "Contact identifiers are cryptographically hashed before transmission through the server-side conversion process. Hashing is a security transformation and does not necessarily make information anonymous under every privacy law.",
        ],
      },
      {
        subtitle: "Server-Side Processing and Stape",
        paragraphs: [
          "Where configured, WindowMan may route website and server event data through Stape, a server-side tag-management and infrastructure provider, before sending permitted measurement events to platforms such as Meta.",
          "Server-side processing is used to validate, route, secure, and deduplicate measurement events. It does not eliminate applicable notice, consent, opt-out, or platform-policy requirements.",
        ],
      },
      {
        subtitle: "Google Tag Manager",
        paragraphs: [
          "Google Tag Manager is used to manage website tags. Tags configured through the container may process website, analytics, attribution, or advertising information depending on the production configuration.",
        ],
      },
    ],
  },
  {
    id: "disclose",
    title: "7. How We Disclose Information",
    paragraphs: ["We may disclose information to the following categories of recipients."],
    subsections: [
      {
        subtitle: "Service Providers",
        bullets: [
          "Host the website and application.",
          "Store uploaded files.",
          "Process documents.",
          "Provide artificial-intelligence extraction.",
          "Send email or text messages.",
          "Verify telephone numbers.",
          "Provide analytics or advertising measurement.",
          "Operate server-side tag management and event delivery, including through Stape where configured.",
          "Maintain security and prevent fraud.",
          "Provide customer support.",
          "Operate databases and infrastructure.",
        ],
        paragraphs: [
          "These providers may process information only for the services they provide to WindowMan, subject to applicable contracts and legal requirements.",
        ],
      },
      {
        subtitle: "Advertising and Measurement Providers",
        paragraphs: [
          "We may disclose limited website, attribution, campaign, device, event, and hashed contact information to advertising and measurement providers for campaign attribution and conversion measurement.",
          "Third parties, including Meta, may collect or receive this information and use it to provide measurement services and, where permitted, to support ad delivery or personalization. You may use the privacy and advertising controls offered by those platforms and may submit an applicable opt-out request using the contact information below.",
        ],
      },
      {
        subtitle: "Legal, Security, and Business Requirements",
        bullets: [
          "Comply with law, legal process, or a valid government request.",
          "Protect the rights, safety, or property of WindowMan, users, or others.",
          "Detect or investigate fraud, abuse, or security incidents.",
          "Enforce agreements.",
          "Complete a financing, merger, acquisition, reorganization, or sale of business assets, subject to applicable legal requirements.",
        ],
      },
    ],
  },
  {
    id: "contractor",
    title: "8. Contractor Introductions and Referral Fees",
    paragraphs: [
      "WindowMan does not send your uploaded quote back to the contractor who issued it as part of the standard quote-review process.",
      "We do not disclose your contact information or project information to a matched contractor unless you affirmatively authorize a contractor introduction.",
      "When you authorize an introduction, we may disclose limited information such as: your name; your contact information; property or service-area information; project details; window and door specifications; and relevant quote or scope information.",
      "We will not provide the complete uploaded document to a matched contractor unless you separately and explicitly authorize that disclosure.",
      "WindowMan may receive a referral fee, marketing fee, success fee, or other compensation from an introduced contractor if you engage that contractor.",
      "You are not required to accept an introduction or hire an introduced contractor to use WindowMan's quote-review service.",
    ],
  },
  {
    id: "sale",
    title: "9. Sale, Sharing, and Data Brokers",
    paragraphs: [
      "WindowMan does not sell Meta Lead Generation Data under any circumstances. WindowMan also does not sell uploaded quote documents or personal contact information to data brokers.",
      "WindowMan does not voluntarily transfer lead information except to service providers that help fulfill the purpose for which it was collected, or to a contractor when you affirmatively authorize that introduction. We require recipients to use the information only for the permitted purpose and subject to applicable contractual and legal requirements.",
      "Some state privacy laws define \"sale,\" \"sharing,\" or targeted advertising broadly enough to include certain advertising-measurement or cross-context advertising activities.",
      "Where applicable law provides an opt-out right, you may submit a request using the contact information in this Privacy Policy.",
    ],
  },
  {
    id: "communications",
    title: "10. Communications",
    subsections: [
      {
        subtitle: "Service Communications",
        paragraphs: [
          "When you request a quote review or create a WindowMan lead record, we may contact you about: identity or telephone verification; quote-upload status; report availability; requested customer support; account or security matters; and contractor help that you specifically requested.",
          "These communications are related to the service you requested.",
          "Submitting a WindowMan website form or Meta Instant Form authorizes WindowMan to use the contact information you provide to respond to that request and deliver related service communications. That service authorization does not by itself enroll you in unrelated promotional marketing.",
        ],
      },
      {
        subtitle: "Marketing Communications",
        paragraphs: [
          "When a form separately requests marketing consent and you provide it, WindowMan may contact you by email, telephone, or SMS/text message, including with automated technology when that is disclosed at the point of collection. Consent to marketing communications is not a condition of purchasing goods or services.",
          "We will send promotional email, telephone, or text-message communications only when we have the consent required by applicable law and will honor the scope of the consent presented to you.",
          "You may opt out of: marketing email by using the unsubscribe link; marketing text messages by replying STOP; and marketing calls by asking us to place you on our internal do-not-call list.",
          "Opting out of marketing does not prevent necessary service, verification, security, or transactional communications.",
          "Message and data rates may apply. Message frequency may vary.",
        ],
      },
    ],
  },
  {
    id: "retention-intro",
    title: "11. Data Retention",
    paragraphs: [
      "We retain information only for as long as reasonably necessary for the purpose for which it was collected, subject to legal, security, contractual, dispute-resolution, and operational requirements.",
    ],
  },
  {
    id: "security",
    title: "12. Security",
    paragraphs: [
      "WindowMan maintains reasonable administrative, technical, and organizational safeguards designed to protect information against unauthorized access, loss, misuse, alteration, or disclosure.",
      "Safeguards may include: encryption in transit; encryption at rest where supported; private, access-controlled file storage; authentication and authorization controls; restricted database access; logging and monitoring; server-side processing controls; file-type and file-size restrictions; and security and fraud-prevention measures.",
      "No internet transmission, storage platform, database, or security system can be guaranteed to be completely secure.",
    ],
  },
  {
    id: "rights",
    title: "13. Your Privacy Rights and Choices",
    paragraphs: [
      "Depending on where you live and which laws apply, you may have the right to request: confirmation that we process information about you; access to information about you; correction of inaccurate information; deletion of certain information; a portable copy of certain information; information about categories of information collected; information about categories of recipients; opt-out from certain advertising, sale, sharing, or targeted-advertising activities; withdrawal of consent for future processing where consent is the applicable basis; and appeal of certain privacy-request decisions where required by law.",
      "To submit a request, email support@windowman.app with the subject line \"Privacy Request.\" Your request should identify your name, the email address or telephone number used with WindowMan, the right you want to exercise, and any information reasonably necessary to locate the relevant record.",
      "We may take reasonable steps to verify your identity before completing a request.",
      "Where applicable, an authorized agent may submit a request on your behalf. We may request evidence of the agent's authority and may independently verify your identity.",
      "We will respond within the period required by applicable law.",
      "We will not unlawfully discriminate against you for exercising an applicable privacy right.",
    ],
  },
  {
    id: "dnt",
    title: "14. Browser Privacy Signals",
    paragraphs: [
      "Some browsers offer \"Do Not Track\" signals.",
      "Because there is no uniform technical standard for Do Not Track, WindowMan does not currently respond to Do Not Track browser signals.",
      "You may use browser, device, advertising-platform, and account controls to limit cookies or advertising identifiers. You may also submit a privacy request directly to WindowMan.",
    ],
  },
  {
    id: "children",
    title: "15. Children's Privacy",
    paragraphs: [
      "WindowMan is not directed to children under 13.",
      "We do not knowingly collect personal information from children under 13.",
      "If you believe a child has provided personal information to WindowMan, contact us at support@windowman.app.",
    ],
  },
  {
    id: "third-party",
    title: "16. Third-Party Websites and Services",
    paragraphs: [
      "The service may contain links to websites, platforms, or services operated by third parties.",
      "WindowMan does not control the privacy practices of those third parties. Their processing is governed by their own policies and terms.",
    ],
  },
  {
    id: "changes",
    title: "17. Changes to This Privacy Policy",
    paragraphs: [
      "We may update this Privacy Policy when our services, technology, vendors, legal obligations, or data practices change.",
      "When we make changes, we will update the \"Last Reviewed\" date.",
      "If a change materially affects how we use information already collected, we will provide any additional notice required by applicable law.",
      "Continued use of the service does not replace any consent required by law.",
    ],
  },
  {
    id: "contact",
    title: "18. Contact Information",
    paragraphs: [
      "Brand: WindowMan",
      "Privacy Email: support@windowman.app",
      "Website: https://windowman.app",
    ],
  },
];

export const privacyRetentionFollowUpParagraphs: string[] = [
  "We may retain limited information after a deletion request when necessary to: comply with law; complete a transaction requested by you; detect fraud or security incidents; exercise or defend legal claims; enforce agreements; maintain an opt-out or suppression record; or protect the integrity of the service.",
];
