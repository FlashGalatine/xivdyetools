#!/usr/bin/env tsx
/**
 * Tests for the docblock-attribution and exported-symbol logic in
 * scripts/check-dead-code.ts, run through node:test via the tsx already
 * present as a root devDependency — no new dependency, no new config file.
 * `pnpm test:scripts` runs this file; root `test` (`turbo run test`) only
 * reaches workspaces and never touches `scripts/`.
 *
 * The bulk of these are table-driven against `docblockAbove` plus the tag
 * helpers: feed a small source string and a declaration-line index, assert
 * the observable outcome — never re-implement the parsing being tested.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  attributeLinesToBlockFrames,
  attributeLinesToBlocks,
  declarationLines,
  docblockAbove,
  entrypointReason,
  findOrphanModules,
  findTestOnlyExports,
  findTestOnlyMembers,
  hasBareTag,
  isExcludedReferrer,
  isPublic,
  leadingDocblock,
  maskSource,
  subsumeMembersByOwner,
  testOnlyReason,
} from './check-dead-code.js';
import type { MemberFindings } from './check-dead-code.js';

type DocCase = {
  name: string;
  lines: string[];
  declIndex: number;
  check: (doc: string) => void;
};

const cases: DocCase[] = [
  {
    name: '1. docblock immediately above the declaration attaches',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly reason one',
      ' */',
      'export function a(): void {}',
    ],
    declIndex: 5,
    check: (doc) => assert.equal(testOnlyReason(doc), 'reason one'),
  },
  {
    name: '2. bug A: a blank line before the declaration still attaches',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly reason two',
      ' */',
      '',
      'export function b(): void {}',
    ],
    declIndex: 6,
    check: (doc) => assert.equal(testOnlyReason(doc), 'reason two'),
  },
  {
    name: '3. bug B: a blank line + decorator before the declaration still attaches',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly reason three',
      ' */',
      '',
      "@customElement('my-el')",
      'export class C {}',
    ],
    declIndex: 7,
    check: (doc) => assert.equal(testOnlyReason(doc), 'reason three'),
  },
  {
    name: '4a. finding E: a leading docblock + blank line does not attach (matches _middleware.ts shape)',
    lines: [
      '/**',
      ' * Cloudflare Pages middleware.',
      ' *',
      ' * @entrypoint file-level reason',
      ' */',
      '',
      'export async function onRequest(): Promise<void> {}',
    ],
    declIndex: 6,
    check: (doc) => {
      assert.equal(doc, '');
      assert.equal(entrypointReason(doc), null);
    },
  },
  {
    name: '4b. finding E: a leading docblock is refused with no blank line either (isolates E from bug A)',
    lines: [
      '/**',
      ' * File-level description.',
      ' * @testonly file-level reason',
      ' */',
      'export function firstThing(): void {}',
    ],
    declIndex: 4,
    check: (doc) => assert.equal(doc, ''),
  },
  {
    name: '5. bug C: a single-line /** @testonly reason */ docblock is recognized',
    lines: ['const noop = 1;', '', '/** @testonly reason five */', 'export function e(): void {}'],
    declIndex: 3,
    check: (doc) => assert.equal(testOnlyReason(doc), 'reason five'),
  },
  {
    name: '6. a bare @testonly with no reason is hasBareTag, not exempt',
    lines: ['const noop = 1;', '', '/**', ' * @testonly', ' */', 'export function f(): void {}'],
    declIndex: 5,
    check: (doc) => {
      assert.equal(testOnlyReason(doc), null);
      assert.equal(hasBareTag(doc), true);
    },
  },
  {
    name: '7. @testonlyish and a mid-sentence prose mention are not matched',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonlyish nonsense',
      ' * derived from the old @testonly annotations',
      ' */',
      'export function g(): void {}',
    ],
    declIndex: 6,
    check: (doc) => {
      assert.equal(testOnlyReason(doc), null);
      assert.equal(hasBareTag(doc), false);
    },
  },
  {
    name: '8a. @entrypoint with a valid reason exempts',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @entrypoint valid reason here',
      ' */',
      'export function h(): void {}',
    ],
    declIndex: 5,
    check: (doc) => assert.equal(entrypointReason(doc), 'valid reason here'),
  },
  {
    name: '8b. a bare @entrypoint with no reason is hasBareTag, not exempt',
    lines: ['const noop = 1;', '', '/**', ' * @entrypoint', ' */', 'export function i(): void {}'],
    declIndex: 5,
    check: (doc) => {
      assert.equal(entrypointReason(doc), null);
      assert.equal(hasBareTag(doc), true);
    },
  },
  {
    name: '10. prelude 1a: a reason wrapped across two continuation lines joins with a single space',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly This is a long reason that',
      ' * wraps onto a second line.',
      ' */',
      'export function j(): void {}',
    ],
    declIndex: 6,
    check: (doc) =>
      assert.equal(testOnlyReason(doc), 'This is a long reason that wraps onto a second line.'),
  },
  {
    name: '11. prelude 1b: a reason on the line after a bare-looking @tag is captured, not bare',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly',
      ' * Because the availability probe is memoized.',
      ' */',
      'export function k(): void {}',
    ],
    declIndex: 6,
    check: (doc) => {
      assert.equal(hasBareTag(doc), false);
      assert.equal(testOnlyReason(doc), 'Because the availability probe is memoized.');
    },
  },
  {
    name: '12. prelude 1: no reason anywhere in the docblock (incl. a blank interior line) stays bare',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly',
      ' *',
      ' */',
      'export function l(): void {}',
    ],
    declIndex: 6,
    check: (doc) => {
      assert.equal(testOnlyReason(doc), null);
      assert.equal(hasBareTag(doc), true);
    },
  },
  {
    name: '13. prelude 1: a second @tag after a wrapped reason stops the first reason there',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly reason for testonly,',
      ' * continued here',
      ' * @entrypoint reason for entrypoint',
      ' */',
      'export function m(): void {}',
    ],
    declIndex: 7,
    check: (doc) => {
      assert.equal(testOnlyReason(doc), 'reason for testonly, continued here');
      assert.equal(entrypointReason(doc), 'reason for entrypoint');
    },
  },
  {
    name: '14. prelude 3 (NEW-2 regression guard): a bare single-line /** @testonly */ is bare, reason null',
    lines: ['const noop = 1;', '', '/** @testonly */', 'export function n(): void {}'],
    declIndex: 3,
    check: (doc) => {
      assert.equal(testOnlyReason(doc), null);
      assert.equal(hasBareTag(doc), true);
    },
  },
  {
    name: '15. prelude 2 (NEW-1): a multi-line decorator argument list is skipped as a unit, so the docblock still attaches',
    lines: [
      'const noop = 1;',
      '',
      '/**',
      ' * @testonly reason fifteen',
      ' */',
      '',
      '@customElement(',
      "  'my-element'",
      ')',
      'export class Foo {}',
    ],
    declIndex: 9,
    check: (doc) => assert.equal(testOnlyReason(doc), 'reason fifteen'),
  },
];

