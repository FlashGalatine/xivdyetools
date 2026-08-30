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
OPEN
