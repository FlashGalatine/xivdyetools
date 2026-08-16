# [DEAD-026]: `scripts/` — an unwired analyzer, a converter that writes into the dead `assets/` tree, a generator that half-writes there too, and a stale README

## Category
Orphaned File / Stale Code (scripts)

## Location / Evidence
`evidence/agent-report-non-source.md` §A:

| File | Bytes | Consumers | Verdict |
|---|---:|---|---|
| `scripts/analyze-unused-keys.js` | 7,612 | **none** monorepo-wide (not in `package.json`, any workflow, `turbo.json`, or `scripts/README.md`) | DEAD *as wired* — but it is the seed of this audit's i18n pass; see recommendation |
| `scripts/convert-icons-to-webp.js` | 1,971 | none; reads **and writes** `../assets/icons/` (line 16) — the dead top-level dir (DEAD-001), not `public/assets/icons/`; its outputs cannot reach `dist/` | DEAD |
| `scripts/generate-icons.mjs` | 4,331 | none in package.json/CI (documented one-shot); writes to `public/assets/icons/` **and** `../assets/icons/` | KEEP — fix the second output path when DEAD-001 lands |
| `scripts/README.md:40` | | claims "responsive image code in `src/components/app-layout.ts`" — file does not exist; documents 3 of 8 scripts | STALE |

Also verified KEEP: `check-bundle-size.js` (+ its `.d.ts`, implicitly imported by `bundle-budget.test.ts`), `smoke-test-pages.js` (+ `.test.js`, run by vitest), `check-beta-build.js`, `validate-i18n.js` (manual gate; **not** in CI), `generate-beta-icons.mjs` + `scripts/assets/bot-avatar-beta-1024.png`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | Developer muscle memory only. |

## Recommendation
- `convert-icons-to-webp.js` → **REMOVE** (its job is done and its output path is dead)
- `analyze-unused-keys.js` → **REFACTOR FIRST**: either wire it as `pnpm run i18n:unused` *and* teach it the 11 lookup patterns catalogued in `evidence/agent-report-i18n.md` §A (so it stops over-reporting `tools.*`, `mixer.model*`, `preset.<id>.*`), or delete it and fold orphan detection into `validate-i18n.js`. Leaving an unwired analyzer with known false positives helps nobody.
- `generate-icons.mjs` → keep; drop the `../assets/icons/` output when DEAD-001 is applied
- `scripts/README.md` → rewrite to list all 8 scripts and remove the `app-layout.ts` claim

### If Removing
1. `git rm scripts/convert-icons-to-webp.js`
2. Decide on `analyze-unused-keys.js` (wire or delete); update `scripts/README.md`
3. `pnpm --filter xivdyetools-web-app run test` (covers `smoke-test-pages.test.js` and `bundle-budget.test.ts`)
