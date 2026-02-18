<script setup lang="ts">
import { LOCALES, XIVAPI_SUPPORTED_LOCALES } from '@/utils/constants'
import type { LocaleCode } from '@/types'

const props = defineProps<{
  locales: Record<LocaleCode, string>
  autoFilledLocales: LocaleCode[]
}>()

const emit = defineEmits<{
  'update:locales': [value: Record<LocaleCode, string>]
}>()

function updateLocale(code: LocaleCode, value: string) {
  emit('update:locales', {
    ...props.locales,
    [code]: value,
  })
}

function isAutoFilled(code: LocaleCode): boolean {
  return props.autoFilledLocales.includes(code)
}

function isXivapiSupported(code: string): boolean {
  return XIVAPI_SUPPORTED_LOCALES.includes(code as any)
}
</script>

<template>
  <div class="card">
    <label class="block mb-3 text-lg font-semibold">Localized Names</label>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="locale in LOCALES" :key="locale.code">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-lg">{{ locale.flag }}</span>
          <label class="text-sm">{{ locale.name }}</label>
          <span
            v-if="isAutoFilled(locale.code as LocaleCode)"
            class="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded"
          >
            auto
          </span>
          <span
            v-else-if="!isXivapiSupported(locale.code)"
            class="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded"
          >
            manual
          </span>
        </div>
        <input
          type="text"
          :value="locales[locale.code as LocaleCode]"
          @input="updateLocale(locale.code as LocaleCode, ($event.target as HTMLInputElement).value)"
          :placeholder="`Enter ${locale.name} name...`"
          class="w-full"
          :class="{
            'border-green-500/50': isAutoFilled(locale.code as LocaleCode),
            'border-yellow-500/50': !isXivapiSupported(locale.code)
          }"
        />
      </div>
    </div>

    <p class="text-xs text-gray-500 mt-3">
      <span class="text-green-400">auto</span> = fetched from XIVAPI •
      <span class="text-yellow-400">manual</span> = requires manual entry (Korean & Chinese)
    </p>
  </div>
</template>
