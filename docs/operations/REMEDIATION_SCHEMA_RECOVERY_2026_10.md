# Held D1 migrations: read-only preflight and recovery checklist — October 2026

**PREPARATION ONLY — production activation is on hold.** This document authorizes no merge, package publication, remote database access, hosted request, deployment, workflow dispatch, command registration or announcement.

Reference tree: branch `codex/release-cut-f-03-readiness-20261030` at `2ac97b6fb37c12640a70af0aebac42d4086912e0`, prepared 2026-10-30. Line citations in code spans are to that tree. No database, Cloudflare account or hosted service was contacted while preparing this page. Back to the [October 2026 A/R/H release and adoption runbook](REMEDIATION_RELEASE_2026_10.md).

**Commands on this page are for the maintainer, not for the preparation session.** Every command in sections 0, A.2, A.3, B.2 and B.3 is listed so it can be reviewed in advance. Section 0 and the preflight blocks read the remote account or database; the apply commands in A.3 and B.3 mutate production and each needs its own explicit authorization (go/no-go row 1). The read-only remote queries in section 0, A.2 and B.2 are also remote database access: each needs its own separately approved exact scope before it is run (the handoff's hold on remote schema probes and row reads), and go/no-go row 1 applies to them as well. The runbook states that no export, row lookup, schema probe or migration was executed during preparation (`docs/operations/REMEDIATION_RELEASE_2026_10.md:161-163`).

Notation: `<WRANGLER>` means `pnpm --filter <package> exec wrangler`, run so that it reads that package's `wrangler.toml`. Neither `database_id` nor any account id is copied into this page: the table rows cite the `wrangler.toml` line, and the maintainer compares the value at that line with what `d1 info` returns.

---

## 0. Account and environment verification (maintainer, before any D1 command)

1. `<WRANGLER> whoami` prints the account name and id. Compare it with the maintainer's recorded production account. No `apps/*/wrangler.toml` pins an `account_id` (a search of all `apps/*/wrangler.toml` found none), so the account comes from the logged-in token or the `CLOUDFLARE_ACCOUNT_ID` variable; deploy workflows use a shared repository secret of that name (`docs/operations/DEPLOY_ENVIRONMENTS.md:90`). REQUIRED FROM MAINTAINER: expected account id, recorded privately.
2. `<WRANGLER> d1 info <database_name>` returns the database UUID. It must equal the `database_id` at the `wrangler.toml` line cited in the A.1 / B.1 identity tables (database_id: see that line). If the CLI resolves a different database, STOP.
3. Run from the correct package directory. A wrong or missing `--env` is the main way to reach the wrong database (E.6).
4. Confirm the held-release state: the production hold is still in force for everything except the one authorized unit and action (runbook section 8, "Authorization/hold" row, `docs/operations/REMEDIATION_RELEASE_2026_10.md:256`).
5. Recompute SHA-256 on the exact file to be passed to `--file` and compare with the value in the identity table. A mismatch means STOP.

---

## A. OAuth: `apps/oauth/migrations/0002_identity_transitions.sql`

### A.1 Identity

| Item | Value | Evidence |
|---|---|---|
| Worker / package | `xivdyetools-oauth` / `xivdyetools-oauth-worker` | `apps/oauth/wrangler.toml:1`, `apps/oauth/package.json:2` |
| Database and binding (production is the top-level block) | `binding = "DB"`, `database_name = "xivdyetools-users"`; database_id: see that line | `apps/oauth/wrangler.toml:75-78` |
| `--env` flag | NONE. oauth has no `[env.production]`; the top-level block is production | `apps/oauth/wrangler.toml:27` comment "Top-level block = PRODUCTION"; `docs/developer-guides/deployment.md:174-175` |
| Do-not-use env | `[env.development]` binds `xivdyetools-users-dev` with a placeholder `database_id` (`TODO_RUN_WRANGLER_D1_CREATE`). Do not use or replace it | `apps/oauth/wrangler.toml:80-87`; `docs/operations/DEPLOY_ENVIRONMENTS.md:486` |
| File SHA-256 | `86aaf4c19ab98d86383621d54749e5c2429b435eb4aded7392119377fbe49882` | `sha256sum` of the file at the reference tree, 2026-10-30 |
| Order | Before merging cut 07 (#378), whose merge deploys the dependent OAuth worker (A.3 Order; 2026-10-31) | migration header `apps/oauth/migrations/0002_identity_transitions.sql:1`; runbook `docs/operations/REMEDIATION_RELEASE_2026_10.md:167`; phase C1 at `:142`; `docs/operations/DEPLOY_ENVIRONMENTS.md:488-489` |

Statement inventory (4 statements; line numbers are in the migration file):

| # | Lines | Statement | Object |
|---|---|---|---|
| 1 | 3 | `ALTER TABLE users ADD COLUMN identity_revision INTEGER NOT NULL DEFAULT 0 CHECK (identity_revision >= 0)` | column `users.identity_revision` |
| 2 | 5-18 | `CREATE TABLE identity_operations (...)`, no `IF NOT EXISTS` | table `identity_operations`; column CHECKs at 8, 9, 11, 14; table CHECKs at 15, 16, 17 |
| 3 | 19-22 | `CREATE TABLE identity_operation_locks (...)`, no `IF NOT EXISTS` | table `identity_operation_locks`; FK `operation_id -> identity_operations(id) ON DELETE CASCADE` (line 21) |
| 4 | 23 | `CREATE INDEX idx_identity_operation_locks_operation ON identity_operation_locks(operation_id)` | index |

No triggers. No statement is idempotent: a replay fails at statement 1 (duplicate column) and would fail at statements 2-4 (existing objects).

### A.2 Read-only preflight (maintainer only)

```bash
# FOR THE MAINTAINER ONLY. Not for the preparation session. Read-only SELECT/PRAGMA.
cd apps/oauth
# P1: which of the new objects exist (the sql text is also what the (b) comparison uses)
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name IN ('users','identity_operations','identity_operation_locks','idx_identity_operation_locks_operation') OR tbl_name IN ('identity_operations','identity_operation_locks') ORDER BY type, name"
# P2: column list of users
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "PRAGMA table_info(users)"
# P3: columns of the new tables (empty result = table absent)
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "PRAGMA table_info(identity_operations)"
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "PRAGMA table_info(identity_operation_locks)"
# P4: indexes and foreign key
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "PRAGMA index_list(identity_operations)"
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "PRAGMA index_list(identity_operation_locks)"
pnpm exec wrangler d1 execute xivdyetools-users --remote --command "PRAGMA foreign_key_list(identity_operation_locks)"
```

PRAGMA through D1: the migration's own procedures already run `PRAGMA table_info` and `PRAGMA index_list` through `wrangler d1 execute --remote` (`apps/oauth/migrations/0001_drop_xivauth_characters.sql:36,44,56`; `apps/presets-api/migrations/0013_moderation_log_user_actions.sql:34`). `foreign_key_list` is not used anywhere in the tree, so D1 acceptance of it is UNKNOWN; the read-only fallback is `SELECT * FROM pragma_foreign_key_list('identity_operation_locks')`.

**Expected results.** Statements marked "local run" come from an in-memory SQLite 3.50.4 database built from the migration files with Python's `sqlite3` module. That run touched no remote database and D1's SQLite version may differ.

(a) ABSENT (pre-migration):
- P1: exactly one row (`type=table`, `name=users`). The existing `users` indexes do not match the P1 filter, so they are not returned. No `identity_operations`, `identity_operation_locks`, `idx_identity_operation_locks_operation` or `sqlite_autoindex_identity_*` row (local run).
- P2: no `identity_revision` row. Per `apps/oauth/schema/users.sql:15-27` and migration 0001, the expected existing columns are `id, discord_id, xivauth_id, auth_provider, username, created_at, updated_at` (7). Production's real column list has not been read: UNKNOWN, compare with the maintainer's record.
- P3, P4: empty result sets.

(b) FULLY APPLIED:
- P1 returns 6 rows (local run): `users`, the two new tables, `idx_identity_operation_locks_operation`, `sqlite_autoindex_identity_operations_1`, `sqlite_autoindex_identity_operation_locks_1`.
- P2 gains exactly one row, `name=identity_revision, type=INTEGER, notnull=1, dflt_value=0, pk=0`, at the last cid (7 when the table had 7 columns). Local run: SQLite inserts the `ADD COLUMN` text at the end of the column list, before any table-level CHECK, so the stored `users` SQL contains the substring `identity_revision INTEGER NOT NULL DEFAULT 0 CHECK (identity_revision >= 0)`. Compare the column list, not the whole text, for `users`.
- `identity_operations` table_info, in order (cid 0-8): `id TEXT notnull=1 pk=1`; `payload_json TEXT 1`; `payload_hash TEXT 1`; `state TEXT 1`; `created_at INTEGER 1`; `expires_at INTEGER 1`; `finished_at INTEGER 0`; `acknowledged_at INTEGER 0`; `resolution TEXT 0` (`apps/oauth/migrations/0002_identity_transitions.sql:6-14`). Only `id` has pk=1; all `dflt_value` are NULL (local run).
- `identity_operation_locks` table_info: `resource_key TEXT notnull=1 pk=1`; `operation_id TEXT notnull=1 pk=0` (lines 20-21).
- P4: `identity_operations` has `sqlite_autoindex_identity_operations_1` (unique 1, origin `pk`). `identity_operation_locks` has `sqlite_autoindex_identity_operation_locks_1` (unique 1, origin `pk`) and `idx_identity_operation_locks_operation` (unique 0, origin `c`, partial 0). The FK list has one row: table `identity_operations`, from `operation_id`, to `id`, on_update `NO ACTION`, on_delete `CASCADE` (local run).
- P1 `sql` for the two tables and the index equals the migration text from `CREATE` to the closing parenthesis, without the trailing `;` (lines 5-18, 19-22, 23). Local run: SQLite preserves the original whitespace and line breaks, and nothing was removed because these statements have no `IF NOT EXISTS`. The three table CHECK expressions (lines 15-17) are the content to compare character by character.
- Cross-check: the same definitions appear in `apps/oauth/schema/users.sql:33-51` (the fresh-schema route). In a fresh database `identity_revision` is the fifth column (`apps/oauth/schema/users.sql:20`), so its cid differs from a migrated database. Do not use cid order as a pass/fail criterion (E.3).

(c) PARTIAL: anything else, for example the column present but a table missing (statement 1 ran, later ones did not), one table present without the index, or a definition that differs in any CHECK. Classify by the first of statements 1-4 that is absent. STOP; do not replay the file. Reconcile by a maintainer-approved, per-statement plan reviewed against A.1. Repository precedent for a partial state: the 2026-09-15 rollout applied only the reviewed missing statement after inspecting the database (`docs/operations/security-remediation-2026-09-15.md:26`).

### A.3 Apply facts (maintainer only, separate authorization)

- One execution only, from `apps/oauth` with no `--env`: `wrangler d1 execute xivdyetools-users --remote --file=./migrations/0002_identity_transitions.sql` (`docs/developer-guides/deployment.md:164-177`; migration header `apps/oauth/migrations/0002_identity_transitions.sql:1-2`).
- Never `wrangler d1 migrations apply`. Repository reason: no `d1_migrations` table records these files, so it would replay every file and fail on the first duplicate column (`docs/developer-guides/deployment.md:180-181`). Also forbidden: replaying a fresh schema onto an existing database (`docs/operations/REMEDIATION_RELEASE_2026_10.md:170-171`). The per-file rule is also in `docs/developer-guides/contributing.md:160`.
- Atomicity: the tree states several times that a `--file` batch is atomic (`apps/oauth/migrations/0001_drop_xivauth_characters.sql:62-63`, "D1 rejects explicit transaction control and wraps a --file batch itself"; `apps/presets-api/migrations/0012_submission_events_text_edit.sql:31-32`; `apps/presets-api/migrations/0013_moderation_log_user_actions.sql:44-45`). `apps/presets-api/migrations/0013_moderation_log_user_actions.sql:59-62` nonetheless says to treat a partial state as possible, because a `--file` run is not guaranteed to be one transaction end to end. None of this is verified against Cloudflare documentation. After any error, rerun the A.2 preflight and assume a partial state until it proves otherwise.
- Order: after A.2 shows ABSENT and before merging cut 07 (#378), because the merge to `main` is what deploys (`docs/developer-guides/deployment.md:189-191`). Approve no DW-oauth run started after #378 is on `main` until go/no-go row 11 is recorded: `.github/workflows/deploy-oauth.yml` also fires on the shared package paths and root inputs (2026-10-31). This precedes OAuth 3.2.0 (phase C1: `IDENTITY_SPLIT_ENABLED=false`, no outbound `BAN_CONTINUITY` binding; `docs/operations/REMEDIATION_RELEASE_2026_10.md:142`). Activation is a separate later change (`docs/operations/DEPLOY_ENVIRONMENTS.md:491-492`).
- Stop conditions: any object present in the ABSENT check; `identity_revision` present without the tables; any definition mismatch; `whoami` or `d1 info` mismatch; SHA mismatch; any execute error.

---

## B. Presets: `apps/presets-api/migrations/0016_ban_identity_continuity.sql`

### B.1 Identity

| Item | Value | Evidence |
|---|---|---|
| Database and binding (production) | `binding = "DB"`, `database_name = "xivdyetools-presets"`; database_id: see that line | `apps/presets-api/wrangler.toml:92-95` (`[[env.production.d1_databases]]`) |
| Same database also bound by | presets-api top-level, moderation-worker top-level and moderation-worker production, each with the same `database_id` value as the line above (comparison made by the preparer; value not reproduced) | `apps/presets-api/wrangler.toml:22-25`; `apps/moderation-worker/wrangler.toml:31-34` and `:101-104` |
| `--env` flag | `--env production` (`docs/developer-guides/deployment.md:170-172`). The id is identical in both presets-api blocks, so the flag selects the worker, not the database | |
| File SHA-256 | `c1928eb57427a7c231ac74bfb1265e9eb69730089c42b0baf1ea828dfeda9be0` | `sha256sum` of the file at the reference tree, 2026-10-30 |
| Order | Once, before presets AND moderation-worker, and required even while feature flags are false | runbook `docs/operations/REMEDIATION_RELEASE_2026_10.md:168` and `:173-174`; `docs/operations/DEPLOY_ENVIRONMENTS.md:503-505`; phase C2 at `:143` |

Statement inventory (9 statements; every one is `IF NOT EXISTS`; line numbers are in the migration file):

| # | Lines | Kind | Object |
|---|---|---|---|
| 1 | 2-7 | CREATE TABLE | `ban_identity_memberships` (PK `(ban_id, identity_id)`; FK `ban_id -> banned_users(id) ON DELETE CASCADE` at line 3; CHECK `source IN ('confirmed','continuity')` at line 5) |
| 2 | 8 | CREATE INDEX | `idx_ban_memberships_identity` on `(identity_id, ban_id)` |
| 3 | 10-18 | CREATE TRIGGER | `ban_membership_insert_capacity` (BEFORE INSERT, limit 64) |
| 4 | 20-29 | CREATE TRIGGER | `ban_membership_update_capacity` (BEFORE UPDATE OF ban_id, identity_id) |
| 5 | 31-38 | CREATE TRIGGER | `ban_legacy_update_capacity` (BEFORE UPDATE OF discord_id, xivauth_id on `banned_users`) |
| 6 | 40-63 | CREATE TABLE | `ban_continuity_operations` (column CHECKs at 42, 43, 44, 45, 46, 47, 48; table CHECKs at 50-56 and 57-62) |
| 7 | 64 | CREATE INDEX | `idx_ban_continuity_retention` on `(state, expires_at, acknowledged_at)` |
| 8 | 66-83 | CREATE TABLE | `moderation_ban_confirmations` (CHECKs at 69, 70, 71, 73, 74, 75, 76, 79, 80, 81-82) |
| 9 | 84 | CREATE INDEX | `idx_ban_confirmations_expiry` on `(expires_at)` |

Dependencies on pre-existing schema: table `banned_users` with columns `id`, `discord_id`, `xivauth_id` (`apps/presets-api/schema.sql:161-173`). Statement 1's FK and statement 5's `UPDATE OF` need them.

### B.2 Read-only preflight (maintainer only)

```bash
# FOR THE MAINTAINER ONLY. Not for the preparation session. Read-only SELECT/PRAGMA.
cd apps/presets-api
D="pnpm exec wrangler d1 execute xivdyetools-presets --remote --env production --command"
# P0: prerequisite table and columns
$D "PRAGMA table_info(banned_users)"
# P1: existence and exact definitions of all nine objects plus the autoindexes
$D "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name IN ('ban_identity_memberships','ban_continuity_operations','moderation_ban_confirmations') OR name IN ('ban_membership_insert_capacity','ban_membership_update_capacity','ban_legacy_update_capacity') ORDER BY type, name"
# P2: columns
$D "PRAGMA table_info(ban_identity_memberships)"
$D "PRAGMA table_info(ban_continuity_operations)"
$D "PRAGMA table_info(moderation_ban_confirmations)"
# P3: indexes and foreign key
$D "PRAGMA index_list(ban_identity_memberships)"
$D "PRAGMA index_list(ban_continuity_operations)"
$D "PRAGMA index_list(moderation_ban_confirmations)"
$D "PRAGMA foreign_key_list(ban_identity_memberships)"
```

**Expected results** (local run = in-memory SQLite 3.50.4 with a stand-in `banned_users` table, not D1):

(a) ABSENT: P0 shows `id`, `discord_id`, `xivauth_id` (and the other columns at `apps/presets-api/schema.sql:162-170`). P1 returns no row for any of the nine objects, their autoindexes, or the trigger `ban_legacy_update_capacity` (which sits on `banned_users`, so it is matched by name). P2 and P3 return empty sets.

(b) FULLY APPLIED: P1 returns exactly 12 rows (local run): 3 tables, 3 explicit indexes, 3 `sqlite_autoindex_*_1` rows and 3 triggers.
- Stored SQL: local run shows SQLite stores each table, index and trigger as `CREATE TABLE|INDEX|TRIGGER <name> ...` with `IF NOT EXISTS` removed and the original whitespace and line breaks kept. The expected text is therefore the migration text with that clause removed and the trailing `;` dropped: tables lines 2-7, 40-63, 66-83; indexes lines 8, 64, 84; triggers lines 10-18, 20-29, 31-38. D1 behavior is not verified, so treat a difference limited to that clause as normalization. The maintainer can reproduce the local run by executing the file in a scratch in-memory SQLite.
- `ban_identity_memberships` table_info: `ban_id TEXT notnull=1 pk=1`; `identity_id TEXT notnull=1 pk=2`; `source TEXT notnull=1 pk=0`.
- `ban_continuity_operations`, in order: `id TEXT notnull=0 pk=1`; `payload_hash TEXT 1`; `state TEXT 1`; `refusal_reason TEXT 0`; `matched_bans INTEGER 0`; `expires_at INTEGER 1`; `applied_at INTEGER 0`; `acknowledged_at INTEGER 0`; `acknowledged_outcome TEXT 0`.
- `moderation_ban_confirmations`, in order: `nonce TEXT notnull=0 pk=1`; `actor_id TEXT 1`; `action TEXT 1`; `mode TEXT 1`; `phase TEXT 1`; `ban_id TEXT 0`; `proposal_json TEXT 1`; `proposal_hash TEXT 1`; `created_at INTEGER 1`; `expires_at INTEGER 1`; `consumed_at INTEGER 0`; `outcome TEXT 0`.
- Indexes: `idx_ban_memberships_identity` (`identity_id, ban_id`), `idx_ban_continuity_retention` (`state, expires_at, acknowledged_at`), `idx_ban_confirmations_expiry` (`expires_at`), all origin `c`, unique 0. Autoindexes (origin `pk`, unique 1): memberships composite PK, operations `id`, confirmations `nonce`.
- FK list for memberships: one row, table `banned_users`, from `ban_id`, to `id`, on_delete `CASCADE`, on_update `NO ACTION`.

(c) PARTIAL: any other combination, including a subset of objects, a trigger present with a different body, or any CHECK that differs. **Because every statement is `IF NOT EXISTS`, an accidental replay reports success while keeping an older or different definition.** A successful run therefore never proves the schema matches; only the (b) comparison does. STOP on (c) and reconcile definitions by name; do not replay (`docs/operations/REMEDIATION_RELEASE_2026_10.md:171-173`). Repository precedent: apply only the reviewed missing statement after inspection (`docs/operations/security-remediation-2026-09-15.md:26`).

### B.3 Apply facts (maintainer only, separate authorization)

- One execution only, from `apps/presets-api`: `wrangler d1 execute xivdyetools-presets --remote --env production --file=./migrations/0016_ban_identity_continuity.sql` (`docs/developer-guides/deployment.md:170-172`; `docs/developer-guides/contributing.md:160`). Never `d1 migrations apply`. Never replay `schema.sql`: `db:migrate` re-runs the whole `schema.sql` and its script omits `--env production` (`apps/presets-api/package.json:12`; migration header `apps/presets-api/migrations/0016_ban_identity_continuity.sql:1`).
- Order: B.2 shows ABSENT, then apply, then run the preflight again to show (b). Only then deploy presets-api AND moderation-worker; both read the membership tables (`docs/operations/REMEDIATION_RELEASE_2026_10.md:168`, `:173-174`).
- Stop conditions: P0 lacks `banned_users` or its columns; any of the nine objects already exists; any definition difference; `whoami` or `d1 info` mismatch; SHA mismatch; any execute error. Atomicity of a `--file` batch is stated by the tree but not guaranteed (see A.3), so treat a partial state as possible after an error.
- Do not deploy any presets-api or moderation-worker variant before this migration. That includes the routeless `-dev` top-level workers, which bind the same database as production (`apps/presets-api/wrangler.toml:22-25`; `apps/moderation-worker/wrangler.toml:31-34`).

---

## C. Recovery (both databases)

Facts from the repository: local SQLite preservation and transaction tests are not a production backup/restore rehearsal. Any export needs an approved exact destination plus access and retention scope. Keep user data and private receipts out of Git. A timeout or expiry does not prove a remote operation was refused (`docs/operations/REMEDIATION_RELEASE_2026_10.md:176-179`).

**Required before any mutation** (a blank or mismatched required field blocks release, `docs/operations/REMEDIATION_RELEASE_2026_10.md:252`):

| Fact | Value |
|---|---|
| Recovery owner (named person) for `xivdyetools-users` | REQUIRED FROM MAINTAINER |
| Recovery owner for `xivdyetools-presets` | REQUIRED FROM MAINTAINER |
| Backup/export method and what each captures. Repository precedent: capture a D1 Time Travel bookmark before changing the schema and keep it as recovery evidence, never restoring production data automatically (`docs/operations/security-remediation-2026-09-15.md:26`). Time Travel retention and export locking behavior are UNKNOWN here (not in the tree; not looked up, since the preparation session may not rely on unreviewed vendor pages for a restore decision). | REQUIRED FROM MAINTAINER |
| Exact destination of each export (path or bucket) | REQUIRED FROM MAINTAINER |
| Access scope (who can read) | REQUIRED FROM MAINTAINER |
| Retention scope and deletion date | REQUIRED FROM MAINTAINER |
| Restore rehearsal status (target, date, result) | REQUIRED FROM MAINTAINER |
| Bookmark or export identity recorded immediately before the migration | REQUIRED FROM MAINTAINER |
| Maintenance window and the decision-maker for a coordinated restore | REQUIRED FROM MAINTAINER |

Export caution: an export writes user data (OAuth `users` rows and ban records) to a file. The destination must be approved first and be outside Git.

**Rollback rules (additive schema)**
- Both migrations are additive: they add a column, tables, indexes and triggers and drop nothing. Preserve the added schema, pending identity operations and locks while rolling code back (`docs/operations/REMEDIATION_RELEASE_2026_10.md:178-179`). Do not drop the new objects as a rollback step.
- Rolling OAuth code back keeps `identity_revision` and the two tables in place; older code ignores them. Do not touch the 0001 rollback traps (`apps/oauth/migrations/0001_drop_xivauth_characters.sql` header).
- Presets and moderation: older code ignores the new tables, but the capacity triggers still fire on writes to `banned_users` and the membership table. A code rollback therefore does not remove the 64-identity cap.
- `ban_identity_memberships` has an FK with `ON DELETE CASCADE` to `banned_users` (`apps/presets-api/migrations/0016_ban_identity_continuity.sql:3`), and `identity_operation_locks` cascades from `identity_operations` (`apps/oauth/migrations/0002_identity_transitions.sql:21`). Deleting parent rows during cleanup silently deletes dependents.
- **After identity/ban activation, restoring either database independently, or rolling code back, can undo authorization history.** Examples are bans, unbans, continuity memberships and identity transitions. A flag toggle or an old binary does not restore safety. Stop for a coordinated recovery decision across `xivdyetools-users` and `xivdyetools-presets` (`docs/operations/REMEDIATION_RELEASE_2026_10.md:180-182`).
- Before activation the new schema is unused by live flows, so a single-database restore is lower risk. Whether anything was written is UNKNOWN and must be checked, not assumed.

---

## D. Go / no-go table

| # | Gate | Evidence required | Approver |
|---|---|---|---|
| 1 | Production hold lifted for this unit and action; other workflows still held | Effective protection readback and named authorization (`docs/operations/REMEDIATION_RELEASE_2026_10.md:256`) | Maintainer (name REQUIRED FROM MAINTAINER) |
| 2 | Account id matches expectation | `whoami` output against the recorded id | Maintainer |
| 3 | Database identity: oauth `wrangler.toml:75-78`; presets `wrangler.toml:92-95` | `d1 info` UUID equals the `database_id` at that line; correct `--env` (oauth none; presets production) | Maintainer |
| 4 | File SHA matches (oauth `86aaf4c1...9882`, presets `c1928eb5...9be0`) | Fresh `sha256sum` of the file being passed | Maintainer and a second reviewer |
| 5 | Preflight state is ABSENT (A.2 a / B.2 a) | Saved private output of the preflight queries | Maintainer |
| 6 | Pre-existing schema prerequisites (users columns incl. 0001 applied; `banned_users` columns) | P2 / P0 output | Maintainer |
| 7 | Recovery owners, destination, access/retention and rehearsal recorded (section C table filled) | Private receipt | Recovery owner and maintainer |
| 8 | Export or bookmark taken and identity recorded | Receipt entry | Recovery owner |
| 9 | Dependents held: OAuth 3.2.0 not yet deployed; presets and moderation not deployed | Deploy-workflow state | Maintainer |
| 10 | Provider order satisfied (oauth first; presets/moderation need `IdentityLookup` verified) | `docs/operations/REMEDIATION_RELEASE_2026_10.md:142-143`; `docs/operations/DEPLOY_ENVIRONMENTS.md:488-505` | Maintainer |
| 11 | Post-apply state equals FULLY APPLIED (A.2 b / B.2 b); once-only result recorded | Second preflight output and execute result | Maintainer |
| 12 | Any (c) partial state, existing object or error | STOP, preserve receipts, hold dependents (`docs/operations/REMEDIATION_RELEASE_2026_10.md:264`, `:266-267`) | Maintainer, with recovery owner |

---

## E. Ambiguities and inconsistencies

1. **Idempotence differs.** The runbook says "once" for both. 0002 is non-idempotent (ALTER plus bare CREATEs). 0016 is entirely `IF NOT EXISTS`, so a second run succeeds while hiding definition drift. The runbook says "do not infer success from object names" (`docs/operations/REMEDIATION_RELEASE_2026_10.md:171-173`) but gives no per-object comparison text. B.2 supplies it.
2. **Runbook preflight list is incomplete for presets.** It names "capacity triggers and retention/lookup indexes" (`docs/operations/REMEDIATION_RELEASE_2026_10.md:168`) but omits the prerequisite `banned_users` columns that trigger 5 and the FK require. It also omits the 3 autoindexes and does not state that there are 3 triggers and 3 explicit indexes.
3. **Column position.** On a migrated `users` table `identity_revision` is the last column. In `apps/oauth/schema/users.sql:20` (fresh route) it is fifth. The tables are functionally equal but not textually equal, so a text-equality gate on `users` would fail falsely on one route.
4. **D1 behavior is untested.** D1 acceptance of `PRAGMA foreign_key_list`, and whether D1 stores `IF NOT EXISTS` or `ALTER` text the way SQLite 3.50.4 does locally, cannot be settled without contacting a database. The local run settles only SQLite itself. `table_info` and `index_list` have in-tree remote precedent (A.2).
5. **Atomicity statements are in tension.** The tree says a `--file` batch is atomic (`apps/oauth/migrations/0001_drop_xivauth_characters.sql:62-63`; `apps/presets-api/migrations/0012_submission_events_text_edit.sql:31-32`; `apps/presets-api/migrations/0013_moderation_log_user_actions.sql:44-45`) yet warns to treat a partial state as possible (`apps/presets-api/migrations/0013_moderation_log_user_actions.sql:59-62`). The runbook's "partially applied" stop rule (`docs/operations/REMEDIATION_RELEASE_2026_10.md:171-172`) agrees with the caution. Not verified against Cloudflare documentation.
6. **Dev workers hit the production database.** presets-api top-level (`apps/presets-api/wrangler.toml:22-25`) and moderation-worker top-level (`apps/moderation-worker/wrangler.toml:31-34`) bind the production database although they are described as routeless dev workers. The runbook names `--env production` for the migration (`docs/operations/REMEDIATION_RELEASE_2026_10.md:168`), but a bare dev deploy also needs 0016.
7. **`db:migrate` hazard.** `apps/presets-api/package.json:12` re-runs `schema.sql` against `--remote` with no `--env`. It is not a migration path, but the name invites misuse (`docs/developer-guides/deployment.md:183-185` warns).
8. **OAuth sequencing wording.** The 0002 header says "BEFORE deploying the dependent OAuth worker". `docs/developer-guides/deployment.md:187-191` says a before-deploy migration is applied before the merge, because the merge to `main` is what deploys. `.github/workflows/deploy-oauth.yml:3-7` confirms the trigger is a push to `main` touching `apps/oauth/**`; the file has no D1 or migration step (the only `d1` match is inside a pinned action SHA at line 45). Its trigger also covers `master` and the shared package paths (lines 3-12). The runbook's "before dependent deployment" (`docs/operations/REMEDIATION_RELEASE_2026_10.md:165`) does not say the migration must precede the merge. Status 2026-10-31: resolved; the migration precedes the merge (A.3 Order).
9. **0001 dependency unstated.** The runbook (`docs/operations/REMEDIATION_RELEASE_2026_10.md:167`) does not require checking that 0001 (drops `avatar_url` and `xivauth_characters`) was applied. P2 will show it, but no gate names it; go/no-go row 6 now does.
10. **Migration header versus runbook scope.** The 0016 header says "before deploying either consumer" (`apps/presets-api/migrations/0016_ban_identity_continuity.sql:1`); the runbook says "presets **and** moderation" (`docs/operations/REMEDIATION_RELEASE_2026_10.md:168`). Consistent in effect, but the header does not name moderation-worker.

## F. Remaining UNKNOWN items

| Item | Reason |
|---|---|
| Expected production account id | Held privately by the maintainer; no `account_id` is pinned in the tree |
| Production's actual `users` column list and whether 0001 ran | Needs the read-only P2 query, not permitted during preparation |
| D1 acceptance of `PRAGMA foreign_key_list` and D1's stored-SQL normalization | Needs a database; the local SQLite 3.50.4 run is not D1 |
| Cloudflare documentation on `--file` atomicity, Time Travel retention and export locking | Not stated in the tree; not looked up in this pass |
| Recovery owners, destinations, retention, rehearsal status, decision-maker | Section C table; maintainer-supplied |
