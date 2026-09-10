import { isUuid } from "@/lib/routeIdGuards";

const WINDOWMAN_UPLOAD_RESUME_KEY = "wm_windowman_upload_resume_v1";

export const WINDOWMAN_UPLOAD_RESUME_TTL_MS = 30 * 60 * 1000;

export type WindowmanUploadResume = {
  version: 1;
  leadId: string;
  sessionId: string;
  expiresAt: number;
};

type ResumeIdentity = Pick<WindowmanUploadResume, "leadId" | "sessionId">;

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function removeStoredResume(storage: Storage): void {
  try {
    storage.removeItem(WINDOWMAN_UPLOAD_RESUME_KEY);
  } catch {
    // Browser storage is optional. The live in-memory handoff can continue.
  }
}

function isWindowmanUploadResume(
  value: unknown,
  now: number,
): value is WindowmanUploadResume {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = ["expiresAt", "leadId", "sessionId", "version"];

  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    record.version === 1 &&
    isUuid(typeof record.leadId === "string" ? record.leadId : null) &&
    isUuid(typeof record.sessionId === "string" ? record.sessionId : null) &&
    typeof record.expiresAt === "number" &&
    Number.isSafeInteger(record.expiresAt) &&
    record.expiresAt > now &&
    record.expiresAt <= now + WINDOWMAN_UPLOAD_RESUME_TTL_MS
  );
}

export function readWindowmanUploadResume(
  now: number = Date.now(),
): WindowmanUploadResume | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  let serialized: string | null;
  try {
    serialized = storage.getItem(WINDOWMAN_UPLOAD_RESUME_KEY);
  } catch {
    return null;
  }

  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isWindowmanUploadResume(parsed, now)) return parsed;
  } catch {
    // Malformed browser state is discarded below.
  }

  removeStoredResume(storage);
  return null;
}

export function writeWindowmanUploadResume(
  identity: ResumeIdentity,
  now: number = Date.now(),
): WindowmanUploadResume | null {
  if (!isUuid(identity.leadId) || !isUuid(identity.sessionId)) return null;

  const resume: WindowmanUploadResume = {
    version: 1,
    leadId: identity.leadId,
    sessionId: identity.sessionId,
    expiresAt: now + WINDOWMAN_UPLOAD_RESUME_TTL_MS,
  };

  const storage = getSessionStorage();
  if (!storage) return resume;

  try {
    storage.setItem(WINDOWMAN_UPLOAD_RESUME_KEY, JSON.stringify(resume));
  } catch {
    // The current in-memory handoff remains usable when storage is blocked.
  }

  return resume;
}

export function clearWindowmanUploadResume(): void {
  const storage = getSessionStorage();
  if (storage) removeStoredResume(storage);
}
