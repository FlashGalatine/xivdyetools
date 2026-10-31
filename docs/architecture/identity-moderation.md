# Stored identities and moderation continuity

**Target contract across separately prepared release cuts.** This document does not assert
that every provider or consumer below has been integrated or deployed. Production activation
remains held; each unit's schema, provider, disclosure and acceptance prerequisites still apply.

OAuth owns the current association between its internal user UUID and an optional Discord
snowflake. The internal UUID is `users.id` and the JWT `sub`. It is different from the upstream
XIVAuth identifier in `users.xivauth_id`. Preset authors and ban memberships use internal UUIDs
or Discord snowflakes; they do not use the upstream identifier.

The implementation is prepared in stages. OAuth's `IDENTITY_SPLIT_ENABLED` is **false** in both
environments. A detected relationship change is refused while this flag is disabled; matching
sign-ins and new-account creation continue. The initial provider release declares no outbound
continuity binding. Automatic splitting requires the later presets and moderation consumers,
database migrations, disclosure updates and verified production deployments first.

## Private lookup and session checks

The named OAuth `IdentityLookup` entrypoint is available only through explicitly configured
service bindings. It adds no public HTTP route. The normal Hono application remains the default
HTTP export; a small `worker.ts` entry module also exports the RPC class.

`lookupStoredIdentity({ kind, id })` accepts an internal UUID or Discord snowflake and returns
one current stored association: version, internal ID, nullable Discord ID and identity revision.
Missing and pending identities are distinct results. Database failure is unavailable, not a
missing identity. The response contains no upstream XIVAuth ID, name, character or token.

This lookup reports a **stored association**, not a fresh verification with XIVAuth. Moderation
must show the exact proposed author IDs privately and obtain explicit confirmation before
expanding a ban. Confirmation must bind the acting moderator, reviewed IDs and revision, expiry
and a server-held nonce. A changed proposal requires another review.

`validateSession` checks the current row, identity revision and provider relationship. Callers
verify the JWT signature, issuer, expiry and revocation before this check, and derive ownership
or moderator authority only after it succeeds. The JWT's local `identity_revision` changes with
identity changes, not profile edits. A legacy token without the claim means revision zero and
is accepted only against an unchanged revision-zero row. Pending operations deny affected
sessions. The row's last-used provider does not disable its other linked provider.

Requests authorized before a transition may finish. These checks do not promise instantaneous
cancellation inside a separate database's mutation transaction.

## Prepared consumer behavior

Presets declares `OAUTH_IDENTITY` targeting the named OAuth provider and keeps
`OAUTH_SESSION_CHECK_ENABLED=false`. Enabled web sessions need a valid stored relationship
before ownership/moderator context or rekey; runtime lookup failure is unavailable and a late
reply cannot resume authority. Bot HMAC remains a separate path. Membership predicates cover
all five rekey mutations and approval/Revert SQL, preserving their concurrency/audit guards.

Moderation activated `LINKED_BAN_CONFIRMATION_ENABLED` in production in 1.9.2, a separate
consumer activation. With the flag false, all ban/unban commands, selection controls and modals
refuse privately. When enabled, `ban_user` resolves `user` and optional `additional_user`
independently, shows exact stored IDs and one selected parent ban privately, and requires
explicit confirmation. Existing partial bans can be expanded; independent parents are never
merged implicitly. More than 16 matching parents refuses for manual review, and a parent holds
at most 64 effective IDs.

Server-held confirmation nonces expire within 15 minutes. Selection consumes its nonce and
creates a fresh immutable review. The claim, SQL scope/parent set comparison in both directions,
expiry/cap checks, mutation, audits and finalization share one transaction. A stale/forged/replayed
or legacy target-only control cannot write. OAuth re-resolution is a preauthorization check,
not a distributed lock. Unban uses the selected recorded scope and preserves any other active ban;
signature restoration chooses one eligible hidden twin across the entire restoring scope.

Presets migration `0016_ban_identity_continuity.sql` adds memberships, durable handoff receipts
and confirmations. Daily scheduled retention preserves unacknowledged/applying receipts and
valid reviews while pruning bounded eligible batches. All 12 web/bot privacy variants disclose
these uses before consumer activation. Separate consumer activation/production verification
precedes OAuth's later outbound-binding and split activation.

## Preserve the Discord anchor

When XIVAuth no longer asserts the stored Discord ID, retain the original UUID and Discord ID
on their existing row. Move the XIVAuth association to a fresh UUID with no Discord ID. This
does not transfer ownership of the original UUID's presets to the new account.

A different asserted Discord ID requires that detach first, then a fresh authenticated
assertion before a separate attachment. Likewise, replacing a Discord row's XIVAuth association
first preserves the displaced XIVAuth account on its own fresh row. Existing local accounts
are never silently merged. A callback may require a fresh sign-in rather than reuse a consumed
OAuth code or an earlier social assertion.

Historical associations are used only to preserve particular existing sanctions. They never
grant ownership, moderator status or permission to re-key presets.

