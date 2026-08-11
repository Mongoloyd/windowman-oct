import { z } from "zod";
import { isValidName } from "@/utils/formatPhone";
import {
  isValidTruthGatePhone,
  normalizeTruthGatePhoneToE164,
} from "@/lib/validation/truthGateContact";

export const campaignNqSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .refine(isValidName, "Enter your first name."),
    phone: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.length > 0 &&
          isValidTruthGatePhone(value) &&
          normalizeTruthGatePhoneToE164(value) !== null,
        "Enter a valid 10-digit phone number.",
      ),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address."),
  })
  .transform(({ firstName, phone, email }) => ({
    firstName,
    phoneE164: normalizeTruthGatePhoneToE164(phone) ?? "",
    email: email.toLowerCase(),
  }));

export type CampaignNqValidatedFields = z.infer<typeof campaignNqSchema>;
