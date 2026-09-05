/**
 * Vite plugin to parse user-friendly changelog and provide changelog data at build time
 *
 * This plugin reads a user-friendly changelog (CHANGELOG-tldr.md or CHANGELOG-laymans.md)
 * from the project root, extracts version entries with their highlights, and exposes them
 * as a virtual module.
 *
 * Usage in code:
 *   import { changelogEntries } from 'virtual:changelog'
 *
 * Expected CHANGELOG-laymans.md format (one block per release, newest first):
 *
 *   # What's New
 *   ## Web-App Version 4.11.0 — May 31, 2026
 *   ### A plain-language section heading
 *   Optional intro paragraph.
 *   - **Bold lead-in** then more text
 *   - Another bullet
 *   ### What you need to do
 *   Nothing. …
 *   ---
 *   *For technical details, see CHANGELOG.md*
 *
 * @module vite-plugin-changelog-parser
 */
import type { Plugin } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Types
// ============================================================================

interface ChangelogSection {
  header: string;
  title: string;
  bullets: string[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
  sections: ChangelogSection[];
}

// ============================================================================
// Parser Configuration
// ============================================================================

const MAX_HIGHLIGHTS_PER_VERSION = 6;
const MAX_VERSIONS_TO_INCLUDE = 50; // Show the full release history; bounded to keep the bundle sane
const MAX_HIGHLIGHT_LENGTH = 100; // Truncate very long highlights
const MAX_BULLET_LENGTH = 200; // Truncate very long bullet descriptions

// ============================================================================
// Changelog Parser
// ============================================================================

/**
 * Strip inline markdown that the modal renders as plain text (it uses
 * `textContent`, so `**` / `*` / `[label](url)` would otherwise show literally).
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → label
    .replace(/`([^`]+)`/g, '$1') // inline code
    .trim();
}

/**
 * Parse CHANGELOG-laymans.md and extract version entries.
 *
 * Format (newest release first):
 *   ## Web-App Version 4.11.0 — May 31, 2026
 *   ### A plain-language section heading
 *   - bullet text
 *
 * Exported for unit testing.
 */
export function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  // Match release headers like: "## Web-App Version 4.11.0 — May 31, 2026".
  // The leading "Web-App" is optional and the date (after an em/en dash or hyphen)
  // is optional. The single-"#" page title and "###" sub-headings never match.
  const versionHeaderRegex = /^##\s+[^\n]*?Version\s+(\d+\.\d+\.\d+)\s*(?:[—–-]\s*(.+?))?\s*$/gm;

  // Find all version headers with their positions and dates
  const headers: Array<{ version: string; date: string; startIndex: number }> = [];
  let match;

  while ((match = versionHeaderRegex.exec(content)) !== null) {
    headers.push({
      version: match[1],
      date: match[2] ? match[2].trim() : '',
      startIndex: match.index,
    });
  }

  for (let i = 0; i < Math.min(headers.length, MAX_VERSIONS_TO_INCLUDE); i++) {
    const header = headers[i];
    const nextHeader = headers[i + 1];

    // Content between this header and the next (or end of file)
    const sectionStart = header.startIndex;
    const sectionEnd = nextHeader ? nextHeader.startIndex : content.length;
    let block = content.slice(sectionStart, sectionEnd);

    // Trim at the first horizontal rule so a trailing footer
    // (e.g. "*For technical details, see CHANGELOG.md*") never leaks into a section.
    const ruleIndex = block.search(/^\s*---\s*$/m);
    if (ruleIndex !== -1) {
      block = block.slice(0, ruleIndex);
    }

    const sections = extractSections(block);
    const highlights = extractHighlights(sections);

    if (sections.length > 0) {
      entries.push({
        version: header.version,
        date: header.date,
        highlights,
        sections,
      });
    }
  }

  return entries;
}

/**
 * Derive highlight titles from the parsed sections.
 *
 * In the current format each "###" heading is a user-friendly title, so the
 * section headers double as highlights (used by the auto-popup's
 * "previous updates" summary and as a backward-compatible fallback).
 */
function extractHighlights(sections: ChangelogSection[]): string[] {
  const highlights: string[] = [];

  for (const section of sections) {
    let highlight = section.header.trim();

    // A headerless section (a release written as plain bullets, or the loose
    // bullets above a release’s first "### ") has no name to show. Fall back to
    // its first bullet so the collapsed row and the auto-popup’s "previous
    // updates" summary are never blank. changelog-modal cannot paper over this
    // on its own: its `??` chain only falls through on null/undefined, so an
    // empty-string header short-circuits it and renders no summary at all.
    if (!highlight) highlight = (section.bullets[0] ?? '').trim();

    if (highlight.length < 3) continue;

    if (highlight.length > MAX_HIGHLIGHT_LENGTH) {
      highlight = highlight.slice(0, MAX_HIGHLIGHT_LENGTH - 3) + '...';
    }

    highlights.push(highlight);
    if (highlights.length >= MAX_HIGHLIGHTS_PER_VERSION) break;
  }

  return highlights;
}

