# Review: entry-reference (2026-10-11)

HEAD 42c35e87 == served source (16a6123f differs only in CHANGELOG-laymans.md). All 8 files read in full.

## Coverage
| Path | Tier | Units | Sections reviewed | Result |
|---|---|---|---|---|
| docs/CLAUDE.md | living | repo-wide | all (commands, scripts, ports, example, counts) | reviewed |
| docs/README.md | living | repo-wide | all (folder map, tier rules) | reviewed |
| docs/index.md | living | repo-wide | all; "Recent Updates" past-release rows treated as history | reviewed |
| docs/versions.md | living | repo-wide | header, current tables (npm parity checked live), update steps, compat matrix; history rows spot-checked top row vs package.json | reviewed |
| docs/reference/ffxiv-terminology.md | living | core data/locales | every table vs packages/core/src/data/locales/*.json (script-compared) | reviewed |
| docs/reference/glossary.md | living | core, web-app, bot | all | reviewed |
| docs/reference/index.md | living | - | all | reviewed |
| docs/user-guides/index.md | living | web-app | tool list/order/labels vs en.json + v4-app-header.ts | reviewed |

## Candidates
See the structured return; locations and evidence are repeated there.
- 01 docs/CLAUDE.md:155 type-only names imported without `import type` (types index.ts:26-28 `export type`).
- 02 versions.md:7-16 "ahead of npm (2.2.1, 1.4.1)" is false: npm view logger 2.3.0, worker-kit 1.5.0; "Last Updated: October 6" vs 5.15.0 dated 2026-10-09 (commit 147a8e4a).
- 03 user-guides/index.md:33 "app title: Preset Palettes"; apps/web-app/src/locales/en.json:71 tools.presets.title = "Community Presets"; no "Preset Palettes" in web-app src.
- 04 ffxiv-terminology.md:40 JA for 13116 is シャインシルバー in ja.json, doc says メタリックシルバー.
- 05 glossary.md:5 lists "jobs"; ffxiv-terminology.md "Other locale sections" says no jobNames section.
- 06 index.md:196-198 Recent Updates stops at 2026-09-05.
- 07 versions.md compat matrix has no row above "Web App v5.12.6+ / core 5.7.0+" though history rows 123/125 name core 5.10.0/5.9.0.
- 08 versions.md:~738 "Production always needs the explicit :production script" (oauth bare deploy is production; deploy and deploy:production are identical, apps/oauth/package.json:10-11).
- 09 glossary "XIV Dye Tools (v4)" covers 5 of 10 tools, no Glamour Reader.
- 10 DOC-020 STILL_PRESENT glossary.md:94-95.
- 11 DOC-022 STILL_PRESENT glossary.md:91.
- 12 spelling (DOC-005 PARTLY).

## Positive controls
Counts 17 (8+9), 125 dyes, 11 Facewear, 10 tools, 18 commands (apps/discord-worker/src/commands/registry.ts), tool order (v4-app-header.ts:54-65), dev ports 5173/8787/8788/8790, scripts dev/deploy/deploy:production/register-commands, six BLENDING_MODES, band cuts 5/10/20 (band-vocabulary.ts:94), locale section counts (9/7/11/11/5/8/16/10/5 + meta 3, labels 7, tools 6, sheets 9, "fifteen sections"), all dyeNames/category/acquisition/facewear/harmony/vision/wheel/race/clan cells except 04, every #anchor in the 8 files resolves (own script), version tables match npm.

## Rejected
- index.md:301 "9 tools": dated "January 2026 ... Web App v4.0.0" history row, correct for v4.
- docs/CLAUDE.md:32 / index.md:30 "17 projects (8+9)": correct.
- versions.md "Web App v4.0-4.1 ... 9 tools" and history rows naming old facts: allowed.
- terminology 133 Grey, 241 Analogue, 289/301 centre: standing rejections.
- Seed 4 versions.md current rows: all match package.json and npm.

## Spelling per document (confirmed 68)
versions.md 50 (47 tool rows + unrecognised x2 line 79 + mislabelled line 92, dictionary misses) | index.md 10 (9 + ASCII-tree prose line 46) | glossary.md 5 | ffxiv-terminology.md 2 (124, 530) | reference/index.md 1 | CLAUDE.md, README.md, user-guides/index.md 0.
Rejected: terminology 133 Grey (code and prose), 241 Analogue, 289 and 301 centre (French cells).
