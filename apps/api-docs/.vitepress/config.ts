import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'XIV Dye Tools API',
  description: 'Public REST API for FFXIV dye data and color matching.',
  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#c0a060' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'xivdyetools.app', link: 'https://xivdyetools.app' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Quick Start', link: '/guide/' },
            { text: 'Responses', link: '/guide/responses' },
            { text: 'Errors', link: '/guide/errors' },
            { text: 'Rate Limits', link: '/guide/rate-limits' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'Dyes', link: '/reference/dyes' },
            { text: 'Color Matching', link: '/reference/matching' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'discord', link: 'https://discord.gg/5VUSKTZCe5' },
    ],

    footer: {
      message: 'FINAL FANTASY XIV © 2010-2026 SQUARE ENIX CO., LTD. All Rights Reserved.<br>XIV Dye Tools is a fan-made application and is not affiliated with or endorsed by Square Enix.',
      copyright: 'Copyright © 2024-present XIV Dye Tools',
    },

    search: {
      provider: 'local',
    },
  },
})
