<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import ItemIdFetcher from './ItemIdFetcher.vue'
import ColorInput from './ColorInput.vue'
import CategorySelect from './CategorySelect.vue'
import AcquisitionInput from './AcquisitionInput.vue'
import FlagsInput from './FlagsInput.vue'
import LocaleInputs from './LocaleInputs.vue'
import PreviewCard from './PreviewCard.vue'
import ValidationMessages from './ValidationMessages.vue'

import { hexToRgb, hexToHsv, validateHexColor, normalizeHex } from '@/services/colorService'
import { addDyeToDatabase, checkServerHealth } from '@/services/fileService'
import { DEFAULT_FORM_STATE } from '@/utils/constants'
import type { DyeFormState, LocaleCode, Dye, ValidationError } from '@/types'

const emit = defineEmits<{
  success: [dyeName: string]
  error: [message: string]
}>()

// Form state
const form = reactive<DyeFormState>({ ...DEFAULT_FORM_STATE, locales: { ...DEFAULT_FORM_STATE.locales } })

// Auto-filled locales tracking
const autoFilledLocales = ref<LocaleCode[]>([])

// Loading state
const isSubmitting = ref(false)
const serverOnline = ref(true)

// Check server status on mount
// MAINT-BUG-001 FIX: Added .catch() to prevent unhandled promise rejection
checkServerHealth()
  .then((online) => {
    serverOnline.value = online
  })
  .catch(() => {
    // Server unreachable or health check failed - show offline state
    serverOnline.value = false
  })

// Validation errors
const validationErrors = computed<ValidationError[]>(() => {
  const errors: ValidationError[] = []

  if (form.itemID === null) {
    errors.push({ field: 'itemID', message: 'Item ID is required' })
  }

  const hex = normalizeHex(form.hex)
  if (!hex || hex === '#') {
    errors.push({ field: 'hex', message: 'Hex color is required' })
  } else if (!validateHexColor(hex)) {
    errors.push({ field: 'hex', message: 'Invalid hex color format' })
  }

  if (!form.locales.en.trim()) {
    errors.push({ field: 'locales.en', message: 'English name is required' })
  }

  if (!form.category) {
    errors.push({ field: 'category', message: 'Category is required' })
  }

  if (!form.acquisition) {
    errors.push({ field: 'acquisition', message: 'Acquisition method is required' })
  }

  return errors
})

// Can submit?
const canSubmit = computed(() => {
  return validationErrors.value.length === 0 && serverOnline.value && !isSubmitting.value
})

// Build the dye object for preview/submission
const dyeObject = computed<Dye | null>(() => {
  const hex = normalizeHex(form.hex)
  if (!validateHexColor(hex)) return null

  try {
    const rgb = hexToRgb(hex)
    const hsv = hexToHsv(hex)

    return {
      itemID: form.itemID,
      category: form.category,
      name: form.locales.en || form.name,
      hex: hex,
      acquisition: form.acquisition,
      price: form.price,
      currency: form.currency,
      rgb,
      hsv,
      isMetallic: form.isMetallic,
      isPastel: form.isPastel,
      isDark: form.isDark,
      isCosmic: form.isCosmic,
    }
  } catch {
    return null
  }
})

// Handle names fetched from XIVAPI
function handleNamesFetched(names: Partial<Record<LocaleCode, string>>, autoFilled: LocaleCode[]) {
  // Update locale names
  for (const [locale, name] of Object.entries(names)) {
    form.locales[locale as LocaleCode] = name || ''
  }

  // Track which were auto-filled
  autoFilledLocales.value = autoFilled

  // Set English name as the primary name
  if (names.en) {
    form.name = names.en
  }
}

// Handle form submission
async function handleSubmit() {
  if (!canSubmit.value || !dyeObject.value) return

  isSubmitting.value = true

  try {
    const result = await addDyeToDatabase(dyeObject.value, form.locales)

    if (result.success) {
      emit('success', form.locales.en || 'Unknown')
      resetForm()
    } else {
      emit('error', result.errors.join('; '))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    emit('error', message)
  } finally {
    isSubmitting.value = false
  }
}

// Reset form to defaults
function resetForm() {
  Object.assign(form, {
    ...DEFAULT_FORM_STATE,
    locales: { ...DEFAULT_FORM_STATE.locales }
  })
  autoFilledLocales.value = []
}

// Update flags
function updateFlags(flags: { isMetallic: boolean; isPastel: boolean; isDark: boolean; isCosmic: boolean }) {
  form.isMetallic = flags.isMetallic
  form.isPastel = flags.isPastel
  form.isDark = flags.isDark
  form.isCosmic = flags.isCosmic
}
</script>

<template>
  <div class="space-y-6">
    <!-- Server Status Warning -->
    <div
      v-if="!serverOnline"
      class="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200"
    >
      <p class="font-medium">⚠️ Backend server not running</p>
      <p class="text-sm mt-1">
        Start the server with <code class="bg-red-800 px-1 rounded">npm run dev</code>
      </p>
    </div>

    <!-- Item ID Section -->
    <ItemIdFetcher
      :item-id="form.itemID"
      @update:item-id="form.itemID = $event"
      @names-fetched="handleNamesFetched"
    />

    <!-- Color Section -->
    <ColorInput v-model="form.hex" />

    <!-- Category and Acquisition Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card">
        <CategorySelect v-model="form.category" />
      </div>
      <div class="card">
        <AcquisitionInput
          :acquisition="form.acquisition"
          :price="form.price"
          :currency="form.currency"
          @update:acquisition="form.acquisition = $event"
          @update:price="form.price = $event"
          @update:currency="form.currency = $event"
        />
      </div>
    </div>

    <!-- Flags Section -->
    <FlagsInput
      :flags="{ isMetallic: form.isMetallic, isPastel: form.isPastel, isDark: form.isDark, isCosmic: form.isCosmic }"
      @update:flags="updateFlags"
    />

    <!-- Locale Names Section -->
    <LocaleInputs
      :locales="form.locales"
      :auto-filled-locales="autoFilledLocales"
      @update:locales="form.locales = $event"
    />

    <!-- Preview Section -->
    <PreviewCard :dye="dyeObject" />

    <!-- Validation Messages -->
    <ValidationMessages :errors="validationErrors" />

    <!-- Action Buttons -->
    <div class="flex justify-between items-center pt-4 border-t border-gray-700">
      <button
        @click="resetForm"
        class="btn btn-secondary"
      >
        Clear Form
      </button>

      <button
        @click="handleSubmit"
        :disabled="!canSubmit"
        class="btn btn-primary"
        :class="{ 'opacity-50 cursor-not-allowed': !canSubmit }"
      >
        <span v-if="isSubmitting" class="flex items-center gap-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Adding...
        </span>
        <span v-else>Add Dye to Library</span>
      </button>
    </div>
  </div>
</template>
