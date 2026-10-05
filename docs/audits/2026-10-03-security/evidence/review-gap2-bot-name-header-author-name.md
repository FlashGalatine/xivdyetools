# Review: gap2-bot-name-header-author-name (2026-10-03, commit 0ab33466)

## 1. Entry points and authz (scope-limited)

| Entry | Who | Guards before handler | Body/param caps |
|---|---|---|---|
| presets-api `PATCH /api/v1/presets/refresh-author` (presets.ts:330) | signed bot (BOT_API_SECRET + v2 HMAC + fresh nonce) or web JWT | authMiddleware (auth.ts:247-370) -> requireAuth -> requireUserContext; name must be non-blank (presets.ts:349-351) | no body; **no length/charset rule on auth.userName** |
| presets-api `POST /api/v1/presets` (presets.ts:~950-1029) | same | auth + rate limit + validation-service for name/description/tags; author comes from auth, not body | body validated; author_name unvalidated |
| presets-api preview-image upload (presets.ts:~1240) | author | same | author_name only forwarded to notification |
| Bot -> presets-api `request()` (discord-worker preset-api.ts:78-150, moderation-worker preset-api.ts:60-100) | internal; prod uses PRESETS_API service binding | HMAC v2 signs method, path, body sha256, ts, nonce, id, name | 10 s timeout |

Name flow: Discord interaction (global_name || username, preset.ts:76-81) -> `X-User-Discord-Name` header + v2 canonical string (hmac.ts:~245-291) -> auth.userName (auth.ts:254, 349) -> D1 `presets.author_name` (preset-service.ts:395-410, presets.ts:361). Web: oauth callback.ts:228/235 (global_name || username) and xivauth.ts:344/368 (verified character name) -> JWT claims -> auth.ts:331-339 -> same sink.

## 2. Positive controls
- CJK / non-Latin1 names do NOT throw in workerd and survive the service binding byte-exact (probe below). Both ends hash the same JS string (UTF-8) so v2 HMAC matches (hmac.ts:291 `${f.length}:${f}`, TextEncoder only for body, HMAC input encoded by hmacSignHex).
- v2 canonical is length-prefixed per field (hmac.ts:291), so a name cannot shift into another field; v1 gone.
- Bot path requires BOT_SIGNING_SECRET in prod (auth.ts:277-286) and a fresh nonce (auth.ts:344).
- BUG-014 guard on blank name (presets.ts:349-351); fallback 'Unknown User' (presets.ts:962, 1029).
- Discord renderers all pass author_name through sanitizeEmbedText: preset-notifications.ts:79, preset.ts:241-242, 525, 871, 980, 1083, index.ts:433, moderation-worker preset.ts:198, 558, 694 and ban-reason.ts:109/148 (strips C0/C1, U+200B-200F, 202A-202E, 2060-2064, FEFF, defuses mentions, escapes markdown, caps; packages/bot-logic/src/discord-markdown.ts:22-77).
- Web: Lit text bindings auto-escape (preset-card.ts:342,416; preset-detail.ts:978-981); my-submissions-modal escapeHtml on name (line ~109). No unsafeHTML on author.
- SVG card author goes through filterToRenderableTitle (font-coverage.ts:213) and the svg layer XML-escapes (preset.ts:980-992 comment).

## 3. Rejected
- CJK/Korean/Japanese display name breaks `/preset submit|edit` via ByteString header: REJECTED empirically. workerd 1.20260923.1, compat date 2024-12-01 (same as both wrangler.toml): `Headers.set`, `new Request`, and `env.SVC.fetch` accept U+65E5.., U+D55C.., emoji, and the callee reads identical code points (probe, scripts/gap2/). Production uses the PRESETS_API service binding (discord-worker wrangler.toml:30,140; moderation-worker:29,85). Node's Headers DOES throw for the same value (verified `node -e`), so only a Node/undici-run test or the PRESETS_API_URL fallback `fetch` could differ; existing unit tests mock fetch so they would not notice either way. Not a prod defect (handoff for a test).
- Header CR/LF/NUL in name: workerd throws "Invalid header value" (probe), but Discord does not permit those in display names and /preset would 5xx only for that impossible input. INFO, dropped.
- Leading/trailing spaces in name: header parser trims, canonical string then differs (sender signs " x ", receiver sees "x") -> bot request unauthenticated. Discord trims display names; dropped.
- Moderation-worker request builder: identical code to discord-worker (preset-api.ts:78-83, 96+); same verdict. Moderators' userName is username, which is ASCII-ish anyway.
- username-vs-display-name wording: out of scope per brief.

