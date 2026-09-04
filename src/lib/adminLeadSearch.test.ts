import { describe, expect, it } from "vitest";
import { matchesAdminLeadSearch } from "@/lib/adminLeadSearch";

const lead = {
  id: "0621be04-8984-4087-8cec-324e0efd25d4",
  session_id: "9a21be04-8984-4087-8cec-324e0efd25d4",
  first_name: "Jane",
  last_name: "Doe",
  email: "Jane.Doe@example.com",
  phone_e164: "+13055551234",
  county: "Miami-Dade",
  city: "Miami",
  state: "FL",
  zip: "33101",
};

describe("matchesAdminLeadSearch", () => {
  it.each([
    "jane",
    "DOE",
    "Jane Doe",
    "doe jane",
    "jane.doe@example.com",
    "0621be04",
    "0621be04-8984-4087-8cec-324e0efd25d4",
    "9a21be04",
    "Miami-Dade",
    "33101",
  ])("matches text and identifiers for %s", (query) => {
    expect(matchesAdminLeadSearch(lead, query)).toBe(true);
  });

  it.each(["3055551234", "(305) 555-1234", "555-1234"])(
    "normalizes phone search for %s",
    (query) => {
      expect(matchesAdminLeadSearch(lead, query)).toBe(true);
    },
  );

  it("supports projection-specific values without changing shared semantics", () => {
    expect(matchesAdminLeadSearch(lead, "quote holder", ["Quote Holder"])).toBe(true);
  });

  it("does not match unrelated input", () => {
    expect(matchesAdminLeadSearch(lead, "Alex Rivera")).toBe(false);
  });
});
