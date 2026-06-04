# DEAD-126: bot-i18n README documents three removed functions (follow-up to DEAD-032)

## Category
Documentation Drift

## Location
- File(s): `packages/bot-i18n/README.md`
- Line(s): 42-49 (`translate` example), 51-61 (`getAvailableLocales` / `isLocaleSupported` examples), 69-71 (API table rows)

## Evidence
**Follow-up to 2026-02-28 DEAD-032**, which recommended removing the unused functional exports `translate`,
`getAvailableLocales`, and `isLocaleSupported`. That removal **was executed in code** — the package barrel now exports
only the class-based API:
```ts
// packages/bot-i18n/src/index.ts — entire file
export type { LocaleCode, LocaleData, TranslatorLogger } from './types.js';
export { Translator, createTranslator } from './translator.js';
```
But `README.md` (a **published** npm artifact) still documents the three removed functions as if they exist:
```md
README.md:45  import { translate } from '@xivdyetools/bot-i18n';      // ← no longer exported
README.md:54  import { getAvailableLocales, isLocaleSupported } ...    // ← no longer exported
README.md:69-71  | translate(...) | getAvailableLocales() | isLocaleSupported() |  (API table)
```
A consumer copy-pasting these examples gets an import error. (The package's `CLAUDE.md` is already correct — only the
README drifted.)

## Why It Exists
The functional helpers were removed from the implementation per DEAD-032, but the README's Usage/API sections were not
updated to match the class-only surface.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — provable mismatch between README and `src/index.ts` |
| **Blast Radius** | NONE (docs only) — but it's a *published* doc, so it misleads downstream users |
| **Reversibility** | EASY |
| **Hidden Consumers** | npm users reading the README |

## Recommendation
**FIX** (update README)

### Rationale
- Closes the documentation half of DEAD-032 so the published package's docs match its actual exports.

### If Fixing
1. Remove the `### Stateless Translation` (`translate`) and `### Locale Utilities` (`getAvailableLocales` /
   `isLocaleSupported`) sections, and their three API-table rows.
2. Keep `Translator` / `createTranslator` / the three type rows (these are the real exports).
3. Re-publish the README with the next bot-i18n version bump (no code change required).
