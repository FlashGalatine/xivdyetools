# Dead-code review: apps/og-worker (preview/integration-2026-10-04)

## Route map (src/index.ts)
Crawler HTML: `/{tool}`, `/{tool}/` for the 10 SUPPORTED_TOOLS (index.ts:98-109, 616-618), `/presets/:presetId` (622), `/`, catch-all.
Images: `/og/:tool/default.png` (788), harmony (803), gradient (856), mixer 2- and 3-dye (901, 947), swatch (995), comparison (1041), accessibility (1075), extractor (1120), presets (1162), budget (1208), `/og/default.png` (1230), `/health` (466).
Every image route is emitted by og-data-generator.ts imageUrl builders (lines 189, 264, 283, 315, 345, 358, 418, 466, 504, 533, 573, 598, 617, 632, 942). `?frame=x` emitted via withFrameX (og-data-generator.ts:702, twitter:image). web-app's static `/og/default.png` and `/og/default-x.png` are Pages files (apps/web-app/public/og/), not og-worker routes; no other app emits `/og/` URLs (git grep). No route is defined-but-never-emitted. No `/og/glamour/...` parameterised route and none is emitted (glamour only uses default.png).
Crawler patterns (crawler-detector.ts:19-47): every CrawlerType (discord, twitter, facebook, linkedin, slack, telegram, whatsapp, other) is produced by a pattern; `none` by the fallthrough.

## Commands and results
- `git ls-files apps/og-worker`: 56 non-font files + 10 TTF.
- `pnpm exec knip` and `pnpm exec knip --production` in apps/og-worker: both exit 0, no findings.
- Export census: grep of `^export (function|const|interface|type|class)` over src gave 134 symbols; per-symbol prod-file/test-file counts (scratch ogfast.sh, tracked files only). Symbols with a single prod file (self-use only): the *OGOptions interfaces, BandCardOptions, DefaultCardOptions, OgDeckStrings, DyeMatch, DeckLineKey, EmbedKey, RoleKey, ToolTagKey, OG_DECK_LINE, OG_ROLE, DECK_H, NOT_FOUND_LABEL_MAX, clipLabel, detectCrawler, harmonyToKey, generate{Budget,Extractor,Presets,Gradient,Harmony,Mixer,Swatch}OGData, DEFAULT_MIX_MODE. All are used inside their own file (grep -w count >= 2), which is why knip (ignoreExportsUsedInFile) is silent. None has zero uses. Their `export` keyword is only needed by tests (e.g. DECK_H band.test.ts:127) or by nothing: cosmetic, not dead code.
- `symrefs.sh apps/og-worker ...` over all symbols was started but is O(repo) per symbol (>10 min); the first 39 lines agreed with the faster per-unit census. Not relied on for any verdict.
- Dead-path markers: `git grep -E "@deprecated|TODO|LEGACY|OBSOLETE|HACK|compat" -- apps/og-worker/src apps/og-worker/tests` (non-test): only a "compatible;" UA string in a JSDoc example. None.
- Skips: `git grep -E "\.(skip|todo|only)\(|xit\(|xdescribe" -- apps/og-worker`: none.
- Imports of `@/`: `git grep "from '@/"` in apps/og-worker: none (see candidate 2).
- wrangler.toml: vars APP_BASE_URL (index.ts:480-494,537,574,1258), OG_IMAGE_BASE_URL (index.ts:480; og-data-generator), ANALYTICS binding (index.ts:443-448), `[[rules]]` ttf Data (fonts.ts imports) all read. Env fields (types.ts:16-23) all declared and read; no env read undeclared.
- Fonts: all 10 TTFs imported in services/fonts.ts:31-52 and listed in getFontBuffers; STACKS (tokens.ts:17-21) names Fragment Mono, Onest, Space Grotesk, Noto JP/SC/KR. scripts/subset-cjk-fonts.py referenced by CLAUDE.md and font-coverage.test.ts workflow; a manual tool (entry by convention).
- Locale tables: every EmbedKey (og-embed.ts:33-75; gender.* built via template at og-data-generator.ts:201) and every RoleKey (og-strings.ts:304-319) has a call site (grep). No orphan keys.
- Dependencies (package.json): @resvg/resvg-wasm (renderer.ts:11,15), @xivdyetools/core, svg (band.ts:38, default-card.ts:31, band-shared.ts:7), types, worker-kit (index.ts:25), hono, workers-types and @types/node (tsconfig types), vitest, @vitest/coverage-v8 (vitest config provider), wrangler (scripts): all live.
- DEPRECATIONS.md: `git grep -i og-worker -- DEPRECATIONS.md` empty: nothing retired for this unit.
- PR #231 delta (package.json, wrangler.toml observability pins, tests/wrangler-env.test.ts): only config and one test; nothing orphaned. Delta since 2026-09-15 (index.ts, crawler-detector.ts, types.ts, og-embed/og-strings, default-card): getCrawlerName was already removed with its caller; `git grep getCrawlerName` has no hits. Its removal left one more orphan, see candidate 1.

