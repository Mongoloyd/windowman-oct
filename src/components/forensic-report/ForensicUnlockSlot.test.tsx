import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForensicUnlockSlot from "./ForensicUnlockSlot";

const TRUST_COPY =
  "Your number is used to send a one-time verification code for this report. It does not enroll you in marketing messages or authorize contractor calls.";

describe("ForensicUnlockSlot verification disclosure", () => {
  it("adds truthful phone-use copy without changing the existing callbacks", () => {
    const onPhoneChange = vi.fn();
    const onPhoneSubmit = vi.fn();
    const onTcpaChange = vi.fn();

    render(
      <ForensicUnlockSlot
        gateMode="enter_phone"
        flagCount={12}
        otpValue=""
        onOtpChange={vi.fn()}
        onOtpSubmit={vi.fn()}
        onSendCode={vi.fn()}
        phoneDisplayValue="(561) 555-1212"
        phoneIsValid
        phoneDigitCount={10}
        onPhoneChange={onPhoneChange}
        onPhoneSubmit={onPhoneSubmit}
        tcpaConsent
        onTcpaChange={onTcpaChange}
        isLoading={false}
        errorMsg=""
        resendCooldown={0}
        onResend={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "View Your Full Quote Analysis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enter your mobile number to view the findings, supporting context, and the exact questions to ask before signing.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(TRUST_COPY)).toBeInTheDocument();
    expect(
      screen.getByText(
        "I agree to receive a one-time verification code via SMS. Msg & data rates may apply.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "(561) 555-1213" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send secure code" }));

    expect(onPhoneChange).toHaveBeenCalledTimes(1);
    expect(onTcpaChange).toHaveBeenCalledWith(false);
    expect(onPhoneSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps the phone gate disabled until its existing validity and consent requirements pass", () => {
    const baseProps = {
      gateMode: "enter_phone" as const,
      flagCount: 0,
      otpValue: "",
      onOtpChange: vi.fn(),
      onOtpSubmit: vi.fn(),
      onSendCode: vi.fn(),
      phoneDigitCount: 0,
      onPhoneChange: vi.fn(),
      onPhoneSubmit: vi.fn(),
      onTcpaChange: vi.fn(),
      isLoading: false,
      errorMsg: "",
      resendCooldown: 0,
      onResend: vi.fn(),
    };
    const { rerender } = render(
      <ForensicUnlockSlot
        {...baseProps}
        phoneDisplayValue=""
        phoneIsValid={false}
        tcpaConsent={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Send secure code" })).toBeDisabled();

    rerender(
      <ForensicUnlockSlot
        {...baseProps}
        phoneDisplayValue="(561) 555-1212"
        phoneIsValid
        phoneDigitCount={10}
        tcpaConsent
      />,
    );

    expect(screen.getByRole("button", { name: "Send secure code" })).toBeEnabled();
  });
});
