# FINDING-027: Prototype-chain lookups on untrusted keys (`.chara` parser, category icons, stoat command parser, translation labels)

## Severity
**LOW** — yields `Function`/`Object.prototype` values instead of rejecting input; causes exceptions or odd output rather than code execution. Reviewer IDs: PKG-6, PKG-18, WEB-12, STOAT-3 (PKG-6 and STOAT-3 executed by reviewers).

## Category
CWE-1321 Improperly Controlled Modification of Object Prototype Attributes ('Prototype Pollution' family — read side)

## Location
- `packages/core/src/services/chara/chara-parser.ts:262` — `mapNamed` does `table[value]` on a prototype-bearing literal: `"Tribe":"constructor"` / `"__proto__"` / `"toString"` pass validation (web-app `.chara` import is the consumer).
- `packages/core/src/services/localization/TranslationProvider.ts:59-67` — same `labels[key]` shape (keys internal today).
- `apps/web-app/src/shared/category-icons.ts:43-45` → `v4/preset-detail.ts:865,871` — `CATEGORY_ICONS[name]` feeds `unsafeHTML()`; a non-own key throws in Lit (value is API-controlled).
- `apps/stoat-worker/src/commands/parser.ts:57-62, 99-107`, `router.ts:54-58`, `commands/help.ts:36, 98-106` — `!xd constructor` / `!xd help constructor` resolve to Function values.

## Recommendation
Use `Object.hasOwn(table, key)` (or `Map`/`Object.create(null)` tables) for every lookup keyed by external input; add a unit test with `__proto__`/`constructor` keys.

## References
- Evidence: `../evidence/review-packages.md` (PKG-6, PKG-18), `../evidence/review-web-app.md` (WEB-12), `../evidence/review-infra-stoat.md` (STOAT-3)

## Status
**FIXED 2026-08-21** — core 4.0.1 (PKG-6/18), stoat-worker 0.2.2 (STOAT-3), web-app (WEB-12).
- web-app: `category-icons` uses `Object.hasOwn` with a fallback glyph (WEB-12) — all four sites (core, stoat, web-app) now closed.
