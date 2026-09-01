import type {
  CasCompleteInput,
  ClaimedJob,
  ContentLease,
  ExtractionIdentity,
  ExtractionRecord,
  PersistSuccessInput,
  PersistSuccessResult,
  QuoteFileRef,
} from "./types.ts";

export interface QuoteIntelligencePorts {
  atomicPersistenceAvailable: boolean;
  claimJobs: (
    limit: number,
    workerId: string,
    leaseSeconds: number,
  ) => Promise<ClaimedJob[]>;
  getQuoteFile: (quoteFileId: string) => Promise<QuoteFileRef | null>;
  downloadQuoteBytes: (storagePath: string) => Promise<Uint8Array | null>;
  lookupExtraction: (
    identity: ExtractionIdentity,
  ) => Promise<ExtractionRecord | null>;
  acquireContentLease: (
    identity: ExtractionIdentity,
    workerId: string,
    leaseSeconds: number,
  ) => Promise<ContentLease>;
  releaseContentLease: (
    identity: ExtractionIdentity,
    workerId: string,
    claimToken: string,
  ) => Promise<boolean>;
  casComplete: (input: CasCompleteInput) => Promise<boolean>;
  callProvider: (
    bytes: Uint8Array,
    mimeType: string,
  ) => Promise<
    | {
      ok: true;
      text: string;
      modelId: string;
      metadata: Record<string, unknown>;
    }
    | { ok: false; retryable: boolean }
  >;
  persistSuccess: (
    input: PersistSuccessInput,
  ) => Promise<PersistSuccessResult>;
  now: () => Date;
}

export function createBlockedPersistenceAdapter(): QuoteIntelligencePorts[
  "persistSuccess"
] {
  return async () => ({
    ok: false,
    code: "SCHEMA_GAP_ATOMIC_PERSISTENCE",
  });
}
