<script setup lang="ts">
import { computed } from 'vue'
import type { Dye } from '@/types'

const props = defineProps<{
  dye: Dye | null
}>()

// Format the dye object as JSON for display
const jsonPreview = computed(() => {
  if (!props.dye) return null

  // Create a clean object without null values displayed nicely
  const preview = {
    itemID: props.dye.itemID,
    category: props.dye.category,
    name: props.dye.name,
    hex: props.dye.hex,
    acquisition: props.dye.acquisition,
    price: props.dye.price,
    currency: props.dye.currency,
    rgb: props.dye.rgb,
    hsv: {
      h: Number(props.dye.hsv.h.toFixed(2)),
      s: Number(props.dye.hsv.s.toFixed(2)),
      v: Number(props.dye.hsv.v.toFixed(2)),
    },
    isMetallic: props.dye.isMetallic,
    isPastel: props.dye.isPastel,
    isDark: props.dye.isDark,
    isCosmic: props.dye.isCosmic,
  }

  return JSON.stringify(preview, null, 2)
})
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between mb-3">
      <label class="text-lg font-semibold">Preview</label>
      <span v-if="dye" class="text-xs text-gray-400">
        colors_xiv.json entry
      </span>
    </div>

    <div v-if="dye && jsonPreview" class="relative">
      <!-- Color badge in corner -->
      <div
        class="absolute top-3 right-3 w-8 h-8 rounded border-2 border-gray-600"
        :style="{ backgroundColor: dye.hex }"
        :title="dye.hex"
      />

      <!-- JSON Preview -->
      <pre
        class="bg-xiv-darker rounded-lg p-4 text-sm font-mono text-gray-300 overflow-x-auto"
      ><code>{{ jsonPreview }}</code></pre>
    </div>

    <div v-else class="bg-xiv-darker rounded-lg p-8 text-center text-gray-500">
      <p>Enter a valid hex color to see preview</p>
    </div>
  </div>
</template>