## Ban-specific handoff

Let `U` be the original internal UUID, `D` its Discord ID and `N` the detached account's fresh
UUID. A detach preserves bans effective against the departing session's `U` or `D` claims by
adding `N` to those particular bans. It does not automatically expand a legacy `D`-only ban
to previously uncovered `U`-authored content.

An attachment cannot silently expand an existing ban from one identity to another. If any
proposed destination lacks coverage under a matching active ban, the continuity service
records a terminal `review_required` refusal. A moderator must explicitly approve the
additional scope before a new attachment operation can succeed.

The later presets `BanContinuity` entrypoint applies this handoff in its own D1 transaction:

1. OAuth reserves the affected identity resources, records an immutable pending operation and
   increments the affected existing rows' revisions in one conditional batch.
2. Presets snapshots active matching bans, enforces limits, records the outcome and, for an
   allowed detach, adds the fresh UUID's memberships in one transaction.
3. OAuth changes its identity rows only after verifying a matching applied receipt. A durable
   refused receipt instead permits an abort with unchanged associations and released locks.
4. OAuth acknowledges its completed or aborted outcome for later receipt cleanup.

The presets transaction orders the handoff against concurrent bans and unbans. Bans active at
that point are preserved. A later ban on a detached identity does not automatically reach its
former counterpart. There is no cross-database atomicity or clock-ordering claim.

Operations allow at most two source IDs, two destination IDs and three distinct IDs overall.
The companion must reject more than 16 matching active bans or 64 effective IDs per ban;
it must never truncate protection. Existing ban columns remain readable alongside memberships.
Unban uses the recorded scope, preserves collision-safe restoration, and does not restore an
identity still covered by another active ban.

## Retry, refusal and retention

The operation ID, canonical author-ID edge and deadline are immutable. The request hash covers
its version, ID, kind, sorted source/destination arrays and timestamps. A matching terminal
receipt is replayed without reconsidering later ban changes. Reusing the ID with another
payload conflicts. A refusal writes no memberships and cannot later become an approval.

Unknown outcomes remain pending and retry the same operation. Applied attachment recovery
still requires a fresh matching provider assertion. An authoritative refusal permits immediate
abort. An expired operation can also abort when the remote service authoritatively reports
missing; remote receipt creation must enforce expiry inside its transaction. Applied or
unknown operations are not automatically cancelled after expiry.

The OAuth recovery journal stores identifiers, expected associations/revisions and operation
state. It stores no names, provider tokens, character rosters or freeform reasons. Its operation
deadline is at most 15 minutes. Completed and refused operations become eligible for cleanup
after acknowledgement and 24 hours after the later of deadline or acknowledgement. An abort
confirmed remotely missing uses its local finish time instead. Cleanup is best-effort and
request-triggered; this is not a promise of deletion at exactly 24 hours. Unresolved pending
operations require review, including when handling a deletion request.

Ban memberships enforce only their particular active ban and follow its existing retention:
the parent record is deleted 90 days after lifting, with dependent memberships removed with it.

## Release order

1. Apply the additive OAuth migration to the existing users database before its dependent
   deployment. Use the fresh schema only for a new database; never replay the numbered
   migration against an already upgraded database. Use `wrangler d1 execute --file`, not
   `wrangler d1 migrations apply`.
2. Deploy and verify the OAuth provider with splitting disabled.
3. Prepare, migrate, deploy and verify the presets continuity/membership/session enforcement
   and moderation confirmation consumers. Their bindings must target already deployed named
   entrypoints. Update all six variants of each affected privacy policy before new uses run.
4. Before adding any OAuth outbound continuity binding, verify the prepared remote-wait bounds:
   lookup and apply share a five-second deadline; a terminal acknowledgement has a one-second
   deadline. Request-triggered cleanup selects at most eight acknowledgements in parallel under
   one shared second, then deletes at most eight eligible terminal records. A best-effort cursor
   rotates acknowledgement candidates within an isolate/D1 handle; it resets with that handle
   and does not guarantee eventual cleanup across isolates or restarts. Timed-out unknown
   operations remain pending and locked for the same immutable retry. Late remote replies cannot
   resume local identity changes, session issuance or acknowledgement bookkeeping. These bounds
   cover remote waits, not D1/platform execution, and do not cancel remote effects. Confirmed
   outcomes survive acknowledgement failure. See the [local prerequisite evidence](../audits/2026-10-26-security/evidence/remediation-release-prerequisites-2026-10-29.md);
   deployed provider/consumer acceptance is still required.
5. Only then prepare a separate OAuth activation change adding the continuity binding and
   enabling relationship transitions. Verify production behavior before closing FINDING-023.

OAuth's top-level Wrangler environment is production. A bare deployment targets
`auth.xivdyetools.app`; `[env.development]` is explicitly routeless and disables `workers.dev`.
No deployment or migration is authorized by this document.

Cloudflare reference: [named service entrypoints](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/).
