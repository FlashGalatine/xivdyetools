# review-gap-upstream-game-data-trust (2026-10-26)

## Pipeline table (upstream string -> sink)

| Stage | Source | Pin / validation | Sanitization | Cap |
|---|---|---|---|---|
| build-item-names.mjs ko/zh | Teamcraft `staging` branch URL (:63) | none (branch head, no sha, no checksum; meta.sources.ko/zh = same URL) | cleanName :182 strips `<...>`, U+00AD, collapses whitespace | none |
| build-item-names.mjs Item.csv | datamining `master` -> resolved sha (:131-142) but falls back to `master`; local clone path records only "local ffxiv-datamining clone" (meta.json sources.itemCsv) | sha recorded only for remote ja | same cleanName | none |
| build-acquisition.ts | Teamcraft staging sha resolved at run time (:105-108) and recorded (acquisition.meta.json teamcraftCommit) + XIVAPI version | shape assert (assertShapes) | not reviewed per string | none seen |
| Committed tables (measured) | item-names ko/zh/ja, acquisition.en.json | max name 22/17/31 chars, acq max 659; no `](`, no control chars, no markup; 2 U+200F in ko | n/a | n/a |
| Runtime xivapi.ts | XIVAPI v2 search + Glasses sheet | identity (version/schema) match | cleanName :96 = soft hyphen + trim only | none; `response.json` unbounded at :432 and :453 (context probe IS bounded, :327) |
| Cache | cache.ts:63/82 stores rows ~7 d | - | - | none per field |
| Sink bot embed | bot-logic glamour.ts plain() :384 | escapes `* _ ~ \` | \| \\` only | body truncated to EMBED_BUDGET :621; `tail` notes not capped |
| Sink SVG card | glamour-card.ts cardText/frame.ts:160 | escapeXml (XML_ILLEGAL stripped, base.ts:29) | fine | fitText frame.ts:185 is O(n^2) in length |
| Sink web | glamour-markdown.ts escapeHtml :112 for HTML export; Lit templates | escaped | plain-text/markdown export intentionally unescaped (paste target) | - |
| Sink VitePress | config.ts:6 / custom.css:599 `v-html` sidebar text | text = endpoint-registry constants (counts), not upstream | n/a | n/a |

No routes in scope (no authz matrix).

## POSITIVE controls
- XIVAPI fetch: `redirect: 'manual'`, 3xx refused, timeout, version/schema identity must match the captured context (xivapi.ts:360-396).
- Context probe has a 32 KiB streamed cap (:164, :327).
- Acquisition build pins the Teamcraft commit and records it plus the XIVAPI version in the meta; shape assertions fail loudly.
- SVG path: escapeXml strips XML-illegal chars; web HTML export escapes; worker never fetches GitHub at runtime.
- Committed tables are currently clean (measured above).
- VitePress `v-html` text is first-party constants only.

## REJECTED
- VitePress sidebar `v-html` injection: text comes from endpoints.ts registry, no upstream string.
- Web-app glamour-block / GPOSERS export XSS: escaped (escapeHtml) / Lit; markdown export unescaped by design.
- Discord mentions from names: bot sends `allowed_mentions` default (discord-api.ts:84) and embed mentions do not ping.
- Existing committed tables carrying poison: measured clean.

## FILES COVERED
~14 files: apps/api-worker/scripts (build-item-names.mjs, build-acquisition.ts partial), src/chara (xivapi.ts, cache.ts), data (4 JSON + 2 meta, measured by script), packages/core chara-gposers.ts, packages/bot-logic glamour.ts, packages/svg frame.ts/base.ts/glamour-card.ts, apps/web-app glamour-markdown.ts/glamour-block.ts, apps/discord-worker glamour.ts, api-worker docs .vitepress config. Not read: scripts/acquisition/*, fetch_dye_names.py, build-character-colors.ts, build-locales.ts.
