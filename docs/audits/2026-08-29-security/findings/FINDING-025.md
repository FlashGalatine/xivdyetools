# FINDING-025: `@xivdyetools/logger` value-shape redaction never reaches string items inside arrays or the `message` / `error.message` text — a bare JWT or Discord token there logs verbatim
**Severity:** LOW · **Exposure:** every Worker (package) · **Deploy unit:** logger (package) → all consumers · **Rotation:** NONE · **CWE:** CWE-532

## Location
- `packages/logger/src/core/base-logger.ts:242-248` — array items are recursed only when they are objects; string items pass through unscanned
- `packages/logger/src/core/base-logger.ts:66-69,143-193,411-421` — the key-name and value-shape scans apply to context values, not to `message` or `error.message`

## Evidence
- `logger.info(\`token ${jwt}\`)` or `logger.warn('x', { tokens: ['eyJ…'] })` is emitted unredacted; `packages/logger/src/__tests__/hardening.test.ts` covers nested objects and `token = …` pairs only.

## Fix
- Run the value-shape scan over string array items and over `message` / `error.message`; add the three cases to `hardening.test.ts`; logger patch release.

## Status
FIXED 2026-08-31 (logger 2.1.1) — commits `425cd1d0`, `617c907e`, `b3800667`, `b1ec25aa`.

**One of the finding's two claims was stale.** `message` / `error.message` were already routed
through `sanitizeErrorMessage` by the 2026-08-21 audit (FINDING-026); what they lacked was the
*value-shape* scan, so a token with a key name in front of it was caught but a bare one was not.
The array-item claim was exactly right.

What shipped: string items inside arrays (and arrays nested in arrays) now get the same
`looksLikeSecretValue` treatment a top-level string value gets; the JWT and Discord-token shapes
run over free text as **substring** redaction, leaving surrounding prose diagnosable. The
`/^[A-Fa-f0-9]{64,}$/` shape was deliberately **not** applied to free text — inside a message a
64-hex run is far more likely a sha256 digest or cache key, and this package must not eat its
consumers' log lines (verified: a 45-line corpus of realistic innocent log lines — git SHAs,
UUIDs, stack frames, URLs, snowflakes, data URIs, CJK — passes through byte-identical).

**Three defects found by review, all closed here, none of them in the finding:**
1. A value **aliased at two keys** was redacted once and logged verbatim the second time — the
   cycle guard was a global seen-set rather than an ancestor path. This defeated the finding's own
   example whenever the array was referenced twice, and the test named "still redacts the same
   object seen twice at different keys" asserted only the first copy, which is why it stayed
   invisible.
2. The first fix bounded its walk with a node budget that **failed open** — past 4998 object/array
   nodes a subtree was emitted unscanned, so padding a context disabled redaction for what
   followed (key-name matches included), deterministically and in key order. Replaced by
   memoization: every node processed once, no cutoff to fail past.
3. Memoization made aliases reference-identical, which turned `safeStringify`'s own global
   seen-set into **data loss** — every repeated object serialising as `"[Circular]"` on the
   `JsonAdapter` path all nine workers use. Fixed by path-scoping that set too.

**Residuals, recorded rather than closed:** a cycle's back-edge still serialises one unredacted
copy of the ancestor (a follow-up may close it — see the plan); plural sensitive key names
(`tokens`, `secrets`, `apiKeys`) never match the `/(token|secret|password|apikey)$/` suffix rule,
so a secret under one is caught only if its *value* matches a shape; anything opaque — a Discord
webhook token, an `sk-live-…` key — matches no shape and is not caught anywhere; `Date`/`Map`/
`Set`/`URL` in a context still serialise to `{}`; and a ~3000-deep array or ~6000-deep object
context throws `RangeError` out of the log call (pre-existing; briefly masked by the budget).
