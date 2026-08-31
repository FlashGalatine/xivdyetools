# FINDING-015: bot→presets-api signature rollover never finished — v1 HMAC is still emitted by both bots and accepted by presets-api although the removal gate is met; the v2 nonce is bound but never replay-checked and the canonical string omits the query
**Severity:** LOW · **Exposure:** INTERNAL (service-binding / TLS traffic) · **Deploy unit:** auth (package) + presets-api + discord-worker + moderation-worker · **Rotation:** NONE · **CWE:** CWE-294 (capture-replay)
Supersedes the residual of `2026-08-21-security/FINDING-014`.

## Location
- `apps/presets-api/src/middleware/auth.ts:228-239` — `verifyBotSignature` (v1, `timestamp:userId:userName`, 5-min window, no request binding) accepted whenever `X-Request-Signature-V2` is absent
- Emitters still sending v1 + v2: `apps/discord-worker/src/services/preset-api.ts:147-160`, `apps/moderation-worker/src/services/preset-api.ts:146-159`; `packages/auth/src/hmac.ts:237-277` v1 still exported
- `packages/auth/src/hmac.ts:333,358-362` — nonce in the canonical string, no replay store anywhere (`grep -rn X-Request-Nonce` → signer/verifier only); `:298-299,326-338` — `path` only, no query

## Evidence
- `docs/operations/POST_MERGE_CHECKLIST.md:367` gate ("both bots + presets-api deployed on v2") was met 2026-08-28; its "tail shows only v2" check is unobservable (successful auths are not logged). Stripping the v2 header replays a captured v1 tuple against any route as that user; a captured v2 request replays for ≤ 120 s. Capture requires a Cloudflare-internal vantage point — INTERNAL.

## Fix
- Delete v1 acceptance, emitters and export (auth minor bump → both bots → presets-api); add a 120 s nonce cache (KV or memory) in presets-api; include the sorted query string in the canonical string.

## Status
FIXED 2026-08-31 (auth 2.0.0) — commits `e003aaa8`, `77e08c34`, `dc3b9405`.

The rollover is complete, and it closed in the only safe order: presets-api stopped **accepting**
v1 (Sprint 1, 2.2.0, with the nonce replay check), both bots stopped **sending** it (Sprints 3 and
4), and only then did the package drop the **export** (Sprint 11) — a MAJOR, because a public
symbol disappears.

`verifyBotSignature` and its tests are gone from `@xivdyetools/auth`; v2
(`createBotSignatureV2` / `verifyBotSignatureV2`) is untouched, and `BotSignatureOptions` survives
because v2 shares it — its JSDoc, which still advertised v1's five-minute default, now states v2's
60 s. **A plan-row error is worth recording:** the row said to delete
`createBotSignature`/`verifyBotSignature`, but no `createBotSignature` ever existed in this package.
The one in the repo was an unrelated local signer in `packages/test-utils`, removed in the same
sprint along with the three integration `describe` blocks that exercised it — they asserted against
a hand-rolled simulation of the removed middleware, so they could not fail for the right reason.

**Deliberately not done:** query-string signing (v3 / PKG-03) stays INFO, exactly as the row's own
"only if signer and verifier can move in lockstep" allows — it would need auth, both bots and
presets-api to move together, four deploy units in one sprint. And no deprecation release preceded
the removal; the audit's evidence had suggested one, and the plan chose straight removal. The cost
is theoretical (v1 shipped days ago, every in-repo consumer is `workspace:*`) but an external
consumer gets a build break rather than a warning, with the 2.0.0 migration note waiting for them.

**Follow-up:** the deleted integration blocks were the only tests that ever passed a truthy
`BOT_SIGNING_SECRET`, so presets-api's "signing secret configured, no valid signature ⇒
unauthenticated" branch now has no assertions. Restoring it — and a v2 happy path — needs the
harness ported to v2.

**Consumer halves, for the record:** PARTIAL — presets-api part FIXED 2026-08-30 01ea3dec (2.2.0: v1 signature no longer accepted; nonce validated and replay-checked through `TOKEN_BLACKLIST` (`botnonce:`, 120 s TTL, best-effort across colos)). discord-worker part FIXED 2026-08-30 1a0cf89f (5.1.0 no longer sends `X-Request-Signature`; `generateRequestSignature` deleted); moderation-worker part FIXED 2026-08-30 b5d4c53b (1.6.0 no longer sends `X-Request-Signature`; `generateRequestSignature` deleted); `@xivdyetools/auth` drops the v1 export in Sprint 11; query-string signing stays INFO (PKG-03).
