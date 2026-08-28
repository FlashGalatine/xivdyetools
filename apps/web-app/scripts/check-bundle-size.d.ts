/**
 * Types for the budget helpers exported by `check-bundle-size.js`.
 *
 * The script itself stays plain JS because it runs under bare `node` in CI with
 * no build step. This declaration exists so `src/__tests__/bundle-budget.test.ts`
 * can import the pure arithmetic with real types instead of a suppression.
 */

export interface ChunkLimit {
  /** Budget in bytes. */
  limit: number;
  /** Human-readable rule name, or `'unlisted'` when the default applied. */
  label: string;
  /** False when the chunk matched no named rule and inherited the default. */
  named: boolean;
}

export interface BundleEntry {
  file: string;
  size: number;
}

export interface BundleRow extends BundleEntry {
  label: string;
  limit: number;
  percentage: number;
  status: string;
  exceeds: boolean;
}

export interface BundleTotals {
  results: BundleRow[];
  /** How many chunks fell back to DEFAULT_CHUNK_LIMIT. */
  defaultedCount: number;
  /** Every emitted .js file, all locales included. */
  totalJsSize: number;
  /** Every emitted .js file, counting only the largest single locale. */
  payloadSize: number;
}

export interface LocaleOptions {
  /** Override the discovered locale-chunk matcher (tests inject this). */
  localePattern?: RegExp;
}

export function limitFor(file: string, options?: LocaleOptions): ChunkLimit;

export function computeTotals(entries: BundleEntry[], options?: LocaleOptions): BundleTotals;

/** Locale codes read from `src/locales/*.json`. */
export function discoverLocaleCodes(localesDir?: string): string[];

/** Build the emitted-chunk matcher for a set of locale codes. */
export function localeChunkPattern(codes: string[]): RegExp;
