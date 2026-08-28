# Build Scripts

## i18n Validation

Validate all `LanguageService.t()` calls against the locale files:

```bash
# Key existence + file shape + cross-locale parity (two scripts, one gate)
npm run validate:i18n

# Check with typo suggestions (Levenshtein-based)
node scripts/validate-i18n.js --fix
```

`npm run validate:i18n` runs `validate-i18n.js` and then `i18n-parity.mjs`.

`validate-i18n.js` scans all TypeScript files in `src/` and validates that every
translation key exists in `src/locales/en.json`; it then checks the *shape* of
the five target files — that each lists its keys in `en.json`'s order
(recursively), and that no value carries leading/trailing whitespace the `en`
value does not. Exit 3 means one of those two failed.

`i18n-parity.mjs` compares each target file with `en.json` and fails on:

| Check | Why it is an error |
|-------|--------------------|
| duplicate keys | `JSON.parse` keeps the last one silently, so the earlier translation is dead text. Found with a real tokenizer — a reviver cannot see them. |
| missing / extra keys | every key lands in all six files, in the same commit |
| placeholder mismatch | `{name}` tokens must match `en`, or `tInterpolate()` renders a literal brace |
| empty values | an empty target value renders as nothing, which is worse than English |

Values still *identical to English* are a **warning**, not an error: legitimate
ones (brands, units, symbols, identifiers, cognates) live in
`scripts/i18n-identical-allowlist.json`, one line of reasoning each. An
allow-list entry that stops being identical is reported as stale, so the file
cannot rot.

### Restoring key order

```bash
node scripts/reorder-locales.mjs           # rewrite de/fr/ja/ko/zh in en.json order
node scripts/reorder-locales.mjs --check   # report only, exit 1 on drift
```

Pure permutation — values are never rewritten. `scripts/i18n-guardrails.test.js`
proves that on the shipped files, and re-running `--check` after a rewrite must
be clean.

**Related lint rules** (both custom, both `warn`, both run by `npm run lint`):

- `xivdyetools-i18n/no-i18n-fallback` — `LanguageService.t('key') || 'fallback'`
  is dead code, because `t()` returns the key when it is missing.
- `xivdyetools-i18n/no-hardcoded-ui-strings` — user-visible English that never
  reaches `LanguageService`: text and `title`/`placeholder`/`aria-label`/`alt`
  inside `` html`` `` templates, `textContent`/`innerText`/`title`/… assignments,
  and the first argument of `ToastService.*()` / `AnnouncerService.announce()`.
  Single words, ALL-CAPS identifiers, brands, URLs, CSS, `logger`/`console`
  arguments and test files are skipped by design. Tests:
  `eslint-rules/__tests__/no-hardcoded-ui-strings.test.js`.

The i18n architecture (LanguageService, locale chunks, `preset-i18n`) is described in `xivdyetools/docs/projects/web-app/components.md`; there is no `docs/I18N.md` any more.

### i18n orphans (the other direction)

`validate:i18n` proves every key the code references *exists*; `i18n:unused`
proves every key the locales define is *referenced*:

```bash
npm run i18n:unused          # report orphaned keys, exit 1 if any
```

`scripts/analyze-unused-keys.js` treats a key as used if its literal appears in
`src/`, if a template literal starts with one of its dotted prefixes
(`` `harmony.types.${x}` ``), or if a `` `${…}.suffix` `` template names its last
segment. `src/__tests__/i18n-orphans.test.ts` runs the same function, so an
orphan fails `npm test`. Remove keys from **all six** locale files together.

---

## Dead-code gate (knip)

```bash
npm run lint:dead            # knip, config in knip.jsonc
npm run lint                 # eslint src && knip
```

Unused files, exports, types, dependencies and duplicate exports across the
import graph. Config and its blind spots are documented in `knip.jsonc`; the
2026-08-16 audit that introduced it lives in
`docs/audits/2026-08-16-web-app-dead-code/`.

---

## Other scripts

| Script | Run by | Purpose |
|--------|--------|---------|
| `check-bundle-size.js` | `npm run check-bundle-size`, both deploy workflows | per-chunk byte budgets on `dist/` (tested by `src/__tests__/bundle-budget.test.ts`) |
| `check-beta-build.js` | beta deploy workflow | asserts `dist/` really is a beta build |
| `generate-icons.mjs` | manual, one-shot | regenerates `public/assets/icons/*.png` from `sparkles.svg` (only the sizes `index.html`/`manifest.json` link) |
| `generate-beta-icons.mjs` | manual, one-shot | regenerates `public/assets/icons/beta/` from `scripts/assets/bot-avatar-beta-1024.png` |
| `smoke-test-pages.js` | both deploy workflows | post-deploy assertions (below) |
| `i18n-parity.mjs` | `npm run validate:i18n` | cross-locale parity: duplicates, missing/extra, placeholders, empties, identical-to-EN |
| `reorder-locales.mjs` | manual / after adding keys | rewrites de/fr/ja/ko/zh into `en.json` key order (values untouched) |

## Pages Smoke Test

Verifies that the build a deploy just produced is live on the public URL with the
right robots policy. Run by both web-app deploy workflows after `pages deploy`:

```bash
node scripts/smoke-test-pages.js \
  --deployment-url https://<hash>.<project>.pages.dev \
  --domain https://beta.xivdyetools.app \
  --expect-robots noindex     # production uses: --expect-robots none
```

Three phases:

1. The deployment alias returns 2xx (~2 min budget — 24 × 5 s). This is the build
   just uploaded; it is *usually* live the moment `wrangler pages deploy` returns,
   but a 2026-08-21 beta deploy answered 404 for 25 s+ before serving, so the
   budget absorbs Pages propagation lag rather than just edge warm-up.
2. The custom domain is polled until its `index.html` sha256 matches the alias's
   (~175 s budget). A Pages custom domain keeps serving the *previous* deployment
   until propagation finishes, so this is what makes phase 3 describe the right
   build.
3. `x-robots-tag` on that matched response must contain `noindex` or `none`
   for beta, and must contain neither for production.

**Phase 3 only works on the custom domain.** Cloudflare injects
`x-robots-tag: noindex` onto every `*.pages.dev` hostname itself, so asserting it
on the deployment alias passes whether or not the build set it. See
`docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md`.

Unit tests: `scripts/smoke-test-pages.test.js` and
`scripts/i18n-guardrails.test.js` (`npm run test`).

## License

MIT © 2025-2026 Flash Galatine

