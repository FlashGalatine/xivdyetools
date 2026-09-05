<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import { onMounted, onUnmounted } from 'vue'
import SectionSheet from './components/SectionSheet.vue'

const { Layout } = DefaultTheme

// `/` opens search, the console-bar convention the search chip advertises
// (VitePress keeps its own Ctrl/Cmd+K binding).
function onKey(e: KeyboardEvent) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  const target = e.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
  const button = document.querySelector<HTMLElement>('.DocSearch-Button')
  if (!button) return
  e.preventDefault()
  button.click()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <a class="xdt-ext" href="https://xivdyetools.app" target="_blank" rel="noopener">
        xivdyetools.app <span class="xdt-ext-arrow">↗</span>
      </a>
      <SectionSheet />
    </template>
  </Layout>
</template>
