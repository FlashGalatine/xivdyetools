/**
 * Types for `analyze-unused-keys.js` (plain JS so it runs under bare `node`).
 * Lets `src/__tests__/i18n-orphans.test.ts` import it without a suppression.
 */

export interface UnusedKeysResult {
  /** Keys in the reference locale, `meta.*` excluded. */
  total: number;
  used: number;
  /** Dot-path keys nothing in src/ can reach. */
  unused: string[];
  /** For each used key, which rule matched: `literal`, `prefix:<p>`, `suffix:.<s>`. */
  reasons: Record<string, string>;
}

export interface UsageOracle {
  dynamicPrefixes: Set<string>;
  dynamicSuffixes: Set<string>;
  isUsed(key: string): string | null;
}

export function flattenKeys(obj: unknown, prefix?: string): string[];
export function listSourceFiles(dir: string): string[];
export function buildUsageOracle(corpus: string): UsageOracle;
export function findUnusedKeys(opts?: {
  srcDir?: string;
  localesDir?: string;
  reference?: string;
}): UnusedKeysResult;
