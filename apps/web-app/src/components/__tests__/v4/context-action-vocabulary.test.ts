/**
 * XIV Dye Tools - Context Action Vocabulary Guard (REFACTOR-001, DEAD-003)
 *
 * `ResultCard`'s own emitters (`handleSlotAction` / `handleMenuAction` in
 * `v4/result-card.ts`) only ever produce `inspect-*` / `transform-*` /
 * `external-*` / `add-mixer-slot-*` action strings. REFACTOR-001 deleted the
 * branches in swatch-tool.ts and mixer-tool.ts that handled legacy actions
 * no emitter produced, each dispatching a `window.dispatchEvent(new
 * CustomEvent(...))` cross-tool navigation event (see `LEGACY_EVENT_NAME`
 * below for the exact string, kept out of this file's prose on purpose):
 * 9 dispatch sites, 0 listeners. DEAD-003 then removed those legacy members
 * from `CONTEXT_ACTIONS` itself, with the handlers that remained in the
 * other tools, so a `case` for one of them no longer type-checks.
 *
 * This is a static, source-scanning regression guard in the same style as
 * `src/__tests__/font-contract.test.ts`: it reads the files as text rather
 * than mounting either component (both constructors need a large,
 * separately-maintained mock surface -- see swatch-tool.test.ts /
 * mixer-tool.test.ts -- and mounting buys nothing here since the actions
 * under test are handled without any DOM state).
 *
 * @module components/__tests__/v4/context-action-vocabulary.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTEXT_ACTIONS } from '../../v4/result-card';

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

const MIXER_SOURCE = read('mixer-tool.ts');

const FILES: ReadonlyArray<{ name: string; source: string }> = [
  { name: 'swatch-tool.ts', source: read('swatch-tool.ts') },
  { name: 'mixer-tool.ts', source: MIXER_SOURCE },
];

/**
 * The dead legacy branches each dispatched a `new CustomEvent(...)`
 * cross-tool navigation event, built here from parts rather than written as
 * a literal so this guard file itself never contains the event name as a
 * contiguous substring -- REFACTOR-001's own acceptance check is a `git
 * grep` for that exact string across `apps/web-app/src`, and a guard that
 * quoted the event name back in its own source would make that grep
 * non-empty again.
 */
const LEGACY_EVENT_NAME = ['navigate', 'to', 'tool'].join('-');

describe('context action vocabulary (REFACTOR-001 guard)', () => {
  describe('mixer-tool.ts handleContextAction', () => {
    const body = extractMethodBody(MIXER_SOURCE, HANDLE_CONTEXT_ACTION_DECLARATION);
    // Static text scan: only sees literal `case '...':` labels. A computed
    // or template-literal case value (not used anywhere in this codebase
    // today) would silently escape this check.
    const cases = [...body.matchAll(/case '([^']+)':/g)].map((m) => m[1]);

    it('handles at least one action (the extractor found the real method)', () => {
      expect(cases.length).toBeGreaterThan(0);
    });

    it('contains no case string outside CONTEXT_ACTIONS', () => {
      for (const action of cases) {
        expect(CONTEXT_ACTIONS as readonly string[]).toContain(action);
      }
    });
  });

  it.each(FILES)('$name no longer contains the legacy navigate event string anywhere', (file) => {
    expect(file.source).not.toContain(LEGACY_EVENT_NAME);
  });
});
