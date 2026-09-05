/**
 * XIV Dye Tools - Changelog Parser Tests
 *
 * Regression guard for the build-time CHANGELOG-laymans.md parser
 * (vite-plugin-changelog-parser.ts). The parser must keep matching the
 * canonical layman's format; if the file format and the parser ever drift
 * apart again, the `virtual:changelog` module silently goes empty.
 *
 * @module __tests__/changelog-parser.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChangelog } from '../../vite-plugin-changelog-parser';

// A representative sample mirroring the real CHANGELOG-laymans.md structure:
// page title, two releases (newest first), a section with bold-led bullets,
// a bullet-less "What you need to do" section, and a trailing footer after a rule.
const SAMPLE = `# What's New

---

## Web-App Version 4.11.0 — May 31, 2026

### New Spectrum Filters in the Color Palette

The Color Palette drawer now includes a new Spectrum filter row:

- **Standard Spectrum**
- **Wide Spectrum #1**

This makes browsing easier.

### What you need to do

Nothing. These changes are automatic and available immediately after deployment.

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*

## Web-App Version 4.10.0 — April 29, 2026

### Spectrum Info on Result Cards

- Result cards now show which Spectrum a dye belongs to.

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
`;

describe('parseChangelog', () => {
  it('parses every release in the file, newest first', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries.map((e) => e.version)).toEqual(['4.11.0', '4.10.0']);
  });

  it('extracts the date from the release header', () => {
    const [latest, previous] = parseChangelog(SAMPLE);
    expect(latest.date).toBe('May 31, 2026');
    expect(previous.date).toBe('April 29, 2026');
  });

  it('captures each "###" section as a header with bullets', () => {
    const [latest] = parseChangelog(SAMPLE);
    const headers = latest.sections.map((s) => s.header);
    expect(headers).toContain('New Spectrum Filters in the Color Palette');
    expect(headers).toContain('What you need to do');
  });

  it('strips inline markdown (** and links) from bullets', () => {
    const [latest] = parseChangelog(SAMPLE);
    const spectrumSection = latest.sections.find((s) => s.header.startsWith('New Spectrum'));
    expect(spectrumSection?.bullets).toContain('Standard Spectrum');
    expect(spectrumSection?.bullets.join(' ')).not.toContain('**');
  });

  it("folds a bullet-less section's prose into a single bullet", () => {
    const [latest] = parseChangelog(SAMPLE);
    const wync = latest.sections.find((s) => s.header === 'What you need to do');
    expect(wync?.bullets).toHaveLength(1);
    expect(wync?.bullets[0]).toContain('Nothing.');
  });

  it('excludes the trailing footer after the horizontal rule', () => {
    const entries = parseChangelog(SAMPLE);
    const allText = entries
      .flatMap((e) => e.sections.flatMap((s) => [s.header, ...s.bullets]))
      .join(' ');
    expect(allText).not.toContain('For technical details');
  });

  it('derives highlights from the section headers', () => {
    const [latest] = parseChangelog(SAMPLE);
    expect(latest.highlights).toContain('New Spectrum Filters in the Color Palette');
  });

  it('returns an empty array for content with no release headers', () => {
    expect(parseChangelog("# What's New\n\nNothing here yet.")).toEqual([]);
  });

  it('keeps a release that has bullets but no "### " heading', () => {
    const entries = parseChangelog(
      "# What's New\n\n## Web-App Version 9.9.9 — January 1, 2027\n\n- A bullet with no section heading above it.\n"
    );
    expect(entries.map((e) => e.version)).toEqual(['9.9.9']);
    expect(entries[0].sections[0].bullets).toEqual(['A bullet with no section heading above it.']);
    // Headerless on purpose: there is no honest name to invent, and the modal
    // skips the heading element when it is empty.
    expect(entries[0].sections[0].header).toBe('');
  });

  it('still skips a release header with no bullets under it at all', () => {
    expect(
      parseChangelog("# What's New\n\n## Web-App Version 9.9.9 — January 1, 2027\n\n")
    ).toEqual([]);
  });
});

/**
 * The suite above parses a synthetic SAMPLE, which by construction always
 * carries "### " headings — so it cannot notice the real file drifting into a
 * shape the parser drops. That is exactly what happened: every release from
 * 5.0.1 to 5.6.0 was written as plain bullets with no "### " heading, parsed to
 * zero sections, and was skipped by the `sections.length > 0` guard. The modal
 * then fell back to entries[0] and showed a reader on 5.6.0 the 5.0.0 notes.
 *
 * These read the real file and the real version, so the gap cannot reopen
 * silently.
 */
/**
 * The region above a release’s first "### " heading.
 *
 * Both shapes below parsed to nothing before extractSections folded that
 * region in: the first still lost its headline bullet after the original fix
 * (which only ran when the section count was zero), and the second was dropped
 * entirely because the headerless fallback collected bullets but never folded
 * prose the way a "### " section does.
 */