for (const c of cases) {
  test(c.name, () => {
    c.check(docblockAbove(c.lines, c.declIndex));
  });
}

test('leadingDocblock returns the file header — the same block docblockAbove refuses to reuse', () => {
  const text = [
    '/**',
    ' * File-level description.',
    ' * @testonly file-level reason',
    ' */',
    'export function firstThing(): void {}',
  ].join('\n');
  assert.equal(
    leadingDocblock(text),
    '/**\n * File-level description.\n * @testonly file-level reason\n */',
  );
  assert.equal(docblockAbove(text.split('\n'), 4), '');
});

test('9a. bug D: a tagged overload gets exactly one exempt verdict, not one per signature', () => {
  const prodFile = 'src/over.ts';
  const testFile = 'src/over.test.ts';
  const prodText = [
    '// unrelated preface line',
    '',
    '/**',
    ' * @testonly overload reason',
    ' */',
    'export function over(a: string): string;',
    'export function over(a: number): number;',
    'export function over(a: any): any {',
    '  return a;',
    '}',
  ].join('\n');
  const testText = "import { over } from './over';\nover(1);\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyExports([prodFile], [testFile], texts);
  assert.equal(result.violations.filter((v) => v.file === prodFile && v.name === 'over').length, 0);
  assert.equal(result.testOnlyExempt.filter((e) => e === `${prodFile}:over`).length, 1);
});

test('9b. bug D: an untagged overload gets exactly one violation, not one per signature', () => {
  const prodFile = 'src/over2.ts';
  const testFile = 'src/over2.test.ts';
  const prodText = [
    '// unrelated preface line',
    '',
    'export function over2(a: string): string;',
    'export function over2(a: number): number;',
    'export function over2(a: any): any {',
    '  return a;',
    '}',
  ].join('\n');
  const testText = "import { over2 } from './over2';\nover2(1);\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyExports([prodFile], [testFile], texts);
  assert.equal(
    result.violations.filter((v) => v.file === prodFile && v.name === 'over2').length,
    1,
  );
});

test('prelude 1a (live instance): _middleware.ts now captures its full two-line @entrypoint reason', () => {
  // The concrete case that motivated the multi-line reason fix: before it, this
  // file's reason silently truncated to "No importer by design — Pages loads
  // this by path convention from" at the line break. Read from disk (not
  // reconstructed inline) so this test fails if the real file's docblock ever
  // drifts from what it asserts.
  const text = readFileSync('apps/web-app/functions/_middleware.ts', 'utf8');
  const doc = leadingDocblock(text);
  assert.equal(
    entrypointReason(doc),
    'No importer by design — Pages loads this by path convention from functions/, so static analysis cannot see the call site.',
  );
});

// ============================================================================
// findTestOnlyMembers — class-member granularity (Task 6)
// ============================================================================

test('16. findTestOnlyMembers: a method referenced only by tests is a violation', () => {
  const prodFile = 'src/widget.ts';
  const testFile = 'src/widget.test.ts';
  const prodText = [
    'export class Widget {',
    '  doThing(): void {',
    '    // no-op',
    '  }',
    '}',
  ].join('\n');
  const testText = "import { Widget } from './widget';\nnew Widget().doThing();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].file, prodFile);
  // Qualified with its declaring type (fix-1 item 1) even though there's only
  // one class in this file — qualification doesn't depend on ambiguity.
  assert.equal(result.violations[0].name, 'Widget.doThing');
  assert.equal(result.violations[0].kind, 'member');
});

test('17. findTestOnlyMembers: a method called via this.x() from a sibling method is not a violation', () => {
  // False-positive guard #1 named in the task: an internal self-call must count
  // as production use even though the only OTHER reference is from a test.
  const prodFile = 'src/widget2.ts';
  const testFile = 'src/widget2.test.ts';
  const prodText = [
    'export class Widget2 {',
    '  run(): void {',
    '    this.helper();',
    '  }',
    '  helper(): void {',
    '    // no-op',
    '  }',
    '}',
  ].join('\n');
  const testText = "import { Widget2 } from './widget2';\nnew Widget2().helper();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.filter((v) => v.name === 'helper').length, 0);
  assert.equal(result.testOnlyExempt.filter((e) => e.endsWith(':helper')).length, 0);
});

