import type { PhoneFunnelStatus } from "@/state/scanFunnel";

/** Funnel phone statuses that must survive a trusted loaded lead with no phone. */
export const FUNNEL_PHONE_STATUSES_PRESERVED_ON_HYDRATION: ReadonlySet<PhoneFunnelStatus> =
  new Set(["screened_valid", "sending_otp", "otp_sent", "verified", "send_failed"]);

export type LeadPhoneHydrationSource =
  | { kind: "unknown" }
  | { kind: "loaded"; phoneE164: string | null };

export type GatedFunnelPhone = {
  phoneE164: string | null;
  phoneStatus: PhoneFunnelStatus | undefined;
  /** True when funnel.scanSessionId matches the active report scan session. */
  isSessionMatch: boolean;
};

/**
 * Gate funnel phone/status to the active scan session.
 * If funnel.scanSessionId is unset, do not hide phone (UploadZone may not have written it yet).
 */
export function resolveGatedFunnelPhone(
  funnel:
    | {
        phoneE164: string | null;
        phoneStatus: PhoneFunnelStatus;
        scanSessionId: string | null;
      }
    | null
    | undefined,
  activeScanSessionId: string | null | undefined,
): GatedFunnelPhone {
  if (!funnel) {
    return { phoneE164: null, phoneStatus: undefined, isSessionMatch: true };
  }

  const funnelScanSessionId = funnel.scanSessionId;
  const isSessionMatch =
    !funnelScanSessionId ||
    !activeScanSessionId ||
    funnelScanSessionId === activeScanSessionId;

  if (!isSessionMatch) {
    return { phoneE164: null, phoneStatus: undefined, isSessionMatch: false };
  }

  return {
    phoneE164: funnel.phoneE164,
    phoneStatus: funnel.phoneStatus,
    isSessionMatch: true,
  };
}

/**
 * Apply lead hydration only from a trusted lead-read outcome.
 * Unknown reads must never clear or mutate funnel phone/status.
 */
export function applyLeadPhoneHydration(args: {
  lead: LeadPhoneHydrationSource;
  funnelPhoneE164: string | null;
  funnelPhoneStatus: PhoneFunnelStatus;
  setPhone: (e164: string, status: PhoneFunnelStatus) => void;
}): void {
  const { lead, funnelPhoneE164, funnelPhoneStatus, setPhone } = args;

  if (lead.kind === "unknown") {
    return;
  }

  if (lead.phoneE164) {
    if (!funnelPhoneE164) {
      setPhone(lead.phoneE164, "screened_valid");
    }
    return;
  }

  if (FUNNEL_PHONE_STATUSES_PRESERVED_ON_HYDRATION.has(funnelPhoneStatus)) {
    return;
  }

  if (funnelPhoneE164 && funnelPhoneStatus === "none") {
    setPhone("", "none");
  }
}
