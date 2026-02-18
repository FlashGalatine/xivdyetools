/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // XIV-inspired color palette
        'xiv-dark': '#1a1a2e',
        'xiv-darker': '#0f0f1a',
        'xiv-accent': '#4a9eff',
        'xiv-gold': '#c9a227',
      },
    },
  },
  plugins: [],
}
