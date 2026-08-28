# [DEAD-011]: bot-logic locale files — 211 of 621 keys (34 %) are orphans, +38 test-only; ~55 KB across 6 languages ships in the discord-worker bundle

## Category
i18n (dead data)

## Location
- `packages/bot-logic/src/i18n/locales/{en,ja,de,fr,ko,zh}.json` (621 leaf keys each; key-set parity is perfect — 0 missing / 0 extra per locale)
- Raw list: `evidence/bot-i18n-orphan-keys.txt` (211 orphans + 38 test-only, en value shown for context); script: scratchpad `i18n_orphans.py`
- Consumers scanned: `apps/discord-worker/src`, `apps/stoat-worker/src`, `packages/bot-logic/src`, `packages/svg/src` (non-test), incl. every dynamic prefix (`preferences.keys.${key}` → `PREFERENCE_ORDER` + `filters`; `manual5.topics.${key}.*` → `TOPIC_KEYS`; `accessibility.${lens}` → 4 vision types) enumerated by hand; `scripts/register-commands.ts` reads no locale files

## Evidence
| | keys | share | ~bytes ×6 files |
|---|---|---|---|
| total | 621 | | 234,405 |
| live (literal) | 343 | 55 % | |
| dynamic-covered | 29 | 5 % | |
| test-only | 38 | 6 % | ~12.4 KB |
| **orphan** | **211** | **34 %** | **~54.7 KB (≈23 % of locale bytes)** |

Whole namespaces dead: `swatch.*` 37/37 (the 4.x `/swatch color|grid` surface, replaced by the `.chara` frame), `stats.*` 31/31 (`stats.ts` hard-codes English), `budget.*` 31/41 (4.x `/budget find` shape), `preset.*` 21/42 (categories/status/moderation — moderation-worker has its own strings), `mixer.*` 19/21, `preferences.descriptions.*` 14/14, `paletteGrid.*` 9/9, `common.*` 10/18, `extractor.*` 8/9, `comparison.*` 7/9. Test-only: `about.cmd.*` (17, incl. removed 4.x commands `match`, `favorites`, `collection`, `language`, `stats`) exist only in `about.test.ts`'s mock table; 14 `accessibility.*` likewise. `meta.flag`/`meta.nativeName` are reachable only through the uncalled `Translator.getMeta()` (DEAD-013).

The JSONs are statically imported by `translator.ts`, so every orphan ships inside the discord-worker bundle (2,632 KiB gzip vs 3,072 limit — see memory `xiv-discord-worker-size-blocker`).

## Why It Exists
Three bot generations of commands (4.x `/swatch`, `/budget find`, `/match`, moderation) were removed or rebuilt for 5.0 without pruning their strings; there is no orphan-key gate in bot-logic (the web-app got one in its 2026-08-16 audit, Wave 4).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — literal + enumerated-dynamic scan; every dynamic prefix resolved by hand |
| **Blast Radius** | LOW — data only; the translator returns the key path for a missing key, so a mis-classified key would show up as a visible `ns.key` string, not a crash |
| **Reversibility** | EASY |
| **Hidden Consumers** | stoat-worker calls `t.t` zero times. Cross-track: if DEAD-002/004 remove `stats.ts` English strings or handlers, more keys join this bucket; if `stats.ts` is ever localised, `stats.*` (31) becomes live again — decide that first. |

## Recommendation
**REMOVE** (211 orphans; then the 38 test-only keys together with their mock tables) — and add an orphan-key vitest gate to bot-logic mirroring the web-app one so it cannot regrow.

### If Removing
1. Decide `stats.*` (localise `/stats` or drop the keys).
2. Delete the orphan keys from all six files (script can emit the pruned JSON); run `pnpm turbo run test --filter=@xivdyetools/bot-logic --filter=xivdyetools-discord-worker`.
3. Add the gate test (enumerate keys → grep consumers) — reuse the scratchpad script logic.
