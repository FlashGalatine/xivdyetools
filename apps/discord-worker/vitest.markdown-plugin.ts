import { readFileSync } from 'node:fs';

/**
 * Markdown as text, for Vitest.
 *
 * Mirrors wrangler's `[[rules]] type = "Text"` for `*.md` (wrangler.toml):
 * in the deployed Worker a `.md` import is the file's contents as a string,
 * and this plugin makes the same import resolve the same way under Vite, so
 * tests exercise the real bundled file. Without it Vite tries to parse the
 * markdown as JavaScript ("Failed to parse source for import analysis").
 *
 * One consumer: `/changelog` bundles `apps/discord-worker/CHANGELOG-laymans.md`
 * (see src/types/markdown.d.ts for the module typing).
 */
export function markdownAsText() {
  return {
    name: 'xivdyetools:markdown-as-text',
    enforce: 'pre' as const,
    load(id: string): string | null {
      if (!id.endsWith('.md')) return null;
      return `export default ${JSON.stringify(readFileSync(id, 'utf8'))};`;
    },
  };
}
