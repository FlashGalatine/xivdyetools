# DEAD-027: Translator.t() fallbackData branch in moderation-worker bot-i18n.ts is a no-op (data === fallbackData === strings): about 8 lines; getLocale is NOT included and stays as an observation hook
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/moderation-worker/src/services/bot-i18n.ts:180` — Translator fallbackData field + t() fallback branch ONLY (getLocale is KEPT)

## Evidence
- The constructor sets data and fallbackData to the same `strings` table (lines 169-170), so the re-lookup at 180-182 can never change the result. getLocale is not included: it reads real state and is the only test observation of createUserTranslator's locale resolution.
  - Commands: bot-i18n.ts:161 private fallbackData; :169-170 data=strings, fallbackData=strings; :180-182 re-lookup in the same table; git grep fallbackData apps/moderation-worker: only bot-i18n.ts:161,170,181 + CLAUDE.md:272; getLocale: 0 prod callers, 13 test refs, returns this.locale
- Origin: git show 8ecb878f:apps/moderation-worker/src/services/bot-i18n.ts has the same field (:158), assignments (:166-167) and branch (:178)

## Fix
**REMOVE.** Remove only the fallbackData field and branch; keep getLocale (an accepted observation hook over real state). Revisit getLocale only if the locale field itself is removed.

Steps: 1. In apps/moderation-worker/src/services/bot-i18n.ts, delete line 161 (`private fallbackData`), line 170 (`this.fallbackData = strings;`) and lines 180-182 (the `if (value === undefined && this.locale !== 'en')` block).
2. Adjust the constructor comment at lines 165-167 if needed.
3. Update the sentence at apps/moderation-worker/CLAUDE.md:272, which says data and fallbackData both point at the English table.
4. Do NOT touch getLocale (lines 198-203) or its tests.
5. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`, then `pnpm dead-code:check`.

## Status
OPEN
