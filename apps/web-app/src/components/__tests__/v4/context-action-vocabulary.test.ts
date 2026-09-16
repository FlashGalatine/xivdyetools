/**
 * XIV Dye Tools - Context Action Vocabulary Guard (REFACTOR-001)
 *
 * `ResultCard`'s own emitters (`handleSlotAction` / `handleMenuAction` in
 * `v4/result-card.ts`) only ever produce `inspect-*` / `transform-*` /
 * `external-*` / `add-mixer-slot-*` action strings. Five legacy
 * `ContextAction` members -- `add-comparison`, `add-mixer`,
 * `add-accessibility`, `see-harmonies`, `budget` -- were never emitted by
 * this file, so the branches that handled them in swatch-tool.ts and
 * mixer-tool.ts (each dispatching `window.dispatchEvent(new
 * CustomEvent('navigate-to-tool', ...))`) were unreachable: 9 dispatch
 * sites, 0 listeners. REFACTOR-001 deleted those branches.
 *
 * This is a static, source-scanning regression guard in the same style as
 * `src/__tests__/font-contract.test.ts`: it reads the two files as text
 * rather than mounting either component (both constructors need a large,
 * separately-maintained mock surface -- see swatch-tool.test.ts /
 * mixer-tool.test.ts -- and mounting buys nothing here since the actions
 * under test are handled without any DOM state).
 *
 * The five legacy members stay in `CONTEXT_ACTIONS` / `ContextAction`
 * because budget-tool.ts, gradient-tool.ts and harmony-tool.ts still handle
 * them -- this guard pins swatch-tool.ts and mixer-tool.ts only.
 *
 * @module components/__tests__/v4/context-action-vocabulary.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTEXT_ACTIONS, type ContextAction } from '../../v4/result-card';

const COMPONENTS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const read = (fileName: string): string =>
  readFileSync(resolve(COMPONENTS_ROOT, fileName), 'utf-8');

/**
 * Pull one method's full body out of a class source by brace-balancing from
 * its declaration line -- the same technique regex alone cannot do safely
 * once the body itself contains `{`/`}` (object literals, arrow functions).
 */
function extractMethodBody(source: string, declaration: string): string {
  const declIndex = source.indexOf(declaration);
  if (declIndex === -1) {
    throw new Error(`Could not find "${declaration}" in source`);
  }
  const bodyStart = source.indexOf('{', declIndex);
  let depth = 1;
  let i = bodyStart + 1;
  while (depth > 0) {
    if (i >= source.length) {
      throw new Error(`Unbalanced braces scanning "${declaration}"`);
    }
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(bodyStart + 1, i - 1);
}

const HANDLE_CONTEXT_ACTION_DECLARATION =
  'private handleContextAction(action: ContextAction, dye: Dye): void {';

/**
 * The five members REFACTOR-001 removed from swatch-tool.ts / mixer-tool.ts.
 * They remain valid `ContextAction` values (other tools still use them), so
 * a "cases must be members of CONTEXT_ACTIONS" check alone would not catch
 * one being re-added -- this list is the actual regression guard.
 */
const DEAD_LEGACY_ACTIONS: readonly ContextAction[] = [
  'add-comparison',
  'add-mixer',
  'add-accessibility',
  'see-harmonies',
  'budget',
];

const FILES: ReadonlyArray<{ name: string; source: string }> = [
  { name: 'swatch-tool.ts', source: read('swatch-tool.ts') },
  { name: 'mixer-tool.ts', source: read('mixer-tool.ts') },
];

describe('context action vocabulary (REFACTOR-001 guard)', () => {
  describe.each(FILES)('$name handleContextAction', ({ name, source }) => {
    const body = extractMethodBody(source, HANDLE_CONTEXT_ACTION_DECLARATION);
    const cases = [...body.matchAll(/case '([^']+)':/g)].map((m) => m[1]);

    it('handles at least one action (the extractor found the real method)', () => {
      expect(cases.length).toBeGreaterThan(0);
    });

    it('contains no case string outside CONTEXT_ACTIONS', () => {
      for (const action of cases) {
        expect(CONTEXT_ACTIONS as readonly string[]).toContain(action);
      }
    });

    it('no longer handles any of the deleted legacy navigate-to-tool actions', () => {
      for (const dead of DEAD_LEGACY_ACTIONS) {
        expect(cases).not.toContain(dead);
      }
    });

    it(`${name} no longer contains the 'navigate-to-tool' string anywhere`, () => {
      expect(source).not.toContain('navigate-to-tool');
    });
  });
});
