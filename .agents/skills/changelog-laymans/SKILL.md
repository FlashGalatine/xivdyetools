---
name: changelog-laymans
description: Use when asked for a layman's / plain-language / user-friendly / player-facing changelog or release notes for xivdyetools — the root product-level CHANGELOG-laymans.md (Discord announcement + /changelog) or the web-app's in-app What's New — or to "simplify the changelog".
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Layman's Changelog (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

Two player-facing files, **both parsed by machines with strict grammars** — an entry that
breaks the grammar is silently skipped. Read `../audit-shared/changelog-contract.md` first
(§2 root file, §3 web-app file, §4 language rules); nothing below repeats the grammar.

## Parameters

| Param | Values |
|---|---|
| TARGET | `root` — product-level `CHANGELOG-laymans.md` (all surfaces; announcement webhook + Discord `/changelog`) · `web-app` — `apps/web-app/CHANGELOG-laymans.md` (in-app modal) · default: whichever the technical changes touch (both for a release wave) |
| VERSIONS | default: everything not yet represented (see Step 1); or an explicit `x.y.z` |
| MODE | `write` (default, edit the file) · `preview` (print the entry, touch nothing) |

## Step 1 — what is new

Collection only → a `collector` agent (`../audit-shared/model-routing.md`) runs the block and
returns the last announced version per file plus the `[Unreleased]`/newer blocks verbatim.
Follow the coordinator rules for delegation.

```bash
git fetch origin --quiet; git branch --show-current
# technical entries not yet on main (the release material)
git diff origin/main..HEAD --stat -- CHANGELOG.md 'apps/*/CHANGELOG.md' 'packages/*/CHANGELOG.md'
git log origin/main..HEAD --format='%h %s' -- <unit(s)>
# what the laymans file already covers
grep -n -E '^## ' CHANGELOG-laymans.md | head -5                       # root: last product version announced
grep -n -E '^## ' apps/web-app/CHANGELOG-laymans.md | head -5          # web-app: last "Web-App Version x.y.z" + any Unreleased draft
```
Then read the `[Unreleased]` / newer `[x.y.z]` blocks of the technical changelogs in scope
(`sed -n '/^## \[Unreleased\]/,/^## \[/p' <unit>/CHANGELOG.md`). For `root`, every
player-visible surface counts: web-app, discord-worker, moderation-worker (user-visible bits),
og-worker (link previews), presets-api/api-worker only when a player notices (e.g. presets
rules, market prices). Packages never appear by name.

## Step 2 — transform

**Steps 2 and 3 are not delegated, on any coordinator.** The input is a few changelog blocks —
there is nothing to save — and merging the root file fires the announcement webhook, so the
wording ships to players unreviewed. Write it yourself; a coordinator that wants a second
opinion asks a `verifier` agent to *critique* a draft, never to author the entry. Only the Step 3
validation commands go to a `collector` when delegated.

Apply `changelog-contract.md` §4. Working glossary for this project:

| Technical | Say |
|---|---|
| stainID / itemID / consolidated dyes | "dyes" (players never see IDs) · "dyes that share one market item" |
| Universalis / market-board fetch / api-worker proxy | "market prices" |
| og-worker / OG card / crawler embed | "link previews (Discord, X, …)" |
| presets-api / D1 / R2 preview image | "community presets" / "preset preview images" |
| locale keys / i18n / CJK subset fonts / tofu | "translations" / "Japanese, Korean and Chinese text" |
| rate limiting / HMAC / JWT / Ed25519 / CSP | "abuse protection" / "login security" (one line, no detail) |
| Lit / shadow DOM / bundle size / lazy chunk | omit, or "loads faster" if measured |
| register-commands / slash command metadata | "Discord commands now show translated names/descriptions" |

Group related bullets; merge internal-only items into at most one "behind the scenes" line
(or drop); keep every player-visible change. Security stays vague.

## Step 3 — write in the exact grammar

- **root**: new block at the top: `## [<product version>] - YYYY-MM-DD`, `### <Section>` headings
  by surface or theme, flat `- ` bullets naming the surface. No intro paragraphs, no nested
  bullets. Product version = the release wave (ask if unclear; e.g. `5.0.1`), not a worker's.
- **web-app**: `## Web-App Version x.y.z — Month D, YYYY` (or keep `## Unreleased — …` while
  drafting), `### ` headings, optional intro line, `- **Lead-in** text` bullets, `---`, footer.
  Replace the existing `Unreleased` draft rather than adding a second one.

Validate before finishing:
```bash
# root grammar (same regexes as the parser): every version header, section, bullet must match
awk '/^## /{h=$0~/^## \[[^]]+\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$/; if(!h)print "BAD HEADER: "$0} /^- /{ok=1}' CHANGELOG-laymans.md
pnpm --filter xivdyetools-discord-worker exec vitest run src/services/changelog-parser.test.ts   # parser still green
# web-app
pnpm --filter xivdyetools-web-app exec vitest run src/__tests__/changelog-parser.test.ts src/components/__tests__/changelog-modal.test.ts
```
`preview` mode prints the block instead of editing.

## Step 4 — commit rule

The root file is committed **on its own** (`docs(changelog): player notes for <version>`), never
folded into a code commit — pushing it to `main` fires the announcement webhook (10 KB cap).
The web-app file rides with the web-app release commit. Never push from this skill.

## Quick asks

| Ask | Do |
|---|---|
| "simplify the changelog" / "what's new for players" | TARGET root, Step 1–3 |
| "update the in-app changelog" | TARGET web-app |
| "show unreleased versions" | Step 1 only, print the blocks |
| "preview" | MODE preview |
