# Updating `/manual` (documentation-audit, update phase)

Read this only when the request includes updating `/manual`, or the user approved the `/manual`
findings. It changes shipped bot text, so it follows the repo's release contract. Also read
`../audit-shared/traps/git-worktrees-and-finishing.md`, `traps/i18n-fonts.md`,
`release-mechanics.md` and `changelog-contract.md`. For terminology and the translation house
style, read the relevant sections of `../i18n-manager/SKILL.md`.

**Start when:** the verifier has confirmed the `/manual` `DOC-` findings, and a worktree exists
on a fresh branch off `origin/main` with `pnpm install --frozen-lockfile` run inside it.

**Approval:** if the request asked for the `/manual` update, that request is the approval that
conventions.md §8 requires, so do not ask again. The update covers text and structure, and the
user reviews it as a draft PR, since nothing ships before the merge. Stop and ask before you go
further only when:

- the fix changes the slash-command shape (step 4), or
- the fix needs a package other than bot-logic to be published.

## Steps

1. **English text:** edit `packages/bot-logic/src/i18n/locales/en.json` (`manual.*`, `manual5.*`,
   `matchImageHelp.*`). Describe what the **served** command does, using `schemas.ts` for syntax
   and the handlers for behaviour. Keep syntax lines in the existing form,
   `` `/cmd sub <required> [optional]` ``.
2. **Structure:** if you add or remove a field or embed, edit `buildEmbeds()` in
   `apps/discord-worker/src/handlers/commands/manual.ts`.
   - Write every key as a literal `t.t('manual.…')`. `locale-orphans.test.ts` scans for literal
     keys, so a computed key looks orphaned.
   - Keep the `const TOPIC_KEYS: Partial<Record<ManualTopicId, string>> = {` line exactly as it
     is. The orphan gate uses a regex to parse it.
   - Discord allows up to 25 fields per embed and 10 embeds per message.
3. **The other five locales:** add the same keys to ja, de, fr, ko and zh, in the same order as
   en. A `worker` drafts replacement JSON for each locale and the coordinator applies it. Command
   names, subcommand names, option names and syntax lines are identifiers, so never translate
   them. The worker receives the en diff, the current locale file, and the terminology rules. It
   writes no files, and it returns one JSON fragment per locale with the same keys as the en
   diff, plus a line for any term it was unsure about.
4. **Topics:** do this step only if a topic is added, removed or renamed. Update the schema's
   `choices`, `TOPIC_KEYS`, and `manual5.topics.<key>.name`/`.body` in all six locales. Also update
   core's `MANUAL_TOPICS`, which needs its own core publish; plan that with `release-mechanics.md`.
   A changed `choices` list changes the slash-command shape. `deploy-discord-worker.yml`
   re-registers commands when the change merges, so flag it in the PR.
5. **Guard test:** add a test to `manual.test.ts` for each defect you fixed, unless an
   existing test already fails on it. PR #189 (2026-09-18) adds four guards under "the shipped
   text", which read the real locale source; until it merges they do not exist on `main`:
   - the overview names every `COMMAND_REGISTRY` entry, with any deliberate exceptions listed
     by name;
   - the overview and the 📸 topic name nothing unregistered;
   - every locale's reply fits within Discord's limits and resolves every key;
   - every syntax line is byte-identical to English.

   To prove a test works, delete one key and confirm the test fails.
6. **Checks:**
   - `node <SKILL_DIR>/scripts/manual-check.mjs .` must exit 0. fr and de produce the longest
     replies (fr ≈ 1.2 × en). Discord's 6,000-character cap is per **message**, summed over every
     embed, so another embed does not help: tighten the English source and have every locale
     follow, giving translators a measured length ratio (1.15 × en worked). Never cut one
     locale's text short on its own.
   - Never write emoji into a locale string — `font-coverage.test.ts` scans every bot-logic
     string for glyphs the card fonts can draw. Interpolate them from code (`{topics}` from
     core's `MANUAL_TOPICS`).
   - If the new text adds CJK glyphs, re-run `apps/discord-worker/scripts/subset-cjk-fonts.py`.
     `font-coverage.test.ts` scans every bot-logic locale string, embed text included.
   - Run `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic`. The
     leading dots add dependents, so discord-worker is included.
   - A `collector` runs these checks and returns exit codes and the relevant lines.
7. **Review:** a `verifier` checks the diff before any commit. Each changed claim must match
   `schemas.ts` and the handlers, and each translation must say the same thing as the en text.
8. **Release contract:**
   - Bump `packages/bot-logic` and `apps/discord-worker`, each with its own `CHANGELOG.md`
     entry. Decide each bump with `release-mechanics.md`'s version rule. Discord-worker uses
     bot-logic through `workspace:*`, so no dependency range changes.
   - Update the version rows in the root `README.md` and in `docs/versions.md`, then run
     `pnpm docs:check-versions`. It fails when either table disagrees with a `package.json`.
   - Add a `CHANGELOG-laymans.md` entry at the repo root and in `apps/discord-worker/`. Use the
     `changelog-laymans` skill, and have the coordinator write them. Merging the root file
     posts the Discord announcement, so commit it separately.
9. **Finish:** the coordinator commits only its own paths, pushes the branch and opens a draft
   PR. The PR lists the steps that happen after merge: Actions → "Publish Packages to npm" for
   bot-logic (and core, if it changed), and command re-registration if step 4 ran. Stop at the
   PR. Merging to `main` is the production deploy, and that decision belongs to the user.

**Never** run `deploy`, `deploy:production`, `register-commands` or `pnpm publish`, and never call
a mutating Discord endpoint to preview the result.
