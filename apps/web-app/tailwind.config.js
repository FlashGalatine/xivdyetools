/** @type {import('tailwindcss').Config} */
export default {
  // Loaded through `@config` from src/styles/tailwind.css (Tailwind v4).
  //
  // No `content` array: v4's automatic source detection scans the tree
  // (src/index.html included) and is what has actually been generating the
  // utilities -- the old `content: ['./index.html', ...]` pointed at a file
  // that no longer existed (2026-08-16 audit, DEAD-021).
  //
  // No `darkMode` key: v4's default emits `dark:` variants under
  // `@media (prefers-color-scheme: dark)`; the app's own Light/Dark themes are
  // driven by CSS custom properties + `html.theme-*` classes (see themes.css).
  theme: {
    extend: {
      // Every family defers to the font contract in `src/styles/globals.css`
      // (REFACTOR-002) -- that block is the single declaration site. Spelling
      // the stacks out here is what let `font-mono` (Fira Code) and `font-sans`
      // (Onest) drift from the CSS rules of the same name; a variable cannot.
      // (`heading` / `numeric` were removed: `font-heading` had no consumer and
      // `font-numeric` only collided with the hand-written `.number` rule.)
      fontFamily: {
        sans: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}
