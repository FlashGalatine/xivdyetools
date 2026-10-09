/**
 * REFACTOR-001 (2026-10-04 deep dive): the review custom_id grammar lives in
 * `@xivdyetools/types` (`preset/review-custom-id.ts`), but this worker still
 * ROUTES on the bare prefixes — the button dispatcher's `startsWith` checks,
 * the click/submit preambles' prefix maps and the two modal predicates. Those
 * pick a handler before the shared parser ever runs, so a prefix renamed or
 * added in the shared module would leave this worker silently dropping the new
 * ids while every grammar test stays green.
 *
 * This pins each prefix literal in those files to the shared builder's bare
 * prefix (`buildReviewCustomIdOrLegacy(kind, '', null, null)` returns exactly
 * the prefix), and checks every shared prefix is routed somewhere.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildReviewCustomIdOrLegacy, type ReviewKind } from '@xivdyetools/types';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const ROUTING_FILES = [
  'handlers/buttons/index.ts',
  'handlers/buttons/preset-moderation.ts',
  'handlers/modals/preset-rejection.ts',
];

/** A Record literal names every kind exactly once, so a new kind fails type-check here. */
const KIND_SET: Record<ReviewKind, true> = {
  approve: true,
  reject: true,
  revert: true,
  reject_modal: true,
  revert_modal: true,
};
const SHARED = new Map(
  (Object.keys(KIND_SET) as ReviewKind[]).map((kind) => [
    buildReviewCustomIdOrLegacy(kind, '', null, null),
    kind,
  ]),
);

function prefixLiterals(file: string): string[] {
  const text = readFileSync(join(SRC, file), 'utf8');
  return [...text.matchAll(/'(preset_[a-z_]+_)'/g)].map((m) => m[1]);
}

describe('review custom_id routing prefixes match @xivdyetools/types (REFACTOR-001)', () => {
  it.each(ROUTING_FILES)('every prefix %s routes on is a shared one', (file) => {
    const literals = prefixLiterals(file);
    expect(literals.length, `${file} has no review prefix any more`).toBeGreaterThan(0);
    for (const literal of literals) {
      expect(SHARED.has(literal), `${file}: '${literal}' is not a shared review prefix`).toBe(true);
    }
  });

  it('routes every shared prefix somewhere', () => {
    const routed = new Set(ROUTING_FILES.flatMap(prefixLiterals));
    expect([...SHARED.keys()].filter((prefix) => !routed.has(prefix))).toEqual([]);
  });
});
