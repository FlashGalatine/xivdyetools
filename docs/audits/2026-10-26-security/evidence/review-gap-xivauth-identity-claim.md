# Security review: XIVAuth identity claim, end to end (2026-10-26, HEAD 13c386e5)

Reviewer key: `gap-xivauth-identity-claim`. Deploy unit tag: `gap` (spans upstream XIVAuth, `apps/oauth`, `apps/presets-api`).

Upstream state: `other-sources/XIVAuth` fetched; `git ls-remote origin HEAD` = `a4e669343add5b49326b0d3262c39ee60303ee56`
= local `HEAD` = `origin/main` (commit 2026-10-26 13:50 -0700). So the oauth reviewer's a4e6693 read was the current tip;
this review re-reads it after a fetch, with the files listed below.

## 1. The chain (who decides the `discord_id` claim)

| Link | Code | What it decides |
|---|---|---|
| U1 Discord uid | XIVAuth lib/omniauth/discord.rb:17,34-36 | `uid` = `id` from Discord `users/@me` with the user's own access token. Never user-supplied. |
| U2 Discord email | lib/omniauth/discord.rb:23 | `email` only when Discord says `verified`, else nil. |
| U3 Bind while signed in | omniauth_callbacks_controller.rb:71-95 | Refuses a (provider, uid) already on another account (:72-82). Otherwise attaches to `current_user`. OmniAuth state + rails_csrf_protection (Gemfile:84) guard the callback; only `steam` skips the CSRF token (:2). |
| U4 Sign-in by identity | :101-107 | Existing (provider, uid) -> that user. |
| U5 Sign-in by email (auto-merge) | :109-116 | No identity, email present -> `User.find_for_database_authentication(email:)` -> `add_social_identity` on that user, then `sign_in_and_redirect` (:60-62). No owner confirmation, no MFA step (MFA lives only in sessions_controller.rb:136-150). |
| U6 Uniqueness | db/schema.rb:362 unique index (provider, external_id); social_identity.rb:3 | One Discord uid -> at most one XIVAuth user at a time. A user may hold several Discord identities. Unlink: social_identities_controller.rb:4-10. |
| U7 Serialization | api/v1/users_controller.rb:11,57-62; views/api/v1/users/_social_identity.json.jbuilder:1 | `social_identities` only with `user:social`, filtered by the user's per-grant selection (scope_selectors/_social_identity.html.erb:2-12). `external_id` is the uid from U1. |
| O1 Pick | apps/oauth/src/handlers/xivauth.ts:343-353 | First `provider === 'discord'` entry; must pass `isValidSnowflake`. |
| O2 Row | apps/oauth/src/services/user-service.ts:73-90 | Row by `xivauth_id`, else by `discord_id`. |
| O3 Attach | user-service.ts:182-200 | Only fills an EMPTY `discord_id`, only if no other row owns it; never overwrites, never clears. `xivauth_id` of the caller replaces a stale one (:202-208). Race fallback keeps the old id (:230-247). |
| O4 Claim | jwt-service.ts:128,141 + user-service.ts:291 | `sub` = row id, `discord_id` = the row re-read after UPDATE. The JWT cannot differ from what O3 accepted; a refused link yields the row's prior value (often none). Discord path: callback.ts:239-244 passes Discord's own id. |
| P1 Acting id | apps/presets-api/src/middleware/auth.ts:71-77,353-376 | `discord_id` claim if non-empty, else `sub`; HS256 + `iss` pinned (wrangler.toml:76 `JWT_ISSUER = https://auth.xivdyetools.app`) + jti blacklist (:106-109). Moderator = acting id in `MODERATOR_IDS` (:125-133, :365). |
| P2 Ownership | handlers/presets.ts:437 (delete), :587 (edit), votes via `auth.userDiscordId` (:181,:1081) | Author/voter = acting id. |
| P3 Re-key | handlers/presets.ts:371-384; services/identity-rekey-service.ts:39-71 | `jwtSub -> jwtDiscordId`, both from the same verified token; ban-guarded per statement (:22-25). |
| P4 Ban | middleware/ban-check.ts:48-64,129-157; router registration presets.ts:131, votes.ts:30 | Any of {acting id, sub, discord_id} in `discord_id` OR `xivauth_id`, fail-closed 503. |

## 2. Answers

1. Can a Discord identity be attached without proving control of that Discord account? No: every attach path (U3, U5,
   `new_with_omniauth`, `new_with_session`) takes the uid from the OmniAuth hash produced by a Discord OAuth round trip
   (U1). What U5 does allow is attaching a PROVEN Discord identity to an account the Discord holder does not own, matched
   only by email. That is candidate 01: an XIVAuth account takeover (no MFA), not a Discord-uid forgery. The Discord
   strategy keeps only verified emails (U2); GitHub/Twitch strategies are gems not vendored in the clone, so their
   email-verification gating is unconfirmed from source.
2. One Discord external_id on two XIVAuth users? No, simultaneously (U6). It can move after an unlink, and oauth never
   follows the move away from a row (O3), which is candidate 02.
3. Can the JWT `discord_id` differ from what user-service accepted? No (O4).
4. Attacker with a victim-snowflake JWT: yes, full impersonation (edit/delete via P2, vote, moderator via P1). Blocked
   upstream of presets-api: O3 never claims an owned id and U1/U6 make an unowned id provable only by its Discord owner.
   The only open path is candidate 01's precondition.
