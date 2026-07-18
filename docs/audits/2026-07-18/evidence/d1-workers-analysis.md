# D1 Workers Deep-Dive Analysis — presets-api & oauth

- **Date:** 2026-07-18
- **Scope:** `apps/presets-api` (CF Worker + Hono + D1) and `apps/oauth` (CF Worker + D1 + KV + DO)
- **Method:** Read-only line-by-line review of all `src/` files, schemas, migrations, and `wrangler.toml` for both workers. Every finding verified against exact source lines.
- **Files given extra attention (changed since 2026-05-28):** `apps/oauth/src/services/jwt-service.ts`, `apps/oauth/src/utils/state-signing.ts`, `apps/oauth/wrangler.toml`

---

## Prior findings status (2026-05-28 audit)

### REFACTOR-001 — dual JWT verifiers (oauth hand-rolled vs `@xivdyetools/auth`)

**Status: PARTIALLY RESOLVED — aligned, not consolidated. Two verifiers still exist.**

- `apps/oauth/package.json` (deps, lines 16-23) does **not** depend on `@xivdyetools/auth`. The oauth worker still ships its own hand-rolled JWT implementation in `apps/oauth/src/services/jwt-service.ts`.
- However, the divergence that motivated the finding (different alg pinning) has been fixed in place: `verifyJWT` now rejects non-HS256 (`jwt-service.ts:216-225`), `verifyJWTSignatureOnly` does the same (`jwt-service.ts:290-294`), both now require the `sub` claim (`jwt-service.ts:244-247`, `307-311`) with comments explicitly citing "REFACTOR-001: ... matches @xivdyetools/auth". Constant-time signature comparison via `crypto.subtle.verify` was also adopted (`jwt-service.ts:66-78`; consumed by `state-signing.ts:65`, comment "FINDING-001").
- `presets-api` is fully on the shared package (`apps/presets-api/src/middleware/auth.ts:10` imports `verifyJWT`/`verifyBotSignature` from `@xivdyetools/auth`).
- Residual duplication in oauth: a **third** token-mint path exists (`createJWTFromPayload` in `apps/oauth/src/handlers/refresh.ts:287-301` re-implements header/sign/join), and the deprecated `createJWT` (`jwt-service.ts:88-130`) plus `isJWTExpired` (`jwt-service.ts:321-327`) are used only by tests. See REFACTOR-01 below for the consolidation follow-up.

---

## BUGS

### BUG-01: Preset owner can self-approve a rejected/flagged preset via PATCH

- **Kind:** BUG
- **Severity:** CRITICAL
- **Location:** `apps/presets-api/src/handlers/presets.ts:213-322` (esp. 282, 316-322); `apps/presets-api/src/services/preset-service.ts:422-425`
- **Description:** `PATCH /api/v1/presets/:id` never checks the preset's current status. `moderationStatus` defaults to `'approved'` (presets.ts:282) and is *always* passed to `updatePreset` as `newStatus` (presets.ts:316-322), which unconditionally writes it (preset-service.ts:422-425). A user whose preset was `rejected` by a moderator (or auto-`flagged`/`hidden`) can PATCH any innocuous field — e.g. change one tag, or a name that passes the profanity filter — and the preset's status is silently reset to `approved`, re-listing it publicly. This defeats the entire moderation reject flow.
- **Evidence:**
  ```ts
  // presets.ts:282
  let moderationStatus: 'approved' | 'pending' = 'approved';
  ...
  // presets.ts:316-322 — always passed, regardless of preset.status
  const updatedPreset = await updatePreset(c.env.DB, id, body, previousValues, moderationStatus);
  ```
  ```ts
  // preset-service.ts:422-425
  if (newStatus !== undefined) {
    setClauses.push('status = ?');
    params.push(newStatus);
  }
  ```
- **Reproduction:** 1) Submit preset; moderator rejects it (`status='rejected'`). 2) As the owner, `PATCH /api/v1/presets/:id` with `{"tags":["new"]}`. 3) Handler ownership check passes, no name/description change so no moderation runs, `newStatus='approved'` is written. Preset is public again.
- **Why it evades testing:** Tests exercise the intended edit flows (clean edit stays approved; profane edit goes pending — the PRESETS-BUG-002 comment shows the always-pass was *intentional* for un-flagging). No test edits a *rejected* preset, and the status-transition matrix was never modeled.
- **Suggested fix:** Only allow the `approved`→`approved`/`pending`→`pending|approved` transitions from an owner edit; if `preset.status` is `'rejected'`, `'flagged'`, or `'hidden'`, either block the edit (403/409) or force `moderationStatus = 'pending'` so a moderator re-reviews. E.g. `if (['rejected','flagged','hidden'].includes(preset.status)) moderationStatus = 'pending';` before the update.

### BUG-02: CJK profanity lists can never match — `\b` word boundaries don't exist around CJK characters

- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `apps/presets-api/src/services/moderation-service.ts:85` (pattern construction), `151-172` (matching); word data in `apps/presets-api/src/data/profanity/{ja,ko,zh}.ts`
- **Description:** The combined filter regex is `` new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'i') ``. JS `\b` is defined by `\w` = `[A-Za-z0-9_]`. CJK characters are non-word characters, so there is never a word boundary between a CJK character and an adjacent non-word character (another CJK char, a space, or string start/end). Any list entry that *ends* (or begins) with a CJK character — every entry in `ja.ts` (e.g. `'aiのガラクタ'` ends in `タ`), `ko.ts` (`'ai 쓰레기'` ends in `기`), and `zh.ts` — can never satisfy the trailing `\b` in real text. The Japanese/Korean/Chinese local profanity lists are effectively dead code; only Perspective API (optional, fail-open on timeout/absence of `PERSPECTIVE_API_KEY`) covers those languages.
- **Evidence:**
  ```ts
  // moderation-service.ts:85
  combinedPattern = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'i');
  ```
  ```ts
  // ja.ts:13 — 'aiのガラクタ'; /\b(aiのガラクタ)\b/i.test('これはaiのガラクタです') === false
  // ko.ts:13 — 'ai 쓰레기';   /\b(ai 쓰레기)\b/i.test('ai 쓰레기 preset') === false
  ```
