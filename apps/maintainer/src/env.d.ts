/// <reference types="vite/client" />

/**
 * Environment variable type definitions
 * Note: No environment variables are currently required for the frontend.
 * Authentication is handled via session tokens obtained from the server.
 */
interface ImportMetaEnv {
  // No frontend environment variables needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
