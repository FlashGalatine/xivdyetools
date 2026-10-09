/**
 * The translation keys a source file asks for — what `validate-i18n.js` checks
 * against en.json.
 *
 * Its own module so the parity gate can test it without importing the
 * validator itself: that script runs as a child process, which in-process
 * coverage cannot see, so importing it would count its whole body as
 * uncovered.
 *
 * @module scripts/i18n-key-patterns
 */

// Regex patterns for extracting translation keys
const PATTERNS = [
  // LanguageService.t('key') or LanguageService.t("key")
  /LanguageService\.t\(\s*['"]([^'"]+)['"]\s*\)/g,
  // LanguageService.tInterpolate('key', ...) or LanguageService.tInterpolate("key", ...)
  /LanguageService\.tInterpolate\(\s*['"]([^'"]+)['"]\s*,/g,
  // A plural pair, 'x_one', 'x_other' — tCount(n, one, other) and any helper that
  // forwards the pair to it. The locale's plural rules pick the key at run time, so
  // neither reaches t() as a literal; the pair is literal only here, at the call.
  /['"]([\w.]+_one)['"]\s*,\s*['"]([\w.]+_other)['"]/g,
];

/**
 * Extract translation keys from source text — every capture group of every pattern
 * @param {string} content - Source text
 * @returns {Array<{key: string, line: number}>} Array of keys with line numbers
 */
export function extractKeysFromSource(content) {
  const lines = content.split('\n');
  const results = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const pattern of PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(line)) !== null) {
        for (const key of match.slice(1)) {
          results.push({
            key,
            line: lineNum + 1, // 1-indexed
          });
        }
      }
    }
  }

  return results;
}
