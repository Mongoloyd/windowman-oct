import { describe, expect, it } from "vitest";
import {
  PROPHECY_CANONICAL_URL,
  PROPHECY_DESCRIPTION,
  PROPHECY_METADATA,
  PROPHECY_ROBOTS,
  PROPHECY_SOCIAL_IMAGE,
  PROPHECY_TITLE,
  PROPHECY_TWITTER_CARD,
} from "./prophecyMetadata";

describe("prophecyMetadata", () => {
  it("exposes one shared title and description for Helmet and prerender", () => {
    expect(PROPHECY_METADATA.title).toBe(PROPHECY_TITLE);
    expect(PROPHECY_METADATA.description).toBe(PROPHECY_DESCRIPTION);
    expect(PROPHECY_METADATA.openGraph.title).toBe(PROPHECY_TITLE);
    expect(PROPHECY_METADATA.openGraph.description).toBe(PROPHECY_DESCRIPTION);
    expect(PROPHECY_METADATA.twitter.title).toBe(PROPHECY_TITLE);
    expect(PROPHECY_METADATA.twitter.description).toBe(PROPHECY_DESCRIPTION);
  });

  it("uses the approved canonical URL and social image", () => {
    expect(PROPHECY_CANONICAL_URL).toBe("https://windowman.app/prophecy");
    expect(PROPHECY_METADATA.canonicalUrl).toBe(PROPHECY_CANONICAL_URL);
    expect(PROPHECY_METADATA.openGraph.url).toBe(PROPHECY_CANONICAL_URL);
    expect(PROPHECY_SOCIAL_IMAGE).toBe("https://windowman.app/og-wman.png");
    expect(PROPHECY_METADATA.openGraph.image).toBe(PROPHECY_SOCIAL_IMAGE);
    expect(PROPHECY_METADATA.twitter.image).toBe(PROPHECY_SOCIAL_IMAGE);
  });

  it("sets robots and twitter card directives", () => {
    expect(PROPHECY_ROBOTS).toBe("index, follow");
    expect(PROPHECY_METADATA.robots).toBe(PROPHECY_ROBOTS);
    expect(PROPHECY_TWITTER_CARD).toBe("summary_large_image");
    expect(PROPHECY_METADATA.twitter.card).toBe(PROPHECY_TWITTER_CARD);
  });

  it("does not claim guaranteed savings or legal/contractor grading", () => {
    const blob = `${PROPHECY_TITLE} ${PROPHECY_DESCRIPTION}`.toLowerCase();
    expect(blob).not.toMatch(/guaranteed savings|legal review|contractor performance|grading/);
    expect(blob).toMatch(/independent/);
  });
});
