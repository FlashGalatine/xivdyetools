# [REFACTOR-001]: Stale 4.x branding in the live HTML entry — indigo `theme-color` against the 5.0 red identity

## Priority
MEDIUM

## Category
Maintainability / design-system conformance

## Location
- File(s): [apps/web-app/src/index.html](../../../../apps/web-app/src/index.html) lines 13, 57
- Scope: document-level metadata

## Deploy Unit
`web-app`

## Current State

The live Vite entry declares an indigo brand colour in two places:

```html
<!-- apps/web-app/src/index.html:13 -->
<meta name="theme-color" content="#4F46E5" />
<!-- :57 -->
<meta name="msapplication-TileColor" content="#4f46e5" />
```

`#4F46E5` is Tailwind `indigo-600` — the 4.x palette.

## Issues

- The 5.0 identity is red. The design record fixes the accent precisely:

  > exactly one filled accent element (`#EA4133` dark / `#CE2222` light …)
  > **App icon (confirmed): full bucket … on the 1C red tile (#CE2222)**
  > — `XIVDyeTools-redesign-5.0/CLAUDE.md` § Icons

- `theme-color` is **user-visible**: it tints the browser UI on Android Chrome, the PWA splash
  and task-switcher card, and the Safari tab bar on iOS. A user installing the 5.0 app as a PWA
  gets a red icon in an indigo chrome.
- `msapplication-TileColor` does the same for pinned Windows tiles.
- The `discord-worker` completed the equivalent consolidation — `COLORS.blurple`, declared four
  times, collapsed to a single `#EA4133` constant. Only the web entry was missed.

## Proposed Refactoring

Set both to the 5.0 accent, and prefer the light-theme red for `theme-color` since browser
chrome is typically light:

```html
<meta name="theme-color" content="#CE2222" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#EA4133" media="(prefers-color-scheme: dark)" />
…
<meta name="msapplication-TileColor" content="#CE2222" />
```

The `media`-scoped `theme-color` pair is well supported and matches the record's
light/dark split exactly, rather than picking one and being wrong half the time.

**Check the siblings in the same pass** — this is the class, not the instance:

- `apps/web-app/public/manifest.json` — PWA `theme_color` / `background_color` almost certainly
  carry the same indigo.
- `apps/web-app/public/browserconfig.xml` — referenced at line 58, contains its own
  `TileColor`.
- Any `#4F46E5` / `#4f46e5` remaining in `themes.css` or component styles.

```bash
grep -rin "4f46e5\|indigo" apps/web-app/src apps/web-app/public
```

## Benefits

- The installed PWA, pinned tile and browser chrome match the shipped 5.0 identity.
- Removes the last 4.x colour literal from the document shell, so the accent has one source of
  truth as the record intends.

## Effort Estimate
LOW — a metadata edit plus one grep sweep. No logic, no tests to rewrite.

## Risk Assessment
**Minimal.** Purely presentational metadata; no code path reads these values. The only way to
get it wrong is to miss a sibling file, which the grep above covers. Verify by installing the
PWA locally and checking the splash/task-switcher colour, and by loading the page on Android
Chrome.
