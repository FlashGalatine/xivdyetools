# Review: specs-other (2026-10-11)

## Coverage
| path | tier | units | sections | result |
|---|---|---|---|---|
| docs/specifications/budget-aware-suggestions.md | living | discord-worker, web-app, core | all (banner, phases, technical, data, checklist) | reviewed |
| docs/specifications/collections.md | living | web-app, discord-worker | all | reviewed |
| docs/specifications/feature-roadmap.md | living | web-app, discord-worker, core | all | reviewed |
| docs/specifications/multi-color-extraction.md | living | core, web-app, discord-worker, svg | all | reviewed |
| docs/specifications/preset-palettes.md | living | core, types, web-app, discord-worker | all | reviewed |

## Candidates
- 01 (supersedes DOC-021, MEDIUM) multi-color-extraction.md:120,129-133,345,351,359 vs PaletteService.ts:416 `extractPalette(pixels, options={}): ExtractedColor[]`, :554 `extractAndMatchPalette(pixels, dyeService, options={})`. STILL_PRESENT.
- 02 (MEDIUM) multi-color-extraction.md:216-230,395 `/match_image colors:<1-5> default 1` vs apps/discord-worker/src/commands/schemas.ts:363-381 `/extractor image colors` 3-10 optional; contradicts doc's own line 8.
- 03 (MEDIUM) feature-roadmap.md:174,184,368 "F/C never shipped" vs apps/web-app/src/components/dye-grid.ts:444-475 (cases f/F, c/C, BUG-069 comment) with showFavorites true in comparison-tool.ts:592, accessibility-tool.ts:585; collections.md:339-342 correctly lists F and C.
- 04 (LOW) feature-roadmap.md:286,290,292 `pixelDataToRGB()` (only `pixelDataToRGBFiltered` exists, PaletteService.ts:605), mode toggle/Extract Palette button (extractor-tool.ts:19 "Bulk extraction is no longer a mode"; no such en.json key).
- 05 (LOW) collections.md:131-132,160,320,332,342 service shape (static, no storage field), ImportResult.errors is ImportError[] (collection-service.ts:125-130), no name-character restriction (createCollection :615-660 checks length/duplicate only), import suffix is localized "{name} (imported {n})" (en.json:751), no Ctrl+Shift+C handler (keyboard-service.ts has no such chord).
- 06 (LOW) budget-aware-suggestions.md:40,178-179 `DyeService.findClosestDyes` absent (DyeService.ts:187 findClosestDye, :201 findDyesWithinDistance), no PriceService/RedisCacheBackend (only a README example), TTL 10 min vs price-cache.ts:28,31 (300s fresh, 900s stale); feature-roadmap.md:143 same 10-minute claim.
- 07 (LOW) preset-palettes.md:37-38,47,195,237,350-352 type/class shapes vs packages/types/src/preset/core.ts:18 (8 categories, no 'community'), PresetService.ts:75 constructor(presetData), :220 returns undefined; files named do not exist (web: components/v4/preset-tool.ts; svg: packages/svg/src/preset-swatch.ts). Example data tables list 21 job/10 aesthetic palettes; banner covers counts only.
- 08 (LOW) spelling, see below.

## Positive controls
- Banner counts 15 palettes = 3/4/8 verified by reading presets.json (version 2.0.0, ids gc-*, season-*, event-*).
- /budget options (target_dye, world, matching, max_distance 2-20 default 8, exclude_coffers, exclude_wide_spectrum; quick; set_world) match schemas.ts:1299-1420 and budget-calculator.ts:59; 22 quick picks; Budget is 8th rail chip (v4-app-header.ts:54-65); MARKET DATA UNAVAILABLE (en.json:592); Save mix/swap/character/Make a palette labels exist; limits 40/50/20/50/200 and storage keys match collection-service.ts:136-146; /preset favorite add|remove|list exists; no /favorites or /collection in registry.ts; core PaletteService clamp 1-10, default 4, 25, 1.0, 10000 match.
- No #anchor links in the 5 files.

## Rejected
- collections.md:451 CANCELLED: valid US variant.
- budget spec unchecked checklist and Phase-1 design under Implemented banner: explained by the As-shipped banner.
- feature-roadmap.md:100 "last two" wording: minor muddle, folded out.
- roadmap "eighth chip": correct (budget is index 8 in TOOL_MENU).

## Spelling per document
collections.md 2 (favourited 96, 298; missed by sweep), feature-roadmap.md 4 (330 centre, 334 colour, 342 centre, 352 colour), multi-color-extraction.md 1 (99 colour). Total 7. Rejected: collections.md:451 CANCELLED. budget 0, preset-palettes 0.
