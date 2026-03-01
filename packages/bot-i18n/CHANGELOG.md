# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-01

### Removed

- 3 unused function exports: `translate()`, `getAvailableLocales()`, `isLocaleSupported()` — zero consumers; the OOP API (`Translator` class + `createTranslator()`) is preferred (DEAD-032)
- 5 unused locale key sections from all 6 language files: `buttons`, `status`, `pagination`, `components`, `matching` — zero `t.t()` references (DEAD-034)

### Changed

- Marked `LocaleData` and `TranslatorLogger` type exports as `@internal` (DEAD-033)

## [1.0.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.0.0] - 2026-02-18

### Added

- Extracted bot UI string translations from the Discord worker into a shared package
- `Translator` class with dot-notation key lookup and `{variable}` interpolation
- `createTranslator(locale)` factory function
- `translate(locale, key, variables?)` stateless translation function
- `getAvailableLocales()` and `isLocaleSupported(code)` utility functions
- English fallback for missing keys in non-English locales
- Optional `TranslatorLogger` interface for missing-key warnings
- Bundled locale data for 6 languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`
- Translation keys covering: errors, common strings, dye info, harmony, gradient, mixer, match, comparison, accessibility, random, and budget commands
- Zero runtime dependencies — all locale data is statically imported JSON

---

[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/bot-i18n-v1.0.0
