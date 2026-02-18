/// <reference types="vite/client" />

/**
 * Environment variable type declarations
 */
interface ImportMetaEnv {
  /** OAuth worker URL for authentication */
  readonly VITE_OAUTH_WORKER_URL?: string;
  /** Universalis proxy URL (to avoid CORS issues) */
  readonly VITE_UNIVERSALIS_PROXY_URL?: string;
  /** True if running in production mode */
  readonly PROD: boolean;
  /** True if running in development mode */
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Virtual module type declarations for Vite plugins
 */

/**
 * Virtual changelog module provided by vite-plugin-changelog-parser
 *
 * This module is generated at build time by parsing CHANGELOG.md
 */
declare module 'virtual:changelog' {
  interface ChangelogEntry {
    version: string;
    date: string;
    highlights: string[];
  }

  export const changelogEntries: ChangelogEntry[];
}
