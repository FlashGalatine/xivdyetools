/**
 * The locale parity gate, under vitest — which is what makes it a gate.
 *
 * `npm run validate:i18n` has never run in a workflow: CI runs `turbo run lint
 * type-check test build`, and nothing in it calls `scripts/i18n-parity.mjs`. A
 * pull request that dropped a key from one locale, broke a `{placeholder}` or
 * left a value in English was green (found 2026-09-20, while looking for a home
 * for the same-English check). This file runs `checkParity()` on the shipped
 * locale files, so every ERROR the script prints now fails `test`:
 *
 *   - duplicate, missing, extra and empty keys, placeholder mismatches;
 *   - a value identical to English that is not allow-listed with a reason — the
 *     script only WARNS about these, and a warning nobody runs is not a check;
 *   - same English, two translations — outside `i18n-same-english-allowlist.json`;
 *   - stale entries in either allow-list.
 *
 * The other half of `validate:i18n` is `scripts/validate-i18n.js` — every key the
 * code references exists in en.json, and every locale keeps en.json's key order.
 * It prints and exits as it goes, so it is run here as the script it is rather
 * than rewritten into a library for the sake of a test: held to exit code 0 on
 * the shipped tree, and to exit code 1 with the right file and line on a fixture
 * tree (`--src`) whose typos only its exported-alias pass and whole-file scan can
 * see — the proof that the wiring between them and the patterns is live.
 *
 * The unit tests below feed `findSameEnglishDivergences` synthetic entries, and
 * `extractKeysFromSource` (how the validator finds a key) synthetic source, so
 * each rule is proven able to fail rather than assumed to.
 *
 * @module scripts/i18n-parity-gate.test
 */

import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import { checkParity, findSameEnglishDivergences, flattenEntries } from './i18n-parity.mjs';
import { extractKeysFromSource, findExportedAliases } from './i18n-key-patterns.mjs';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = join(APP_DIR, 'src', 'locales');
const VALIDATOR = join(APP_DIR, 'scripts', 'validate-i18n.js');

/** Run validate-i18n.js as CI would, with extra arguments. */
const runValidator = (...args) =>
  spawnSync(process.execPath, [VALIDATOR, ...args], { cwd: APP_DIR, encoding: 'utf-8' });

/**
 * The missing-key report, as `{ file, line, key }` rows: the validator prints a
 * `📄 <file>` heading, then one `Line <n>: "<key>"` row per miss.
 */
function parseMissingReport(stdout) {
  const rows = [];
  let file = null;
  for (const text of stdout.split(/\r?\n/)) {
    const heading = /^📄 (.+)$/u.exec(text);
    if (heading) file = heading[1];
    const row = /^\s+Line (\d+): "(.*)"$/.exec(text);
    if (row) rows.push({ file, line: Number(row[1]), key: row[2] });
  }
  return rows;
}

