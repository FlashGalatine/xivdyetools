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
});
