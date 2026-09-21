## 5. i18n / fonts

- `packages/core/src/data/locales/*.json` is **generated** (`fetch_dye_names.py` → `dyenames.csv`
  + `localize.yaml` → `build-locales.ts`, run by core `build`). Hand edits are overwritten — fix
  the generator or the CSV. bot-logic and web-app locale JSONs are hand-edited.
- Locale files are all LF (`git ls-files --eol`) — several reviewers mis-reported CRLF from checkout.
- Re-run `scripts/subset-cjk-fonts.py` (og-worker, discord-worker) after **any** locale text
  change; `font-coverage.test.ts` goes red otherwise (by design). Compare subsets **by cmap, not
  md5** — fonttools rewrites `head.modified` every run. og's script also parses every
  `  xx: {` block in `og-strings.ts`, and `font-coverage.test.ts stringsFor()` must list any new table.
- Bots: `Translator.t()` never returns falsy (returns the raw key) → `|| 'fallback'` is dead code;
  `createTranslator()` is called without a logger everywhere, so misses are silent — the reverse
  key-existence gate in `locale-orphans.test.ts` is the detector. Web-app `LanguageService.t()`
  logs and returns the key.
- og-worker: `og-strings.ts` = card text (subset-parsed); `og-embed.ts` = crawler text
  (deliberately not subset); tool names come from `OG_DECK`, never core `tools.*` (core has only
  the 6 pre-5.0 tools). Share URLs must carry `?lang=` — crawlers send no useful Accept-Language.
- `no-hardcoded-ui-strings` (eslint plugin `xivdyetools-i18n`, web-app) is `warn` and does not scan
  `innerHTML = \`…\`` sites (28 in the BaseComponent tools) — grep those by hand.
- Deliberately English (don't re-file): `/stats` admin dashboards, raw presets-api `response.error`,
  changelog/announcement bodies, preset name/blurb, codes/tags (`R·C`, `ID`, `STANDARD·WIDE·COFFER`,
  `RGB DIST`, `DISTINGUISH %`, mixer "Spectral", `216 G`, A/B/C, ALGO_TAG, LENS_SHORT, tier names),
  ko/zh CIEDE2000 learn-link = no link, ja 染料 vs カララント per-surface house style.
- Game nouns core does NOT carry are pinned only by `docs/reference/ffxiv-terminology.md` →
  *Market and Server Terms* and *Glamour Terms* (2026-09-20): Market Board = fr tableau des ventes /
  ko 장터 / zh 市场布告板; World = ko 서버 / zh 服务器; Data Center = ko 데이터 센터 / zh 大区; one
  glamour (an outfit) = ja ミラプリ / de die Projektion (f.) / fr le mirage (m.) / ko 코디 / zh 幻化.
  **False friends — never use:** ja グラマー and ko 글래머 (a voluptuous figure). Not the client's
  word: de Mirage / Glamour, fr glamour, zh 时装, ko 시장 게시판 / 마켓보드 / 월드, zh 市场板 / 市场版.
  Korean Market Board has TWO official forms: `장터` = the feature (the official guide's title; what
  the apps mean) and `장터 게시판` = the board object's in-game map label.
  A terminology fix needs a cited publisher source — the coordinator's fluent guesses 幻化棱晶 and
  투영 서랍장 were wrong — **and a summarized web fetch is not the raw page**: a researcher reported
  `장터 게시판` as "player usage only", and the maintainer's raw capture of the same official guide
  showed it printed on the in-game map three times. When a source is client-rendered, 403s, or was
  read through a summarizer, mark the row unverified, then **read it raw in a real browser** when
  a browser-automation tool is connected (navigate, then evaluate page script returning
  `document.body.innerText` hits and needle counts — that is how `ff.web.sdo.com/web8/index.html#/servers`
  and `m.ff14.co.kr/guide/start/detail.asp?no=1025` were verified on 2026-09-20; record the
  counter-needles too, e.g. `월드` ×0). Only ask the maintainer for a page capture when that fails.
  (Reading a FireShot PDF here: `pdftoppm` is absent and no PDF library is installed — the pages
  are embedded images; pull the `/DCTDecode` streams out as JPEGs, wrap `/FlateDecode` +
  PNG-predictor streams in a PNG container, crop with PIL, then Read the crops.)
- Tool names are official in English: **Swatch Matcher**, **Harmony Explorer** (not "Character
  Matcher" / "Color Harmony Explorer"; locale KEYS are still `tools.character.*`); the header-gear
  panel is **Advanced Settings** (the component file is still `advanced-options-panel.ts`).
  og-worker's `OG_DECK` names must quote the shipped web-app titles in every locale.
- `"Skybuilders' Scrips"` (apostrophe) vs locale key `"Skybuilders Scrips"` — a key-mismatch class:
  when a lookup falls back to English, diff the literal against the key table before translating.
- **Same English → same translation is gated** (2026-09-20): web-app `scripts/i18n-parity-gate.test.js`
  + `i18n-same-english-allowlist.json`, bot-logic `src/i18n/__tests__/locale-quality.test.ts` +
  `locale-quality-allowlist.json`. A new pair of keys with one English value needs one value per
  locale, or an allow-list entry naming the two jobs the word does (verb vs adjective, French
  agreement, theme name vs lightness band). Blind spots to check BY HAND: two *different* English
  values for one concept (the sidebar said "Spectral - Realistic Paint" where the Mixer said
  "Pigment"; "Perceptual" named LAB in one place and OKLAB in another — the English itself
  disagreed), and a value only *half* in English (de "Powered by Photon WASM Bildverarbeitung").
- **A label assembled in a template needs a test that reads it as the browser shows it.** The
  Edit tool can eat a trailing space at the end of a replacement string: fixing en
  `"Spectral -Realistic Paint"` by moving the id into the Lit template produced
  `Spectral -${…}` again on the first try. `config-sidebar.mixing-mode.test.ts` normalizes
  whitespace and pins all six labels.
- House register: **German is `du` everywhere** (web app, bot, policies — gated for web-app
  `de.json`); French is `vous`. German for a dye is **Farbstoff**, never Farbe (= color); the
  RYB "Paint" model is `Malfarbe`. Chinese has one word, `颜料`, for paint and pigment — the Mixer
  pair is `颜料` (RYB) / `真实颜料` (Spectral); `颜料画` means a painting. Korean Hue is `색상`,
  not `색조`.
- Still unpinned (needs a dictionary row before anyone edits it): the limbal-ring noun — cards say
  LIMBUS / LIMBE / リムバル / 림벌 / 角膜环, core's sheet name says Limbus / Limbe / 角膜 / 홍채 / 虹膜;
  the ja 染料 / カララント "by surface" boundary (web-app is 86 : 38 and the rule is written nowhere).

