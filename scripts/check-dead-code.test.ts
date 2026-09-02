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
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  findForbiddenTags,
  forbiddenTag,
  hasBareTag,
  isExcludedReferrer,
  isMainModule,
  isPublic,
  isTestFile,
  leadingDocblock,
  listTracked,
  loadWorkspaceAliases,
  maskSource,
  resolveAliasSpecifier,
  resolveRelativeSpecifier,
  subsumeMembersByOwner,
  testOnlyReason,
} from './check-dead-code.js';
import type { MemberFindings } from './check-dead-code.js';
// Several tests below read the repository itself — `git ls-files` through
// `listTracked()`, and `knip.jsonc` by relative path. Those are cwd-relative,
// so running this suite from anywhere but the repo root used to fail with
// ENOENT or an empty file list rather than a real result. Anchor the process
// to the repo root, derived from this file's own location, so the suite means
// the same thing wherever it is invoked from.
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

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
    // The controller ruling of 2026-09-01: refusing this one made the gate's
    // own remediation hint a dead end — a file whose only comment is its
    // leading docblock could not exempt its first export no matter what tag
    // it carried. With nothing skipped between the block and the
    // declaration, the block IS that declaration's docblock. 4a above is the
    // shape the refusal still applies to.
    name: '4b. a leading docblock with nothing skipped between it and the declaration attaches',
    lines: [
      '/**',
      ' * File-level description.',
      ' * @testonly file-level reason',
      ' */',
      'export function firstThing(): void {}',
    ],
    declIndex: 4,
    check: (doc) => assert.equal(testOnlyReason(doc), 'file-level reason'),
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

/**
 * Every list a candidate could land in, for "appears nowhere" assertions —
 * an absence from `violations` alone proves nothing, since an accidental
 * exemption hides a finding just as thoroughly as a missed candidate does.
 */
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

test('leadingDocblock returns the file header — which docblockAbove also returns when it is adjacent', () => {
  const text = [
    '/**',
    ' * File-level description.',
    ' * @testonly file-level reason',
    ' */',
    'export function firstThing(): void {}',
  ].join('\n');
  const header = '/**\n * File-level description.\n * @testonly file-level reason\n */';
  assert.equal(leadingDocblock(text), header);
  // Adjacent to the declaration, so the two agree (the 2026-09-01 ruling).
  assert.equal(docblockAbove(text.split('\n'), 4), header);
  // One blank line away, they diverge again: the file header stays a FILE
  // header and docblockAbove refuses to reuse it at symbol granularity.
  const spaced = [
    '/**',
    ' * File-level description.',
    ' * @testonly file-level reason',
    ' */',
    '',
    'export function firstThing(): void {}',
  ];
  assert.equal(leadingDocblock(spaced.join('\n')), header);
  assert.equal(docblockAbove(spaced, 5), '');
});