- **Reproduction:** `checkLocalFilter('ai 쓰레기', 'some description ...')` returns `null` (clean). With Perspective unconfigured or timing out, the preset is auto-approved.
- **Why it evades testing:** `tests/data/profanity.test.ts` and the moderation tests inject/assert ASCII words (which do have `\w` neighbors, so `\b` works). Nobody asserted a CJK entry actually matches through the compiled combined pattern.
- **Suggested fix:** Split the compiled data into two matchers: ASCII-ish words keep `\b(...)\b`; entries containing any char outside `[\w\s]` get a plain (boundary-less) alternation match, e.g. `new RegExp(cjkWords.map(escapeRegex).join('|'), 'i')`, or use Unicode-aware boundaries (`(?<![\p{L}\p{N}])(...)(?![\p{L}\p{N}])` with `u` flag).

### BUG-03: A rejected preset permanently poisons its dye combination — resubmission and edits 500

- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `apps/presets-api/schema.sql:81` + `migrations/0004_unique_dye_signature.sql:22` (full UNIQUE index); `apps/presets-api/src/services/preset-service.ts:241-247, 368-374` (status-filtered duplicate checks); `apps/presets-api/src/handlers/presets.ts:458-476` (constraint recovery), `261` + `preset-service.ts:430-436` (unguarded UPDATE path)
- **Description:** The UNIQUE index on `presets(dye_signature)` covers **all** rows regardless of status, but both duplicate checks filter `status IN ('approved', 'pending')`. When a preset is `rejected` (or `hidden`), its row keeps its `dye_signature`. Consequences:
  1. `POST /presets` with the same dye combo: `findDuplicatePreset` returns null → `createPreset` throws UNIQUE constraint → the catch block calls `findDuplicatePreset` again (still null, rejected rows excluded) → falls through to `throw error` → generic 500 for the user, forever, for that combination (presets.ts:461-475).
  2. `PATCH /presets/:id` changing `dyes` to a combo held by a rejected preset: `findDuplicatePresetExcluding` passes → `updatePreset`'s UPDATE (preset-service.ts:436) violates the UNIQUE index with **no** try/catch → raw 500.
- **Evidence:**
  ```sql
  -- 0004_unique_dye_signature.sql:22 (not partial)
  CREATE UNIQUE INDEX idx_presets_dye_signature ON presets(dye_signature);
  ```
  ```ts
  // preset-service.ts:241-245
  SELECT * FROM presets
  WHERE dye_signature = ? AND status IN ('approved', 'pending')
  ```
- **Reproduction:** Submit preset with dyes `[1,2]`; moderator rejects it. Any user then submits `[1,2]` → 500 `INTERNAL_ERROR`. Repeats indefinitely.
- **Why it evades testing:** Tests cover the approved-duplicate race (constraint → vote conversion). No test creates a *rejected* preset and resubmits its signature; D1 mocks may not even enforce the unique index.
- **Suggested fix:** Make the index partial to mirror the check: `CREATE UNIQUE INDEX ... ON presets(dye_signature) WHERE status IN ('approved','pending')` — requires D1-supported partial unique index (SQLite supports it) and a migration that also nulls or keeps signatures on rejected rows consistently. Alternatively clear `dye_signature` (set NULL) when a preset is rejected/hidden, and restore on approve. Also wrap the `updatePreset` dye-change path in the same constraint-recovery logic as create.

### BUG-04: `GET /api/v1/presets/:id` publicly serves hidden/pending/rejected presets