test('18. findTestOnlyMembers: a method called through an interface-typed variable is not a violation', () => {
  // False-positive guard #2 named in the task: a call through an interface-typed
  // receiver is still literally `.process` in the source text.
  const prodFile = 'src/widget3.ts';
  const testFile = 'src/widget3.test.ts';
  const prodText = [
    'interface IWidget3 {',
    '  process(): void;',
    '}',
    '',
    'export class Widget3 implements IWidget3 {',
    '  process(): void {',
    '    // no-op',
    '  }',
    '}',
    '',
    'export function runIt(w: IWidget3): void {',
    '  w.process();',
    '}',
  ].join('\n');
  const testText = "import { Widget3 } from './widget3';\nnew Widget3().process();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.filter((v) => v.name === 'process').length, 0);
});

test('19. findTestOnlyMembers: private and protected members are excluded, never reported', () => {
  const prodFile = 'src/widget4.ts';
  const testFile = 'src/widget4.test.ts';
  const prodText = [
    'export class Widget4 {',
    '  private secretThing(): void {}',
    '  protected guardedThing(): void {}',
    '}',
  ].join('\n');
  // Even a textual `.name` reference in a test must not surface these — they
  // can never be reached from outside the class, so nothing legitimately
  // reaches them by that syntax; a test that appears to is not a real call site.
  const testText = [
    "import { Widget4 } from './widget4';",
    'const w = Widget4 as unknown as { secretThing(): void; guardedThing(): void };',
    'w.secretThing();',
    'w.guardedThing();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.equal(result.testOnlyExempt.length, 0);
  assert.equal(result.entrypointExempt.length, 0);
});

test('20. findTestOnlyMembers: a #-prefixed true-private member is never reported', () => {
  // MEMBER_DECL's name capture is [A-Za-z_]\w* — a `#`-prefixed name never
  // matches it in the first place, so this is invisible to the scan from the
  // start (the explicit name.startsWith('#') guard is defense in depth for the
  // same outcome). This test pins the observable result, not the mechanism.
  const prodFile = 'src/widget5.ts';
  const testFile = 'src/widget5.test.ts';
  const prodText = ['export class Widget5 {', '  #trulyPrivate(): void {}', '}'].join('\n');
  const testText = 'w.#trulyPrivate();\n';
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
});

test('21. findTestOnlyMembers: control-flow keywords at member indentation are not mistaken for methods', () => {
  const prodFile = 'src/widget6.ts';
  const testFile = 'src/widget6.test.ts';
  const prodText = [
    'export class Widget6 {',
    '  run(): void {',
    '    if (true) {',
    '      doStuff();',
    '    }',
    '    switch (1) {',
    '      default:',
    '        break;',
    '    }',
    '  }',
    '}',
  ].join('\n');
  // Nonsense call shapes: if MEMBER_SKIP did not exclude "if"/"switch", these
  // would otherwise register as test references to fake members named after
  // the keywords.
  const testText = 'w.if(); w.switch();\n';
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'if' || v.name === 'switch'),
    false,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e.endsWith(':if') || e.endsWith(':switch')),
    false,
  );
});

test('22. findTestOnlyMembers: a file with no exported class is never scanned (object-literal methods ignored)', () => {
  const prodFile = 'src/config-object.ts';
  const testFile = 'src/config-object.test.ts';
  const prodText = [
    'export const handlers = {',
    '  doThing(): void {',
    '    // no-op',
    '  },',
    '};',
  ].join('\n');
  const testText = "import { handlers } from './config-object';\nhandlers.doThing();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.equal(result.testOnlyExempt.length, 0);
  assert.equal(result.entrypointExempt.length, 0);
});

test('23. findTestOnlyMembers: a valid @testonly reason exempts a member', () => {
  const prodFile = 'src/widget7.ts';
  const testFile = 'src/widget7.test.ts';
  const prodText = [
    'export class Widget7 {',
    '  /**',
    '   * @testonly only used to reset state between test runs',
    '   */',
    '  resetForTesting(): void {}',
    '}',
  ].join('\n');
  const testText = "import { Widget7 } from './widget7';\nnew Widget7().resetForTesting();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.testOnlyExempt, [`${prodFile}:Widget7.resetForTesting`]);
  assert.equal(result.entrypointExempt.length, 0);
});

test('24. findTestOnlyMembers: a valid @entrypoint reason exempts a member', () => {
  const prodFile = 'src/widget8.ts';
  const testFile = 'src/widget8.test.ts';
  const prodText = [
    'export class Widget8 {',
    '  /**',
    '   * @entrypoint invoked by an external harness by convention',
    '   */',
    '  externalHook(): void {}',
    '}',
  ].join('\n');
  const testText = "import { Widget8 } from './widget8';\nnew Widget8().externalHook();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.entrypointExempt, [`${prodFile}:Widget8.externalHook`]);
  assert.equal(result.testOnlyExempt.length, 0);
});

test('25. findTestOnlyMembers: a bare @testonly with no reason still fails as a violation', () => {
  const prodFile = 'src/widget9.ts';
  const testFile = 'src/widget9.test.ts';
  const prodText = [
    'export class Widget9 {',
    '  /**',
    '   * @testonly',
    '   */',
    '  resetForTesting(): void {}',
    '}',
  ].join('\n');
  const testText = "import { Widget9 } from './widget9';\nnew Widget9().resetForTesting();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].name, 'Widget9.resetForTesting');
  assert.equal(result.testOnlyExempt.length, 0);
});

test('26. findTestOnlyMembers: a getter/setter pair shares one name and gets exactly one exempt verdict', () => {
  const prodFile = 'src/widget10.ts';
  const testFile = 'src/widget10.test.ts';
  const prodText = [
    'export class Widget10 {',
    '  /**',
    '   * @testonly the whole accessor pair only exists for test setup',
    '   */',
    '  get color(): string {',
    '    return this._color;',
    '  }',
    '',
    '  set color(v: string) {',
    '    this._color = v;',
    '  }',
    '',
    '  private _color = "red";',
    '}',
  ].join('\n');
  const testText =
    "import { Widget10 } from './widget10';\nconst w = new Widget10();\nw.color = 'blue';\nw.color;\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.filter((v) => v.name === 'Widget10.color').length, 0);
  assert.deepEqual(
    result.testOnlyExempt.filter((e) => e === `${prodFile}:Widget10.color`),
    [`${prodFile}:Widget10.color`],
  );
});

