import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAll } from './changelog-parser.js';

// The product-level notes at the REPO ROOT: the release-announcement webhook
// (`POST /webhooks/github` → `services/announcements.ts`) renders
// `parseAll(content)[0]` of this file into a Discord embed, so an off-grammar
// `## ` header (silently dropped, or merged into the entry above it) or an
// out-of-order entry posts the wrong thing with nothing red.
//
// This suite deliberately imports ONLY the pure parser: CI runs it in the
// always-on "Wrangler config invariants" step, right after `pnpm install` and
// BEFORE any build, because a push that edits only the root file selects no
// workspace at all for the filtered test step. Anything that reaches a
// workspace package (the `/changelog` handler, `announcements.ts` via
// `discord-api.ts` → `@xivdyetools/bot-logic`) would fail to resolve there —
// those assertions live in `changelog-parser.test.ts`.
const rootChangelog = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../..', 'CHANGELOG-laymans.md'),
  'utf8'
);

/** Numeric semver tuple for ordering assertions. */
const semver = (v: string): number[] => v.split('.').map(Number);
const semverCompare = (a: string, b: string): number => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

describe('root CHANGELOG-laymans.md (build-free, always run in CI)', () => {
  it('exists at the repo root and every entry satisfies the contract', () => {
    const entries = parseAll(rootChangelog);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.version, `version header ${entry.version}`).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.date, `date of ${entry.version}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.sections.length, `${entry.version} has no bullets`).toBeGreaterThan(0);
    }
  });

  it('has no `## ` header off the grammar (such a header is silently dropped, or merged into the entry above it)', () => {
    // The file's HTML comments carry sample headers, indented by two spaces on
    // purpose so they can never match at column 0 — this assertion is what
    // keeps that convention honest.
    const headers = rootChangelog.split(/\r?\n/).filter((line) => line.startsWith('## '));
    for (const header of headers) {
      expect(header).toMatch(/^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$/);
    }
    expect(headers.length).toBe(parseAll(rootChangelog).length);
  });

  it('is ordered newest first, by version and by date', () => {
    const entries = parseAll(rootChangelog);
    for (let i = 1; i < entries.length; i++) {
      const [newer, older] = [entries[i - 1], entries[i]];
      expect(semverCompare(newer.version, older.version), `${newer.version} above ${older.version}`).toBeGreaterThan(0);
      expect(newer.date >= older.date, `${newer.version} (${newer.date}) above ${older.version} (${older.date})`).toBe(true);
    }
  });
});
