# [DEAD-002]: `apps/web-app/fonts/` — 28 unreferenced woff2 files (640 KiB)

## Category
Orphaned File / Stale Asset

## Location
- Directory: `apps/web-app/fonts/` — 28 files, 640 KiB total
- Families: Cinzel (×6 weights), Cinzel Decorative (×3), Lexend (×9), Lexend Giga (×9), Habibi (×1)

## Deploy Unit
`web-app`

## Semver Impact
**NONE** — static assets, not exports.

## Evidence

**1. The directory is outside every path Vite reads.** Vite is configured as:

```ts
// apps/web-app/vite.config.ts:13-15
  root: 'src',
  publicDir: '../public',
```

Assets reach `dist/` either by being imported from source or by living in `publicDir`
(`apps/web-app/public/`). `apps/web-app/fonts/` is neither — it is a sibling of `src/` and
`public/`, so Vite never copies it.

**2. No source or stylesheet names these families.**

```
$ grep -rn "cinzel\|lexend\|Cinzel\|Lexend" --include="*.ts" --include="*.css" --include="*.html" \
    apps/web-app/src apps/web-app/public
(no output)
```

**3. The app's actual font roster is entirely different.** The families it loads at runtime come
from Google Fonts:

```js
// apps/web-app/public/js/load-fonts.js
'…css2?family=Space+Grotesk…&family=Onest…&family=Fira+Code…&family=Varela+Round…'
```

None of Cinzel, Cinzel Decorative, Lexend or Lexend Giga appears in any `@font-face`,
`font-family` declaration, or loader.

**4. The lone live font is the *other* Habibi copy.** `globals.css:13` references
`/fonts/habibi-v22-latin_latin-ext-regular.woff2`, which resolves at runtime to
`apps/web-app/**public**/fonts/…` (the served copy) — not the one in this directory. The two
files are byte-identical duplicates (14.2 KiB each); only the `public/` one is reachable.

## Why It Exists

These are 4.x-era typefaces. Cinzel and Lexend are display/serif faces from an earlier visual
direction that predates the Space Grotesk / Onest system. They were self-hosted at the time,
and were orphaned by the combination of (a) the switch to Google-Fonts loading and (b) the Vite
`root: 'src'` move, which repositioned what counts as an asset directory.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | **HIGH** — structurally unreachable by the bundler *and* unreferenced by name anywhere in source |
| **Blast Radius** | **NONE** — the files are not in any build output; `dist/` cannot change |
| **Reversibility** | **EASY** — `git revert`, or re-download from Google Fonts |
| **Hidden Consumers** | Checked: no CSS `url()` reference, no `import` of a `.woff2`, no CI/workflow copy step, no `netlify.toml` asset rule. The only same-named file (`habibi-…woff2`) has a live duplicate in `public/fonts/` that is unaffected |

## Recommendation
**REMOVE**

### Rationale

- 640 KiB of repository weight carried in every clone, checkout and CI fetch for zero runtime
  benefit.
- Actively misleading: the directory's existence implies the app self-hosts fonts, when it in
  fact fetches four families from `fonts.googleapis.com` at runtime. Anyone reasoning about the
  font pipeline from the file tree will reach the wrong conclusion — which is part of how
  [REFACTOR-002](../refactoring/REFACTOR-002.md)'s three-way font-stack divergence went
  unnoticed.
- Deleting it makes the real state visible, which is the precondition for deciding the
  self-hosting question deliberately.

### If Removing

1. Confirm the duplicate is not the live one:
   ```bash
   ls apps/web-app/public/fonts/     # habibi-…woff2 must remain here
   grep -rn "url('/fonts/" apps/web-app/src/styles/
   ```
   `globals.css` must keep resolving against `public/fonts/`.
2. `git rm -r apps/web-app/fonts/`
3. `pnpm --filter xivdyetools-web-app run build`
4. Diff the build output file list against a pre-removal build — it must be **identical**. If
   anything changed, the assumption above was wrong; stop and re-investigate.
5. Load the app and confirm typography is unchanged.

### Sequencing note

This is safe to do **now**, independently — it does not depend on any other finding.

But if [REFACTOR-002](../refactoring/REFACTOR-002.md) (self-host the font roster) is going to
happen, do this removal **first**, in its own commit. Deleting orphaned fonts and then adding
intentional self-hosted fonts as two clearly-separated changes keeps the diff legible; doing
both at once produces a commit where 28 deletions and 3 additions have to be read together to
see what actually happened.

### Related
- `DEAD-001` — `apps/web-app/index.html`, orphaned by the same entry move
- `DEAD-004` — the *live* Habibi copy in `public/fonts/`, which becomes removable only after
  [BUG-002](../bugs/BUG-002.md)
- [REFACTOR-002](../refactoring/REFACTOR-002.md) — the font-stack consolidation this unblocks
