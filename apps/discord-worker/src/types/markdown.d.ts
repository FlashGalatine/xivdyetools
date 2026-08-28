/**
 * Markdown bundled as text.
 *
 * Production: the `*.md` Text rule in wrangler.toml (`[[rules]] type = "Text"`)
 * inlines an imported markdown file as its string contents. Tests: the
 * markdown-as-text plugin (vitest.markdown-plugin.ts) does the same under
 * Vite. The one consumer is `/changelog`, which bundles
 * `apps/discord-worker/CHANGELOG-laymans.md` this way.
 */
declare module '*.md' {
  const markdown: string;
  export default markdown;
}
