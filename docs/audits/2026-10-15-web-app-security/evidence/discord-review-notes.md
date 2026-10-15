# Discord import review evidence and limitations

## Provenance and scope

Review date: 2026-10-15. This extends the initial web audit at documentation commit `c8cba17bc026a227884a9a9cc45683fa4f167b3e`, on `codex/glamour-import-audit`. Application source remains `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`: discord-worker 5.8.14, bot-logic 4.9.0 and core 5.12.0. These are snapshot versions.

The maintainer requested the equivalent Discord tool. `/glamour` is that command; `/swatch` is included because it uses the same attachment helper and core parser. Review covers command admission, attachment download, parsing/failure handling and outbound response fields. It does not assess unrelated bot commands or all other core consumers. The supplied pose files remain local reference data; their contents are not committed.

The independent source reviewer used `gpt-6.1-sol` at `medium`; the security verifier used `gpt-6-astra` at `high`. These explicitly resolved model/effort pairs match the project routing policy and were not overridden by the role templates. Both worked read-only. The coordinator captured probes and test results, wrote these documents and retained responsibility for commit/push. The verifier's complete final return is preserved below.

## Source map

Paths and line numbers refer to the application source snapshot above.

| Boundary | Source | Observation |
| --- | --- | --- |
| Command attachment | `apps/discord-worker/src/commands/schemas.ts:943` | Required ATTACHMENT described as `.chara`; a description is not validation |
| Shared admission guard | `apps/discord-worker/src/utils/chara-attachment.ts:17,65,75,79` | 1,048,576-byte metadata limit and URL check; no filename/MIME check |
| URL and download | `apps/discord-worker/src/utils/chara-attachment.ts:42,51,93,98,99,105` | HTTPS and exact `cdn.discordapp.com` / `media.discordapp.net` host allowlist; manual redirects, 10-second timeout, capped reader |
| Actual downloaded bytes | `apps/discord-worker/src/utils/read-text-capped.ts:43` | Running stream byte count; cancels above the cap, independent of declared size |
| Both adapters | `apps/discord-worker/src/handlers/commands/glamour.ts:113,139`; `swatch.ts:68,100` | Same guard before deferral and same download helper before command execution |
| Request authentication | `apps/discord-worker/src/index.ts:807,819` | Discord signature verification precedes interaction JSON parsing |
| Rate rejection | `apps/discord-worker/src/index.ts:953,971,1023,1027` | Rate check precedes command dispatch |
| Rate configuration | `packages/worker-kit/src/rate-limiter/presets/configs.ts:91,102,110`; `apps/discord-worker/src/services/rate-limiter.ts:4,42` | 15/minute per user and command: explicit swatch entry, default for glamour; limiter failures may fail open |
| Malformed-field work | `packages/core/src/services/chara/chara-parser.ts:268,323,384` | Full float-field splitting, whole invalid-value serialization, JSON parsing without core resource ceilings |
| Glamour parse failure | `packages/bot-logic/src/commands/glamour.ts:381,384,390,402` | Fixed localized failure and class/code logging; equipment resolution only after parsing succeeds |
| Swatch parse failure | `packages/bot-logic/src/commands/swatch.ts:204,219` | Same fixed localized refusal and failure classification |
| Public identity | `packages/bot-logic/src/commands/chara-identity.ts:46`; `swatch.ts:171` | Known producer constants only; nickname omitted from returned swatch character |
| Failure log values | `packages/bot-logic/src/commands/failure-kind.ts:14` | Exception class/code, never its message |
| Response boundary | `apps/discord-worker/src/handlers/commands/glamour.ts:175,184`; `swatch.ts:132` | Sanitized failure text capped at 1,024 characters; success sends PNG and selected embed fields, not the internal character object |
| Mentions | `apps/discord-worker/src/utils/discord-api.ts:31` | Outbound messages default to no allowed mentions |
| Equipment lookup | `apps/discord-worker/src/handlers/commands/glamour.ts:54` | Only equipment model and facewear IDs are forwarded to the equipment API |
| File-processing disclosure | `apps/discord-worker/PRIVACY_POLICY.md:86` | Describes downloading from Discord and in-memory parsing on Cloudflare |

The Discord signature authenticates the interaction sender, not the safety of user-supplied file data. A user has already uploaded the attachment to Discord before our guard runs. Extension rejection would prevent unnecessary worker downloads; it cannot reverse that upload. Rate limits are per-user/per-command mitigation, not a global bound or fail-closed guarantee. The downloaded-byte probe exercises the normal streamed-response path; the helper's no-body fallback was inspected in source, not presented as a streamed test.

## Reproduction and captured results

With workspace dependencies installed and built, run from the repository root:

```powershell
node --import tsx docs/audits/2026-10-15-web-app-security/evidence/scripts/probe-discord-chara-import.mjs . 'path/to/left.pose' 'path/to/right.pose'
```

[The script](scripts/probe-discord-chara-import.mjs) imports the actual attachment helpers and both bot command functions. All fetches are replaced with local responses; a rejecting fallback prevents real network calls, and the glamour equipment resolver is a counter stub. It does not invoke a live Discord command, send a message or render a successful response. Both sample arguments were provided for [the captured output](discord-parser-probes.json).

