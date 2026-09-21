# Policy documents — review (coordinator)

Four documents × six languages = **24 files**, all present.

## 1. Mechanical parity (`collector`)

`python .agents/skills/audit-shared/scripts/policy-locale-parity.py` → **exit 0, PASS, 0 problem groups**
(`evidence/policy-locale-parity.txt`). Existence of all five variants per document, heading/list/table
structure, the multiset of numbers, backticked tokens, URLs and slash-commands, matching `Last updated`
dates, the English-prevails notice, and staleness against the English file's last commit — all clean.

## 2. English governing text — American spelling

| File | Candidates |
|---|---|
| `apps/web-app/PRIVACY.md` | 6 |
| `apps/web-app/TERMS_OF_SERVICE.md` | 8 |
| `apps/discord-worker/PRIVACY_POLICY.md` | 0 |
| `apps/discord-worker/TERMS_OF_SERVICE.md` | 0 |

The two discord-worker documents are already American English — a positive control. The two web-app
documents are not. **A spelling fix here must not bump `Last updated`**: the parity script fails every
variant whose date differs from the English one. It also compares commits, so an English-only commit
makes all five variants report `stale: last commit … predates the English file's …` on the next run.
That is expected from a spelling-only commit and must be recorded, not chased.

## 3. Links and surfaces

- **web-app About modal — correct.** `apps/web-app/src/components/about-modal.ts:90` exports
  `policyDocFile(stem, locale)`, which returns `<STEM>.<locale>.md` for the five localized locales and
  the unsuffixed English file for `en` or anything else; `:459,461` pass it through `docLink()`.
  The viewer gets their own variant with an English fallback. **Positive control.**
- **The bot's `/about` links no policy at all.** `apps/discord-worker/src/handlers/commands/about.ts`
  renders `ELSEWHERE` = `PRODUCT_LINKS.webApp` + `PRODUCT_LINKS.inviteBot` + `SOCIAL_LINKS`, and
  `packages/core/src/config/product-links.ts:45-51` carries only those two product links. So there is no
  locale-variant violation — there is no link. **No `DOC-` finding**: no living document claims the bot
  links its policies (checked `docs/projects/discord-worker/`, `docs/user-guides/discord-bot/`,
  `docs/operations/`). Recorded as an observation, because `2026-09-19-i18n/I18N-010`'s *Fix* said
  "the bot's `/about` … likewise" and the finding is marked FIXED. Reachability of the bot's two policies
  from inside Discord is a product question for the maintainer, not a documentation defect.

## 4. Agreement with `docs/`

Retention periods and third parties in `docs/operations/ANALYTICS_QUERIES.md` (Cloudflare, Universalis;
30 days, 3 months) are a consistent **subset** of the bot policy's (which adds 90 days, 180 days, 13 years,
and Perspective). A narrower analytics-only list is expected, not a contradiction. No disagreement found.

## Known-finding status

The skill says to cite `2026-09-19-i18n/I18N-010` rather than re-file "no variants exist". **That finding
is closed** — `Status: FIXED 2026-09-20 863cd0e7 + 0008820a`, 20 translations + locale-aware About links,
parity PASS. The skill's sentence is therefore stale and is itself filed below.
