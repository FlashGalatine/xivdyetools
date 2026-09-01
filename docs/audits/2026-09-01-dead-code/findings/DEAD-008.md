# DEAD-008: web-app `themes.css` — five Tailwind-override selectors no template uses (v3-era leftovers)

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead CSS

## Location
`apps/web-app/src/styles/themes.css` — `.text-green-600` (:182), `.bg-blue-100` (:214), `.bg-gradient-to-r` (:255), `.text-blue-900`, `.border-blue-200`

## Evidence
- `evidence/dead-css.sh` over all six stylesheets vs every tracked `.ts`/`.html` in web-app: these five are the only class selectors with **zero** template references. The other 1,316 CSS lines are all reachable — the 2026-08-16 sweep (1,719 dead lines) held.
- Shadow-DOM caveat applied (`traps/knip-and-dead-verdicts.md` §3): these live in `themes.css`, a page-scope stylesheet, and the claim is "no element ever carries the class", not "the rule cannot reach the element" — so the mount path does not change the verdict.
- **Correction made during removal:** a per-class count (`evidence/` — the same grep, one class at a time) showed only **`dark:bg-blue-900`** is referenced (3 files). The first pass had grouped all the `dark:` siblings together and read that single live hit as covering the group. The real dead set is larger: `.text-green-600`/`.dark\:text-green-400`, `.bg-blue-100`, `.text-blue-900`, `.dark\:text-blue-100`, `.border-blue-200`/`.dark\:border-blue-800`, `.bg-gradient-to-r` — 4 whole rule groups plus 2 singles, ~24 lines.

## Fix
**REMOVE** the dead selectors, keeping `.dark\:bg-blue-900` and its "Dye Comparison" comment. Fold into whichever web-app sprint runs first; not worth its own commit.
Gate: `pnpm turbo run build test --filter=xivdyetools-web-app` + `pnpm --filter xivdyetools-web-app run build:check` (a stylesheet edit moves the CSS bundle).

## Status
OPEN
