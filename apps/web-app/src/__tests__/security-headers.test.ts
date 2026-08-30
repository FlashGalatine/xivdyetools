/**
 * XIV Dye Tools - Security headers contract
 *
 * `public/_headers` is the single source of truth for the production response
 * headers (the CLAUDE.md forbids a second `<meta http-equiv>` copy), and
 * nothing in the build checks it. These assertions pin the 2026-08-21
 * security-audit decisions (FINDING-031 / WEB-5, WEB-7, WEB-8) plus the
 * positive controls the audit verified, so a future edit cannot quietly
 * re-open the CSP.
 *
 * Remember that Cloudflare Pages MERGES overlapping path patterns: anything
 * declared under `/*` also applies to `/assets/*`, `/og/*`, `/fonts/*`.
 *
 * The second half pins `src/index.html`'s resource hints, because a
 * `dns-prefetch` / `preconnect` opens a connection the CSP never gets asked
 * about (2026-08-29 security audit, FINDING-026).
 *
 * @module __tests__/security-headers.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HEADERS = readFileSync(resolve(APP_ROOT, 'public/_headers'), 'utf-8');
const INDEX_HTML = readFileSync(resolve(APP_ROOT, 'src/index.html'), 'utf-8');

/** Parse `_headers` into path-pattern → { header-name (lowercase) → value }. */
function parseHeaders(text: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();
  let current: Map<string, string> | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = blocks.get(line.trim()) ?? new Map<string, string>();
      blocks.set(line.trim(), current);
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1 || !current) continue;
    current.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
  }
  return blocks;
}

/** Parse a CSP value into directive → source list. */
function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    directives.set(name, sources);
  }
  return directives;
}

const BLOCKS = parseHeaders(HEADERS);
const GLOBAL = BLOCKS.get('/*')!;
const CSP = parseCsp(GLOBAL.get('content-security-policy') ?? '');

