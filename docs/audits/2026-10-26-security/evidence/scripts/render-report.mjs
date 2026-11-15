// Render SECURITY_AUDIT_REPORT.md and README.md from evidence/final-catalog.json.
// Usage (repo root): node docs/audits/2026-10-26-security/evidence/scripts/render-report.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'docs/audits/2026-10-26-security';
const cat = JSON.parse(readFileSync(`${OUT}/evidence/final-catalog.json`, 'utf8'));
const r1 = JSON.parse(readFileSync(`${OUT}/evidence/workflow-round1-result.json`, 'utf8'));
const r1b = JSON.parse(readFileSync(`${OUT}/evidence/workflow-round1b-result.json`, 'utf8'));
const reviewerRejections = [...r1.results, ...r1.gapResults, ...r1b.results].reduce((n, x) => n + x.rejected.length, 0);

const SEV = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const EXP = ['INTERNET-UNAUTH', 'INTERNET-AUTH', 'INTERNAL', 'LOCAL'];
const grid = {};
for (const s of SEV) grid[s] = Object.fromEntries(EXP.map((e) => [e, 0]));
for (const f of cat.findings) grid[f.severity][f.exposure]++;
const totalBySev = (s) => EXP.reduce((n, e) => n + grid[s][e], 0);
const totalByExp = (e) => SEV.reduce((n, s) => n + grid[s][e], 0);
const sevTable = [
  '| Severity | INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL | LOCAL | Total |',
  '|---|---:|---:|---:|---:|---:|',
  ...SEV.map((s) => `| ${s} | ${EXP.map((e) => grid[s][e]).join(' | ')} | ${totalBySev(s)} |`),
  `| **Total** | ${EXP.map((e) => totalByExp(e)).join(' | ')} | **${cat.findings.length}** |`,
].join('\n');

const short = (s, n) => {
  const x = s.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
};
const catalogRows = cat.findings
  .map((f) => `| [${f.id}](findings/${f.id}.md) | ${short(f.title, 150)} | ${f.severity} | ${f.exposure} | ${short(f.unit, 46)} | ${/^NONE/i.test(f.rotation) ? 'NONE' : 'NONE (optional reset)'} |`)
  .join('\n');
const idOf = (gid) => cat.findings.find((f) => f.gid === gid || f.merged.includes(gid))?.id ?? gid;
const statusRows = cat.findings.map((f) => `| ${f.id} | OPEN | — |`).join('\n');
const rejectedRows = cat.rejected.map((r) => `- **${r.gid} — ${short(r.title, 110)}** — ${short(r.reason, 520)}`).join('\n');
const notPromoted = Object.entries(cat.notPromoted).map(([g, t]) => `| ${g} | ${short(t, 300)} |`).join('\n');
const n = cat.findings.length;
const c = (s) => totalBySev(s);

