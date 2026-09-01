# DEAD-008: web-app `themes.css` — five Tailwind-override selectors no template uses (v3-era leftovers)

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead CSS

## Location
`apps/web-app/src/styles/themes.css` — `.text-green-600` (:182), `.bg-blue-100` (:214), `.bg-gradient-to-r` (:255), `.text-blue-900`, `.border-blue-200`

## Evidence
- `evidence/dead-css.sh` over all six stylesheets vs every tracked `.ts`/`.html` in web-app: these five are the only class selectors with **zero** template references. The other 1,316 CSS lines are all reachable — the 2026-08-16 sweep (1,719 dead lines) held.
- Shadow-DOM caveat applied (`traps/knip-and-dead-verdicts.md` §3): these live in `themes.css`, a page-scope stylesheet, and the claim is "no element ever carries the class", not "the rule cannot reach the element" — so the mount path does not change the verdict.
- **Their `dark:` siblings in the same rule groups are live** (`dark:bg-blue-900`, `dark:text-green-400` etc. appear in `dye-grid.ts`, `dye-selector.ts`, `image-upload-display.ts`): delete the individual selectors, not the groups.

## Fix
**REMOVE** the five selectors, keeping each rule group's surviving `dark:` selector and its body. ~5 lines. Fold into whichever web-app sprint runs first; not worth its own commit.
Gate: `pnpm turbo run build test --filter=xivdyetools-web-app` + `pnpm --filter xivdyetools-web-app run build:check` (a stylesheet edit moves the CSS bundle).

## Status
OPEN
