import { describe, expect, it } from "vitest";
import app from "@/App.tsx?raw";
import viewer from "@/pages/SyntheticDemoViewer.tsx?raw";

const source = Object.entries(import.meta.glob<string>("/src/components/synthetic-demo/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }));
describe("synthetic demo dependency and measurement boundaries", () => {
  it("has no router, host page, host submitter, uploader or authorization imports anywhere in the package", () => {
    for (const [name, contents] of source) {
      expect(contents, name).not.toMatch(/(?:from\s*|import\s*\()\s*["'][^"']*(?:react-router|next\/navigation|CampaignProphecy|CampaignNQ3|CampaignNQ4|UploadZone|campaign.*LeadCapture|reportService)/);
      expect(contents, name).not.toMatch(/\b(?:useLocation|useParams|useNavigate|useRouter)\b/);
    }
  });
  it("cannot emit scanner/report events, analytics or PII logs from demo interactions", () => {
    for (const [name, contents] of source.filter(([file]) => !file.includes(".test."))) {
      expect(contents, name).not.toMatch(/\b(?:trackEvent|trackConversion|pushV3BusinessEvent|dataLayer|console\.(?:log|info|error|warn)|full_json|scan_initiated|quote_uploaded|teaser_viewed|phone_verified|report_revealed)\b/);
      expect(contents, name).not.toMatch(/\.functions\.invoke|supabase\./);
      expect(contents, name).not.toMatch(/@ts-nocheck|:\s*any\b|\bas\s+any\b/);
    }
  });
  it("registers just the requested visual route, with a memory-only viewer", () => {
    expect(app).toContain('path="/visual/synthetic-demo/:variant"');
    expect(app).not.toContain('path="/demo/:variant"');
    expect(viewer).toContain("createMemoryCaptureClient");
    expect(viewer).not.toMatch(/supabase|productionCaptureClient|capturePowerToolDemoLead/);
  });
});
