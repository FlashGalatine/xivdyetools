/**
 * XIV Dye Tools - Beta branding transform tests
 *
 * These run against the same pure functions the Vite plugin calls, so the
 * branding logic is covered without executing a build.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_APP_NAME,
  BETA_ORIGIN,
  BETA_TITLE_PREFIX,
  addBetaHeaders,
  brandHtmlForBeta,
  findDuplicatePathPatterns,
} from '../beta-branding';

/** The real production `_headers`, which a beta build starts from. */
const PUBLIC_HEADERS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/_headers'),
  'utf-8'
);

/** The seven icon links as they appear in src/index.html, plus two links that must NOT change. */
const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>XIV Dye Tools - FFXIV Dye Color Matcher</title>
    <meta name="robots" content="index, follow" />
    <meta name="description" content="Free tools at https://xivdyetools.app/ for FFXIV players." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://xivdyetools.app/" />
    <meta property="og:image" content="https://xivdyetools.app/og/default.png" />
    <meta property="og:site_name" content="XIV Dye Tools" />
    <meta name="twitter:url" content="https://xivdyetools.app/" />
    <meta name="twitter:image" content="https://xivdyetools.app/og/default-x.png" />
    <link rel="canonical" href="https://xivdyetools.app/" />
    <link rel="icon" type="image/x-icon" href="/assets/icons/favicon.ico" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/icons/favicon-48x48.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/icon-192x192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/assets/icons/icon-512x512.png" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preload" href="/assets/icons/icon-40x40.webp" as="image" type="image/webp" fetchpriority="high" />
    <link rel="preload" href="/assets/icons/icon-192x192.png" as="image" type="image/png" />
  </head>
  <body></body>
</html>`;

/** A minimal fixture with no robots meta at all, for the no-op case. */
const SAMPLE_HTML_NO_ROBOTS = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>XIV Dye Tools - FFXIV Dye Color Matcher</title>
    <link rel="canonical" href="https://xivdyetools.app/" />
  </head>
  <body></body>
</html>`;

