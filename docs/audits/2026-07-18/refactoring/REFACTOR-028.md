# [REFACTOR-028]: preset.ts (1328 lines) mixes six subcommands, a favorites group, and three notification builders

## Priority
LOW

## Category
File decomposition / separation of concerns

## Location
`apps/discord-worker/src/handlers/commands/preset.ts` (entire file; subcommand routing at `:92-129`)

## Current State
The largest source file across all three bot apps. It contains: the `/preset` router; `list`/`show`/`random`/`submit`/`vote`/`edit` handlers, each as a defer-handler + `process*Command` background pair; the `favorite add|remove|list` subcommand group; and the three channel-notification builders (`notifySubmissionChannel`, `notifyModerationChannel`, `notifyEditModerationChannel`).

## Issues
- **Finding density is the tell:** BUG-009 (dead buttons), BUG-035 (unchecked follow-up edits), BUG-072 (missing sanitization), and REFACTOR-025 (triplicated embeds) all land in this one file — it is carrying too many concerns to review or change safely.
- Diffs touching any one subcommand force reviewers through a 1300-line context; merge conflicts concentrate here.
- The notification builders are channel-messaging concerns, not command-handling concerns, and are duplicated against `index.ts`'s webhook path.
- Per-subcommand testing requires importing the whole module graph (SVG renderer, emoji, favorites, API client).

## Proposed Refactoring
Mechanical split into a `handlers/commands/preset/` directory:
- `index.ts` — router only (current `:60-130` logic)
- `list.ts`, `show.ts`, `random.ts` — read-path handlers
- `submit.ts`, `edit.ts` — submission flows
- `vote.ts` — vote toggle
- `favorites.ts` — the favorite group
- `notifications.ts` — the three notify* builders (also the landing zone for REFACTOR-025's shared embed builder and BUG-072's sanitization)
No behavior changes; exports preserved via the directory `index.ts` so `handlers/commands/index.ts` is untouched.

## Benefits
- Reviewable, conflict-resistant diffs; each subcommand testable in isolation.
- Gives BUG-009/BUG-035/BUG-072 fixes clean, small landing spots.
- Aligns with the budget command's existing structure (handler + co-located autocomplete + services module).

## Effort Estimate
Medium but mechanical — half a day to a day including splitting `preset.test.ts` along the same seams.

## Risk Assessment
Low. Pure code motion; routing behavior pinned by the existing test suite. Do it *before* the functional fixes above to keep those diffs small, or immediately after if fixes are urgent.

> Source: evidence/bot-workers-analysis.md (2026-07-18 deep-dive, bot-workers area)

## Status

**PARTIAL 2026-07-19** — the notification builders (the concern that produced BUG-009/072 and REFACTOR-025) were extracted to preset-notifications.ts, shrinking preset.ts by ~170 lines. The full six-way subcommand split remains open.
