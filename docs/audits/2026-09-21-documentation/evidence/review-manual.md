# `/manual` review (coordinator, inline)

Ran inline rather than delegated: `manual-check.mjs` is mechanical and the remaining checklist
items are three roster comparisons.

## Gate

`node .agents/skills/documentation-audit/scripts/manual-check.mjs .` → **exit 0**
`… --ref origin/main` (after `git fetch`) → **exit 0**

Every locale's `overview` and `match_image` replies and all six topic replies are inside Discord's
limits (6,000 per message, 1,024 per field value); no key is missing in any of the six locales.
The branch's replies are 1–2 characters shorter than main's in `en` — the spelling change.

| Checklist item | Result |
|---|---|
| 1. Coverage — every registered command appears | **PASS.** 17 registered, 0 absent from the `en` overview. |
| 2. Syntax — command/subcommand/option names exist | **PASS.** Every `/cmd sub` token in the manual text resolves to `registry.ts` + `schemas.ts`. |
| 3. Claims vs handlers | Deferred to the `discord-worker` cluster worker, which reads the handlers. |
| 4. Topics — three rosters agree | **PASS.** `schemas.ts` choices (6) = `TOPIC_KEYS` (5) + the `match_image` branch = core `MANUAL_TOPICS` (6). |
| 5. Locales — `en` is American English | **PASS** on this branch (0 candidates in `manual.*`, `manual5.*`, `matchImageHelp.*`); main still has 3. |
| 6. Other surfaces agree | Deferred to the `discord-worker` cluster worker. |

## Rejected suspicions

A first pass extracted `/word` tokens from the manual text with a loose regex and reported four
commands as "named but not registered": `limbal`, `gender`, `shiny`, `exact`. All four are the
slash inside ordinary prose — "tattoo/limbal ring" (`manual.swatch.description`,
`manual5.topics.characterFile.body`), "clan/gender" (`manual.preferences.description`),
"metallic/shiny" and "precise/exact" (`matchImageHelp.*`). Not command references. The same regex
also produced `tring` from `registry.ts`, which is the tail of a `string` literal. Recorded so the
next run does not re-chase them.

## Stale-ref caveat

The first `--ref origin/main` run of this audit reported **8 registered commands absent** from the
overview. That was a stale `origin/main` (`fb8c10e`, 2026-09-07 — 159 commits behind). After
`git fetch origin main` the same command reports none absent. Fetch before trusting `--ref origin/main`.
