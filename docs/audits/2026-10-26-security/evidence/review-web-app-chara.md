# review-web-app-chara (deploy unit: web-app) — 2026-10-26

Reviewer scope: the web-app `.chara` path at HEAD 13c386e5 (web-app 5.16.0, core 5.15.0, xivcharakit 0.1.0-beta.4 exact pin at `packages/core/package.json:78`).

## Module / message table

| Module | Role | Trust boundary | Notes |
|---|---|---|---|
| `apps/web-app/src/services/chara-file-loader.ts` | name + size gate, capped read, telemetry, session hand-off | user file -> page | `*.chara` name check before read (`:72`), `file.size > MAX_CHARA_FILE_BYTES` before read (`:75`), read of `MAX+1` bytes then re-check (`:88`, `:97`), generation counter supersedes stale loads (`:49`, `:79-80`) |
| `apps/web-app/src/services/chara-inspection-service.ts` | one module worker per call, palette bridge (page side) | page <-> worker | same-origin `new Worker(new URL(...), {type:'module'})` (`:291`), buffer transferred (`:309`), 5 s deadline (`:305`), `finish()` terminates once (`:169-186`), palette replies only for live call + active id (`:237`), page-side cap 64 (`:206`), answers rebuilt through `parsePaletteReply` (`:209`), dyes attached from the page DB after validation (`:223-231`) |
| `apps/web-app/src/services/chara-inspection-protocol.ts` | allowlist validators, both directions | structured clone | `readRecord` rejects any non-allowlisted / accessor / symbol key (`:355-370`); `readArray` dense + index-only (`:376-388`); fresh DTO rebuilt (`:723-769`); 256 KiB serialized bound (`:771-774`); validators wrapped in try/catch (`:782-790`, `:887-906`, `:917-940`) |
| `apps/web-app/src/workers/chara-inspection.worker.ts` | inspect + project, palette bridge (worker side) | worker | imports only `@xivdyetools/core/chara` (`:24`); no logging; fixed codes only (`:85`, `:91`); worker-side cap 64 (`:128`); stale/unknown palette replies ignored (`:166-173`); listener only in a real WorkerGlobalScope (`:211`) |
| `apps/web-app/src/services/chara-session-service.ts` | memory-only session | page | no storage API; subscriber failures logged with a fixed string (`:63`) |
| `apps/web-app/src/services/chara-resolve-service.ts` | `POST /v1/chara/resolve` | page -> api-worker | body = validated `gearModels` (slot enum + uint16) + glasses id (`:181-182`); per-lane uint16 filter (`:110-121`); abort + 12 s timeout (`:184-185`); logs status code only (`:203`) |
| `apps/web-app/src/components/chara-file-card.ts`, `chara-sheet.ts`, `chara-ui.ts` | rendering | imported strings -> DOM | `el()` uses `textContent` (`chara-ui.ts:211-215`); nickname / file name / producer rendered as text (`chara-file-card.ts:289-330`) |
| `apps/web-app/src/components/glamour-block.ts`, `glamour-sheet.ts`, `glamour-tool.ts`, `glamour-twin-picker.ts`, `glamour-list-actions.ts`, `item-links-menu.ts`, `src/shared/glamour-markdown.ts`, `src/shared/item-links.ts` | Glamour Reader | api-worker JSON -> DOM / clipboard / external links | only static innerHTML (`glamour-block.ts:588`); clipboard HTML escaped (`glamour-markdown.ts:112-136`); fixed download name (`glamour-markdown.ts:69`); external links `noopener,noreferrer` (`item-links-menu.ts:131`) with fixed origins + `encodeURIComponent` (`item-links.ts:72-121`) |
| `apps/web-app/scripts/copy-chara-notices.mjs`, `public/licenses/xivcharakit.txt` | build-time license copy | LOCAL | strict UTF-8, name + version pin checked (`:108-117`); output holds no local paths or secrets (grep for users/c:\/token/secret: none) |
| `apps/web-app/public/_headers` | CSP etc. | Pages | one `/*` rule (`:7-48`); no repeated pattern; worker governed by `script-src 'self'` (no `worker-src`, falls back) |

No routes in this unit; no authz matrix applies (the resolve call is anonymous to a public endpoint).

## Candidates

