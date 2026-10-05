// Coordinator hand edits applied after render-findings.mjs. Each replacement must match exactly once.
// Usage (repo root): node docs/audits/2026-10-03-security/evidence/scripts/edit-findings.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const D = 'docs/audits/2026-10-03-security/findings';
const ABS = 'C:/dev/XIVProjects/xivdyetools/.claude/worktrees/security-audit-96f7ce/';
const edits = [
  // 002 — keep the re-grade visible
  ['002', /\*\*Coordinator note:\*\* Re-graded.*$/m, '**Grade note:** HIGH by the skill rule (a field the policy explicitly promises is never in these lines). The calibration pass argued MEDIUM (catalog id / enum / number, Workers Logs off); the maintainer may downgrade at the §8 gate.'],
  // 004 — fix text must match AMEND / case 2
  ['004', /\*\*Coordinator note:\*\* AMEND, not CORRECT.*$/m, '**Why AMEND:** the corrected text must name fields the current text does not (the verified character name as username / author name, and a second, linked Discord id), so it is a new public commitment.'],
  ['004', /## Fix\n[\s\S]*?\n\n## Status/, `## Fix
- Decide minimization first (§8): keep the verified character name as the stored username and public author name, or store an opaque label / ask the user to type an author name, and stop storing the linked Discord id unless presets-api needs it (see FINDING-014).
- Then rewrite \`preset.privacyNote\` in all six locale JSONs (remove "No character data"; run \`pnpm --filter xivdyetools-web-app run validate:i18n\` and the parity gates) and AMEND PRIVACY.md item 3 + ToS §Accounts (twelve files, all \`Last updated\` bumped) to name exactly what the chosen design stores.
- Add a copy-parity test tying the modal claim to \`xivauth.ts\` so it cannot drift again (it drifted after the 2026-08-29 fix \`114f6dde\`).

## Status`],
  // 005 — no internal ids; counters belong to 009
  ['005', /- Then AMEND both policies[^\n]*\n- Merge with[^\n]*\n/, `- Then AMEND both policies (six-file edit each, bump every \`Last updated\`; an AMEND is a significant change, so bot policy §11 calls for a Discord announcement): add ban records and moderation-log entries (ids, moderator reason, timestamps) with their retention to bot §2/§5/§8 and to web PRIVACY.md item 3.
- Coordinate with FINDING-008 and FINDING-009, which edit the same web item; update \`apps/moderation-worker/README.md\` if it describes ban storage.
`],
  // 007 — fix text must offer minimize-or-AMEND
  ['007', /\*\*Coordinator note:\*\* Minimize.*$/m, '**Prior verdict:** the 2026-08-29 discord-worker reviewer accepted "Username" as covering the display name in an evidence note only (`2026-08-29-security/evidence/review-discord-worker.md:276`), never in that report\'s Rejected suspicions; both verifiers here upheld the distinction (username and `global_name` are different Discord fields, and the privacy stance lists display names separately).'],
  ['007', /## Fix\n[\s\S]*?\n\n## Status/, `## Fix
- Minimize (no policy edit): send \`interaction.(member.)user.username\` only in \`preset.ts:76-81\`; existing \`author_name\` rows keep display names until refreshed (\`presets.ts:328-361\`).
- Or AMEND §2 line 20 and §4 line 92 (six files) to "Discord display name (or username if none is set), shown publicly as the preset author" — a new public commitment for the §8 gate.
- Either way, add the preference record's \`updatedAt\` timestamp to the §2 Preferences row (or stop storing it).

## Status`],
  // 011 — AMEND or minimize
  ['011', /## Fix\n[\s\S]*?\n\n## Status/, `## Fix
- Minimize (no policy edit): rate-limit the market proxy through the same native Cloudflare binding the /v1 API uses, so the existing "Cloudflare's own rate-limiting service" sentence becomes true for every route; drop the module-scope \`MemoryRateLimiter\`.
- Or AMEND the Abuse-prevention bullet (six files, bump \`Last updated\`): the market-price proxy also counts requests per IP in the serving instance's memory for one 60-second window, never written to storage and gone when the instance recycles — a new statement under a section that calls itself "the whole of what we do with it".

## Status`],
  // 013 — AMEND or stop sampling
  ['013', /- Apply the same wording to the \.ja[^\n]*\n/, `- Apply the same wording to the .ja/.ko/.zh/.de/.fr siblings (six-file AMEND, a new stated purpose). Alternative with no policy edit: drop the sampling and derive adoption from the Analytics Engine rows the policy already lists.
`],
  // 018 — no internal ids
  ['018', /\*\*Coordinator note:\*\* discord-worker only[^\n]*/, '**Scope:** discord-worker only. The same pattern in moderation-worker is not filed: it re-files the 2026-09-15 rejected suspicion "Discord pseudonymous IDs in logs", and the 2026-09-16 §5 sentence describes the Bot only.'],
  // 023 / 024 — repo-relative paths and coordinator-run evidence
  ['023', new RegExp(ABS.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g'), ''],
  ['023', /- Reviewer's `gh api repos\/\.\.\.\/actions\/secrets`[^\n]*/, '- `evidence/gh-settings-2026-10-03.txt` (coordinator, read-only, 2026-10-03): repository secrets = `BETA_DISCORD_GUILD_ID, BETA_DISCORD_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_TOKEN, MODERATION_DISCORD_TOKEN`; `production` environment secrets = `CLOUDFLARE_API_TOKEN` only; `production` branch policy = `main`.'],
  ['024', new RegExp(ABS.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g'), ''],
  ['024', /- Reviewer's gh api branches\/main\/protection output[^\n]*/, '- `evidence/gh-settings-2026-10-03.txt` (coordinator, read-only, 2026-10-03): `branches/main/protection` → contexts `["Lint, Type-check, Test, Build","Security audit (production dependencies)","E2E (Playwright, chromium)"]`, `strict: false`, `enforce_admins: false`, no required reviews — `Secret scan (gitleaks)` is not required.'],
  // 025 — coordinator-run full audit
  ['025', /- evidence\/pnpm-audit\.json \(--prod\)[^\n]*/, '- `evidence/pnpm-audit.json` (`--prod`): 0 advisories. `evidence/pnpm-audit-full.json` (coordinator, full tree, 2026-10-03): 10 advisories — 2 high (incl. TLS certificate-validation bypass), 5 moderate, 3 low — all `undici@7.29.0` via `<app>>wrangler>miniflare>undici`, patched `>=7.29.1`. Only local `wrangler dev`/miniflare loads this copy.'],
  // 029 — no internal ids
  ['029', /\*\*Coordinator note:\*\* Stating a retention[^\n]*/, '**Why AMEND:** stating a retention and a response time is a new commitment. The contact routing itself was the accepted fix for 2026-08-29/FINDING-002 (`114f6dde`) and is not re-filed.'],
  // 030 / 031 — not regressions
  ['030', /\*\*Regression of \/ supersedes:\*\* /, '**Related:** '],
  ['030', /- Reviewer's GET-only gh reads[^\n]*/, '- `evidence/gh-settings-2026-10-03.txt` (coordinator, read-only, 2026-10-03): `actions/permissions` → `allowed_actions: all`, `sha_pinning_required: false`; `vulnerability-alerts` → 404 "Vulnerability alerts are disabled"; `code-scanning/alerts` → 404 "no analysis found".'],
  ['031', /\*\*Regression of \/ supersedes:\*\* /, '**Guard gap for:** '],
];

for (const [n, re, rep] of edits) {
  const p = `${D}/FINDING-${n}.md`;
  const t = readFileSync(p, 'utf8');
  const count = re.global ? (t.match(re) || []).length : re.test(t) ? 1 : 0;
  if (count < 1) throw new Error(`no match in ${p}: ${re}`);
  if (!re.global && (t.match(new RegExp(re.source, re.flags + 'g')) || []).length !== 1) throw new Error(`ambiguous match in ${p}: ${re}`);
  writeFileSync(p, t.replace(re, rep), 'utf8');
}
console.log(`applied ${edits.length} edits`);
