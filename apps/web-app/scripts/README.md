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

## Icon Conversion to WebP

To optimize images for mobile performance, run the icon conversion script:

```bash
npm install sharp --save-dev
node scripts/convert-icons-to-webp.js
```

This will create WebP versions of the icons in multiple sizes:
- `icon-40x40.webp` - Mobile header (40x40px)
- `icon-80x80.webp` - Tablet (80x80px)
- `icon-192x192.webp` - Default/Desktop (192x192px)
- `icon-512x512.webp` - Large displays (512x512px)

The script uses the existing `icon-192x192.png` as the source and creates optimized WebP versions with 85% quality.

**Note**: The responsive image code in `src/components/app-layout.ts` will automatically use these WebP files when available, falling back to PNG if they don't exist.