- **Kind:** BUG
- **Severity:** MEDIUM (information disclosure / ban bypass by direct link)
- **Location:** `apps/presets-api/src/handlers/presets.ts:363-372`; `apps/presets-api/src/services/preset-service.ts:224-231`
- **Description:** The single-preset endpoint is unauthenticated and `getPresetById` has no status filter. The listing endpoint carefully excludes `hidden` ("they're only visible to owners via /mine", preset-service.ts:131), but anyone with the ID (previously shared link, Discord embed, enumeration of IDs from older listings) can still fetch a hidden (banned user's) preset, a rejected preset, or content sitting in the moderation queue — including flagged name/description text that moderation intentionally keeps out of public view.
- **Evidence:**
  ```ts
  // presets.ts:363-371 — no auth, no status check
  presetsRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const preset = await getPresetById(c.env.DB, id);
    if (!preset) return notFoundResponse(c, 'Preset');
    return c.json(preset);
  });
  ```
- **Reproduction:** Ban a user (presets become `hidden`). `GET /api/v1/presets/<known-id>` with no auth → 200 with full body, including `previous_values` (the pre-edit audit snapshot) which is also serialized by `rowToPreset`.
- **Why it evades testing:** Tests assert 200-for-existing/404-for-missing; nobody asserts 404/403 for non-approved statuses. The security note lives on the *list* function only.
- **Suggested fix:** In the GET handler, if `preset.status !== 'approved'`, return 404 unless the requester is the owner or a moderator (auth context is already populated by global middleware). Also strip `previous_values` from public responses.

### BUG-05: `?status=pending|rejected|flagged` publicly lists unmoderated and rejected content

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/presets-api/src/handlers/presets.ts:53-67` (raw cast of `status`); `apps/presets-api/src/services/preset-service.ts:131-137`
- **Description:** The status filter is only sanitized against `'hidden'` (`safeStatus = status === 'hidden' ? 'approved' : status`). Every other value is bound directly, so any anonymous caller can list `?status=pending` (content that *failed* profanity moderation and is awaiting review — the exact thing the pending flow is supposed to keep private), `?status=rejected`, or `?status=flagged`. The moderation endpoint for the same data (`GET /moderation/pending`) requires moderator auth, so this is an unauthenticated bypass of that gate. (The value is also unvalidated, so `?status=banana` silently returns an empty list rather than 400 — minor.)
- **Evidence:**
  ```ts
  // preset-service.ts:132-137 — only 'hidden' is remapped
  const safeStatus = status === 'hidden' ? 'approved' : status;
  const conditions: string[] = ["status = ? AND status != 'hidden'"];
  const params: (string | number)[] = [safeStatus];
  ```
- **Reproduction:** `GET /api/v1/presets?status=pending` with no Authorization header → full pending queue with flagged names/descriptions and author Discord IDs.
- **Why it evades testing:** Tests cover `approved` listing and the `hidden` remap; the other enum values were assumed to be harmless filters.
- **Suggested fix:** Whitelist publicly listable statuses: for unauthenticated/non-moderator callers coerce anything that isn't `'approved'` to `'approved'` (or 400). Let moderators pass other statuses if desired.

### BUG-06: Pagination parameters unvalidated — `page=abc` 500s; negative `limit` bypasses the 50 cap and dumps the table

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/presets-api/src/handlers/presets.ts:61-62`; `apps/presets-api/src/services/preset-service.ts:176-188`
- **Description:** `page ? parseInt(page, 10) : undefined` yields `NaN` for non-numeric input; `NaN` propagates into `offset = (page - 1) * limit` and `.bind(..., limit, offset)` — D1 rejects `NaN` bindings, surfacing as an unhandled 500. `limit` is capped only from above (`Math.min(parseInt(limit,10), 50)`): `?limit=-1` produces `LIMIT -1`, which SQLite treats as **no limit**, returning the entire presets table in one response (memory/egress amplification; combined with `search` this is an easy DoS lever). `?page=0`/negative pages produce negative offsets (SQLite treats as 0, so mostly benign but inconsistent with `has_more` math).
- **Evidence:**
  ```ts
  // presets.ts:61-62
  page: page ? parseInt(page, 10) : undefined,
  limit: limit ? Math.min(parseInt(limit, 10), 50) : undefined, // Cap at 50 for performance
  ```
  ```ts
  // preset-service.ts:176, 185-188
  const offset = (page - 1) * limit;
  ... .bind(...params, limit, offset).all(...)
  ```
- **Reproduction:** `GET /api/v1/presets?page=abc` → 500 `INTERNAL_ERROR`. `GET /api/v1/presets?limit=-1` → every approved preset in one payload.
- **Why it evades testing:** Tests use well-formed integers; the cap comment ("Cap at 50") reads as if bounds are handled.
- **Suggested fix:** Clamp both: `page = Math.max(1, Number.parseInt(page,10) || 1)`, `limit = Math.min(Math.max(1, Number.parseInt(limit,10) || 20), 50)`.

### BUG-07: Env-validation "fail fast" only fails the first request per isolate — later requests run misconfigured (both workers)

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/presets-api/src/index.ts:34, 50-68`; `apps/oauth/src/index.ts:26, 41-59`
- **Description:** The module-level `envValidated` flag is set to `true` *before* the invalid-config branch returns 500. On the next request the entire block is skipped, so in production a misconfigured worker serves exactly one 500 and then processes all subsequent traffic with the invalid environment (e.g. short `JWT_SECRET`, missing `DISCORD_CLIENT_SECRET`) — the opposite of the stated "fail fast on misconfiguration" intent.
- **Evidence:**
  ```ts
  // oauth/src/index.ts:43-49 (identical shape in presets-api)
  if (!envValidated) {
    const result = validateEnv(c.env);
    envValidated = true;              // <-- set before failing
    if (!result.valid) {
      ...
      if (c.env.ENVIRONMENT === 'production') {
        return c.json({ error: 'Service misconfigured' }, 500);
      }
  ```
- **Reproduction:** Deploy with `JWT_SECRET` of 8 chars. Request 1 → 500. Request 2..N (same isolate) → normal processing, JWTs signed with the weak secret.
- **Why it evades testing:** Unit tests hit the middleware once per fresh module import; the second-request path in the same isolate is never exercised.
- **Suggested fix:** Cache the *result*, not just "ran once": `let envResult: EnvValidationResult | null = null; if (!envResult) envResult = validateEnv(c.env); if (!envResult.valid && production) return 500;` — so every request in a bad isolate fails.

### BUG-08: OAuth redirect-URI allowlists disagree between authorize and callback — transition-domain Discord login is broken

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/oauth/src/handlers/authorize.ts:69-88`; `apps/oauth/src/handlers/callback.ts:83-109`; `apps/oauth/src/handlers/xivauth.ts:206-226`; `apps/oauth/src/constants/oauth.ts:10-17`; `apps/oauth/wrangler.toml:8, 19`
- **Description:** Three different allowlists are used for the same `redirect_uri` value:
  - `/auth/discord` (authorize.ts:69-73) accepts `ALLOWED_REDIRECT_ORIGINS` (includes `https://xivdyetools.projectgalatine.com` and localhost entries) plus `FRONTEND_URL`.
  - Discord `GET /auth/callback` (callback.ts:83-104) accepts **only** `new URL(FRONTEND_URL).origin` (= `https://xivdyetools.app` in prod), plus localhost in dev.
  - XIVAuth `GET /auth/xivauth/callback` (xivauth.ts:209-219) accepts `ALLOWED_REDIRECT_ORIGINS` (minus localhost in prod) but **not** `FRONTEND_URL` (works today only because prod FRONTEND_URL happens to be in the constant).
  Net effect: a user on the still-routed transition domain (`auth.xivdyetools.projectgalatine.com` is a live route, wrangler.toml:8) who starts Discord login with `redirect_uri=https://xivdyetools.projectgalatine.com/auth/callback` passes validation at `/auth/discord`, authenticates at Discord, then is bounced at `GET /auth/callback` with "Untrusted redirect origin" — every time. Additionally, authorize accepts `http://localhost:5173` redirect URIs **in production** (the constant is not environment-filtered at authorize time); it is only caught later at the callback, which is harmless for security but inconsistent.
- **Evidence:**
  ```ts
  // callback.ts:83-85 — Discord callback allowlist
  const allowedOrigins = [ new URL(c.env.FRONTEND_URL).origin ];
  ```
  ```ts
  // authorize.ts:69-73 — authorize allowlist
  const allowedOrigins = [ ...ALLOWED_REDIRECT_ORIGINS, c.env.FRONTEND_URL, `${c.env.FRONTEND_URL}/auth/callback` ];
  ```
- **Reproduction:** From `https://xivdyetools.projectgalatine.com`, initiate Discord login (redirect_uri = own origin). Complete Discord consent → redirected to `FRONTEND_URL/auth/callback?error=Untrusted+redirect+origin`.
- **Why it evades testing:** Callback tests use `FRONTEND_URL`-origin redirect URIs; the transition domain only exists in constants/wrangler and is exercised by no test.
- **Suggested fix:** Extract one `getAllowedRedirectOrigins(env)` helper (constants + FRONTEND_URL, localhost only when `ENVIRONMENT === 'development'`) and use it in all four places (both authorize handlers and both GET callbacks).

### BUG-09: XIVAuth account-merge can hit `UNIQUE(discord_id)` and permanently 500 the login

- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `apps/oauth/src/services/user-service.ts:42-67, 129-169`; `apps/oauth/schema/users.sql:20-21`; caller `apps/oauth/src/handlers/xivauth.ts:445-472`
- **Description:** `findOrCreateUser` looks up by `xivauth_id` first. If found (user row B), it calls `updateUser` with `discord_id: existingUser.discord_id || discord_id` — i.e. it stamps the XIVAuth-linked Discord ID onto row B. If that Discord ID already belongs to a *different* row A (user previously logged in directly via Discord), the UPDATE violates the partial unique index `idx_users_discord_id`. `updateUser` has no constraint handling (the try/catch in `findOrCreateUser` only wraps the INSERT path), so the error propagates to the handler's generic catch → 500 "Authentication failed". Because the data condition persists, **every subsequent XIVAuth login for that user fails deterministically** until someone manually merges the rows in D1.
- **Evidence:**
  ```ts
  // user-service.ts:57-63 — merge path, no constraint handling
  if (existingUser) {
    return await updateUser(db, existingUser.id, {
      discord_id: existingUser.discord_id || discord_id,  // may collide with another row
      ...
  ```
  ```sql
  -- users.sql:20
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL;
  ```
- **Reproduction:** 1) Login via Discord → row A (`discord_id=D`). 2) Login via XIVAuth with no Discord linked → row B (`xivauth_id=X`). 3) Link Discord `D` inside XIVAuth, login via XIVAuth again → lookup by X finds B → UPDATE sets `discord_id=D` → UNIQUE violation → 500. Repeats forever.
- **Why it evades testing:** `user-service.test.ts` covers create, simple merge (found-by-discord gets xivauth_id added), and the INSERT race. The two-pre-existing-rows collision requires a specific multi-session sequence nobody modeled.
- **Suggested fix:** In the merge path, detect the collision first (`SELECT id FROM users WHERE discord_id = ? AND id != ?`); if found, perform an explicit account merge (choose survivor row, move `xivauth_characters`, delete the other, then update) inside a `db.batch`, or at minimum catch the UNIQUE error and fall back to returning the row that owns `discord_id` without overwriting.

