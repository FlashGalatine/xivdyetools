# FINDING-028: PRIVACY.md §Links to other sites and TERMS_OF_SERVICE.md §Other people's services omit the author-supplied preset example link rendered by preset-detail.ts
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md §Links that take you to other sites; apps/web-app/TERMS_OF_SERVICE.md §Other people's services — variants: `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md`, `apps/web-app/TERMS_OF_SERVICE.md`, `apps/web-app/TERMS_OF_SERVICE.ja.md`, `apps/web-app/TERMS_OF_SERVICE.ko.md`, `apps/web-app/TERMS_OF_SERVICE.zh.md`, `apps/web-app/TERMS_OF_SERVICE.de.md`, `apps/web-app/TERMS_OF_SERVICE.fr.md` · **CWE:** CWE-1059
**Reconcile case:** 3 (Step 3a)

## Location
- apps/web-app/PRIVACY.md:83-95 — §Links that take you to other sites names only Glamour Reader 'Open in…' links and dye-card links; says what travels is 'the game's own item'
- apps/web-app/TERMS_OF_SERVICE.md:89-101 — §Other people's services lists the same two link families; no mention of preset example links
- apps/web-app/src/components/v4/preset-detail.ts:985-998 — renders the author-supplied preset.exampleLink as an off-site anchor

## Evidence
- preset-detail.ts:989-993: `<a class="example-link" href=${this.preset.exampleLink} target="_blank" rel="noopener noreferrer">`
- example-link.ts:16-28 allowlist: eorzeacollection.com, mirapri.com, reddit.com, redd.it, x.com, twitter.com, bsky.app, instagram.com, pixiv.net, finalfantasyxiv.com, misskey.io; sanitizeExampleLink (line 56) is applied at preset-tool.ts:676/699 and hybrid-preset-service.ts:187
- Grep for 'example|eorzea|pixiv' (case-insensitive) across apps/web-app/PRIVACY*.md and TERMS_OF_SERVICE*.md returns no matches

## Fix
- Add a sentence to PRIVACY.md §Links that take you to other sites: a community preset can carry an example link, chosen by the preset's author, to a glamour post on an allowlisted site (Eorzea Collection, Mirapri, Reddit, X, Bluesky, Instagram, pixiv, the Lodestone, Misskey). It opens in a new tab with the referrer suppressed and carries nothing about you.
- Add a matching bullet to TERMS_OF_SERVICE.md §Other people's services noting that preset example links are author-supplied and lead to third-party sites under their own terms.
- Mirror both edits into the .ja/.ko/.zh/.de/.fr siblings and bump each document's 'Last updated' date.

## Status
FIX COMMITTED, NOT DEPLOYED — `3daa83fd` (local branch `fix/security-2026-10-03-sprint2`, web-app 5.13.4; not pushed); all six locale variants.
