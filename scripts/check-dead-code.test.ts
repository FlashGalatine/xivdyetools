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
  docblockAbove,
  entrypointReason,
  findOrphanModules,
  findTestOnlyExports,
  findTestOnlyMembers,
  hasBareTag,
  isPublic,
  leadingDocblock,
  testOnlyReason,
} from './check-dead-code.js';

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
