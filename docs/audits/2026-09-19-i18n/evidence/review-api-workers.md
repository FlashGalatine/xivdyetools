# i18n review — api-workers (api-worker, presets-api, oauth, image-worker)

Base: `origin/main` `e86c7404`. Read-only review, no source modified.

## Module map

- `apps/api-worker/src/middleware/locale.ts` — `?locale=` parsed once, `LocalizationService.ensureLocaleLoaded`, stashed at `c.var.locale`; applied to all `/v1/*` (incl. `/v1/wheels`, `/v1/harmony*`, `/v1/chara/*`, `/v1/telemetry`).
- `apps/api-worker/src/lib/validation.ts:380-390` — `parseLocale` validates against `VALID_LOCALES = SUPPORTED_LOCALES` (imported from `@xivdyetools/types`/core, not spelled literally); unknown/case-mismatched value → `400 INVALID_LOCALE` uniformly across every `/v1/*` route (single middleware, so no per-route divergence).
- `apps/api-worker/src/lib/dye-serializer.ts` — established contract: `name` (stable English) + optional `localizedName`; `locale === 'en'` skips the lookup.
- `apps/api-worker/src/lib/harmony.ts:29-40` — colour-wheel and harmony-type `name` is *directly* the localized string (no separate stable-English field); `tag`/`id` stay untranslated wire tokens. Documented explicitly in `docs/reference/harmony.md` ("the localized `name` does [change]"), so intentional, but a different shape than the dye/`localizedName` pattern.
- `apps/api-worker/src/chara/*` — `.chara` resolver; `ItemNames` always carries en/ja/de/fr from XIVAPI, ko/zh optional from build-time tables (`regional-names.ts`), absence = fall back to `en` (documented at `docs/reference/chara.md:62,113`). `?locale=` is accepted (goes through the same middleware) but has no effect on this endpoint — it always returns all six languages, which is correct given the endpoint's job.
- `apps/api-worker/src/types.ts:44-49` — `Variables.locale` type hand-spells `'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'` instead of reusing `LocaleCode`/`ValidLocale` the way `validation.ts` does.
- `apps/api-worker/docs/guide/errors.md` — full error-code table, incl. the four new codes (`INVALID_LOCALE`, `INVALID_COLOR_WHEEL`, `INVALID_HARMONY_TYPE`, `INVALID_BODY`) and locale enum; cross-checked against `lib/api-error.ts` and found accurate, no contradiction.
- `apps/presets-api/src/utils/api-response.ts:1-19` — documented contract: `error` = machine SCREAMING_SNAKE_CASE code, `message` = human text. Universally followed by `errorResponse()` call sites (`validationErrorResponse`, `forbiddenResponse`, `notFoundResponse`, inline `ErrorCode.*` objects for 409 conflicts, preview-image errors, rate limits, ban-check) — confirmed against `hc-sentences-apps-presets-api.txt`.
- `apps/presets-api/src/handlers/votes.ts:93-101,147-155` — `addVote`/`removeVote` internal result objects break that contract: on a D1 failure they return `{ success: false, error: 'Failed to add vote' }` / `'Failed to remove vote'` — an English sentence *in the code field*, no separate `message`, no enum member. Forwarded verbatim to the client at `votes.ts:190` (`c.json(result, 500)`) and `votes.ts:225` (`c.json(result)`).
- `apps/presets-api/src/handlers/categories.ts` + `schema.sql:8-10` — categories have a stable `id` (slug) and an English `name` column; no `?locale=` param anywhere in this worker (confirmed: zero hits for `locale` in `categories.ts`/`index.ts`). Consistent with "id is the localization key, name is an English DB label" — unchanged since categories shipped, not new.
- `apps/oauth/src` — no `c.html`/`text/html` anywhere; every response is JSON, consumed by web-app's own (separately-reviewed) error handling. Confirmed unchanged after the 2026-09-03+ commits (`BUG-017` header fix, `REFACTOR-009` bodyGuards adoption) — still "no user-visible text at all."
- `apps/image-worker/src` — no `message:`/HTML hits at all; confirmed still text-free, service-binding only.

## Candidates

