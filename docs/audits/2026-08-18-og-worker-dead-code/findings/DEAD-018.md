# [DEAD-018]: Docs drift — retired `@xivdyetools/worker-middleware` reference, README's "own local theme, not the 5.0 frame system", CLAUDE.md dependency table missing `@xivdyetools/svg`

## Category
Legacy Code (documentation drift)

## Location
- `src/index.ts:108-109` — "REFACTOR-002 … aligns og-worker with the shared `@xivdyetools/worker-middleware` stack" — that package was retired in the Monorepo 2.0 Tier-1 consolidation (`DEPRECATIONS.md`); the import on line 19-23 is `@xivdyetools/worker-kit`.
- `apps/og-worker/README.md:92` — "this Worker keeps its **own** local theme and card layouts. It is on the OG card directions, not the bot's 5.0 frame system" — false since v2.0.0: band.ts:41-44 says the stacks "mirror the bot frame system's stacks", `ogMark` uses `GLYPH_ACCENT_LIGHT` from the package, and the local `THEME` is dead (DEAD-004).
- `apps/og-worker/CLAUDE.md` "Dependencies" table lists `hono`, `@resvg/resvg-wasm`, `@cloudflare/workers-types`, `core`, `types`, `worker-kit` — omits `@xivdyetools/svg`, which supplies `toolGlyph`, `GLYPH_ACCENT_LIGHT`, `escapeXml`, `estimateTextWidth` (four prod files import it). "Related Projects → Dependencies (internal)" repeats the omission.
- `apps/og-worker/CLAUDE.md` file map: `fonts.ts # getFontBuffers() + FONT_FAMILIES export` (DEAD-006), `swatch.ts … async, may consult color sheets` (DEAD-002/015), bindings table row `OG_CACHE` (DEAD-009).

## Recommendation
**UPDATE** — one docs commit alongside the code waves. These are the lines the next reader will trust.
