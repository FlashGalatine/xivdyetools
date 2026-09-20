# Changelog contract (xivdyetools) — three kinds of changelog, two parsed by machines

## 1. Technical changelogs (Keep a Changelog)

- Every deploy unit owns `<unit>/CHANGELOG.md`; the root `CHANGELOG.md` covers the **monorepo
  itself** (workspace, CI, release waves) and points to the per-unit files.
- Format: `## [Unreleased]` (if the file keeps one) above `## [x.y.z] - YYYY-MM-DD`, sections
  `### Added | Changed | Fixed | Removed | Security | Deprecated`, newest first. Follow the
  file's own convention for whether an empty `[Unreleased]` header is kept after a release.
- Releasing a unit = rename its `[Unreleased]` block to `[x.y.z] - <date>`, bump `package.json`
  `version` (apps show it via Vite `__APP_VERSION__` in web-app; workers keep it informational)
  and update `docs/versions.md` (current table, history, compatibility matrix). Package versions
  follow the version rule in `release-mechanics.md`. Entries say *what broke and why it mattered*
  (house style, see `packages/core/CHANGELOG.md`). Commits: `<type>(<scope>): <claim>`, scope =
  directory name (`docs/developer-guides/contributing.md`).
- Dependency bumps, lint sweeps and security-only patches are **folded out** of both laymans
  files by policy (`docs/developer-guides/release-process.md`); only user-visible changes go there.

## 2. Root `CHANGELOG-laymans.md` — product-level, player-facing, MACHINE-PARSED

Parsed by `apps/discord-worker/src/services/changelog-parser.ts` for the **announcement
webhook** (fires on any push to `main` touching exactly this root path; payload cap 10 KB) and
the `/changelog` command. **Parse failures are silent** — an entry that breaks the grammar is
skipped without error.

```
## [x.y.z] - YYYY-MM-DD          ← regex ^## \[([^\]]+)\]\s*-\s*(.+)$  (hyphen, not em dash)
### Section Title                ← ^### (.+)$ — emoji welcome
- Short, self-contained bullet   ← ^[-*]\s+(.+)$ — FLAT bullets only, no nesting, no intro paragraphs
```
Rules: newest first · say which surface changed (web app / Discord bot / link previews) ·
bullets stand alone (they are translated into six languages) · keep security vague ·
push edits to this file **as their own small commit** · keep the new entry well under 10 KB.
The version here is the **product/release-wave** version (e.g. `5.0.0`), not a worker's.

## 3. `apps/web-app/CHANGELOG-laymans.md` — web-app only, MACHINE-PARSED

Parsed at build time by `apps/web-app/vite-plugin-changelog-parser.ts` → `virtual:changelog`
(the in-app changelog modal). Header regex:
`^##\s+[^\n]*?Version\s+(\d+\.\d+\.\d+)\s*(?:[—–-]\s*(.+?))?\s*$` — the header must contain the
word `Version` + semver; a block headed `## Unreleased — …` is therefore **invisible in the
app until it is versioned** (that is the intended drafting state).

```
# What's New
## Web-App Version 5.0.0 — August 16, 2026
### A plain-language section heading
Optional intro paragraph.
- **Bold lead-in** then the rest of the sentence
- Another bullet
### What you need to do
Nothing. …
---
*For technical details, see CHANGELOG.md*
```
Parser limits (silent): an entry with **zero `###` sections is dropped**; bullets are truncated at
200 chars and headings at 100; inline `**`/links/code are stripped; the block ends at the first
`---`; a bullet-less section folds its prose into one bullet; at most 50 versions render.
Validate after editing: `pnpm --filter xivdyetools-web-app exec vitest run src/__tests__/changelog-parser.test.ts`
and a build (`pnpm --filter xivdyetools-web-app run build:check`).

## 4. Plain-language rules (both laymans files)

Lead with what changed *for the player*; one idea per bullet; name the surface; no
implementation nouns (stainID, D1/KV/R2, service binding, k-d tree, CIEDE2000, subset fonts,
OG worker) — say "dye", "saved presets", "link previews", "Discord bot", "the web app";
quantify only with real numbers; breaking changes say what the player must do; security fixes
are mentioned without exploit detail; developer-only changes collapse to one line or are
omitted. Every meaningful technical entry must be represented by something — never lose
information, but do merge. House style: content is **English only** (the modal/bot chrome is
localized, the notes are not), British spelling as in the existing files (colour, behaviour),
tools by their 5.0 names (Harmony Explorer, Palette Extractor, Gradient Builder, Dye Mixer,
Accessibility Checker, Dye Comparison, Community Presets, Budget Suggestions, Swatch Matcher),
`### ` topic headings in the file's own voice — not generic ✨/🔧/🐛 buckets. The web-app file
is **cumulative** (the modal renders the history) — add/replace the top block, never overwrite
the file; the root file is also cumulative.
