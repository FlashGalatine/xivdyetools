# Review: secret-hits (2026-10-03)

Scope: classify potential-secrets.txt (66 lines), sweep credential shapes the grep misses, tracked/deleted secret-looking files, CI supply-chain row.
Result: no REAL credential. No candidates.

## (1) Entry points / authz matrix
Not applicable (no handler reviewed). CI surface: ci.yml (push/PR/nightly), 10 deploy-*.yml (push main/master + dispatch), publish-packages.yml (workflow_dispatch only, environment production).

## Scanning coverage
- github-secret-scanning-alerts.json is `[]` (no GitHub alerts).
- gitleaks binary unavailable locally. CI gitleaks-action (ci.yml:99, pinned SHA, GITLEAKS_VERSION 8.30.1 at ci.yml:113) scans each push/PR event's commit range only, not full history (ci.yml:80-86 says the same). Full history was covered here by the local `git log -S` sweeps below, which are local-history only.

## (2) Positive controls
- Every action `uses:` is SHA-pinned (grep for non-40-hex refs returned nothing); example ci.yml:94, :99.
- Top-level `permissions: contents: read` in ci.yml:39-40 and every deploy workflow (e.g. deploy-oauth.yml:18-19).
- npm publish uses OIDC: publish-packages.yml:101-104 (environment production, id-token: write), `pnpm publish --provenance` at :157; no NPM_TOKEN/NODE_AUTH_TOKEN anywhere in workflows.
- `pnpm audit --prod --audit-level high` job ci.yml:62-78; gitleaks job ci.yml:87-120 with comments/artifact upload disabled.
- pnpm-workspace.yaml:8-26 overrides for rollup, qs, seroval, vite (advisory floors).
- Deploy workflows trigger on push to main/master + dispatch; no pull_request_target anywhere (grep empty). No `echo ${{ secrets.* }}` in run steps (grep empty).
- .gitleaks.toml + fingerprint-scoped .gitleaksignore (28 lines, per-finding, not path-wide).
- Only tracked env template: apps/stoat-worker/.env.example, all values empty.
- Logger redaction tests deliberately use fake secrets (see table).

