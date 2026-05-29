/**
 * Unit tests for the changelog parser.
 *
 * parseLatestVersion reads CHANGELOG-laymans.md format and returns a structured
 * object. Since this is pure string-processing logic there are no external deps.
 */

import { describe, it, expect } from 'vitest';
import { parseLatestVersion, type ChangelogEntry } from './changelog-parser.js';

// ============================================================================
// Fixtures
// ============================================================================

const SINGLE_VERSION = `
## [2.5.0] - 2026-04-28

### New Features
- Added Patch 7.5 dye consolidation support
- Type-A/B/C dyes now share consolidated item IDs

### Bug Fixes
- Fixed budget command with facewear dyes
- Corrected Korean dye names in locale files
`;

const MULTI_VERSION = `
## [2.5.1] - 2026-05-01

### Improvements
- Better error messages

## [2.5.0] - 2026-04-28

### New Features
- Patch 7.5 consolidation
`;

const MINIMAL_VERSION = `
## [1.0.0] - 2024-01-01

### Changes
- Initial release
`;

const NO_SECTIONS = `
## [1.0.0] - 2024-01-01
`;

const EMPTY_STRING = '';

const MALFORMED_HEADER = `
# Bad Header
Some content
`;

// ============================================================================
// parseLatestVersion
// ============================================================================

describe('parseLatestVersion', () => {
  describe('valid single-version changelog', () => {
    it('parses version and date', () => {
      const entry = parseLatestVersion(SINGLE_VERSION);

      expect(entry).not.toBeNull();
      expect(entry!.version).toBe('2.5.0');
      expect(entry!.date).toBe('2026-04-28');
    });

    it('parses sections with correct titles', () => {
      const entry = parseLatestVersion(SINGLE_VERSION)!;

      expect(entry.sections).toHaveLength(2);
      expect(entry.sections[0].title).toBe('New Features');
      expect(entry.sections[1].title).toBe('Bug Fixes');
    });

    it('parses bullet items under each section', () => {
      const entry = parseLatestVersion(SINGLE_VERSION)!;
      const newFeatures = entry.sections[0];

      expect(newFeatures.items).toHaveLength(2);
      expect(newFeatures.items[0]).toBe('Added Patch 7.5 dye consolidation support');
      expect(newFeatures.items[1]).toBe('Type-A/B/C dyes now share consolidated item IDs');
    });

    it('parses bug fix items', () => {
      const entry = parseLatestVersion(SINGLE_VERSION)!;
      const bugFixes = entry.sections[1];

      expect(bugFixes.items).toHaveLength(2);
      expect(bugFixes.items[0]).toBe('Fixed budget command with facewear dyes');
    });
  });

  describe('multi-version changelog', () => {
    it('returns only the first (latest) version', () => {
      const entry = parseLatestVersion(MULTI_VERSION)!;

      expect(entry.version).toBe('2.5.1');
      expect(entry.date).toBe('2026-05-01');
    });

    it('does not include sections from the second version', () => {
      const entry = parseLatestVersion(MULTI_VERSION)!;

      // Only "Improvements" section from 2.5.1; "New Features" from 2.5.0 not included
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].title).toBe('Improvements');
    });
  });

  describe('minimal changelog', () => {
    it('parses a single section correctly', () => {
      const entry = parseLatestVersion(MINIMAL_VERSION)!;

      expect(entry.version).toBe('1.0.0');
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].title).toBe('Changes');
      expect(entry.sections[0].items[0]).toBe('Initial release');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseLatestVersion(EMPTY_STRING)).toBeNull();
    });

    it('returns null for malformed header (no ## [x.y.z] - date pattern)', () => {
      expect(parseLatestVersion(MALFORMED_HEADER)).toBeNull();
    });

    it('returns an entry with no sections when the version has no ### blocks', () => {
      const entry = parseLatestVersion(NO_SECTIONS);

      expect(entry).not.toBeNull();
      expect(entry!.version).toBe('1.0.0');
      expect(entry!.sections).toHaveLength(0);
    });

    it('handles asterisk bullet items as well as dash bullets', () => {
      const markdown = `
## [1.2.3] - 2025-06-01

### Changes
* First item
* Second item
`;
      const entry = parseLatestVersion(markdown)!;

      expect(entry.sections[0].items).toHaveLength(2);
      expect(entry.sections[0].items[0]).toBe('First item');
    });

    it('trims whitespace from date and section titles', () => {
      const markdown = `
## [1.0.0] -   2024-01-01

###   Whitespace Title
- Item
`;
      const entry = parseLatestVersion(markdown)!;

      expect(entry.date).toBe('2024-01-01');
      expect(entry.sections[0].title).toBe('Whitespace Title');
    });

    it('skips sections with no items (does not include them in sections array)', () => {
      const markdown = `
## [1.0.0] - 2024-01-01

### Empty Section

### Non-Empty Section
- Has an item
`;
      const entry = parseLatestVersion(markdown)!;

      // Only "Non-Empty Section" has items; "Empty Section" is skipped
      expect(entry.sections).toHaveLength(1);
      expect(entry.sections[0].title).toBe('Non-Empty Section');
    });
  });

  describe('return type shape', () => {
    it('returns a ChangelogEntry with version, date, and sections', () => {
      const entry = parseLatestVersion(SINGLE_VERSION) as ChangelogEntry;

      expect(typeof entry.version).toBe('string');
      expect(typeof entry.date).toBe('string');
      expect(Array.isArray(entry.sections)).toBe(true);

      for (const section of entry.sections) {
        expect(typeof section.title).toBe('string');
        expect(Array.isArray(section.items)).toBe(true);
      }
    });
  });
});
