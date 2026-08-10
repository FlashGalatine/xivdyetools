/** @type {import('tailwindcss').Config} */
export default {
  // Note: darkMode uses default 'media' query based on prefers-color-scheme
  // However, our custom theme system (CSS variables + theme classes) overrides this
  // and provides the actual dark/light mode behavior through CSS custom properties
  content: [
    "./index.html",  // Scan main HTML file
    "./src/**/*.{ts,tsx}",  // Also scan TypeScript/TSX files
  ],
  theme: {
    extend: {
      // Every family defers to the font contract in `src/styles/globals.css`
      // (REFACTOR-002) -- that block is the single declaration site. Spelling
      // the stacks out here is what let `font-mono` (Fira Code) and `font-sans`
      // (Onest) drift from the CSS rules of the same name; a variable cannot.
      fontFamily: {
        sans: ['var(--font-body)'],
        heading: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        numeric: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}
