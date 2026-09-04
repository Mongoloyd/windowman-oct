import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MetaIntakeLab from "./MetaIntakeLab";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock("@/lib/devSecret", () => ({ peekDevSecret: () => null }));

vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/admin/shell/AdminGlobalNav", () => ({
  AdminGlobalNav: () => <nav aria-label="Admin navigation" />,
}));

const replayResult = {
  recognized_fields: [{
    original_key: "email",
    question_label: "email",
    canonical_key: "email",
    sanitized_value: "lead@example.com",
  }],
  unknown_fields: [{
    original_key: "how_many_openings",
    question_label: "How many openings?",
    original_value: ["6-10"],
  }],
  missing_required_fields: ["phone"],
  normalized_lead: {
    platform_lead_id: "lead-1",
    email: "lead@example.com",
    phone_e164: null,
  },
  validation_errors: [],
  form_id: "form-1",
  platform_lead_id: "lead-1",
  source_shape: "direct_object",
  dedup_decision: { action: "create", reason: "no_existing_identity_match" },
  mapping_options: [{
    canonical_key: "qualification_openings",
    label: "Openings qualification bucket",
    destination: "qualification",
  }],
  can_save_mappings: true,
  is_test: true,
  lead_persistence_suppressed: true,
  calling_suppressed: true,
  crm_delivery_suppressed: true,
  writes_performed: [],
};

function queueReplay(result = replayResult) {
  mocks.invoke.mockResolvedValueOnce({
    data: { ok: true, result },
    error: null,
  });
}

async function renderAndReplay(result = replayResult) {
  queueReplay(result);
  render(<MetaIntakeLab />);
  fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));
  await screen.findByText("Replay completed safely");
}

describe("MetaIntakeLab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "admin-token" } },
      error: null,
    });
  });

  describe("unknown field mapping workflow", () => {
    it("highlights unknown fields and separates map-or-ignore from the canonical key", async () => {
      await renderAndReplay();

      const unknownField = screen.getByText("how_many_openings").closest("article");
      expect(unknownField).toHaveClass("border-red-300");
      expect(screen.getByText('["6-10"]')).toBeInTheDocument();

      const action = screen.getByLabelText("Mapping action");
      const canonicalKey = screen.getByLabelText("Canonical destination");
      expect(canonicalKey).toBeDisabled();

      fireEvent.change(action, { target: { value: "map" } });
      expect(canonicalKey).toBeEnabled();

      fireEvent.change(action, { target: { value: "ignore" } });
      expect(canonicalKey).toBeDisabled();
      expect(canonicalKey).toHaveValue("");
      expect(screen.getByRole("button", { name: "Save decision" })).toBeEnabled();
    });

    it("saves an allowlisted suggestion through the authenticated Edge Function and clears the form", async () => {
      mocks.invoke
        .mockResolvedValueOnce({ data: { ok: true, result: replayResult }, error: null })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            mapping: {
              form_id: "form-1",
              question_label: "How many openings?",
              canonical_key: "qualification_openings",
            },
          },
          error: null,
        });

      render(<MetaIntakeLab />);
      fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));
      await screen.findByText("Replay completed safely");

      const action = screen.getByLabelText("Mapping action");
      const canonicalKey = screen.getByLabelText("Canonical destination");
      fireEvent.change(action, { target: { value: "map" } });
      fireEvent.change(canonicalKey, {
        target: { value: "qualification_openings" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save decision" }));

      expect(
        await screen.findByText("Saved mapping to qualification_openings."),
      ).toBeInTheDocument();
      expect(mocks.invoke).toHaveBeenNthCalledWith(
        2,
        "meta-intake-replay",
        expect.objectContaining({
          body: {
            action: "save_mapping",
            form_id: "form-1",
            question_label: "How many openings?",
            mapping_action: "map",
            canonical_key: "qualification_openings",
          },
        }),
      );
      expect(action).toHaveValue("");
      expect(canonicalKey).toHaveValue("");
      expect(canonicalKey).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save decision" })).toBeDisabled();
    });

    it("saves ignore with a null canonical key", async () => {
      mocks.invoke
        .mockResolvedValueOnce({ data: { ok: true, result: replayResult }, error: null })
        .mockResolvedValueOnce({ data: { ok: true, mapping: {} }, error: null });

      render(<MetaIntakeLab />);
      fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));
      await screen.findByText("Replay completed safely");
      fireEvent.change(screen.getByLabelText("Mapping action"), {
        target: { value: "ignore" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save decision" }));

      expect(
        await screen.findByText("Saved as ignored for this form."),
      ).toBeInTheDocument();
      expect(mocks.invoke).toHaveBeenNthCalledWith(
        2,
        "meta-intake-replay",
        expect.objectContaining({
          body: expect.objectContaining({
            action: "save_mapping",
            mapping_action: "ignore",
            canonical_key: null,
          }),
        }),
      );
    });

    it("keeps mapping controls replay-only for a viewer", async () => {
      await renderAndReplay({ ...replayResult, can_save_mappings: false });

      expect(screen.getByText(/Viewer access is replay-only/)).toBeInTheDocument();
      expect(screen.getByLabelText("Mapping action")).toBeDisabled();
      expect(screen.getByLabelText("Canonical destination")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save decision" })).toBeDisabled();
    });
  });

  describe("error and loading states", () => {
    it("keeps invalid fixture text recoverable and does not invoke the function", async () => {
      render(<MetaIntakeLab />);
      const fixture = screen.getByLabelText("Meta fixture JSON");
      fireEvent.change(fixture, { target: { value: "{ invalid" } });
      fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Fixture JSON is invalid");
      expect(fixture).toHaveValue("{ invalid");
      expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it("shows a user-friendly server error", async () => {
      mocks.invoke.mockResolvedValueOnce({
        data: null,
        error: {
          context: new Response(
            JSON.stringify({ error: "Replay service is temporarily unavailable." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          ),
        },
      });

      render(<MetaIntakeLab />);
      fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Replay service is temporarily unavailable.",
      );
    });

    it("explains when the Edge Function is not deployed", async () => {
      mocks.invoke.mockResolvedValueOnce({
        data: null,
        error: { context: new Response(null, { status: 404 }) },
      });

      render(<MetaIntakeLab />);
      fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Function not found. Deploy meta-intake-replay and try again.",
      );
    });

    it("disables replay and shows progress while analysis is pending", async () => {
      let resolveInvoke: ((value: unknown) => void) | null = null;
      mocks.invoke.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
      );

      render(<MetaIntakeLab />);
      fireEvent.click(screen.getByRole("button", { name: "Replay fixture" }));

      expect(screen.getByRole("button", { name: "Replaying…" })).toBeDisabled();
      expect(
        screen.getByText(/Running the shared normalizer and read-only duplicate check/),
      ).toBeInTheDocument();

      await act(async () => {
        resolveInvoke?.({ data: { ok: true, result: replayResult }, error: null });
      });
      expect(await screen.findByText("Replay completed safely")).toBeInTheDocument();
    });
  });

  describe("read-only presentation", () => {
    it("shows suppression proof and no lead, calling, or CRM action controls", async () => {
      await renderAndReplay();

      expect(screen.getByText("Lead writes suppressed: confirmed")).toBeInTheDocument();
      expect(screen.getByText("Calling suppressed: confirmed")).toBeInTheDocument();
      expect(screen.getByText("CRM delivery suppressed: confirmed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /create lead/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /call lead/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /sync.*crm/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /save/i })).toHaveLength(1);
    });
  });
});
