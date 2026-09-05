<script setup lang="ts">
import { computed } from 'vue'
import { chromeGlyph, panelGlyph, toolGlyph } from '@xivdyetools/svg'

// Only the glyphs the docs use: a tile carries one only where a tool exists
// (Matching → extractor, Character Equipment → swatch, Languages → globe),
// plus the search affordance in the bar.
const props = withDefaults(
  defineProps<{
    name: 'extractor' | 'swatch' | 'globe' | 'search'
    size?: number
  }>(),
  { size: 22 },
)

const svg = computed(() => {
  const options = { size: props.size }
  switch (props.name) {
    case 'extractor':
    case 'swatch':
      return toolGlyph(props.name, 'compact', options)
    case 'globe':
      return chromeGlyph('globe', options)
    case 'search':
      return panelGlyph('search', options)
  }
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
