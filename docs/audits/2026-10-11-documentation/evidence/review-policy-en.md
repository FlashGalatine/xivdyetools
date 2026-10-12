# review-policy-en (key: policy-en) - 2026-10-11, HEAD 42c35e87 (served 16a6123f)

Scope: apps/web-app/PRIVACY.md, apps/web-app/TERMS_OF_SERVICE.md, apps/discord-worker/PRIVACY_POLICY.md,
apps/discord-worker/TERMS_OF_SERVICE.md (English, governing) + link check of all 24 files.

## Candidates

1. link / MEDIUM - discord.gg/rzxDHNr6Wv is EXPIRED. `curl https://discord.com/api/v10/invites/rzxDHNr6Wv` -> "Invite is expired."
   The product's own invite (packages/core/src/config/product-links.ts:35, About modal, /about, READMEs, docs) is
   discord.gg/5VUSKTZCe5 -> "Galatine's Round Table" (guild 1289617646429540464).
   Locations: web PRIVACY.md:262; web TOS:73,175; bot PRIVACY_POLICY.md:170,218; bot TOS:66,143; same lines in all 20 variants.
   It is the stated deletion route (PRIVACY.md:262, PRIVACY_POLICY.md:170) and appeal route (both TOS). Email route still works.
   Unverified: whether 5VUSKTZCe5 has #dyetools-issues-and-suggestions (needs a logged-in member).
2. inaccurate / MEDIUM - FAQs send deletion requests to public GitHub issues. docs/user-guides/web-app/faq.md:161-163,
   docs/user-guides/discord-bot/faq.md:187-189 vs PRIVACY.md:264-266 ("Please don't ask in a public GitHub issue") and
   PRIVACY.md:258-262 / PRIVACY_POLICY.md:165-170 (email or Discord DM).
3. inaccurate / MEDIUM - discord-bot faq.md:181 "Anonymous usage statistics": PRIVACY_POLICY.md:19,47 and
   ANALYTICS_QUERIES.md (blob2 "pseudonymous") record the Discord User ID (counted, never listed). web faq.md:154-158 lists
   only "Discord ID (if logged in)"; PRIVACY.md:80-90 also holds XIVAuth ID, verified character name, daily-limit counts.
4. inaccurate / MEDIUM - docs/user-guides/web-app/community-presets.md:85 quotes the sign-in sheet as "We store your display name
   and provider ID. No character data, no email, nothing sold." Shipped copy is en.json:1018 `privacyNote` (account record, XIVAuth
   verified character name, "XIVAuth User"+8 chars, linked Discord ID, "No email, nothing sold."). "No character data" is no longer
   the string and contradicts PRIVACY.md:84-85.
5. inaccurate / LOW - presets-api database.md:88 and moderation.md:140-142 say the privacy-policy amendment "will publish" these
   periods; PRIVACY.md:133-175 and PRIVACY_POLICY.md:187-192 now publish them. moderation.md retention table (:144-148) omits
   submission_events 30 d (rate-limit-service.ts:146) and failed_notifications 30/90 d (notification-service.ts:198,205);
   database.md:137 omits that unban blanks username+reason (ban-service.ts:604-605; moderation-worker overview.md:191 has it).
6. inaccurate / LOW - "Behaviour" vs shipped "Behavior" (en.json:1160): web faq.md:158, web getting-started.md:144.
7. missing / LOW - About modal POLICIES row (about.policiesLabel -> Privacy/Terms via policyDocFile, about-modal.ts:90,445-461)
   undocumented: docs/projects/web-app/components.md:117, user-guides/web-app/getting-started.md:34.
8. spelling / LOW - 17 hits (16 swept + `unauthorised` TOS:87 not in the sweep). Supersedes DOC-006 (STILL_PRESENT, was 14).
   PRIVACY.md 8: 8,16,43,51,58,77,105,205. TOS 9: 9,25,45,46,87,115,139,140,162. Discord files: 0. Do not bump Last updated.

## Checked and agreeing
- UI paths in PRIVACY.md (Advanced Settings -> Reset Settings / Clear Favorites / Clear Saved Palettes / Enable Analytics, Manage Collections ->
  Delete Collection, Glamour list "Reset all", My Submissions, About XIV Dye Tools -> POLICIES -> Privacy, Enable Market Board) all match
  en.json (config.*, collections.*, glamour.sheet.reset, preset.mySubmissions, about.*; advanced-options-panel.ts:179-205,355).
- Every slash command named in the bot policies/terms exists (registry.ts:29-57; schemas.ts favorite add/remove/list, preferences show/reset key,
  extractor image).
- policyDocFile() (about-modal.ts:90): ja/de/fr/ko/zh -> `<STEM>.<loc>.md`, else English; all 10 web variants exist.
- 106 relative links across all 24 files, anchors included: 0 broken (script in scratchpad).
- External URLs: all 200 except mirapri/gamerescape (403 to curl, bot-blocking).
- Telemetry events/dimensions, 30/90/12-month/90-day retention constants, IndexedDB (price cache only: api-service-wrapper.ts), 180-day flag
  (index.ts:860), 30-day KV TTL (analytics.ts:133), Workers Logs off (api-worker wrangler.toml:94-99, workers:check-logs), CSP hosts: match.
- No claim anchored to "Last updated" (only change-procedure sentences: web TOS:154, bot PRIVACY_POLICY.md:208). Discord-ID cutoff is 2026-10-05.