describe('validate-i18n.js (referenced keys exist, key order, stray whitespace)', () => {
  it('exits 0 on the shipped source and locale files', () => {
    const run = runValidator();
    // The script's own report is the failure message — it names the file, line and key.
    expect(run.status, `${run.stdout}\n${run.stderr}`.slice(-3000)).toBe(0);
  }, 60_000);

  describe('on a fixture tree (--src)', () => {
    // A source tree of three files and its own locales: one exported alias, one
    // file importing it, one wrapped call. Each file has a correct call and a
    // typo, so a run that checks too little and a run that checks too much both
    // show up in the exact list below.
    let srcDir;
    const en = {
      mixer: { startDye: 'Start Dye' },
      swatch: { dropTitle: 'Drop', slotSkin: 'Skin' },
    };
    const files = {
      'components/chara-ui.ts': [
        "import { LanguageService } from '@services/index';",
        '',
        'export function tSwatch(key: string): string {',
        '  return LanguageService.t(`swatch.${key}`);',
        '}',
        '',
        "export const skin = tSwatch('slotSkin');",
      ],
      'components/chara-file-card.ts': [
        "import { tSwatch } from './chara-ui';",
        '',
        "export const title = tSwatch('dropTitle');",
        "export const typo = tSwatch('dropTitel');",
      ],
      'components/mixer-panel.ts': [
        "import { LanguageService } from '@services/index';",
        '',
        'export const start = LanguageService.t(',
        "  'mixer.startDye'",
        ');',
        'export const typo = LanguageService.t(',
        "  'mixer.startDey'",
        ');',
      ],
    };

    beforeAll(() => {
      srcDir = mkdtempSync(join(tmpdir(), 'validate-i18n-'));
      mkdirSync(join(srcDir, 'components'));
      mkdirSync(join(srcDir, 'locales'));
      for (const [path, lines] of Object.entries(files)) {
        writeFileSync(join(srcDir, path), lines.join('\n') + '\n');
      }
      for (const locale of ['en', 'ja', 'de', 'fr', 'ko', 'zh']) {
        writeFileSync(join(srcDir, 'locales', `${locale}.json`), JSON.stringify(en, null, 2));
      }
    });

    afterAll(() => {
      if (srcDir) rmSync(srcDir, { recursive: true, force: true });
    });

    it('exits 1 naming the file and line of a wrapped-call typo and an imported-alias typo', () => {
      const run = runValidator('--src', srcDir);
      const report = `${run.stdout}\n${run.stderr}`.slice(-3000);
      expect(run.status, report).toBe(1);
      const rows = parseMissingReport(run.stdout).sort((a, b) => a.file.localeCompare(b.file));
      expect(rows, report).toEqual([
        // Only seen because the validator collects tSwatch from chara-ui.ts first.
        { file: join('components', 'chara-file-card.ts'), line: 4, key: 'swatch.dropTitel' },
        // The key sits on the line after its call.
        { file: join('components', 'mixer-panel.ts'), line: 7, key: 'mixer.startDey' },
      ]);
    }, 60_000);

    it('fails, rather than checking the shipped tree, when --src has no directory', () => {
      const run = runValidator('--src');
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('--src');
    }, 60_000);
  });

  it('sees both keys of a one / other pair, inside tCount or a helper that forwards them', () => {
    // Plural strings are chosen at run time (tCount, Intl.PluralRules), so the
    // keys reach t() through a variable. The pair itself is literal at the call.
    const source = [
      "tCount(n, 'swatch.footEmpty_one', 'swatch.footEmpty_other')",
      "phrase(fixed, 'glamour.verdict.segFixed_one', 'glamour.verdict.segFixed_other');",
      "LanguageService.t('glamour.verdict.head')",
      'tCount(',
      '  pieces.length,',
      "  'glamour.verdict.pieces_one',",
      "  'glamour.verdict.pieces_other'",
      ')',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'swatch.footEmpty_one', line: 1 },
      { key: 'swatch.footEmpty_other', line: 1 },
      { key: 'glamour.verdict.segFixed_one', line: 2 },
      { key: 'glamour.verdict.segFixed_other', line: 2 },
      { key: 'glamour.verdict.head', line: 3 },
      { key: 'glamour.verdict.pieces_one', line: 6 },
      { key: 'glamour.verdict.pieces_other', line: 7 },
    ]);
  });
});

