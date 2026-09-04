import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LeadNotesPanel } from "./LeadNotesPanel";

const listLeadNotes = vi.fn();
const createLeadNote = vi.fn();

vi.mock("@/services/adminDataService", () => ({
  listLeadNotes: (...args: unknown[]) => listLeadNotes(...args),
  createLeadNote: (...args: unknown[]) => createLeadNote(...args),
  deleteLeadNote: vi.fn(),
  getErrorMessage: (error: unknown) => String(error),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children?: ReactNode;
  }) => (
    <>
      <select
        aria-labelledby="lead-note-category-label"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        <option value="general">General</option>
        <option value="call_log">Call log</option>
      </select>
      {children}
    </>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => children,
  SelectItem: () => null,
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeadNotesPanel leadId="lead-1" />
    </QueryClientProvider>,
  );
}

describe("LeadNotesPanel", () => {
  beforeEach(() => {
    listLeadNotes.mockReset();
    createLeadNote.mockReset();
    listLeadNotes.mockResolvedValue([]);
    createLeadNote.mockResolvedValue({});
  });

  it("provides persistent labels and submits note content with its category", async () => {
    renderPanel();
    const note = screen.getByRole("textbox", { name: "Internal note" });
    const category = screen.getByRole("combobox", { name: "Category" });

    fireEvent.change(note, { target: { value: "Homeowner prefers afternoons" } });
    fireEvent.change(category, { target: { value: "call_log" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(createLeadNote).toHaveBeenCalledWith(
      "lead-1",
      "Homeowner prefers afternoons",
      "call_log",
    ));
  });
});
