# Review — unit `pkg-foundation`

Deploy units: `@xivdyetools/types` (2.x), `@xivdyetools/logger` (2.x), `@xivdyetools/auth` (2.0.1) — each ships by
`npm publish`, so every defect below is a *published-package* defect, not a worker deploy.

Repo root read: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main e7ac4042).
Read-only: no git, no tests, no builds, no source edits.

---

## 1. Map

| Deploy unit | Module | Runtime surface |
|---|---|---|
| types | `color/branded.ts` | `createHexColor` / `createDyeId` / `createHue` / `createSaturation` (the only validators in the package) |
| types | `color/match-quality.ts` | `MATCH_QUALITY_TIERS`, `classifyMatchDistance` (consumed by discord-worker `/gradient`) |
| types | `color/rgb.ts`, `color/colorblind.ts` | pure type decls |
| types | `auth/discord-snowflake.ts` | `isValidSnowflake` (env-validation in 4 workers + bot-logic) |
| types | `character/index.ts` | `RACE_SUBRACES`, `SUBRACE_TO_RACE` (web-app swatch/config-sidebar, discord-worker preferences) |
| types | `error/app-error.ts`, `error/codes.ts` | `AppError`, `ErrorCode` |
| types | `dye/*`, `preset/*`, `api/*`, `auth/*` (except snowflake), `localization/*` | pure type decls, no runtime code |
| logger | `core/base-logger.ts` | `BaseLogger` (redaction, sanitizer, child/delegation, `safeStringify`) — 784 lines, the whole risk surface |
| logger | `constants.ts` | `CORE_REDACT_FIELDS` (23), `WORKER_REDACT_FIELDS` (+4) |
| logger | `adapters/console-adapter.ts` | pretty + JSON console output (`ConsoleAdapter`, `@public`) |
| logger | `adapters/json-adapter.ts` | `console.log(safeStringify(entry))` — the path every CF Worker uses via worker-kit |
| logger | `adapters/noop-adapter.ts` | discards (default logger for `@xivdyetools/core`) |
| logger | `presets/browser.ts` | `createBrowserLogger`, `browserLogger`, errorTracker forwarding |
| logger | `presets/worker.ts` | `createWorkerLogger` / `createRequestLogger` (consumed by `worker-kit/middleware/logger.ts`) |
| logger | `presets/library.ts` | `NoOpLogger`, `ConsoleLogger`, `createLibraryLogger` (core, stoat-worker) |
| auth | `jwt.ts` | `verifyJWT`, `verifyJWTSignatureOnly`, `decodeJWT` (oauth, presets-api) |
| auth | `hmac.ts` | key LRU cache, `hmacSign(Hex)`, `hmacVerify(Hex)`, bot signature v2 |
| auth | `timing.ts` | `timingSafeEqual` (discord-worker `/github` auth, moderation-worker, presets-api) |
| auth | `discord.ts` | `verifyDiscordRequest` (Ed25519 via `discord-interactions@4.4.0` + freshness + size caps) |
| auth | `revocation.ts` | `isTokenRevoked`, `revokeToken`, `REFRESH_GRACE_SECONDS` (oauth, presets-api) |
| auth | `encoding/base64.ts`, `encoding/hex.ts` | Base64URL + hex, also exposed on the `/encoding` subpath |

---

## 2. Candidates

### pkg-foundation-01 — BUG — MEDIUM — `packages/logger/src/core/base-logger.ts:301-307` (and `:408-410`)
**Claim:** a cyclic log context leaks the *unredacted original* node — the cycle guard returns the raw
reference, so everything reachable through the back-edge is emitted verbatim.

**Failing input → wrong outcome** (`@xivdyetools/logger`, `JsonAdapter`, i.e. every CF Worker via worker-kit):
```ts
const inner: LogContext = { token: 'shhh' };
const ctx: LogContext = { items: [inner] };
inner.back = ctx;                     // cycle
logger.info('array cycle', ctx);
```
`redactSensitiveFields(inner)` correctly writes `token: '[REDACTED]'` into its **copy**, then recurses into
`inner.back` → `ctx` is on `ancestors` → `return context` hands back the *original* `ctx`, whose
`items[0]` is the *original* `inner` with `token: 'shhh'`. `safeStringify` then walks that raw subtree
(it only marks the second back-edge `[Circular]`), so the emitted line contains `"token":"shhh"`.

