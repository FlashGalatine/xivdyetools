# [DEAD-019]: auth `hmacSign` / `hmacVerify` / `hmacSignHex` have zero callers — while four apps hand-roll the same HMAC code

## Category
Unused Export (DEAD) + Duplicate — adopt-or-delete

## Location
- `packages/auth/src/hmac.ts:124-141` (`hmacSign`), `161-189` (`hmacVerify`), `143-159` (`hmacSignHex`) — ~64 lines; `hmac.test.ts` (339 lines) is ~⅓ coverage of code with no runtime caller (~120 lines)
- Hand-rolled equivalents in apps (~90 lines total):
  - `apps/discord-worker/src/services/preset-api.ts:47-70` `generateRequestSignature` (importKey + sign + hex) ≡ `hmacSignHex(message, secret)`
  - `apps/moderation-worker/src/services/preset-api.ts:67-92` `generateRequestSignature` — same
  - `apps/discord-worker/src/utils/github-verify.ts:22-60` ≡ `hmacVerifyHex`
  - `apps/oauth/src/services/jwt-service.ts:44-85` `getSigningKey`/`signJwtData`/`verifyJwtData` ≡ `hmacSign`/`hmacVerify` (base64url)
- INTERNAL-ONLY (keep): `hmacVerifyHex` (used by `verifyBotSignature`), `createHmacKey` (used by `getOrCreateHmacKey`)

## Evidence
`git grep -nw hmacSign|hmacVerify|hmacSignHex` outside `packages/auth` → 0 (README §HMAC and CHANGELOG 1.0 document them). The four app copies were read side-by-side with the package functions.

## Why It Exists
`@xivdyetools/auth` absorbed the crypto package on 2026-07-30 with its full HMAC API; the apps had already written their own before the shared helpers existed and never migrated.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that they are unused; the choice between the two remedies is the owner's |
| **Blast Radius** | Adopt: 4 app files (auth-sensitive code — needs its tests re-run); Delete: package-only |
| **Reversibility** | EASY |
| **Hidden Consumers** | None (npm-published; DEPRECATIONS.md names workspace consumers only) |

## Recommendation
**REFACTOR FIRST** — pick one: (a) *adopt* — replace the four hand-rolled copies with the package helpers (removes ~90 app lines, gains the key cache, one tested implementation), or (b) *delete* `hmacSign`/`hmacVerify`/`hmacSignHex` + their tests. (a) is the better engineering outcome; (b) is the smaller diff. Do not do both.

## Disposition (2026-08-18, follow-ups plan)
Adopted (a) for the two `preset-api.ts` sites: `apps/discord-worker/src/services/preset-api.ts` and `apps/moderation-worker/src/services/preset-api.ts` now call `hmacSignHex` from `@xivdyetools/auth` instead of hand-rolling `crypto.subtle` signing — verified byte-identical against pinned test vectors (`517046b5`). This was unblocked by adding a log-only `BOT_SIGNING_SECRET` ≥32-character check to both workers' `validateEnv`, satisfying `createHmacKey`'s minimum-key-length floor; production secrets were already ≥32 bytes in practice because presets-api verifies incoming signatures via `@xivdyetools/auth`, which enforces the same floor on its side. `apps/discord-worker/src/utils/github-verify.ts` was deliberately left as the one hand-rolled holdout — GitHub imposes no minimum length on `GITHUB_WEBHOOK_SECRET`, so there is no floor to check and no adoption blocker to clear, but also no forcing function to migrate it. See `packages/auth/CHANGELOG.md` (superseded note) and `DEAD_CODE_REPORT.md`'s "Post-cleanup follow-ups" section.
