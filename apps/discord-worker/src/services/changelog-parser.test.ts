import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAll, parseLatestVersion } from './changelog-parser.js';
// The bot's own notes, bundled as text (wrangler Text rule / vitest plugin) —
// importing them here exercises the same path /changelog ships with.
import botChangelog from '../../CHANGELOG-laymans.md';
import botPackage from '../../package.json';
import { renderEntry, DESCRIPTION_BUDGET } from '../handlers/commands/changelog.js';

const SAMPLE = `# What's New

## [2.0.0] - 2026-08-01
### 🎨 New Cards
- Discord bot: every command draws a card now
- Web app: matching methods renamed

### Fixes
- Link previews: images load again

## [1.9.0] - 2026-07-01
### Older
- Something older
`;

describe('parseAll', () => {
  it('parses every entry, newest first', () => {
    const entries = parseAll(SAMPLE);
    expect(entries).toHaveLength(2);
    expect(entries[0].version).toBe('2.0.0');
    expect(entries[0].date).toBe('2026-08-01');
    expect(entries[0].sections).toHaveLength(2);
    expect(entries[0].sections[0].title).toBe('🎨 New Cards');
    expect(entries[0].sections[0].items).toHaveLength(2);
    expect(entries[1].version).toBe('1.9.0');
    expect(entries[1].sections[0].items).toEqual(['Something older']);
  });

  it('returns an empty array for contract-breaking content', () => {
    expect(parseAll('## Web-App Version 4.12.0 — July 19, 2026\n- not contract')).toEqual([]);
  });
});

describe('parseLatestVersion', () => {
  it('is parseAll()[0]', () => {
    const latest = parseLatestVersion(SAMPLE);
    expect(latest?.version).toBe('2.0.0');
    expect(latest?.sections[1].items).toEqual(['Link previews: images load again']);
  });

  it('returns null when nothing parses', () => {
    expect(parseLatestVersion('no headers here')).toBeNull();
  });
});

describe('root CHANGELOG-laymans.md', () => {
  it('exists at the repo root and satisfies the contract', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const content = readFileSync(join(root, 'CHANGELOG-laymans.md'), 'utf8');
    const entries = parseAll(content);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(entries[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entries[0].sections.length).toBeGreaterThan(0);
  });
});

describe('line endings', () => {
  it('parses a CRLF file the same as an LF one', () => {
    // The bundled file is whatever bytes the deploying checkout holds; a
    // CRLF rewrite must not turn every /changelog reply into "unavailable".
    expect(parseAll(SAMPLE.replace(/\n/g, '\r\n'))).toEqual(parseAll(SAMPLE));
  });
});

/** Numeric semver tuple for ordering assertions. */
const semver = (v: string): number[] => v.split('.').map(Number);
const semverCompare = (a: string, b: string): number => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

describe("the bot's own CHANGELOG-laymans.md (bundled into /changelog)", () => {
  it('is bundled as text and every entry satisfies the contract', () => {
    expect(typeof botChangelog).toBe('string');
    const entries = parseAll(botChangelog);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.version, `version header ${entry.version}`).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.date, `date of ${entry.version}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.sections.length, `${entry.version} has no bullets`).toBeGreaterThan(0);
    }
  });

  it('has no `## ` header off the grammar (such a header is silently dropped, or merged into the entry above it)', () => {
    const headers = botChangelog.split(/\r?\n/).filter((line) => line.startsWith('## '));
    for (const header of headers) {
      expect(header).toMatch(/^## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}$/);
    }
    expect(headers.length).toBe(parseAll(botChangelog).length);
  });

  it('is ordered newest first, by version and by date', () => {
    const entries = parseAll(botChangelog);
    for (let i = 1; i < entries.length; i++) {
      const [newer, older] = [entries[i - 1], entries[i]];
      expect(semverCompare(newer.version, older.version), `${newer.version} above ${older.version}`).toBeGreaterThan(0);
      expect(newer.date >= older.date, `${newer.version} (${newer.date}) above ${older.version} (${older.date})`).toBe(true);
    }
  });

  it('never claims a release newer than the version this Worker ships as', () => {
    // release-process.md: the layman's file may LAG a release that has
    // nothing player-visible to say (security-only / dependency patches are
    // folded out), but it must never run AHEAD of package.json — that would
    // make /changelog describe a bot that is not deployed.
    expect(
      semverCompare(parseAll(botChangelog)[0].version, botPackage.version),
      `newest entry ${parseAll(botChangelog)[0].version} vs package.json ${botPackage.version}`
    ).toBeLessThanOrEqual(0);
  });

  it('renders its newest entry inside the /changelog embed budget, uncut', () => {
    const newest = parseAll(botChangelog)[0];
    const rendered = renderEntry(newest);
    expect(rendered.endsWith('…'), 'newest entry is cut — trim it or split it').toBe(false);
    expect(rendered.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });
});
