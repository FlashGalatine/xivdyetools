# FINDING-029: apps/web-app/PRIVACY.md sends deletion requests to 'Questions?', which gives no request steps, response time or retention for the oauth users row, presets or votes
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** AMEND apps/web-app/PRIVACY.md §Questions? (and §Network access item 3) — variants: `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md` · **CWE:** CWE-1059
**Reconcile case:** 2 (Step 3a) · **Why AMEND:** stating a retention and a response time is a new commitment. The contact routing itself was the accepted fix for 2026-08-29/FINDING-002 (`114f6dde`) and is not re-filed.

## Location
- apps/web-app/PRIVACY.md:72-73 — "To have your account record and submissions removed, see the Questions? section below"
- apps/web-app/PRIVACY.md:161-164 — Questions? is a generic GitHub-issue / Discord line: no deletion steps, no 30-day response time, no retention period
- apps/oauth/schema/users.sql — users row is kept until removed by hand (no purge); presets-api DELETE /:id (presets.ts:381) and votes DELETE (votes.ts:204) exist but the web guide does not mention them

## Evidence
- PRIVACY.md:161-164: "## Questions?\n\nOpen an issue on GitHub ... or ask on Discord. We are happy to document further guarantees..."
- Bot policy, by contrast: apps/discord-worker/PRIVACY_POLICY.md:152-161 "Request Full Data Deletion ... We will process deletion requests within 30 days" and §8 Data Retention (presets/votes until removed or account deletion); the web guide has nothing equivalent for the oauth users row
- git show 114f6dde: FINDING-002 (closed) chose the contact route as the manual deletion path, so that routing is accepted; only the missing retention and steps are new

## Fix
- Add a short "Deleting your account and presets" paragraph: delete your own presets and votes in the app, or request removal of the account row (provider ID + username) through a private channel (not a public GitHub issue), handled within 30 days, as in the bot policy
- State retention: the account record, presets and votes are kept until you delete them or ask for deletion; link the bot policy §8 for presets-api retention
- Apply the same text to PRIVACY.{ja,ko,zh,de,fr}.md

## Status
FIX COMMITTED, NOT DEPLOYED — web AMEND `59cc1d6a` (branch `fix/security-2026-10-03-sprint8`, web-app 5.14.0; PR #230, open, stacked on #223): new "Deleting your data" section with the self-serve deletes (not while banned), private requests by email to FlashGalatineFGC@gmail.com (the address the maintainer gave, written in the case already used in the bot policy and ToS) or Discord DM, never a public issue, 30-day handling, and the active-ban exception.
