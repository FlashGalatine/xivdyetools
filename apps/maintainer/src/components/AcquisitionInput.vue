<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  ACQUISITIONS,
  CURRENCIES,
  PRICED_ACQUISITIONS,
  COSMOCREDIT_ACQUISITIONS,
} from '@/utils/constants'

const props = defineProps<{
  acquisition: string
  price: number | null
  currency: string | null
}>()

const emit = defineEmits<{
  'update:acquisition': [value: string]
  'update:price': [value: number | null]
  'update:currency': [value: string | null]
}>()

// Should we show price inputs?
const showPrice = computed(() => {
  return PRICED_ACQUISITIONS.includes(props.acquisition) ||
         COSMOCREDIT_ACQUISITIONS.includes(props.acquisition)
})

// Auto-select currency based on acquisition
watch(() => props.acquisition, (newAcq) => {
  if (COSMOCREDIT_ACQUISITIONS.includes(newAcq)) {
    emit('update:currency', 'Cosmocredits')
  } else if (PRICED_ACQUISITIONS.includes(newAcq)) {
    emit('update:currency', 'Gil')
  } else {
    emit('update:price', null)
    emit('update:currency', null)
  }
})

function handlePriceInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value ? parseInt(input.value, 10) : null
  emit('update:price', value)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Acquisition Method -->
    <div>
      <label class="block mb-1">Acquisition</label>
      <select
        :value="acquisition"
        @change="emit('update:acquisition', ($event.target as HTMLSelectElement).value)"
        class="w-full"
      >
        <option v-for="acq in ACQUISITIONS" :key="acq" :value="acq">
          {{ acq }}
        </option>
      </select>
    </div>

    <!-- Price and Currency (conditional) -->
    <div v-if="showPrice" class="flex gap-4">
      <div class="flex-1">
        <label class="block mb-1">Price</label>
        <input
          type="number"
          :value="price"
          @input="handlePriceInput"
          min="0"
          placeholder="0"
          class="w-full"
        />
      </div>
      <div class="w-40">
        <label class="block mb-1">Currency</label>
        <select
          :value="currency"
          @change="emit('update:currency', ($event.target as HTMLSelectElement).value)"
          class="w-full"
        >
          <option v-for="curr in CURRENCIES" :key="curr" :value="curr">
            {{ curr }}
          </option>
        </select>
      </div>
    </div>

    <!-- Info text for non-priced acquisitions -->
    <p v-if="!showPrice" class="text-xs text-gray-500">
      This acquisition method doesn't have a standard price
    </p>
  </div>
</template>