describe('brandHtmlForBeta', () => {
  it('prefixes the document title', () => {
    expect(brandHtmlForBeta(SAMPLE_HTML)).toContain(
      `<title>${BETA_TITLE_PREFIX}XIV Dye Tools - FFXIV Dye Color Matcher</title>`
    );
  });

  it('is idempotent — a second pass does not double-prefix', () => {
    const once = brandHtmlForBeta(SAMPLE_HTML);
    expect(brandHtmlForBeta(once)).toBe(once);
  });

  it('repoints every icon link at the beta set', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    for (const file of [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'favicon-48x48.png',
      'apple-touch-icon.png',
      'icon-192x192.png',
      'icon-512x512.png',
    ]) {
      expect(out).toContain(`href="/assets/icons/beta/${file}"`);
    }
    // No icon link may still point at the production set.
    expect(out).not.toMatch(/rel="(icon|apple-touch-icon)"[^>]*href="\/assets\/icons\/(?!beta\/)/);
  });

  it('leaves non-icon links alone', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain('<link rel="canonical" href="https://xivdyetools.app/" />');
    expect(out).toContain('<link rel="manifest" href="/manifest.json" />');
  });

  it('does not depend on attribute order', () => {
    const reordered = '<link href="/assets/icons/favicon.ico" rel="icon" />';
    expect(brandHtmlForBeta(reordered)).toBe(
      '<link href="/assets/icons/beta/favicon.ico" rel="icon" />'
    );
  });

  it('rewrites the robots meta tag to noindex, nofollow', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(out).not.toContain('content="index, follow"');
  });

  it('is idempotent for the robots meta rewrite', () => {
    const once = brandHtmlForBeta(SAMPLE_HTML);
    const twice = brandHtmlForBeta(once);
    expect(twice).toBe(once);
    expect(twice).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  it('does not inject a robots meta tag when none exists', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML_NO_ROBOTS);
    expect(out).not.toContain('name="robots"');
  });

  it('rewrites the robots meta tag regardless of attribute order', () => {
    const reordered = '<meta content="index, follow" name="robots" />';
    expect(brandHtmlForBeta(reordered)).toBe('<meta content="noindex, nofollow" name="robots" />');
  });

  it('repoints the icon preload link at the beta set', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain(
      '<link rel="preload" href="/assets/icons/beta/icon-192x192.png" as="image" type="image/png" />'
    );
  });

  it('is idempotent for the preload rewrite', () => {
    const once = brandHtmlForBeta(SAMPLE_HTML);
    expect(brandHtmlForBeta(once)).toBe(once);
  });

  it('leaves a preload for a non-png/ico icon format untouched (no beta equivalent exists)', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain(
      '<link rel="preload" href="/assets/icons/icon-40x40.webp" as="image" type="image/webp" fetchpriority="high" />'
    );
  });

  it('repoints og:image and twitter:image at the beta origin', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain(`content="${BETA_ORIGIN}/og/default.png"`);
    expect(out).toContain(`content="${BETA_ORIGIN}/og/default-x.png"`);
  });

  it('repoints og:url and twitter:url so the embed links back to beta', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain(`<meta property="og:url" content="${BETA_ORIGIN}/" />`);
    expect(out).toContain(`<meta name="twitter:url" content="${BETA_ORIGIN}/" />`);
  });

  it('leaves og/twitter tags whose content is not a production URL alone', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain('<meta property="og:type" content="website" />');
    expect(out).toContain('<meta property="og:site_name" content="XIV Dye Tools" />');
  });

  it('does not rewrite production URLs outside og/twitter tags', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    // rel=canonical intentionally keeps pointing at production, and a prose
    // mention of the URL in the description is not a social-embed target.
    expect(out).toContain('<link rel="canonical" href="https://xivdyetools.app/" />');
    expect(out).toContain(
      '<meta name="description" content="Free tools at https://xivdyetools.app/ for FFXIV players." />'
    );
  });

  it('is idempotent for the og/twitter origin rewrite', () => {
    const once = brandHtmlForBeta(SAMPLE_HTML);
    expect(brandHtmlForBeta(once)).toBe(once);
    expect(once).not.toContain('beta.beta.');
  });

  it('rewrites og tags regardless of attribute order', () => {
    const reordered = '<meta content="https://xivdyetools.app/x.png" property="og:image" />';
    expect(brandHtmlForBeta(reordered)).toBe(
      `<meta content="${BETA_ORIGIN}/x.png" property="og:image" />`
    );
  });

  it('exposes the beta origin', () => {
    expect(BETA_ORIGIN).toBe('https://beta.xivdyetools.app');
  });

  it('exposes the unprefixed product name', () => {
    expect(BASE_APP_NAME).toBe('XIV Dye Tools');
  });
});

/**
 * The rules Cloudflare Pages would actually serve from a `_headers` file.
 *
 * Deliberately an independent model of wrangler (trimmed lines; `/` or
 * `scheme://` opens a rule; a repeated header name is joined with `, `; rules
 * keyed by path, so a repeated pattern is LAST-WINS) rather than a call into
 * the module under test — the bug these tests pin was a wrong belief about
 * exactly this behaviour.
 */
function servedRules(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^([^\s]+:\/\/|\/)/.test(line)) {
      current = new Map();
      rules.set(line, current); // replaces an earlier rule for the same pattern
      continue;
    }
    const at = line.indexOf(':');
    if (at === -1 || !current) continue;
    const name = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    current.set(name, current.has(name) ? `${current.get(name)}, ${value}` : value);
  }
  return rules;
}