**Why tests miss it:** the two cycle tests assert liveness, not redaction — see pkg-foundation-02.
**Covered by test:** no.
```ts
    if (g.ancestors.has(context)) {
      // Genuine cycle on the CURRENT path — leave as-is rather than
      // recursing forever. …
      return context;          // ← raw, unredacted original
    }
```
**Fix direction:** return a sentinel (`'[Circular]'`) instead of the raw node from both guards — the
already-redacted copy is unreachable at that point anyway, and `safeStringify` produces the same marker.

---

### pkg-foundation-02 — UNTESTED — HIGH priority — `packages/logger/src/core/base-logger.test.ts:751-758`
**Claim:** the test that builds pkg-foundation-01's exact leak asserts only `not.toThrow()`.

**Behaviour it was supposed to catch:** "a secret reachable only through a cycle is still redacted".
The fixture even names the secret (`{ token: 'shhh' }`) and then never looks at it; the sibling test at
`:741-749` at least checks `context?.name`, but not the cycle branch's content either.
**Covered by test:** no (the test cannot fail on the redaction outcome).
```ts
  it('does not recurse forever on a cycle reached through an array', () => {
    const inner: LogContext = { token: 'shhh' };
    const cyclic: LogContext = { items: [inner] };
    inner.back = cyclic;
    expect(() => logger.info('array cycle', cyclic)).not.toThrow();   // only assertion
  });
```
**Fix direction:** assert on the emitted JSON (`expect(line).not.toContain('shhh')`), the way
`hardening.test.ts` already does for the non-cyclic cases.

---

### pkg-foundation-03 — BUG — MEDIUM — `packages/logger/src/adapters/console-adapter.ts:62` and `:104`
**Claim:** `ConsoleAdapter` serialises with raw `JSON.stringify`, so a circular or BigInt context throws
out of the log call — the exact failure mode FINDING-026 fixed, applied only to `JsonAdapter`.

**Failing input → wrong outcome:**
```ts
const ctx: LogContext = { a: 1 }; ctx.self = ctx;
ConsoleLogger.info('x', ctx);   // TypeError: Converting circular structure to JSON
createLibraryLogger('stoat').info('x', { n: 1n }); // TypeError: Do not know how to serialize a BigInt
```
Redaction does **not** break the cycle (pkg-foundation-01: it re-inserts the original node), so the
`JSON.stringify` on line 62 sees a real cycle and throws, taking down the caller. Live consumers of this
adapter: `apps/stoat-worker` (`createLibraryLogger`), `@xivdyetools/logger`'s `ConsoleLogger` /
`browserLogger` / `createBrowserLogger`, and any npm consumer — `ConsoleAdapter` is `@public`.

**Why tests miss it:** `hardening.test.ts` builds its `capture()` helper on `JsonAdapter` only;
`console-adapter.test.ts` has no circular/BigInt case at all (`grep -i 'circular|bigint'` → 0 hits).
**Covered by test:** no.
```ts
    if (context && Object.keys(context).length > 0) {
      parts.push(JSON.stringify(context));      // line 62 — throws
    }
    …
    const jsonStr = JSON.stringify(entry);      // line 104 — throws
```
**Fix direction:** use `safeStringify` in both `writePretty` and `writeJson` (it is already exported from
`core/base-logger.ts` and imported by `json-adapter.ts`).

---

### pkg-foundation-04 — BUG — MEDIUM — `packages/logger/src/core/base-logger.ts:196` + `:251-254`
**Claim:** `sanitizeErrorMessage`'s unquoted value pattern stops at the first space, so an
`Authorization: Basic …` / `Authorization: Bot …` header (and any `key = two word secret`) is redacted
down to its **scheme word only** and the credential survives.

**Failing input → wrong outcome:**
```ts
logger.warn('upstream rejected Authorization: Basic dXNlcjpwYXNzd29yZA==');
//  →  '… authorization=[REDACTED] dXNlcjpwYXNzd29yZA=='       (credential leaked)
logger.warn('rejected: token = my secret value');
//  →  'rejected: token=[REDACTED] secret value'               (2 of 3 words leaked)
```
`V` is `(?:["']([^"']*?)["']|[^\s,;]+)`; the unquoted arm excludes whitespace. `Bearer` is safe because
of the dedicated `/Bearer\s+\S+/gi` pass on line 216 and the `(?!Bearer\s)` lookahead on 252; `Basic` and
Discord's own `Bot` scheme have neither. A `Bot <real-discord-token>` is rescued only incidentally by
`DISCORD_TOKEN_VALUE_PATTERN` (line 235). The method's own doc comment (lines 183-187, 192) still
describes the *older* pattern `[^\s,;'"]+(?:\s+[^\s,;'"=]+)*` "including spaces before delimiter" — the
comment and the code disagree, which is why this reads as covered.

