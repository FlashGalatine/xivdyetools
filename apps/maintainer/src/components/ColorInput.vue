<script setup lang="ts">
import { computed, watch } from 'vue'
import { hexToRgb, hexToHsv, validateHexColor, normalizeHex } from '@/services/colorService'
import type { RGB, HSV } from '@/types'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Computed RGB values
const rgb = computed<RGB | null>(() => {
  const hex = normalizeHex(props.modelValue)
  if (!validateHexColor(hex)) return null
  try {
    return hexToRgb(hex)
  } catch {
    return null
  }
})

// Computed HSV values
const hsv = computed<HSV | null>(() => {
  const hex = normalizeHex(props.modelValue)
  if (!validateHexColor(hex)) return null
  try {
    return hexToHsv(hex)
  } catch {
    return null
  }
})

// Is the hex valid?
const isValid = computed(() => {
  const hex = normalizeHex(props.modelValue)
  return hex.length >= 4 && validateHexColor(hex)
})

// Handle text input
function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  let value = input.value

  // Ensure # prefix
  if (!value.startsWith('#')) {
    value = '#' + value.replace(/#/g, '')
  }

  emit('update:modelValue', value)
}

// Handle color picker
function handleColorPicker(event: Event) {
  const input = event.target as HTMLInputElement
  emit('update:modelValue', input.value)
}

// Format number to 2 decimal places
function formatNumber(n: number): string {
  return n.toFixed(2)
}
</script>

<template>
  <div class="card">
    <label class="block mb-3 text-lg font-semibold">Color</label>

    <div class="flex gap-6">
      <!-- Color Swatch -->
      <div
        class="color-swatch flex-shrink-0"
        :style="{ backgroundColor: isValid ? modelValue : '#333' }"
      >
        <span v-if="!isValid" class="text-gray-500 text-xs flex items-center justify-center h-full">
          ?
        </span>
      </div>

      <!-- Inputs -->
      <div class="flex-1 space-y-3">
        <!-- HEX Input Row -->
        <div class="flex items-center gap-3">
          <label class="w-12 text-sm">HEX:</label>
          <input
            type="text"
            :value="modelValue"
            @input="handleInput"
            placeholder="#000000"
            maxlength="7"
            class="flex-1 font-mono uppercase"
            :class="{ 'border-red-500': modelValue.length > 1 && !isValid }"
          />
          <input
            type="color"
            :value="isValid ? normalizeHex(modelValue) : '#000000'"
            @input="handleColorPicker"
            class="w-10 h-10 rounded cursor-pointer border-0 p-0"
            title="Color picker"
          />
        </div>

        <!-- RGB Display -->
        <div class="flex items-center gap-3">
          <label class="w-12 text-sm">RGB:</label>
          <div v-if="rgb" class="flex gap-4 text-sm text-gray-300 font-mono">
            <span>r: <strong class="text-red-400">{{ rgb.r }}</strong></span>
            <span>g: <strong class="text-green-400">{{ rgb.g }}</strong></span>
            <span>b: <strong class="text-blue-400">{{ rgb.b }}</strong></span>
          </div>
          <span v-else class="text-sm text-gray-500 italic">Enter valid hex</span>
        </div>

        <!-- HSV Display -->
        <div class="flex items-center gap-3">
          <label class="w-12 text-sm">HSV:</label>
          <div v-if="hsv" class="flex gap-4 text-sm text-gray-300 font-mono">
            <span>h: <strong class="text-yellow-400">{{ formatNumber(hsv.h) }}°</strong></span>
            <span>s: <strong class="text-purple-400">{{ formatNumber(hsv.s) }}%</strong></span>
            <span>v: <strong class="text-cyan-400">{{ formatNumber(hsv.v) }}%</strong></span>
          </div>
          <span v-else class="text-sm text-gray-500 italic">Enter valid hex</span>
        </div>
      </div>
    </div>

    <!-- Auto-calculation note -->
    <p class="text-xs text-gray-500 mt-3">
      RGB and HSV values are auto-calculated from the hex color
    </p>
  </div>
</template>
