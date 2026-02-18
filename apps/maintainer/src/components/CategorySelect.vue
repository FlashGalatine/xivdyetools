<script setup lang="ts">
import { CATEGORIES } from '@/utils/constants'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div>
    <label class="block mb-1">Category</label>
    <select
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      class="w-full"
    >
      <option v-for="category in CATEGORIES" :key="category" :value="category">
        {{ category }}
      </option>
    </select>
  </div>
</template>
