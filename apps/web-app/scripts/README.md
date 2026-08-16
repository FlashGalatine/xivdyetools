# Build Scripts

## i18n Validation

Validate all `LanguageService.t()` calls against the locale files:

```bash
# Check for missing translation keys
npm run validate:i18n

# Check with typo suggestions (Levenshtein-based)
npm run validate:i18n -- --fix
```

The script scans all TypeScript files in `src/` and validates that every translation key exists in `src/locales/en.json`.

**Related:** The project also includes a custom ESLint rule `xivdyetools-i18n/no-i18n-fallback` that warns against fallback patterns like `LanguageService.t('key') || 'fallback'`. This runs automatically with `npm run lint`.

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

1. The deployment alias returns 2xx (~25 s budget). This is the build just
   uploaded, live the moment `wrangler pages deploy` returns.
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

Unit tests: `scripts/smoke-test-pages.test.js` (`npm run test`).

## License

MIT © 2025-2026 Flash Galatine