| cand-id | tier | file:line | locale(s) | one-line claim | evidence pointer |
|---|---|---|---|---|---|
| AW-01 | P2 | apps/presets-api/src/handlers/votes.ts:99,153,190,225 | all | On a vote-write D1 failure the client gets `error: "Failed to add vote"` / `"Failed to remove vote"` — an English sentence standing in for the machine code every other presets-api error uses, so no client can map it to a localized string in any locale | Read votes.ts; contract stated in api-response.ts:1-19; contrasted against every other handler via hc-sentences-apps-presets-api.txt |
| AW-02 | P3 | apps/api-worker/src/types.ts:48 | n/a (type-level) | `Variables.locale` hand-spells the 6-locale union instead of importing `LocaleCode`/`ValidLocale` as `validation.ts:36` does — a 7th core locale would need a second edit here to compile | Read types.ts:44-49 vs validation.ts:35-36 |
| AW-03? | P3 | apps/api-worker/src/lib/harmony.ts:29-40 | ja de fr ko zh | `/v1/wheels` and `/v1/harmony/types` overwrite `name` with the localized string directly (no stable-English `name` + `localizedName` pair like dyes get) — documented and intentional, but a different response shape a client built against the dye contract would not expect | harmony.md:17,25,64 documents it; dye-serializer.ts:33-39 is the contrasting pattern |
| AW-04? | P3 | apps/presets-api/src/handlers/categories.ts:58-59,131-132 | ja de fr ko zh | `/categories` `name` is a raw English DB column with no `?locale=`/`localizedName` — fine if clients only ever use `id` to look up their own label, unverified from this unit alone whether any consumer prints `name` raw | schema.sql:8-10; grep for "locale" in categories.ts/index.ts returns nothing |

POSITIVE:
- `?locale=` on `/v1/wheels`, `/v1/wheels/:id`, `/v1/harmony/types`, `/v1/harmony` behaves identically to `/v1/dyes*`/`/v1/match/*` — same middleware, same `INVALID_LOCALE` 400, same `SUPPORTED_LOCALES` source, same `meta.locale` omit-when-en rule.
- Wheel/harmony names come from `LocalizationService.getColorWheelName`/`getHarmonyType` — single source of truth, no re-translation on this surface.
- `.chara` ko/zh fallback-to-en behavior is documented precisely (chara.md:62,113) and matches `regional-names.ts`'s "omit the key" implementation.
- New error codes (`INVALID_LOCALE`, `INVALID_COLOR_WHEEL`, `INVALID_HARMONY_TYPE`) are both implemented consistently and documented accurately in `docs/guide/errors.md` — no doc/code contradiction found.
- presets-api's 409 conflict paths (content_revision, dye_signature, preview-review races) and preview-image upload errors all carry a proper `ErrorCode` member — only the vote-write failure path (AW-01) does not.
- oauth and image-worker confirmed still text-free/JSON-only after every commit since 2026-09-03.

REJECTED:
- `?locale=JA` / `zh-CN` case-sensitivity → 400 `INVALID_LOCALE`: pre-existing behavior (same code path dyes/match already used), applies uniformly to every `/v1/*` route including the new ones — not a new inconsistency.
- Missing `Vary: locale`-equivalent header: `Cache-Control` has no `Vary`, but `locale` is already part of the request URL's query string on every route (old and new alike), so the cache key already differs per locale; unchanged pattern, not a regression.
- Universalis proxy's ad hoc `{ error: '<sentence>' }` shapes (`universalis/router.ts`): explicitly documented as deliberately un-enveloped and outside the `/v1/*` contract (api-worker CLAUDE.md) — same class as "raw presets-api response.error" in the do-not-refile list.
- `.chara` response has no explicit "this name is a fallback" flag: documented behavior (absence of the `ko`/`zh` key IS the signal), matches the dye-name pipeline's established pattern.
- oauth's ad hoc `error:` sentence strings (callback.ts, xivauth.ts, etc.): never rendered as HTML/user-visible text by this worker; consumed by web-app's own error handling (separately reviewed unit).

COVERED: 27 files read across apps/api-worker/src (middleware, routes/wheels.ts, routes/harmony.ts, lib/harmony.ts, lib/validation.ts, lib/dye-serializer.ts, chara/*, types.ts, index.ts, docs/reference/{harmony,chara}.md, docs/guide/errors.md), apps/presets-api/src (utils/api-response.ts, handlers/{presets,moderation,votes,categories}.ts, schema.sql), apps/oauth/src (index.ts + full handler/util file listing), apps/image-worker/src (full file listing).
