import { z } from "zod";
import { isValidTruthGatePhone } from "@/lib/validation/truthGateContact";
import { isValidName } from "@/utils/formatPhone";

export const campaignNq2Schema = z.object({
  firstName: z
    .string()
    .trim()
    .refine(isValidName, "Enter your first name."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .refine(isValidTruthGatePhone, "Enter a valid U.S. phone number."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
});

export type CampaignNq2ValidatedFields = z.infer<typeof campaignNq2Schema>;
