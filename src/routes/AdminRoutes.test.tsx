import { Suspense, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminRoutes } from "./AdminRoutes";

const guardState = vi.hoisted(() => ({ allow: true }));

vi.mock("@/components/admin/AdminAuthGate", () => ({
  AdminAuthGate: ({ children }: { children: ReactNode }) =>
    guardState.allow
      ? <div data-testid="admin-auth-gate">{children}</div>
      : <div data-testid="admin-access-denied">Access denied</div>,
}));

vi.mock("@/pages/admin/MetaIntakeLab.tsx", () => ({
  default: () => <div data-testid="meta-intake-lab">Meta Intake Lab</div>,
}));

describe("AdminRoutes Meta Intake Lab route", () => {
  beforeEach(() => {
    guardState.allow = true;
  });

  it("renders the lab inside the existing admin auth gate", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/meta-intake-lab"]}>
        <Suspense fallback={<div>Loading route…</div>}>
          <Routes>
            <Route path="/admin/*" element={<AdminRoutes />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    const lab = await screen.findByTestId("meta-intake-lab");
    expect(screen.getByTestId("admin-auth-gate")).toContainElement(lab);
  });

  it("does not render the lab when the admin auth gate denies access", async () => {
    guardState.allow = false;
    render(
      <MemoryRouter initialEntries={["/admin/meta-intake-lab"]}>
        <Suspense fallback={<div>Loading route…</div>}>
          <Routes>
            <Route path="/admin/*" element={<AdminRoutes />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-access-denied")).toBeInTheDocument();
    expect(screen.queryByTestId("meta-intake-lab")).not.toBeInTheDocument();
  });
});