| Cases | Count | Result |
| --- | --- | --- |
| `.pose`, `.png`, `.txt`, uppercase `.CHARA` metadata | 4 | All accepted by the current guard; this establishes the missing extension check, not valid file contents |
| Non-CDN URL, HTTP URL, lookalike hostname | 3 | All rejected |
| Attachment metadata above 1 MiB | 1 | Rejected |
| Both supplied poses, each unchanged and renamed `.chara` | 4 | One mocked download per case; both commands return `PARSE_FAILED`, fixed public text, class/code-only logs, zero equipment resolver calls |
| 10,000-deep invalid `Skintone` (20,014 bytes) | 1 | Caught `RangeError` in both commands, fixed public text, zero equipment calls; below the 1 MiB cap |
| Malformed value with a private marker, mention and HTML-shaped text | 1 | Fixed public error; the supplied value does not appear in either captured log |
| Redirect response | 1 | Refused |
| Stream larger than the cap, with no declared length | 1 | Refused and cancelled after bounded chunk production |
| **Total** | **16** | **All expected outcomes observed** |

Every document probe also asserts manual redirect mode and an abort signal passed to fetch. The 10-second duration is source-confirmed; these mocks do not measure a real timeout. Stack limits vary by runtime: Node reproduces the nested diagnostic failure, while Cloudflare CPU/memory behavior and deployed availability were not measured. No service-level denial of service is claimed.

## Dependency setup and focused suites

Dependencies were installed in the isolated audit worktree with `pnpm install --frozen-lockfile`; the lockfile and application sources stayed unchanged. `pnpm turbo run build --filter=xivdyetools-discord-worker...` succeeded with eight cached build tasks restored. This establishes dependency availability, not eight fresh compilations or a deployed Worker build.

Initial sandboxed test attempts encountered missing transformed temporary modules (`ENOENT`). Repeating the same focused suites outside that sandbox completed successfully; the saved logs are the successful runs. These follow-up results do not resolve or replace the initial web component/API test limitations in [review-notes.md](review-notes.md).

| Command | Result | Capture |
| --- | --- | --- |
| `pnpm --filter xivdyetools-discord-worker exec vitest run src/utils/chara-attachment.test.ts src/handlers/commands/glamour.test.ts src/handlers/commands/swatch.test.ts --coverage.enabled=false` | 3 files, 54 tests passed | [Discord tests](discord-focused-tests.txt) |
| `pnpm --filter @xivdyetools/bot-logic exec vitest run src/commands/glamour.test.ts src/commands/swatch.test.ts src/commands/chara-identity.test.ts src/commands/failure-kind.test.ts --coverage.enabled=false` | 4 files, 161 tests passed | [Bot-logic tests](bot-logic-focused-tests.txt) |

Total: **215 focused tests passed**. Existing tests and the new audit probes are separate evidence; neither is a production penetration test. No application source or unit-test files were modified.

Document validation also passed: all 27 local links within this audit resolve, the repository link check resolved 1,015 links across 257 documents, and the version check matched all 34 claims in its scope. The saved probe passed Node's syntax check and all 16 cases after its assertions were tightened to require both expected log lines. Diff whitespace validation passed.

## Independent security verification — full final return

The following is the verifier's complete final return. Line references in its saved-probe citation refer to the capture reviewed by that agent; use the `deep malformed index` case label if formatting changes.

| id | Verdict | Reason with source |
|---|---|---|
| D1 | CONFIRMED | **INFO · INTERNET-AUTH · discord-worker** is appropriate: attachment guard checks presence, size and CDN URL, never filename/MIME (`apps/discord-worker/src/utils/chara-attachment.ts:65–83`). Both commands fetch through it; correct swatch references are **:68,100**. Early refusal prevents Worker download, not the prior Discord upload; arbitrary execution/upload is unproven. |
| D2 | CONFIRMED | **LOW provisional · INTERNET-AUTH** is defensible for core resource/diagnostic hardening exposed through Discord. Saved `discord-parser-probes.json:122–138` records 20,014 bytes, caught `RangeError`, fixed errors and zero equipment lookups; catches are `packages/bot-logic/src/commands/glamour.ts:384–391` and `swatch.ts:204–219`. Prioritize bounds over extension checks; no measured service-level DoS supports escalation. |
| D3 | CONFIRMED | Exact HTTPS host allowlist, manual redirects, 10-second fetch timeout and streamed 1 MiB cap exist (`chara-attachment.ts:42–54,97–105`; `read-text-capped.ts:43–66`). Signature precedes dispatch and rate rejection precedes handlers (`apps/discord-worker/src/index.ts:807–819,953–971`); both commands have configured 15/min **per-user, per-command** limits, not a global or fail-closed guarantee (`configs.ts:91,102,110–115`; `services/rate-limiter.ts:4–9,42`). |
| D4 | CONFIRMED | Parser failures publish fixed localized text and log class/code; nickname is excluded and producer output uses constants (`glamour.ts:381–394`; `swatch.ts:171–174,204–219`; `chara-identity.ts:46–55`). Adapters publish **PNG plus selected embed fields**, cap failure text at 1,024 characters, and default mentions off; complete input reaches Cloudflare, while equipment API receives model/glasses IDs (`handlers/commands/glamour.ts:54–65,175–190`; `utils/discord-api.ts:31–32`; `PRIVACY_POLICY.md:86–92`). |

The saved script/results support all 16 mocked cases; they exercise source helpers and command logic with package dependencies, not live Discord, signature enforcement, deployed rate limits or rendered responses. Report the supplied focused-suite/build counts separately; I reviewed their stated results, not independently reran those suites.

## Result and remaining limits

- Add FINDING-003 as INFO for early attachment-extension rejection; expand FINDING-002 to include authenticated server-side reachability and retain LOW on the demonstrated evidence.
- Prioritize bounded shared parsing/diagnostics when remediation is scheduled. Renaming a pose already bypasses an extension policy, so content and resource guards remain essential.
- No exploit that executes uploaded code, persistent service disruption, credential exposure or cross-user compromise was demonstrated. No live bot, end-to-end signature/rate-limit test, production load test or full privacy audit was performed.
- All findings remain open and deferred. No remediation, policy edit, release, deployment or merge is part of this follow-up.
