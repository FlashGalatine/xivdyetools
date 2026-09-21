# web-app cluster review

| cand-id | sev | file:line | one-line claim | evidence pointer |
|---|---|---|---|---|
| cand-001 | LOW | docs/projects/web-app/components.md:197 | "`src/locales/<lang>.json` (1,152 keys per language)" | `node apps/web-app/scripts/i18n-parity.mjs` prints `EN keys 1129` against the working tree's en.json |
| cand-002 | LOW | docs/projects/web-app/overview.md:27 | "the UI locale files grew to 1,152 keys × 6" | same: i18n-parity.mjs reports EN keys 1129, not 1152 (23 short) |
| cand-003 | MEDIUM | docs/projects/web-app/components.md:46 | desktop tool-rail shortName order given as "…Gradient, Presets, Budget, Swatch, Mixer" | apps/web-app/src/components/v4/v4-app-header.ts:53-63 `TOOL_MENU` (used by both `renderToolRail()` and `renderToolMenu()`, array order = render order) places `mixer` 6th, right after `gradient`, before presets/budget/swatch |
| cand-004 | MEDIUM | docs/projects/web-app/components.md:47 | config sidebar has a "Harmony **Colour wheel** select" | apps/web-app/src/locales/en.json:174 `"colorWheel": "Color wheel"` — live label is American spelling |
| cand-005 | MEDIUM | docs/projects/web-app/tools.md:31 | same control quoted as "the control is a **Colour wheel** select" | apps/web-app/src/locales/en.json:174 `"colorWheel": "Color wheel"` |
| cand-006 | MEDIUM | docs/user-guides/web-app/community-presets.md:1 | tool titled "Community Presets" (same name repeated in overview.md:22, tools.md §7 header, getting-started.md Quick Tour §7, faq.md, favorites-collections.md) | apps/web-app/src/locales/en.json:71 `tools.presets.title` = `"Preset Palettes"`; router-service.ts:79 `titleKey: 'tools.presets.title'` is what document title / mobile title-menu render; the string "Community Presets" does not occur anywhere in apps/web-app/src locale files or rendered UI code (only as a code-comment name in tool-config-types.ts/config-sidebar.ts) |

POSITIVE:
- 125 standard dyes / 11 Facewear colours are exact (`packages/core/src/data/dyes.json` = 125 entries, `facewear_colors.json` = 11).
- 5 colour wheels (rgb/ryb/munsell/oklch-hue/oklch-lightness, default `rgb`) match core's `COLOR_WHEEL_IDS`/`DEFAULT_COLOR_WHEEL` (ColorWheel.ts) exactly; "Munsell (JIS)" label confirmed verbatim in `packages/core/src/data/locales/en.json:192`.
- 6 Dye Mixer blend models (rgb/lab/oklab/ryb/hsl/spectral, default `ryb`) match `MixingMode`/`DEFAULT_CONFIGS.mixer` in `shared/tool-config-types.ts` exactly; 10 harmony types match `HARMONY_TYPE_IDS`; 5 accessibility lenses match `AccessibilityConfig`'s fields.
- Every per-tool config default checked against `DEFAULT_CONFIGS` matches doc claims exactly: harmonyType `complementary`, wheel `rgb`, extractor maxColors `4`, gradient stepCount `8`/interpolation `hsv`, comparison matchThreshold `5`, budget maxDeltaE `8`, swatch maxResults `3`/race `SeekerOfTheSun`.
- Storage keys/limits verified byte-exact: `xivdyetools_theme`, `xivdyetools_v4_config_` prefix, `v5_accessibility_lens`, MAX_FAVORITES=40, MAX_COLLECTIONS=50, MAX_DYES_PER_COLLECTION=20 (collection-service.ts), saved-presets cap 200, extractor MAX_PICKS=6 / MAX_EXTRACTOR_SHARE_COLORS=5.
- getting-started.md's subtle claim that the `1`-`9` keyboard order "agrees with the rail for the first five tools" then diverges (6 Presets/7 Budget/8 Swatch/9 Mixer) is correct — confirmed against keyboard-service.ts `TOOL_KEY_MAP` (ROUTES order) vs v4-app-header.ts `TOOL_MENU` (rail order), which genuinely differ from position 6 on.

SPELLING-EXCEPTION:
- docs/user-guides/web-app/color-harmony.md:3 and :106 (also accessibility.md:92, faq.md:11) "Glamour"/"glamours" — correct: FFXIV's own term for its appearance/outfit system, never spelled "Glamor" in-game or in this app's strings.
- Checked "Grey" specifically (FFXIV names 4 dyes + 1 Facewear colour "Grey"/"* Grey"): only occurrence in this cluster is dye-mixer.md:65's blending-model table ("Blue + Yellow = Grey"), which is generic descriptive prose alongside "Olive/Green/Cyan/Pink," not a quoted dye name or UI label — so it is NOT an exception; leaving it for the normal American-spelling pass.

COVERED: 16/16 files read in full (all 4 docs/projects/web-app/*.md + all 12 docs/user-guides/web-app/*.md). None left unfinished.
