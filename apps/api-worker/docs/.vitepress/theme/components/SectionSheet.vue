<script setup lang="ts">
import { useRoute, withBase } from 'vitepress'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ENDPOINTS, GROUPS, GUIDE_PAGES, countFor } from '../lib/endpoints'

// Mobile navigation: the bar's active chip names the current section and
// opens a bottom sheet of every section as 2-col tiles — the app's
// nine-tool sheet shape. Desktop never renders it (CSS), where the sidebar
// and the nav chips carry the same links.
const route = useRoute()
const open = ref(false)

interface Tile {
  tag: string
  label: string
  blurb: string
  link: string
  accent: boolean
}

const norm = (p: string) => p.replace(/\.html$/, '').replace(/index$/, '')
const current = computed(() => norm(route.path))

const tiles = computed<Tile[]>(() => [
  ...GUIDE_PAGES.map((g) => ({ tag: 'GUIDE', label: g.text, blurb: g.blurb, link: g.link, accent: false })),
  { tag: `REFERENCE · ${ENDPOINTS.length}`, label: 'Overview', blurb: 'Every endpoint, live', link: '/reference/', accent: false },
  ...GROUPS.map((g) => ({ tag: `REFERENCE · ${countFor(g.name)}`, label: g.name, blurb: g.blurb, link: g.page, accent: false })),
])

const isCurrent = (link: string) => norm(withBase(link)) === current.value

const label = computed(() => {
  if (current.value === withBase('/')) return 'Home'
  return tiles.value.find((t) => isCurrent(t.link))?.label ?? 'Menu'
})

watch(() => route.path, () => (open.value = false))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <button type="button" class="xdt-sheet-trigger" :aria-expanded="open" @click="open = !open">
    {{ label }} <span class="xdt-sheet-caret">{{ open ? '▴' : '▾' }}</span>
  </button>
  <Teleport to="body">
    <div v-if="open" class="xdt-sheet-root">
      <div class="xdt-sheet-backdrop" @click="open = false" />
      <div class="xdt-sheet" role="dialog" aria-label="Sections">
        <span class="xdt-sheet-grip" />
        <div class="xdt-sheet-hd">
          <span class="xdt-sheet-title">Sections</span>
          <button type="button" class="xdt-sheet-close" aria-label="Close" @click="open = false">×</button>
        </div>
        <div class="xdt-sheet-grid">
          <a
            v-for="t in tiles"
            :key="t.link"
            class="xdt-tile"
            :class="{ 'xdt-tile--active': isCurrent(t.link) }"
            :href="withBase(t.link)"
          >
            <span class="xdt-tile-tag">{{ t.tag }}</span>
            <span class="xdt-tile-label">{{ t.label }}</span>
            <span class="xdt-tile-blurb">{{ t.blurb }}</span>
          </a>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.xdt-sheet-trigger {
  display: none;
  height: 38px;
  padding: 0 12px;
  align-items: center;
  gap: 6px;
  border-radius: 10px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.xdt-sheet-caret {
  font-size: 10px;
}
@media (max-width: 959px) {
  .xdt-sheet-trigger {
    display: inline-flex;
  }
}

.xdt-sheet-root {
  position: fixed;
  inset: 0;
  z-index: 200;
}
.xdt-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}
.xdt-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 20px 20px 0 0;
  background: var(--vp-c-bg-alt);
  border-top: 1px solid var(--vp-c-divider);
  padding: 10px 12px calc(26px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 85vh;
  overflow-y: auto;
}
.xdt-sheet-grip {
  display: block;
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: var(--vp-c-divider);
  margin: 0 auto;
}
.xdt-sheet-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 0;
}
.xdt-sheet-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 17px;
  color: var(--vp-c-text-1);
}
.xdt-sheet-close {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  font-size: 18px;
  cursor: pointer;
}
.xdt-sheet-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.xdt-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 84px;
  padding: 12px;
  border-radius: 13px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-gutter);
  text-decoration: none;
  color: var(--vp-c-text-1);
}
.xdt-tile--active {
  background: var(--vp-c-brand-soft);
  border-color: var(--xdt-accent-border);
}
.xdt-tile-tag {
  font-family: var(--vp-font-family-mono);
  font-size: 9.5px;
  letter-spacing: 1px;
  color: var(--vp-c-text-2);
}
.xdt-tile--active .xdt-tile-tag {
  color: var(--vp-c-brand-2);
}
.xdt-tile-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13.5px;
  line-height: 1.2;
}
.xdt-tile-blurb {
  font-size: 10.5px;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}
</style>
