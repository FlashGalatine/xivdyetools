/**
 * XIV Dye Tools - Beta branding transform tests
 *
 * These run against the same pure functions the Vite plugin calls, so the
 * branding logic is covered without executing a build.
 */

import { describe, it, expect } from 'vitest';
import {
  BASE_APP_NAME,
  BETA_HEADERS_BLOCK,
  BETA_TITLE_PREFIX,
  brandHtmlForBeta,
} from '../beta-branding';

/** The seven icon links as they appear in src/index.html, plus two links that must NOT change. */
const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>XIV Dye Tools - FFXIV Dye Color Matcher</title>
    <meta name="robots" content="index, follow" />
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

  it('exposes a headers block that suppresses indexing', () => {
    expect(BETA_HEADERS_BLOCK).toContain('X-Robots-Tag: noindex, nofollow');
    expect(BETA_HEADERS_BLOCK).toContain('/*');
  });

  it('exposes the unprefixed product name', () => {
    expect(BASE_APP_NAME).toBe('XIV Dye Tools');
  });
});