describe('addBetaHeaders', () => {
  const branded = addBetaHeaders(PUBLIC_HEADERS);

  /** FINDING-001 (2026-10-03 security audit). */
  it('keeps every security header on the /* rule Pages serves for the real public/_headers', () => {
    const global = servedRules(branded).get('/*')!;
    expect(global.get('content-security-policy')).toMatch(/frame-ancestors 'none'/);
    expect(global.get('x-frame-options')).toBe('DENY');
    expect(global.get('strict-transport-security')).toMatch(/max-age=31536000/);
    expect(global.get('permissions-policy')).toBe('geolocation=(), microphone=(), camera=()');
    expect(global.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('declares /* exactly once and repeats no pattern', () => {
    expect(branded.split('\n').filter((line) => line.trim() === '/*')).toHaveLength(1);
    expect(findDuplicatePathPatterns(branded)).toEqual([]);
  });

  it('changes nothing but the one inserted directive', () => {
    const before = PUBLIC_HEADERS.split('\n');
    const after = branded.split('\n');
    expect(after).toHaveLength(before.length + 1);
    const inserted = after.findIndex((line, i) => line !== before[i]);
    expect(after[inserted].replace(/\r$/, '')).toBe('  X-Robots-Tag: noindex, nofollow');
    expect(after[inserted - 1].trim()).toBe('/*');
    expect([...after.slice(0, inserted), ...after.slice(inserted + 1)]).toEqual(before);
  });

  /**
   * The mechanism of FINDING-001, pinned so the old belief cannot return: a
   * second `/*` rule does not merge into the first, it replaces it.
   */
  it('would lose the CSP if the directive were appended as a second /* rule instead', () => {
    const appended = `${PUBLIC_HEADERS}\n/*\n  X-Robots-Tag: noindex, nofollow\n`;
    const global = servedRules(appended).get('/*')!;
    expect(global.has('content-security-policy')).toBe(false);
    expect(global.has('x-frame-options')).toBe(false);
    expect(findDuplicatePathPatterns(appended)).toEqual(['/*']);
  });

  it('is idempotent', () => {
    expect(addBetaHeaders(branded)).toBe(branded);
  });

  /**
   * `public/_headers` carries comments that name the header. Prose is input
   * too: an earlier guard read such a comment as proof the header was present
   * and skipped it, shipping an indexable beta build.
   */
  it('is not satisfied by a comment that merely mentions the header', () => {
    const commentOnly = [
      '# The X-Robots-Tag header keeps beta out of search results.',
      '#   X-Robots-Tag: noindex, nofollow  <- illustrative only',
      '/*',
      '  X-Frame-Options: DENY',
    ].join('\n');
    expect(servedRules(addBetaHeaders(commentOnly)).get('/*')!.get('x-robots-tag')).toBe(
      'noindex, nofollow'
    );
  });

  it('treats an X-Robots-Tag without noindex as absent', () => {
    const out = addBetaHeaders('/*\n  X-Robots-Tag: all\n');
    expect(servedRules(out).get('/*')!.get('x-robots-tag')).toMatch(/\bnoindex\b/);
  });

  it('targets the exact /* pattern, not a pattern that merely starts with it', () => {
    const out = addBetaHeaders('/*.html\n  Cache-Control: no-cache\n/*\n  X-Frame-Options: DENY\n');
    const rules = servedRules(out);
    expect(rules.get('/*.html')!.has('x-robots-tag')).toBe(false);
    expect(rules.get('/*')!.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('keeps CRLF line endings intact', () => {
    const out = addBetaHeaders('/*\r\n  X-Frame-Options: DENY\r\n');
    expect(out).toBe('/*\r\n  X-Robots-Tag: noindex, nofollow\r\n  X-Frame-Options: DENY\r\n');
  });

  it('refuses a file with no /* rule, since that is where the CSP lives', () => {
    expect(() => addBetaHeaders('/assets/*\n  Cache-Control: public\n')).toThrow(/no \/\* rule/);
  });
});

describe('findDuplicatePathPatterns', () => {
  it('finds none in the real public/_headers', () => {
    expect(findDuplicatePathPatterns(PUBLIC_HEADERS)).toEqual([]);
  });

  it('does not count distinct overlapping patterns, which Pages merges', () => {
    expect(findDuplicatePathPatterns('/*\n  A: 1\n/assets/*\n  B: 2\n')).toEqual([]);
  });

  it('reports a repeated pattern once, however often it repeats', () => {
    expect(findDuplicatePathPatterns('/*\n  A: 1\n/*\n  B: 2\n  /*\n  C: 3\n')).toEqual(['/*']);
  });

  it('ignores a pattern named inside a comment', () => {
    expect(findDuplicatePathPatterns('/*\n  A: 1\n# /* is the global rule\n')).toEqual([]);
  });
});
