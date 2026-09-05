# Sweep D findings — user-guides / specifications / maintainer

Verified against the worktree at 1eb57cda (= origin/main 2026-09-05). Evidence is path:line in the code.

| ID | File:line | Claim | Reality (evidence) | Sev | Proposed fix |
|----|-----------|-------|--------------------|-----|--------------|
| D-01 | `docs/user-guides/discord-bot/command-reference.md:42` | `color_space` option | `/harmony` has `wheel`: `rgb`(default)/`ryb`/`munsell`/`oklch-hue`/`oklch-lightness` (`apps/discord-worker/src/commands/schemas.ts:174-180`, `:52-63`) | HIGH | replace row |
| D-02 | `command-reference.md:41` | 8 harmony types, complementary default | ten (+`compound`, `shades`), default `triadic` (`schemas.ts:28-44`; `handlers/commands/harmony.ts:47`) | HIGH | fix |
| D-03 | `command-reference.md:104` | `/mixer` `count` | not registered (`schemas.ts:438-485`) | HIGH | delete |
| D-04 | `command-reference.md:73` | `vibrancy_boost` | doesn't exist (`schemas.ts:332-372`) | HIGH | delete |
| D-05 | `command-reference.md:60` | `/extractor color` `prevent_duplicates` | only `color`, `count`, `matching` (`schemas.ts:296-331`) | HIGH | delete |
| D-06 | `command-reference.md:215` | quick presets "Pure White, Jet Black, Metallic Silver, Metallic Gold, Pastel Pink" | 22 picks: Jet Black, Pure White, Pearl White, Gunmetal Black + Cosmic/metallic set (`services/budget/quick-picks.ts:20-…`) | HIGH | fix |
| D-07 | `command-reference.md:262-263` | dye1–2 required, dye3–5 optional | dye1–3 required, dye4–6 optional (`schemas.ts:1027-1068`) | HIGH | fix |
| D-08 | `command-reference.md:266-268` | "Known issue in 5.0.0: `/preset submit`/`edit` may be rejected" | fixed 2026-08-29 (`apps/discord-worker/CHANGELOG.md:257,395`; `preset.ts:424,449,712`) | HIGH | delete paragraph |
| D-09 | `docs/user-guides/discord-bot/faq.md:96-98` | same known issue | same | HIGH | delete |
| D-10 | `docs/user-guides/web-app/community-presets.md:142` | "submitting and editing are web-app only" | bot `/preset submit`/`edit` work (`schemas.ts:1003-1164`) | HIGH | fix |
| D-11 | `docs/user-guides/web-app/palette-extractor.md:24` | picture cached in local storage (8 MB) | memory only (`extractor-tool.ts:398-401,1475-1476`) | HIGH | "held in memory for this session only — never written to browser storage" |
| D-12 | `web-app/faq.md:74` | "report button on any preset" | no report route/handler anywhere | HIGH | "no in-app report button yet — contact a moderator in the community Discord" |
| D-13 | `discord-bot/faq.md:155` | "report feature on presets" | same | HIGH | fix |
| D-14 | `web-app/faq.md:127` | "Add to Discord in the footer" | no footer; `PRODUCT_LINKS.inviteBot` never rendered by the web app (`packages/core/src/config/product-links.ts:41-50`; `about-modal.ts:50-64`) | HIGH | "invite link from the community Discord, or `/about` in a server that has the bot" |
| D-15 | `discord-bot/faq.md:11` | same | same | HIGH | same |
| D-16 | `discord-bot/getting-started.md:17` | "invite link (available on the web app)" | same | HIGH | same |
| D-17 | `web-app/gradient-builder.md:7` | "The Discord bot still uses `/mixer` for this" | bot has `/gradient` (`schemas.ts:377-435`); `/mixer` is blending | HIGH | fix |
| D-18 | `discord-bot/favorites-collections.md:84` | `count` 1–10 default 5, `/mixer` | default 1, read by `/extractor color` (`types/preferences.ts:131`; `extractor.ts:241`; `schemas.ts:672`) | HIGH | fix |
| D-19 | `discord-bot/getting-started.md:221-222` | rate limits; about/manual/stats/changelog unlimited | nothing unlimited: about/manual 30 (`configs.ts:98-99`), changelog 30 (`services/rate-limiter.ts:191`), stats 15; also `extractor:image` 5 (`:75`), `preset` 10 (`:83`), `preferences` 20 (`:95`) | HIGH | full list |
| D-20 | `discord-bot/faq.md:118-119` | same | same | HIGH | same |
| D-21 | `discord-bot/faq.md:107-109` | delete preset via moderator/GitHub | web app My Submissions → Delete (`my-submissions-modal.ts:128-215`; presets-api `index.ts:136`) | MED | fix |
| D-22 | `web-app/color-harmony.md:57-68`, `:19-21` | Settings list lacks Color wheel | shipped: dropdown between Harmony Type and Matching Mode, five `COLOR_WHEEL_IDS`, descriptions (`config-sidebar.ts:937-968`; `en.json` `config.colorWheel`, `config.wheel*Desc`, `config.wheelMunsellTrademark`); share `wheel` (`share-service.ts:64`) | HIGH | add "Color wheel — RGB (default), RYB, Munsell (JIS), OKLCH hue, OKLCH lightness; rides in the Share link" |
| D-23 | `web-app/color-harmony.md:63`, `gradient-builder.md:57`, `palette-extractor.md:62`, `dye-mixer.md:47`, `swatch-matcher.md:141`, `dye-comparison.md:50,82`, `discord-bot/command-reference.md:25`, `discord-bot/favorites-collections.md:82` | "ΔEOK" | `ΔEOK2` (`packages/core/src/types/index.ts:59`; `shared/method-tags.ts:30`; `config-sidebar.ts:1476`; `schemas.ts:196`) | MED | replace all 9 |
| D-24 | `web-app/getting-started.md:59` | rail order = 1–9 key order | differ from position 6 (`v4-app-header.ts:53-63` vs `keyboard-service.ts:31-41`) | MED | fix |
| D-25 | `web-app/getting-started.md:108` | "every tool has a Share button" | seven of nine — not Extractor, not Presets (`keyboard-service.ts:198`) | MED | fix |
| D-26 | `web-app/swatch-matcher.md:89-91` | DYES ON THIS GLAMOUR description | 5.2.0 Pieces/Dyes toggle + Show all + per-slot names + Facewear row (`en.json` `swatch.glamourViewPieces`, `glamourViewDyes`, `glamourShowAll`, `noDyedPieces`, `facewearSlot`, `gearSlot.*`) | MED | document |
| D-27 | `web-app/faq.md:91` | collections export/import to JSON | UI unreachable in 5.0 (`dye-selector.ts:543` lives in a cleared panel; drawer offers only the star); `favorites-collections.md:86` says the opposite | MED | "Not in 5.0 …" and reconcile |
| D-28 | `web-app/faq.md:87` | "40 favorites and 50 collections with 20 dyes" | numbers right (`collection-service.ts:142-144`); "collections" → "saved palettes" | LOW | fix wording |
| D-29 | `web-app/faq.md:15-17` | login with Discord | Discord and XIVAuth (`signin-modal.ts:53-69`) | MED | fix |
| D-30 | `web-app/faq.md:143` | "Anonymous usage analytics" collected | opt-in, off by default (`advanced-options-panel.ts:351-358`) | MED | fix |
| D-31 | `docs/user-guides/index.md:66` | "Collections: Group related dyes" | 5.0 saved palettes written by tool Save actions (`collection-service.ts:35-41`) | MED | fix |
| D-32 | `index.md:73`, `web-app/getting-started.md:200`, `discord-bot/getting-started.md:244` | `https://github.com/your-repo/issues` | `https://github.com/FlashGalatine/xivdyetools/issues` | MED | fix |
| D-33 | `index.md:28,31` | "Swatch Matcher" / "Community Presets" | app titles "Character Matcher" / "Preset Palettes" (`en.json` `tools.character.title`, `tools.presets.title`); rail short names "Swatch"/"Presets" | LOW | add app title in parentheses |
| D-34 | `web-app/palette-extractor.md:73-79`, `faq.md:42-45`, `budget-suggestions.md:94-100`, `discord-bot/getting-started.md:129-135` | four inconsistent ΔE tables | calibrated cuts MATCH 5/10/20, HARMONY 6/12/20, SEPARATION 8/15/30 (`packages/core/src/config/band-vocabulary.ts:92-117`) | LOW | replace with MATCH bands: <5 SAME · <10 CLOSE · <20 NEAR · ≥20 FAR |
| D-35 | `docs/specifications/index.md:17,88` | Budget-Aware "📋 Planned" | shipped (`budget-tool.ts`; `/budget` `schemas.ts:1213-1318`) | HIGH | ✅ Implemented |
| D-36 | `docs/specifications/collections.md:3` | Status Planned | shipped (web) | MED | ✅ Implemented (web app only) |
| D-37 | `collections.md:28` | max 20 favorites | 40 (`collection-service.ts:142`) | MED | fix |
| D-38 | `collections.md:41,127,138` | reorder API | none | MED | delete |
| D-39 | `collections.md:76-85, 262-320` | Discord Bot (Redis), `/favorites`, `/collection` | deleted in 5.0 (`registry.ts:29-59`); never Redis | HIGH | strike; note removal |
| D-40 | `collections.md:56-63` | `interface Collection` | also `kind: 'palette'|'swap'|'character'`, `target?`, tombstones (`collection-service.ts:41,62-79`) | MED | add |
| D-41 | `docs/specifications/multi-color-extraction.md:3` | Planned | shipped (`PaletteService.ts`) | MED | ✅ Implemented |
| D-42 | `multi-color-extraction.md:9,87,90,116` | 3–5 colors | 1–10 clamp, default 4 (`PaletteService.ts:316,372-377`); surfaces 3–10 | MED | fix |
| D-43 | `multi-color-extraction.md:93` | `colorSpace` option | not in `PaletteExtractionOptions` (`:38-46`) | MED | delete |
| D-44 | `docs/specifications/preset-palettes.md:6` | Planned + DEPRECATED banner | shipped (`presets.json` 2.0.0, 15 palettes) | MED | mark ✅ Implemented — the orchestrator will consider archiving; just fix the status line |
| D-45 | `docs/specifications/community-presets.md:26-32` | "Discord Bot (PebbleHost)", `/submit-palette` etc. | CF Worker; `/preset submit`/`vote`; moderation-worker separate | MED | redraw |
| D-46 | `community-presets.md:52` | web app read-only | full read/write via OAuth (`preset-submission-service.ts`, `my-submissions-modal.ts:199-215`) | MED | fix |
| D-47 | `community-presets.md:126-131` | seed categories incl. `community` | `community` dropped (0007); `appearance`, `zones`, `raids-trials` added (`packages/types/src/preset/core.ts:15-26`) | HIGH | replace with the eight |
| D-48 | `community-presets.md:67-89` | presets CREATE TABLE | missing 0003/0008–0013 columns/tables | MED | regenerate from `apps/presets-api/schema.sql` + migrations |
| D-49 | `community-presets.md:162,177` | "Dye item IDs", "2-5" | stainIDs 1–254, 3–6 (`validation-service.ts:28-31,213-222`); `secondaryCategories` ≤2 | HIGH | fix |
| D-50 | `docs/specifications/feature-roadmap.md:18,296-324` | Budget "Planned", `/match max_price`, `/dye alternatives` | shipped as Budget tool + `/budget`; `/match` deleted; no alternatives | HIGH | mark Done; rewrite to shipped design |
| D-51 | `feature-roadmap.md:184-210` | `/favorites`, `/collection` ✅ Complete | removed in 5.0 | HIGH | "Removed in 5.0" |
| D-52 | `feature-roadmap.md:162,200` | 20 favorites | 40 | MED | fix |
| D-53 | `feature-roadmap.md:161,170` | `F`/`C` shortcuts | not in `keyboard-service.ts:31-41` | MED | delete |
| D-54 | `feature-roadmap.md:56-59,80,91-99,141-147,174-179,205-210,245-247,286-291` | pre-monorepo paths | `apps/*/src`, `packages/*/src` | MED | rewrite paths (or the orchestrator archives — do the rewrite of statuses; keep paths minimal) |
| D-55 | `feature-roadmap.md:131,199,319` | Redis | KV + Cache API | MED | fix |
| D-56 | `feature-roadmap.md:222,226` | preset categories jobs/aesthetics shipped | `presets.json` 2.0.0: grand-companies (3), seasons (4), events (8) | MED | fix |
| D-57 | `docs/maintainer/index.md:144-150` | Version Compatibility Matrix (Core 1.4.0…) | stale; versions live in docs/versions.md | MED | DELETE the matrix; link `../versions.md` |
| D-58 | `maintainer/index.md:130` | In Progress: CSP headers | shipped (`apps/web-app/public/_headers:31`) | MED | move to Completed |
| D-59 | `maintainer/index.md:79-85` | KV eventual consistency for favorites/collections | bot favorites/collections deleted; only `/preset favorite` (cap 50, `preset-favorites.ts:34`) | MED | retitle/delete |
| D-60 | `maintainer/index.md:119` | "December 2024 code audit" | December 2025 (`docs/historical/20251214-CodeAudit`); superseded by `docs/audits/` — link the new `docs/audits/index.md` (the orchestrator is creating it) | LOW | fix |
| D-61 | `docs/maintainer/adding-dyes.md:280` | `Facewear` category row | not a category (`dye-vocabulary.ts:20-28`) | MED | delete row |
| D-62 | `adding-dyes.md:254` | `itemID` number|null | always number; `0` when no item | MED | fix |
| D-63 | `adding-dyes.md:331-350` | `cd xivdyetools-core … npm publish` | pnpm/turbo + Actions "Publish Packages to npm"; never local publish | HIGH | replace |
| D-64 | `adding-dyes.md:356-368` | `npm update xivdyetools-core` in consumers | `workspace:*`; `pnpm turbo run build` | MED | fix |
| D-65 | `adding-dyes.md:201` | `from 'xivdyetools-core'` | `@xivdyetools/core` | LOW | fix |
| D-66 | `adding-dyes.md:282` | `xivdyetools-core/src/data/locales/` | `packages/core/src/data/locales/` | LOW | fix |
| D-67 | `adding-dyes.md:340` | `npm test -- --grep` | `pnpm --filter @xivdyetools/core exec vitest run src/config/__tests__/dye-vocabulary.test.ts` | LOW | fix |

