import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import TryIt from './components/TryIt.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('TryIt', TryIt)
  },
} satisfies Theme
