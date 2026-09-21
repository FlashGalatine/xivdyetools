---
name: security-audit
description: Use when asked for a security audit, security review, vulnerability scan, threat review, or "find vulnerabilities" of a xivdyetools app, worker, package, or the whole monorepo, or to plan security remediation sprints.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, Skill
---

# Security Audit (xivdyetools)

Document every vulnerability with evidence **before any code changes**, then hand the catalog to
`remediation-planner` for Severity × Exposure sprints (exploitable-now items ship out-of-band).
The audit has **two deliverables**: the finding catalog, and privacy policies that accurately
describe what the code actually does (Step 3a) — both policies are reconciled every run, at every
scope. Runs from the monorepo root `xivdyetools/`. Surface: Cloudflare Workers (Hono, D1, KV, R2,
service bindings), Discord HTTP interactions, OAuth/JWT, a Lit SPA on Pages, npm packages, CI.

Before executing the workflow, read `../audit-shared/model-routing.md` for the Claude/Codex runtime,
model-role, shell, and tool conventions; the primary coordinator applies its routing rules.

## Parameters

| Param | Values |
|---|---|
| SCOPE | deploy unit(s) or `all` (9 apps + 8 packages + CI/wrangler configs) |
| OUTPUT | default `docs/audits/YYYY-MM-DD-<scope>-security/` (`YYYY-MM-DD-security` for `all`) |

## Step 0 — load context

