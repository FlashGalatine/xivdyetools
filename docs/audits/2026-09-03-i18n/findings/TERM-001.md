# TERM-001: the Discord bot names harmonies and vision types from its own table while web-app and og-worker use core's — 8 concepts read differently per product
**Tier:** P2 · **Locale(s):** ja ko zh de · **Deploy unit:** bot-logic (+ discord-worker, stoat-worker) · **Generated?** no (bot-logic JSON is hand-edited; core's side is generated)

## Location
- `packages/bot-logic/src/commands/harmony.ts:103-112` — maps each of the 10 harmony types to a bot-logic key (`harmony.complementary`, `harmony.splitComplementary`, …), not to core. The **same file** imports core's `generateHarmonySlots` (line 16) and computes the slots with it (line 184): since PR #159 the bot derives the harmony from core's algorithm and then labels it from a different vocabulary.
- `packages/bot-logic/src/commands/accessibility.ts:102` — `t.t('accessibility.' + lens)`, likewise.
- The other two surfaces use core: `apps/web-app/src/services/harmony-generator.ts:99` and `apps/web-app/src/components/v4/config-sidebar.ts:927-943` (`LanguageService.getHarmonyType`), `apps/web-app/src/components/accessibility-tool.ts:696,807,1347,1794` (`getVisionType`), `apps/og-worker/src/services/translator.ts:43` (`getHarmonyType`).

## Evidence
- `evidence/vocab-split.txt` — 42 keys restate a core-owned concept, **29 diverge in ≥ 1 locale**. Harmony/vision account for 11 of them.
- Same concept, two words: Split-Complementary ja `分裂補色` (core/web/og) vs `スプリット補色` (bot); Tetradic ja `四色配色` vs `テトラード`; Monochromatic ja `単色` vs `モノクロマティック`; Square ko `정사각형` vs `정방형`; Triadic zh `三角配色` vs `三色`; Protanopia ko `제1색맹` vs `적색맹`; Deuteranopia ko `제2색맹` vs `녹색맹`; Normal Vision de `Normales Sehen` vs `Normale Sicht`.
- `apps/discord-worker/src/commands/localize.ts:131,134` feeds the same bot-logic keys into Discord's own choice-name localizations, so the split is visible in the command picker too.

## Fix
- Resolve harmony and vision names in bot-logic through core's `getHarmonyType()` / `getVisionType()`, and delete the duplicated `harmony.*` / `accessibility.*` name keys from the six bot-logic locale files.
- Needs core ≥ 4.2.0 and a bot-logic minor; it is the natural follow-on to PR #159 (`9ef904cf`), which converged the harmony *algorithm* across these same three surfaces on 2026-09-03 and left only the naming split.

## Status
OPEN