### BUG-10: Vote insert and `vote_count` update are not atomic — counter drift on partial failure

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/presets-api/src/handlers/votes.ts:33-77` (addVote), `91-131` (removeVote)
- **Description:** `addVote` runs two independent statements: `INSERT ... ON CONFLICT DO NOTHING` then `UPDATE presets SET vote_count = vote_count + 1`. The TOCTOU on *duplicate* votes is correctly solved, but the pair is not batched: if the worker is evicted, the request is cancelled, or D1 errors between the two statements, a `votes` row exists whose increment never landed (or, for remove, a deleted row whose decrement never landed). Drift is permanent — nothing reconciles `vote_count` with `COUNT(votes)`. The same non-atomic pattern exists in the duplicate-submission path (`presets.ts:479` auto-vote after create). `D1.batch()` is already used elsewhere in this file's sibling (`presets.ts:201-204` delete) so the primitive is available.
- **Evidence:**
  ```ts
  // votes.ts:36-41 then 59-64 — two separate round trips, no batch
  const insertResult = await db.prepare('INSERT INTO votes ... ON CONFLICT DO NOTHING')...run();
  ...
  const updateResult = await db.prepare('UPDATE presets SET vote_count = vote_count + 1 ... RETURNING vote_count')...first();
  ```
- **Reproduction:** Not deterministically reproducible — requires a failure between statements (worker limit hit, D1 transient error). Over months of traffic the counter skews; `sort=popular` ordering silently degrades.
- **Why it evades testing:** Both statements succeed in every test run; drift needs induced partial failure.
- **Suggested fix:** `await db.batch([insertStmt, updateStmt])` won't work directly because the update is conditional on `changes`; instead make the increment self-contained: `UPDATE presets SET vote_count = vote_count + (SELECT changes()) ...` is not expressible — simplest correct form is a single batch of `[INSERT OR IGNORE, UPDATE presets SET vote_count = (SELECT COUNT(*) FROM votes WHERE preset_id = ?) WHERE id = ?]`, which is idempotent, self-healing (recomputes truth), and atomic in a D1 batch.

### BUG-11: Moderation status change: audit log written before (and regardless of) the update; action derived from stale status

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/presets-api/src/handlers/moderation.ts:67-91`
- **Description:** The handler reads the preset (line 68), inserts a `moderation_log` row (78-83), then updates the status (86) — three separate, un-batched statements. Failure of the UPDATE leaves an audit record for an action that never happened. Two moderators acting concurrently both read the same old status, so `getActionFromStatusChange(preset.status, body.status)` (line 76) can log the wrong action name (e.g. both log `unflag`), and last-write-wins on status with no conflict signal. The revert handler has the inverse ordering problem (`moderation.ts:132-146`: revert first, log after — a failed log insert loses the audit trail for a performed revert).
- **Evidence:**
  ```ts
  // moderation.ts:78-86
  await c.env.DB.prepare(`INSERT INTO moderation_log ...`).bind(...).run();
  // Update preset status
  const updatedPreset = await updatePresetStatus(c.env.DB, presetId, body.status);
  ```
- **Reproduction:** Kill the worker (or induce D1 error) between the two statements; or have two moderators approve/reject the same pending preset within the same second and compare `moderation_log.action` against actual transitions.
- **Why it evades testing:** Sequential single-moderator tests always see both statements succeed.
- **Suggested fix:** Use `db.batch([logInsert, statusUpdate])` for atomicity; derive `action` from a conditional UPDATE (`UPDATE presets SET status=? WHERE id=? AND status=?` and check `meta.changes` to detect the concurrent-moderator case, returning 409 when 0).