**Why tests miss it:** the only Authorization case in the suite is
`base-logger.test.ts:266` `'Authorization: Bearer token123abc failed'` — the one scheme that *is* handled.
Context **fields** named `authorization` are safe (key-name list), so only free text is affected.
**Covered by test:** no.
```ts
    const V = `(?:["']([^"']*?)["']|[^\\s,;]+)`;                       // 196
    …
    .replace(
      new RegExp(`["']?authorization["']?\\s*[=:]\\s*(?!Bearer\\s)${V}`, 'gi'),
      'authorization=[REDACTED]',                                      // 251-254
    )
```
**Fix direction:** for the authorization rule consume the rest of the line
(`(?!Bearer\s)[^\n,;]+`), or restore the space-tolerant unquoted arm the comment already documents.

---

### pkg-foundation-05 — UNTESTED — MEDIUM — `packages/auth/src/jwt.ts:80-84, 246, 251-253`
**Claim:** `VerifyJWTOptions.clockToleranceSeconds` (`@public` via `packages/auth/src/index.ts:44-45`)
has zero tests and zero consumers, yet it is the only knob that can widen `exp`/`nbf` acceptance.

**Behaviour untested:** `payload.exp + skew < now` and `payload.nbf - skew > now`. Both signs are
currently correct, but a sign flip on either line (`exp - skew`, `nbf + skew`) would keep every existing
test green while silently extending or shrinking the accepted window by the tolerance. The suite covers
`exp`, `nbf`, `iss`, `aud`, `type`, claim typing and `maxAgeMs` (`jwt.test.ts:317-435`) — never `skew`.
**Covered by test:** no.
```ts
    const skew = options?.clockToleranceSeconds ?? 0;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp + skew < now) return null;
    if (payload.nbf !== undefined && payload.nbf - skew > now) return null;
```
**Fix direction:** two tests with `vi.setSystemTime` — a token expired 30 s ago accepted at
`clockToleranceSeconds: 60` and rejected at `0`; the mirror case for `nbf`.

---

### pkg-foundation-06 — UNTESTED — MEDIUM — `packages/types/src/color/branded.test.ts:291-297`
**Claim:** the only assertion is inside `if (id !== null)`, so a regression that makes `createDyeId(42)`
return `null` passes the test named for it.

**Behaviour it was supposed to catch:** `createDyeId` returning a usable branded value for a valid
stainID. (The `describe('valid stainIDs')` block above does cover the value; this one is pure noise and
matches the brief's "guarded `if (…) { expect }` with no else" shape.)
**Covered by test:** no.
```ts
  it('DyeId should be assignable from valid createDyeId result', () => {
    const id = createDyeId(42);
    if (id !== null) {            // ← a null regression skips the body
      const dyeId: DyeId = id;
      expect(dyeId).toBe(42);
    }
  });
```
**Fix direction:** `expect(createDyeId(42)).not.toBeNull()` before the narrowing, or drop the test.

---

### pkg-foundation-07 — BUG — LOW — `packages/types/src/color/branded.ts:130-134, 158-160`
**Claim:** `createHue` and `createSaturation` pass `NaN` straight through as a branded value, while the
sibling `createDyeId` guards for exactly that.

**Failing input → wrong outcome:** `createHue(NaN) === NaN`, `createHue(Infinity) === NaN`
(`Infinity % 360` is `NaN`), `createSaturation(NaN) === NaN` (`Math.max(0, Math.min(100, NaN))` is `NaN`).
The JSDoc promises "Normalizes hue to 0-360 range" / "Clamps saturation to 0-100 range"; a `NaN` `Hue`
propagates into HSV→RGB conversion downstream and yields a garbage colour with no error.
**Why tests miss it:** `branded.test.ts` tests NaN/Infinity for `createDyeId` (`:139-146`) and never for
the other two.
**Covered by test:** no.
```ts
export function createHue(hue: number): Hue {
  const normalized = ((hue % 360) + 360) % 360;   // NaN in → NaN out
  return normalized as Hue;
}
```
**Fix direction:** `if (!Number.isFinite(x)) return 0 as Hue;` (or throw, matching `createHexColor`) in
both factories, plus the four missing cases.

---

### pkg-foundation-08 — BUG — LOW — `packages/logger/src/core/base-logger.ts:346-355`
**Claim:** redaction destroys every non-plain object in a log context — a `Date`, `Error`, `Map`, `Set`
or `URL` under a context key is emitted as `{}`.

**Failing input → wrong outcome:** `logger.info('cache', { expiresAt: new Date() })` emits
`"expiresAt":{}`. Without redaction `JSON.stringify` would have produced the ISO string. The recursion
treats *every* non-null, non-array `object` as a plain bag and spreads it (`{ ...context }`), and a
`Date`'s value is internal so the spread yields `{}`.
**Why tests miss it:** no test puts a `Date`/`Error`/`Map` in a context. No in-repo consumer does either
(checked: all `timestamp:` values are already `.toISOString()` strings) — this is a published-API
contract defect for npm consumers, which is why it is LOW rather than MEDIUM.
**Covered by test:** no.
```ts
        if (Array.isArray(value)) {
          redacted[key] = this.redactArrayItems(value, g);
        } else {
          redacted[key] = this.redactSensitiveFields(value as LogContext, g);  // 353
        }
