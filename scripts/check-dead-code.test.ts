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
  findTestOnlyExports,
  hasBareTag,
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
      "@customElement(",
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
