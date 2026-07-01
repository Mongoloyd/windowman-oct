import { isValidEmail, isValidName } from "@/utils/formatPhone";

export type TruthGateFieldStatus = "untouched" | "valid" | "invalid";

export function isValidTruthGatePhone(val: string): boolean {
  if (!val || val.trim() === "") return true;
  const digits = val.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;

  if (normalized.length !== 10) return false;
  if (normalized[0] === "0" || normalized[0] === "1") return false;
  if (/^(\d)\1{9}$/.test(normalized)) return false;
  if (normalized === "1234567890" || normalized === "0987654321") return false;

  return true;
}

export function normalizeTruthGatePhoneToE164(val: string): string | null {
  if (!val || val.trim() === "") return null;
  const digits = val.replace(/\D/g, "");

  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;

  return null;
}

export function formatTruthGatePhoneDisplay(val: string): string {
  const digits = val.replace(/\D/g, "");
  const local = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;

  if (local.length === 0) return "";
  if (local.length <= 3) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
}

export function validateTruthGateContactField(
  field: string,
  value: string,
): TruthGateFieldStatus {
  switch (field) {
    case "firstName":
      return isValidName(value) ? "valid" : "invalid";
    case "email":
      return isValidEmail(value) ? "valid" : "invalid";
    case "phone":
      if (!value || value.trim() === "") return "untouched";
      return isValidTruthGatePhone(value) ? "valid" : "invalid";
    default:
      return "untouched";
  }
}

export function validateTruthGateContact(fields: {
  firstName: string;
  email: string;
  phone: string;
}): {
  valid: boolean;
  fieldStatus: Record<string, TruthGateFieldStatus>;
} {
  const nameValid = isValidName(fields.firstName);
  const emailValid = isValidEmail(fields.email);
  const phoneValid = isValidTruthGatePhone(fields.phone);

  return {
    valid: nameValid && emailValid && phoneValid,
    fieldStatus: {
      firstName: nameValid ? "valid" : "invalid",
      email: emailValid ? "valid" : "invalid",
      phone:
        fields.phone.trim() === ""
          ? "untouched"
          : phoneValid
            ? "valid"
            : "invalid",
    },
  };
}