### BUG-12: Daily submission limit is check-then-insert — concurrent requests exceed the cap

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/presets-api/src/services/rate-limit-service.ts:77-106`; caller `apps/presets-api/src/handlers/presets.ts:394`
- **Description:** `checkSubmissionRateLimit` does `SELECT COUNT(*)` and the INSERT happens later in the handler with no coordination. N parallel POSTs from one user at 9/10 used all read `count=9` and all insert, ending the day at 9+N. D1 has no cross-request transaction here and there's no constraint backstop (unlike the dye-signature race, which has a UNIQUE index).
- **Evidence:**
  ```ts
  // rate-limit-service.ts:93-102 — pure read; insert occurs ~5 awaits later in the handler
  const result = await db.prepare(query).bind(...).first<{ count: number }>();
  return { allowed: submissionsToday < DAILY_SUBMISSION_LIMIT, ... };
  ```
- **Reproduction:** Fire 10 simultaneous `POST /api/v1/presets` (distinct dye combos) at 9/10 quota; several succeed.
- **Why it evades testing:** Sequential tests; abuse impact is bounded (a few extra presets/day), which is also why this is LOW.
- **Suggested fix:** Accept the small overshoot (document it), or re-check the count *after* insert and delete-if-over, or maintain a `rate_limits` counter row (the table already exists unused in `schema.sql:120-125`) updated with `INSERT ... ON CONFLICT DO UPDATE SET count=count+1 RETURNING count` and reject when over.

### BUG-13: `moderation_log` 7-day stats compare mismatched datetime formats

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/presets-api/src/handlers/moderation.ts:192` (query) vs `75, 139` (writer uses `new Date().toISOString()`)
- **Description:** Rows are written with JS ISO format `2026-07-18T12:34:56.789Z`; the stats query compares against SQLite `datetime('now','-7 days')` which renders `2026-07-11 12:34:56` (space separator, no `Z`). SQLite compares TEXT lexicographically: for rows dated exactly on the boundary day, `'T' (0x54) > ' ' (0x20)` makes every ISO timestamp on that calendar day count as "after" the cutoff even when its time-of-day is earlier — `actions_last_week` over-counts by up to one day's worth of boundary-day actions. (Note `presets.created_at` uses the same ISO format from `createPreset`, so any future `datetime('now')` comparisons on presets inherit this hazard.)
- **Evidence:**
  ```ts
  // moderation.ts:192
  (SELECT COUNT(*) FROM moderation_log WHERE created_at > datetime('now', '-7 days')) as actions_last_week
  ```
- **Suggested fix:** Use one format everywhere: either write with `datetime('now')` defaults (drop the JS timestamp), or compare with `strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')`.

