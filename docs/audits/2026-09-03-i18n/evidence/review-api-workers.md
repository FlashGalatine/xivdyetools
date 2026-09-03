# i18n review — `apps/presets-api`, `apps/api-worker`, `apps/oauth`, `apps/image-worker`

**Reviewer date:** 2026-09-03 · **Worktree HEAD:** `32e08207` (2026-09-01T22:44:34-04:00, branch `i18n-audit-2026-09-03`)
**Scope:** every response path that can reach a human (HTML, redirects, `text/plain`, JSON `error`/`message` fields), `?lang=`/`Accept-Language` handling, the `.chara` ko/zh build tables, oauth's user-facing surface, the VitePress docs/product boundary, and a hardcoded-sentence sweep across all four workers.
**Method:** read-only. No pnpm/vitest/build run by me (another process owns the gates). Reachability claims are verified by reading the actual consumer code (mostly `apps/web-app`, and `apps/discord-worker` for image-worker's `/extract`) — not assumed — since "is anything shown to a user" cannot be answered from the server side alone. `git ls-files` used for all searches (no plain `grep -r`).
**Prior audit:** none of these four workers has been i18n-audited before (per brief). No baseline to diff against.

---

## 1. Surface table — what reaches a human's eyes

| worker | route | surface | localized? |
|---|---|---|---|
| presets-api | `/`, `/health` | JSON health check | N/A (never rendered) |
| presets-api | `POST/PATCH/DELETE /api/v1/presets/*` | JSON `{error: CODE, message: EN sentence}` | `message` is EN-only; **web-app renders it verbatim as toast "details" when the failure isn't one of the ~10 rules it pre-validates client-side — see cand-presets-01/02** |
| presets-api | `POST/DELETE /api/v1/votes/*` | JSON `{error, message}` | `message` never reaches the UI (web-app's vote toast passes only its own mapped `errorCode`, no `details` argument — verified `preset-detail.ts:788`, `preset-tool.ts:771`) |
| presets-api | `/api/v1/categories*` | JSON `{name, description}` from D1 | Unused by web-app (client renders its own slug→locale-key map, `shared/preset-i18n.ts:68-88`); not a finding |
| presets-api | `/api/v1/moderation/*` | JSON, `requireModerator`-gated | Bot-only (moderation-worker/discord-worker); web-app has zero references to this path (`grep` empty) — excluded per "Do NOT file" |
| api-worker | `GET /v1/dyes*`, `GET /v1/match/*` | JSON `{name, localizedName?}` | **Correct design**: stable EN `name` + optional `localizedName` when `?locale=` ≠ en, all 6 locales, fully documented — see §2 |
| api-worker | `POST /v1/chara/resolve`, `GET /v1/chara/icon/:id` | JSON names ×6 / PNG | ko/zh from build-time tables, EN fallback on miss; consuming UI (`chara-import.ts`) never shows raw error text, only a localized `namesUnavailable` string on any failure — see §3 |
| api-worker | `POST /v1/telemetry` | bare `204`/`400`/`413`, `sendBeacon` caller | Never read by the client (`sendBeacon` can't read responses) — not a human surface |
| api-worker | `/universalis/*`, `/api/v2/*` | raw upstream JSON, bare `{error}` | web-app's `world-service.ts`/`market-board.ts` only log these and show a fully-localized generic toast (`marketBoard.refreshError`) — never raw text |
| api-worker | `developers.xivdyetools.app/*` | VitePress static HTML | EN-only by design — explicitly out of scope per brief; verified no product-code coupling, see §5 |
| oauth | `/auth/discord`, `/auth/xivauth` | `302` redirect to Discord/XIVAuth, or JSON 400 on bad params | Redirect carries no visible body; JSON 400s are pre-login param errors a UI never triggers under normal use |
| oauth | `/auth/callback` (GET), `/auth/xivauth/callback` (GET) | `302` redirect back to the frontend (`?error=` querystring) or JSON 400 | The `?error=` value is read by web-app's `auth-service.ts:245` **only to call `logger.error`** — never shown to the user (confirmed, see §4) |
| oauth | `/auth/callback` (POST), `/auth/xivauth/callback` (POST) | JSON `{success, error?}` | web-app reads `.error` **only for `logger.error`**; on any failure the function just `return`s — no toast, no UI text in any language (see §4) |
| oauth | `GET /auth/me` | JSON | **Never called by web-app** (`grep` empty) — JWT is decoded client-side instead |
| oauth | `POST /auth/revoke` | JSON | web-app's `logout()` fires the request and **discards the response entirely**, `catch { /* ignore */ }` (`auth-service.ts:719-727`) |
| oauth | `/`, `/health`, 404, 500 | JSON | Never rendered |
| image-worker | `POST /extract` | JSON `{error}` (service-binding only) | discord-worker substring-matches 5 markers and maps to `t.t('matchImage.*')`; **any unmatched reason still falls back to a translated generic string** (`t.t('matchImage.processingFailed')`), never raw EN — verified end-to-end, see §6 |
| image-worker | `POST /thumbnail` | JSON `{error}` (service-binding only) | presets-api discards the raw text and throws its own `'Image could not be processed'`; web-app shows only `LanguageService.t('preset.previewImageFailed')` — raw text never reaches this far |
| image-worker | `/health` | JSON | Never rendered |

**Verdict: only presets-api has a real, reachable, unlocalized surface** (cand-presets-01/02). oauth and image-worker render nothing raw to a human in any path I could find a live consumer for; api-worker's JSON `message` fields are developer-facing REST diagnostics (properly coded, documented) that no client I traced ever displays verbatim.

---

## 2. `Accept-Language` / `?lang=` handling

### presets-api
No locale parameter anywhere (`git ls-files 'apps/presets-api/src/**/*.ts' | grep -v test | xargs grep -n "Accept-Language\|locale\|?lang="` → no matches outside test/profanity-data files). Not a defect: every user-visible string presets-api could produce is either data the client already localizes itself (category slugs) or a diagnostic `message` the client is expected to map by `error` code (§1) — the "Do NOT file" pattern from the brief.

### api-worker — **positive control, fully correct**
`src/middleware/locale.ts` reads `?locale=` once per request via `parseLocale()` (`lib/validation.ts:301-310`), validates against `VALID_LOCALES = ['en','ja','de','fr','ko','zh']` (`lib/validation.ts:23`), calls `LocalizationService.ensureLocaleLoaded(locale)` (race-free — does **not** mutate the singleton's current locale, BUG-006 from the 2026-07-18 audit), and stashes it at `c.set('locale', locale)`.

Every one of the 7 dye endpoints and both match endpoints reads `c.get('locale')` and passes it to `localizedNameFor(dye, locale)` (`lib/dye-serializer.ts:78-81`), which returns `undefined` for `locale === 'en'` (canonical name is already on `Dye.name`) and otherwise calls `LocalizationService.getDyeName(dye.itemID, locale)`. Verified wired at every call site:
```
$ grep -n "localizedNameFor" apps/api-worker/src/routes/dyes.ts apps/api-worker/src/routes/match.ts
dyes.ts:71,121,200,261,335 — search, batch, stain/:id, /:id, list
match.ts:70,123 — closest, within-distance
```
`ApiDye.localizedName` is `string | undefined`, spread in only when present (`dye-serializer.ts:33-39`) — this is exactly the brief's "stable English identifiers plus a separate localized-name field" pattern, i.e. **correct design, not a finding.**

Documented in the VitePress docs (`apps/api-worker/docs/`), not just implemented:
```
$ grep -n locale apps/api-worker/docs/reference/dyes.md apps/api-worker/docs/reference/matching.md apps/api-worker/docs/index.md
dyes.md:15    | `localizedName` | string? | Present only when `locale` ≠ `en` |
dyes.md:57,66,81,87,102,108,116,125,131,171,178  — every endpoint's params table + example carries the 6-locale enum
matching.md:35,55,99,110 — both match endpoints, same enum
index.md:26   Dye names available in English, Japanese, German, French, Korean, and Chinese via the `locale` query parameter.
```
All 6 locales, all locale-bearing endpoints documented. **No finding.** (The Universalis proxy mounts and `/v1/telemetry` are explicitly, correctly locale-blind — `docs/reference/universalis.md:6` says so directly.)

### oauth
Zero locale plumbing (`grep -rn "Accept-Language\|lang=\|locale\|i18n\|translat" apps/oauth/src/` → no matches). Not a defect — see §4: nothing this worker renders is user-visible text, so there is nothing to localize here. (The actual sign-in/consent copy that IS user-visible lives in `apps/web-app`, out of this unit's scope, and is fully localized — see §4.)

### image-worker
Zero locale plumbing, and correctly so — service-binding only, its only "consumer-facing" text is the `error` string contract with discord-worker's substring matcher (§6), which is inherently English (a matching key, not display text).

---

## 3. `POST /v1/chara/resolve` ko/zh build tables

`apps/api-worker/src/chara/data/item-names.meta.json`:
```json
{
  "generated": "2026-08-21",
  "equippable": 28993,
  "counts": {
    "ko": { "named": 28986, "missing": 7 },
    "zh": { "named": 28992, "missing": 1 }
  }
}
```
Verified against the actual JSON files (python, since these are large CJK tables):
```
$ python3 -c "import json; ko=json.load(open('.../item-names.ko.json',encoding='utf-8')); zh=json.load(open('.../item-names.zh.json',encoding='utf-8')); print(len(ko), len(zh))"
28986 28992
```
Coverage: ko 99.98% (28986/28993), zh 99.997% (28992/28993) of the full equippable-item set — the same set en/ja/de/fr draw from live (XIVAPI always answers those 4 in full; only ko/zh are static tables, per `regional-names.ts`'s header comment: "XIVAPI v2 serves the global client only (en/ja/de/fr)").

**Table is current for the active patch.** Generated 2026-08-21, same day as the CHANGELOG's `[0.8.0] - 2026-08-21` entry; nothing in `apps/api-worker/CHANGELOG.md` after that date touches chara/equipment data, and no evidence anywhere in the repo of a game patch after Patch 7.5 (the consolidation patch, active since 2026-04-28, still the one named everywhere as current). No staleness found.

**Miss handling — verified end-to-end, both sides:**
- api-worker: `ItemNames` (`chara/types.ts:16-21`) types `ko?`/`zh?` as optional against required `en/ja/de/fr`; `withRegional()` (`resolver.ts:73-74`) spreads `regionalNames(rowId)` over the XIVAPI-sourced names — a miss just omits the key, never writes `undefined` or an empty string over real data.
- web-app (consumer, checked for reachability): `itemNameFor()` (`chara-resolve-service.ts:77-79`):
  ```ts
  const localized = (names as Record<string, string | undefined>)[locale];
  return localized && localized.length > 0 ? localized : names.en;
  ```
  Falls back to `names.en` — matches the documented contract exactly ("Missing means 'omit the key' — the caller falls back to EN, exactly as the dye-name pipeline does," `regional-names.ts:11-13`).

**One process observation (not filed as a finding):** the table is regenerated by a **manual** script (`scripts/build-item-names.mjs`, "run it after a patch and commit" — `regional-names.ts:7-8`) with no CI/currency gate. There is no automated way to detect when it drifts behind a new patch's items; today's coverage is excellent, but the mechanism relies on someone remembering to re-run it. Structural risk, not a current defect — mentioned for the remediation-planning stage, not tabled.

**Verdict: correct, current, gracefully degrading. No finding.**

---

## 4. oauth's user-facing pages

Read every file in `apps/oauth/src/`: `index.ts`, `handlers/{authorize,callback,oauth-flow,token,xivauth}.ts`, `middleware/body-validation.ts`, `services/{jwt-service,user-service}.ts`, `utils/{env-validation,oauth-validation,pkce-binding,state-signing}.ts`.

**oauth renders zero HTML.** Confirmed:
```
$ grep -rn "text/html\|<html\|<!DOCTYPE\|c.html(" apps/oauth/src/
(no matches outside a Content-Type: text/plain test fixture in body-validation.test.ts)
$ grep -rni "consent" apps/oauth/src/
oauth-flow.ts:64: * signs the state, and redirects to the provider's consent screen.
oauth-flow.ts:180: * Shared GET callback handler: the provider redirects here after consent.
```
The only mentions of "consent" are code comments describing **Discord's / XIVAuth's own** consent screen (external, not rendered by this worker). Every route in this worker returns either a `302 Location` redirect (`c.redirect(...)`, no visible body) or `c.json(...)` (error object). There is no `c.html()` call anywhere in the codebase.

**Traced the premise in the brief ("sign-in and consent copy... rewritten in 2026-08, FINDING-002/006") to ground truth.** Read `docs/audits/2026-08-29-security/findings/FINDING-002.md` and `FINDING-006.md` in full:
- FINDING-002 is about **data retention** (avatar URL/character name persisted on every sign-in, not only on submission) — not about display copy in oauth. Its closure note names the actual copy location explicitly: *"the sign-in copy landed 2026-08-30 114f6dde (**web-app**: the sign-in modal states in all six locales that signing in creates an account record...)"* — `apps/web-app/src/locales/*.json`, not `apps/oauth`.
- FINDING-006 is about Perspective API `doNotStore` + a **web-app** PRIVACY.md disclosure gap. Also not oauth copy.

**So the premise doesn't hold for this worker**: the sign-in/consent copy that's user-visible in a browser lives entirely in `apps/web-app` (out of this unit's scope) and — per the FINDING-002 closure note — is already localized in all six locales. oauth itself has no such copy to localize because it never renders any.

**Every response field checked for reachability** (not just existence — see §1 table and §6 sweep for the full list of `error`/`message` strings). Traced every oauth-calling code path in `apps/web-app/src/services/auth-service.ts`:
- GET-callback `?error=` querystring → `auth-service.ts:245` `logger.error('OAuth error:', error)` only; the function then just cleans the URL and navigates back. **No toast, no UI text, in any language, on a failed login.** (This is arguably a UX gap — a user gets silent failure instead of feedback — but it is not an i18n defect: there is no text shown to fail to localize.)
- POST-callback JSON `{success:false, error}` → `auth-service.ts:411,418` both just `logger.error(...)` and `return`.
- `GET /auth/me` → never called by web-app at all (`grep '/auth/me' apps/web-app/src` → empty); the JWT is decoded client-side instead.
- `POST /auth/revoke` → response is not even read (`auth-service.ts:719-727`, fire-and-forget with `catch { /* ignore */ }`).

**Locale plumbing:** none (§2). Not a defect given the above.

**Deploy note for any future fix direction:** oauth never goes below 3.0.0, and its bare `wrangler deploy` **is** the production deploy (no `[env.production]` block) — any change here ships live immediately on merge, unlike the `…-dev` pattern most other workers use.

**Verdict: no finding.** Rejected as a lead — thoroughly, because the brief specifically anticipated this one and it's worth being able to show the negative.

---

## 5. VitePress developer docs (api-worker) — product-surface bleed check

Per the brief, EN-only developer docs are a deliberate, non-defect choice. Checked only for accidental coupling into the *product* surface (`data.xivdyetools.app`, or any web-app/bot-facing code):

```
$ grep -rn "docs/" apps/api-worker/src/**/*.ts | grep -v -i "comment\|jsdoc"
(only the index.ts routing check below; nothing else)
```

`apps/api-worker/src/index.ts:40-56`: the docs host is gated purely on `new URL(c.req.url).hostname === 'developers.xivdyetools.app'`, checked **before** any other middleware, and short-circuits straight to `c.env.ASSETS.fetch(c.req.raw)` (the VitePress static build). This is the only place `docs/` and product code touch, and it's a hostname branch, not a shared module or shared string table. `apps/api-worker/docs/` (VitePress source) is never imported by `apps/api-worker/src/` (confirmed no `import.*docs` anywhere in `src/`).

No product-facing string (an error message, a UI label, anything a non-developer sees) originates in `docs/`. **No finding.**

---

## 6. Hardcoded-sentence sweep

```
$ git ls-files 'apps/presets-api/src/**/*.ts' 'apps/api-worker/src/**/*.ts' 'apps/oauth/src/**/*.ts' 'apps/image-worker/src/**/*.ts' | grep -v -E '\.test\.ts$' | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}"
```
161 hits (full output kept in `docs/audits/2026-09-03-i18n/evidence/scripts/` working notes; not reproduced in full here). Triage:

| Bucket | Count (approx.) | Verdict |
|---|---|---|
| api-worker `ApiError`/`errorResponse` messages (validation.ts, dyes.ts, match.ts, chara/router.ts, telemetry/router.ts, universalis/router.ts) | ~30 | Developer-facing REST diagnostics, properly coded (`ErrorCode.MISSING_PARAMETER` etc.), documented contract (§2). Traced every consumer (`chara-resolve-service.ts`, `world-service.ts`, `market-board.ts`) — none render `.message` raw. Rejected. |
| oauth `error`/`message` fields (callback.ts, xivauth.ts, token.ts, body-validation.ts) | ~20 | Traced end-to-end in §4 — never read by any UI. Rejected. |
| oauth internal `throw new Error(...)` (jwt-service.ts, oauth-validation.ts, state-signing.ts) | ~10 | Caught by handler `catch` blocks and re-wrapped into the same `error` field already covered above, or logged only (`console.warn`/`console.error`). Rejected. |
| presets-api `message:` fields matching the documented `{error: CODE, message: EN}` contract (moderation.ts, presets.ts business messages, api-response.ts) | ~25 | Correct design per brief's "Do NOT file" — **except** where no client-side equivalent exists; see cand-presets-01/02 below. |
| presets-api `validation-service.ts` return strings | ~15 | Root cause of cand-presets-01/02 — see below. |
| presets-api `env-validation.ts` / oauth `env-validation.ts` | ~10 | Startup-time ops diagnostics (`errors.push('Missing required env var...')`), logged only, never reach any HTTP response body a browser sees. Rejected. |
| image-worker `index.ts`/`validators.ts`/`photon.ts` error strings | ~15 | Traced end-to-end in §6-image below. Rejected — confirmed a safe fallback exists for every unmatched case. |
| presets-api `votes.ts:99,153` (`error: 'Failed to add vote'`/`'Failed to remove vote'`) and `middleware/auth.ts:388,410,420,442` (`error: 'Unauthorized'`/`'Forbidden'`/`'Bad Request'`) | 6 | **Contract nit, not an i18n finding** — see "Rejected leads" below. |

### image-worker's contract, verified end-to-end

`apps/image-worker/src/index.ts:113-115` documents a hard contract: *"discord-worker's extractor substring-matches `error` for 'SSRF', 'Discord CDN', 'too large', 'format' and 'timeout' to choose a localized message. Never reword or generalise it."* Checked whether every actual error string honors this, and — more importantly — what happens when one doesn't:

```
$ grep -n "error:" apps/image-worker/src/index.ts
'Invalid JSON body' / 'No image URL provided' / 'Invalid maxDimension: ...' / 'No image data provided' / 'Image processing failed'
```
None of these five contain any of the five claimed keywords. This looked like a real gap until tracing the actual consumer, `apps/discord-worker/src/handlers/commands/extractor.ts:604-621`:
```ts
const errorMessage =
  reason === 'url' ? t.t('matchImage.onlyDiscord')
  : reason === 'too_large' ? t.t('matchImage.imageTooLarge')
  : reason === 'format' ? t.t('matchImage.unsupportedFormat')
  : reason === 'timeout' ? t.t('matchImage.timeout')
  : t.t('matchImage.processingFailed');   // <- fallback, ALSO translated
```
Every branch — matched or not — is `t.t(...)`. An unmatched reason (any of the five gap strings above) still renders a fully localized generic message. **The comment overstates the fragility, but the actual behavior is safe.** Not a finding.

`/thumbnail`'s consumer (presets-api → web-app) discards image-worker's text entirely (`preview-image-service.ts:159: throw new Error('Image could not be processed')`, its own message, then `presets.ts:1114` wraps it as `ErrorCode.VALIDATION_ERROR`; web-app shows only `LanguageService.t('preset.previewImageFailed')`). Confirmed clean.

---

## Findings

### cand-presets-01 (P2) — banned-user message shown as raw English toast detail

`apps/presets-api/src/middleware/ban-check.ts:38-47`:
```ts
function bannedResponse(c): Response {
  return c.json({ success: false, error: ErrorCode.USER_BANNED, message: 'You have been banned from using Preset Palettes.' }, 403);
}
```
`requireNotBanned` gates `POST/PATCH/DELETE` on both `presetsRouter` (`presets.ts:121`) and `votesRouter` (`votes.ts:29`) — so this fires on submit, edit, delete, and vote for any banned user.

Reachability (web-app, not my unit to fix, read only to prove the text is actually displayed): `apps/web-app/src/services/preset-submission-service.ts` has no `errorCode` case for `USER_BANNED` — `grep -rn "USER_BANNED\|banned\|isBanned" apps/web-app/src` returns nothing. A banned user's submit/edit therefore falls into the generic `!response.ok` branch (`preset-submission-service.ts:322-327`: `errorCode: 'submitFailed', error: result.message`), and the form explicitly documents showing it raw: `preset-submission-form.ts:767-771` —
```ts
// `result.error` is the presets-API's own message when it sent one —
// shown as toast details under the translated headline, not instead of it.
ToastService.error(presetErrorMessage(result.errorCode, 'errors.submitPresetFailed'), result.error);
```
rendered as literal DOM text at `apps/web-app/src/components/toast-container.ts:135-140` (`textContent: toast.details`). So a banned FR/DE/JA/KO/ZH user sees a translated headline plus this exact English sentence underneath, in every locale, every time.

### cand-presets-02 (P2) — several validation rules have no differentiating code, only free-text English

`apps/presets-api/src/services/validation-service.ts` returns a raw `string | null` (not a code) for every rule; `presets.ts`'s `validateSubmission()`/`validateEditRequest()` (`presets.ts:167-217`) `return`s that string straight into `validationErrorResponse(c, validationError)` (generic `ErrorCode.VALIDATION_ERROR` for all of them — no per-rule code exists on the wire at all). Cross-checked against web-app's client-side pre-validation (`apps/web-app/src/services/preset-submission-service.ts:153-200`, the only place a `PresetValidationCode` is produced) — it covers exactly `nameMin/nameMax/descMin/descMax/category/dyesMin/dyesMax/dyesInvalid/dyesRange/tagsArray/tagsMax/tagLength`. Rules with **zero client-side equivalent**, confirmed absent from that list:
- Tag character-set (`validation-service.ts:377`, `"Tags may only contain letters, numbers, spaces, hyphens, underscores and apostrophes, and must start and end with a letter or number"`) — client only checks tag *length*, never the regex (`TAG_PATTERN`), so e.g. a tag containing `!`, `#`, or an emoji passes client validation and fails server-side.
- Unsupported/control/zero-width characters in name/description (`validation-service.ts:274,297` via `UNSUPPORTED_CHARACTERS_SUFFIX`) — no client check at all.
- Secondary-category rules (`validation-service.ts:407,416,424`: "must be an array" / "Invalid secondary category" / "contain a duplicate") — no client-side validation of `secondary_categories` found in `validateSubmission()`.
- `validateModerationReason`/`validateExampleLink` free-text messages — same pattern, lower likelihood of end-user reach (reason is moderator-only; example link's host allowlist is mirrored client-side in `shared/example-link.ts` so this one is less likely to trigger in practice — not independently reachability-tested to the same depth as the tag case).

Same mechanism as cand-presets-01: reaches the same `result.error` → toast-details path. The tag-pattern case is the most likely to be hit in ordinary use (any punctuation or emoji in a tag).

**Both findings share one root cause and one fix direction:** give every presets-api validation/business-rule failure a distinct machine-readable code (extend `PresetValidationCode`/a new `PresetErrorCode` member per rule, e.g. `USER_BANNED`, `tagPattern`, `unsupportedCharacters`, `secondaryCategoryDuplicate`...) so the web-app's `preset-i18n.ts` can map every one of them instead of falling back to the raw wire `message`. This is a presets-api contract change (add codes) plus a web-app follow-up (map them) — filed here because the missing codes originate in this unit.

---

## Rejected leads

- **oauth "sign-in and consent copy"** (brief's anticipated lead, §4) — traced to FINDING-002/006; the actual copy is in `apps/web-app/src/locales/*.json` (out of this unit), already localized in all 6 locales per the FINDING-002 closure note. oauth itself renders no HTML/copy at all. Rejected with high confidence — this was the most likely candidate going in and it does not hold up.
- **`votes.ts:99,153`** (`error: 'Failed to add vote'`/`'Failed to remove vote'`, a sentence where `api-response.ts`'s own docstring says a SCREAMING_SNAKE_CASE code belongs) — real contract-consistency defect, but zero i18n impact: the vote UI (`preset-detail.ts:788`, `preset-tool.ts:771`, `community-preset-service.ts:406`) reads `errorCode: 'voteFailed'` (its own client-assigned value, not this field) and calls `ToastService.error(voteErrorMessage(...))` with **no second `details` argument** — this raw string is computed, transmitted, and then never read by any code path found. Not tabled: no user ever sees it, in any language.
- **`middleware/auth.ts:388,410,420,442`** (`error: 'Unauthorized'`/`'Forbidden'`/`'Bad Request'`, same contract deviation) — same reasoning: these values are used only for `success:false` branching (never displayed), confirmed by the same reachability tracing done for cand-presets-01/02 (no `errorCode` mapping keys on `'Unauthorized'`/`'Forbidden'`/`'Bad Request'` anywhere in web-app). Rejected.
- **`presets.ts:191,572,730` duplicate-combination message** ("This dye combination already exists") — looked like a raw-text candidate, but the client explicitly special-cases it: `preset-submission-service.ts` sets `errorCode: 'duplicate'` when `result.duplicate` is present, and `preset-i18n.ts:160-166`'s `presetErrorMessage()` has a dedicated branch (`LanguageService.tInterpolate('preset.duplicateFound', {...})`) — fully localized, not the free-text fallback. Rejected.
- **`moderation-service.ts:194,230,316` (`flaggedReason`)** — moderation reason text, D1-stored. `grep -rn "flaggedReason\|flagged_reason" apps/web-app/src` → empty; the submitter-facing response only ever carries `moderation_status: 'clean'|'flagged'` (`presets.ts:980`), a boolean-ish enum the web-app already localizes (`preset.submittedPendingReview`/`preset.submittedSuccess`). The reason text itself is moderator/bot-only (moderation-worker), out of scope per "Do NOT file." Rejected.
- **`/api/v1/moderation/*` and `/api/v1/moderation/notifications/*` entirely** — `requireModerator`-gated, zero references from `apps/web-app` (no moderator UI exists there); this surface is Discord-bot-only. Excluded per brief.
- **presets-api `data/profanity/{en,ja,de,fr,ko,zh}.ts`** — a per-locale content-moderation blocklist, not translatable UI text. Existence-checked only: all 6 locale files present, matching the fixed 6-locale set. Not meaningfully auditable as an i18n "translation" (a blocklist doesn't have a canonical EN source to translate from) — noted, not tabled.
- **api-worker `middleware/rate-limit.ts:78,157`** (`'Rate limit exceeded. 60 requests per minute allowed...'`, `'Telemetry rate limit exceeded...'`) — 429 JSON bodies; `/v1/telemetry`'s caller is `sendBeacon` (can't read responses, §1); the `/v1/*` general limiter's 429 was checked against every web-app API consumer (`dye-service-wrapper.ts`, `chara-resolve-service.ts`, `market-board-service.ts`) — none read `.message`, all either retry silently or show their own generic localized error. Rejected.
- **api-worker `universalis/router.ts` errors** (`'Rate limit exceeded'`, `'Failed to fetch from upstream API'`, `'Failed to fetch data centers'`, etc.) — same tracing as above via `market-board.ts`/`world-service.ts`; both only `logger.error` and show `LanguageService.t('marketBoard.refreshError')`. Rejected.
- **`docs/reference/*.md` being English-only** — explicitly out of scope per brief (deliberate, defensible). Checked only for product-surface bleed (§5) — none found.
- **oauth `env-validation.ts` / presets-api `env-validation.ts`** (`'Missing required env var in production: ...'`) — startup-time ops diagnostics, `logger.warn`/`console.error` only, never reach an HTTP response a browser would see (the request-time gate returns the separate, already-reviewed `'Service misconfigured'` 500, itself never shown per §1/§4 tracing). Rejected.
- **image-worker's 5 unmatched error strings** (`'Invalid JSON body'`, `'No image URL provided'`, `'Invalid maxDimension...'`, `'No image data provided'`, `'Image processing failed'`) — looked like a contract gap against the "5 keywords" comment; traced to discord-worker's fallback branch, which is *also* `t.t(...)`. Rejected — see §6.
- **chara table staleness** — no evidence of a patch after the table's 2026-08-21 generation date; coverage is 99.98%/99.997%. Not filed; the lack of an automated freshness gate is noted as a process observation only (§3), not a defect today.

---

## Files covered

76 non-test `.ts` source files across the four units (full `git ls-files` count, test files excluded):
- `apps/presets-api/src` — 26/26 touched (full read: `index.ts`, `handlers/{categories,moderation,presets,votes}.ts`, `middleware/{auth,ban-check}.ts`, `services/validation-service.ts`, `utils/api-response.ts`; grep-swept with hits reviewed in context: `middleware/body-validation.ts`, `services/{moderation-service,notification-service,preview-image-service,preset-service}.ts`, `utils/env-validation.ts`; grep-swept, no hits: `middleware/rate-limit.ts`, `services/{category-service,rate-limit-service}.ts`, `types.ts`; existence-only: `data/profanity/*.ts` ×6)
- `apps/api-worker/src` — 29/29 touched (full read: `index.ts`, `middleware/locale.ts`, `lib/{api-error,dye-serializer}.ts`, `chara/regional-names.ts`; substantial read + grep: `lib/validation.ts`, `routes/{dyes,match}.ts`, `chara/{resolver,router,types}.ts`, `universalis/router.ts`; grep-swept: everything else including `chara/{cache,xivapi}.ts`, `telemetry/*.ts`, `universalis/{config,services}/*.ts`, `lib/{response,services}.ts`, `types.ts`)
- `apps/oauth/src` — 16/16 touched (full read: `index.ts`, `handlers/{authorize,callback,oauth-flow,token,xivauth}.ts`; grep-swept with hits reviewed: `middleware/body-validation.ts`, `services/{jwt-service,user-service}.ts`, `utils/{env-validation,oauth-validation,state-signing}.ts`; grep-swept, no hits: `constants/oauth.ts`, `utils/pkce-binding.ts`; referenced-only via `index.ts` usage: `services/rate-limit.ts`, `types.ts`)
- `apps/image-worker/src` — 5/5 touched (full read: `index.ts`, substantial read: `validators.ts`; grep-swept: `photon.ts`, `dimensions.ts`, `types.ts`)

Plus cross-unit reachability verification (read-only, not part of this unit's fix surface) in `apps/web-app/src`: `services/{auth-service,preset-submission-service,community-preset-service,chara-resolve-service,world-service}.ts`, `shared/{preset-i18n,error-handler}.ts`, `components/{preset-submission-form,preset-edit-form,toast-container,chara-import,market-board}.ts`, `components/v4/{preset-detail,preset-tool,config-sidebar}.ts`, `services/toast-service.ts`; and `apps/discord-worker/src/handlers/commands/extractor.ts` for the image-worker contract. These establish reachability for the findings/rejections above; they are not this unit's responsibility to fix.
