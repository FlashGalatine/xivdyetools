<script setup lang="ts">
import { computed } from 'vue'
import { chromeGlyph, toolGlyph } from '@xivdyetools/svg'

// Only the glyphs the docs use: a tile carries one only where a tool exists
// (Matching → extractor, Character Equipment → swatch, Harmony → harmony,
// Languages → globe). The bar's search icon is VitePress's own.
const props = withDefaults(
  defineProps<{
    name: 'extractor' | 'swatch' | 'harmony' | 'globe'
    size?: number
  }>(),
  { size: 22 },
)

const svg = computed(() => {
  const options = { size: props.size }
  return props.name === 'globe' ? chromeGlyph('globe', options) : toolGlyph(props.name, 'compact', options)
})
</script>

<template>
  <span class="xdt-glyph" v-html="svg" />
</template>

<style scoped>
.xdt-glyph {
  display: inline-flex;
  flex: 0 0 auto;
  line-height: 0;
  color: var(--vp-c-text-1);
}
.xdt-glyph :deep(svg) {
  display: block;
}
</style>
