# i18n review — web-app

Scope: `apps/web-app`. Base `origin/main` `e86c7404`. New-surface window: commits since
2026-09-03 touching `apps/web-app/src` (`git log --since=2026-09-03 --stat -- apps/web-app/src`),
anchored at `1f4ba727^` (before Sprint 2's mixing-mode rename) through `HEAD` (`738cbb03`).

## Module map of what changed (non-test files)

- Harmony colour-wheel selector: `services/harmony-generator.ts`, `components/v4/config-sidebar.ts`,
  `components/v4/v4-color-wheel.ts`, `services/config-controller.ts`, locales (`config.colorWheel`,
  `config.wheel*Desc`, `config.wheelMunsellTrademark`, `harmony.types.*Desc` rewordings).
- Palette Extractor 4A + share link (BUG-002): `components/extractor-tool.ts`,
  `services/share-service.ts`, locales (`matcher.imageShare`, `sharedPalette`, `picksCount*`,
  `clearPicks`, `rollCount*`, `pickCapReached`), plus a large `matcher.*` key prune (dead strings
  from the pre-4A UI removed — `uploadImage`, `dragDrop`, `colorPicker`, `roll`, etc.).
- Swatch "Show all pieces" + Copy list / Export .md + item-links menu (7→5 databases after EC was
  cut): `components/chara-import.ts`, `components/item-links-menu.ts`,
  `components/glamour-list-actions.ts`, `shared/glamour-markdown.ts`, `shared/item-links.ts`,
  locales (`swatch.copyList`, `exportMarkdown`, `listCopied/CopyFailed/ExportFailed`,
  `swatch.itemLinks.*`).
- ToS + reachable policies: `apps/web-app/TERMS_OF_SERVICE.md`, `apps/web-app/PRIVACY.md`,
  `components/about-modal.ts` (`about.policiesLabel/privacyPolicy/termsOfService`).
- "Say true things about matching/harmony" (Sprint 4): `comparison.m*Desc/Caveat` rewordings,
  `config.matchingMethodImpact`, `config.mixingRybDesc`, `harmony.types.triadicDesc` etc.
  de-hyped.
- Camera feature deleted (`camera-preview-modal.ts`, `services/camera-service.ts`, `camera.*`
  locale block removed) — no i18n surface left.

## Findings

See the candidate table in the reply. Full excerpts:

**cand-001** `apps/web-app/src/locales/ko.json:436` — `comparison.mCiede2000Desc` reads
`"...1.0 안팡이 식별 가능한 최소 차이이며..."`. `안팡` is not a Korean word; the intended word is
`안팎` ("around/approximately" — the en source says "Around 1.0 is the smallest difference").
Confirmed as new-since-2026-09-03 via `git log -p --since=2026-09-03 -- .../ko.json | grep
mCiede2000Desc` (only one hit, added by the Sprint 4 "say true things" commit `3306d03f`/wording
pass). A ko user reading the Comparison tool's ΔE2000 metric explanation sees a nonsense word
mid-sentence.

## Checked and clean (worth recording so it isn't re-run)

- `shared/item-links.ts` + `components/item-links-menu.ts`: `ItemLinkId` domain (`mirapri`,
  `garlandTools`, `teamcraft`, `gamerEscape`, `lodestone`) matches `LINK_LABEL_KEY` exactly;
  `LODESTONE_REGIONS` (`na/eu/jp/de/fr`) matches `swatch.itemLinks.lodestoneRegion.*` exactly in
  all six locale files (spot-checked via a python loader). No raw-key or missing-key risk.
- `services/harmony-generator.ts`'s `harmony.types.${camelCaseKey}Desc` domain (10 harmony types,
  including `invertedTetradicDesc`) resolves in en.json; `LanguageService.getHarmonyType()` and
  `.getColorWheelName()` both delegate to core's `LocalizationService`, so harmony-type and
  wheel-name NOUNS are read from core, never re-typed in web-app (the cross-surface vocabulary
  rule holds).
- `config-sidebar.ts`'s `getWheelDescription()` switches on `normalizeColorWheelId()` (not the raw
  value) with an explicit case per wheel and only `rgb` sharing the `default:`, so an unfolded id
  can't silently print the wrong wheel's copy.
- `shared/glamour-markdown.ts`: template slot labels ("Main Hand:", "Dye 1:", "Acquisition:") are
  deliberately English — documented in the module's own header as a fixed-format GPOSERS
  submission template, not UI copy; item/dye names inside it are localized
  (`glamour-list-actions.ts` calls `itemNameFor(names, LanguageService.getCurrentLocale())` and
  `localizedDyeName()`). Matches the brief's "deliberate, comment says so" bar.
- Extractor share-link query stripping (`extractor-tool.ts:1270`) removes only `colors`/`algo`/`v`,
  so `?lang=`/`?dc=` survive a "load your own image" action — confirmed by reading the code, not
  assumed from the commit message.
- `shared/format.ts` (`formatNumber`/`formatDate`/`formatList`/`formatGil`) all default their
  locale param to `LanguageService.getCurrentLocale()` — no hardcoded `'en-US'`. New extractor/
  harmony/swatch code has no raw counts large enough to need it, so nothing new calls it, but nothing
  new bypasses it either.
- `document.documentElement.lang` is set by `LanguageService` on locale change (not just at boot);
  `router-service.ts` recomposes `document.title` through translated route titles on init,
  navigate, replace and popstate.
- Sampled ~40 new/changed keys across all six locale files for the extractor share/picks strings,
  the wheel descriptions, the item-links menu, and the glamour-list toasts: all six locales present,
  non-English, correctly interpolated placeholders, register consistent with neighbouring strings.
- `innerHTML = \`...\`` template sites in touched files (`market-board.ts:355`, `mixer-tool.ts:1493`,
  `gradient-tool.ts:1167`) all route their text through `LanguageService.t()`; only the SVG markup
  is a literal.

## Rejected / not filed

- ToS (`apps/web-app/TERMS_OF_SERVICE.md`) and Privacy (`PRIVACY.md`) are English-only, linked via
  GitHub's `blob/main` URL from `about-modal.ts` (not served from the app's own `public/`, so the
  web-app build/`dist` question doesn't apply). Only the link *labels* are localized (six
  languages, checked). This mirrors the bot's own ToS pattern and reads as a deliberate choice for
  a legal document, not a lint gap — flagged here as a `?` in case the audit owner wants an
  explicit "English only" note added near the links, but not filed as a defect.
- zh.json mixes a doubled em-dash `——` (25 occurrences) and a spaced single em-dash ` — ` (8
  occurrences, including 2 in this window's new keys: `pickCapReached`, `itemLinks.nameUnavailable`)
  for the same punctuation role. Not filed: the spaced form pre-dates this window (6 of 8
  occurrences are untouched-by-this-audit strings), so this is a pre-existing house-style split,
  not something the new commits introduced.

## Coverage

6 locale files read in full via a Python/json loader (`en/ja/de/fr/ko/zh`); ~15 non-test `.ts`
files opened for the changed surface (extractor-tool, item-links(-menu), glamour-markdown,
glamour-list-actions, chara-import, harmony-generator, config-sidebar, v4-color-wheel,
share-service, about-modal, format.ts, market-board, mixer-tool, gradient-tool,
advanced-options-panel, camera-preview-modal [deleted]); `git log`/`git diff` used throughout to
confirm the since-2026-09-03 window rather than assuming from commit subjects.
