import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAll, parseLatestVersion } from './changelog-parser.js';
// The bot's own notes, bundled as text (wrangler Text rule / vitest plugin) —
// importing them here exercises the same path /changelog ships with.
import botChangelog from '../../CHANGELOG-laymans.md';
import botPackage from '../../package.json';

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

  it('is ordered newest first', () => {
    const dates = parseAll(botChangelog).map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('leads with the version this Worker ships as', () => {
    // release-process.md: the version bump and the layman's entry travel
    // together — a bump without notes would make /changelog lie about what
    // the deployed Worker is.
    expect(parseAll(botChangelog)[0].version).toBe(botPackage.version);
  });
});
