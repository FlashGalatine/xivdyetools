# Review: discord-handlers

Scope: `apps/discord-worker/src/handlers/commands/` (18 files), `apps/discord-worker/src/handlers/buttons/` (3 source files), no other subfolder of `handlers/` exists. Read-only review against `docs/audits/2026-09-16-deep-dive/evidence/reviewer-brief.md`.

## 1. Map

| File | Role |
|---|---|
| `commands/index.ts` | Barrel re-export of all command handlers |
| `commands/about.ts` | `/about` — version/registry roster/attribution |
| `commands/accessibility.ts` | `/accessibility`, `/a11y` — colour-vision cards (adapter over bot-logic) |
| `commands/budget.ts` | `/budget find\|set_world\|quick` — 13G ledger, Universalis-priced |
| `commands/changelog.ts` | `/changelog` — bundled `CHANGELOG-laymans.md` parse + render |
| `commands/comparison.ts` | `/comparison` — 2–4 dye duel/triangle (adapter) |
| `commands/contrast.ts` | `/contrast` — WCAG ratio cards (adapter) |
| `commands/dye.ts` | `/dye search\|info\|list\|random` |
| `commands/extractor.ts` | `/extractor color\|image` — palette match + image-worker binding |
| `commands/gradient.ts` | `/gradient` — gradient card (adapter) — **zero test file** |
| `commands/harmony.ts` | `/harmony` — harmony palette (adapter) |
| `commands/manual.ts` | `/manual` — help topics, Lodestone region resolution |
| `commands/mixer-v4.ts` | `/mixer` — dye blending (adapter) — **zero test file** |
| `commands/preferences.ts` | `/preferences show\|set\|reset\|filters` |
| `commands/preset.ts` | `/preset list\|show\|random\|submit\|vote\|edit\|favorite` (1410 lines) |
| `commands/preset-notifications.ts` | Shared moderation-channel embed/button builder (not a command) |
| `commands/stats.ts` | `/stats summary\|overview\|commands\|preferences\|health` |
| `commands/swatch.ts` | `/swatch` — `.chara` frame, hardened attachment download |
| `buttons/copy.ts` | `copy_hex_/copy_rgb_/copy_hsv_` button handlers + `createCopyButtons` |
| `buttons/index.ts` | Button custom_id router |
| `buttons/preview-image.ts` | `previewimg_approve_/reject_` moderation buttons (this app's own token) |

## 2. Candidates

**discord-handlers-01** — UNTESTED / MEDIUM — `apps/discord-worker/src/handlers/commands/gradient.ts` (whole file, 240 lines)
Claim: no test file exists anywhere in the repo for this command (`find … -iname "*gradient*"` returns only the source file), and `commands/index.test.ts` only smoke-loads the barrel.
Failing input → wrong outcome: any change to `processGradientCommand`'s embed assembly, the BUG-032 stainID/itemID emoji fix, or the ΔE label logic can regress silently — nothing red.
Why tests miss it: no suite imports the module directly.
Covered by test: no.
```ts
export async function handleGradientCommand(...): Promise<Response> { ... }
async function processGradientCommand(...): Promise<void> { ... }
```
Fix direction: add `gradient.test.ts` mirroring `harmony.test.ts` / `comparison.test.ts` coverage (happy path, invalid color, render failure).

**discord-handlers-02** — UNTESTED / MEDIUM — `apps/discord-worker/src/handlers/commands/mixer-v4.ts` (whole file, 133 lines)
Claim: same as above — no `mixer-v4.test.ts` / `mixer.test.ts` anywhere in the repo.
Failing input → wrong outcome: `NO_MATCHES` vs other-error branching (line 89-98), the render try/catch, and the blending-mode/matching-method resolution are all unverified.
Why tests miss it: no suite imports the module directly.
Covered by test: no.
```ts
if (!result.ok) {
  const message = result.error === 'NO_MATCHES' ? t.t('errors.noMatchFound') : t.t('errors.generationFailed');
  if (result.error !== 'NO_MATCHES') { markCommandOutcome(interaction, 'render'); ... }
```
Fix direction: add a test file exercising both `NO_MATCHES` and `GENERATION_FAILED` paths plus a happy path.

**discord-handlers-03** — BUG / MEDIUM — `apps/discord-worker/src/handlers/commands/preset.ts:817-827`
Claim: `/preset edit` places a dye at the wrong array index when the edited position is more than one slot past the preset's current dye count.
Failing input → wrong outcome: existing preset has 3 dyes (`dyes: [1,2,3]`); user runs `/preset edit preset:<id> dye6:"Snow White"` (skipping dye4/dye5). Loop variable `i=5` (dye6), `newDyeIds.length === 3`, so `i < newDyeIds.length` is false and the code does `newDyeIds.push(stainId)`, landing the new dye at **index 3** (the 4th position) instead of index 5 — the palette silently shows "Snow White" as dye #4, not dye #6, with no error to the user.
Why tests miss it: `preset.test.ts:980` ("edits preset with dye addition extending array") only covers the adjacent case — setting `dye4` when 3 dyes already exist — where `push()` happens to land correctly by coincidence. No test sets a position more than one past the current length.
Covered by test: no (only the adjacent-append case is tested).
```ts
for (let i = 0; i < 6; i++) {
  const dyeName = updates.dyeNames[i];
  if (dyeName) {
    ...
    if (i < newDyeIds.length) { newDyeIds[i] = stainId; }
    else { newDyeIds.push(stainId); }   // always appends at the END, not at index i
  }
}
```
Fix direction: either reject edits that skip ahead of `newDyeIds.length + 1`, or pad with a validation error naming the missing intermediate slot, instead of silently mis-positioning.

**discord-handlers-04** — REFACTOR / LOW — `apps/discord-worker/src/handlers/commands/preset.ts:571,576,924`
Claim: `notifySubmissionChannel`, `notifyModerationChannel`, `notifyEditModerationChannel` all accept an optional `logger` and use it to record failures (see `preset-notifications.ts` `sendModerationNotification`, "BUG-074: the Discord API outcome is checked and logged"), but none of the three call sites pass one, so a failed submission-log or moderation-channel post is caught internally and vanishes with no observability.
Failing input → wrong outcome: `SUBMISSION_LOG_CHANNEL_ID`/`MODERATION_CHANNEL_ID` post 4xx/5xx or throws → swallowed silently, operators never see it in logs.
Why tests miss it: tests assert the Discord API call was made, not that a failure would be logged.
Covered by test: no.
```ts
if (isApproved && env.SUBMISSION_LOG_CHANNEL_ID) {
  await notifySubmissionChannel(env, preset, 'approved');   // no logger
}
if (!isApproved && env.MODERATION_CHANNEL_ID) {
  await notifyModerationChannel(env, preset);   // no logger
}
```
Fix direction: thread `logger` through from the calling `process*Command` functions (already in scope) to these three calls.

**discord-handlers-05** — BUG / MEDIUM — `apps/discord-worker/src/handlers/commands/manual.ts:255-283,314-352`
Claim: `/manual topic:spectrum_prices` answers with an immediate (non-deferred, `type: 4`) response, but on the way there it `await`s `resolveLodestoneRegion()`, which on an isolate's first call (or after the 1-hour cache expiry) makes two live `UNIVERSALIS_PROXY` service-binding round trips, each with a 10-second `REQUEST_TIMEOUT` (`services/budget/universalis-client.ts:79`). This is exactly the class of problem BUG-034 (cited in the same file) already diagnosed — but that fix only added the 1-hour module cache; it did not move this topic onto the deferred path. A cold cache still runs live network work inside the 3-second Discord ack budget.
Failing input → wrong outcome: user with a stored `world` preference runs `/manual topic:spectrum_prices` on a fresh isolate (or >1h after the last such call) while the api-worker Universalis fetch is even mildly slow → Discord shows "The application did not respond" even though a correct embed would eventually have been produced.
Why tests miss it: `manual.test.ts` presumably mocks `getCachedWorlds`/`getCachedDataCenters` to resolve instantly, so timing is never exercised.
Covered by test: no (timing/cold-cache path not exercised).
```ts
const link = topicId === 'spectrum_prices'
  ? await resolveLodestoneRegion(env, prefs.world)   // can block ~up to 10-20s
  : getLearnLink(topicId, locale);
...
return Response.json({ type: 4, data: { embeds, flags: 64 } });  // non-deferred
```
Fix direction: either defer this topic's response like every image-generating command, or give `resolveLodestoneRegion` its own short timeout (well under 3s) so a slow/cold path degrades to "no link" instead of racing the ack.

**discord-handlers-06** — BUG / MEDIUM — `apps/discord-worker/src/handlers/commands/stats.ts:556`
Claim: `/stats health`'s "Configuration" field hardcodes `const workerEnv = 'production'` with the comment "Workers don't have a built-in environment indicator" — false in this repo, which wires `env.ENVIRONMENT` (`"development"` on beta, `"production"` on live; see `apps/discord-worker/CLAUDE.md`) specifically so `validateEnv` and other code can distinguish them. The beta bot's `/stats health` always claims to be production.
Failing input → wrong outcome: run `/stats health` on the beta/dev worker (`ENVIRONMENT=development`) → embed still prints `**Environment:** production`, misleading whoever is using this command to diagnose which deployment they're looking at.
Why tests miss it: `stats.test.ts:892` asserts `expect(configField!.value).toContain('production')` against a `mockEnv` that never sets `ENVIRONMENT` at all — the test pins the hardcoded literal rather than exercising the real value, the same "BOT_VERSION" pattern this very file documents as BUG-037 one function away.
Covered by test: yes, but the test enshrines the bug (see BUG-037 comment in this same file for the identical prior pattern).
```ts
// Environment info (Workers don't have a built-in environment indicator)
const workerEnv = 'production';
...
`**Environment:** ${workerEnv}`,
```
```ts
// stats.test.ts:892
expect(configField!.value).toContain('production');
```
Fix direction: read `env.ENVIRONMENT ?? 'production'` (mirroring `about.ts`'s package-version pattern) and update the test to assert against the mocked value, including a beta/dev case.

## 3. POSITIVE

- Every user-content string reaching a public embed goes through `sanitizePresetName`/`sanitizePresetDescription`/`sanitizeEmbedText` consistently across `preset.ts`, `preset-notifications.ts`, `dye.ts`, `budget.ts`, `swatch.ts` — no bare echo of typed input found anywhere in scope.
- `preview-image.ts`'s BUG-039 fix (using `safeSendFollowUp` instead of the raw REST call, so a 4xx/5xx in the catch path no longer vanishes) is real and complete; the whole handler correctly uses `ctx.waitUntil` + `DEFERRED_UPDATE_MESSAGE` for the 3-second budget.
- `swatch.ts`'s `readTextCapped` correctly treats a missing/lying `Content-Length` header as "keep streaming and cap by real bytes," not as license to buffer unbounded (`Number(null)` → NaN → falls through to the streaming cap, which is correct).
- `commands/index.test.ts` already fixed its own "cannot fail" barrel-export smoke test (documented `discord-handlers-16` from a prior pass) down to one load assertion plus a real registry-vs-dispatch drift gate — a good pattern, not to be re-flagged.
- `budget.ts`/`preferences.ts` world resolution consistently distinguishes "unset," "unknown," and "upstream (Universalis down)" (BUG-031) rather than collapsing them into one misleading message, across both `/budget` and `/preferences set world:`.
- `/preferences set` batches all provided keys into a single KV read-modify-write (BUG-029 fix) rather than the earlier per-option round trip that could lose writes under KV's one-write-per-second-per-key limit.
- Every image-generating adapter command (`accessibility`, `comparison`, `contrast`, `harmony`, `dye info/random`, `extractor`) follows the same defer → background render → `safeEditOriginalResponse` shape with a `try/catch` that calls `markCommandOutcome` before answering — no floating promise or unhandled rejection found in any of them.

## 4. REJECTED

- `budget.ts:379-381` (`groups[0].rows[0]` accessed unguarded) — checked `budget-calculator.ts`: a group is only created (`grouped.set`) when its first row is accepted, so `groups[0].rows` can never be empty; `result.groups.length === 0` is already handled earlier. Not reachable.
- `swatch.ts:89` (`Number(response.headers.get('content-length'))` could be `NaN`) — `Number.isFinite(NaN)` is false, so the guard correctly falls through to the byte-counted streaming path instead of skipping the cap. Not a bug.
- `extractor.ts:449` (`Number(colorsOption.value)` unguarded) — `colors` is a Discord `INTEGER`-typed slash option; Discord validates and delivers a real number before the interaction reaches this code, so `Number()` on it cannot produce `NaN` in practice.
- `preferences.ts` `handleFiltersSetSubcommand`/`handleFiltersResetSubcommand` doing a raw `env.KV.get` → mutate → `env.KV.put` without going through `setPreferences` (the same lost-update shape BUG-029 fixed for `/preferences set`) — this is the whole file's documented, deliberately-deferred limitation (`services/preferences.ts` header: "BUG-036 ... KNOWN LIMITATION (fix deferred)"), not an unfixed regression specific to the filters path.
- `about.ts:118` (`dyeDatabase.length`) — `dyeDatabase` here is `@xivdyetools/core`'s raw `dyes.json` array export (125 entries), not the `DyeDatabase` class instance from `.initialize()`; `.length` is a valid array property. Not a bug.
- `dye.ts` `sendRandomFallback` re-running `executeRandom()` with a fresh draw instead of reusing the dyes whose card failed to render — cosmetic only: the user never saw the first draw (the whole response was still in-flight), so a different-but-still-valid random set is not a wrong outcome.

## 5. COVERED

20 non-test source files read in full: `commands/about.ts`, `commands/accessibility.ts`, `commands/budget.ts`, `commands/changelog.ts`, `commands/comparison.ts`, `commands/contrast.ts`, `commands/dye.ts`, `commands/extractor.ts`, `commands/gradient.ts`, `commands/harmony.ts`, `commands/index.ts`, `commands/manual.ts`, `commands/mixer-v4.ts`, `commands/preferences.ts`, `commands/preset.ts`, `commands/preset-notifications.ts`, `commands/stats.ts`, `commands/swatch.ts`, `buttons/copy.ts`, `buttons/index.ts`, `buttons/preview-image.ts`.

Callees read as far as needed to confirm claims: `types/preset.ts` (id/key validators), `services/budget/budget-calculator.ts`, `services/budget/universalis-client.ts`, `services/preferences.ts` (BUG-036 header + `applyPreference`), `packages/core/src/index.ts` (`dyeDatabase` export).

Test files skimmed (grep for `toBeDefined()`/`not.toThrow()`/typeof-function patterns, plus targeted reads) for coverage/vacuousness: `commands/index.test.ts`, `commands/stats.test.ts`, `commands/preset.test.ts`, plus a repo-wide check confirming no test file exists for `gradient.ts` or `mixer-v4.ts`.

Total: 25 files read/grepped for this review.