const report = `# Security audit — xivdyetools, whole monorepo (2026-10-26)

- **Branch/commit:** \`claude/project-security-audit-3b5195\` @ \`13c386e5983fe58ff17ac08fb5712239feb2e696\` (= \`main\`). Previous whole-repo audit: [2026-10-03-security](../2026-10-03-security/SECURITY_AUDIT_REPORT.md) @ \`0ab33466\` — 680 commits / 1,871 files since; plus the focused [2026-10-15 web-app .chara audit](../2026-10-15-web-app-security/SECURITY_AUDIT_REPORT.md).
- **Scope:** all 9 apps, 8 packages, CI / wrangler / GitHub repository settings, the four policy documents in all six languages (24 files), the new xivcharakit-backed \`.chara\` reader end to end (core 5.15.0, web-app 5.16.0, bot-logic 4.11.0 + discord-worker 5.9.0, api-worker \`/v1/chara/*\`), and the upstream XIVAuth build the oauth worker signs in through (\`other-sources/XIVAuth\` @ \`a4e6693\`).
- **Method:** Step 2 evidence ([collect.sh](evidence/scripts/collect.sh); gitleaks 8.30.1 installed this run, [provenance](evidence/gitleaks.md)); 46 reviewers — 38 in round 1 (34 per-unit and cross-cutting assignments incl. two regression sweeps, a diff-oriented pass over the 680 commits and five translation-meaning readers, plus a completeness critic that raised 4 gap assignments) and 8 second-pass reviewers on code round 1 had not read — each writing an \`evidence/review-<key>.md\`; 85 candidates merged into 73 groups; every MEDIUM/LOW group judged by an independent confirming verifier **and** an independent refuting verifier (third verifier on the 4 split votes), every INFO group by one verifier; one severity × exposure calibration pass; coordinator reconciliation ([final-catalog.json](evidence/final-catalog.json)); read-only live header probes, GET-only \`gh api\` reads, a browser visit to the production Harmony tool, and — at the maintainer's yes at the §8 gate — **read-only Cloudflare API queries** (GET/list calls, secret names only, aggregate D1 \`COUNT\`s; [evidence](evidence/live-state-cloudflare-2026-10-26.md)), whose three new items ([FINDING-054](findings/FINDING-054.md), [-055](findings/FINDING-055.md), [-056](findings/FINDING-056.md)) were graded by an independent Opus verifier. **No Fable agent and no advisor call was used**, per the maintainer's instruction; every verifier was Opus (\`xivdye-verifier\`), reviewers were Opus-high or Sonnet-medium \`xivdye-worker\`s.
- **Totals:** **${n} findings — ${c('CRITICAL')} CRITICAL, ${c('HIGH')} HIGH, ${c('MEDIUM')} MEDIUM, ${c('LOW')} LOW, ${c('INFO')} INFO.** No credential exposure, so no exposure-driven rotation. **Sprint 0 (act now): no exploitable-now item** — the plan's Sprint 0 holds only maintainer-only dashboard and settings actions, led by deleting the stale public dev worker ([FINDING-054](findings/FINDING-054.md)). 9 further groups were rejected on verification and 7 verified items are routed to other skills.
- **Source changes:** none. Only \`docs/audits/2026-10-26-security/\` was written.

## Severity × exposure

${sevTable}

Nothing in this audit is exploitable by an unauthenticated party to the detriment of another user. The most consequential item is a privacy-policy gap ([FINDING-001](findings/FINDING-001.md), graded MEDIUM by the skill's personal-data rule; the maintainer chose the code fix). The most visible new item is a stale dev api-worker that is still public on \`workers.dev\` because the repo's pin never reached the live script ([FINDING-054](findings/FINDING-054.md)). The rest are bounded hardening gaps, policy or UI text that no longer matches the code, and repository-settings residue. All 2026-10-03 and 2026-10-15 fixes still hold at HEAD except 2026-10-03/FINDING-023, which is still open ([FINDING-028](findings/FINDING-028.md)).

## Catalog

| ID | Title | Sev | Exposure | Deploy unit | Rotation |
|---|---|---|---|---|---|
${catalogRows}

## Pending rotation

No credential exposure was found. Gitleaks 8.30.1 reported no leaks in the tracked tree or in the 1,992 commits reachable from the remote refs; GitHub secret scanning reports 0 alerts; the 76 credential-shaped grep hits in [potential-secrets.txt](evidence/potential-secrets.txt) were classified by the config reviewer ([review-wrangler-secrets-config.md](evidence/review-wrangler-secrets-config.md)) and none is real.

| ID | Credential | Rotated? | Revoked? |
|---|---|---|---|
| none | — | n/a | n/a |

[FINDING-028](findings/FINDING-028.md) is a settings clean-up, not an exposure: delete the repository-scope copies of the production and beta bot tokens (every consuming job already reads the \`production\` / \`beta\` environment copy). Resetting the tokens is optional and the maintainer's call.

## Pending policy edits

Every row is a **six-file edit per document** (English + \`.ja/.ko/.zh/.de/.fr\`), all \`Last updated\` lines bumped to the same date, \`policy-locale-parity.py\` back to exit 0, and a laymans-changelog entry. Locale-JSON rows also need \`pnpm --filter xivdyetools-web-app run validate:i18n\` and the parity gates. **AMEND rows are new public commitments and need the maintainer's explicit yes at the §8 gate**, and must land no earlier than the code change they describe.

| ID | Document(s) | § | CORRECT/AMEND | Landed? |
|---|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | bot \`PRIVACY_POLICY.md\`, web \`PRIVACY.md\` | §5 Discord row; "Posts in our Discord server" | **NONE** — §8 decision 2026-10-26: drop the moderator name from the posts (code fix); an AMEND only if the maintainer reverses this | n/a |
| [FINDING-003](findings/FINDING-003.md) | web \`PRIVACY.md\` | Character files (.chara) bullet 2 | CORRECT (replace "rename or delete the record") | no |
| [FINDING-006](findings/FINDING-006.md) | web \`locales/*.json\` \`preset.gateBrowseNote\` | — | CORRECT (UI copy, six locales) | no |
| [FINDING-007](findings/FINDING-007.md) | web \`PRIVACY.fr.md\` (and \`PRIVACY.ja.md\` / \`.ko.md\` where the same term collides) | What is stored on your device | CORRECT ("saved palettes" term collision) | no |
| [FINDING-010](findings/FINDING-010.md) | web \`PRIVACY.md\` | What leaves your device (.chara bullet) | CORRECT ("a dozen small integers") | no |
| [FINDING-011](findings/FINDING-011.md) | web \`PRIVACY.md\` | Network access | CORRECT the sentence, or narrow \`connect-src\` in \`_headers\` (maintainer decision) | no |
| [FINDING-012](findings/FINDING-012.md) | web \`TERMS_OF_SERVICE.md\` | Appeals and removal, step 3 | CORRECT | no |
| [FINDING-013](findings/FINDING-013.md) | web \`TERMS_OF_SERVICE.md\` | Accounts | CORRECT ("display name" → name, username as fallback) | no |
| [FINDING-022](findings/FINDING-022.md) | bot \`PRIVACY_POLICY.md\` | §3 Character Files, item 2 | CORRECT (add clan, gender, producing tool shown on the card) | no |
| [FINDING-026](findings/FINDING-026.md) | web \`PRIVACY.md\` | Network access, item 3 | **AMEND** (qualify "browsing sends nothing about you": signed-in viewers send the token) | no |
| [FINDING-027](findings/FINDING-027.md) | web \`PRIVACY.md\`, bot \`PRIVACY_POLICY.md\` | Community presets; previous-version snapshot wording | CORRECT (snapshots exist only for approved presets) | no |
| [FINDING-033](findings/FINDING-033.md) | web \`PRIVACY.de.md\`, \`PRIVACY.fr.md\` (+ \`PRIVACY.ja.md\`) | Character files (.chara) | CORRECT (translation: "other people") | no |
| [FINDING-034](findings/FINDING-034.md) | web \`locales/de.json\` \`preset.shotSlot\` | — | CORRECT (UI copy, one locale) | no |
| [FINDING-035](findings/FINDING-035.md) | web + bot \`TERMS_OF_SERVICE.md\` | Moderation (auto-publish sentences) | CORRECT **on the day the Perspective key is deleted (by 2026-12-31)** | no |

[FINDING-053](findings/FINDING-053.md) is a process gap (no deletion/export runbook), not a policy edit. The other 38 findings carry no policy field. A fixed-code resolution of a Step 3a case-1 finding makes the existing text true and needs no edit.

## Live state

At the maintainer's yes at the §8 gate (2026-10-26), live Cloudflare state was read through the API — GET/list calls, secret **names** only, aggregate D1 \`COUNT\`s, nothing written ([evidence](evidence/live-state-cloudflare-2026-10-26.md)). It settled most of what the repo could not show and added three findings ([FINDING-054](findings/FINDING-054.md), [-055](findings/FINDING-055.md), [-056](findings/FINDING-056.md)).

| Finding | Result (read 2026-10-26) | Still open |
|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | \`MODERATION_CHANNEL_ID\` and \`SUBMISSION_LOG_CHANNEL_ID\` are configured on both bots, so the submission-log copy is live | Who can read those two channels (Discord permissions) |
| [FINDING-004](findings/FINDING-004.md) | IPv6 on, Pseudo IPv4 off: the precondition holds | Dashboard WAF and rate-limiting rules were not read |
| [FINDING-009](findings/FINDING-009.md) | 522 + 240 deployments retained (not three); \`ecc7fb76\` serves no CSP | — (bulk prune is the fix) |
| [FINDING-018](findings/FINDING-018.md) | \`PERSPECTIVE_API_KEY\` is set in production: reachable today | How strictly the native \`RL_PUBLIC\` binding is enforced ([FINDING-019](findings/FINDING-019.md)) |
| [FINDING-020](findings/FINDING-020.md) | — | How workerd enforces the 128 MiB isolate limit against wasm memory (measured in Node only) |
| [FINDING-023](findings/FINDING-023.md) | 19 users, 4 linked to both ids | A comparison of those 4 with XIVAuth's current links |
| [FINDING-025](findings/FINDING-025.md) | 16 approved presets by 7 authors, 1 UUID-keyed | Whether that author's linked id is among the other 6 (not run, to avoid reading identifiers) |
| [FINDING-028](findings/FINDING-028.md) | — | The repository-scope bot-token secrets (delete them); whether their values are still valid tokens (GitHub secret values are write-only) |
| [FINDING-030](findings/FINDING-030.md) | Beta bot holds only \`DISCORD_PUBLIC_KEY\` and \`DISCORD_TOKEN\`: **re-graded INFO** | — |
| [FINDING-032](findings/FINDING-032.md) | No \`xivdyetools-oauth-dev\` worker and no dev D1 exist: latent | — |
| [FINDING-054](findings/FINDING-054.md) / [-055](findings/FINDING-055.md) / [-056](findings/FINDING-056.md) | New: a stale public dev api-worker; zone Always Use HTTPS off and minimum TLS 1.0; two retired deploy units still deployed | — |

Also settled: the deployed D1 carries migrations 0012 and 0014 (the \`content_revision\` trigger and the \`text_edit\` quota kind), closing 2026-10-03/FINDING-031's open limit; the DNS records, custom domains and zone routes were checked and none is dangling.

## Evidence and validation

| Check | Result |
|---|---|
| \`pnpm audit --prod\` (CI gate) | 0 advisories ([json](evidence/pnpm-audit.json), [summary](evidence/pnpm-audit-summary.txt)) |
| \`pnpm audit\` (full tree) | 5 advisories, all dev-only \`vite@6.4.3\` via \`vitepress\` → [FINDING-031](findings/FINDING-031.md) ([json](evidence/pnpm-audit-full.json)) |
| Gitleaks v8.30.1, tree + history | tree: no leaks; remote refs (1,992 commits): no leaks; all local refs: 1 false positive on a local-only branch ([provenance](evidence/gitleaks.md)) |
| GitHub secret scanning / CI | 0 alerts ([json](evidence/github-secret-scanning-alerts.json)); CI green on \`main\` at HEAD ([json](evidence/ci-main-runs.json)) |
| Policy locale parity (mechanical) | PASS, 20 variants ([txt](evidence/policy-locale-parity.txt)) |
| Translation meaning (verifier-model readers, 5 languages × 4 documents) | no divergence in ja or zh; ko 1, de 2, fr 2 raised → 4 groups: 3 filed ([FINDING-007](findings/FINDING-007.md), [-033](findings/FINDING-033.md), [-034](findings/FINDING-034.md)), 1 rejected (the ko "nothing is transmitted" wording: English "Nothing is uploaded" is equally absolute) |
| Live headers (\`curl -sI\`, read-only) | production, beta, \`xiv-colorexplorer.pages.dev\`, \`xivdyetools-beta.pages.dev\`: CSP, HSTS, XFO, nosniff, Permissions-Policy all present and identical ([txt](evidence/live-headers.txt)); old hash/branch deployments: [txt](evidence/live-headers-old-deployments.txt) → [FINDING-009](findings/FINDING-009.md) |
| GitHub settings (GET-only \`gh api\`) | SHA pinning enforced, Dependabot alerts on (5 open, all dev-tree vite), \`Secret scan (gitleaks)\` required, bot tokens still repository-scope, \`enforce_admins\` / \`strict\` still off ([ci-supply-chain review](evidence/review-ci-supply-chain.md)) |
| Regression sweep | **no control regressed.** 2026-10-03 FINDING-001…031 and 2026-10-15 FINDING-001…003: all HOLDS except FINDING-023 (PARTIAL → [FINDING-028](findings/FINDING-028.md)), FINDING-024 (residual → [FINDING-051](findings/FINDING-051.md)) and FINDING-027 (optional hardening → [FINDING-039](findings/FINDING-039.md)); the 2026-09-15 and 2026-08-29 fix lists also hold ([review-regression-a.md](evidence/review-regression-a.md), [review-regression-b.md](evidence/review-regression-b.md)). Guard tests were identified by reading, not executed |
| Cloudflare (read-only API) | 16 workers, 4 D1 databases, 8 Pages projects, 12 DNS records and the zone routes and settings read; three new findings, one re-grade (FINDING-030), the deployed D1 schema confirmed ([evidence](evidence/live-state-cloudflare-2026-10-26.md), [captures](evidence/live-headers-http-and-retired.txt)) |
| Fan-out | 46 reviews, 85 candidates → 73 groups → 53 filed (merges and rejections below), 9 rejected, 7 routed; plus 3 filed from the live-state pass (56 total) ([workflow-verify-result.json](evidence/workflow-verify-result.json), [candidates.json](evidence/candidates.json), [candidate-groups.json](evidence/candidate-groups.json)) |
| Third-party dependency | \`xivcharakit@0.1.0-beta.4\`: exact pin, lockfile integrity equals the registry, SLSA provenance, no install hooks, no runtime dependencies, no eval / fs / process, \`fetch\` only in an XIVAPI client no workspace imports; hostile-input probes at the 8 KiB cap finished in < 6 ms ([review-r2-xivcharakit-source.md](evidence/review-r2-xivcharakit-source.md)); releases carry no git tags → [FINDING-052](findings/FINDING-052.md) |

## Positive controls

- **Origins:** production, beta and both \`*.pages.dev\` aliases serve the same CSP (\`script-src 'self'\`, \`frame-ancestors 'none'\`, first-party \`connect-src\`), HSTS preload, XFO DENY, nosniff and Permissions-Policy; 2026-10-03/FINDING-001 stays fixed on beta.
- **.chara reader:** \`*.chara\` extension and the 8 KiB cap are enforced before any read on web and bot (the bot checks declared and streamed bytes, https-only Discord-CDN allowlist, \`redirect: 'manual'\`, 10 s); the web Worker's messages are allowlist-validated and rebuilt in both directions, the Worker imports only the narrow \`@xivdyetools/core/chara\` subpath, and telemetry carries only \`ok\` plus an allowlisted producer. xivcharakit's reader enforces depth 32, 100k nodes, 64 KiB strings and null-prototype records itself.
- **api-worker \`/v1/chara/resolve\`:** integer-only body on a streamed 8 KiB cap, no XIVAPI query injection, fixed base and paths with redirects refused, cache identity includes version, schema and row shape.
- **Discord bots:** Ed25519 verified over a streamed 100 KB cap before any parse, 300 s freshness; every command and autocomplete rate-limited; \`MODERATOR_IDS\` gates every admin path; \`custom_id\`s parsed to UUID/snowflake before use; webhooks use constant-time compares and a 32-character production floor; every REST body defaults \`allowed_mentions\` to none.
- **Bot → presets-api:** v2 HMAC canonical string is length-prefixed and binds method, path, body hash, timestamp, nonce and identity; nonces single-use; 32-byte key floor; presets-api ignores \`X-User-*\` on the JWT path and calls \`requireModerator\` / \`requireNotBanned\` on the mutating routers.
- **presets-api:** every D1 statement is \`prepare().bind()\`; \`content_revision\` compare-and-set with a DB trigger on owner, status and revert writes; preview approvals bound to the exact key; Perspective fails closed with \`doNotStore\`.
- **oauth:** HMAC-signed expiring state, server-bound PKCE S256, one exact redirect + CORS allowlist, HS256-pinned 1 h JWTs with \`jti\` revocation that outlives \`exp\`.
- **Privacy:** the only two bot log lines carrying a user id are test-enforced; analytics blobs carry no option value, guild id or error text; telemetry is default-off, honors GPC, carries no identifier; every retention number in the bot policy (§8) matches a real TTL or purge job; the bot strips the \`.chara\` nickname at projection and never logs it.
- **CI and supply chain:** all 69 \`uses:\` lines SHA-pinned and \`sha_pinning_required\` on; \`permissions: contents: read\` everywhere; no \`pull_request_target\`; OIDC trusted publishing with provenance on all 7 packages; every wrangler pins \`[observability] enabled = false\` behind a CI gate; image-worker is binding-only and pinned by a config test.

## Rejected suspicions

Nine groups were rejected on verification, so the next audit does not re-chase them. Reviewers also rejected ${reviewerRejections} further candidates with one-line reasons inside their \`evidence/review-*.md\` files (for example the unmeasured-component-rate-limit, interaction-replay, GitHub-webhook-secret-floor and unbounded-changelog-fetch suspicions).

${rejectedRows}

## Informational items (not promoted to findings)

Verified, but not security defects; routed as handoffs to \`deep-dive-analysis\` / \`documentation-audit\`.

| Group | Item |
|---|---|
${notPromoted}

## Recommendations

1. **Tie privacy copy to code with tests.** Thirteen findings here are policy or UI text that drifted from the code (003, 006, 007, 010–013, 022, 026, 027, 033–035). Assert every UI path, control name and number a policy quotes against the locale keys and constants it names, the way \`privacy-copy-parity.test.ts\` already does for one sentence.
2. **Clean third-party game text once, at the boundary.** One shared cleaner (length cap, control and bidi strip, whitespace collapse) in api-worker for XIVAPI names and the build scripts, with \`sanitizeEmbedText\` extended to \`<...>\` syntax and bidi isolates ([FINDING-002](findings/FINDING-002.md), [-014](findings/FINDING-014.md), [-021](findings/FINDING-021.md)).
3. **Key per-IP limiters on the IPv6 /64** in \`getClientIp\` (opt-in), so one residential prefix is one bucket ([FINDING-004](findings/FINDING-004.md)).
4. **Enforce the author ban server-side**, in the presets-api status and revert writes, and across both identities ([FINDING-015](findings/FINDING-015.md), [-025](findings/FINDING-025.md)).
5. **Charge cache misses, not hits, on \`/v1/chara/*\`** with a dedicated native limiter, and give \`/glamour\` its own command tier ([FINDING-005](findings/FINDING-005.md), [-017](findings/FINDING-017.md)).
6. **Pin every external data source in build scripts** to a commit SHA and record a checksum, as \`build-acquisition.ts\` already does ([FINDING-029](findings/FINDING-029.md)).
7. **Probe every live origin, including hash and branch \`pages.dev\` aliases and every \`*.workers.dev\` name, plus the zone's HTTPS settings,** in the smoke test, and prune superseded Pages deployments after each deploy ([FINDING-009](findings/FINDING-009.md), [-054](findings/FINDING-054.md), [-055](findings/FINDING-055.md)).
8. **Close the settings residue:** delete the repository-scope bot tokens, turn on \`enforce_admins\` and \`strict\`, raise the \`vitepress>vite\` floor to \`>=6.4.5\` ([FINDING-028](findings/FINDING-028.md), [-051](findings/FINDING-051.md), [-031](findings/FINDING-031.md)).

## Limits

Source / configuration audit plus read-only live probes: \`HEAD\` requests to the live origins, the superseded Pages deployments, the plain-HTTP API hosts and the \`workers.dev\` names; GET-only \`gh api\` calls; one browser visit to the production Harmony tool; and read-only Cloudflare API queries (GET/list, secret names only, aggregate D1 counts — see *Live state*). Not a penetration test; no live Worker interaction beyond those, no load tests, no row of personal data, no secret value and no Discord channel permission was read. Not read: Cloudflare WAF and rate-limiting rules, the account's other projects (\`doyoulikethis-*\`, \`galatine-*\`, \`calendar-sync-worker\`, \`webp-converter\`, \`shaderfinder-webapp\`, \`xivcharakit-demo\`), and GitHub secret values. Reviewers ran scratch probes and single test files only; the whole-monorepo gate was not run and guard tests were identified by reading, not executed. \`image-worker\` memory behavior (FINDING-020) was measured in Node, not workerd. The xivcharakit tarball was compared with its claimed source by file map and two files, not rebuilt byte for byte. The 2,000-commit \`--all\` gitleaks scan covers local refs only. The three live-state findings were graded by one verifier without a refuter, as INFO and LOW items.

## Remediation status

| ID | Status | Commit |
|---|---|---|
${statusRows}

## Next steps

Hand off to \`remediation-planner\` ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)) and take the §8 confirmation gate before any fix. The audit itself changed no source.
`;

