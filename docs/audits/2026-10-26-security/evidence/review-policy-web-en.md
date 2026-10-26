# Review: policy-web-en (deploy unit: web-app (policy))

Scope: `apps/web-app/PRIVACY.md` (279 lines) and `apps/web-app/TERMS_OF_SERVICE.md` (177 lines), read in full,
against web-app, api-worker, og-worker, oauth, presets-api and image-worker code at HEAD 13c386e5, plus the
in-product privacy strings in `apps/web-app/src/locales/en.json` and the xivcharakit license-notice surfaces.
Reviewer: Sonnet-tier worker. Findings are leads for the coordinator's verifiers.

## Claim matrix (policy statement -> code)

| Policy line | Claim | Code checked | Result |
|---|---|---|---|
| PRIVACY 10-12 | "the sections below are the complete list" | evidence/outbound-fetch.txt web-app rows: auth-service 427/544/796, chara-resolve-service 189, community-preset-service 269, preset-submission-service 235-563, telemetry-service 233, world-service/config-sidebar (same-origin /json) | Holds; every outbound web-app call maps to Network items 1-5 |
| PRIVACY 31-35 | character name never sent; community name field starts empty | glamour-block.ts:1805-1807 (`communityPaletteName` = typed draft only) | Holds |
| PRIVACY 36-40 | untyped glamour/palette save falls back to nickname -> file name; "Rename or delete the record" | glamour-block.ts:1816-1824; chara-sheet.ts:191-233 (Swatch save, no typed name at all); collection-manager-modal.ts:198/460 only rename/delete | **Candidates 01, 02** |
| PRIVACY 41-46 | resolve request carries model numbers + facewear id, "a dozen small integers" | chara-resolve-service.ts:182-194; core chara-models.ts:24-32; chara-parser.ts:88-100 (12 slots); api-worker chara/router.ts:89 | Holds in kind; count understated (**Candidate 05**) |
| PRIVACY 43-45 | XIVAPI "is sent the numbers and nothing about you" | api-worker chara/xivapi.ts:378-387 (fixed Accept + User-Agent, redirect manual) | Holds |
| PRIVACY 50-65 | localStorage inventory + UI controls | en.json:222-234 (Advanced Settings, Reset Settings, Clear Favorites, Clear Saved Palettes, Enable Analytics), :157, :858, :1249, :1389, :1404; acquisition-edits.ts:28; auth-service.ts:103-122 | Holds |
| PRIVACY 67-70 | IndexedDB holds only the price cache | indexeddb-service.ts:22-24 (3 stores), only `PRICE_CACHE` written (api-service-wrapper.ts:128) | Holds |
| PRIVACY 74-75 | first-party hosts; "the site's CSP allows nothing else" | public/_headers CSP `connect-src 'self' https://*.xivdyetools.app` | Wildcard broader than the named hosts (**Candidate 06**) |
| PRIVACY 82 | "browsing sends nothing about you" | preset-detail.ts:621,686-695 -> community-preset-service.ts:540-548 (GET /votes/:id/check with Authorization when signed in) | **Candidate 04** |
| PRIVACY 83-92 | account record fields | oauth schema/users.sql; callback.ts:242 (`global_name || username`) | Holds |
| PRIVACY 100-103 | Perspective, `doNotStore` | presets-api moderation-service.ts:255; DEPRECATIONS.md:10-67 | Holds today; sunset tracked (see Candidate 09 for ToS) |
| PRIVACY 105-106 | avatars from Discord CDN | auth-service.ts:879; CSP img-src cdn.discordapp.com | Holds |
| PRIVACY 117-133 | "Open in..." and dye-card hosts | shared/item-links.ts:70-120; v4/result-card.ts:180-183 | Holds |
| PRIVACY 143-177 | retention 30 d / 30-90 d / 90 d / 12 months | rate-limit-service.ts:146; notification-service.ts:198,205; moderation-retention-service.ts:22,31 | Holds |
| PRIVACY 182-217 | telemetry events / dimensions | api-worker telemetry/schema.ts:52-56, 96-122; chara-file-loader.ts:109,124-125 | Holds (five events, producer allowlist) |
| PRIVACY 224-229 | 60 s window; KV fallback 120 s | worker-kit kv.ts:64,218 (ttl = 60 + 60); api-worker rate-limit.ts:31; oauth rate-limit.ts:79-81 | Holds |
| PRIVACY 232-236 | Workers Logs off on every worker | every `apps/*/wrangler.toml` `[observability] enabled = false`; web-app functions/_middleware.ts has no console call | Holds |
| ToS 15-18 | ten tools | router-service.ts:84 + ToolId list | Holds |
| ToS 29-31 | "With Discord, the name is your display name" | oauth callback.ts:242 | Omits username fallback (**Candidate 08**) |
| ToS 60-63 | clean submission "published straight away" | DEPRECATIONS.md:31-39, 53-63 | Dated (**Candidate 09**) |
| ToS 73-75 | appeal must include "your Discord user ID" | PRIVACY 266-267 accepts author name; XIVAuth-only accounts have no Discord id | **Candidate 07** |
| en.json:1009 | "No account, no rate limit." | presets-api index.ts:162 + middleware/rate-limit.ts:54,133-140 (100/min per IP on all /api/*) | **Candidate 03** |
| en.json:1166-1167 | charaHint / charaHintGlamour | chara-file-card.ts:107-109,300-303; glamour-tool.ts:90 | Holds |
| en.json:1403 | glamour list never holds the name | shared/acquisition-edits.ts:28; glamour-markdown has no nickname | Holds |
| en.json:32 (about) | xivcharakit license link | about-modal.ts:80,500-523; public/licenses/xivcharakit.txt (MIT, verbatim); _headers `/licenses/*` charset | Holds |

## Candidates

- **policy-web-en-01 (LOW, INTERNET-UNAUTH)** Swatch Matcher "Save character colors" names its local
  `kind: 'character'` record `nickname.trim() || fileName || default` on every save (chara-sheet.ts:208-215,
  wired at swatch-tool.ts:1385); there is no name field. PRIVACY.md:36-40 presents the nickname fallback as
  an exception for a glamour or palette saved "without typing a name", and PRIVACY.md:61-62 mentions saved
  character colors without saying their name is the character's nickname. Resolution: fix code (default
  name) or AMEND. Variants: PRIVACY.md, .ja, .de, .fr, .ko, .zh.
- **policy-web-en-02 (LOW, INTERNET-UNAUTH)** PRIVACY.md:39-40 says "Rename or delete the record". The only
  rename/delete code is collection-manager-modal.ts:198 / :460, opened only from dye-selector.ts:565, whose
  v4 host panel is cleared or skipped (mixer-tool.ts:624-631, harmony-tool.ts:1122-1124). PRIVACY.md:59-62
  itself says there is no single-palette delete and no delete for Swatch character colors. CORRECT, 6 variants.
- **policy-web-en-03 (LOW, INTERNET-UNAUTH)** signin-modal.ts:40 shows `preset.gateBrowseNote` "No account,
  no rate limit." (en.json:1009); presets-api applies a 100/min per-IP limit to every `/api/*` request,
  browse included (index.ts:162). CORRECT in en/ja/de/fr/ko/zh.json line 1009.
- **policy-web-en-04 (INFO)** PRIVACY.md:82 "browsing sends nothing about you"; a signed-in viewer sends
  the JWT on each preset-detail open (preset-detail.ts:621,686-695; community-preset-service.ts:540-548).
  Nothing is stored (votes.ts:232 has no log). AMEND, 6 variants.
- **policy-web-en-05 (INFO)** PRIVACY.md:43 "a dozen small integers per file": 12 gear slots carry base +
  variant (+ set on weapons) plus slot names and a glasses id, up to about 27 integers. CORRECT, 6 variants.
- **policy-web-en-06 (INFO)** PRIVACY.md:74-75 "the site's Content-Security-Policy allows nothing else";
  `connect-src` is `https://*.xivdyetools.app`, wider than the named hosts (all first-party). CORRECT, 6 variants.
- **policy-web-en-07 (INFO)** TERMS_OF_SERVICE.md:75 requires a Discord user ID for an appeal; an
  XIVAuth-only account has none, and PRIVACY.md:266-267 accepts the author name. CORRECT, ToS x6.
- **policy-web-en-08 (INFO)** TERMS_OF_SERVICE.md:29-30 "With Discord, the name is your display name";
  oauth callback.ts:242 stores `global_name || username` (PRIVACY.md:85-86 says so). CORRECT, ToS x6.
- **policy-web-en-09 (INFO)** DEPRECATIONS.md:59-63 schedules the policy edits for the Perspective key
  deletion, but names only the two privacy policies. TERMS_OF_SERVICE.md:60-61 ("A submission that clears
  them is published straight away") then describes no reachable path, since every new or edited preset is
  `unscored` -> pending (DEPRECATIONS.md:33-39). Add the ToS x6 to the checklist.

## Positive controls

- The web resolve body is integer-only, out-of-range lanes are dropped client-side, and it is cached per
  session (chara-resolve-service.ts:163-194). The api-worker per-key caches hold only model keys and game
  version (chara/cache.ts:20-52), never a request identity.
- XIVAPI requests carry fixed headers and refuse redirects (xivapi.ts:378-387).
- The .chara inspection runs in a same-origin module worker. Nickname and file name stay on the page and are
  never logged (chara-file-loader.ts:127-129; chara-sheet.ts:231). Telemetry carries only `ok` + an
  allowlisted producer bucket.
- The community submission name is never pre-filled from the file (glamour-block.ts:1798-1807).
- Every retention constant the policy publishes matches code; all worker wrangler.toml files pin observability off.
- The xivcharakit MIT notice is served verbatim at /licenses/xivcharakit.txt with a UTF-8 charset rule and
  linked from About (about-modal.ts:500-523).
- The UI paths the policy names all exist in en.json.

## Rejected

- Last updated 2026-10-12 stale: since then only the web-app .chara path changed (Web Worker on device, 8 KiB
  cap, license link) and api-worker chara caching changed; there are no commits in presets-api, oauth, og-worker,
  image-worker or moderation-worker src. No described data flow changed.
- /v1/chara/resolve caches hold personal data: the keys are slot/model keys + upstream context only (cache.ts:43-52).
- New telemetry field from the chara reader: the schema still has five events (schema.ts:96-122).
- IndexedDB holds more than prices: `palettes`/`settings` stores are created but never written (only PRICE_CACHE).
- Collection manager makes the "no delete control" lines false: it is unreachable in v4 (see Candidate 02).
- Swatch share links carry race/gender: these are tool parameters of a game character, not personal data.
- og-worker sees human page loads on /<tool>/*: it acts on the URL only. Its crawler counter is a prior rejection (2026-10-03).
- Third-party license notice missing from ToS: the notice is served in-app; "the site's own code ... are ours" is not false.
- IP section omits oauth/presets-api limiters: "Our API" wording; both use the native binding, and the fallbacks are KV 120 s / memory.

## Files covered

Count: 46 files opened or grepped at line level.
Directories: apps/web-app (PRIVACY.md, TERMS_OF_SERVICE.md, public/_headers, public/licenses, functions/,
src/components, src/components/v4, src/services, src/shared, src/locales), apps/api-worker/src/chara,
apps/api-worker/src/telemetry, apps/api-worker/src/middleware, apps/oauth/src/handlers, apps/oauth/src/services,
apps/oauth/schema, apps/presets-api/src (index, middleware, services, handlers/votes), apps/og-worker/wrangler.toml,
apps/*/wrangler.toml (observability), packages/worker-kit/src/rate-limiter/backends, packages/core/src/services/chara,
DEPRECATIONS.md.

Not covered: translated variants (only listed for edits); moderation-channel post content (PRIVACY 147-159)
vs discord-/moderation-worker; previous-version snapshot wording (PRIVACY 95-98); deletion cascade (PRIVACY 252-255).
