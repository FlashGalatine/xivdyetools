# FINDING-029: `.gitleaks.toml` allowlists whole directories (`tests?/`, `test-utils/`, `e2e/`, `__tests__/` — 49 tracked non-test files, incl. `packages/test-utils/src/auth/*`) and any *line* containing `DISCORD_CLIENT_ID` / `XIVAUTH_CLIENT_ID` / `storageKey:` — a real secret on such a path or line is never reported
**Severity:** LOW · **Exposure:** LOCAL (supply chain) · **Deploy unit:** repo / CI · **Rotation:** NONE · **CWE:** CWE-693 (protection mechanism failure)

## Location
- `.gitleaks.toml:19-28` — path allowlist by directory, not by `*.test.ts` file
- `.gitleaks.toml:31-38` — `regexTarget = "line"` allowlist: any line mentioning a client-id var name or `storageKey:` is exempt from every rule

## Evidence
- `git ls-files | grep -E '(^|/)(tests?|test-utils|e2e|__tests__)/' | grep -v -E '\.(test|spec)\.ts$'` → 49 non-test files under exempt paths (fixtures, helpers, `packages/test-utils/src/**` — shipped to every test run); a line such as `DISCORD_CLIENT_ID=… DISCORD_CLIENT_SECRET=…` would be skipped. GitHub secret scanning / push protection is still unticked (`docs/operations/POST_MERGE_CHECKLIST.md:329`).

## Fix
- Replace directory entries with the `*.test.ts` / `*.spec.ts` / `__tests__/` patterns plus named fixture files; replace the line regexes with value-anchored ones (e.g. `DISCORD_CLIENT_ID\s*=\s*"\d{17,20}"`); turn on GitHub secret scanning + push protection.

## Status
FIXED 2026-08-31 — all three items in this finding's own Fix section are done and verified:

1. **Directory allowlist → file-shaped.** `tests?/`, `test-utils/` and `e2e/` are gone from the
   path allowlist in `.gitleaks.toml`; `*.test.ts`, `*.spec.ts` and `__tests__/` stay. A
   2026-08-31 scan with every path/line allowlist removed (gitleaks 8.30.1, default rules with
   only `discord-client-id` disabled — same as production) found 36 working-tree + 35
   full-history (943 commits) leaks; **zero** were in the 35 tracked files that actually lost
   the directory exemption (2 under `tests?/`, 29 under `test-utils/`, 4 under `e2e/` — the
   evidence bullet's count of 49 has drifted to 48 since this finding was filed: commit
   `77e08c34`, Sprint 11's FINDING-015 fix round, deleted the dead
   `packages/test-utils/src/auth/signature.ts`), so no named fixture-file exemption was added
   back — there was nothing to add back. The other 27 tree / 28 history raw hits were all in
   `*.test.ts` / `__tests__/` files, which stayed covered throughout.
2. **Line allowlist → value-anchored.** `regexTarget` changed from `"line"` (any line
   *mentioning* `DISCORD_CLIENT_ID` / `XIVAUTH_CLIENT_ID` / `storageKey` was exempt from every
   rule, whatever else the line held) to an explicit `"match"` (only a finding whose own
   matched text has the known-public shape is exempt) — **not** gitleaks' actual default, which
   is `"secret"`, the narrower captured-value substring alone; a fix-round review (S12-R11)
   caught the original comment here claiming `"match"` was the default, which is false and
   would matter if anyone ever deleted the line trusting that claim. The remaining 9 tree / 7
   history raw hits — 3 tree + 4 history for the XIVAuth `phx-…` client id
   (`apps/oauth/wrangler.toml` at three different line numbers across history, plus one audit
   doc quoting it), and 6 tree + 3 history for `storageKey` (3 in `comparison-tool.ts` + 3
   duplicated in a stray local `dist/` build artifact; 0 for the Discord snowflake shape, see
   `.gitleaks.toml`) — are exactly what the three new value-anchored regexes cover, confirmed by
   testing each regex against every raw finding's actual `Match` text: 100% of the 16 non-test
   hits matched one of the three, 0% of the 55 test-file hits matched any of them. A fix-round
   review (S12-R9) also caught a real regression in the first version of the `storageKey` regex
   — it accepted both `:` and `=` as the separator, which also exempted a plain variable
   *assignment* (`const storageKey = "<value>"`), a context a real secret could legitimately
   occupy; reverted to `:` only (the only form any real usage in this repo takes) plus a
   `{1,40}`-character length bound verified against the 48 real values in the tree (longest: 35
   characters) — see `.gitleaks.toml` for the full account and the proof.
3. **GitHub secret scanning + push protection.** Verified live 2026-08-31 via `gh api
   repos/FlashGalatine/xivdyetools --jq '.security_and_analysis'` — both `secret_scanning` and
   `secret_scanning_push_protection` read `"enabled"`: enabled as of 2026-08-31 (API-verified);
   not enabled by this change. (The API call proves current state, not who flipped it or when —
   and GitHub enables both by default on public repositories in some circumstances, so this is
   not necessarily a deliberate maintainer action either.) The Evidence bullet above ("still
   unticked") is now stale;
   `docs/operations/POST_MERGE_CHECKLIST.md`'s item is corrected and ticked, with the two
   settings' distinct roles and why push protection matters more than scanning alone written out.

No real secret turned up in either scan (tree or full 943-commit history) — every one of the 36
+ 35 raw hits resolved to a test fixture already covered by the kept patterns, or a documented
public identifier now covered by the value-anchored regexes.
`docs/audits/2026-08-29-security/evidence/gitleaks-tree.json` / `gitleaks-history.json` are
unchanged (both `[]`) — the scan was already clean under the old, over-broad config, just for
the wrong reasons; it is clean under the new one on the evidence above. Full triage in
`.superpowers/sdd/REMEDIATION_PLAN/s12-task-2-report.md`.
