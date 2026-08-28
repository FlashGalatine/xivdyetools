/**
 * XIV Dye Tools - Font Contract Tests
 *
 * Regression guard for the font contract established by REFACTOR-002:
 * `src/styles/globals.css` is the single place the web app declares a typeface,
 * and every consumer reads `--font-display` / `--font-body` / `--font-mono`.
 *
 * These assertions exist because the failures in this area are all *silent*:
 *
 *  - A malformed comment can delete an `@font-face` rule without any build
 *    error. That is not hypothetical -- the Fragment Mono face carried a
 *    doc comment containing the glob `apps/` + `*` + `/src/fonts/...`, whose
 *    `*` + `/` closed the comment early; CSS error-recovery then swallowed the
 *    rule that followed. `.number` still *computed* to 'Fragment Mono', the
 *    woff2 still served with a 200, and every numeric readout quietly rendered
 *    in the Consolas fallback instead. No test in the suite noticed.
 *  - A `src: url()` pointing at a missing file also fails silently: the browser
 *    just falls through to the next family in the stack.
 *  - Re-adding a Google Fonts request would re-open the CSP origins and the
 *    per-visitor third-party fetch that self-hosting removed.
 *
 * @module __tests__/font-contract.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const read = (p: string): string => readFileSync(resolve(APP_ROOT, p), 'utf-8');

const GLOBALS_CSS = read('src/styles/globals.css');
const INDEX_HTML = read('src/index.html');
const HEADERS = read('public/_headers');
const TAILWIND_CONFIG = read('tailwind.config.js');

/** Strip CSS comments the way a parser does, so assertions see real rules only. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The three families the suite settled on, mirroring FONTS in packages/svg. */
const EXPECTED_FACES = [
  { family: 'Space Grotesk', file: 'SpaceGrotesk-Variable.woff2' },
  { family: 'Onest', file: 'Onest-Variable.woff2' },
  { family: 'Fragment Mono', file: 'FragmentMono-Regular.woff2' },
] as const;

