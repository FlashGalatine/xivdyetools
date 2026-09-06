/* istanbul ignore file */
/**
 * Lightweight type definitions for browser APIs the project uses beyond the
 * standard DOM lib. This is an AMBIENT module: nothing imports it — TypeScript
 * picks the `declare global` block up through the tsconfig include, so knip
 * lists it under `ignore` on purpose. (The `EyeDropper` typings that used to
 * live here left with the 4.x colour picker in 5.8.)
 */

// A file with no import/export is a script, and `declare global` is only
// legal in a module — this keeps it one.
export {};

declare global {
  interface Navigator {
    /** Global Privacy Control (https://globalprivacycontrol.org/) — honoured by TelemetryService. */
    globalPrivacyControl?: boolean;
  }
}
