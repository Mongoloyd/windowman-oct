import { isUuid } from "@/lib/routeIdGuards";

const NQ4_UPLOAD_RESUME_KEY = "wm_nq4_upload_resume_v1";

export const NQ4_UPLOAD_RESUME_TTL_MS = 30 * 60 * 1000;

export type Nq4UploadResume = {
  version: 1;
  leadId: string;
  sessionId: string;
  expiresAt: number;
};

type ResumeIdentity = Pick<Nq4UploadResume, "leadId" | "sessionId">;

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
    storage.removeItem(NQ4_UPLOAD_RESUME_KEY);
  } catch {
    // Browser storage is optional. The live in-memory handoff can continue.
  }
}

function isNq4UploadResume(
  value: unknown,
  now: number,
): value is Nq4UploadResume {
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
    record.expiresAt <= now + NQ4_UPLOAD_RESUME_TTL_MS
  );
}

export function readNq4UploadResume(
  now: number = Date.now(),
): Nq4UploadResume | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  let serialized: string | null;
  try {
    serialized = storage.getItem(NQ4_UPLOAD_RESUME_KEY);
  } catch {
    return null;
  }

  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isNq4UploadResume(parsed, now)) return parsed;
  } catch {
    // Malformed browser state is discarded below.
  }

  removeStoredResume(storage);
  return null;
}

export function writeNq4UploadResume(
  identity: ResumeIdentity,
  now: number = Date.now(),
): Nq4UploadResume | null {
  if (!isUuid(identity.leadId) || !isUuid(identity.sessionId)) return null;

  const resume: Nq4UploadResume = {
    version: 1,
    leadId: identity.leadId,
    sessionId: identity.sessionId,
    expiresAt: now + NQ4_UPLOAD_RESUME_TTL_MS,
  };

  const storage = getSessionStorage();
  if (!storage) return resume;

  try {
    storage.setItem(NQ4_UPLOAD_RESUME_KEY, JSON.stringify(resume));
  } catch {
    // The current in-memory handoff remains usable when storage is blocked.
  }

  return resume;
}

export function clearNq4UploadResume(): void {
  const storage = getSessionStorage();
  if (storage) removeStoredResume(storage);
}
