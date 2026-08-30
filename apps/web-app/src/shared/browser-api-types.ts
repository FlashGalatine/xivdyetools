/* istanbul ignore file */
/**
 * These are lightweight type definitions for browser APIs used in the project.
 * They supplement the standard DOM lib definitions and provide safer typings
 * for APIs that may not be available in all environments (e.g., service workers).
 */

export interface EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

export interface EyeDropperConstructor {
  new (): EyeDropper;
}

declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }

  interface Navigator {
    /** Global Privacy Control (https://globalprivacycontrol.org/) — honoured by TelemetryService. */
    globalPrivacyControl?: boolean;
  }
}
