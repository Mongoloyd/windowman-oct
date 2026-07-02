/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_GUARD_DEV_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