### BUG-14: oauth path-based rate-limit config: `/auth/xivauth/callback` gets the authorize limit; the callback branch is unreachable

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/oauth/src/services/rate-limit.ts:50-62`
- **Description:** `getConfigForPath` tests `path.startsWith('/auth/xivauth')` **before** `path.startsWith('/auth/xivauth/callback')`, so the XIVAuth callback always resolves to `OAUTH_LIMITS['/auth/discord']` (10/min) instead of the intended 20/min callback limit — the second branch's xivauth clause is dead code. Legitimate SPA token exchanges on XIVAuth are throttled at half the intended rate. (The DO variant `rate-limit-do.ts:43-51` iterates object insertion order and has the same shadowing: `/auth/xivauth` precedes `/auth/xivauth/callback`.)
- **Evidence:**
  ```ts
  // rate-limit.ts:52-58
  if (path.startsWith('/auth/discord') || path.startsWith('/auth/xivauth')) {
    return OAUTH_LIMITS['/auth/discord'];        // catches /auth/xivauth/callback too
  }
  if (path.startsWith('/auth/callback') || path.startsWith('/auth/xivauth/callback')) { ... } // unreachable for xivauth
  ```
- **Suggested fix:** Order most-specific-first (check `/callback` variants before the authorize prefixes), or match on exact pathname.

### BUG-15: Refresh grace-period arithmetic breaks on tokens without `exp`; `isJWTExpired` inverts for the same case

- **Kind:** BUG
- **Severity:** LOW (requires a token signed by us lacking `exp`; all current mint paths set it)
- **Location:** `apps/oauth/src/handlers/refresh.ts:82`; `apps/oauth/src/services/jwt-service.ts:277-316` (`verifyJWTSignatureOnly` requires `sub` but not `exp`), `321-327` (`isJWTExpired`)
- **Description:** In the refresh fallback, `decoded.exp + gracePeriod < now` with `exp === undefined` evaluates `NaN < now` → `false`, so a validly-signed token with no `exp` claim would be treated as *within* the grace period and refreshed into a fresh full-lifetime token — indefinitely. `verifyJWTSignatureOnly` was hardened to require `sub` (REFACTOR-001) but not `exp`, unlike `verifyJWT` which guards it (`jwt-service.ts:239-241`). Similarly `isJWTExpired` returns `false` (not expired) for a missing `exp`. Not exploitable without the signing key today, but it silently converts a hypothetical mis-minted eternal token into a self-renewing credential.
- **Evidence:**
  ```ts
  // refresh.ts:80-82
  const gracePeriod = 24 * 60 * 60;
  if (decoded.exp + gracePeriod < now) {   // NaN < now === false when exp is undefined
  ```
- **Suggested fix:** In `verifyJWTSignatureOnly`, also `if (!payload.exp) return null;` (matching `verifyJWT`); make `isJWTExpired` return `true` when `exp` is missing.

### BUG-16: Token refresh never revokes the old token and has no absolute session lifetime

- **Kind:** BUG
- **Severity:** MEDIUM (security hardening gap rather than functional break)
- **Location:** `apps/oauth/src/handlers/refresh.ts:96-137`
- **Description:** `/auth/refresh` checks revocation of the old jti (97-108) but does not revoke it after minting the replacement, and the new token copies claims with a fresh `iat/exp` and no origin-`iat` carried forward. Consequences: (1) after refresh, both old and new tokens are simultaneously valid until the old one's natural expiry — "rotation" without invalidation; (2) a stolen token can be kept alive forever by refreshing at least once per `exp + 24h` window — there is no maximum session age, and nothing re-validates the user against D1 (a deleted user's token refreshes indefinitely).
- **Evidence:**
  ```ts
  // refresh.ts:110-133 — new token minted; no revokeToken(payload.jti, ...) call anywhere in the handler
  const newJti = crypto.randomUUID();
  const newPayload: JWTPayload = { sub: payload.sub, iat: now, exp: newExpiry, ... };
  ```
- **Reproduction:** Refresh a token; call `/auth/me` with the *old* token → still 200 until its exp. Chain refreshes daily → session never ends.
- **Why it evades testing:** `refresh.test.ts` verifies the new token works, not that the old one stops working or that chains terminate.
- **Suggested fix:** After minting, `await revokeToken(payload.jti, payload.exp, c.env.TOKEN_BLACKLIST)` (best-effort); carry an `orig_iat` claim forward and reject refresh when `now - orig_iat > MAX_SESSION_SECONDS` (e.g. 30 days); optionally confirm the user still exists via `findUserById`.

### BUG-17: `previous_values` audit snapshot is overwritten on each flagged edit despite "append-only audit log" comment

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/presets-api/src/handlers/presets.ts:296-311`; `apps/presets-api/src/services/preset-service.ts:417-420, 458-463`
- **Description:** The comment block (presets.ts:306-310, "PRESETS-CRITICAL-004 ... append-only audit log") claims audit history is preserved, but the column holds a single JSON object: each new flagged edit replaces `previous_values` with the immediately-prior state (preset-service.ts:417-420), and a moderator revert nulls it (preset-service.ts:461). Two successive flagged edits leave only the middle state recoverable; the original is gone. The code matches "last-known-good snapshot" semantics, not the documented compliance/audit-trail semantics — one of the two is wrong.
- **Suggested fix:** Either fix the comment (snapshot semantics are arguably fine for revert), or store an array (append) / write superseded snapshots into `moderation_log.reason`-adjacent storage before overwriting.

### BUG-18: Bot API secret compared with non-constant-time `===`

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/presets-api/src/middleware/auth.ts:99`
- **Description:** `token === c.env.BOT_API_SECRET` is an early-exit string comparison. Remote timing exploitation over Cloudflare's edge is impractical, but the codebase already standardized on constant-time comparison for HMACs (oauth FINDING-001), and `@xivdyetools/auth` is already imported here. Cheap consistency win.
- **Suggested fix:** HMAC both values with a random per-isolate key and compare digests, or use `crypto.subtle.timingSafeEqual` (available in Workers) on equal-length encodings.

### BUG-19: presets-api Content-Type enforcement trusts `Content-Length` — chunked bodies bypass it

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/presets-api/src/index.ts:144-163`
- **Description:** The 415 gate only fires when `content-length` is present and > 0 (`hasBody`, line 150). A request with `Transfer-Encoding: chunked` (no Content-Length) and a wrong/absent Content-Type skips the check. Downstream, `jsonDepthLimit` (`middleware/body-validation.ts:50-52`) *also* returns early for non-JSON content types, so such a body reaches `c.req.json()` unvetted for depth/prototype pollution (Hono's json() will parse it regardless of header). Defense-in-depth erosion only — handlers still try/catch parse errors.
- **Suggested fix:** Treat "method is POST/PATCH/PUT and content-type is not application/json" as 415 outright (no `hasBody` gate), which also restores the depth-limit coverage.

---

## REFACTORING OPPORTUNITIES

### REFACTOR-01: Finish JWT consolidation onto `@xivdyetools/auth` (carried over from REFACTOR-001/2026-05-28)

- **Kind:** REFACTOR
- **Priority:** HIGH
- **Location:** `apps/oauth/src/services/jwt-service.ts` (entire file); `apps/oauth/src/handlers/refresh.ts:287-301`; `apps/oauth/package.json:16-23`
- **Current state:** oauth maintains ~410 lines of hand-rolled JWT create/verify. It is now behaviorally aligned with the shared verifier (HS256 pinning, `sub` required, constant-time verify) but the alignment is enforced only by comments — the next edit can silently diverge again (BUG-15 shows one residual gap: `exp` optionality differs). Three mint paths exist (`createJWT`, `createJWTForUser`, `createJWTFromPayload`); `createJWT` and `isJWTExpired` are production-dead (test-only usage confirmed via grep).
- **Proposed:** Add `@xivdyetools/auth` to oauth; delegate `verifyJWT`/`verifyJWTSignatureOnly` to it (keeping the oauth-specific revocation/KV wrappers local); collapse minting to `createJWTForUser` + one internal `signPayload` used by refresh; delete `createJWT`/`isJWTExpired` (migrate tests).
- **Benefits:** Single source of truth for verification-critical logic; removes the recurring drift class this audit and the prior one both flagged.
- **Effort:** MEDIUM. **Risk:** LOW-MEDIUM — token format is unchanged (HS256/same claims); needs careful test migration since 40+ test call sites use `createJWT`.

### REFACTOR-02: Durable Object rate limiter is fully dead code (unbound, unexported, flag never set)

- **Kind:** REFACTOR
- **Priority:** MEDIUM
- **Location:** `apps/oauth/src/durable-objects/rate-limiter.ts` (240 lines); `apps/oauth/src/services/rate-limit-do.ts` (114 lines); `apps/oauth/src/index.ts:132-145`; `apps/oauth/wrangler.toml` (no `[[durable_objects.bindings]]`, no `[[migrations]]`, no `USE_DO_RATE_LIMITING` var in any env)
- **Current state:** The runtime path requires `USE_DO_RATE_LIMITING === 'true' && c.env.RATE_LIMITER` (index.ts:137). Neither exists in `wrangler.toml` (any environment), and the `RateLimiter` class is not exported from `src/index.ts`, so it could not deploy as a DO even if bound. Every deployment therefore uses the per-isolate `MemoryRateLimiter` — meaning the brute-force protection on `/auth/*` resets per isolate/colo and an attacker rotating through colos or waiting for isolate churn gets far more than 10 req/min effective. Additional latent issue if ever enabled: the DO `alarm()` reschedules itself unconditionally every 2 minutes forever (`rate-limiter.ts:233-239`), so every IP that ever authenticates leaves a DO waking eternally (cost leak); it should stop rescheduling when `requestLog` is empty.
- **Proposed:** Decide: (a) wire it up — export the class from index.ts, add the DO binding + migration + `USE_DO_RATE_LIMITING`, fix the alarm to go quiescent, fix the config-shadowing (BUG-14 twin) — or (b) delete both files and the branch in index.ts. Given auth endpoints are the highest-value brute-force target in the ecosystem, (a) is recommended.
- **Benefits:** Either real distributed rate limiting or ~360 fewer lines of maintenance surface and a simpler index.ts.
- **Effort:** LOW (delete) / MEDIUM (enable). **Risk:** LOW.

### REFACTOR-03: Duplicate rate-limiter singletons and dead public-rate-limit service in presets-api

- **Kind:** REFACTOR
- **Priority:** LOW
- **Location:** `apps/presets-api/src/services/rate-limit-service.ts:28-61` vs `apps/presets-api/src/middleware/rate-limit.ts:17-32`
- **Current state:** Two independent `MemoryRateLimiter` singletons are constructed with identical config. The middleware one is the only one used for IP limiting; `checkPublicRateLimit` and the re-exported `getClientIp` in rate-limit-service.ts have no production callers (grep: only self-references). Anyone importing the service function would silently consume a *different* bucket than the middleware.
- **Proposed:** Delete `checkPublicRateLimit`/`getClientIp` from rate-limit-service.ts (keep the D1 submission-limit half) or re-export the middleware's instance.
- **Benefits:** Removes a confusing dual-bucket trap. **Effort:** LOW. **Risk:** LOW (verify no external test imports first).

### REFACTOR-04: State expiry validation is caller-optional — move it into `verifyState`

- **Kind:** REFACTOR
- **Priority:** MEDIUM
- **Location:** `apps/oauth/src/utils/state-signing.ts:53-96`; callers `callback.ts:73-79` (inline, tolerates missing exp), `xivauth.ts:195-204` (uses `validateStateExpiration`, requires exp)
- **Current state:** `signState` always embeds `iat`/`exp`, but `verifyState` never checks them; each callback re-implements expiry differently (Discord's inline check `stateData.exp && stateData.exp < now` accepts a state with no `exp`; XIVAuth's helper rejects it). A future consumer of `verifyState` can silently accept eternal states.
- **Proposed:** Validate `exp` inside `verifyState` (throw on missing/expired for signed states; the `allowUnsigned` dev path may stay lenient), delete the per-handler checks.
- **Benefits:** Security invariant enforced at the primitive, not by caller discipline; removes divergence. **Effort:** LOW. **Risk:** LOW.

### REFACTOR-05: Discord and XIVAuth OAuth handlers are ~80% duplicated

- **Kind:** REFACTOR
- **Priority:** MEDIUM
- **Location:** `apps/oauth/src/handlers/authorize.ts:32-119` vs `xivauth.ts:58-143` (authorize); `callback.ts:31-120` vs `xivauth.ts:150-238` (GET callback); `callback.ts:132-324` vs `xivauth.ts:248-534` (POST exchange)
- **Current state:** Both providers repeat: PKCE param validation, redirect-uri allowlisting, state signing, error-redirect construction, state verification + expiry, redirect validation, token exchange with timeout, scope validation, user-field validation, findOrCreateUser, JWT mint, and the sanitized catch block — with small drifts already visible (BUG-08's three allowlists; expiry check divergence in REFACTOR-04; Discord logs less than XIVAuth). Every fix must be applied 2x and history shows it isn't.
- **Proposed:** Provider-config-driven flow: `{ authUrl, tokenUrl, requiredScopes, mapUserInfo(tokens) }` per provider feeding shared `buildAuthorizeHandler(provider)` / `buildCallbackHandlers(provider)`.
- **Benefits:** Halves the security-critical surface; makes BUG-08-class drift structurally impossible. **Effort:** MEDIUM-HIGH. **Risk:** MEDIUM (touches the live auth path; needs the existing test suites ported carefully).

### REFACTOR-06: `handlers/presets.ts` is a 776-line module mixing routing, validation, caching, retry/backoff, and dead-letter persistence

- **Kind:** REFACTOR
- **Priority:** LOW
- **Location:** `apps/presets-api/src/handlers/presets.ts:521-775` (category cache, notification payload types, retry/backoff, `notifyDiscordBot`, `storeFailedNotification`)
- **Current state:** The notification subsystem (retry config, jitter, service-binding call, dead-letter insert) and the category cache live inside the routes file; `moderation.ts` separately queries `failed_notifications`, so the dead-letter feature is split across two handler files with no service.
- **Proposed:** Extract `services/notification-service.ts` (notify + storeFailedNotification + retry policy) and `services/category-service.ts` (cache + validation); handlers keep only HTTP concerns.
- **Benefits:** Testability of retry/dead-letter logic in isolation; shorter high-churn file. **Effort:** LOW-MEDIUM. **Risk:** LOW (pure moves).

### REFACTOR-07: Unused `rate_limits` table in presets schema

- **Kind:** REFACTOR
- **Priority:** LOW
- **Location:** `apps/presets-api/schema.sql:120-128`
- **Current state:** No code reads or writes `rate_limits` (grep confirms zero references outside the schema). Either drop it or use it for BUG-12's counter backstop.

---

## OPTIMIZATION OPPORTUNITIES

### OPT-01: `storeCharacters` — N+1 sequential inserts plus non-atomic delete/insert

- **Kind:** OPT
- **Impact:** MEDIUM
- **Location:** `apps/oauth/src/services/user-service.ts:195-213`; caller `xivauth.ts:475-484`
- **Current:** On every XIVAuth login: one DELETE round trip, then one INSERT round trip **per character** in a `for` loop. A 10-character account = 11 sequential D1 calls on the login critical path; a failure mid-loop leaves the user with a partial character list until next login.
- **Proposed:** `db.batch([deleteStmt, ...characters.map(insertStmt)])` — one round trip, atomic.
- **Expected improvement:** Removes ~N×D1-RTT from login latency (tens to hundreds of ms for multi-character accounts) and closes the partial-write window.
- **Trade-offs:** None meaningful; batch size is bounded by account character counts.

### OPT-02: Moderation status change and preset update each re-fetch the row they just wrote

- **Kind:** OPT
- **Impact:** LOW-MEDIUM
- **Location:** `apps/presets-api/src/services/preset-service.ts:311-324` (`updatePresetStatus` → `getPresetById`), `436-437` (`updatePreset` → `getPresetById`), `465-478` (`revertPreset` → `getPresetById`); `apps/presets-api/src/handlers/moderation.ts:68-86` (getPresetById + insert + update + implicit re-fetch = 4 sequential round trips)
- **Current:** Write-then-read pattern doubles D1 round trips on every mutation, and the re-read races with concurrent writers (returned entity may not reflect this request's write alone).
- **Proposed:** D1 supports `RETURNING` (already used in `votes.ts:61`): `UPDATE presets SET ... WHERE id = ? RETURNING *` collapses each pair to one statement; combine with the BUG-11 batch to bring the moderation status route from 4 round trips to 2.
- **Expected improvement:** ~50% fewer D1 calls on all preset mutations; lower tail latency for moderation actions.
- **Trade-offs:** `RETURNING *` rows still need `rowToPreset` parsing; no behavior change otherwise.

### OPT-03: `POST /presets` issues a redundant COUNT after every successful create

- **Kind:** OPT
- **Impact:** LOW
- **Location:** `apps/presets-api/src/handlers/presets.ts:394, 504`
- **Current:** The handler runs `checkSubmissionRateLimit` (COUNT) before create, then `getRemainingSubmissions` (the same COUNT) after create just to compute `remaining_submissions`.
- **Proposed:** Reuse the pre-check result: `remaining_submissions = rateLimitResult.remaining - 1`.
- **Expected improvement:** One fewer D1 query per submission.
- **Trade-offs:** Off-by-one only in exotic concurrent cases already covered by BUG-12's semantics; acceptable for a display hint.

### OPT-04: `getPresets` window-function total reports 0 for out-of-range pages

- **Kind:** OPT (correctness nuance of a prior optimization)
- **Impact:** LOW
- **Location:** `apps/presets-api/src/services/preset-service.ts:177-201`
- **Current:** `COUNT(*) OVER()` is only readable when at least one row is returned. For `page` beyond the last page, `rows.length === 0` → `total = 0` and `has_more = false`, so a client paginating past the end sees the collection "shrink" to zero instead of the stable total. Clients that display `total` after over-paging show wrong counts.
- **Proposed:** When `rows.length === 0 && page > 1`, fall back to a `SELECT COUNT(*)` with the same WHERE (rare path, one extra query only when over-paging), or return `total: null` and document it.
- **Trade-offs:** Extra query only on the empty-page path.

### OPT-05: Per-isolate in-memory rate limiting for oauth `/auth/*` endpoints understates protection

- **Kind:** OPT
- **Impact:** MEDIUM (security-adjacent)
- **Location:** `apps/oauth/src/services/rate-limit.ts:35-38` with `apps/oauth/src/index.ts:132-145`
- **Current:** With the DO path dead (REFACTOR-02), limits like "10/min per IP" for `/auth/discord` are actually 10/min *per isolate*; Cloudflare spreads traffic across many isolates/colos, so real attacker throughput is a multiple of the configured limit, and limits reset on isolate recycle.
- **Proposed:** Enable the DO limiter (preferred, see REFACTOR-02) or switch the shared `@xivdyetools/rate-limiter` backend to KV/Upstash for these low-QPS endpoints.
- **Expected improvement:** Configured limits become globally meaningful against credential-stuffing/token-grinding.
- **Trade-offs:** DO/KV adds a few ms per auth request and a small cost; auth QPS is low so both are negligible.

---

## Summary matrix

| ID | Kind | Severity | Where |
|----|------|----------|-------|
| BUG-01 | BUG | CRITICAL | presets-api presets.ts:282,316-322 |
| BUG-02 | BUG | HIGH | presets-api moderation-service.ts:85 |
| BUG-03 | BUG | HIGH | presets-api schema.sql:81 / preset-service.ts:243 |
| BUG-09 | BUG | HIGH | oauth user-service.ts:57-67 |
| BUG-04 | BUG | MEDIUM | presets-api presets.ts:363-372 |
| BUG-05 | BUG | MEDIUM | presets-api preset-service.ts:132 |
| BUG-06 | BUG | MEDIUM | presets-api presets.ts:61-62 |
| BUG-07 | BUG | MEDIUM | both index.ts env-validation middleware |
| BUG-08 | BUG | MEDIUM | oauth callback.ts:83-109 |
| BUG-10 | BUG | MEDIUM | presets-api votes.ts:36-64 |
| BUG-11 | BUG | MEDIUM | presets-api moderation.ts:74-86 |
| BUG-16 | BUG | MEDIUM | oauth refresh.ts:96-133 |
| BUG-12..15,17..19 | BUG | LOW | see above |
| REFACTOR-01 | REFACTOR | HIGH | oauth jwt-service.ts |
| REFACTOR-02 | REFACTOR | MEDIUM | oauth DO rate limiter |
| REFACTOR-04 | REFACTOR | MEDIUM | oauth state-signing.ts |
| REFACTOR-05 | REFACTOR | MEDIUM | oauth provider handlers |
| REFACTOR-03/06/07 | REFACTOR | LOW | see above |
| OPT-01 | OPT | MEDIUM | oauth user-service.ts:195-213 |
| OPT-05 | OPT | MEDIUM | oauth rate-limit.ts |
| OPT-02/03/04 | OPT | LOW-MED | presets-api services |

**Immediate action (high impact, low effort):** BUG-01 (status-transition guard), BUG-05 (status whitelist), BUG-06 (clamp pagination), BUG-07 (cache validation result), BUG-14 (reorder branches), OPT-01 (batch), OPT-03 (drop redundant COUNT).
**Plan next sprint:** BUG-02 (CJK matcher), BUG-03 (partial unique index migration), BUG-08 (shared allowlist helper), BUG-09 (merge collision handling), BUG-16 (rotate + absolute lifetime), REFACTOR-01, REFACTOR-02 decision.