test('4c. the adjacency rule end to end: adjacent tag exempts the first export, one blank line away it does not', () => {
  // Symbol granularity: with nothing between the docblock and the export, the
  // tag is the export's own and exempts it.
  const adjacentFile = 'src/adjacent-tag.ts';
  const adjacentTest = 'src/adjacent-tag.test.ts';
  const adjacentText = [
    '/**',
    ' * @testonly only the suite drives this helper',
    ' */',
    'export function onlyThing(): void {}',
  ].join('\n');
  const adjacentTexts = new Map([
    [adjacentFile, adjacentText],
    [adjacentTest, "import { onlyThing } from './adjacent-tag';\nonlyThing();\n"],
  ]);
  const adjacent = findTestOnlyExports([adjacentFile], [adjacentTest], adjacentTexts);
  assert.equal(adjacent.violations.length, 0);
  assert.deepEqual(adjacent.testOnlyExempt, [`${adjacentFile}:onlyThing`]);

  // Same docblock, same tag, one blank line away — the "file header + blank
  // line + first export" shape the refusal exists for. The tag does NOT
  // attach to the export.
  const spacedFile = 'src/spaced-tag.ts';
  const spacedTest = 'src/spaced-tag.test.ts';
  const spacedText = [
    '/**',
    ' * @testonly only the suite drives this helper',
    ' */',
    '',
    'export function onlyThing2(): void {}',
  ].join('\n');
  const spacedTexts = new Map([
    [spacedFile, spacedText],
    [spacedTest, "import { onlyThing2 } from './spaced-tag';\nonlyThing2();\n"],
  ]);
  const spaced = findTestOnlyExports([spacedFile], [spacedTest], spacedTexts);
  assert.deepEqual(spaced.testOnlyExempt, []);
  assert.equal(spaced.violations.filter((v) => v.name === 'onlyThing2').length, 1);

  // FILE granularity is indifferent to adjacency and is unchanged by the
  // ruling: findOrphanModules reads the leading docblock directly, so BOTH
  // files are file-level test-only exempt either way. (In main(), that
  // file-level verdict is also what subsumes the spaced file's symbol
  // violation above.)
  assert.deepEqual(
    findOrphanModules([adjacentFile], [adjacentTest], adjacentTexts).testOnlyExempt,
    [adjacentFile],
  );
  assert.deepEqual(findOrphanModules([spacedFile], [spacedTest], spacedTexts).testOnlyExempt, [
    spacedFile,
  ]);
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
  const text = readFileSync(
    fileURLToPath(new URL('../apps/web-app/functions/_middleware.ts', import.meta.url)),
    'utf8',
  );
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
  const testText =
    "import { Widget2 } from './widget2';\nconst w = new Widget2();\nw.helper();\nw.run();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Positive control: `run` has no production reference at all, so it IS
  // reported. Without it, every assertion below would hold just as well for a
  // fixture the scan never produced a single finding from.
  assert.equal(
    result.violations.some((v) => v.name === 'Widget2.run'),
    true,
  );
  // Names are qualified `Class.member`, so these must be too — filtering on
  // the bare `helper` asserts against a set that can never contain it.
  assert.deepEqual(
    namesEverywhere(result).filter((n) => /(?:^|[.:])helper$/.test(n)),
    [],
  );
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
    '',
    '  probe(): void {}',
    '}',
    '',
    'export function runIt(w: IWidget3): void {',
    '  w.process();',
    '}',
  ].join('\n');
  const testText =
    "import { Widget3 } from './widget3';\nconst w = new Widget3();\nw.process();\nw.probe();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Positive control: `probe` has no production caller, so it IS reported --
  // proof the scan ran over this fixture at all.
  assert.equal(
    result.violations.some((v) => v.name === 'Widget3.probe'),
    true,
  );
  // Qualified: filtering on the bare `process` asserts against a set that can
  // never contain it. Neither the class's method nor the interface's
  // signature may be reported -- `w.process()` in runIt covers both.
  assert.deepEqual(
    namesEverywhere(result).filter((n) => /(?:^|[.:])process$/.test(n)),
    [],
  );
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
  //
  // The import line below is LOAD-BEARING, and its absence is what made this
  // test vacuous until 2026-09-02: findTestOnlyMembers only considers a file
  // once a test file actually imports it, so without it the scan returned zero
  // violations no matter what the member was called and the assertion could
  // not fail. Proven by substitution — renaming `#trulyPrivate` to an ordinary
  // `ordinaryName` still yielded zero. With the import, the ordinary name IS
  // reported and the `#` one still is not, which is the distinction this test
  // exists to pin.
  const prodFile = 'src/widget5.ts';
  const testFile = 'src/widget5.test.ts';
  const prodText = ['export class Widget5 {', '  #trulyPrivate(): void {}', '}'].join('\n');
  const testText = "import { Widget5 } from './widget5';\nw.#trulyPrivate();\n";
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  assert.equal(result.violations.length, 0);
});

