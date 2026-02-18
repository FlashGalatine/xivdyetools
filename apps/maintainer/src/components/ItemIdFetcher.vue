<script setup lang="ts">
import { ref } from 'vue'
import { fetchItemNames } from '@/services/xivapiService'
import { getLocaleLabels, checkDuplicateItemId } from '@/services/fileService'
import type { LocaleCode } from '@/types'

const props = defineProps<{
  itemId: number | null
}>()

const emit = defineEmits<{
  'update:itemId': [value: number | null]
  'namesFetched': [names: Partial<Record<LocaleCode, string>>, autoFilled: LocaleCode[]]
}>()

const isLoading = ref(false)
const error = ref<string | null>(null)
const isDuplicate = ref(false)

async function handleFetch() {
  if (!props.itemId) {
    error.value = 'Please enter an Item ID first'
    return
  }

  isLoading.value = true
  error.value = null
  isDuplicate.value = false

  try {
    // Check for duplicate
    const exists = await checkDuplicateItemId(props.itemId)
    if (exists) {
      isDuplicate.value = true
      error.value = `Item ID ${props.itemId} already exists in the database`
      return
    }

    // Get locale labels for prefix stripping
    const labels = await getLocaleLabels()

    // Fetch names from XIVAPI
    const result = await fetchItemNames(props.itemId, labels)

    if (result.errors.length > 0 && Object.keys(result.names).length === 0) {
      error.value = result.errors.join(', ')
      return
    }

    // Emit the fetched names
    emit('namesFetched', result.names, result.autoFilled)

    // Show partial success warning
    if (result.errors.length > 0) {
      error.value = `Partial success: ${result.errors.join(', ')}`
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch from XIVAPI'
  } finally {
    isLoading.value = false
  }
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value ? parseInt(input.value, 10) : null
  isDuplicate.value = false
  error.value = null
  emit('update:itemId', value)
}
</script>

<template>
  <div class="card">
    <label class="block mb-3 text-lg font-semibold">Item ID</label>

    <div class="flex gap-3">
      <div class="flex-1">
        <input
          type="number"
          :value="itemId"
          @input="handleInput"
          placeholder="Enter FFXIV Item ID (e.g., 5734)"
          min="1"
          class="w-full"
          :class="{ 'border-red-500': isDuplicate }"
        />
      </div>
      <button
        @click="handleFetch"
        :disabled="!itemId || isLoading"
        class="btn btn-primary whitespace-nowrap"
        :class="{ 'opacity-50 cursor-not-allowed': !itemId || isLoading }"
      >
        <span v-if="isLoading" class="flex items-center gap-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Fetching...
        </span>
        <span v-else>Fetch from XIVAPI</span>
      </button>
    </div>

    <!-- Error/Warning Message -->
    <p v-if="error" class="text-sm mt-2" :class="isDuplicate ? 'text-red-400' : 'text-yellow-400'">
      {{ error }}
    </p>

    <!-- Help text -->
    <p class="text-xs text-gray-500 mt-2">
      Find Item IDs at
      <a href="https://universalis.app" target="_blank" class="text-xiv-accent hover:underline">
        universalis.app
      </a>
      or
      <a href="https://v2.xivapi.com" target="_blank" class="text-xiv-accent hover:underline">
        xivapi.com
      </a>
    </p>
  </div>
</template>
