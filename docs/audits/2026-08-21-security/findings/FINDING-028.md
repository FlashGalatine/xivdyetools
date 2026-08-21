# FINDING-028: `@xivdyetools/svg` — `escapeXml` passes XML-illegal control characters (card render failure for crafted names); hex values unescaped in `fill` attributes

## Severity
**LOW** — a preset named with a control character (e.g. `Hello`, accepted by presets-api's length-only validation) makes the bot's `/preset` card fail in resvg-wasm (per-preset denial of card rendering; executed end-to-end by the reviewer); no app serves raw SVG to browsers, so attribute injection is render-time only. Reviewer IDs: PKG-7, PKG-8.

## Category
CWE-116 Improper Encoding or Escaping of Output · CWE-20

## Location
- `packages/svg/src/base.ts:12-19` — escapes `& < > " '` only; U+0000–U+001F (except tab/LF/CR), U+FFFE/FFFF and lone surrogates survive.
- `packages/svg/src/contrast-card.ts:171-172`, `gradient.ts:122,125`, `dye-info-card.ts:119`, `swatch-card.ts:111` — hex strings interpolated into `fill="…"` without escaping (other files escape).
- `apps/presets-api/src/services/validation-service.ts:177-195` — name/description validated by length only.

## Recommendation
Strip/replace XML-illegal code points in `escapeXml` (and always escape attribute values); reject control characters in presets-api name/description/tags.

## References
- XML 1.0 §2.2 Char production; Evidence: `../evidence/review-packages.md` (PKG-7, PKG-8)

## Status
**FIXED 2026-08-21** — `@xivdyetools/svg` 2.0.1: `escapeXml` strips XML-illegal C0 controls, U+FFFE/U+FFFF and lone surrogates; `fill` attributes in contrast-card / gradient / dye-info-card / swatch-card escaped.