describe('font contract', () => {
  describe('@font-face rules survive CSS parsing', () => {
    const parsed = stripComments(GLOBALS_CSS);

    it.each(EXPECTED_FACES)('declares $family outside of any comment', ({ family }) => {
      // Deliberately asserted against comment-stripped CSS: a family named only
      // inside a comment is exactly the failure mode this guards.
      expect(parsed).toContain(`font-family: '${family}'`);
    });

    it('declares exactly the three contract faces and no others', () => {
      const faces = parsed.match(/@font-face\s*\{[^}]*\}/g) ?? [];
      expect(faces).toHaveLength(EXPECTED_FACES.length);
    });

    // Checking for the glob directly would only catch the one spelling that bit
    // us. This checks the *invariant* instead: CSS comments do not nest, so
    // stripping every `/* ... */` pair from a well-formed sheet must leave no
    // `*/` behind. A leftover terminator proves some comment closed earlier than
    // its author meant it to -- and everything between the early close and that
    // orphan is being fed to the CSS parser as garbage, taking whatever rule
    // follows down with it.
    it.each([
      'src/styles/globals.css',
      'src/styles/v4-layout.css',
      'src/styles/themes.css',
      'src/styles/error-boundary.css',
      'src/styles/tool-content.css',
    ])('%s leaves no orphaned comment terminator when parsed', (file) => {
      const orphans = stripComments(read(file)).split('*/').length - 1;
      expect(orphans).toBe(0);
    });
  });

  describe('every declared face resolves to a file that ships', () => {
    it.each(EXPECTED_FACES)('$family points at $file, which exists', ({ family, file }) => {
      const parsed = stripComments(GLOBALS_CSS);
      const block = parsed
        .match(/@font-face\s*\{[^}]*\}/g)
        ?.find((b) => b.includes(`font-family: '${family}'`));

      expect(block, `no @font-face block for ${family}`).toBeDefined();
      expect(block).toContain(`url('/fonts/${file}')`);
      // publicDir is ../public, so /fonts/x maps to public/fonts/x in the build.
      expect(existsSync(resolve(APP_ROOT, 'public/fonts', file))).toBe(true);
    });
  });

  describe('the contract is the only declaration site', () => {
    it('exposes the four contract variables', () => {
      for (const v of ['--font-display', '--font-body', '--font-mono', '--font-cjk']) {
        expect(GLOBALS_CSS).toContain(`${v}:`);
      }
    });

    it('routes every Tailwind family through the variables', () => {
      // Spelling stacks out here is what let font-mono (Fira Code) drift from
      // the CSS rule of the same name.
      // `heading` / `numeric` were dropped in the 2026-08-16 audit (DEAD-021):
      // no consumer, and `font-numeric` only collided with the `.number` rule.
      for (const family of ['sans', 'mono']) {
        expect(TAILWIND_CONFIG).toMatch(
          new RegExp(`${family}:\\s*\\['var\\(--font-(display|body|mono)\\)'\\]`)
        );
      }
      // The invariant itself: no family name is spelled out in the config.
      const fontFamilyBlock = TAILWIND_CONFIG.slice(TAILWIND_CONFIG.indexOf('fontFamily'));
      for (const literal of ['Onest', 'Space Grotesk', 'Fragment Mono', 'Fira Code', 'Habibi']) {
        expect(fontFamilyBlock).not.toContain(`'${literal}'`);
      }
    });

    it('keeps the retired families out of the stylesheets', () => {
      // Habibi (BUG-002/DEAD-004), plus the families the old loader and the
      // dead <noscript> fallback pulled in.
      const retired = ['Habibi', 'Fira Code', 'Varela Round', 'Inter', 'Outfit', 'JetBrains Mono'];
      const parsed = stripComments(GLOBALS_CSS) + stripComments(read('src/styles/v4-layout.css'));
      for (const family of retired) {
        expect(parsed, `${family} is retired but still declared`).not.toContain(family);
      }
    });

    it('names no family directly outside globals.css (FONT-WEB-002)', () => {
      // my-submissions-modal.ts used to inline `font-family: 'Fragment Mono',
      // monospace` in a style attribute, bypassing the --font-mono contract:
      // no CJK fallback and no :lang() override, so a ja/zh/ko preset name in
      // that row fell to the browser's default monospace.
      const src = read('src/components/my-submissions-modal.ts');
      expect(src).not.toContain("font-family: 'Fragment Mono'");
      expect(src).toContain('font-family: var(--font-mono)');
    });
  });

  describe('per-locale CJK glyph-form overrides (FONT-WEB-001)', () => {
    // `--font-cjk` puts Noto Sans JP first, which is correct for ja but draws
    // Han characters with Japanese glyph forms for zh/ko readers who also have
    // Noto Sans JP installed. These :lang() overrides retarget the variable
    // per locale; LanguageService.setLocale keeps document.documentElement.lang
    // in sync so the selectors match.
    it('puts Noto Sans SC ahead of Noto Sans JP for :root:lang(zh)', () => {
      const block = GLOBALS_CSS.match(/:root:lang\(zh\)\s*\{[^}]*\}/)?.[0];
      expect(block, 'no :root:lang(zh) override found').toBeDefined();
      expect(block).toContain('--font-cjk:');
      const scIndex = block!.indexOf("'Noto Sans SC'");
      const jpIndex = block!.indexOf("'Noto Sans JP'");
      expect(scIndex).toBeGreaterThan(-1);
      expect(jpIndex).toBeGreaterThan(-1);
      expect(scIndex).toBeLessThan(jpIndex);
    });

    it('puts Noto Sans KR ahead of Noto Sans JP for :root:lang(ko)', () => {
      const block = GLOBALS_CSS.match(/:root:lang\(ko\)\s*\{[^}]*\}/)?.[0];
      expect(block, 'no :root:lang(ko) override found').toBeDefined();
      expect(block).toContain('--font-cjk:');
      const krIndex = block!.indexOf("'Noto Sans KR'");
      const jpIndex = block!.indexOf("'Noto Sans JP'");
      expect(krIndex).toBeGreaterThan(-1);
      expect(jpIndex).toBeGreaterThan(-1);
      expect(krIndex).toBeLessThan(jpIndex);
    });

    it('leaves the ja default order with Noto Sans JP first', () => {
      const block = GLOBALS_CSS.match(/:root\s*\{[^}]*--font-cjk:[^}]*\}/)?.[0];
      expect(block, 'no base :root --font-cjk declaration found').toBeDefined();
      const jpIndex = block!.indexOf("'Noto Sans JP'");
      const scIndex = block!.indexOf("'Noto Sans SC'");
      expect(jpIndex).toBeGreaterThan(-1);
      expect(scIndex).toBeGreaterThan(-1);
      expect(jpIndex).toBeLessThan(scIndex);
    });
  });

  describe('fonts are self-hosted', () => {
    it('makes no Google Fonts request from the entry HTML', () => {
      expect(INDEX_HTML).not.toContain('fonts.googleapis.com');
      expect(INDEX_HTML).not.toContain('fonts.gstatic.com');
      expect(INDEX_HTML).not.toContain('load-fonts.js');
    });

    it('preloads the two above-the-fold faces with crossorigin', () => {
      // A font preload whose CORS mode differs from the real request is
      // discarded and fetched twice -- worse than no preload at all.
      for (const file of ['Onest-Variable.woff2', 'SpaceGrotesk-Variable.woff2']) {
        const tag = INDEX_HTML.split('\n').find((l) => l.includes(`/fonts/${file}`));
        expect(tag, `no preload for ${file}`).toBeDefined();
        expect(tag).toContain('as="font"');
        expect(tag).toContain('crossorigin');
      }
    });

    it("keeps font-src and style-src at 'self'", () => {
      const csp = HEADERS.split('\n').find((l) => l.includes('Content-Security-Policy:'));
      expect(csp).toBeDefined();
      expect(csp).toContain("font-src 'self';");
      expect(csp).toContain("style-src 'self' 'unsafe-inline';");
      expect(csp).not.toContain('fonts.googleapis.com');
      expect(csp).not.toContain('fonts.gstatic.com');
    });
  });
});
