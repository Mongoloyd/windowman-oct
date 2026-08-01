/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_GUARD_DEV_BYPASS?: string;
  readonly VITE_OPENAI_ADS_PIXEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface OpenAiAdsQueue {
  (...args: unknown[]): void;
  q?: unknown[][];
}

interface Window {
  oaiq?: OpenAiAdsQueue;
}
