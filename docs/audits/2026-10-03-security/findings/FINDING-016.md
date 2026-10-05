# FINDING-016: presets-api stores example_link (validateExampleLink/normalizeExampleLink) and author_name (refresh-author, createPreset) raw, without validation-service's control, bidi and invisible-character rule
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-451

## Location
- apps/presets-api/src/services/validation-service.ts:401-419 — validateExampleLink checks only a `new URL()` copy (protocol plus host allowlist). It never calls hasOnlySupportedCharacters (:120), the rule applied to name, description and tags
- apps/presets-api/src/services/validation-service.ts:426-431 — normalizeExampleLink only trims, so the raw input is persisted (handlers/presets.ts:1364-1366 submit, :1405-1409 edit) and returned on public GETs (preset-service.ts:116)
- apps/web-app/src/shared/example-link.ts:56-63 — sanitizeExampleLink also returns `trimmed` rather than `url.href`, so preset-detail.ts:991-996 renders the raw string as link text (bidi characters intact)

## Evidence
- validation-service.ts:56-60 sets the rule this field skips. The comment says bidi-override characters 'let a name or tag read as something it is not', and that 'Everything user-visible that this worker stores is checked here, once.' INVISIBLE_CHARS (:77) covers U+202A-U+202E.
- node docs/audits/2026-10-03-security/evidence/scripts/presets-api/example-link-probe.mjs gives: "https://x.com/a\n[b](https://evil.example)" accepted= true stored raw= same; "https://x.com/a‮evil" accepted= true; "https://x.com/a b" accepted= true
- No in-repo bot consumer exists: example_link does not appear anywhere in apps/discord-worker or apps/moderation-worker, so markdown injection is only latent. The impact today is bidi spoofing of the visible link text in the web app. The href host is still an allowlisted site.

## Fix
- In validateExampleLink, reject the raw string when hasOnlySupportedCharacters(link, false) fails, using the same message as the other fields (rejects LF, tab and RLO). For `author_name`, which comes from the token and cannot be edited by the user, **strip** control / bidi / invisible characters (keep ZWJ between emoji) instead of rejecting, or create and refresh would 400.
- Store the canonical form: have normalizeExampleLink return `new URL(...).href` (percent-encoded, with whitespace and controls stripped) instead of the trimmed raw input.
- Defense in depth: have web-app sanitizeExampleLink return url.href rather than `trimmed`, and add tests for LF, U+202E and space inputs on both sides.

## Status
FIX COMMITTED, NOT DEPLOYED — web part in `3daa83fd` (Sprint 2); presets-api part (reject control/bidi characters, store the href, strip author names) in `f1b54a0f` (local branch `fix/security-2026-10-03-sprint3`, presets-api 2.4.0; PR #224, open).
