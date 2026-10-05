# Review: injection-classes (2026-10-03, commit 0ab33466)

Scope: cross-cutting by class: (a) markup / mention / header / export injection, (b) ReDoS, (c) prototype pollution, (d) resource exhaustion. Read-only; one probe script written (scripts/injection-classes/redos-oneline.mjs). Per-unit route/authz detail for og-worker, api-worker and the secrets/stoat units lives in the sibling review-*.md files; this file tabulates the sinks of each class.

## 1. Entry points (by sink class) and authz matrix

| Sink / entry | Who can reach it | Guards before it | Caps |
|---|---|---|---|
| web-app innerHTML templates (components/*, ~60 sites) | any visitor / signed-in user | per site: only static SVG constants, t() locale strings, numbers, or escapeHtml()ed remote text | n/a |
| web-app Lit unsafeHTML (v4/dye-palette-drawer.ts:999-1015, v4/preset-card.ts:424-432, v4/preset-detail.ts:943-950) | same | only SVG constants; getCategoryIcon(name) is an own-property lookup (shared/category-icons.ts:44-47) | n/a |
| Pages function functions/_middleware.ts | anonymous | domain redirect + /assets/ HTML->404 | none, emits no user text |
| public/_headers CSP/HSTS/XFO/nosniff | every response | script-src 'self', connect-src 'self' https://*.xivdyetools.app, frame-ancestors 'none' (_headers:34) | n/a |
| Discord outbound REST (discord-worker utils/discord-api.ts: sendFollowUp 76-96, file variant 99-152, editOriginalResponse 160-184, sendMessage/editMessage 330-400) | any Discord user via signed interaction | Ed25519 verify, then allowed_mentions default {parse:[]} on every body (discord-api.ts:84,108,173,196,358,392) | embed text capped by sanitizeEmbedText (default 256) |
| Discord initial interaction responses (discord-worker utils/response.ts:80-86 messageResponse, 100-112 ephemeralResponse) | any Discord user | same verify; NO allowed_mentions default | see c2 |
| moderation-worker outbound (utils/discord-api.ts:28-29 baseBody, utils/response.ts:92-95 withAllowedMentions, :329) | moderators only (MODERATOR_IDS allowlist on commands, buttons, modals, autocomplete) | verify + allowlist | reasons capped 1024 (utils/embed-text.ts) |
| presets-api POST/PUT preset (validation-service.ts:20-48,156-300) | signed-in web user, or bot via BOT_API_SECRET | bodySizeLimit 100 KB + jsonDepthLimit 10 + __proto__/constructor/prototype key reject (worker-kit body-guards/structure.ts:17-47) | name 2-50, description 10-200, dyes 3-6 ints 1-254, tags <=10 x <=30 charset-restricted, secondary categories <=2, example_link https + 11-host allowlist <=300 |
| presets-api GET list (handlers/presets.ts:226-247) | anonymous | page>=1, limit 1-50, escapeLikePattern(search) (preset-service.ts:253) | URL length |
| .chara ingestion: web-app chara-file-loader.ts:44-47 (size cap), discord-worker utils/chara-attachment.ts:19-28,79-107 (1 MiB streamed cap, Discord-CDN host allowlist, redirect manual) | any user (own file) | cap, then core parseCharaFile | own-property map lookups (chara-parser.ts:299,319) |
| Download / export (web-app shared/download-file.ts, glamour-markdown.ts, collection-manager-modal.ts:515-535, export-sheet.ts:60) | local user only | filenames constant or [^a-z0-9] -> '-' | n/a |

## 2. Positive controls

- Mentions: discord-worker defaults allowed_mentions on all REST body builders (utils/discord-api.ts:26-31 helper; lines 84, 108, 173, 196, 358, 392); moderation-worker baseBody (utils/discord-api.ts:28-29) and withAllowedMentions (utils/response.ts:92-95, 329). ALLOWED_MENTIONS_NONE is { parse: [] } (packages/bot-logic/src/discord-markdown.ts:76). No regression of 2026-08-29 FINDING-019.
- User text into embeds goes through sanitizeEmbedText (bot-logic discord-markdown.ts:59-72: strips control/zero-width/bidi, collapses whitespace so no line-start markup, defuses @everyone/@here/<@..>, escapes markdown and masked links, caps length). Callers verified: discord-worker index.ts:322-445 (safeName/safeDescription/safeAuthor/safeTags), preset.ts:238,524.
- Preset text is also restricted at the source: control + invisible chars rejected (validation-service.ts:60-111), tags limited to letters/digits/space/_'-’ (TAG_PATTERN :132), example link host allowlist (:364-405) re-checked on the read path (web-app shared/example-link.ts sanitizeExampleLink, https-only + allowlist) before it becomes an href (v4/preset-detail.ts:987-996).
- web-app: remote strings that reach template innerHTML are escaped: my-submissions-modal.ts:103-118 (name, rejection note via escapeHtml, shared/utils.ts:~25), empty-state.ts:222-236 (title/description escaped; dye-grid.ts:90-100 passes the typed search query through it; icon must start with <svg). Everything else interpolated into innerHTML templates is a static SVG, t() string, number, or dye-DB hex (checked budget-tool 1067/1406, mixer-tool 1493, gradient-tool 1167, v4-layout 567/739, signin-modal 35, market-board 355, shortcuts-panel 126). Chara nickname / file name render via textContent (components/chara-ui.ts:77-82 el()). No document.write, insertAdjacentHTML, outerHTML, srcdoc, or postMessage / message listeners in web-app src (grep).
- SVG: all text goes through escapeXml (packages/svg/src/base.ts:27-36 drops XML-illegal chars then escapes & < > " '); text() base.ts:171-190 escapes content and fill/fontFamily; rect/circle/line escape fills. No unescaped <text>${..} found in packages/svg/src (grep).
- Headers: the only Content-Disposition is constant "inline" (api-worker chara/router.ts:335); no user value reaches .header()/headers.set (grep). Redirect targets are env constants (og-worker) or allowlisted + validated (oauth-flow.ts:60-75, 270-303).
- CSV: no CSV export exists (grep). Markdown export (shared/glamour-markdown.ts:107-146) is local download / clipboard only, labels fixed, values are item/dye names plus the player's own acquisition edit; the HTML flavour escapes every value (:131-146). Filename constant glamour-equipment.md (:73).
- Prototype pollution: server bodies pass validateStructure rejecting __proto__/constructor/prototype own keys at any depth (worker-kit body-guards/structure.ts:17-47, wired in presets-api middleware/body-validation.ts:75-80). .chara tribe/gender/race lookups use Object.hasOwn (chara-parser.ts:299,319; FINDING-027), css-colors.ts:175, harmony.ts:144, api-worker validation.ts:403. Web import paths whitelist fields: settings import -> sanitizeConfigPartial per declared key (services/config-controller.ts:409-420); collection import copies named fields only (services/collection-service.ts:903-975).
- ReDoS: no nested-quantifier / alternation-in-repetition regex on user input found in apps/ or packages/ src except c1. Profanity filter is one escaped flat alternation compiled once (presets-api moderation-service.ts:74-90). Logger redaction rules (packages/logger/src/core/base-logger.ts:640-715) are linear. Tag regex runs only after the 30-char cap (validation-service.ts:244-251).
- Exhaustion: presets-api body 100 KB / depth 10; list limit <=50; chara download 1 MiB streamed; GitHub webhook streamed byte cap (discord-worker index.ts:530-546); web share-link dye lists consumed with a hard 4-dye break (comparison-tool.ts:2476-2483, accessibility-tool.ts:1972-1979) and extractor capped at 5 (share-service.ts:183-187); api-worker/og-worker loops bounded by the 125-dye DB and explicit caps (sibling reviews). Autocomplete choice names sliced to Discord's 100-char limit (discord-worker services/preset-api.ts:508-513).

## 3. Rejected items

- ShareService.parseUrl params[key] = ... with key __proto__ (share-service.ts:482-516): only re-prototypes a local object literal (no global pollution); consumers read fixed keys; self-link only.
- Bare URLs survive sanitizeEmbedText in embed descriptions (discord-markdown.ts:57-72): the URL is shown verbatim (no masked text), authors are rate-limited and moderated; the 2026-08 fix was masked links and that holds.
- <#channel> / </cmd:id> pseudo-mentions in embed text are not defused: render as link text only, embeds never ping.
- discord-worker copy.ts:44-109 interpolates custom_id into message content: ids are bot-built, only a signed interaction carries one, response is ephemeral.
- Collection / settings import loops (collection-service.ts:903-975): O(n^2) on a hand-edited local file only (self-DoS), no cross-user vector.
- chara-file-loader.ts:90 logs file.name via the browser logger: console only, no remote sink.
- presets-api search: user wildcards escaped (escapeLikePattern), pattern bounded by URL length; no LIKE blowup.
- /^\s*\d+\s*$/ (bot-logic input-resolution.ts:40,50; budget.ts:199): anchored, linear.
- sendFollowUp / sendMessage attachment file.name: constants built from DB dye names / steps / types (dye.ts:232, gradient.ts:217, harmony.ts:203), no user-typed value.
- Web window.location.assign('/presets/community-'+id) (my-submissions-modal.ts:187): path-only prefix, id from API.
- CSP connect-src https://*.xivdyetools.app and img-src cdn.discordapp.com: first-party / needed; not an injection finding.

## 4. Files covered

apps/web-app: functions/_middleware.ts; public/_headers, _redirects; src/shared/{utils.ts, category-icons.ts, example-link.ts, glamour-markdown.ts, download-file.ts}; src/components/{my-submissions-modal, empty-state, dye-grid(85-190), v4-layout(555-577,735-745), budget-tool(1067,1406), mixer-tool(1493), gradient-tool(1167), signin-modal, accessibility-tool(1018-1034,1965-1990), comparison-tool(1051-1064,2465-2500), chara-file-card(255-290), chara-sheet(158-175), chara-ui, glamour-block(1700-1730), modal-container(436-445), tutorial-spotlight(355-370), advanced-options-panel(290-340), v4/preset-detail(980-1062)}.ts; src/services/{share-service(440-525), collection-service(880-1010), config-controller(36-110,405-430), chara-file-loader, auth-service(205-262,545-575)}.ts.
apps/discord-worker: src/utils/{discord-api, response, chara-attachment}.ts; handlers/buttons/copy.ts; index.ts(320-335,425-445,525-560); services/{announcements(85-110), preset-api(40-60,495-530)}; handlers/commands/{preset(455-490,795-815), manual(360-380)} (partial).
apps/moderation-worker: src/utils/{discord-api, response (partial)}.ts; handlers/buttons/{ban-confirmation, preset-moderation}.ts; handlers/modals/preset-rejection.ts (response bodies); index.ts autocomplete paths.
apps/presets-api: src/services/{validation-service, moderation-service(60-160)}.ts; middleware/body-validation.ts; handlers/presets.ts(226-250); services/preset-service.ts (search).
apps/oauth: handlers/oauth-flow.ts(30-80,270-305). og-worker, api-worker: sibling review files read; sources not re-read.
packages: core/src/services/chara/{chara-parser (255-514), chara-gposers (85-130)}.ts; bot-logic/src/discord-markdown.ts; svg/src/base.ts (+ grep of all generators); logger/src/core/base-logger.ts(625-730); worker-kit/src/body-guards/structure.ts.
Evidence: html-sinks.txt, outbound-fetch.txt, review-og-worker.md, review-api-worker-public.md, review-api-worker-chara-universalis-telemetry.md. Probe: evidence/scripts/injection-classes/redos-oneline.mjs (5k/10k/20k/40k spaces -> 24/100/429/1629 ms).

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | LOCAL | packages/core/src/services/chara/chara-gposers.ts:101 | text() uses /\s*[\r\n]+\s*/g; \s also matches CR/LF, so a whitespace run with no newline is O(N^2) (40k spaces = 1.6 s, probe). Reached from the player's own acquisition edit (glamour-sheet.ts:276,317; no maxlength, persisted by AcquisitionEdits), so one oversized paste freezes the tab on every later export open. Self-inflicted, no cross-user vector. Fix: collapse with /[\r\n]+/g then trim, or cap the field. |
| c2 | INFO | INTERNET-AUTH | apps/discord-worker/src/utils/response.ts:80-86 | messageResponse / ephemeralResponse build type-4 interaction responses without the allowed_mentions default that every REST helper in discord-api.ts carries. No user-sourced text reaches initial-response content today (copy.ts:44-109 uses bot-built custom_id and is ephemeral; the rest are t() strings and embeds, which never ping), so not exploitable. Defense in depth: spread ALLOWED_MENTIONS_NONE like moderation-worker response.ts:92-95. |

Evidence c1 (chara-gposers.ts:100-102): `function text(value) { return value?.replace(/\s*[\r\n]+\s*/g, ' ').trim() ?? ''; }`. Evidence c2 (response.ts:80-86): `return Response.json({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data, });`.

Policy: neither touches a policy document (policy NONE, reconcile_case 0).

## 6. Handoffs

- Documentation: discord-worker CHANGELOG / CLAUDE.md FINDING-019 wording ("every outbound payload in utils/discord-api.ts") is accurate but silent on the initial-response path (c2); one clause would stop a reader assuming universal coverage.
- stoat-worker (parked): parser.ts:100 `rest.split(/\s+/)` and dye-resolver edit distance run on unbounded user text; owned by the stoat unit review.
- c1 is also a plain performance bug (quadratic regex) independent of the security framing.
