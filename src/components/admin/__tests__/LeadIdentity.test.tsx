import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadIdentity } from "@/components/admin/LeadIdentity";

const leadId = "0621be04-8984-4087-8cec-324e0efd25d4";

describe("LeadIdentity", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the complete UUID even when the visible value is compact", async () => {
    render(<LeadIdentity leadId={leadId} />);
    expect(screen.getByText("Lead ID: 0621be04…")).toHaveAttribute("title", leadId);
    fireEvent.click(screen.getByRole("button", { name: `Copy lead ID ${leadId}` }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(leadId));
    expect(screen.getByRole("status")).toHaveTextContent("Lead ID copied");
  });

  it("surfaces clipboard failure without losing the identifier", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard blocked"));
    render(<LeadIdentity leadId={leadId} full />);
    fireEvent.click(screen.getByRole("button", { name: `Copy lead ID ${leadId}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy lead ID");
    expect(screen.getByText(`Lead ID: ${leadId}`)).toBeInTheDocument();
  });
});