- **web-app-chara-01 (LOW, LOCAL, policy):** Swatch Matcher "Save character" (`chara-sheet.ts:191-221`, wired at `swatch-tool.ts:1385`) names the persisted `kind:'character'` collection after `resolved.nickname`, then the file name, with no name field. `PRIVACY.md` "Character files" exception (`apps/web-app/PRIVACY.md:36-40`) names only "a glamour or its palette" and says "Rename or delete the record", while `PRIVACY.md:61-62` says Swatch character saves have no delete control. Resolution: AMEND apps/web-app/PRIVACY.md "Character files" (name the Swatch save and its clear-site-data-only removal), or minimize first (default name instead of nickname for the character save).
- **web-app-chara-02 (INFO, LOCAL, hardening):** the page validator accepts any <=256-unit string as `tribe` (`chara-inspection-protocol.ts:739`, cast at `:757`) whereas `race`/`gender` are enum-checked; the value is then pinned into the persisted swatch config (`config-controller.ts:222`) and used as a key in `SUBRACE_TO_CLAN_KEY[resolved.tribe]` (`chara-file-card.ts:316-317`). Only reachable through a defective worker/core (core maps only `state==='valid'` tribes, `chara-library.ts:258`), so defense-in-depth only.

## POSITIVE controls

- Extension and 8 KiB cap both enforced before any read, and again on the capped bytes (`chara-file-loader.ts:72-97`).
- Both directions of the worker exchange are allowlist-validated and rebuilt; extra keys, accessors, holes, non-index array props rejected (`chara-inspection-protocol.ts:340-388`).
- Message ids: page answers only the active id from its live worker (`chara-inspection-service.ts:189-191,237,255`); each call has its own worker so stale ids die with `terminate()`.
- Worker imports only the narrow `@xivdyetools/core/chara` subpath (`chara-inspection.worker.ts:24`; `packages/core/src/chara.ts` exports two functions + four types).
- Nothing persisted from the session: `chara-session-service.ts` has no storage call; the file itself is never stored.
- Logs: every chara log line is fixed text or a count / normalized producer bucket (`chara-file-loader.ts:92,110,113-117,129`; `chara-sheet.ts:232`; `glamour-block.ts:404,1857`).
- Telemetry: `chara_parse` carries `{ok, producer bucket}` only (`chara-file-loader.ts:109,125`; `telemetry-service.ts:177-184`); gated on toggle + GPC at track time (`telemetry-service.ts:117-123`).
- Community preset name never pre-filled from nickname/file name (`glamour-block.ts:1805-1807`); download filename carries no character name.
- Resolve body is integers + slot enum only; uint16 lanes filtered client-side (`chara-resolve-service.ts:110-121,171-182`).
- `iconId` used in CSS `url()` is a number by construction server-side (`apps/api-worker/src/chara/xivapi.ts:175-181`).
- CSP `/*` rule intact: `script-src 'self'`, `connect-src 'self' https://*.xivdyetools.app`, `frame-ancestors 'none'`, HSTS preload, XFO DENY (`_headers:31-48`); `/licenses/*` only adds Content-Type.

## REJECTED

- Resolve response not schema-validated on the page: first-party api-worker, names rendered via `textContent`, numeric ids by construction (`xivapi.ts:179`); CSSOM setter cannot escape `background-image`, CSP bounds image origins.
- Unbounded `sessionCache` in `chara-resolve-service.ts:135`: per-tab memory only, one entry per distinct file the user drops; no attacker path.
- DoS via repeated drops: each new load terminates the previous worker (`chara-inspection-service.ts:277,317-319`) and supersedes via generation (`chara-file-loader.ts:79`).
- Swatch "Nothing is uploaded" hint vs telemetry: `analyticsDesc` discloses `.chara imports`; event is outcome + bucket only, opt-in.
- Tribe/gender lock persisted in swatch config: re-file of 2026-10-03 rejected suspicion.
- `boundedLabel` slicing can split a surrogate pair (`chara-library.ts:148`): display-only, no security effect.
- External item-link URLs from API itemId/name: fixed https origins, encoded, `noopener,noreferrer`.

## FILES COVERED

28 files: apps/web-app/src/services (chara-file-loader, chara-inspection-service, chara-inspection-protocol, chara-resolve-service, chara-session-service, telemetry-service [part], config-controller [part]); apps/web-app/src/workers (1); apps/web-app/src/components (chara-file-card, chara-sheet, chara-ui, glamour-block [part], glamour-sheet [grep], glamour-tool [grep], item-links-menu [part], swatch-tool [part], v4/preset-tool [part], v4/preset-detail [part]); apps/web-app/src/shared (glamour-markdown, item-links [grep]); apps/web-app/public (_headers, licenses/xivcharakit.txt); apps/web-app/scripts/copy-chara-notices.mjs; apps/web-app/PRIVACY.md [chara + storage sections]; apps/web-app/src/locales/en.json [grep]; packages/core/src (chara.ts, services/chara/chara-library.ts [part]); apps/api-worker/src/chara/xivapi.ts [iconIdOf].