## 4. Files covered
apps/discord-worker/src/services/preset-api.ts (70-175, 500-520); apps/discord-worker/src/handlers/commands/preset.ts (60-95, 975-1010); apps/discord-worker/src/handlers/commands/preset-notifications.ts (70-90); apps/discord-worker/src/index.ts (320-350, 425-445); apps/discord-worker/src/utils/sanitize.ts (50-80); apps/discord-worker/src/services/font-coverage.ts (205-240); apps/moderation-worker/src/services/preset-api.ts (60-100, 450-475); apps/moderation-worker/src/utils/embed-text.ts; moderation-worker grep of all author/user name sinks (ban-service.ts, handlers/*); apps/presets-api/src/middleware/auth.ts (235-375); apps/presets-api/src/handlers/presets.ts (322-375, 800-815, 945-1040, 1230-1255); apps/presets-api/src/services/validation-service.ts (55-130); apps/oauth/src/handlers/xivauth.ts (325-385), callback.ts (grep 200-250); packages/auth/src/hmac.ts (225-340); packages/bot-logic/src/discord-markdown.ts; apps/web-app/src/components/v4/preset-card.ts, preset-detail.ts, my-submissions-modal.ts (excerpts), services/language-service.ts:184.
Probe: docs/audits/2026-10-03-security/evidence/scripts/gap2/{probe.capnp,caller.js,callee.js} (run with the repo's workerd binary `workerd serve probe.capnp --experimental`, port 18787, loopback only; stopped afterwards).

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-AUTH | apps/presets-api/src/handlers/presets.ts:354-364 (also 962, 1029; preset-service.ts:395-410) | `author_name` (from auth.userName, i.e. Discord global_name/username or XIVAuth character name) is written to D1 with no length cap and no control/zero-width/bidi check, while name/description/tags get all three (validation-service.ts:62-123). Confirmed. Weaker than presets-api#c5 because the value is IdP-supplied, not free text: Discord limits display names to 32 chars and the bot/JWT paths are signed, so the reachable payload is whatever Discord/XIVAuth permits. Residual risk is bidi isolates U+2066-2069 (not stripped by sanitizeEmbedText, discord-markdown.ts:22-25) and unfiltered rendering on web (below). |

Unsanitized sinks (all plain text, no injection): web Lit templates preset-card.ts:342/416 and preset-detail.ts:978-981 (escaped, but no bidi/invisible strip, so an RLO/isolate name could reorder the rest of the byline "· 5 dyes · 2d ago"); discord-worker autocomplete preset-api.ts:510-513 and moderation-worker preset-api.ts:465-470 + moderation index.ts:479-514 (choice names are literal text, length clamped; discord-worker one uses `.slice(0,100)`, which can cut a surrogate pair); public GET /presets JSON (consumers get the raw value). Fix suggestion if pursued: apply the validation-service character rule (and a 64-code-point cap) to auth.userName once in authMiddleware or at the three write sites; do not reject, normalize to 'Unknown User'.

## 6. Handoffs
- Plain bug: web-app language-service.ts:184-189 `tInterpolate` passes the value as a `String.replace` replacement string, so an author named `A$&B` or `$$` renders mangled (`$` patterns). Use a function replacer.
- Test gap: no vitest-pool-workers/workerd test of a CJK userName through `request()`; unit tests mock fetch and run on Node where Headers rejects >U+00FF.
- Plain bug: discord-worker preset-api.ts:510-513 `.slice(0, 100)` is UTF-16 based; moderation-worker uses code-point `clampChoiceName` (embed-text.ts). Align.
- Hardening: add U+2066-2069 to INVISIBLE in packages/bot-logic/src/discord-markdown.ts:22.