test('27. findTestOnlyMembers: an untagged getter/setter pair gets exactly one violation, not two', () => {
  const prodFile = 'src/widget11.ts';
  const testFile = 'src/widget11.test.ts';
  const prodText = [
    'export class Widget11 {',
    '  get label(): string {',
    '    return this._label;',
    '  }',
    '',
    '  set label(v: string) {',
    '    this._label = v;',
    '  }',
    '',
    '  private _label = "x";',
    '}',
  ].join('\n');
  const testText =
    "import { Widget11 } from './widget11';\nconst w = new Widget11();\nw.label = 'y';\nw.label;\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.filter((v) => v.name === 'Widget11.label').length, 1);
});

test('28. findTestOnlyMembers: a member reached only via bracket-notation string access in prod is not falsely flagged', () => {
  // False-positive guard #3 named in the task: "dynamically by string". A
  // literal-string bracket key in production must count as a real call site
  // even though a test happens to call the same member with dot syntax.
  const prodFile = 'src/widget12.ts';
  const testFile = 'src/widget12.test.ts';
  const prodText = [
    'export class Widget12 {',
    '  dynamicThing(): void {}',
    '}',
    '',
    'export function dispatch(w: Widget12): void {',
    "  (w as unknown as Record<string, () => void>)['dynamicThing']();",
    '}',
  ].join('\n');
  const testText = "import { Widget12 } from './widget12';\nnew Widget12().dynamicThing();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.filter((v) => v.name === 'dynamicThing').length, 0);
});

// ============================================================================
// fix-1: declaring-type-aware grouping (item 1), import-scoped test refs
// (item 3), and @public (item 4)
// ============================================================================