## Candidates
1. CrawlerInfo.userAgent is now write-only in production. types.ts:184 field; written at crawler-detector.ts:69, :78, :86. The only prod reader was the structured log in createToolHandler, which the privacy change removed (index.ts ~589, "Coarse diagnostics only"); `git grep userAgent -- apps/og-worker` shows only crawler-detector.test.ts assertions (lines 17-175) and a not.toHaveProperty('userAgent') guard in index.privacy.test.ts:47. Test-only field, ~4 lines plus test expectations. Origin: MAIN since 2026-09-15 cleanup / the privacy-logging change (not an open PR). Rec: delete the field and the 7 test `userAgent:` expectations; or KEEP if a future new-crawler debug log is wanted. Borderline: it is also internal-only (private worker, not published).
2. Unused `@` path alias: vitest.config.ts:32-34 (`resolve.alias '@'`) and tsconfig.json:8-11 (`baseUrl` + `paths "@/*"`). `git grep "from '@/"` and `import('@/` over apps/og-worker find zero uses. Dead config (~8 lines). Safe to remove; check baseUrl is not needed by anything else (none found).
3. (Low value, optional) Export-only-for-tests: DECK_H (band.ts:63; test band.test.ts:127 asserts its literal value only, an assertion of a constant), NOT_FOUND_LABEL_MAX / clipLabel (band-shared.ts:77,80), and generateBudgetOGData / generateExtractorOGData / generatePresetsOGData (og-data-generator.ts; zero test refs outside own file, used by generateOGDataForTool). They are live in-file; only the `export` is unneeded. Not worth a sprint item.

## Positive controls
- knip default and --production both clean (exit 0) with the `!`-marked project glob.
- The prior audit's 17 cleanups hold: getCrawlerName gone, no remnants in tests/mocks.
- Every route/crawler type/locale key/font/wrangler var has a live emitter or reader.
- getFontBuffers/renderOGImage mocked only where the renderer exists (vi.mock targets './services/renderer' exist).
- Tests all target existing modules; no skips.

## Rejected (checked, live)
- `/og/default.png`, `/og/:tool/default.png`: emitted by og-data-generator.ts:189,264,617,632,942 and the tool-default cards.
- `?frame=x` / frameFromQuery: emitted in twitter:image (og-data-generator.ts:702); web-app static default-x.png only mirrors it.
- `og_request` / `og_image_request` AnalyticsEvent (types.ts:192): index.ts:584, 834-1218.
- CrawlerType values telegram/whatsapp/linkedin/slack: produced by patterns, written to Analytics blobs and the crawler log field.
- glamour tool: added to SUPPORTED_TOOLS, default card, embed key and `defaultMethodTag` (default-card.ts); all reachable.
- OG_MIN/MAX_* constants: used in index.ts and og-data-generator.ts.
- SPA_PASSTHROUGH_TIMEOUT_MS/isPassThroughTimeout/passThroughToOrigin: two call sites.
- readsWheel: single caller in the cache-key middleware; fixes BUG-018.
- tests/wrangler-env.test.ts: guards isOgImageHost invariant (index.ts:480).

## Prior KEEP register
DEAD-018 (core APIs), DEAD-019 (Stoat scaffolding), DEAD-020 (rate-limit fallbacks), DEAD-021 (Discord test contract): none applies to og-worker; no triggers evaluated here. og-worker has no rate limiter and no @testonly/@entrypoint/@public exemption (dead-code-check.txt lists none for apps/og-worker).

## Files covered
src: 29 non-test .ts, 17 test .ts, tests/1, config (knip.jsonc, package.json, tsconfig.json, vitest.config.ts, wrangler.toml), scripts/subset-cjk-fonts.py, 10 fonts, CLAUDE.md.