Read `../audit-shared/conventions.md` + `model-routing.md`, `../audit-shared/units.md` (exposure class per unit),
`../audit-shared/traps/shell.md` + `traps/security-git.md`. In the repo read
`docs/architecture/security-trade-offs.md` (accepted trade-offs — don't re-file them) and each
in-scope unit's `wrangler.toml`; open `SECURITY.md`, `docs/architecture/service-bindings.md` or a
unit's `CLAUDE.md` only when a check below needs them. Read **both privacy policies in full**
whatever the scope — `apps/web-app/PRIVACY.md` (web + beta) and
`apps/discord-worker/PRIVACY_POLICY.md` (bot), plus **both** Terms of Service
(`apps/web-app/TERMS_OF_SERVICE.md`, `apps/discord-worker/TERMS_OF_SERVICE.md`) for their data
claims and service descriptions: they are the governing promise for the Personal-data row
*and* the second deliverable. Read `../audit-shared/policy-documents.md` too: the four documents
ship in **six languages** (`<STEM>.<locale>.md` siblings; English unsuffixed and governing), and a
user who reads the Japanese policy is promised whatever the Japanese text says — every variant is
in scope, not just the English file. They are **cross-unit** — the web guide describes api-worker,
og-worker, oauth and presets-api behavior, the bot policy describes presets-api and Perspective —
so a single-unit scope still reconciles against both. If a previous security audit exists, read
its README + *Rejected suspicions* + *Positive controls* only (not the finding files) —
regressions are new findings cross-linked to the old ID.

## Step 1 — setup

```bash
git rev-parse --short HEAD; git branch --show-current; git status --porcelain
mkdir -p <OUT>/{findings,evidence}
```
README stub: scope, branch@commit, unit versions, method, "no source modified".

## Step 2 — automated evidence

This block is a fixed command list that produces files, not verdicts: assign it to the `collector`
role (`../audit-shared/model-routing.md`) when delegated and take back the evidence paths + hit counts.
Follow the coordinator rules for inline versus delegated execution.

```bash
pnpm audit --prod --json > <OUT>/evidence/pnpm-audit.json 2>&1 || true        # CI's gate: --prod --audit-level high (nightly)
pnpm audit --prod --audit-level high > <OUT>/evidence/pnpm-audit-summary.txt 2>&1 || true
# secrets: tree + history, using the repo's own config (allowlists test fixtures, client IDs)
gitleaks dir . -c .gitleaks.toml -f json -r <OUT>/evidence/gitleaks-tree.json --no-banner || true
gitleaks git  . -c .gitleaks.toml -f json -r <OUT>/evidence/gitleaks-history.json --no-banner || true
# (no gitleaks binary → note it; CI `secret-scan` runs gitleaks-action on every push)
git ls-files | grep -E '\.(ts|js|mjs|toml|json|jsonc|yml|yaml|md|py)$' \
  | xargs grep -n -E "(password|secret|api_key|apikey|token|credential|private_key)[^=:]{0,20}[=:][^=]{0,5}['\"][^'\"]{12,}" \
  > <OUT>/evidence/potential-secrets.txt 2>/dev/null || true
git ls-files '*/wrangler.toml' | xargs grep -n -E '^\[vars\]|^\[env\.|routes|workers_dev|custom_domain' > <OUT>/evidence/wrangler-surface.txt
git check-ignore -v apps/*/.dev.vars apps/*/.dev.vars.* >> <OUT>/evidence/wrangler-surface.txt 2>/dev/null
git diff --stat <previous-audit-commit>..HEAD -- <scope> > <OUT>/evidence/delta-since-last-audit.txt   # if a prior audit exists
# personal-data inventory: every SINK that persists or ships data, and every SOURCE that is a
# personal field — the review (Step 3, "Personal data") reconciles the two against the policies
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E \
  "writeDataPoint\(|\.put\(|\.prepare\(|INSERT INTO|localStorage\.setItem|sessionStorage\.setItem|indexedDB|sendBeacon\(|logger\.(info|warn|error|debug)\(" \
  > <OUT>/evidence/pii-sinks.txt 2>/dev/null || true
git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/' | xargs grep -n -E \
  "cf-connecting-ip|x-forwarded-for|x-real-ip|user-agent|navigator\.userAgent|\bemail\b|global_name|\bdiscriminator\b|\bavatar\b|\busername\b|guild_id|channel_id|guild_locale|\blocale\b|TypeName|Nickname|nickname|filename|crypto\.randomUUID\(\)|Date\.now\(\).*(id|session)" \
  > <OUT>/evidence/pii-sources.txt 2>/dev/null || true
# the THIRD artifact of the reconciliation: every testable claim the policies make, line-numbered,
# so Step 3a checks the written promise instead of the reviewer's memory of it
for f in apps/web-app/PRIVACY.md apps/web-app/TERMS_OF_SERVICE.md apps/discord-worker/PRIVACY_POLICY.md apps/discord-worker/TERMS_OF_SERVICE.md; do
  printf '\n===== %s =====\n' "$f"; grep -n -iE \
    "last updated|never|\bno\b|\bnot\b|only|complete list|discard|delet|expire|retention|[0-9]+[- ](second|day|month)|TTL|stored|sent|third|Analytics Engine|localStorage|IndexedDB|\bKV\b|\bD1\b|\bR2\b|/[a-z_]+" "$f"
done > <OUT>/evidence/policy-claims.txt
# the same four documents in the five other languages (policy-documents.md): which variants exist,
# and whether each carries the SAME numbers, commands, hosts, storage names, dates and structure as
# the English file. The English keyword grep above cannot read them — this sweep is how a softened
# or stale translation becomes visible. Exit 1 = a parity failure to triage, not a runner error.
git ls-files 'apps/*/PRIVACY*.md' 'apps/*/TERMS_OF_SERVICE*.md' > <OUT>/evidence/policy-variants.txt
python "<SKILL_DIR>/../audit-shared/scripts/policy-locale-parity.py" > <OUT>/evidence/policy-locale-parity.txt 2>&1 || true
# privacy copy also ships as UI strings (extractor "Privacy Protected" notice, sign-in note); these
# must agree with the policies, and editing one trips the i18n parity/order gates
git ls-files 'apps/web-app/src/locales/*.json' | xargs grep -n -iE \
  "privacy|never leave|not sent|we store|no character data" > <OUT>/evidence/policy-claims-i18n.txt 2>/dev/null || true
```

## Step 3 — review (per unit; the checklist by surface)

Scope > 1 unit → fan out per `conventions.md` §7 with the matching rows below pasted into each
prompt, using the `worker` role per §7a; each reviewer writes `evidence/review-<unit>.md` (route table
+ authz matrix, positive controls, rejected items, files covered) and returns the candidate
table. Coordinator verifies every candidate at `file:line` using the `verifier` role, inline when
permitted by §7a. Every Severity × Exposure call in Step 4 uses the same rule. Single unit → review inline unless
the coordinator rules require delegation.

| Surface | Check |
|---|---|
| **Every Worker (Hono)** | route-level auth/authz order (middleware before handlers); param/body validation + size caps (`readBodyWithCap`-style); D1 only via `.prepare().bind()` (no template SQL); KV/R2 key construction from user input; error handler leaks (stack/env/`/` root echo); `Cache-Control`/`Vary` on user-specific responses; CORS allowlist exact-match (oauth, presets-api, api-worker); rate limiting present and **fail-closed** (native `[[ratelimits]]`; KV limiter cannot throttle fast clients); secrets only as secrets (never `[vars]`), `.dev.vars*` gitignored; module-scope state shared across requests; `waitUntil` for side effects; logger redaction of tokens/IDs; outbound `fetch` targets allowlisted (SSRF), timeouts |
| **Discord bots** (discord-worker, moderation-worker) | Ed25519 signature verified before parsing; interaction freshness/timestamp; moderator/owner gates on *every* admin path incl. autocomplete + components (`MODERATOR_IDS`); `custom_id` parsing bounds; user text sanitized before cards/embeds (bot-logic sanitizer helpers); bot→presets-api signed with v2 (`X-Request-Signature-V2` + nonce, 60 s) and v1 acceptance removed once both bots deploy; webhook (`INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`) verification constant-time |
| **oauth** | `state` required + bound on every callback; redirect_uri allowlist; JWT alg pinned, `exp`, revocation list honored by `/auth/refresh` (blacklist must outlive `exp`); token TTLs; cookie flags; `[env.production]` absent → bare deploy is prod |
| **presets-api** | ownership + state-machine checks on every mutation (TOCTOU on status writes); moderation endpoints authz; upload type/size/dimension gates before image-worker; R2 keys not user-controlled; tag charset; pagination bounds; `author_discord_id` exposure; Perspective API key never in query string, **fail-closed** |
| **image-worker** | service-binding only (no routes); dimension gate from headers before decode (decompression bomb); body cap; photon panic paths; callers' contract |
| **og-worker** / **api-worker** | unbounded URL params (length, count, `O(n³)` wraps); `?lang=` allowlist; XML/SVG escaping of user text (`escapeXml`); edge cache keys incl. all params; Universalis proxy allowlist + timeouts; KV cache poisoning |
| **web-app** (Pages) | `_headers` CSP/HSTS/`X-Frame-Options` + pattern-merge trap; `innerHTML` sinks escaped (`escapeHtml`), `postMessage` origins; OAuth `state` forwarded; token storage + logout clears; third-party script/font origins; SW/cache rules; `public/` leaks |
| **Packages** | auth: HMAC key length floor (`createHmacKey` ≥ 32 B), constant-time compare, canonical string unambiguous (length-prefixed); logger: redaction list covers Discord/JWT/HMAC shapes; worker-kit: limiter defaults fail-closed; core: JSON parsing of untrusted `.chara`/preset input bounded |
| **Personal data — every unit** (CWE-359 privacy violation, CWE-532 log exposure) | xivdyetools has **no business reason to collect PII**; the only personal field with a documented purpose is the pseudonymous Discord user id, and only where a policy lists it. Reconcile `evidence/pii-sinks.txt` × `pii-sources.txt`: for each analytics datapoint (`writeDataPoint` blobs/doubles — web `apps/api-worker/src/telemetry/schema.ts`, bot `apps/discord-worker/src/services/analytics.ts`, og-worker), KV/D1/R2 write, structured log call and third-party request body, name every field and check it against the governing promise — `apps/discord-worker/PRIVACY_POLICY.md` §2 (never option values, message content, guild/channel ids), the web-app telemetry spec (`docs/superpowers/specs/2026-08-29-web-analytics-design.md`: no ids, no storage, opt-in default off, GPC honored, allowlist-validated server-side), the locale strings promising images never leave the browser. Flag: IP / UA / request id / username / avatar / email / guild or channel id / free text / file names / `.chara` `TypeName` / option values reaching any datapoint or log; any client-generated persistent or per-session identifier; telemetry that can fire while the opt-in is off or GPC is set; a server telemetry route that writes a field it did not validate against an enum or the dye DB; logger calls interpolating user objects (`{ user }`, `interaction.member`) rather than ids; exact timestamps or coarse buckets widened into fingerprints (viewport in px, full version strings, full locale tags). A field that is *harmless-looking* but not listed in the policy is still a finding (MEDIUM, exposure of the unit); a field the policy explicitly promises not to store is HIGH. Positive controls to record: allowlist schemas, `'invalid'`-not-reject envelope handling, `guild`/`dm` context blob, redaction lists |
| **Privacy policies — accuracy** (CWE-451 misrepresentation; every audit, every scope) | The reverse of the row above: there, code is checked against the policy; here, **every claim in the policy is checked against the code** and is a finding if it is false, stale or silent. Work from `evidence/policy-claims.txt`. (a) **Closure claims** — PRIVACY.md's "the sections below are the complete list" and "talks only to these first-party hosts", PRIVACY_POLICY.md §3 *Data We Do NOT Collect*: these convert *any* undisclosed sink into a violation, so enumerate them against `pii-sinks.txt` rather than reading for plausibility. (b) **Retention numbers vs real TTLs** — every "30 days" / "180 days" / "120-second" / "3 months" against the `expirationTtl`, TTL constant or Cloudflare default that actually applies. (c) **Named commands, toggles and UI paths** the policy tells users to use for access or deletion — each must still exist (the 5.0 cull left `/favorites`, `/collection`, `/match_image` in the bot policy: `2026-08-29-security/FINDING-008`). (d) **Named hosts and third parties** vs the CSP `connect-src`/`img-src`, wrangler routes and service bindings — a live third party missing (Perspective: `2026-08-29-security/FINDING-006`) and a removed one still listed are both findings, as is a dated claim about to expire (Perspective sunsets 2026-12-31 — `DEPRECATIONS.md`). (e) **Storage inventory** — what `localStorage`/IndexedDB/KV/D1/R2 actually holds vs what the policy says it holds (`2026-08-29-security/FINDING-009`: an IndexedDB image cache the guide said was discarded). (f) **Silence** — a real data flow no section addresses is an accuracy defect, not a permissible omission (`2026-09-15-security/FINDING-006`: og-worker operational logs carrying raw UA + full share URLs, outside the analytics section's scope). (g) **Contradiction across surfaces** — the two policies, the ToS service description, and the web app's in-product copy (`evidence/policy-claims-i18n.txt`) must agree. (h) **Stale `Last Updated`** relative to the last substantive change to what is described. (i) **Every language makes the same promise** (`../audit-shared/policy-documents.md`) — triage `evidence/policy-locale-parity.txt` first (missing variant, different retention number, a command or host present in one language only, a `Last updated` date that differs, no English-prevails notice), then have each variant **read by a reviewer of that language** against the English claim list: a "never" rendered as "normally not", a deletion right or opt-out dropped, a collected field listed in English only, a sentence left untranslated. A variant that promises *more* than the code does is false in that language; one that promises *less* hides a right. MEDIUM, INTERNET-UNAUTH. Checks (a)–(h) run on the English file and their verdict applies to all six — so a `Policy` CORRECT/AMEND lists every variant to edit. Missing variants are `documentation-audit`'s to file (and are the one known open finding `2026-09-19-i18n/I18N-010` until its remediation lands) |
| **CI / supply chain** | actions SHA-pinned, `permissions: contents: read`, OIDC publish (no npm token), `pnpm audit --prod` + gitleaks jobs present, `pnpm.overrides` for known advisories, deploy workflows gated on `main`, secrets not echoed in logs, D1 migration steps |

