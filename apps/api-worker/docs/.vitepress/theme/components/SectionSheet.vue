<script setup lang="ts">
import { useRoute, withBase } from 'vitepress'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ENDPOINTS, GROUPS, GUIDE_PAGES, countFor } from '../lib/endpoints'

// Mobile navigation: the bar's active chip names the current section and
// opens a bottom sheet of every section as 2-col tiles — the app's
// nine-tool sheet shape. Desktop never renders it: the trigger is hidden by
// CSS from 960 px and the sheet closes itself if the viewport crosses that
// line while open. While open it locks page scroll, moves focus to Close,
// keeps Tab inside, and hands focus back to the trigger on close.
const route = useRoute()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const sheet = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

interface Tile {
  tag: string
  label: string
  blurb: string
  link: string
}

const norm = (p: string) => p.replace(/\.html$/, '').replace(/index$/, '')
const current = computed(() => norm(route.path))

const tiles = computed<Tile[]>(() => [
  ...GUIDE_PAGES.map((g) => ({ tag: 'GUIDE', label: g.text, blurb: g.blurb, link: g.link })),
  { tag: `REFERENCE · ${ENDPOINTS.length}`, label: 'Overview', blurb: 'Every endpoint, live', link: '/reference/' },
  ...GROUPS.map((g) => ({ tag: `REFERENCE · ${countFor(g.name)}`, label: g.name, blurb: g.blurb, link: g.page })),
])

const isCurrent = (link: string) => norm(withBase(link)) === current.value

const label = computed(() => {
  if (current.value === withBase('/')) return 'Home'
  return tiles.value.find((t) => isCurrent(t.link))?.label ?? 'Menu'
})

const DESKTOP = '(min-width: 960px)'
let media: MediaQueryList | null = null

function close() {
  open.value = false
}

watch(() => route.path, close)

watch(open, async (isOpen) => {
  document.documentElement.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) {
    await nextTick()
    closeButton.value?.focus()
  } else {
    trigger.value?.focus()
  }
})

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Tab' && sheet.value) {
    const focusable = sheet.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function onMedia(e: MediaQueryListEvent) {
  if (e.matches) close()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  media = window.matchMedia(DESKTOP)
  media.addEventListener('change', onMedia)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  media?.removeEventListener('change', onMedia)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <button ref="trigger" type="button" class="xdt-sheet-trigger" :aria-expanded="open" aria-controls="xdt-section-sheet" @click="open = !open">
    {{ label }} <span class="xdt-sheet-caret" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
  </button>
  <Teleport to="body">
    <div v-if="open" class="xdt-sheet-root">
      <div class="xdt-sheet-backdrop" @click="close" />
      <div id="xdt-section-sheet" ref="sheet" class="xdt-sheet" role="dialog" aria-modal="true" aria-label="Sections">
        <span class="xdt-sheet-grip" aria-hidden="true" />
        <div class="xdt-sheet-hd">
          <span class="xdt-sheet-title">Sections</span>
          <button ref="closeButton" type="button" class="xdt-sheet-close" aria-label="Close" @click="close">×</button>
        </div>
        <div class="xdt-sheet-grid">
          <a
            v-for="t in tiles"
            :key="t.link"
            class="xdt-tile"
            :class="{ 'xdt-tile--active': isCurrent(t.link) }"
            :href="withBase(t.link)"
            :aria-current="isCurrent(t.link) ? 'page' : undefined"
          >
            <span class="xdt-tile-tag">{{ t.tag }}</span>
            <span class="xdt-tile-label">{{ t.label }}</span>
            <span class="xdt-tile-blurb">{{ t.blurb }}</span>
          </a>
        </div>
        <div class="xdt-sheet-links">
          <a href="https://xivdyetools.app" target="_blank" rel="noopener">xivdyetools.app ↗</a>
          <a href="https://discord.gg/5VUSKTZCe5" target="_blank" rel="noopener">Discord ↗</a>
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
@media (min-width: 960px) {
  .xdt-sheet-root {
    display: none;
  }
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
  overscroll-behavior: contain;
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
.xdt-sheet-close:focus-visible,
.xdt-tile:focus-visible,
.xdt-sheet-links a:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
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
.xdt-sheet-links {
  display: flex;
  gap: 18px;
  padding: 6px 4px 0;
  font-size: 12px;
}
.xdt-sheet-links a {
  color: var(--vp-c-text-2);
  text-decoration: none;
}
.xdt-sheet-links a:hover {
  color: var(--vp-c-text-1);
}
</style>
