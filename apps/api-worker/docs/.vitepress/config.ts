import { defineConfig } from 'vitepress'
import { expandCardsForSearch } from './search-index'
import { ENDPOINTS, GROUPS, GUIDE_PAGES, countFor } from './theme/lib/endpoints'
import { xdtShikiTheme } from './theme/lib/shiki-theme'

// VPSidebarItem renders `text` with v-html, which is how the endpoint counts
// reach the right edge of each Reference row without a component override.
const count = (n: number) => ` <span class="xdt-count">${n}</span>`

const sidebar = [
  {
    text: 'Guide',
    items: GUIDE_PAGES.map(({ text, link }) => ({ text, link })),
  },
  {
    text: 'Reference',
    items: [
      { text: `Overview${count(ENDPOINTS.length)}`, link: '/reference/' },
      ...GROUPS.map((g) => ({ text: `${g.name}${count(countFor(g.name))}`, link: g.page })),
    ],
  },
]

export default defineConfig({
  title: 'XIV Dye Tools API',
  description: 'Public REST API for FFXIV dye data and color matching.',
  cleanUrls: true,
  srcExclude: ['**/CLAUDE.md', '**/README.md'],

  // Dark is the only theme drawn (API Docs Directions 1d, 2026-09-04); light
  // follows from the same variable table when it is.
  appearance: 'force-dark',

  head: [
    ['meta', { name: 'theme-color', content: '#0B0B0C' }],
    // The docs' own app icon — "6B · Socketed" (App Icon.dc.html, confirmed
    // 2026-09-04): the steel can on a red socket board, not production's
    // white can on the red tile. The bar keeps the flat six-stripe mark
    // (`logo`), per the "full bucket ≥ 20 px, flat mark below" rule.
    ['link', { rel: 'icon', href: '/icons/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'icon', href: '/icons/favicon-32x32.png', type: 'image/png', sizes: '32x32' }],
    ['link', { rel: 'icon', href: '/icons/favicon-16x16.png', type: 'image/png', sizes: '16x16' }],
    ['link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  ],

  markdown: {
    theme: xdtShikiTheme,
  },

  themeConfig: {
    logo: '/mark.svg',
    siteTitle: 'XIV Dye Tools <span class="xdt-tag">API</span>',

    nav: [
      { text: 'Home', link: '/', activeMatch: '^/$' },
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
      { text: 'Reference', link: '/reference/', activeMatch: '^/reference/' },
    ],

    sidebar: {
      '/guide/': sidebar,
      '/reference/': sidebar,
    },

    outline: { label: 'On this page' },

    footer: {
      message:
        'FINAL FANTASY XIV © 2010-2026 SQUARE ENIX CO., LTD. All Rights Reserved.<br>XIV Dye Tools is a fan-made application and is not affiliated with or endorsed by Square Enix. · <a href="https://discord.gg/5VUSKTZCe5" target="_blank" rel="noopener">Discord ↗</a>',
      copyright: 'Copyright © 2024-present XIV Dye Tools',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
        },
        // Parameters and the Dye Object live in card attributes / theme data,
        // invisible to the default indexer; expand them under their headings.
        _render(src, env, md) {
          const html = md.render(expandCardsForSearch(src), env)
          return env.frontmatter?.search === false ? '' : html
        },
      },
    },
  },
})