test('29. findTestOnlyMembers: two classes sharing a member name are grouped separately — only the tagged one is exempt', () => {
  const prodFile = 'src/two-classes.ts';
  const testFile = 'src/two-classes.test.ts';
  const prodText = [
    'export class Alpha {',
    '  /**',
    '   * @testonly alpha-specific test hook',
    '   */',
    '  reset(): void {}',
    '}',
    '',
    'class Beta {',
    '  reset(): void {}',
    '}',
  ].join('\n');
  const testText = [
    "import { Alpha } from './two-classes';",
    'const a = new Alpha();',
    'a.reset();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Both are textually `.reset` so both get the SAME testRefs (usage detection
  // has no notion of which class a call site binds to) -- but the VERDICT must
  // differ: Alpha's is tagged and exempt, Beta's is untagged and a violation.
  assert.deepEqual(result.testOnlyExempt, [`${prodFile}:Alpha.reset`]);
  assert.equal(result.violations.filter((v) => v.name === 'Beta.reset').length, 1);
  // The pre-fix grouping (by name alone) would have merged these into one
  // entry keyed by "reset", producing either a contradictory pair (one exempt
  // AND one violation for the literal same string) or silently exempting
  // Beta.reset under a reason that only describes Alpha.
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:reset`),
    false,
  );
});

test('30. findTestOnlyMembers: an interface signature and a class method sharing a name are not merged', () => {
  const prodFile = 'src/iface.ts';
  const testFile = 'src/iface.test.ts';
  const prodText = [
    'export interface Greeter {',
    '  greet(): string;',
    '}',
    '',
    'export class EnglishGreeter implements Greeter {',
    '  /**',
    '   * @testonly only ever driven from the test suite',
    '   */',
    '  greet(): string {',
    '    return "hello";',
    '  }',
    '}',
  ].join('\n');
  const testText = [
    "import { EnglishGreeter } from './iface';",
    'new EnglishGreeter().greet();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // EnglishGreeter.greet is tagged and exempt.
  assert.deepEqual(result.testOnlyExempt, [`${prodFile}:EnglishGreeter.greet`]);
  // Greeter.greet (the interface signature) is a SEPARATE finding, not
  // silently exempted by the implementing class's tag.
  assert.equal(result.violations.filter((v) => v.name === 'Greeter.greet').length, 1);
});

test('31. findTestOnlyMembers: a test file that does not import the declaring module does not count as a reference', () => {
  const prodFile = 'src/real-target.ts';
  const otherProdFile = 'src/unrelated.ts';
  const unrelatedTestFile = 'src/unrelated-thing.spec.ts';
  const prodText = ['export class RealTarget {', '  doSomething(): void {}', '}'].join('\n');
  const otherProdText = ['export class Unrelated {', '  doSomething(): void {}', '}'].join('\n');
  // This test file never imports real-target.ts -- it happens to call a
  // same-named method on a completely different class (the way Playwright's
  // own Locator type's isVisible method collided with BaseComponent's
  // isVisible in the real repo).
  const unrelatedTestText = [
    "import { Unrelated } from './unrelated';",
    'new Unrelated().doSomething();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [otherProdFile, otherProdText],
    [unrelatedTestFile, unrelatedTestText],
  ]);
  const result = findTestOnlyMembers([prodFile, otherProdFile], [unrelatedTestFile], texts);
  // RealTarget.doSomething has zero genuine test references -- the only test
  // file textually matching `.doSomething` never imports real-target.ts --
  // that is knip's job, not a violation here.
  assert.equal(
    result.violations.some((v) => v.file === prodFile),
    false,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e.startsWith(prodFile)),
    false,
  );
  assert.equal(
    result.entrypointExempt.some((e) => e.startsWith(prodFile)),
    false,
  );
});

test('32. isPublic: a bare /** @public */ is exempt-eligible and hasBareTag is false', () => {
  const lines = ['const noop = 1;', '', '/** @public */', 'export function pub(): void {}'];
  const doc = docblockAbove(lines, 3);
  assert.equal(isPublic(doc), true);
  assert.equal(hasBareTag(doc), false);
});

test('33. hasBareTag: adding @public does not weaken bare @testonly enforcement', () => {
  const lines = [
    'const noop = 1;',
    '',
    '/**',
    ' * @testonly',
    ' */',
    'export function f2(): void {}',
  ];
  const doc = docblockAbove(lines, 5);
  assert.equal(hasBareTag(doc), true);
  assert.equal(testOnlyReason(doc), null);
  assert.equal(isPublic(doc), false);
});

test('34. findOrphanModules: a bare @public file is publicExempt, not a violation', () => {
  const prodFile = 'src/public-file.ts';
  const testFile = 'src/public-file.test.ts';
  const prodText = ['/**', ' * @public', ' */', 'export function helper(): void {}'].join('\n');
  const testText = "import { helper } from './public-file';\nhelper();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findOrphanModules([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.publicExempt, [prodFile]);
});

test('35. findTestOnlyExports: a bare @public export is publicExempt, not a violation', () => {
  const prodFile = 'src/public-export.ts';
  const testFile = 'src/public-export.test.ts';
  // A preceding line keeps this from being the file's OWN leading docblock --
  // docblockAbove deliberately refuses to reuse that one for symbol-level
  // attribution (see leadingDocblock's own file-granularity job), same as
  // every other findTestOnlyExports fixture in this file does.
  const prodText = [
    'const noop = 1;',
    '',
    '/**',
    ' * @public',
    ' */',
    'export function helper2(): void {}',
  ].join('\n');
  const testText = "import { helper2 } from './public-export';\nhelper2();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyExports([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.publicExempt, [`${prodFile}:helper2`]);
});

test('36. findTestOnlyMembers: a bare @public member is publicExempt, not a violation', () => {
  const prodFile = 'src/public-member.ts';
  const testFile = 'src/public-member.test.ts';
  const prodText = [
    'export class PublicApi {',
    '  /**',
    '   * @public',
    '   */',
    '  helper3(): void {}',
    '}',
  ].join('\n');
  const testText = "import { PublicApi } from './public-member';\nnew PublicApi().helper3();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.publicExempt, [`${prodFile}:PublicApi.helper3`]);
});

// ============================================================================
// fix-2: attributeLinesToBlocks must not desync on strings/comments/templates
// (item 1a), must resync on a column-0 declaration (item 1b), and the
// per-member subsumption decision is directly testable (item 2)
// ============================================================================

test("37. findTestOnlyMembers: a stray '{' inside a string literal in class A does not merge its member with class B's", () => {
  const prodFile = 'src/string-brace.ts';
  const testFile = 'src/string-brace.test.ts';
  const prodText = [
    'export class A {',
    '  helper(): void {',
    "    const marker = '{';",
    '  }',
    '',
    '  foo(): void {}',
    '}',
    '',
    'class B {',
    '  /**',
    '   * @testonly only B is meant to be exempt',
    '   */',
    '  foo(): void {}',
    '}',
  ].join('\n');
  const testText = ["import { A } from './string-brace';", 'new A().foo();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Without masking, the stray '{' would desync the brace walk, popping A's
  // stack entry early -- A's own, untagged foo would then fall into the
  // file-flat fallback and share a verdict with B's tagged foo.
  assert.equal(
    result.violations.some((v) => v.name === 'A.foo'),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:B.foo`),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:A.foo`),
    false,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'foo'),
    false,
  );
});

test("38. findTestOnlyMembers: a stray '}' inside a line comment in class A does not merge its member with class B's", () => {
  const prodFile = 'src/comment-brace.ts';
  const testFile = 'src/comment-brace.test.ts';
  const prodText = [
    'export class A {',
    '  helper(): void {',
    '    // }',
    '  }',
    '',
    '  foo(): void {}',
    '}',
    '',
    'class B {',
    '  /**',
    '   * @testonly only B is meant to be exempt',
    '   */',
    '  foo(): void {}',
    '}',
  ].join('\n');
  const testText = ["import { A } from './comment-brace';", 'new A().foo();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'A.foo'),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:B.foo`),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:A.foo`),
    false,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'foo'),
    false,
  );
});

test('39. findTestOnlyMembers: a Lit template with a string-embedded "{" in its ${} does not desync attribution', () => {
  const prodFile = 'src/template-brace.ts';
  const testFile = 'src/template-brace.test.ts';
  const prodText = [
    "import { html } from 'lit';",
    '',
    'export class A {',
    '  render(x: boolean) {',
    "    return html`<div>${x ? '{' : ''}</div>`;",
    '  }',
    '',
    '  foo(): void {}',
    '}',
    '',
    'class B {',
    '  /**',
    '   * @testonly only B is meant to be exempt',
    '   */',
    '  foo(): void {}',
    '}',
  ].join('\n');
  const testText = ["import { A } from './template-brace';", 'new A().foo();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'A.foo'),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:B.foo`),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:A.foo`),
    false,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'foo'),
    false,
  );
});

test('40. attributeLinesToBlocks: masking a multi-line block comment preserves line numbers, so a member after it attributes to its true line', () => {
  const lines = [
    'export class A {',
    '  /*',
    '   * a multi-line',
    '   * block comment',
    '   * with a stray } inside',
    '   */',
    '  foo(): void {}',
    '}',
  ];
  const masked = maskSource(lines.join('\n')).split('\n');
  assert.equal(masked.length, lines.length);
  // The stray brace inside the comment is blanked, not left for the brace
  // count to trip over.
  assert.equal(/[{}]/.test(masked[4]), false);
  const blocks = attributeLinesToBlocks(lines);
  // foo's true line (index 6) is correctly attributed to A -- not shifted by
  // the 5-line comment above it, and not desynced by the brace inside it.
  assert.equal(blocks[6], 'A');
});

test('41. attributeLinesToBlocks: a regex literal desyncs the brace count, but the column-0 resync clears the stale stack on the next declaration', () => {
  const lines = [
    'export class A {',
    '  pattern = /\\{/;',
    '  foo(): void {}',
    '}',
    '',
    'export class B {',
    '  bar(): void {}',
    '}',
  ];
  const blocks = attributeLinesToBlocks(lines);
  assert.equal(blocks[2], 'A'); // foo, before the regex-induced desync
  // B's own declaration line (index 5) is the discriminating assertion: an
  // unmatched '{' inside the regex leaves A's stack entry stuck open (A's
  // own real closing brace at index 3 can't pop it, being one level short),
  // so without the resync this reads 'A' (stale) here, not null. bar()
  // itself (index 6) attributes to 'B' either way in this two-class shape --
  // stack-top semantics already put whichever class is pushed most recently
  // on top, resync or not -- so this construction alone would not catch a
  // missing resync through member attribution; the resync's effect is
  // visible on the declaration line's own attribution, which is what this
  // asserts directly.
  assert.equal(blocks[5], null);
  assert.equal(blocks[6], 'B'); // bar, still correctly attributed to B
});

test('42. subsumeMembersByOwner: a class-level @testonly exemption subsumes its own member violation', () => {
  const symbolVerdictedNames = new Set(['src/foo.ts:Foo']);
  const memberFindings: MemberFindings = {
    violations: [{ kind: 'member', file: 'src/foo.ts', name: 'Foo.bar', testRefs: 1 }],
    testOnlyExempt: [],
    entrypointExempt: [],
    publicExempt: [],
  };
  const result = subsumeMembersByOwner(memberFindings, symbolVerdictedNames);
  assert.equal(result.violations.length, 0);
});

test("43. subsumeMembersByOwner: class A verdicted does not subsume class B's same-named member", () => {
  const symbolVerdictedNames = new Set(['src/two.ts:A']); // only A is verdicted, not B
  const memberFindings: MemberFindings = {
    violations: [
      { kind: 'member', file: 'src/two.ts', name: 'A.reset', testRefs: 1 },
      { kind: 'member', file: 'src/two.ts', name: 'B.reset', testRefs: 1 },
    ],
    testOnlyExempt: [],
    entrypointExempt: [],
    publicExempt: [],
  };
  const result = subsumeMembersByOwner(memberFindings, symbolVerdictedNames);
  assert.equal(
    result.violations.some((v) => v.name === 'A.reset'),
    false,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'B.reset'),
    true,
  );
});

test('44. subsumeMembersByOwner: a class-level violation (not just an exemption) also subsumes its own members', () => {
  // symbolVerdictedNames unions export-level VIOLATIONS with all three exempt
  // categories in main() -- confirm a violation-sourced entry subsumes a
  // member exactly like an exempt-sourced one does.
  const symbolVerdictedNames = new Set(['src/baz.ts:Baz']);
  const memberFindings: MemberFindings = {
    violations: [{ kind: 'member', file: 'src/baz.ts', name: 'Baz.qux', testRefs: 1 }],
    testOnlyExempt: ['src/baz.ts:Baz.quux'],
    entrypointExempt: [],
    publicExempt: [],
  };
  const result = subsumeMembersByOwner(memberFindings, symbolVerdictedNames);
  assert.equal(result.violations.length, 0);
  assert.equal(result.testOnlyExempt.length, 0);
});

test("45. findTestOnlyMembers: a stray '}' inside a string literal (not just a comment) does not pop class A early either", () => {
  // Complements #37/#39: a stray '{' inside a string/template leaves an
  // unmatched OPEN brace, which (empirically verified while writing this
  // test suite -- see the report) is self-correcting for a same-class
  // member even without masking, because the enclosing class's own frame
  // just never pops until the walk hits the next class's declaration. A
  // stray '}' is the genuinely dangerous direction: it can pop the
  // enclosing class's stack entry EARLY, at the moment depth coincidentally
  // matches that class's own openDepth -- exactly #38's comment case, here
  // reproduced inside a string literal instead of a comment, to confirm
  // masking protects strings against this direction too, not just comments.
  const prodFile = 'src/string-close-brace.ts';
  const testFile = 'src/string-close-brace.test.ts';
  const prodText = [
    'export class A {',
    '  helper(): void {',
    "    const marker = '}';",
    '  }',
    '',
    '  foo(): void {}',
    '}',
    '',
    'class B {',
    '  /**',
    '   * @testonly only B is meant to be exempt',
    '   */',
    '  foo(): void {}',
    '}',
  ].join('\n');
  const testText = ["import { A } from './string-close-brace';", 'new A().foo();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'A.foo'),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:B.foo`),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:A.foo`),
    false,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'foo'),
    false,
  );
});

// ============================================================================
// fix-3: the checker's own two files can never count as referrers
// ============================================================================

test('46. isExcludedReferrer: rejects both checker paths, accepts an arbitrary prod file', () => {
  assert.equal(isExcludedReferrer('scripts/check-dead-code.ts'), true);
  assert.equal(isExcludedReferrer('scripts/check-dead-code.test.ts'), true);
  assert.equal(isExcludedReferrer('apps/x/src/y.ts'), false);
  // Matched by path relative to the repo root, not by basename: a
  // same-named file in a different directory must NOT be excluded.
  assert.equal(isExcludedReferrer('apps/x/scripts/check-dead-code.ts'), false);
});

test('47. findTestOnlyExports: a reference existing only in an excluded referrer file does not count', () => {
  const prodFile = 'src/target.ts';
  const realTestFile = 'src/target.test.ts';
  // The REAL excluded path, used as an additional "referrer" here, so this
  // exercises the actual isExcludedReferrer predicate wired into
  // findTestOnlyExports -- not a stand-in for it.
  const excludedReferrerFile = 'scripts/check-dead-code.ts';
  const prodText = 'export function helper4(): void {}';
  const realTestText = 'helper4();\n';
  // If this counted, testRefs would be 2, not 1 -- the discriminating check.
  const excludedReferrerText = 'helper4();\n';
  const texts = new Map([
    [prodFile, prodText],
    [realTestFile, realTestText],
    [excludedReferrerFile, excludedReferrerText],
  ]);
  const result = findTestOnlyExports([prodFile], [realTestFile, excludedReferrerFile], texts);
  const finding = result.violations.find((v) => v.name === 'helper4');
  assert.ok(finding, 'expected a violation for helper4');
  assert.equal(finding?.testRefs, 1);
});

// ============================================================================
// fix-4: the block tracker's regexes read the MASKED line, like its brace walk
// ============================================================================

test('48. attributeLinesToBlocks: a column-0 declaration inside a template literal does not resync the stack mid-class', () => {
  const lines = [
    'export class A {',
    '  render(): string {',
    '    return `',
    // Column-0 and declaration-shaped, but it is template *content*, not
    // code: TOP_LEVEL_RESYNC_RE matching it on the raw line would clear the
    // stack while A is still open, un-attributing every later member of A.
    'export const FOO = 1;',
    '`;',
    '  }',
    '',
    '  foo(): void {}',
    '}',
  ];
  // The line is fully blanked by the mask, so the resync test never sees a
  // declaration there in the first place.
  const masked = maskSource(lines.join('\n')).split('\n');
  assert.equal(masked.length, lines.length);
  assert.equal(masked[3].trim(), '');
  const blocks = attributeLinesToBlocks(lines);
  // foo's own line (index 7) is still inside A.
  assert.equal(blocks[7], 'A');
});

