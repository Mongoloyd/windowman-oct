import { describe, expect, it } from "vitest";
import { resolveGoogleClickIdentifiers } from "../resolveGoogleClickIdentifiers";

describe("resolveGoogleClickIdentifiers", () => {
  it("prefers identity over attribution and query_params", () => {
    const resolved = resolveGoogleClickIdentifiers({
      identity: { gclid: "identity-gclid", gbraid: "identity-gbraid", wbraid: "identity-wbraid" },
      attribution: { gclid: "attr-gclid", gbraid: "attr-gbraid", wbraid: "attr-wbraid" },
      queryParams: { gclid: "query-gclid", gbraid: "query-gbraid", wbraid: "query-wbraid" },
    });

    expect(resolved).toEqual({
      gclid: "identity-gclid",
      gbraid: "identity-gbraid",
      wbraid: "identity-wbraid",
    });
  });

  it("falls back to attribution when identity is missing click IDs", () => {
    const resolved = resolveGoogleClickIdentifiers({
      identity: { leadId: "lead-1" },
      attribution: {
        gclid: "attr-gclid",
        gbraid: "attr-gbraid",
        wbraid: "attr-wbraid",
      },
    });

    expect(resolved).toEqual({
      gclid: "attr-gclid",
      gbraid: "attr-gbraid",
      wbraid: "attr-wbraid",
    });
  });

  it("falls back to query_params when identity and attribution are missing", () => {
    const resolved = resolveGoogleClickIdentifiers({
      identity: {},
      attribution: {},
      queryParams: {
        gclid: "query-gclid",
        gbraid: "query-gbraid",
        wbraid: "query-wbraid",
      },
    });

    expect(resolved).toEqual({
      gclid: "query-gclid",
      gbraid: "query-gbraid",
      wbraid: "query-wbraid",
    });
  });

  it("returns empty object when no click IDs are present", () => {
    expect(resolveGoogleClickIdentifiers({ identity: {}, attribution: {}, queryParams: {} })).toEqual({});
  });
});
