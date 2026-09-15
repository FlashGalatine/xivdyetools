# OG worker security review — 2026-09-15

## Routes, authority, and sinks

| Surface | Authority / sink | Evidence |
|---|---|---|
| Tool paths and root | Crawler-only escaped OG HTML; humans pass through only on the configured SPA host | `src/index.ts:501-552,1177-1225`; `src/og-data-generator.ts:669-777` |
| `/og/*` | Public, bounded card renderer; canonical cache key and Analytics Engine event | `src/index.ts:180-418,427-442,700-1169` |
| Preset cards | Bundled curated `presetData`; no remote preset/API fetch or community content lookup | `src/services/svg/presets.ts:12-70`; `src/og-data-generator.ts:542-573` |

## Candidates

| Candidate | Severity / exposure | File:line | Claim | Evidence |
|---|---|---|---|---|
| Raw crawler UA and full share URL are logged | P2 privacy / latent if Worker Logs are enabled; crawler requests only | `src/index.ts:536-546`; `apps/web-app/PRIVACY.md:58-60,90-92` | The only crawler metadata log includes `crawlerInfo.userAgent` and `url.toString()`, despite the privacy guide describing OG worker visibility as only the URL and separately promising no UA/page URL/colours in analytics. | AE rows are coarse and contain no URL/UA, but this structured log can retain the full user-selected share parameters and crawler UA under an operator-enabled log sink. Minimize to crawler class/tool/validated coarse fields or disclose retention. |

## Positive controls

- Both beta and production are routed custom domains with `workers_dev = false`; beta/prod data sets and app/image hosts are separated (`wrangler.toml:1-86`).
- `/og/*` rejects long paths/segments and unknown query keys before cache/render; validates enum query values and canonical path inputs, bounding render/cache amplification (`index.ts:180-290,644-688`).
- Cache keys use decoded canonical path, resolved locale/frame, only applicable validated parameters, and package card version; only successful GET/HEAD renders are cached (`index.ts:292-418`).
- All crawler HTML data is escaped, backed by fixed CSP/no-referrer/frame/form restrictions and `Vary: User-Agent`; SVG text/attributes pass XML escaping and hostile not-found labels are clipped/linear (`og-data-generator.ts:669-777`; `services/svg/band.ts:90-205`; `band-shared.ts:45-78`).
- Renderer consumes only local static fonts/WASM and bounded 400-grid card generators. Analytics Engine contains event, tool, crawler category, and timestamp only (`services/renderer.ts:72-147`; `index.ts:427-442`).
- Human unknown-host requests cannot self-fetch; the image host 404s and other non-app hosts redirect to the configured app (`index.ts:460-483,1208-1225`).

## Rejected suspicions

- Community preset text/image visibility cannot enter OG render or cache: presets resolve only against bundled curated data, with unknown/community ids rendered as default/not-found cards (`services/svg/presets.ts:33-45`; `og-data-generator.ts:554-573`).
- Arbitrary query cache busting, SVG injection, quadratic label wrapping, and image-route content sniffing are rejected/contained by the pre-cache key/value guards, XML escaping, 32/512-character clipping, and `nosniff` (`index.ts:180-290`; `band.ts:90-205`; `band-shared.ts:58-78`).
- AE itself does not retain persistent IDs, IP, UA, URL, title, or share data; its fixed blobs/indexes are event/tool/crawler and timestamp (`index.ts:427-442`).

## Coverage and limits

Final verification clarification: the cited no-UA/page-URL promise is scoped to opt-in Usage Analytics. The operational crawler log is a LOW minimization/disclosure gap, not a confirmed breach of that analytics promise. Crawler UA is not necessarily the end user's UA, and persisted log retention was not checked. See FINDING-006 for the final narrowed assessment.

Covered tracked source/config: complete `index.ts`, `wrangler.toml`, OG parameter and HTML generators, renderer, SVG band/preset paths, cache/analytics/log sinks, and web privacy disclosure. Read-only source review; no deployment probes, renderer load test, account/log-retention inspection, or source edits.
