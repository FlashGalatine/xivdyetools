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
const MAX_VERSIONS_TO_INCLUDE = 6;
const MAX_HIGHLIGHT_LENGTH = 100; // Truncate very long highlights

// ============================================================================
// Changelog Parser
// ============================================================================

/**
 * Parse CHANGELOG-laymans.md and extract version entries
 *
 * Format:
 *   # What's New in Version X.Y.Z
 *   *Released: Month Day, Year*
 *   ## 🐛 Section Header
 *   **Bold Highlight Title**
 *   - Explanation bullet points
 */
function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  // Regex to match version headers: # What's New in Version 4.1.1
  const versionHeaderRegex = /^# What's New in Version (\d+\.\d+\.\d+)/gm;

  // Find all version headers with their positions
  const headers: Array<{ version: string; startIndex: number }> = [];
  let match;

  while ((match = versionHeaderRegex.exec(content)) !== null) {
    headers.push({
      version: match[1],
      startIndex: match.index,
    });
  }

  // Extract highlights for each version section
  for (let i = 0; i < Math.min(headers.length, MAX_VERSIONS_TO_INCLUDE); i++) {
    const header = headers[i];
    const nextHeader = headers[i + 1];

    // Get the section content between this header and the next (or end of file)
    const sectionStart = header.startIndex;
    const sectionEnd = nextHeader ? nextHeader.startIndex : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd);

    // Extract date from section: *Released: Month Day, Year*
    const dateMatch = sectionContent.match(/\*Released: ([^*]+)\*/);
    const date = dateMatch ? dateMatch[1].trim() : '';

    // Extract bold headings (for backward compat) and full sections
    const highlights = extractHighlights(sectionContent);
    const sections = extractSections(sectionContent);

    if (highlights.length > 0 || sections.length > 0) {
      entries.push({
        version: header.version,
        date,
        highlights,
        sections,
      });
    }
  }

  return entries;
}

/**
 * Extract highlight titles from a version section
 *
 * Strategy for CHANGELOG-laymans.md:
 * 1. Find all bold headings: **Title Text**
 * 2. These are user-friendly feature/fix titles
 * 3. Truncate overly long highlights
 */
function extractHighlights(sectionContent: string): string[] {
  const highlights: string[] = [];

  // Match bold headings: **Title Text**
  // These appear at the start of a line (possibly with whitespace)
  const boldHeadingRegex = /^\s*\*\*([^*]+)\*\*/gm;

  let match;
  while ((match = boldHeadingRegex.exec(sectionContent)) !== null) {
    let highlight = match[1].trim();

    // Skip empty or very short headings
    if (highlight.length < 5) continue;

    // Truncate if too long
    if (highlight.length > MAX_HIGHLIGHT_LENGTH) {
      highlight = highlight.slice(0, MAX_HIGHLIGHT_LENGTH - 3) + '...';
    }

    highlights.push(highlight);

    // Stop once we have enough
    if (highlights.length >= MAX_HIGHLIGHTS_PER_VERSION) break;
  }

  return highlights;
}

/**
 * Extract full sections from a version block
 *
 * Each section is delimited by a ## heading. Within each section, we capture:
 * - header: the ## heading text (e.g., "🎨 No More Duplicate Results")
 * - title: the first bold heading (e.g., "Harmony Explorer & Palette Extractor")
 * - bullets: the dash-prefixed description lines
 */
function extractSections(sectionContent: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];

  // Split by ## headings (level 2). The first chunk is the version header area.
  const sectionBlocks = sectionContent.split(/^## /gm);

  // Skip the first block (it's the version header / date area)
  for (let i = 1; i < sectionBlocks.length; i++) {
    const block = sectionBlocks[i];

    // First line of the block is the heading text (after the ## we split on)
    const lines = block.split('\n');
    const header = lines[0].trim();

    // Find the bold title: **Title**
    const titleMatch = block.match(/^\s*\*\*([^*]+)\*\*/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract bullet points: lines starting with -
    const bullets: string[] = [];
    for (const line of lines) {
      const bulletMatch = line.match(/^\s*-\s+(.+)/);
      if (bulletMatch) {
        let bullet = bulletMatch[1].trim();
        if (bullet.length > 200) {
          bullet = bullet.slice(0, 197) + '...';
        }
        bullets.push(bullet);
      }
    }

    if (header) {
      sections.push({ header, title, bullets });
    }
  }

  return sections;
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
