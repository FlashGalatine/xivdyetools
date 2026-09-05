import type { Theme } from 'vitepress'
// `theme-without-fonts`: the site serves the web-app's own woff2s (custom.css),
// so the default theme's Inter files would ship for nothing.
import DefaultTheme from 'vitepress/theme-without-fonts'
import Layout from './Layout.vue'
import BaseUrl from './components/BaseUrl.vue'
import DocsHome from './components/DocsHome.vue'
import EndpointCard from './components/EndpointCard.vue'
import EndpointIndex from './components/EndpointIndex.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('BaseUrl', BaseUrl)
    app.component('DocsHome', DocsHome)
    app.component('EndpointCard', EndpointCard)
    app.component('EndpointIndex', EndpointIndex)
  },
} satisfies Theme
