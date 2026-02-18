/**
 * Changelog Parser
 *
 * Parses CHANGELOG-laymans.md to extract the latest version entry
 * for Discord announcement formatting.
 *
 * Expected format:
 * ```
 * ## [x.y.z] - YYYY-MM-DD
 * ### Section Title
 * - Item description
 * ```
 *
 * @module services/changelog-parser
 */

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

/**
 * Extracts the latest (first) version entry from a changelog markdown string.
 *
 * @param markdown - Raw markdown content of CHANGELOG-laymans.md
 * @returns The parsed latest version entry, or null if none found
 */
export function parseLatestVersion(markdown: string): ChangelogEntry | null {
  const lines = markdown.split('\n');

  let version: string | null = null;
  let date: string | null = null;
  const sections: ChangelogSection[] = [];
  let currentSection: ChangelogSection | null = null;
  let foundFirst = false;

  for (const line of lines) {
    // Match version header: ## [x.y.z] - YYYY-MM-DD
    const versionMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
    if (versionMatch) {
      if (foundFirst) {
        // We've hit the second version header — stop
        break;
      }
      version = versionMatch[1];
      date = versionMatch[2].trim();
      foundFirst = true;
      continue;
    }

    // Skip lines until we've found a version header
    if (!foundFirst) continue;

    // Match section header: ### Section Title
    const sectionMatch = line.match(/^### (.+)$/);
    if (sectionMatch) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      continue;
    }

    // Match bullet items: - Item text
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1].trim());
    }
  }

  // Push the last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  if (!version || !date) {
    return null;
  }

  return { version, date, sections };
}