Skip generic items that do not apply here (LDAP/XPath/XXE, file-system traversal in Workers).

### Step 3a — reconciling the two directions (who gives way)

Every code↔policy mismatch resolves one of three ways, and the choice is a finding field, not a
judgment call made while editing:

1. **Code collects something undisclosed, with no documented purpose** → **fix the code**. The
   project's stance is "collect nothing personal"; amending the policy to cover it is the failure
   mode this step exists to prevent, not the fix.
2. **Code collects something undisclosed that is genuinely necessary** → still a finding against
   the code (MEDIUM, exposure of the unit). Fix = **minimize first, then disclose**: cut the field
   to the coarsest form that works, and only then amend the policy. The amendment broadens a public
   commitment, so it needs the maintainer's explicit yes at the §8 gate — flag it in the gate, do
   not fold it in with the code fixes.
3. **The policy describes something the code does not do, no longer does, or never addressed** →
   **fix the policy**. Users are being told something false, so it is still a finding (LOW–MEDIUM,
   INTERNET-UNAUTH — anyone can read it), but the fix is a document edit only.

Findings are still written before anything is edited, and Step 1's "no source modified" still holds
for the audit phase: policy edits land in remediation, after the §8 gate, like every other fix.
An amendment (case 2) **never ships before** the code change it describes, or the policy briefly
describes a state that is not yet true.

