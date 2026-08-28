# [DEAD-021]: Dead Tailwind config — phantom `content` glob, unused `font-heading`, colliding `font-numeric`, contradictory `darkMode` comment

## Category
Dead Config (CSS)

## Location
- `apps/web-app/tailwind.config.js:6-9` `content: ["./index.html", "./src/**/*.{ts,tsx}"]`
- `apps/web-app/tailwind.config.js:17-20` `fontFamily: { sans, heading, mono, numeric }`
- `apps/web-app/tailwind.config.js:3-5` `darkMode` comment

## Evidence
- `./index.html` does not exist (entry is `src/index.html`); `./src/**/*.{ts,tsx}` matches no HTML/CSS. Yet `.font-sans` (only in `src/index.html:93`) and `.font-numeric` (only in `globals.css:119`) both appear in `dist/assets/index-*.css` → Tailwind v4's automatic source detection is what scans the tree; the legacy `content` globs are inert configuration that asserts something false.
- `font-heading`: `grep -rn "font-heading" .` (excl. node_modules/dist/coverage) → **0 hits**; not even generated in dist. Dead config.
- `font-numeric`: the utility IS emitted (token seen in `globals.css`) and the built CSS contains **both** `.font-numeric{font-family:var(--font-mono)}` (Tailwind) and `.font-numeric{font-family:var(--font-mono);font-variant-numeric:tabular-nums;letter-spacing:.02em}` (hand-authored) back to back — a collision with 0 class consumers (DEAD-019 deletes the hand-authored one).
- The `darkMode` comment claims the default `'media'` strategy; `themes.css:130-133` says darkMode is disabled so `dark:` variants don't exist; the codebase writes `dark:` variants extensively (`main.ts:108`, `color-picker-display.ts:79`, `dye-grid.ts:196`, …). Two comments contradict each other — flagged for a separate check (out of scope here whether `dark:` variants currently do anything).
- No `@theme` blocks exist anywhere — the project uses the legacy `@config` JS path.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (config that is provably not the mechanism in use) |
| **Reversibility** | EASY |
| **Hidden Consumers** | None. |

## Recommendation
**REMOVE** `content` (or replace with `@source` directives in `tailwind.css` if explicit sources are wanted) and `fontFamily.heading`/`.numeric`; **fix** the `darkMode` comment after verifying which behaviour is actually in effect.

### If Removing
1. Delete `content` and the `heading`/`numeric` entries from `tailwind.config.js`
2. `pnpm --filter xivdyetools-web-app run build`; diff `dist/assets/index-*.css` — expect only the two `.font-heading`/`.font-numeric` utilities to disappear