describe('extractKeysFromSource (BUG-074: wrapped calls and aliases)', () => {
  // Every key reports the line it sits on, not the line its call starts on.

  it('sees a key prettier wrapped onto the next line, with or without a trailing comma', () => {
    const source = [
      '<p>${LanguageService.tInterpolate(',
      "  'common.loadingTool',",
      '  { tool: toolDisplayName(toolId) }',
      ')}</p>',
      'const label = LanguageService.t(',
      "  'mixer.startDye'",
      ');',
      'const other = LanguageService.t(',
      "  'mixer.endDye',",
      ');',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'common.loadingTool', line: 2 },
      { key: 'mixer.startDye', line: 6 },
      { key: 'mixer.endDye', line: 9 },
    ]);
  });

  it('reports a typo in a wrapped call as a key en.json does not have', () => {
    // The reproduction from the finding: a wrapped key misspelled passed the
    // validator, and the UI rendered the raw key.
    const en = flattenEntries(JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf-8')));
    const source = [
      'const label = LanguageService.t(',
      "  'mixer.startDye'",
      ');',
      'const typo = LanguageService.t(',
      "  'mixer.startDey'",
      ');',
    ].join('\n');
    expect(extractKeysFromSource(source).filter(({ key }) => !en.has(key))).toEqual([
      { key: 'mixer.startDey', line: 5 },
    ]);
  });

  it('sees both branches of a ternary first argument, and nothing from its condition', () => {
    const source = [
      'textContent: LanguageService.t(',
      "  range === 'Dark' ? 'swatch.rangeDark' : 'swatch.rangeLight'",
      '),',
      'countText.textContent = LanguageService.tInterpolate(',
      '  collections.length === 1',
      "    ? 'collections.collectionsCountOne'",
      "    : 'collections.collectionsCountMany',",
      '  { count: String(collections.length) }',
      ');',
      "const title = LanguageService.t(isStart(slot) ? 'gradient.clickToSelectStart' : 'gradient.clickToSelectEnd');",
    ].join('\n');
    const keys = extractKeysFromSource(source);
    expect(keys).toEqual([
      { key: 'swatch.rangeDark', line: 2 },
      { key: 'swatch.rangeLight', line: 2 },
      { key: 'collections.collectionsCountOne', line: 6 },
      { key: 'collections.collectionsCountMany', line: 7 },
      { key: 'gradient.clickToSelectStart', line: 10 },
      { key: 'gradient.clickToSelectEnd', line: 10 },
    ]);
    expect(keys.map(({ key }) => key)).not.toContain('Dark');
  });

  it('sees every value of an object map indexed in place, and none of its property names', () => {
    const source = [
      'return LanguageService.t(',
      '  {',
      "    noItem: 'glamour.row.blockedNoItem',",
      "    'dye': 'glamour.row.blockedDye',",
      "    wear: 'glamour.row.blockedWear'",
      '  }[problem]',
      ');',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'glamour.row.blockedNoItem', line: 3 },
      { key: 'glamour.row.blockedDye', line: 4 },
      { key: 'glamour.row.blockedWear', line: 5 },
    ]);
  });

  it('sees both branches of a map value that is itself a ternary, and nothing from its condition', () => {
    // Before: only the else literal matched, and 'm.two' was dropped silently.
    const source = [
      'LanguageService.t(',
      '  {',
      "    a: 'm.one',",
      "    'b': flag ? 'm.two' : 'm.three',",
      "    c: kind === 'x' ? 'm.four' : other ? 'm.five' : 'm.six',",
      "    d: picked ?? 'm.seven'",
      '  }[k]',
      ');',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'm.one', line: 3 },
      { key: 'm.two', line: 4 },
      { key: 'm.three', line: 4 },
      { key: 'm.four', line: 5 },
      { key: 'm.five', line: 5 },
      { key: 'm.six', line: 5 },
      { key: 'm.seven', line: 6 },
    ]);
  });

  it('sees the literal fallback after ?? in a first argument, and nothing to its left', () => {
    // chara-ui.ts slotErrorText and the preset tool's sort button had theirs unchecked.
    const source = [
      "return LanguageService.t(key ?? 'swatch.slotError.unknown');",
      "${LanguageService.t(sortKeys[this.config.sortBy] ?? 'preset.sort.popular')}",
      "LanguageService.tInterpolate(picked?.key ?? 'glamour.row.fixedWear', { n });",
      'LanguageService.t(',
      "  first ?? second ?? 'common.fallback',",
      ');',
      "const tCost = (k) => LanguageService.t('budget.' + k);",
      "cost.textContent = tCost(choice ?? 'withinBudget');",
      "LanguageService.t(lookup('notAKey') ?? fallback);",
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'swatch.slotError.unknown', line: 1 },
      { key: 'preset.sort.popular', line: 2 },
      { key: 'glamour.row.fixedWear', line: 3 },
      { key: 'common.fallback', line: 5 },
      { key: 'budget.withinBudget', line: 8 },
    ]);
  });

  it('takes nothing from a key built at run time', () => {
    // A template literal cannot be checked statically — not even its ternary.
    const source = [
      'stateChip.textContent = LanguageService.t(',
      "  `glamour.sheet.state${fresh === 'filled' ? 'Filled' : 'Blank'}`",
      ');',
      'LanguageService.t(keys[vision]);',
      "LanguageService.t('mixer.' + mode);",
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([]);
  });

  it('sees calls through a local alias: identity, prefixed, and as a function declaration', () => {
    const source = [
      'const t = (key: string) => LanguageService.t(key);',
      "badge.textContent = t('preset.signinHeadline');",
      'function render() {',
      '  const t = (key: string): string => LanguageService.t(`comparison.${key}`);',
      "  badge = t('badgeSame');",
      '}',
      "label = tLink('openIn');",
      'function tLink(key: string): string {',
      '  return LanguageService.t(`swatch.itemLinks.${key}`);',
      '}',
      "const tCost = (k) => LanguageService.t('budget.' + k);",
      'cost.textContent = tCost(',
      "  over ? 'overBudget' : 'withinBudget',",
      ');',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'preset.signinHeadline', line: 2 },
      { key: 'comparison.badgeSame', line: 5 },
      { key: 'swatch.itemLinks.openIn', line: 7 }, // a hoisted call before its function
      { key: 'budget.overBudget', line: 13 },
      { key: 'budget.withinBudget', line: 13 },
    ]);
  });

  it('gives each call the alias in force where it sits when one name is defined twice', () => {
    // metric-help.ts: two functions, each with its own `t` over a different namespace.
    const source = [
      'function pairHelp() {',
      '  const t = (key: string): string => LanguageService.t(`accessibility.${key}`);',
      "  link.textContent = t('learnMore');",
      '}',
      'function methodHelp() {',
      '  const t = (key: string): string => LanguageService.t(`comparison.${key}`);',
      "  link.textContent = t('methodsLearnMore');",
      '}',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'accessibility.learnMore', line: 3 },
      { key: 'comparison.methodsLearnMore', line: 7 },
    ]);
  });

  // An alias's prefix is lent by file offset, not lexical scope, so it must stop
  // at the next binding of its name — recognised as an alias or not. Lending it
  // on turned a correct call into a key en.json does not have (2026-10-04 review).
  const COMPARISON_T = 'const t = (key: string): string => LanguageService.t(`comparison.${key}`);';

  it('does not lend an alias to a later block-bodied rebinding of its name (P1)', () => {
    const source = [
      'function methodHelp() {',
      `  ${COMPARISON_T}`,
      "  link.textContent = t('methodsLearnMore');",
      '}',
      'function rangeLabel() {',
      '  const t = (key: string) => {',
      '    return LanguageService.t(`swatch.${key}`);',
      '  };',
      "  label.textContent = t('rangeDark');",
      '}',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([
      { key: 'comparison.methodsLearnMore', line: 3 },
    ]);
  });

  it('does not lend an alias to a later parameter of the same name (P2)', () => {
    const source = [
      COMPARISON_T,
      "badge.textContent = t('badgeSame');",
      'function trace(t: (message: string) => void): void {',
      "  t('just a log message');",
      '}',
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([{ key: 'comparison.badgeSame', line: 2 }]);
  });

  it.each([
    ['a let', 'let t = makeLogger();'],
    [
      'a function declaration it does not recognise',
      'function t(message: string, level: number) {',
    ],
    ['a destructured const', 'const { t } = i18next;'],
    ['an arrow parameter list', 'items.forEach((item: Item, t: Logger) => {'],
    ['a bare arrow parameter', 'items.forEach(t => {'],
    ['a destructured parameter', 'const render = ({ t }: Props) => {'],
    ['a method parameter', '  log(t: Logger): void {'],
    ['a catch clause', '} catch (t) {'],
  ])('does not lend an alias past %s binding its name', (_shape, rebinding) => {
    const source = [
      COMPARISON_T,
      "badge.textContent = t('badgeSame');",
      rebinding,
      "  t('just a log message');",
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([{ key: 'comparison.badgeSame', line: 2 }]);
  });

  it('does not lend an alias to an earlier binding of its name', () => {
    // A hoisted alias reaches back to the top of the file only when nothing
    // else binds the name before it.
    const source = [
      'function trace(t: (message: string) => void): void {',
      "  t('just a log message');",
      '}',
      COMPARISON_T,
      "badge.textContent = t('badgeSame');",
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([{ key: 'comparison.badgeSame', line: 5 }]);
  });

  it('keeps lending an alias past a call that passes it, a member and a condition', () => {
    // None of these binds the name, so the alias stays in force after them.
    const source = [
      COMPARISON_T,
      'items.map(t);',
      'this.t = other;',
      'if (t) {',
      '}',
      "badge.textContent = t('badgeSame');",
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([{ key: 'comparison.badgeSame', line: 6 }]);
  });

  it('does not take a method or a longer name for an alias', () => {
    const source = [
      'const t = (key: string) => LanguageService.t(`swatch.${key}`);',
      "const box = document.createElement('div');",
      "this.t('notAnAliasCall');",
      "const parsed = format('raw');",
    ].join('\n');
    expect(extractKeysFromSource(source)).toEqual([]);
  });

  it('sees an exported alias where it is defined and in every file that imports it', () => {
    const charaUi = [
      '/** A `swatch.*` string. */',
      'export function tSwatch(key: string): string {',
      '  return LanguageService.t(`swatch.${key}`);',
      '}',
      "const label = tSwatch('slotSkin');",
    ].join('\n');
    const exported = findExportedAliases(charaUi).map((alias) => ({
      module: 'chara-ui',
      ...alias,
    }));
    expect(exported).toEqual([{ module: 'chara-ui', name: 'tSwatch', prefix: 'swatch.' }]);
    expect(extractKeysFromSource(charaUi, exported)).toEqual([{ key: 'swatch.slotSkin', line: 5 }]);

    const importer = [
      'import {',
      '  type CharaSlot,',
      '  tSwatch,',
      '  winningHex,',
      "} from '@components/chara-ui';",
      "import { tSwatch as ts } from './chara-ui.js';",
      '',
      "title.textContent = tSwatch('dropTitle');",
      "body.textContent = ts('dropBody');",
    ].join('\n');
    expect(extractKeysFromSource(importer, exported)).toEqual([
      { key: 'swatch.dropTitle', line: 8 },
      { key: 'swatch.dropBody', line: 9 },
    ]);
    // Without the exporting file's aliases, an importer's calls are not keys.
    expect(extractKeysFromSource(importer)).toEqual([]);
  });

  it('does not lend an imported alias past a parameter that shadows its name', () => {
    const exported = [{ module: 'chara-ui', name: 'tSwatch', prefix: 'swatch.' }];
    const source = [
      "import { tSwatch } from './chara-ui';",
      "title.textContent = tSwatch('dropTitle');",
      'function trace(tSwatch: (message: string) => void): void {',
      "  tSwatch('just a log message');",
      '}',
    ].join('\n');
    expect(extractKeysFromSource(source, exported)).toEqual([{ key: 'swatch.dropTitle', line: 2 }]);
  });

  it('does not lend an exported alias to a file importing the same name from another module', () => {
    const exported = [{ module: 'chara-ui', name: 'tSwatch', prefix: 'swatch.' }];
    const source = [
      "import { tSwatch } from '@components/other-ui';",
      "tSwatch('dropTitle');",
    ].join('\n');
    expect(extractKeysFromSource(source, exported)).toEqual([]);
  });

  it('exports only the aliases a file exports', () => {
    const source = [
      'const t = (key: string) => LanguageService.t(key);',
      "export const tPreset = (key: string): string => LanguageService.t('preset.' + key);",
      'export function notAnAlias(key: string): string {',
      '  return LanguageService.t(key ?? FALLBACK);',
      '}',
    ].join('\n');
    expect(findExportedAliases(source)).toEqual([{ name: 'tPreset', prefix: 'preset.' }]);
  });
});

describe('locale parity (the shipped files)', () => {
  const report = checkParity();

  it('en.json has no duplicate keys', () => {
    expect(report.reference.duplicates).toEqual([]);
  });

  for (const locale of report.locales) {
    describe(locale.locale, () => {
      it('has the same keys as en.json, none duplicated, none empty', () => {
        expect(locale.duplicates).toEqual([]);
        expect(locale.missing).toEqual([]);
        expect(locale.extra).toEqual([]);
        expect(locale.empty).toEqual([]);
      });

      it('carries the same {placeholders} as en.json', () => {
        expect(locale.placeholderMismatch).toEqual([]);
      });

      it('leaves no value in English without an allow-listed reason', () => {
        expect(locale.identicalUnexpected).toEqual([]);
        expect(locale.staleAllowlist).toEqual([]);
      });
    });
  }

  it('gives keys that share one English value one translation per locale', () => {
    // Translate the group one way, or list it in i18n-same-english-allowlist.json
    // with the two jobs the English word is doing.
    expect(report.sameEnglish.unexpected).toEqual([]);
  });

  it('keeps the same-English allow-list free of entries that no longer diverge', () => {
    expect(report.sameEnglish.stale).toEqual([]);
  });

  it('is looking at real groups, not an empty set', () => {
    // A check that cannot see a thing reports the thing is fine.
    expect(report.sameEnglish.groups).toBeGreaterThan(40);
    expect(report.sameEnglish.divergences.length).toBeGreaterThan(0);
  });
});

describe('findSameEnglishDivergences', () => {
  const en = new Map([
    ['a.clear', 'Clear'],
    ['b.clear', 'Clear'],
    ['a.save', 'Save'],
    ['b.save', 'Save'],
    ['c.only', 'Only once'],
    ['d.count', 3],
    ['e.blank', ''],
    ['f.blank', ''],
  ]);
  const locales = (de) => new Map([['de', new Map(de)]]);

  it('reports a group translated two ways, with the keys behind each value', () => {
    const result = findSameEnglishDivergences(
      en,
      locales([
        ['a.clear', 'Leeren'],
        ['b.clear', 'Klar'],
        ['a.save', 'Speichern'],
        ['b.save', 'Speichern'],
      ]),
      {}
    );
    expect(result.groups).toBe(2); // Clear, Save — not the singleton, the number or the blanks
    expect(result.unexpected).toEqual([
      {
        english: 'Clear',
        locale: 'de',
        allowed: false,
        clusters: [
          { value: 'Leeren', keys: ['a.clear'] },
          { value: 'Klar', keys: ['b.clear'] },
        ],
      },
    ]);
  });

  it('accepts a group allow-listed for that locale, or for "*"', () => {
    const de = [
      ['a.clear', 'Leeren'],
      ['b.clear', 'Klar'],
      ['a.save', 'Speichern'],
      ['b.save', 'Merken'],
    ];
    const result = findSameEnglishDivergences(en, locales(de), {
      Clear: { '*': 'verb vs adjective' },
      Save: { de: 'form save vs bookmark' },
    });
    expect(result.divergences).toHaveLength(2);
    expect(result.unexpected).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('does not let an entry for another locale excuse this one', () => {
    const result = findSameEnglishDivergences(
      en,
      locales([
        ['a.clear', 'Leeren'],
        ['b.clear', 'Klar'],
      ]),
      { Clear: { fr: 'verb vs adjective' } }
    );
    expect(result.unexpected.map((d) => d.locale)).toEqual(['de']);
    expect(result.stale).toEqual([{ english: 'Clear', locale: 'fr' }]);
  });

  it('reports an allow-list entry whose group has been unified', () => {
    const result = findSameEnglishDivergences(
      en,
      locales([
        ['a.clear', 'Leeren'],
        ['b.clear', 'Leeren'],
      ]),
      { Clear: { '*': 'verb vs adjective' } }
    );
    expect(result.unexpected).toEqual([]);
    expect(result.stale).toEqual([{ english: 'Clear', locale: '*' }]);
  });

  it('leaves a missing key to the MISSING check instead of calling it a split', () => {
    const result = findSameEnglishDivergences(en, locales([['a.clear', 'Leeren']]), {});
    expect(result.divergences).toEqual([]);
  });
});

describe('German register', () => {
  // The web app, the bot and all four German policy documents address the user
  // as "du". de.json said "Sie" in 48 strings until 2026-09-20 — the five oldest
  // namespaces, never revisited. Formal address is always capitalised, which is
  // what makes it findable.
  const THIRD_PERSON = new Set([
    // "Vorlage eingereicht! Sie wird … angezeigt." — sie = die Vorlage
    'preset.submittedPendingReview',
  ]);

  it('never addresses the user formally', () => {
    const de = flattenEntries(JSON.parse(readFileSync(join(LOCALES_DIR, 'de.json'), 'utf-8')));
    const formal = [...de]
      .filter(([key, value]) => typeof value === 'string' && !THIRD_PERSON.has(key))
      .filter(([, value]) => /(?<![\p{L}])(Sie|Ihr|Ihre[mnrs]?|Ihnen)(?![\p{L}])/u.test(value))
      .map(([key]) => key);
    expect(formal).toEqual([]);
  });
});