describe('loose content above the first heading', () => {
  it('keeps a headline bullet that sits above a "### " heading', () => {
    const sample = [
      '## Web-App Version 9.9.9 — January 1, 2027',
      '',
      '- A loose headline bullet',
      '',
      '### A real section',
      '',
      '- A section bullet',
    ].join('\n');

    const [entry] = parseChangelog(sample);

    expect(entry.sections).toHaveLength(2);
    expect(entry.sections[0]).toMatchObject({ header: '', bullets: ['A loose headline bullet'] });
    expect(entry.sections[1].header).toBe('A real section');
    // A headerless section still has to contribute a summary, or the collapsed
    // row and the auto-popup summary render blank for that release.
    expect(entry.highlights[0]).toBe('A loose headline bullet');
  });

  it('keeps a release written as prose, with no bullets and no heading', () => {
    const sample = [
      '## Web-App Version 9.9.8 — January 1, 2027',
      '',
      'This release is a rollback of 9.9.7.',
    ].join('\n');

    const [entry] = parseChangelog(sample);

    expect(entry.sections).toHaveLength(1);
    expect(entry.sections[0].bullets).toEqual(['This release is a rollback of 9.9.7.']);
  });

  it('still drops a release header with no content under it at all', () => {
    const sample = [
      '## Web-App Version 9.9.7 — January 1, 2027',
      '',
      '## Web-App Version 9.9.6 — January 1, 2027',
      '',
      '- Real content',
    ].join('\n');

    const versions = parseChangelog(sample).map((e) => e.version);

    expect(versions).toEqual(['9.9.6']);
  });
});
/** Numeric semver tuple for ordering assertions (mirrors discord-worker's). */
const semver = (v: string): number[] => v.split('.').map(Number);
const semverCompare = (a: string, b: string): number => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

const here = dirname(fileURLToPath(import.meta.url));

describe('the real CHANGELOG-laymans.md', () => {
  const realChangelog = readFileSync(resolve(here, '../../CHANGELOG-laymans.md'), 'utf8');
  const entries = parseChangelog(realChangelog);

  /** Mirrors MAX_VERSIONS_TO_INCLUDE in vite-plugin-changelog-parser.ts. */
  const PARSER_VERSION_CAP = 50;

  /** Every "## " line in the file, release header or not. */
  const h2Lines = realChangelog.split(/\r?\n/).filter((line) => line.startsWith('## '));

  it('has no "## " header off the parser grammar', () => {
    // A count that can only see what the parser sees cannot be a check ON the
    // parser. The first version of this gate counted headers with the parser's
    // own grammar, so a header missing the literal word "Version" was invisible
    // to BOTH and the release vanished with the suite green. Mirrors
    // apps/discord-worker/src/services/changelog-parser.test.ts.
    const offGrammar = h2Lines.filter(
      (line) => !/^##\s+[^\n]*?Version\s+\d+\.\d+\.\d+\s*(?:[—–-]\s*.+?)?\s*$/.test(line)
    );

    expect(offGrammar).toEqual([]);
  });

  it('parses every release header in the file', () => {
    expect(h2Lines.length).toBeGreaterThan(0);
    // Assert the cap explicitly. Without this, crossing it reds the parity
    // check below with "expected 51, got 50" and points at the parser rather
    // than at the limit that actually caused it.
    expect(h2Lines.length).toBeLessThanOrEqual(PARSER_VERSION_CAP);
    expect(entries).toHaveLength(h2Lines.length);
  });

  it('never advertises a release newer than the shipping build', () => {
    // release-process.md: the layman's file may LAG a release that has nothing
    // player-visible to say (dependency and security-only patches are folded
    // out of it), but it must never run AHEAD of package.json. Asserting that
    // the shipping version is PRESENT would turn any such patch bump into a
    // hard test failure and force an invented player-facing bullet into a
    // user-visible file.
    //
    // Read package.json rather than APP_VERSION: that constant comes from a
    // build-time define and is '0.0.0' under vitest, so asserting on it would
    // pass against a file with no matching entry at all.
    const pkg = JSON.parse(readFileSync(resolve(here, '../../package.json'), 'utf8'));
    expect(entries.length).toBeGreaterThan(0);
    expect(
      semverCompare(entries[0].version, pkg.version),
      `newest entry ${entries[0].version} vs package.json ${pkg.version}`
    ).toBeLessThanOrEqual(0);
  });

  it('gives every parsed release at least one bullet to render', () => {
    const empty = entries.filter((e) => !e.sections.some((s) => s.bullets.length > 0));
    expect(empty.map((e) => e.version)).toEqual([]);
  });
});