## Step 4 — findings (`findings/FINDING-XXX.md`, skeleton `conventions.md` §3)

Header fields: **Severity** CRITICAL|HIGH|MEDIUM|LOW|INFO · **Exposure** INTERNET-UNAUTH |
INTERNET-AUTH | INTERNAL (service binding) | LOCAL (build/dev) · **Deploy unit** · **Rotation**
NONE | ROTATE (list what: keys, signing secrets, OAuth client secrets, live JWTs) · **Policy**
NONE | CORRECT `<file>` §n (align the text to what the code already does — no new commitment) |
AMEND `<file>` §n (state something newly collected — needs the §8 yes) · **CWE**.
Severity × Exposure orders sprints — an INTERNET-UNAUTH MEDIUM outranks a LOCAL HIGH. Evidence
cites `file:line` and, for reachable issues, the request that triggers it. Keep exploit detail
for unpatched items inside the audit folder.

## Step 5 — `SECURITY_AUDIT_REPORT.md` (skeleton `conventions.md` §4)

Add: severity × exposure count table; **Sprint 0 — exploitable now** (IDs); **Pending rotation**
`| ID | Credential | Rotated? | Revoked? |`; **Pending policy edits**
`| ID | Document | § | CORRECT/AMEND | Landed? |` (empty table with "none" if every claim verified —
that is itself a positive control worth recording); catalog `| ID | Title | Sev | Exposure | Deploy unit |
Rotation |`; *Positive controls*; *Rejected suspicions*; *Remediation status* `| ID | Status | Commit |`
kept current as fixes land (each finding's `## Status` mirrors it).

## Step 6 — hand off + confirm

Hand off to `remediation-planner` through the available skill loader (or read its `SKILL.md` if no
loader is available), passing `<OUT>/SECURITY_AUDIT_REPORT.md` (+ any other open catalogs). Planner
rules the audit relies on: Sprint 0 items ship **individually, out-of-band**;
**rotation happens before the commit that removes a secret is pushed** (removal never un-leaks;
a public removal commit advertises the leak); hardening last. Policy edits ride with the sprint of
the unit that owns the document (`apps/web-app` for PRIVACY.md and its ToS, `apps/discord-worker`
for the bot policy and ToS — each with all its locale variants) — never earlier than the code change they describe — and a finding carrying a
`Policy` field is not done until both halves land. Then the confirmation gate
(`conventions.md` §8): present catalog + plan, call out Sprint 0, the rotation checklist **and
every AMEND row** (each is a new public commitment the maintainer is agreeing to make),
get an explicit yes before any fix.

## Rules

- Document before modifying; preserve the vulnerable code in evidence; findings are leads until
  verified at `file:line`.
- Severity × Exposure, not severity alone. Exploitable-now never waits for a batched release.
- A code fix does not close a ROTATE finding — both must land; rotation runbook
  `docs/operations/SECRET_ROTATION.md` (mind which worker `wrangler secret put` hits).
- Token-shaped test fixtures trip GitHub push protection — use obviously fake shapes.
- Personal data is a finding by default: the project's stance is "collect nothing personal";
  the auditor's job is to find fields that crept in, not to argue they are low-risk. A privacy
  promise in a policy, spec, or user-facing string is a security requirement.
- **A policy amendment never closes a collection finding on its own.** Widening the promise to
  match code that should not be collecting turns a fixable leak into a disclosed one; the code
  fix is the default and the AMEND is only ever the second half of it (Step 3a case 2).
- Every content change bumps that file's own `Last Updated` line **in that file's own format** —
  `**Last updated:** YYYY-MM-DD` in `PRIVACY.md`, `**Last Updated**: Month D, YYYY` in
  `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`. `PRIVACY_POLICY.md` §11 also promises a Discord
  announcement for significant changes: an AMEND is significant, a CORRECT usually is not — say
  which in the finding's Fix.
- **A policy edit is a six-file edit.** Every CORRECT/AMEND changes the English file and its five
  `<STEM>.<locale>.md` siblings in one commit, bumps all six `Last Updated` lines to the same date,
  and re-runs `policy-locale-parity.py` to exit 0. An English-only policy fix leaves five languages
  still making the false claim — the finding stays open. The translations are listed in the commit
  like any generated translation; flag a clause whose rendering needed interpretation.
- Privacy copy also lives in `apps/web-app/src/locales/*.json` (six locales). Touching it means all
  six plus `pnpm --filter xivdyetools-web-app run validate:i18n` (parity + key order), not just `en`.
- A policy change **is** user-visible, so it belongs in the laymans changelogs even though
  `../audit-shared/changelog-contract.md` folds security-only patches out of them.
- Stage only your own paths; one commit per unit when fixing; update `## Status` + the status table.