test('49. attributeLinesToBlocks: a `class` line inside a block comment does not claim the next real brace', () => {
  const lines = [
    '/*',
    // Once the mask blanks this comment's own '{', a raw-line TYPE_BLOCK_RE
    // match here leaves a bogus pendingName alive to be pushed by the NEXT
    // real '{' -- Real's.
    'class Ghost {',
    '*/',
    'export class Real {',
    '  bar(): void {}',
    '}',
  ];
  const masked = maskSource(lines.join('\n')).split('\n');
  assert.equal(masked[1].trim(), '');
  const blocks = attributeLinesToBlocks(lines);
  // bar's own line (index 4) belongs to Real, the only class that exists.
  assert.equal(blocks[4], 'Real');
});

test("50. findTestOnlyMembers: a template-embedded column-0 declaration in class A does not merge its member with class B's", () => {
  const prodFile = 'src/template-decl.ts';
  const testFile = 'src/template-decl.test.ts';
  const prodText = [
    'export class A {',
    '  render(): string {',
    '    return `',
    'export const FOO = 1;',
    '`;',
    '  }',
    '',
    '  foo(): void {}',
    '}',
    '',
    'class B {',
    '  /**',
    '   * @testonly only B is meant to be exempt',
    '   */',
    '  foo(): void {}',
    '}',
  ].join('\n');
  const testText = ["import { A } from './template-decl';", 'new A().foo();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Reading the raw line, the template's column-0 'export const' resyncs the
  // stack mid-class: A's own foo attributes to null, falls into the
  // file-flat, name-only fallback, and is reported unqualified as 'foo'.
  assert.equal(
    result.violations.some((v) => v.name === 'A.foo'),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:B.foo`),
    true,
  );
  assert.equal(
    result.testOnlyExempt.some((e) => e === `${prodFile}:A.foo`),
    false,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'foo'),
    false,
  );
});

// ============================================================================
// fix-5: candidates come from MASKED text; references and tags stay RAW
// ============================================================================

/** Every list a candidate could land in, for "appears nowhere" assertions. */
const namesEverywhere = (r: {
  violations: { name?: string }[];
  testOnlyExempt: string[];
  entrypointExempt: string[];
  publicExempt: string[];
}): string[] => [
  ...r.violations.map((v) => v.name ?? ''),
  ...r.testOnlyExempt,
  ...r.entrypointExempt,
  ...r.publicExempt,
];

test('51. findTestOnlyExports: an export declared only inside a block comment is never a candidate', () => {
  const prodFile = 'src/commented-export.ts';
  const testFile = 'src/commented-export.test.ts';
  const prodText = [
    '/*',
    // Column-0 and declaration-shaped, but commented out: EXPORT_DECL
    // matching it on the raw line invents a symbol that does not exist.
    'export function ghost() {}',
    '*/',
    'export function live(): void {}',
  ].join('\n');
  const testText = ["import { live } from './commented-export';", 'ghost();', 'live();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyExports([prodFile], [testFile], texts);
  // ghost is in no list at all -- not a violation, not exempt.
  assert.equal(
    namesEverywhere(result).some((n) => n.includes('ghost')),
    false,
  );
  // The real export beside it is unaffected.
  assert.equal(
    result.violations.some((v) => v.name === 'live'),
    true,
  );
});

test('52. findTestOnlyMembers: a member-shaped line inside a template literal is never a candidate', () => {
  const prodFile = 'src/template-member.ts';
  const testFile = 'src/template-member.test.ts';
  const prodText = [
    'export class A {',
    '  real(): string {',
    '    return `',
    // Template *content*, not a declaration -- MEMBER_DECL matching it on the
    // raw line reports a member that does not exist: a false positive.
    '  ghostMember(): void {',
    '`;',
    '  }',
    '}',
  ].join('\n');
  const testText = [
    "import { A } from './template-member';",
    'new A().ghostMember();',
    'new A().real();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'A.real'),
    true,
  );
  assert.equal(
    namesEverywhere(result).some((n) => n.includes('ghostMember')),
    false,
  );
});

test('53. findTestOnlyMembers: a commented-out exported class does not open the file for member scanning', () => {
  const prodFile = 'src/commented-class.ts';
  const testFile = 'src/commented-class.test.ts';
  const prodText = [
    '/*',
    // The CLASS_DECL gate exists to keep object-literal methods out of the
    // member scan; a commented-out class must not open it.
    'export class Old {}',
    '*/',
    'export const api = {',
    '  helper(): void {},',
    '};',
  ].join('\n');
  const testText = ["import { api } from './commented-class';", 'api.helper();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.deepEqual(namesEverywhere(result), []);
});

test('54. findTestOnlyMembers: a trailing "// private helper" comment does not suppress a public member', () => {
  const prodFile = 'src/comment-private.ts';
  const testFile = 'src/comment-private.test.ts';
  const prodText = [
    'export class A {',
    // The word `private` lives in a comment, not in the modifiers: reading
    // the raw line skips a genuinely public member.
    '  doThing(): void {} // private helper',
    '}',
  ].join('\n');
  const testText = ["import { A } from './comment-private';", 'new A().doThing();'].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'A.doThing'),
    true,
  );
});

