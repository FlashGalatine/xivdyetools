/**
 * Three source-level rules the card generators share, asserted over the source
 * itself rather than over any one card's output.
 *
 * Each exists because a *rendered* assertion cannot see the failure:
 *
 * 1. **Every colour interpolated into an attribute goes through `escapeXml`.**
 *    Today every one of them receives a theme constant or a hex that
 *    `normalizeHex` has already anchored to `/^#?[0-9A-Fa-f]{6}$/`, so nothing
 *    is exploitable and no rendered test can fail. The risk is the next
 *    caller: an unvalidated hex in a `fill="…"` breaks out of the attribute
 *    and injects markup, which is exactly how FINDING-028 reached resvg.
 *
 * 2. **No generator asks for a font weight nothing bundles.** The consumers
 *    ship Regular/SemiBold/Bold (400/600/700). CSS font matching resolves a
 *    request for 500 to 400 silently, so `weight: 500` renders identically to
 *    `weight: 400` while reading in the source as a deliberate Medium — the
 *    class of no-op PR #148 was created for.
 *
 * 3. **Ellipsising slices by code point.** A UTF-16 slice can bisect a
 *    surrogate pair, and `escapeXml` then strips the orphaned half, so the
 *    character disappears rather than being ellipsised (REFACTOR-008).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitText, textWidth } from './frame.js';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** Every non-test `.ts` under `src/`, including `icons/`. */
function generatorSources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      out.push({
        file: `${prefix}${entry.name}`,
        text: readFileSync(join(dir, entry.name), 'utf8'),
      });
    }
  };
  walk(SRC, '');
  return out;
}

describe('generator hygiene', () => {
  it('escapes every value interpolated into a fill= or stroke= attribute', () => {
    const unescaped: string[] = [];

    for (const { file, text } of generatorSources()) {
      text.split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/\b(fill|stroke)="\$\{([^}]*)\}"/g)) {
          if (m[2].includes('escapeXml(')) continue;
          unescaped.push(`${file}:${i + 1} — ${m[1]}="\${${m[2]}}"`);
        }
      });
    }

    expect(unescaped, `unescaped colour interpolations:\n${unescaped.join('\n')}`).toEqual([]);
  });

  it('never asks for a font weight the consumers do not bundle', () => {
    // Onest / Space Grotesk / Fragment Mono ship Regular, SemiBold and Bold.
    // `apps/discord-worker/src/services/font-faces.test.ts` renders exactly
    // these three and asserts they differ.
    const BUNDLED = new Set([400, 600, 700]);
    const unbundled: string[] = [];

    // The expression after `weight:` is often a ternary (`isNormal ? 400 :
    // 600`), so take every 3-digit literal in it rather than only a value that
    // sits immediately after the colon — a regex anchored to the colon reads
    // the ternary form as "no weight here" and lets a 500 straight through.
    for (const { file, text } of generatorSources()) {
      text.split('\n').forEach((line, i) => {
        const exprs = [
          ...[...line.matchAll(/\bweight:\s*([^,\n]+)/g)].map((m) => m[1]),
          ...[...line.matchAll(/font-weight="([^"]+)"/g)].map((m) => m[1]),
        ];
        for (const expr of exprs) {
          for (const lit of expr.match(/\b\d{3}\b/g) ?? []) {
            if (BUNDLED.has(Number(lit))) continue;
            unbundled.push(`${file}:${i + 1} — weight ${lit} in \`${expr.trim()}\``);
          }
        }
      });
    }

    expect(
      unbundled,
      `weights with no bundled face (they resolve to 400 silently):\n${unbundled.join('\n')}`,
    ).toEqual([]);
  });
});

describe('fitText', () => {
  it('returns short content untouched', () => {
    expect(fitText('Snow White', 400, 13, 'body')).toBe('Snow White');
  });

  it('ellipsises to the pixel budget, not a character count', () => {
    const out = fitText('Johannisbeerenvioletter', 60, 13, 'body');
    expect(out.endsWith('…')).toBe(true);
    expect(textWidth(out, 13, 'body')).toBeLessThanOrEqual(60);
  });

  it('never bisects a surrogate pair, at any budget', () => {
    // U+20BB7 (𠮷) is astral: two UTF-16 units, one code point. A `slice(0,-1)`
    // truncation lands between them and leaves a lone high surrogate, which
    // escapeXml then deletes — the glyph vanishes with no ellipsis to show for
    // it.
    //
    // Sweeping the budget matters: a UTF-16 slice that happens to stop on an
    // even unit count is accidentally correct, so a single budget can pass
    // against the broken implementation. Half of these stop on an odd one.
    const astral = '𠮷'.repeat(12);
    const offenders: string[] = [];

    for (let maxPx = 12; maxPx <= 120; maxPx += 1) {
      const out = fitText(astral, maxPx, 13, 'body');
      for (const char of out) {
        const code = char.codePointAt(0)!;
        if (code >= 0xd800 && code <= 0xdfff) {
          offenders.push(`maxPx=${maxPx}: lone surrogate U+${code.toString(16)}`);
          break;
        }
      }
    }

    expect(offenders, `bisected pairs:\n${offenders.slice(0, 10).join('\n')}`).toEqual([]);
    expect(fitText(astral, 40, 13, 'body').endsWith('…')).toBe(true);
  });
});