```
**Fix direction:** short-circuit non-plain objects (`Object.getPrototypeOf(v) === Object.prototype ||
v === null`) — pass `Date`/`Error`/`URL` through untouched (they already serialise correctly) and only
recurse into plain objects.

---

### pkg-foundation-09 — BUG — LOW — `packages/logger/src/presets/browser.ts:120-126`
**Claim:** the errorTracker fallback branch uses raw `JSON.stringify(error)`, so a non-`Error` throw
value that is circular throws out of `logger.error` in production.

**Failing input → wrong outcome:** with `createBrowserLogger({ errorTracker })` in production
(`!isDevMode`), `logger.error('failed', circularObj)` throws `TypeError` from line 123 *after* the
console line already succeeded — the caller's catch path is what breaks, not the log.
**Why tests miss it:** `browser.test.ts` exercises the branch only with a string and a plain object.
**Covered by test:** no.
```ts
      } else if (error) {
        errorTracker.captureMessage(
          logger.sanitizeMessage(
            `${message}: ${typeof error === 'string' ? error : JSON.stringify(error)}`,   // 123
          ), 'error');
```
**Fix direction:** reuse the package's own `safeStringify`, which is already exported from
`core/base-logger.ts` for exactly this.

---

### pkg-foundation-10 — UNTESTED — LOW — `packages/logger/src/presets/browser.test.ts:88-117`
**Claim:** two tests named for `NODE_ENV` detection assert only `expect(logger).toBeDefined()`.

**Behaviour they were supposed to catch:** `defaultIsDev()`'s `process.env.NODE_ENV` arm and the config
it selects (`level: 'debug' | 'warn'`, `sanitizeErrors: !isDevMode`). Nothing observes either. The file's
own comment (lines 118-130) concedes the arms are unreachable from a test — so these two `it` blocks
cannot fail on anything and should be deleted rather than left as apparent coverage.
**Covered by test:** no.
```ts
      it('should detect production via process.env.NODE_ENV', () => {
        process.env.NODE_ENV = 'production';
        const logger = createBrowserLogger({});
        logger.debug('Should not appear');
        expect(logger).toBeDefined();          // only assertion
      });
```
**Fix direction:** delete both, or inject `isDev` and assert on the console spy (the level split *is*
observable that way).

---

### pkg-foundation-11 — UNTESTED — LOW — `packages/types/src/character/index.ts:113, 127`
**Claim:** `RACE_SUBRACES` and `SUBRACE_TO_RACE` are two hand-maintained inverse tables with no test
asserting they are inverses; `Record<SubRace, Race>` type-checks the *keys*, never the pairing.

**Behaviour untested:** `SUBRACE_TO_RACE['Duskwight'] = 'Lalafell'` (or any single mis-paste) compiles
clean and ships. Consumers: `apps/web-app/src/components/swatch-tool.ts:125`,
`components/v4/config-sidebar.ts:100`, `apps/discord-worker/src/types/preferences.ts:211` — a wrong
pairing mislabels a clan in the race picker in both surfaces. There is no `character/*.test.ts` at all.
**Covered by test:** no.
**Fix direction:** one round-trip test —
`for (const [race, subs] of Object.entries(RACE_SUBRACES)) subs.forEach(s => expect(SUBRACE_TO_RACE[s]).toBe(race))`
plus a key-count equality check. (Both objects are also plain mutable exports; `as const` /
`Object.freeze` would stop a consumer mutating shared game data.)

---

### pkg-foundation-12 — OPT — LOW — `packages/logger/src/core/base-logger.ts:189-267`
**Claim:** `sanitizeErrorMessage` compiles **15 regexes on every call** — 13 `new RegExp(...)` plus 2 from
`withGlobalFlag` — and it is called once per log line (`createEntry:115`) plus once per error message,
with `sanitizeErrors: true` the worker default.

**Cost:** every `logger.info()` in every Worker request pays 15 regex compilations + 15 `.replace`
passes over the message. All 15 patterns are constant (`V` and `K` are pure string builders over
literals); nothing depends on the call arguments.
**Fix direction:** hoist the 15 compiled `RegExp`s (and a `[pattern, replacement]` table) to module scope
next to `SECRET_VALUE_PATTERNS`, then `reduce` over it. Behaviour-identical — the patterns carry `g`, so
reuse across calls needs `lastIndex` care only if they were used with `.exec`/`.test`, which they are not
(`String.prototype.replace` with a `g` regex resets `lastIndex` itself).

---

### pkg-foundation-13 — REFACTOR — LOW — `packages/auth/package.json:62`
**Claim:** `peerDependencies["@cloudflare/workers-types"]: "^4.0.0"` while the package's own devDep
(`:57`) and **all eight** in-repo Worker consumers are on `^5.20260828.1`.

**Effect:** silent in-repo (pnpm's `strict-peer-dependencies=false` default plus
`peerDependenciesMeta.optional: true` — the install log has zero `peer` lines), but an external npm
consumer on npm 7+ with workers-types 5 installed hits `ERESOLVE`. `packages/worker-kit/package.json:66`
has the identical mismatch (out of this unit).
**Fix direction:** widen to `"^4.0.0 || ^5.0.0"` in both packages on the next publish.

---

### pkg-foundation-14 — REFACTOR — LOW — `packages/types/src/color/branded.ts:66-77`
**Claim:** the `DyeId` **type** doc still advertises the pre-v2 contract that `createDyeId` immediately
below now rejects: *"Synthetic IDs for Facewear dyes: negative numbers <= -1000 … generated by
DyeDatabase for Facewear dyes"*. Schema v2 moved Facewear to `FacewearColor` (string slug ids) and
`createDyeId` returns `null` for every negative (tested at `:120-124`).
**Fix direction:** replace the type's doc block with the stainID window text already written on
`createDyeId` (`:82-90`).

---

## 3. POSITIVE — do not re-file

- `createHexColor` is fully anchored (`/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/`), handles the 3-digit form,
  case-normalises, and rejects 8-digit/`#`-less/whitespace forms — all six shapes are tested
  (`branded.test.ts:46-95`). No `as HexColor` cast bypassing it exists in the package.
- JWT alg pinning is correct and tested for both `none` and `HS384`, on both `verifyJWT` and
  `verifyJWTSignatureOnly`; claim typing (`hasWellTypedClaims`) rejects string `exp`, object `exp` and
  non-string `sub`; `iat: 0` is handled as valid (`jwt.test.ts:342`).
- Signature comparison never touches JS string compare — `crypto.subtle.verify` throughout; `timingSafeEqual`
  pads to equal length *and* re-checks the original lengths, with a covered XOR fallback.
- `hexToBytes` rejects odd-length and non-hex input by throwing, and both `hmacVerifyHex` and
  `discord-interactions`' `verifyKey` catch it into `false` — an odd-length signature cannot fault a route.
- Discord verification checks freshness *before* reading the body, and measures the body in **bytes**
  (`TextEncoder`), not UTF-16 units (BUG-059).
- Logger redaction key matching is case- and separator-insensitive (`normalize()` + `redactSet`), so
  `Token`/`TOKEN`/`jwtSecret` all hit — the 2026-08 case-sensitivity regression has not returned.
- `safeStringify`'s path-scoped cycle detection plus the fail-**closed** `MAX_STRINGIFY_NODES` bound is
  right, and `hardening.test.ts:221-360` asserts on the emitted string rather than the in-memory tree.
- `revokeToken` TTL = `exp + REFRESH_GRACE_SECONDS − now` clamped to 60 s, with both sides of the
  FINDING-001 contract tested including the already-expired case.

## 4. REJECTED

- *`base64UrlDecodeBytes` mis-pads a `length % 4 === 1` string* — it does (`'A' → 'A==='`), but `atob`
  throws and every call site (`decodeJWT`, `verifyJWTSignature`, `hmacVerify`) is inside a `try` that
  returns `null`/`false`. Fail-closed.
- *`getOrCreateHmacKey` cache key `${secret}:${usage}` could collide* — `usage` is a closed set of
  `sign|verify|both`, so no secret pair produces the same key. LRU refresh-on-hit is correct.
- *`verifyBotSignatureV2` uses `parseInt` on a user-controlled timestamp* — the raw timestamp **string**
  is inside the signed canonical message, so a lenient parse cannot buy an attacker anything.
- *`canonicalV2` length-prefixes with UTF-16 units* — the prefix is only needed for injectivity, and
  greedy-digit + `:` + N-unit decoding is unique for the fixed 8-field vector. No collision.
- *`verifyDiscordRequest` returns the body on an invalid signature* — deliberate and tested
  (`discord.test.ts:195`); callers gate on `isValid`.
- *`isTokenRevoked` fail-open on a KV error* — documented, deliberate, and echoed in
  `presets-api/src/middleware/auth.ts:83`.
- *Workers runtime detection at module scope* — there is none in this unit; the presets are explicit
  factories. `browserLogger` is the only module-scope side effect and it just reads `import.meta.env`.
- *`shouldLog` fails open on an unknown level* (`indexOf` → `-1`) — no consumer passes an unvalidated
  string; `createWorkerLogger`'s `level` is a typed union and every in-repo call site omits it or passes
  a literal.
- *`DelegatingLogger.setContext` mutates the caller's object* (`base-logger.ts:560`) — reachable, but
  `child(ctx)` callers in-repo pass object literals; cosmetic.
- *`AppError.toJSON` always includes `stack`* — `BaseLogger.formatError` never calls it (it reads
  `error.message`/`error.name` directly and drops `stack` when `sanitizeErrors`), so no leak path.
- *`hmacVerify*` swallows `createHmacKey`'s "secret < 32 bytes" throw into `false`* — fail-closed;
  a misconfigured secret rejects everything rather than accepting it.

## 5. COVERED

**43 files read** (32 non-test sources in full + 11 test files skimmed/read).

Non-test sources (32) — `packages/types/src/`: `index.ts`, `color/branded.ts`, `color/match-quality.ts`,
`color/rgb.ts`, `color/colorblind.ts`, `color/index.ts`, `dye/dye.ts`, `dye/dye-filters.ts`,
`dye/facewear.ts`, `dye/index.ts`, `auth/discord-snowflake.ts`, `auth/index.ts`, `character/index.ts`,
`error/app-error.ts`, `error/codes.ts`, `error/index.ts`, `localization/index.ts` (plus
`api/*`, `preset/*`, `auth/{discord,jwt,provider,response,xivauth}.ts` confirmed declaration-only by
`grep '^export (const|function|class|enum)'`).
`packages/logger/src/`: `index.ts`, `constants.ts`, `types.ts`, `core/index.ts`, `core/base-logger.ts`,
`adapters/index.ts`, `adapters/console-adapter.ts`, `adapters/json-adapter.ts`, `adapters/noop-adapter.ts`,
`presets/index.ts`, `presets/browser.ts`, `presets/worker.ts`, `presets/library.ts`.
`packages/auth/src/`: `index.ts`, `jwt.ts`, `hmac.ts`, `timing.ts`, `revocation.ts`, `discord.ts`,
`encoding/index.ts`, `encoding/base64.ts`, `encoding/hex.ts`. Plus `packages/auth/package.json`.

Tests read or skimmed (11): `types/color/branded.test.ts`, `types/color/match-quality.test.ts`,
`types/auth/discord-snowflake.test.ts`, `logger/core/hardening.test.ts`, `logger/core/base-logger.test.ts`,
`logger/adapters/console-adapter.test.ts`, `logger/types.test.ts`, `logger/presets/browser.test.ts`,
`auth/jwt.test.ts`, `auth/hmac.test.ts`, `auth/encoding/hex.test.ts` (case lists also read for
`auth/{timing,discord,discord-freshness,bot-signature-v2,revocation}.test.ts`,
`auth/encoding/base64.test.ts`, `logger/adapters/{json,noop}-adapter.test.ts`,
`logger/presets/{worker,library}.test.ts`).

Supporting reads outside the unit (for consumer-reachability claims only, not reviewed):
`apps/*/src` + `packages/{core,bot-logic,worker-kit}/src` import greps,
`apps/web-app/src/shared/logger.ts`, `node_modules/.pnpm/discord-interactions@4.4.0/dist/{index,util}.js`.
