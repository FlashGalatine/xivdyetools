<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchStrip, type StripState } from '../lib/live'

// One real request on mount; the answer is painted as a swatch run, a count,
// or the API's error text verbatim — never a stand-in. `display: contents`
// on the root lets the strip and its meta land in a parent grid's two cells.
const props = withDefaults(
  defineProps<{
    query: string | null
    note?: string
    size?: 'md' | 'sm'
    maxSwatches?: number
  }>(),
  { note: 'no preview', size: 'md', maxSwatches: 12 },
)

const strip = ref<StripState>(props.query ? { state: 'loading' } : { state: 'none', text: props.note })

onMounted(async () => {
  if (!props.query) return
  strip.value = await fetchStrip(props.query)
})
</script>

<template>
  <span class="xdt-live" :class="`xdt-live--${size}`">
    <span class="xdt-live-cell">
      <template v-if="strip.state === 'ok'">
        <span class="xdt-swatches">
          <span
            v-for="s in strip.swatches.slice(0, maxSwatches)"
            :key="s.hex + s.name"
            class="xdt-swatch"
            :style="{ background: s.hex }"
            :title="s.name ? `${s.name} ${s.hex}` : s.hex"
          />
        </span>
        <span class="xdt-live-name">{{ strip.label }}</span>
      </template>
      <span v-else-if="strip.state === 'count'" class="xdt-live-count">{{ strip.count }} items<span class="xdt-live-count-rest"> · no colours in response</span></span>
      <span v-else-if="strip.state === 'err'" class="xdt-live-err" :title="strip.text">{{ strip.text }}</span>
      <span v-else-if="strip.state === 'loading'" class="xdt-live-skeleton" aria-label="loading" />
      <span v-else class="xdt-live-none">{{ strip.text }}</span>
    </span>
    <span class="xdt-live-meta">{{ strip.state === 'ok' || strip.state === 'count' || strip.state === 'err' ? strip.meta : strip.state === 'loading' ? '…' : '—' }}</span>
  </span>
</template>

<style scoped>
.xdt-live {
  display: contents;
}
.xdt-live-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 20px;
}
.xdt-swatches {
  display: flex;
  gap: 2px;
  height: 16px;
  border-radius: 4px;
  overflow: hidden;
  flex: 0 1 auto;
}
.xdt-swatch {
  width: 14px;
  flex: 0 0 14px;
}
.xdt-live-name {
  font-size: 11px;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.xdt-live-count,
.xdt-live-err,
.xdt-live-none {
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.xdt-live-count {
  color: var(--vp-c-text-1);
}
.xdt-live-err {
  color: var(--vp-c-brand-2);
}
.xdt-live-none {
  color: var(--vp-c-text-2);
}
.xdt-live-skeleton {
  display: block;
  width: 100px;
  height: 16px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  animation: xdt-pulse 1.4s infinite;
}
.xdt-live-meta {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  color: var(--vp-c-text-2);
  text-align: right;
  white-space: nowrap;
}

.xdt-live--sm .xdt-live-cell {
  height: 18px;
}
.xdt-live--sm .xdt-swatches {
  height: 14px;
}
.xdt-live--sm .xdt-swatch {
  width: 12px;
  flex-basis: 12px;
}
.xdt-live--sm .xdt-live-name {
  display: none;
}

@keyframes xdt-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.9;
  }
}
@media (prefers-reduced-motion: reduce) {
  .xdt-live-skeleton {
    animation: none;
  }
}
</style>