test('21. findTestOnlyMembers: control-flow keywords inside a method body are not mistaken for methods (depth rule)', () => {
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
  // `if (`/`switch (` satisfy MEMBER_DECL's indentation-plus-`identifier(`
  // heuristic, and these nonsense call shapes supply the `.if`/`.switch` test
  // references a fake member would need. TWO independent guards exclude them,
  // so this fixture only fails if BOTH are removed: MEMBER_SKIP fires first
  // (it is checked before attribution), and since 1ddb3e7f the depth rule
  // would exclude them anyway -- both sit one brace deeper than the class's
  // own body, so they are statements, not declarations. (MEMBER_SKIP's own
  // irreplaceable job, at member depth, is `constructor` -- next test.)
  //
  // The import is load-bearing: without it no test file imports widget6.ts,
  // every member's testRefs is 0, and the fixture reports NOTHING -- which is
  // what made the absence assertions below unfalsifiable.
  const testText = [
    "import { Widget6 } from './widget6';",
    'const w = new Widget6();',
    'w.run();',
    'w.if();',
    'w.switch();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Positive control: the one real member IS reported.
  assert.equal(
    result.violations.some((v) => v.name === 'Widget6.run'),
    true,
  );
  // Neither the qualified form nor the name-only null-attribution fallback.
  assert.deepEqual(
    namesEverywhere(result).filter((n) => /(?:^|[.:])(?:if|switch|doStuff)$/.test(n)),
    [],
  );
});

test('21b. findTestOnlyMembers: `constructor` sits at member depth, so MEMBER_SKIP is the only thing excluding it', () => {
  // The MEMBER_SKIP entry the depth rule cannot cover: a constructor is
  // declared at the class body's OWN depth, exactly like a method. Every class
  // has one and `.constructor` exists on every object, so without the skip it
  // would be a standing false positive wherever a test touches it.
  const prodFile = 'src/widget6b.ts';
  const testFile = 'src/widget6b.test.ts';
  const prodText = [
    'export class Widget6b {',
    '  private readonly seed: number;',
    '',
    '  constructor(seed: number) {',
    '    this.seed = seed;',
    '  }',
    '',
    '  probe(): number {',
    '    return this.seed;',
    '  }',
    '}',
  ].join('\n');
  const testText = [
    "import { Widget6b } from './widget6b';",
    'const w = new Widget6b(1);',
    "assert.equal(w.constructor.name, 'Widget6b');",
    'w.probe();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Positive control: `probe` has no production caller and IS reported.
  assert.equal(
    result.violations.some((v) => v.name === 'Widget6b.probe'),
    true,
  );
  assert.deepEqual(
    namesEverywhere(result).filter((n) => /(?:^|[.:])constructor$/.test(n)),
    [],
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
    '',
    '  probe(): void {}',
    '}',
    '',
    'export function dispatch(w: Widget12): void {',
    "  (w as unknown as Record<string, () => void>)['dynamicThing']();",
    '}',
  ].join('\n');
  const testText = [
    "import { Widget12 } from './widget12';",
    'const w = new Widget12();',
    'w.dynamicThing();',
    'w.probe();',
  ].join('\n');
  const texts = new Map([
    [prodFile, prodText],
    [testFile, testText],
  ]);
  const result = findTestOnlyMembers([prodFile], [testFile], texts);
  // Positive control: `probe` has NO production call site of either shape, so
  // it is reported -- the fixture really does produce findings.
  assert.equal(
    result.violations.some((v) => v.name === 'Widget12.probe'),
    true,
  );
  // Qualified: filtering on the bare `dynamicThing` asserts against a set that
  // can never contain it.
  assert.deepEqual(
    namesEverywhere(result).filter((n) => /(?:^|[.:])dynamicThing$/.test(n)),
    [],
  );
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

test('47. findTestOnlyExports: prose in an excluded referrer file does not count', () => {
  const prodFile = 'src/target.ts';
  const realTestFile = 'src/target.test.ts';
  // The REAL excluded path, used as an additional "referrer" here, so this
  // exercises the actual isExcludedReferrer predicate wired into
  // findTestOnlyExports -- not a stand-in for it.
  const excludedReferrerFile = 'scripts/check-dead-code.ts';
  const prodText = 'export function helper4(): void {}';
  const realTestText = 'helper4();\n';
  // Until 2026-09-02 this line was a real call, `helper4();`, and the rule it
  // pinned was "an excluded referrer counts for nothing at all". That rule was
  // too blunt — it discarded the checker's own real calls too, and reported
  // `listTracked` as test-only the moment a test imported it. The refined rule
  // masks those files instead of dropping them: prose and fixture strings still
  // count for nothing, real code counts. So this is now a COMMENT, which is
  // what the exclusion was always actually for. If it counted, testRefs would
  // be 2, not 1 -- the discriminating check.
  const excludedReferrerText = '// helper4 is described here but never called\n';
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

// ============================================================================
// final review: the two regression cases the spec promised but never got —
// workspace-relative test-file matching (spec §3) and relative-specifier
// resolution in place of basename collision (Task 4's headline fix)
// ============================================================================

test('58. isTestFile: patterns match the WORKSPACE-RELATIVE path, never the whole path', () => {
  // packages/test-utils is PRODUCTION code for its consumers -- 14 of its 36
  // exports had no external consumer at the 2026-09-01 audit -- so its own
  // sources must never be classified as test code, or the checker goes blind
  // to exactly the workspace it most needs to see.
  assert.equal(isTestFile('packages/test-utils/src/cloudflare/kv.ts'), false);
  assert.equal(isTestFile('packages/test-utils/src/index.ts'), false);
  // The discriminating pair: a workspace whose OWN directory name matches a
  // test-directory pattern. Matched against the whole path, every source file
  // under these would be classified as a test file.
  assert.equal(isTestFile('packages/tests/src/index.ts'), false);
  assert.equal(isTestFile('apps/e2e/src/main.ts'), false);
  // ... while a real test directory INSIDE a workspace still matches, and so
  // does an app's own tests/test-utils.ts (the file the pattern is named for).
  assert.equal(isTestFile('apps/api-worker/tests/test-utils.ts'), true);
  assert.equal(isTestFile('apps/x/src/__fixtures__/a.ts'), true);
  assert.equal(isTestFile('packages/core/src/color/matcher.test.ts'), true);
});

test('59. findOrphanModules: a relative specifier resolves to ONE file, not every same-basename file', () => {
  const aTypes = 'src/a/types.ts';
  const bTypes = 'src/b/types.ts';
  const aTest = 'src/a/types.test.ts';
  const texts = new Map([
    [aTypes, 'export type A = { a: number };\n'],
    [bTypes, 'export type B = { b: number };\n'],
    [aTest, "import type { A } from './types';\nconst a: A = { a: 1 };\n"],
  ]);
  const result = findOrphanModules([aTypes, bTypes], [aTest], texts);
  // `./types` from src/a/ resolves to src/a/types.ts and nothing else, so
  // exactly one file is a test-only orphan.
  assert.deepEqual(
    result.violations.map((v) => v.file),
    [aTypes],
  );
  // src/b/types.ts shares the basename but has ZERO importers of any kind --
  // knip's job, not this checker's -- so it must appear in no list at all.
  // Under the pre-fix basename fallback it inherited src/a/'s test importer
  // and was reported as a test-only orphan it never was.
  const everywhere = [
    ...result.violations.map((v) => v.file),
    ...result.testOnlyExempt,
    ...result.entrypointExempt,
    ...result.publicExempt,
  ];
  assert.equal(everywhere.includes(bTypes), false);
});

test('60. resolveRelativeSpecifier: a .js specifier resolves to its .ts sibling, a bare directory to index.ts', () => {
  const tracked = new Set(['src/a/x.ts', 'src/a/index.ts']);
  // This repo's ESM-style imports name the COMPILED extension, so the literal
  // `.js` path is never itself the right target.
  assert.equal(resolveRelativeSpecifier('./x.js', 'src/a/main.ts', tracked), 'src/a/x.ts');
  assert.equal(resolveRelativeSpecifier('.', 'src/a/main.ts', tracked), 'src/a/index.ts');
  // Nothing in `tracked` matches -> null, and the caller falls back to
  // conservative basename matching for that one specifier.
  assert.equal(resolveRelativeSpecifier('./nope', 'src/a/main.ts', tracked), null);
});

test('61. isMainModule: a junction or symlink in the invocation path still counts as main', () => {
  // process.argv[1] is NOT realpath'd by node, but import.meta.url IS, so a
  // raw === comparison silently skipped main() and exited 0 with no output
  // whenever the checker was reached through a linked path.
  const realDir = mkdtempSync(join(tmpdir(), 'cdc-real-'));
  const realFile = join(realDir, 'check-dead-code.ts');
  writeFileSync(realFile, '// fixture\n');
  const linkPath = join(mkdtempSync(join(tmpdir(), 'cdc-link-')), 'linked');
  try {
    symlinkSync(realDir, linkPath, 'junction');
  } catch {
    return; // no permission to link on this machine; nothing to assert
  }
  const viaLink = join(linkPath, 'check-dead-code.ts');

  assert.equal(isMainModule(realFile, pathToFileURL(realFile).href), true);
  // The real bug: invoked through the link, resolved as the real module.
  assert.equal(isMainModule(viaLink, pathToFileURL(realFile).href), true);
  // A genuinely different file must still not count as main.
  assert.equal(isMainModule(join(realDir, 'other.ts'), pathToFileURL(realFile).href), false);
});

test('62. resolveAliasSpecifier: a tsconfig path alias resolves inside its own workspace', () => {
  const tracked = new Set([
    'apps/web-app/src/shared/logger.ts',
    'apps/web-app/src/services/index.ts',
    'apps/web-app/src/components/thing.ts',
    'packages/worker-kit/src/middleware/logger.ts',
  ]);
  const aliases = new Map([
    [
      'apps/web-app',
      [
        { prefix: '@shared/', target: 'apps/web-app/src/shared/' },
        { prefix: '@services/', target: 'apps/web-app/src/services/' },
      ],
    ],
  ]);
  // The bug this pins: basename matching sent `@shared/logger` to
  // worker-kit's middleware logger, in a different workspace entirely.
  assert.equal(
    resolveAliasSpecifier(
      '@shared/logger',
      'apps/web-app/src/components/thing.ts',
      tracked,
      aliases,
    ),
    'apps/web-app/src/shared/logger.ts',
  );
  assert.equal(
    resolveAliasSpecifier(
      '@services/index',
      'apps/web-app/src/components/thing.ts',
      tracked,
      aliases,
    ),
    'apps/web-app/src/services/index.ts',
  );
  // An alias the importer's workspace does not declare stays unresolved.
  assert.equal(
    resolveAliasSpecifier('@shared/logger', 'packages/worker-kit/src/x.ts', tracked, aliases),
    null,
  );
  // A real package name is not an alias.
  assert.equal(
    resolveAliasSpecifier(
      '@xivdyetools/core',
      'apps/web-app/src/components/thing.ts',
      tracked,
      aliases,
    ),
    null,
  );
});

test('63. loadWorkspaceAliases: reads real tsconfig paths off the tracked file list', () => {
  // `listTracked()` only yields .ts/.tsx/.js/.mjs, so a loader that looked for
  // tsconfig.json *inside* that list found nothing and silently resolved no
  // aliases at all — the fix was inert while its unit test, which injected the
  // alias map, still passed. This asserts against the real repository.
  const aliases = loadWorkspaceAliases(listTracked());
  const webApp = aliases.get('apps/web-app');
  assert.ok(webApp, 'apps/web-app declares tsconfig paths and must be present');
  const shared = webApp.find((a) => a.prefix === '@shared/');
  assert.ok(shared, '@shared/ must be among web-app aliases');
  assert.equal(shared.target, 'apps/web-app/src/shared/');
  // A package with no `paths` must simply be absent, not an empty entry.
  assert.equal(aliases.has('packages/types'), false);
});

test('64. forbiddenTag: knip silently exempts @beta and @alias, so the gate rejects them', () => {
  // knip hard-codes @public, @beta and @alias as always-ignored in
  // util/tag.js isAlwaysIgnored, consulted BEFORE the configured `tags`
  // filter. Only @public is a documented repo convention; the other two are
  // an undocumented escape hatch that would let a dead export pass knip with
  // no review signal at all. Nothing in the repo uses them, and this keeps it
  // that way.
  assert.equal(forbiddenTag('/**\n * @beta not ready\n */'), 'beta');
  assert.equal(forbiddenTag('/**\n * @alias someOther\n */'), 'alias');
  // The one that IS the convention stays allowed, with or without a reason.
  assert.equal(forbiddenTag('/**\n * @public published API\n */'), null);
  assert.equal(forbiddenTag('/**\n * @public\n */'), null);
  assert.equal(forbiddenTag('/**\n * @testonly only the foo suite calls this\n */'), null);
  // Prose that merely mentions the word must not trip it.
  assert.equal(forbiddenTag('/**\n * Superseded by the beta endpoint.\n */'), null);
});

test('65. findForbiddenTags: reports a @beta or @alias tag anywhere in production source', () => {
  const texts = new Map([
    ['src/a.ts', '/**\n * @beta not ready\n */\nexport const a = 1;\n'],
    ['src/b.ts', '/**\n * @alias other\n */\nexport function b() {}\n'],
    ['src/ok.ts', '/**\n * @public published API\n */\nexport const ok = 1;\n'],
    ['src/prose.ts', '// superseded by the beta endpoint\nexport const p = 1;\n'],
  ]);
  const found = findForbiddenTags([...texts.keys()], texts);
  assert.deepEqual(found.map((v) => `${v.file}:${v.name}`).sort(), [
    'src/a.ts:beta',
    'src/b.ts:alias',
  ]);
});

test('66. findForbiddenTags: the real tree carries none of them', () => {
  // The whole point of the rule: this must stay empty. If it ever fails,
  // someone used a tag that silently exempts their export from knip.
  const files = listTracked().filter((f) => !isTestFile(f));
  const texts = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
  assert.deepEqual(findForbiddenTags(files, texts), []);
});

test('67. an EXCLUDED_REFERRERS file still vouches for a symbol through real CODE', () => {
  // The exclusion exists so the checker's own docblock prose cannot vouch for
  // a symbol it merely names. Dropping those files from the referrer cohort
  // entirely went too far: it also discarded their real calls, so a helper
  // used only inside the checker itself reported as test-only the moment any
  // test imported it. Found on 2026-09-02, when `listTracked` did exactly that.
  const decl = 'src/other.ts';
  const excluded = 'scripts/check-dead-code.ts';
  const testFile = 'src/other.test.ts';
  const texts = new Map([
    [decl, 'export function helper() {}\n'],
    [excluded, 'const x = helper();\n'],
    [testFile, "import { helper } from './other';\nhelper();\n"],
  ]);
  const r = findTestOnlyExports([decl, excluded], [testFile], texts);
  assert.deepEqual(
    r.violations.map((v) => v.name),
    [],
  );
});

test('68. ...but PROSE in that same file still vouches for nothing', () => {
  const decl = 'src/other.ts';
  const excluded = 'scripts/check-dead-code.ts';
  const testFile = 'src/other.test.ts';
  const texts = new Map([
    [decl, 'export function helper() {}\n'],
    [excluded, '// the helper below is described but never called\n'],
    [testFile, "import { helper } from './other';\nhelper();\n"],
  ]);
  const r = findTestOnlyExports([decl, excluded], [testFile], texts);
  assert.deepEqual(
    r.violations.map((v) => v.name),
    ['helper'],
  );
});
