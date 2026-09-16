# DEAD-012: Translator.getMeta — 3 source + 25 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** moderation-worker · **Semver:** NONE · **Category:** Test-only

## Location
- `apps/moderation-worker/src/services/bot-i18n.ts:203–205`.

## Evidence
- Only the getMeta describe block calls it. No moderation handler displays the metadata; the tests exercise this otherwise unused accessor.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete getMeta/JSDoc and only bot-i18n.test.ts:209–233. Preserve LocaleData.meta for this pass, t() tests and locale-resolution tests.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN — recommendation only; no source change made.
