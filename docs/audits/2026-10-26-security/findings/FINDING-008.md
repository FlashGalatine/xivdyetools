# FINDING-008: Upstream XIVAuth email auto-merge attaches a new provider identity to the email-matched account and signs in without MFA, so oauth mints a JWT with the victim's discord_id
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** gap (upstream XIVAuth a4e6693; impact lands in apps/oauth + apps/presets-api) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-287

## Location
- `other-sources/XIVAuth/app/controllers/users/omniauth_callbacks_controller.rb:109` — Upstream XIVAuth email auto-merge attaches a new provider identity to the email-matched account and signs in without MFA, so oauth mints a JWT with the victim's discord_id (as of a4e6693; the MFA case is fixed upstream in `d27a8b2`, and the auto-link for accounts without MFA remains by design)
- Upstream line references below are to the audited commit a4e6693. At the current upstream tip (XIVAuth `b06d3d4`, 2026-10-28) the same flow is `sign_in_via_unknown_identity` (`omniauth_callbacks_controller.rb:58-75`, email lookup at :68), and `bind_to_existing_user` refuses an account with MFA (:78) before it adds the identity (:80).

## Evidence
- email = auth.dig(:info, :email); return nil if email.blank?; existing_user = User.find_for_database_authentication(email: email.downcase); existing_user&.add_social_identity(auth); existing_user -> :60-62 if @user.persisted? ... sign_in_and_redirect @user, event: :authentication
- Reach: An attacker without an XIVAuth session signs in at /auth/sso/{discord|github|twitch} with a provider account whose verified email equals the victim's XIVAuth email. find_user_by_authdata (:101-117) has no (provider, uid) match, so it falls back to the email lookup, builds the identity on the victim's user and calls sign_in_and_redirect (:60-62), skipping MFA. The attacker then completes the xivdyetools oauth flow as the victim and gets a presets-api JWT carrying the victim's discord_id.
- At :109-116, when no (provider, uid) identity exists, the code looks up the user by email, add_social_identity builds the identity, and :62 signs the user in. The MFA prompt exists only on the password path (sessions_controller.rb:136-140; mfa_enabled? at user.rb:75), and no global Warden hook enforces it. Downstream, oauth finds the row by xivauth_id (user-service.ts:73-77) and puts its discord_id in the JWT (jwt-service.ts:141), which presets-api treats as the acting id and moderator id (auth.ts:361-365). The rating stays LOW because every in-tree login provider passes only a verified email (discord.rb:23 and patreon.rb by source… Preconditions: The attacker controls a Discord, GitHub or Twitch account whose verified email equals the victim's XIVAuth email: a compromised mailbox, or a stale verification on a lapsed domain. Patreon is excluded as a login provider (user.rb:136) and Steam supplies no email. The victim must have an oauth row w…
- Live state the repo cannot show: Which omniauth providers are enabled in XIVAuth's production credentials (User.omniauth_providers = Devise configs intersected with credentials[:oauth] keys). The verified-email gating in the GitHub and Twitch gems is not vendored in the clone.

## Fix
- Reported upstream on 2026-10-27 (see Status). Upstream fixed the MFA case the same day in `d27a8b2` ("fix: don't bind identity provider if MFA is enabled"), followed by `60ab1fa` (no automatic sign-in after a password reset when MFA is on). Its security policy's Hall of Fame credits the report (`app/views/legal/security_policy.html.erb`, commit `c5169fb`) as informational, CWE-288, with that fix. Accounts without MFA are still auto-linked by email. Upstream's own spec asserts this as intended (`spec/controllers/users/omniauth_callbacks_controller_spec.rb:107-115`, "and an account without MFA has the provider's email"), and its Hall of Fame entry rates the impact minor because whoever controls the email can already reset the password.
- On our side the impact can only be narrowed; see the 2026-10-31 addendum below.
- **Maintainer decision:** reported upstream (2026-10-27). On 2026-10-31 the maintainer kept this write-up's detail, since upstream has fixed and disclosed the MFA case, and gated the xivdyetools-side narrowing on the oauth identity-split activation.

## Status
PARTIAL 2026-10-31 — fixed upstream for accounts with MFA (`d27a8b2`, 2026-10-27; credited publicly in upstream's Hall of Fame). The email auto-link for accounts without MFA remains, by upstream design. The xivdyetools-side narrowing in the addendum has not started.

Earlier status: OPEN — private upstream report sent 2026-10-27 to XIVAuth's published security address with a PGP-encrypted attachment, under explicit maintainer authorization. The Gmail sent copy confirms the recipient and byte-identical attachment; upstream acknowledgement is pending and no mitigation has been applied. Current upstream source was rechecked and independently reviewed. The original narrative is a source-review hypothesis, not a demonstrated production takeover; real-provider feasibility and durable identity enrollment remain untested. The expanded report, source snapshots and submission receipt are stored outside Git. Upstream policy eligibility and severity remain subject to upstream triage.

## Addendum 2026-10-31 — xivdyetools impact, rechecked

Rechecked against `main` (`13c386e5`) and the release-cut queue (oauth 3.2.0) after the upstream fix.
Every path needs an attacker who controls a login-provider account carrying the victim's verified
email, and a victim XIVAuth account without MFA. Source review only: none of these paths was
reproduced against production or a real provider.

- **Main path (open on `main` and in oauth 3.2.0):** an XIVAuth session as the victim resolves the
  victim's row by `xivauth_id` (`apps/oauth/src/services/user-service.ts:73-77`). On `main`, a
  Discord-only row is also reached through the Discord ID that XIVAuth asserts (`:80-86`). The JWT
  carries that row's `discord_id` (`jwt-service.ts:141`). presets-api then acts as the victim: their
  presets can be edited, deleted and voted on, and moderator rights follow if the victim is in
  `MODERATOR_IDS` (`apps/presets-api/src/middleware/auth.ts:361-366`, the JWT path).
- **Permanent attach (missed by the original audit):** when the victim's row has no `discord_id`,
  `main` attaches the Discord ID that XIVAuth asserts (`user-service.ts:183-198`), and presets-api's
  re-key moves the victim's records to it (`apps/presets-api/src/services/identity-rekey-service.ts`).
  The attach outlives the XIVAuth takeover: recovering the XIVAuth account does not undo it. This
  supersedes answer 5 of `evidence/review-gap-xivauth-identity-claim.md`, which judged re-keying
  onto a victim blocked.
  oauth 3.2.0 refuses this attach while `IDENTITY_SPLIT_ENABLED` is false. Turning the flag on allows
  it again, behind the ban-continuity handoff. A one-time read-only check for XIVAuth rows whose
  Discord ID was attached on `main` is a follow-up (A-OAUTH).
- **Narrowing options on our side:** (M1) attach a Discord ID that XIVAuth asserts, or resolve a row
  by it, only after proof from a direct Discord sign-in; (M2) grant moderator rights only to tokens
  from a Discord sign-in. Neither closes the main path for a victim whose row already carries their
  XIVAuth ID, whether XIVAuth-only or linked. Closing it needs
  XIVAuth-minted tokens that never act as the Discord ID, or a change of upstream design.
- **Gate:** M1 must land before `IDENTITY_SPLIT_ENABLED` is activated. It is recorded with oauth
  3.2.0's acceptance checklist in the October 2026 remediation release documents.