test('55. declarationLines: a backtick inside a regex literal desyncs the mask, so candidacy falls back to raw', () => {
  // A real shape from this repo (packages/bot-logic/src/discord-markdown.ts,
  // apps/web-app/vite-plugin-changelog-parser.ts): the unmasked regex literal's
  // backtick opens a template span that never closes, blanking every line
  // below it. Masking must not be allowed to DELETE a real declaration.
  const prodFile = 'src/regex-backtick.ts';
  const testFile = 'src/regex-backtick.test.ts';
  const prodText = ['const SPECIALS = /([*_~`|])/g;', 'export function afterRegex(): void {}'].join(
    '\n',
  );
  const testText = ["import { afterRegex } from './regex-backtick';", 'afterRegex();'].join('\n');
  // The mask really is unusable here -- the declaration is blanked ...
  const masked = maskSource(prodText).split('\n');
  assert.equal(/afterRegex/.test(masked[1]), false);
  // ... so declarationLines hands back the raw lines instead.
  assert.deepEqual(declarationLines(prodText), prodText.split('\n'));
  // A clean file still gets the masked view, or the fallback would be a
  // blanket opt-out of the whole fix.
  const cleanText = ['/*', 'export function ghost2() {}', '*/', 'export const ok = 1;'].join('\n');
  assert.equal(declarationLines(cleanText)[1].trim(), '');
  // End to end: the export below the regex is still a candidate.
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyExports([prodFile], [testFile], texts);
  assert.equal(
    result.violations.some((v) => v.name === 'afterRegex'),
    true,
  );
});

