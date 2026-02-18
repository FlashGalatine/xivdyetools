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
      fontFamily: {
        sans: [
          'Onest',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        heading: [
          'Space Grotesk',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'Fira Code',
          'Consolas',
          'Monaco',
          'Courier New',
          'monospace',
        ],
        numeric: [
          'Habibi',
          'serif',
        ],
      },
    },
  },
  plugins: [],
}
