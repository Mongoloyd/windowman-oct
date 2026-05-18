import type { PhoneFunnelStatus } from "@/state/scanFunnel";

/** Funnel phone statuses that must survive ambiguous lead hydration reads. */
export const FUNNEL_PHONE_STATUSES_PRESERVED_ON_HYDRATION: ReadonlySet<PhoneFunnelStatus> =
  new Set(["screened_valid", "sending_otp", "otp_sent", "verified", "send_failed"]);

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
 * Apply lead hydration only when it is safe — never clear funnel phone on null/RLS-unknown reads.
 */
export function applyLeadPhoneHydration(args: {
  leadPhoneE164: string | null | undefined;
  funnelPhoneE164: string | null;
  funnelPhoneStatus: PhoneFunnelStatus;
  setPhone: (e164: string, status: PhoneFunnelStatus) => void;
}): void {
  const { leadPhoneE164, funnelPhoneE164, funnelPhoneStatus, setPhone } = args;

  if (leadPhoneE164) {
    if (!funnelPhoneE164) {
      setPhone(leadPhoneE164, "screened_valid");
    }
    return;
  }

  if (FUNNEL_PHONE_STATUSES_PRESERVED_ON_HYDRATION.has(funnelPhoneStatus)) {
    return;
  }

  // Positive trusted signal: lead row exists with no phone on file and funnel is idle.
  if (funnelPhoneE164 && funnelPhoneStatus === "none") {
    setPhone("", "none");
  }
}