describe('public/_headers security contract', () => {
  it('declares a global /* block with a CSP', () => {
    expect(GLOBAL).toBeDefined();
    expect(CSP.size).toBeGreaterThan(0);
  });

  describe('Content-Security-Policy', () => {
    it('keeps the verified positive controls', () => {
      expect(CSP.get('default-src')).toEqual(["'self'"]);
      expect(CSP.get('script-src')).toEqual(["'self'"]);
      expect(CSP.get('base-uri')).toEqual(["'self'"]);
      expect(CSP.get('form-action')).toEqual(["'none'"]);
      expect(CSP.get('frame-ancestors')).toEqual(["'none'"]);
      expect(CSP.get('font-src')).toEqual(["'self'"]);
      expect(CSP.has('upgrade-insecure-requests')).toBe(true);
      for (const directive of ['script-src', 'default-src', 'connect-src', 'img-src']) {
        expect(CSP.get(directive), directive).not.toContain("'unsafe-inline'");
        expect(CSP.get(directive), directive).not.toContain("'unsafe-eval'");
      }
    });

    // WEB-5: no production code talks to a workers.dev host, and anyone can
    // register <name>.workers.dev — the one allowance that hands an injection
    // a self-controlled beacon/exfil origin.
    it('does not allow any workers.dev origin in connect-src (WEB-5)', () => {
      const connect = CSP.get('connect-src') ?? [];
      expect(connect.some((s) => s.includes('workers.dev'))).toBe(false);
      // …nor anywhere else a directive could smuggle it back in (comments may
      // still name it — that is where the removal is explained).
      const directiveLines = HEADERS.split('\n').filter(
        (line) => line.trim() && !line.trim().startsWith('#')
      );
      expect(directiveLines.join('\n')).not.toMatch(/workers\.dev/);
    });

    // FINDING-026: `universalis.app` was the last third-party host here. The
    // browser never talks to it — market prices come through the first-party
    // proxy at data.xivdyetools.app (services/api-service-wrapper.ts) — so the
    // allowance only widened the exfil surface an injection could reach.
    it('only names own or first-party hosts in connect-src', () => {
      const connect = CSP.get('connect-src') ?? [];
      expect(connect).toContain("'self'");
      for (const source of connect) {
        if (source.startsWith("'")) continue;
        expect(source, source).toMatch(/^https:\/\/([a-z0-9-]+\.|\*\.)?xivdyetools\.app$/);
      }
      // …nor anywhere else a directive could smuggle it back in (comments may
      // still name it — that is where the removal is explained).
      const directiveLines = HEADERS.split('\n').filter(
        (line) => line.trim() && !line.trim().startsWith('#')
      );
      expect(directiveLines.join('\n')).not.toMatch(/universalis\.app/);
    });

    it("closes the plugin and frame sinks with object-src / frame-src 'none' (WEB-5)", () => {
      expect(CSP.get('object-src')).toEqual(["'none'"]);
      expect(CSP.get('frame-src')).toEqual(["'none'"]);
    });
  });

  it('does not send the deprecated X-XSS-Protection header (WEB-8)', () => {
    expect(GLOBAL.has('x-xss-protection')).toBe(false);
    expect(HEADERS).not.toMatch(/^\s+X-XSS-Protection:/im);
  });

  // WEB-7: the app ships a webcam capture path (camera-service → camera
  // preview modal). `camera=()` silently disabled it for the document itself.
  it('allows the camera for the document itself and nothing else (WEB-7)', () => {
    const policy = GLOBAL.get('permissions-policy') ?? '';
    const entries = new Map(
      policy.split(',').map((p) => {
        const [name, value] = p.trim().split('=');
        return [name, value] as const;
      })
    );
    expect(entries.get('camera')).toBe('(self)');
    expect(entries.get('microphone')).toBe('()');
    expect(entries.get('geolocation')).toBe('()');
  });

  it('keeps clickjacking, sniffing, referrer and HSTS controls', () => {
    expect(GLOBAL.get('x-frame-options')).toBe('DENY');
    expect(GLOBAL.get('x-content-type-options')).toBe('nosniff');
    expect(GLOBAL.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(GLOBAL.get('strict-transport-security')).toMatch(
      /max-age=31536000.*includeSubDomains.*preload/
    );
  });

  it('does not ship the beta X-Robots-Tag block in production', () => {
    // vite-plugin-beta-branding appends it at build time; public/_headers must
    // never carry it (the beta plugin's idempotency guard reads a directive,
    // not a comment — see shared/beta-branding.ts).
    expect(HEADERS).not.toMatch(/^\s+X-Robots-Tag:/im);
  });
});

// FINDING-026: a `dns-prefetch` / `preconnect` hint is a connection the page
// opens on load whether or not a request ever follows — the visitor's IP and
// the SNI reach that host on every visit, and no CSP directive is consulted.
// `universalis.app` sat here for years while every market call went through
// data.xivdyetools.app, so the hints bought nothing and contradicted
// PRIVACY.md's "first-party hosts only".
describe('src/index.html resource hints', () => {
  const HINT_LINK = /<link\b[^>]*\brel="(?:dns-prefetch|preconnect|prefetch|preload)"[^>]*>/g;
  const HINTS = [...INDEX_HTML.matchAll(HINT_LINK)].map((m) => m[0]);

  it('names no third-party origin', () => {
    expect(HINTS.length).toBeGreaterThan(0);
    for (const hint of HINTS) {
      const href = /\bhref="([^"]*)"/.exec(hint)?.[1] ?? '';
      // same-origin (self-hosted fonts) — but a protocol-relative `//host` href
      // also starts with '/' and is NOT same-origin, so it must not be skipped.
      if (href.startsWith('/') && !href.startsWith('//')) continue;
      expect(href, hint).toMatch(/^https:\/\/([a-z0-9-]+\.)?xivdyetools\.app$/);
    }
  });
});
