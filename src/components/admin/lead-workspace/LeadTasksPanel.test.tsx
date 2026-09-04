import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadTasksPanel } from "./LeadTasksPanel";

const listLeadTasks = vi.fn();
const createLeadTask = vi.fn();
const updateLeadTask = vi.fn();
const deleteLeadTask = vi.fn();

vi.mock("@/services/adminDataService", () => ({
  listLeadTasks: (...args: unknown[]) => listLeadTasks(...args),
  createLeadTask: (...args: unknown[]) => createLeadTask(...args),
  updateLeadTask: (...args: unknown[]) => updateLeadTask(...args),
  deleteLeadTask: (...args: unknown[]) => deleteLeadTask(...args),
  getErrorMessage: (error: unknown) => String(error),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LeadTasksPanel leadId="lead-1" />
    </QueryClientProvider>,
  );
}

describe("LeadTasksPanel", () => {
  beforeEach(() => {
    listLeadTasks.mockReset();
    createLeadTask.mockReset();
    updateLeadTask.mockReset();
    deleteLeadTask.mockReset();
    listLeadTasks.mockResolvedValue([]);
    createLeadTask.mockResolvedValue({});
  });

  it("provides persistent labels and submits the task title", async () => {
    renderPanel();
    const title = screen.getByRole("textbox", { name: "Task" });
    expect(screen.getByLabelText("Due date and time")).toHaveAttribute("type", "datetime-local");

    fireEvent.change(title, { target: { value: "Call homeowner" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(createLeadTask).toHaveBeenCalledWith({
      lead_id: "lead-1",
      title: "Call homeowner",
      due_at: null,
    }));
  });

  it("exposes named toggle and delete actions", async () => {
    listLeadTasks.mockResolvedValue([{
      id: "task-1",
      lead_id: "lead-1",
      title: "Review quote",
      details: null,
      due_at: null,
      completed: false,
      completed_at: null,
      completed_by: null,
      assigned_to: null,
      created_by: null,
      created_by_email: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }]);
    renderPanel();

    expect(await screen.findByRole("button", { name: "Mark task complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete task" })).toBeInTheDocument();
  });
});
