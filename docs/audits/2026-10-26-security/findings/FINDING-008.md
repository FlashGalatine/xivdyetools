# FINDING-008: Upstream XIVAuth email auto-merge attaches a new provider identity to the email-matched account and signs in without MFA, so oauth mints a JWT with the victim's discord_id
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** gap (upstream XIVAuth a4e6693; impact lands in apps/oauth + apps/presets-api) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-287

## Location
- `other-sources/XIVAuth/app/controllers/users/omniauth_callbacks_controller.rb:109` — Upstream XIVAuth email auto-merge attaches a new provider identity to the email-matched account and signs in without MFA, so oauth mints a JWT with the victim's discord_id

## Evidence
- email = auth.dig(:info, :email); return nil if email.blank?; existing_user = User.find_for_database_authentication(email: email.downcase); existing_user&.add_social_identity(auth); existing_user -> :60-62 if @user.persisted? ... sign_in_and_redirect @user, event: :authentication
- Reach: An attacker without an XIVAuth session signs in at /auth/sso/{discord|github|twitch} with a provider account whose verified email equals the victim's XIVAuth email. find_user_by_authdata (:101-117) has no (provider, uid) match, so it falls back to the email lookup, builds the identity on the victim's user and calls sign_in_and_redirect (:60-62), skipping MFA. The attacker then completes the xivdyetools oauth flow as the victim and gets a presets-api JWT carrying the victim's discord_id.
- At :109-116, when no (provider, uid) identity exists, the code looks up the user by email, add_social_identity builds the identity, and :62 signs the user in. The MFA prompt exists only on the password path (sessions_controller.rb:136-140; mfa_enabled? at user.rb:75), and no global Warden hook enforces it. Downstream, oauth finds the row by xivauth_id (user-service.ts:73-77) and puts its discord_id in the JWT (jwt-service.ts:141), which presets-api treats as the acting id and moderator id (auth.ts:361-365). The rating stays LOW because every in-tree login provider passes only a verified email (discord.rb:23 and patreon.rb by source… Preconditions: The attacker controls a Discord, GitHub or Twitch account whose verified email equals the victim's XIVAuth email: a compromised mailbox, or a stale verification on a lapsed domain. Patreon is excluded as a login provider (user.rb:136) and Steam supplies no email. The victim must have an oauth row w…
- Live state the repo cannot show: Which omniauth providers are enabled in XIVAuth's production credentials (User.omniauth_providers = Devise configs intersected with credentials[:oauth] keys). The verified-email gating in the GitHub and Twitch gems is not vendored in the clone.

## Fix
- Report upstream to XIVAuth. Do not auto-link by email at sign-in: require the owner to be signed in (bind path :71-95), or run the MFA challenge and an email notice before the merge completes. On our side the impact can only be narrowed, for example by re-verifying moderator actions; no repo change closes it.
- **Maintainer decision:** Upstream XIVAuth issue: the maintainer decides whether to report or fix it upstream (MFA on the social auto-merge path, or confirm before linking by email).

## Status
OPEN
