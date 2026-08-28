# [DEAD-001]: `apps/web-app/index.html` — orphaned former Vite entry

## Category
Orphaned File

## Location
- File: `apps/web-app/index.html` (22,709 bytes, last modified 2026-01-19)
- Superseded by: [apps/web-app/src/index.html](../../../../apps/web-app/src/index.html) (5,290 bytes)

## Deploy Unit
`web-app`

## Semver Impact
**NONE** — not exported, not published, not referenced by any build.

## Evidence

Vite's root is `src`, so `src/index.html` is the entry and the sibling at the package root is
never read:

```ts
// apps/web-app/vite.config.ts:13-15
  root: 'src',
  publicDir: '../public',
```

Vite resolves `<root>/index.html` as the entry. With `root: 'src'`, that is
`apps/web-app/src/index.html`. The package-root `index.html` is outside the root and outside
`publicDir`, so it is neither an entry nor a copied asset — it cannot reach `dist/`.

The two files have fully diverged. The orphan is 4× larger and carries content the live entry
does not:

| | orphan (`index.html`) | live (`src/index.html`) |
|---|---|---|
| Size | 22.7 KiB | 5.3 KiB |
| Modified | 2026-01-19 | 2026-07-31 |
| Meta CSP | ✅ present (+ a commented dev variant) | ❌ absent |
| Inline `<link rel="stylesheet" href="src/styles/globals.css">` | ✅ line 179 | ❌ (imported via `main.ts` → `tailwind.css`) |

## Why It Exists

It was the original Vite entry. When the project moved to `root: 'src'` and created
`src/index.html`, the old file was left in place rather than deleted. Its 2026-01-19 timestamp
predates the 5.0 work; the live entry's is 2026-07-31.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | **HIGH** — Vite's `root: 'src'` makes it structurally unreachable. No script, config, or workflow references it (`grep -rn "web-app/index.html"` → only its own self-reference) |
| **Blast Radius** | **NONE** — it produces no build output today; deleting it cannot change `dist/` |
| **Reversibility** | **EASY** — `git revert`; the file is fully in history |
| **Hidden Consumers** | Checked: no `vite.config` `input` override, no Playwright `baseURL` path reference, no CI workflow copy step, no `netlify.toml` `publish` pointing at it (that file has its own problem — `DEAD-003`) |

## The one thing to check before deleting

**The orphan is the only place a `Content-Security-Policy` meta tag exists.** Before removing
it, confirm the header-based CSP is genuinely live — it is, but verify rather than trust:

```bash
# The real CSP source — copied into dist/ by Vite's publicDir
cat apps/web-app/public/_headers
# Confirm it survives a build
pnpm --filter xivdyetools-web-app run build && cat apps/web-app/dist/_headers
```

Both were confirmed present during this audit. The header CSP is **stronger** than the meta one
it replaced — it adds `frame-ancestors 'none'` and `upgrade-insecure-requests`, neither of
which a `<meta>` tag can enforce. This is recorded as `FINDING-006` (informational) in the
security audit; there is no CSP gap.

## Recommendation
**REMOVE**

### Rationale

- Removes 22.7 KiB of markup that looks authoritative but ships nothing.
- Eliminates a genuine **maintenance trap**: it is the file most people open when they search
  for "the web app's index.html", and edits there are silently discarded. That is precisely the
  drift the design record warns about — *"Grep before editing any figure or quoted string; they
  appear twice."*
- Removes the second, drifting copy of the CSP. Two CSPs in one package invites editing the
  wrong one.

### If Removing

1. Confirm the header CSP is present in a fresh build (commands above).
2. `git rm apps/web-app/index.html`
3. `pnpm --filter xivdyetools-web-app run build` — confirm the build still succeeds and
   `dist/index.html` is generated from `src/index.html`.
4. Confirm `dist/_headers` is present in the build output.
5. Run the Playwright E2E suite — it loads the built app, so a broken entry would fail loudly.
6. Land together with `DEAD-003` (`netlify.toml`, the third CSP copy) so the package is left
   with exactly one CSP source of truth.

### Related
- `DEAD-003` — `netlify.toml`, same cleanup event, also carries a CSP copy
- `DEAD-002` — `apps/web-app/fonts/`, also orphaned by the entry move
- `FINDING-006` — security audit's informational note on CSP delivery
