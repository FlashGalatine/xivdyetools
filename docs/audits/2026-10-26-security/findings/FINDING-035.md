# FINDING-035: Perspective sunset checklist omits both Terms of Service auto-publish sentences (web and bot), which go stale when the key is deleted (by 2026-12-31)
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** repo docs (DEPRECATIONS.md) now; web-app + discord-worker policy documents on key-deletion day · **Rotation:** NONE · **Policy:** CORRECT on key-deletion day: apps/web-app/TERMS_OF_SERVICE.md 'Moderation' section and apps/discord-worker/TERMS_OF_SERVICE.md '5. Content Moderation > Community Presets' fir… · **CWE:** CWE-451
**Related:** 2026-10-03-security/FINDING-019; DEPRECATIONS.md Perspective sunset 2026-12-31

## Location
- `DEPRECATIONS.md:59` — Perspective sunset checklist omits both Terms of Service auto-publish sentences (web and bot), which go stale when the key is deleted (by 2026-12-31)
- `apps/discord-worker/TERMS_OF_SERVICE.md:57` — Bot ToS 'published immediately' goes stale at Perspective key deletion and is missing from the DEPRECATIONS checklist

## Evidence
- web TERMS_OF_SERVICE.md:60-61 'A submission that clears them is published straight away and logged for audit.'; bot TERMS_OF_SERVICE.md:57 'Those that clear it are published immediately'; DEPRECATIONS.md:59-63 lists only bot PRIVACY_POLICY.md §6 and web PRIVACY.md item 3.
- Reach: Any reader of the public web or bot Terms of Service is told that a submission which clears the automated check is published straight away. When the operator follows DEPRECATIONS.md and deletes PERSPECTIVE_API_KEY, every new or text-edited preset goes to pending, so that published-immediately path no longer happens, and the checklist only schedules edits to the two privacy policies.
- Two places in the code confirm the change: moderation-service.ts:376-383 returns passed:false, method 'unscored' when no key is set, and presets.ts:1039 then stores status 'pending'. Both ToS sentences promise immediate publication: web TERMS_OF_SERVICE.md:60-61 and bot TERMS_OF_SERVICE.md:57. The DEPRECATIONS.md checklist at :59-63 names only bot PRIVACY_POLICY.md §6 and web PRIVACY.md item 3, so neither ToS is on it. Both sub-claims hold; the 2026-10-03 rejection (report :135) and recommendation 3 (:162) covered only the privacy policies, so this gap is new. The text is accurate today because production has the key, and once stal… Preconditions: The operator deletes PERSPECTIVE_API_KEY (scheduled on or before 2026-12-31) without a replacement scorer, and does not separately remember to edit the Terms of Service.
- Live state the repo cannot show: Whether PERSPECTIVE_API_KEY is still set on the production presets-api worker. The repo says it is (DEPRECATIONS.md:20, moderation-service.ts comment at :377); while it is set, both ToS sentences are accurate.

## Fix
- Add both Terms of Service to the DEPRECATIONS.md 'Same day' item (all six languages each): the web Moderation subsection and bot §5 Community Presets. They should say every submission is held for moderator review unless a replacement scorer exists. Bump Last updated and rerun policy-locale-parity.py; edit the ToS text itself only on key-deletion day.
- Policy detail: CORRECT on key-deletion day: apps/web-app/TERMS_OF_SERVICE.md 'Moderation' section and apps/discord-worker/TERMS_OF_SERVICE.md '5. Content Moderation > Community Presets' first bullet. No code change is needed; the immediate fix is a DEPRECATIONS.md checklist addition.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/TERMS_OF_SERVICE.md (:58 ### Moderation), .ja.md (:37 ### モデレーション), .de.md (:64 ### Moderation), .fr.md (:66 ### Modération), .ko.md (:37 ### 조정), .zh.md (:37 ### 审核); apps/discord-worker/TERMS_OF_SERVICE.md (:51 ## 5), .ja.md (:51), .de.md (:67), .fr.md (:51), .ko.md (:51), .zh.md (:51). No locales/*.json key carries this claim; a grep of app and package locales for published-immediately or auto-approv…

## Status
OPEN
