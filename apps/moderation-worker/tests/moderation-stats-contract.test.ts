/**
 * The moderation-stats response shape, asserted against the server that
 * produces it rather than against the client that reads it.
 *
 * BUG-010: `/preset moderate action:stats` rendered "undefined" in all four
 * counters for as long as the feature has existed. The handler read
 * `stats.pending_count`; presets-api's SQL aliases that column `pending`. No
 * `*_count` key has ever been in the response.
 *
 * The unit test could not see it, and that is the interesting part: its mock
 * was built from the names the HANDLER expected, so mock and client agreed
 * with each other and both disagreed with the server. Fixing the names alone
 * would leave exactly the same hole open for the next field.
 *
 * So this reads presets-api's own query text and asserts its aliases are the
 * keys `ModerationStats` declares. It is deliberately a file-reading test —
 * the two workers are separate deploy units with no shared runtime, and a
 * hand-copied client contract is precisely what REFACTOR-001 is about.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ModerationStats } from '@xivdyetools/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODERATION_HANDLER = join(HERE, '..', '..', 'presets-api', 'src', 'handlers', 'moderation.ts');

/**
 * The `stats` query's column aliases, read out of presets-api's source.
 *
 * Anchored to the statement that ends in `as actions_last_week` so an
 * unrelated `SELECT … as x` elsewhere in the file cannot be mistaken for it.
 */
function statsAliases(): string[] {
  const source = readFileSync(MODERATION_HANDLER, 'utf8');
  const query = /SELECT\b([\s\S]*?as\s+actions_last_week)/i.exec(source);
  expect(query, 'could not find the stats SELECT in presets-api').not.toBeNull();

  return [...query![1].matchAll(/\bas\s+([a-z_]+)/gi)].map((m) => m[1]);
}

describe('the moderation stats contract', () => {
  it('declares exactly the keys presets-api returns', () => {
    // A compile-time witness: this object must satisfy ModerationStats, so a
    // field renamed in the type without updating the aliases below fails
    // type-check, and one renamed in presets-api fails the assertion.
    const declared: ModerationStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
      actions_last_week: 0,
    };

    expect(statsAliases().sort()).toEqual(Object.keys(declared).sort());
  });

  it('carries no *_count key, which is the shape that shipped broken', () => {
    const aliases = statsAliases();
    expect(aliases.filter((a) => a.endsWith('_count'))).toEqual([]);
  });
});