/**
 * Extract full sections from a version block.
 *
 * Each section is delimited by a "### " heading. Within each section we capture:
 * - header: the "###" heading text (e.g., "New Spectrum Filters in the Color Palette")
 * - title: "" — this format has no standalone bold title line, so the modal renders no badge
 * - bullets: the dash-prefixed description lines (inline markdown stripped)
 *
 * The region ABOVE the first "### " is folded into an implicit headerless
 * section rather than discarded. Two shapes depend on that:
 *
 * - A release written as "## …Version X" plus plain bullets and no "### " at
 *   all. That parsed to zero sections and was dropped **silently** by
 *   parseChangelog's `sections.length > 0` guard, which is how every release
 *   from 5.0.1 to 5.6.0 went missing from the modal: a reader on 5.6.0 was
 *   shown 5.0.0, because changelog-modal's findIndex on APP_VERSION missed and
 *   fell back to entries[0].
 * - A release that opens with a headline bullet and THEN uses "### " headings.
 *   The first fix for the above ran a separate fallback only when the section
 *   count was zero, so this shape still lost its headline bullet — and no gate
 *   could see it, because the entry still parsed. Folding here covers both.
 *
 * A block with nothing above its first heading contributes no section, so
 * well-formed entries are unchanged. A header line with no bullets and no
 * prose at all still yields no section, which keeps the "genuinely empty
 * entries are skipped" behaviour the guard was written for.
 */
function extractSections(block: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];

  // Split on "### " headings (level 3). Chunk 0 is the release-header area.
  const sectionBlocks = block.split(/^### /gm);

  // Drop the "## …Version X" line itself, then fold whatever is left above the
  // first heading. `header: ''` is deliberate — there is no honest name to
  // invent for it, and changelog-modal.createSectionBlock skips the heading
  // element when it is empty.
  const looseBullets = collectBullets(sectionBlocks[0].split('\n').slice(1));
  if (looseBullets.length > 0) {
    sections.push({ header: '', title: '', bullets: looseBullets });
  }

  for (let i = 1; i < sectionBlocks.length; i++) {
    const lines = sectionBlocks[i].split('\n');
    const header = stripInlineMarkdown(lines[0]);
    if (!header) continue;

    sections.push({ header, title: '', bullets: collectBullets(lines.slice(1)) });
  }

  return sections;
}

/**
 * Collect the renderable bullets out of a run of lines.
 *
 * Shared by both section shapes so they cannot drift apart: a bullet-less run
 * (e.g. "What you need to do", or a release written as a single paragraph)
 * keeps its prose as one folded bullet instead of being dropped. The previous
 * headerless fallback duplicated only the bullet half of this loop, which is
 * why a prose-only release still vanished.
 */
function collectBullets(lines: string[]): string[] {
  const bullets: string[] = [];
  const paragraphs: string[] = [];

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*-\s+(.+)/);
    if (bulletMatch) {
      bullets.push(truncate(stripInlineMarkdown(bulletMatch[1])));
      continue;
    }
    const trimmed = stripInlineMarkdown(line);
    if (trimmed) paragraphs.push(trimmed);
  }

  if (bullets.length === 0 && paragraphs.length > 0) {
    bullets.push(truncate(paragraphs.join(' ')));
  }

  return bullets;
}

/** Truncate an overly long bullet for display. */
function truncate(text: string): string {
  return text.length > MAX_BULLET_LENGTH ? text.slice(0, MAX_BULLET_LENGTH - 3) + '...' : text;
}

// ============================================================================
// Vite Plugin
// ============================================================================

const VIRTUAL_MODULE_ID = 'virtual:changelog';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/** Candidate filenames for the user-friendly changelog, in priority order */
const CHANGELOG_CANDIDATES = ['CHANGELOG-laymans.md', 'CHANGELOG-tldr.md'] as const;

export function changelogParser(): Plugin {
  let changelogPath: string;
  let cachedEntries: ChangelogEntry[] | null = null;

  return {
    name: 'changelog-parser',

    configResolved(config) {
      // Resolve relative to the project directory (where package.json lives),
      // not config.root which may point to a subdirectory (e.g. 'src')
      const projectDir = resolve(config.root, '..');

      // Try each candidate filename, use the first one that exists
      for (const filename of CHANGELOG_CANDIDATES) {
        const candidate = resolve(projectDir, filename);
        if (existsSync(candidate)) {
          changelogPath = candidate;
          return;
        }
      }
      // Fallback to first candidate (will produce a clear error on load if missing)
      changelogPath = resolve(projectDir, CHANGELOG_CANDIDATES[0]);
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        // Parse changelog if not cached
        if (!cachedEntries) {
          try {
            const content = readFileSync(changelogPath, 'utf-8');
            cachedEntries = parseChangelog(content);
            console.log(`[changelog-parser] Parsed ${cachedEntries.length} changelog entries`);
          } catch (error) {
            console.warn(`[changelog-parser] Failed to parse ${changelogPath}:`, error);
            cachedEntries = [];
          }
        }

        // Export as ES module
        return `export const changelogEntries = ${JSON.stringify(cachedEntries, null, 2)};`;
      }
    },

    // Watch the changelog file for changes in dev mode
    configureServer(server) {
      server.watcher.add(changelogPath);
      server.watcher.on('change', (path) => {
        if (path === changelogPath) {
          console.log('[changelog-parser] Changelog changed, invalidating cache');
          cachedEntries = null;

          // Invalidate the virtual module to trigger HMR
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
      });
    },
  };
}
