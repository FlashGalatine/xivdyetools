# DEAD-007: 5 orphan accessibility.* locale keys x 6 locales hidden by the analyzer's dynamic-prefix rule (30 lines)
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Orphan i18n · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/en.json:346` — accessibility.hardForDeuteranopia/hardForProtanopia/hardForTritanopia/verySimular/somewhatSimilar

## Evidence
- No code, script, test or allow-list in the repo names these 5 keys. The only dynamic accessibility.* builders (metric-help.ts:137 with stems/tierKeys/notAStandard/learnMore, accessibility-tool.ts:1347 visionDesc*, :1463 *Short) cannot produce them.
  - Commands: git grep hardFor|verySimular|somewhatSimilar repo-wide (excluding locale JSON and docs/audits): 0 hits.; git grep `accessibility.${`: metric-help.ts:137 and accessibility-tool.ts:1347,1463 only.; metric-help.ts calls t() with stem+Label/Desc/Caveat/Short, tierClear..tierCollapsed, notAStandard and learnMore.
- Origin: git grep -c of the 5 keys at 8ecb878f -- apps/web-app/src/locales gives 5 per file in all 6 locales, the same as HEAD.

## Fix
**REMOVE.** Optionally tighten analyze-unused-keys.js so a single dynamic prefix does not mark the whole accessibility namespace live.

Steps: 1) Delete the 5 key lines (en.json:346-350 and the matching lines) in en/ja/de/fr/ko/zh.json under accessibility.
2) Run node apps/web-app/scripts/validate-i18n.js.
3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check

## Status
REMOVED, NOT DEPLOYED — `fcc0b76f` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