writeFileSync(`${OUT}/SECURITY_AUDIT_REPORT.md`, report, 'utf8');

const readme = `# Security audit — xivdyetools whole monorepo (2026-10-26)

${n} findings (${c('MEDIUM')} MEDIUM, ${c('LOW')} LOW, ${c('INFO')} INFO; no CRITICAL or HIGH) across all 9 apps, 8 packages, CI and repository settings, the six-language policy documents and the new xivcharakit \`.chara\` reader. No credential exposure and no exploitable-now item (Sprint 0 is empty). All 2026-10-03 and 2026-10-15 fixes still hold except 2026-10-03/FINDING-023. **No source files were modified by the audit**, and no Fable agent was used.

| File | Purpose |
|---|---|
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | The catalog: severity × exposure, policy edits, live-state checks, positive controls, rejected suspicions, remediation status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint plan written by \`remediation-planner\` |
| [findings/](findings/) | One file per finding (\`FINDING-001\`…\`FINDING-${String(n).padStart(3, '0')}\`) |
| [evidence/](evidence/) | Raw tool output, 46 per-reviewer \`review-*.md\`, workflow results, \`candidates.json\` (85) → \`candidate-groups.json\` (73) → \`final-catalog.json\`, live-probe captures, gitleaks provenance, and \`scripts/\` (collect, three workflow scripts, renderers) |

## Top items

1. **[FINDING-001](findings/FINDING-001.md) (MEDIUM)** — moderation-worker: the acting moderator's Discord username is written into persistent moderation and submission-log posts that neither privacy policy lists; the maintainer chose the code fix (drop the name).
2. **[FINDING-054](findings/FINDING-054.md) (LOW)** — api-worker: a stale dev script from 2026-08-10 is still public on \`workers.dev\` because the repo's \`workers_dev = false\` pin never reached the live script.
3. **[FINDING-002](findings/FINDING-002.md) (LOW)** — api-worker: XIVAPI search and Glasses bodies are read unbounded and item names are cached for 7 days with no length cap or control/bidi filtering.
4. **[FINDING-004](findings/FINDING-004.md) (LOW)** — oauth / worker-kit: per-IP limiters key on the full IPv6 address (IPv6 is on, Pseudo IPv4 off), so one /64 gets unlimited buckets.
5. **[FINDING-009](findings/FINDING-009.md) (LOW)** — web-app hosting: 522 + 240 superseded Pages deployments stay public under older CSPs; one old beta deployment serves no CSP, XFO or HSTS.
6. **[FINDING-028](findings/FINDING-028.md) (LOW)** — CI: 2026-10-03/FINDING-023 is still open; production and beta bot tokens remain repository-scope secrets.
`;
writeFileSync(`${OUT}/README.md`, readme, 'utf8');
console.log('wrote SECURITY_AUDIT_REPORT.md and README.md;', n, 'findings; reviewer rejections', reviewerRejections);
