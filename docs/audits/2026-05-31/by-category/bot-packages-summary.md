# bot-i18n + bot-logic Summary (2026-06-03 extension)

## Overview
- **bot-i18n:** 1 finding (DEAD-126) — documentation only. Code is clean.
- **bot-logic:** 0 findings — re-confirms February's grade-**A** "all KEEP" verdict.

Both are **published npm libraries**, so "unused inside the monorepo" ≠ dead — external consumers may exist. Verdicts here
therefore favor KEEP / `@internal` over deletion, and the one actionable item is a docs fix, not a code removal.

## bot-i18n findings
| ID | Item | Continues | Recommendation |
|----|------|-----------|----------------|
| DEAD-126 | README documents 3 removed functions (`translate`, `getAvailableLocales`, `isLocaleSupported`) | DEAD-032 (code removal executed) | FIX (update README, re-publish) |

**Executed since February (cross-ref, no new ID):**
- DEAD-032 — the 3 functions removed from `src/index.ts` (only `Translator`/`createTranslator` + types remain). ✅
- DEAD-034 — unused locale sections (`buttons`/`pagination`/`components`/`status`/`matching`) removed from all 6 JSONs. ✅
- DEAD-035 — 5 unused re-exports removed from discord-worker `services/bot-i18n.ts`. ✅
- DEAD-033 — `LocaleData` / `TranslatorLogger` type exports — **KEEP** (published API). ⏸

## bot-logic findings
None. Cross-reference of February's DEAD-036–041:
| Feb ID | Item | Status |
|--------|------|--------|
| DEAD-036 | `resolveCssColorName` etc. | KEEP — already internal-only (not in public barrel) |
| DEAD-037 | `HARMONY_TYPES`, `VISION_TYPES` | KEEP — reference constants in public API |
| DEAD-038/039/040 | Input/Result/`EmbedData` type exports | KEEP — published SDK contract |
| DEAD-041 | REFACTOR comment markers | **resolved** — grep for REFACTOR/HACK/FIXME/@deprecated/TODO in `src` = 0 matches |

## Notes
- bot-logic is the cleanest of the three: a fully-typed platform-agnostic SDK whose over-exported surface is intentional.
- The only cross-package action is publishing the bot-i18n README fix with the next version bump (no code change).