## Classification of potential-secrets.txt (66 hits; none REAL)
| Lines (path) | Class | Note |
|---|---|---|
| discord-worker/scripts/upload-emojis.ts:102 | config name only | `Bot ${token}` template, token read from env, no literal |
| discord-worker contrast/gradient/mixer-v4 tests (:76,:114,:90); moderation env-validation-gate.test.ts:64 | test fixture | `'interaction-token'`, `'tok'` |
| discord-worker/utils/discord-api.safe.test.ts:33-86 (7 lines) | obviously fake | `'token'` literal args |
| discord-worker/utils/github-verify.test.ts:53 | obviously fake | `'another-secret-123'` |
| moderation verify.test.ts:306-308 | test fixture | `'a'.repeat(100)` |
| oauth callback.test.ts:71,883,1170; xivauth.test.ts:106,608,688,753,796,839,884,979 (11 lines) | obviously fake | `'discord_token'`, `'xivauth_token'` mock responses |
| presets-api/tests/index.test.ts:380 | test fixture | `'test-signing-secret'`, snowflake moderator id |
| web-app/scripts/i18n-parity.mjs:140 | config name only | parser "token" (lexer), not a credential |
| web-app auth-service.test.ts:598,608,1310 | test fixture | malformed JWT strings (`not.a.valid...`) |
| web-app shared/__tests__/logger.test.ts:189 | obviously fake | `'hunter2-SECRET'` redaction probe |
| docs/audits/2026-07-18/** (DEEP_DIVE_REPORT.md:49, BUG-025.md:40,63, BUG-075.md:23) | docs example | prose about token redaction |
| docs/audits/2026-08-21-security/evidence/review-oauth.md:79, review-packages.md:296 | docs example | prose / ReDoS timing line |
| docs/audits/2026-09-02-deep-dive/** (review-oauth.md:90, repro-logger-cycle.mjs:18,50, repro-logger-sanitize.mjs:24, BUG-004.md:9,11, BUG-005.md:19) | docs example / obviously fake | `'shhh-super-secret'`, `"quoted secret value"` |
| docs/audits/2026-09-05-documentation/.../sweep-A:39; 2026-09-18-documentation (report:72, gen-findings.mjs:16, DOC-001.md:1) | docs example | prose |
| packages/auth bot-signature-v2.test.ts:12, jwt.test.ts:28,414-423 | test fixture | `'bot-signing-secret-that-is-at-least-32-bytes-long!!'`, `'test-jwt-secret-key-...'`; issuers are example domains |
| packages/logger CHANGELOG.md:37,210; base-logger.ts:650-651 | docs example / config name only | comments about regex; no literal |
| packages/logger base-logger.test.ts:368,381,419,949; worker.test.ts:150 | obviously fake | `'should-be-hidden'`, `'secret-token'`, `'must-be-redacted'`, `'discord-secret'` |
| packages/test-utils/src/auth/jwt.ts:66 | config name only | JSDoc param |
No public client ids appear in this file; none REAL.

## Extra shape sweeps (git grep, tracked files)
- Discord bot token shape: 0 hits. Google AIza: 0. BEGIN .*PRIVATE KEY: 0. AWS AKIA / GitHub ghp_ / Slack xox / sk- / npm_ shapes: 0.
- JWT shape `eyJ...\.eyJ`: 5 hits, all fake test fixtures: oauth/src/__tests__/token.test.ts:332 (forged token, signature literally "invalid"), logger base-logger.test.ts:789, hardening.test.ts:85,108 (payload decodes to {"sub":"123"}, signature is base64 of "signature-signature-signature"), test-utils/integration/oauth-presets/jwt-validation.test.ts:271 (missing signature).
- Discord webhook URLs: only fakes (`/webhooks/123/ABC...`, `/1/abc`) in moderation-worker url-sanitizer.ts:21,23,115 + test :40, logger hardening.test.ts:64, and past audit docs.
- Secret-looking tracked files: apps/stoat-worker/.env.example (empty values); docs/operations/SECRET_ROTATION.md; prior-audit evidence files named potential-secrets*/secrets*; docs/audits/2026-01-25/findings/FINDING-003-exposed-xivauth-secret.md (historical, already handled by earlier audit). No .env, .dev.vars, .pem, .key tracked.
- Deleted secret-looking files in local history (all branches): apps/maintainer/src/env.d.ts, docs/.secrets.baseline, packages/test-utils/src/constants/secrets.ts (viewed pre-deletion: header "TESTING ONLY" test constants), packages/test-utils/tests/constants/secrets.test.ts. None are live credentials.
- `git log --all -p -S'BEGIN RSA PRIVATE'` and `-S'BEGIN PRIVATE KEY'`: empty. (`-S'BEGIN'` alone matches SQL BEGIN in a migration, 74114ebf, benign.)

## (3) Rejected
- Every one of the 66 hits: see table, none live.
- Stale docs/audits/2026-01-25 FINDING-003 (exposed xivauth secret): historical doc, previously remediated; not re-filed and no value present in tree.
- ci gitleaks scans only event ranges: known/documented limitation (ci.yml:80-86), complement is GitHub secret scanning (alerts []); not a finding.

## (4) Files covered
docs/audits/2026-10-03-security/evidence/potential-secrets.txt, github-secret-scanning-alerts.json; apps/stoat-worker/.env.example; .github/workflows/ci.yml (lines 36-125), publish-packages.yml (grep), all deploy-*.yml (grep for permissions/uses/triggers/secrets), .gitleaksignore (head), pnpm-workspace.yaml (1-30); packages/test-utils/src/constants/secrets.ts (history); apps/oauth/src/__tests__/token.test.ts:332. Repo-wide git grep sweeps listed above.

## (5) Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| (none) | | | | no live credential found |

## (6) Handoffs
- docs/audits/*/evidence/potential-secrets*.txt and past audit prose are matched by the credential grep every audit; consider excluding docs/audits from scripts that generate potential-secrets.txt to cut noise (tooling, not security).
