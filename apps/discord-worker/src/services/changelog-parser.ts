/**
 * Changelog Parser
 *
 * Parses the root CHANGELOG-laymans.md (product-level, both surfaces) for
 * Discord announcement formatting and the /changelog command.
 *
 * Strict format contract (parse failures are silent by design — keep to it):
 * ```
 * ## [x.y.z] - YYYY-MM-DD
 * ### Section Title            (emoji in section titles is welcome)
 * - Item description           (short, self-contained bullets)
 * ```
 * Newest entry first. Entries say which surface changed (web app / Discord
 * bot). The file lives at the repository root — the GitHub webhook's raw
 * fetch and its path trigger both assume exactly that.
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
 * Parse every version entry from a changelog markdown string, newest first
 * (file order). The /changelog command renders the whole parsed history;
 * the webhook announcement takes `[0]`.
 */
export function parseAll(markdown: string): ChangelogEntry[] {
  const lines = markdown.split('\n');
  const entries: ChangelogEntry[] = [];

  let current: ChangelogEntry | null = null;
  let currentSection: ChangelogSection | null = null;

  const closeSection = (): void => {
    if (current && currentSection && currentSection.items.length > 0) {
      current.sections.push(currentSection);
    }
    currentSection = null;
  };

  const closeEntry = (): void => {
    closeSection();
    if (current) {
      entries.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    // Match version header: ## [x.y.z] - YYYY-MM-DD
    const versionMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
    if (versionMatch) {
      closeEntry();
      current = { version: versionMatch[1], date: versionMatch[2].trim(), sections: [] };
      continue;
    }

    if (!current) continue;

    // Match section header: ### Section Title
    const sectionMatch = line.match(/^### (.+)$/);
    if (sectionMatch) {
      closeSection();
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      continue;
    }

    // Match bullet items: - Item text
    const itemMatch = line.match(/^[-*]\s+(.+)$/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1].trim());
    }
  }

  closeEntry();
  return entries;
}

/**
 * Extracts the latest (first) version entry from a changelog markdown string.
 *
 * @param markdown - Raw markdown content of CHANGELOG-laymans.md
 * @returns The parsed latest version entry, or null if none found
 */
export function parseLatestVersion(markdown: string): ChangelogEntry | null {
  return parseAll(markdown)[0] ?? null;
}
