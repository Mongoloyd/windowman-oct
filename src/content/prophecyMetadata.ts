/**
 * Shared Prophecy route metadata for runtime Helmet and static prerender.
 *
 * Describes the existing independent estimate-review campaign honestly.
 * Does not promise guaranteed savings, legal review, contractor grading,
 * or capabilities the /prophecy route does not provide.
 */

export const PROPHECY_CANONICAL_URL = "https://windowman.app/prophecy";

export const PROPHECY_TITLE =
  "WindowMan — We Can Tell You What's On Your Window Estimate";

export const PROPHECY_DESCRIPTION =
  "Free, independent review of a Florida window or door estimate — price, scope, fees, warranty and fine print. No estimate yet? We'll help you get a first one worth comparing.";

export const PROPHECY_SOCIAL_IMAGE = "https://windowman.app/og-wman.png";

export const PROPHECY_OG_TYPE = "website";
export const PROPHECY_OG_SITE_NAME = "WindowMan";
export const PROPHECY_ROBOTS = "index, follow";

export const PROPHECY_TWITTER_CARD = "summary_large_image";

export const PROPHECY_METADATA = {
  title: PROPHECY_TITLE,
  description: PROPHECY_DESCRIPTION,
  canonicalUrl: PROPHECY_CANONICAL_URL,
  socialImage: PROPHECY_SOCIAL_IMAGE,
  robots: PROPHECY_ROBOTS,
  openGraph: {
    type: PROPHECY_OG_TYPE,
    siteName: PROPHECY_OG_SITE_NAME,
    title: PROPHECY_TITLE,
    description: PROPHECY_DESCRIPTION,
    url: PROPHECY_CANONICAL_URL,
    image: PROPHECY_SOCIAL_IMAGE,
  },
  twitter: {
    card: PROPHECY_TWITTER_CARD,
    title: PROPHECY_TITLE,
    description: PROPHECY_DESCRIPTION,
    image: PROPHECY_SOCIAL_IMAGE,
  },
} as const;

export type ProphecyMetadata = typeof PROPHECY_METADATA;
