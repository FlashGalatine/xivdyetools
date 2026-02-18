<script setup lang="ts">
import type { ValidationError } from '@/types'

defineProps<{
  errors: ValidationError[]
}>()

// Map field names to friendly labels
const fieldLabels: Record<string, string> = {
  itemID: 'Item ID',
  hex: 'Hex Color',
  'locales.en': 'English Name',
  category: 'Category',
  acquisition: 'Acquisition',
}

function getFieldLabel(field: string): string {
  return fieldLabels[field] || field
}
</script>

<template>
  <div v-if="errors.length > 0" class="card border-red-500/50 bg-red-900/20">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-red-400 text-lg">⚠</span>
      <label class="font-medium text-red-300">
        Please fix the following issues:
      </label>
    </div>

    <ul class="space-y-1 text-sm">
      <li
        v-for="error in errors"
        :key="error.field"
        class="flex items-center gap-2 text-red-200"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-red-400" />
        <strong>{{ getFieldLabel(error.field) }}:</strong>
        {{ error.message }}
      </li>
    </ul>
  </div>

  <!-- Success state when no errors -->
  <div v-else class="card border-green-500/50 bg-green-900/20">
    <div class="flex items-center gap-2">
      <span class="text-green-400 text-lg">✓</span>
      <p class="text-green-300 text-sm">All required fields are valid</p>
    </div>
  </div>
</template>