## Structural (apply)

1. `docs/maintainer/index.md`: delete the version matrix (D-57), add a Quick Links row for `dye-maintainer-tool.md` "(retired GUI — tombstone)", fix the audit pointer (D-60) to `../audits/index.md`, drop the stale Security In-Progress list.
2. User guides: add a short section to `docs/user-guides/discord-bot/getting-started.md` on the 5.0 first-run notice (one ephemeral "what changed" follow-up per user, KV flag `firstrun:v5:<userId>` with a 180-day TTL, suppressed for users with stored preferences — verify in `apps/discord-worker/src/index.ts:738-778`) and list that KV record in `discord-bot/faq.md`'s privacy section.
3. `docs/user-guides/public-api.md`: note that `POST /v1/telemetry` is an internal browser beacon with its own bucket (240/60 s, fail-closed) and is the one `/v1/*` route without the public rate-limit headers (verify `apps/api-worker/src/index.ts:118-128`).
4. ΔE tables (D-34): put ONE explainer in `docs/reference/glossary.md` under "Delta E" is owned by another agent — instead, make the four guide tables consistent with the MATCH bands and add "see the Glossary" links.
5. Tool order: use the rail order (harmony, extractor, accessibility, comparison, gradient, mixer, presets, budget, swatch — verify `v4-app-header.ts:53-63`) in `docs/user-guides/index.md`'s tool table.
6. Do NOT move or delete files — the orchestrator handles archival of `preset-palettes.md` / `feature-roadmap.md` if it decides to. Fix their content in place.