// ============================================================================
// fix-7: member candidacy is depth-aware — a statement inside a method body
// is not a declaration
// ============================================================================

test('56. findTestOnlyMembers: a bare call statement inside a method body is not a member candidate', () => {
  // The live shape this fixes: apps/web-app/src/services/keyboard-service.ts
  // calls the imported free function `showShortcutsPanel()` from inside
  // `handleKeyDown`'s body, and its test spies on the module
  // (`expect(shortcutsPanel.showShortcutsPanel).toHaveBeenCalled()`). The
  // indentation-only MEMBER_DECL matched the call statement, attribution put
  // it on the enclosing class, and the spy's property access satisfied the
  // dotted reference pattern -- inventing `KeyboardService.showShortcutsPanel`,
  // a member that does not exist.
  const prodFile = 'src/nested-call.ts';
  const helperFile = 'src/helper.ts';
  const testFile = 'src/nested-call.test.ts';
  const prodText = [
    "import { helper } from './helper';",
    'export class A {',
    '  real(): void {',
    // Six spaces deep, inside a method body: a statement, not a declaration.
    '    helper();',
    '  }',
    '',
    '  later(): void {}',
    '}',
  ].join('\n');
  const helperText = 'export function helper(): void {}';
  const testText = [
    "import { A } from './nested-call';",
    "import * as mod from './helper';",
    'new A().real();',
    'new A().later();',
    'expect(mod.helper).toHaveBeenCalled();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [helperFile, helperText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile, helperFile], [testFile], texts);
  // Positive controls: both real members are still candidates -- including
  // `later`, declared AFTER the method whose body holds the nested call, which
  // is only reachable if the brace walk returns to the class body's own depth.
  assert.equal(
    result.violations.some((v) => v.name === 'A.real'),
    true,
  );
  assert.equal(
    result.violations.some((v) => v.name === 'A.later'),
    true,
  );
  // The phantom: `helper` must not appear under ANY key -- neither qualified
  // (`A.helper`) nor via the name-only `null`-attribution fallback (`helper`).
  const everything = namesEverywhere(result);
  assert.deepEqual(
    everything.filter((n) => /(?:^|[.:])helper$/.test(n)),
    [],
  );
});

test('57. attributeLinesToBlockFrames: direct members vs nested statements', () => {
  const lines = ['export class A {', '  real(): void {', '    helper();', '  }', '}'];
  const frames = attributeLinesToBlockFrames(lines);
  // The class's own header line is outside its body -- the block opens on the
  // `{` at the END of the per-character walk of that line.
  assert.equal(frames[0], null);
  // A member declaration sits at the class body's own depth ...
  assert.deepEqual(frames[1], { name: 'A', direct: true });
  // ... while a statement inside that member's body is one brace deeper.
  assert.deepEqual(frames[2], { name: 'A', direct: false });
  // The name-only contract `attributeLinesToBlocks` publishes is unchanged:
  // both lines are still textually enclosed by A.
  const blocks = attributeLinesToBlocks(lines);
  assert.equal(blocks[1], 'A');
  assert.equal(blocks[2], 'A');
});