5. Re-key the attacker's UUID rows onto the victim? Only if the attacker's own row already carries the victim's
   snowflake (P3 uses `sub` and `discord_id` of one token from one row), which is question 4 again. Equal ids are a no-op
   (identity-rekey-service.ts:45).
6. Ban evasion by switching providers / re-linking: a row's `sub` is fixed and its `discord_id` can never be replaced
   (O3), and P4 checks all ids the token carries, so the banned identity cannot be shed from its row. Evasion requires a
   different row (a new XIVAuth account without the banned Discord, or one that signed in before linking it, where O3
   refuses the owned id), i.e. a sockpuppet. Rejected below.

## 3. Positive controls (verified this checkout / upstream tip)

- U1/U2/U6 as above; OmniAuth request phase CSRF-protected (Gemfile:84), Discord callback not exempt (:2).
- O1 snowflake validation (xivauth.ts:348); O3 never claims an owned id, never overwrites (user-service.ts:182-200);
  owned-id refusal + concurrent-claim race keep the old id (:191-195, :235-247); events logged without identifiers.
- O4: claim = persisted row value; partial UNIQUE indexes on discord_id and xivauth_id (schema/users.sql:29-30).
- P1: issuer pinned in production (presets-api wrangler.toml:76), revocation checked (auth.ts:106-109); a `sub` UUID can
  never equal a snowflake or a `MODERATOR_IDS` entry.
- P3: re-key only `authSource === 'web'`, ids differ, ban pre-check + per-statement NOT_BANNED guard, one batch,
  self-move no-op (presets.ts:371-384; identity-rekey-service.ts:22-25,45,48-69).
- P4: ban matches every proved id across both columns; fail-closed 503 outside development (ban-check.ts:89-111);
  registered router-wide for every mutating method (presets.ts:131, votes.ts:30); moderation-worker writes a UUID ban to
  `xivauth_id` too (moderation-worker/src/services/ban-service.sqlite.test.ts:142-156).

## 4. Rejected

- Discord uid forgery at XIVAuth: uid always from Discord `users/@me` (discord.rb:17,34-36).
- One Discord uid on two XIVAuth users at once: unique index (schema.rb:362) + model validation + controller refusal.
- Login-CSRF binding of attacker's Discord to a victim's XIVAuth: OmniAuth state + POST-only request phase; and it would
  hand the victim the attacker's id, not the reverse.
- JWT `discord_id` diverging from the D1 row: jwt-service.ts:141 reads `user.discord_id` from the re-read row.
- `resolveJWTUserId` accepts any non-empty string (auth.ts:73): value is HMAC-signed by oauth, which only writes
  snowflakes (xivauth.ts:348) or Discord's own id (callback.ts:240).
- Re-key onto a victim: needs the victim's snowflake in the attacker's own token (answer 5).
- Ban evasion via a fresh XIVAuth account, or an XIVAuth row created before linking the banned Discord (link refused at
  user-service.ts:191-195, so that row's token has no `discord_id`): sockpuppet-equivalent; no identity proof is lost
  that a brand-new account would carry.
- Ban evasion by re-linking the same row to a new snowflake: impossible, `discord_id` is never overwritten (user-service.ts:183).
- Banned XIVAuth-only user linking Discord: FINDING-014 fix holds (ban-check.ts:147 includes `jwtSub`).
- Multiple Discord identities on one XIVAuth account, first one picked (xivauth.ts:343): all are proven by the same user;
  an existing row link is sticky regardless of order.
- Unconfirmed XIVAuth account (password sign-up with victim email) capturing the victim's Discord via U5: Devise
  `confirmable` with `allow_unconfirmed_access_for` commented out (devise.rb:148) blocks sign-in; whether the built
  identity is saved before the activatable hook throws depends on Devise hook order (not vendored). Folded into 01 as an
  unconfirmed precondition, not filed separately.

## 5. Files covered

22 files. Upstream XIVAuth (a4e6693, 11): app/controllers/users/omniauth_callbacks_controller.rb,
app/controllers/users/social_identities_controller.rb, app/controllers/api/v1/users_controller.rb,
app/views/api/v1/users/{show,_social_identity}.json.jbuilder, app/views/oauth/authorizations/scope_selectors/_social_identity.html.erb,
app/models/user.rb (1-60, 125-160), app/models/user/social_identity.rb, app/models/concerns/omniauth_authenticable.rb,
lib/omniauth/discord.rb, config/initializers/devise.rb (omniauth + confirmable lines), db/schema.rb (social identities), Gemfile/.lock (grep).
xivdyetools (11): apps/oauth/src/handlers/xivauth.ts (290-428), handlers/callback.ts (225-250),
services/user-service.ts (1-310), services/jwt-service.ts (90-146), schema/users.sql; apps/presets-api/src/middleware/auth.ts
(40-135, 330-385), middleware/ban-check.ts, handlers/presets.ts (330-400 + ownership greps), handlers/votes.ts (grep),
services/identity-rekey-service.ts, wrangler.toml (grep); apps/moderation-worker ban-service tests (grep).
Directories: other-sources/XIVAuth/{app,lib,config,db}, apps/oauth/src, apps/oauth/schema, apps/presets-api/src, apps/moderation-worker/src/services.
