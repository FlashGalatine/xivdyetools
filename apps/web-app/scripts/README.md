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

See `docs/I18N.md` for full i18n documentation.

---

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

