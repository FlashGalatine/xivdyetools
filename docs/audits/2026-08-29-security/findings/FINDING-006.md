# FINDING-006: preset name + description are sent to Google Perspective without `doNotStore`, and the web privacy guide — which claims to be the complete list — never names Google as a recipient
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api (+ web-app docs) · **Rotation:** NONE · **CWE:** CWE-359

## Location
- `apps/presets-api/src/services/moderation-service.ts:221-237` — `POST https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze` with `comment.text` = user-typed name + description; the request has no `doNotStore: true` (Perspective may retain comments for research unless it is set)
- `apps/web-app/PRIVACY.md:8-9` ("the sections below are the complete list"), "Network access" — Universalis is the only third party named; nothing about Perspective/Google

## Evidence
- The bot policy §6 does list Perspective ("Content moderation (optional)"), so the same text is disclosed to bot users and not to web users.

## Fix
- Add `doNotStore: true` to the request body; add Perspective/Google to the web guide's community-presets section (what is sent, why, that it is not stored).

## Status
PARTIAL — code half FIXED 2026-08-30 e10d740e (presets-api 2.2.0: `doNotStore: true`, key in the header, no query string); docs half FIXED 2026-08-30 114f6dde (web-app: PRIVACY.md names Google Perspective — preset name + description may be sent for a moderation score, `doNotStore`, no account identity — and the third-party intro counts two). FINDING-006 is now CLOSED.
