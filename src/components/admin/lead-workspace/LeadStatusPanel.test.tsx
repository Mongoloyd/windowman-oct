import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LeadStatusPanel } from "./LeadStatusPanel";

const updateLeadFunnelStage = vi.fn();
const toast = vi.fn();

vi.mock("@/services/adminDataService", () => ({
  updateLeadFunnelStage: (...args: unknown[]) => updateLeadFunnelStage(...args),
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children?: ReactNode;
  }) => (
    <div data-disabled={disabled || undefined}>
      <select
        id="lead-funnel-stage"
        aria-label="Move lead to stage"
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      >
        <option value="new">New</option>
        <option value="qualified">Qualified</option>
        <option value="contacted">Contacted</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => children,
  SelectItem: () => null,
}));

function renderPanel(currentStage = "new") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <LeadStatusPanel leadId="lead-1" currentStage={currentStage} />
    </QueryClientProvider>,
  );
  return { queryClient, invalidate };
}

describe("LeadStatusPanel", () => {
  beforeEach(() => {
    updateLeadFunnelStage.mockReset();
    toast.mockReset();
  });

  it("uses one labeled mutation control and ignores the current stage", () => {
    renderPanel();
    const select = screen.getByRole("combobox", { name: "Move lead to stage" });

    fireEvent.change(select, { target: { value: "new" } });

    expect(updateLeadFunnelStage).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("mutates once, locks while pending, and preserves all invalidations", async () => {
    let resolve!: (value: unknown) => void;
    updateLeadFunnelStage.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { invalidate } = renderPanel();
    const select = screen.getByRole("combobox", { name: "Move lead to stage" });

    fireEvent.change(select, { target: { value: "qualified" } });

    await waitFor(() => expect(updateLeadFunnelStage).toHaveBeenCalledTimes(1));
    expect(updateLeadFunnelStage).toHaveBeenCalledWith("lead-1", "qualified");
    await waitFor(() => expect(select).toBeDisabled());
    fireEvent.change(select, { target: { value: "contacted" } });
    expect(updateLeadFunnelStage).toHaveBeenCalledTimes(1);

    resolve({ id: "lead-1", funnel_stage: "qualified", updated_at: "2026-01-01" });
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "lead-detail", "lead-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "lead-events", "lead-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "leads"] });
  });

  it("keeps error feedback visible and sends the destructive toast", async () => {
    updateLeadFunnelStage.mockRejectedValue(new Error("Stage update failed"));
    renderPanel();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "qualified" } });

    expect(await screen.findByText("Stage update failed")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Couldn't update stage",
      variant: "destructive",
    }));
  });
});
