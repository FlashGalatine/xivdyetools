<script setup lang="ts">
interface Flags {
  isMetallic: boolean
  isPastel: boolean
  isDark: boolean
  isCosmic: boolean
}

const props = defineProps<{
  flags: Flags
}>()

const emit = defineEmits<{
  'update:flags': [value: Flags]
}>()

function updateFlag(key: keyof Flags, value: boolean) {
  emit('update:flags', {
    ...props.flags,
    [key]: value,
  })
}
</script>

<template>
  <div class="card">
    <label class="block mb-3 font-medium">Dye Variant Flags</label>

    <div class="flex flex-wrap gap-6">
      <!-- Metallic -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="flags.isMetallic"
          @change="updateFlag('isMetallic', ($event.target as HTMLInputElement).checked)"
        />
        <span class="flex items-center gap-1">
          <span class="text-yellow-400">✦</span>
          Metallic
        </span>
      </label>

      <!-- Pastel -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="flags.isPastel"
          @change="updateFlag('isPastel', ($event.target as HTMLInputElement).checked)"
        />
        <span class="flex items-center gap-1">
          <span class="text-pink-300">◐</span>
          Pastel
        </span>
      </label>

      <!-- Dark -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="flags.isDark"
          @change="updateFlag('isDark', ($event.target as HTMLInputElement).checked)"
        />
        <span class="flex items-center gap-1">
          <span class="text-gray-600">●</span>
          Dark
        </span>
      </label>

      <!-- Cosmic -->
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="flags.isCosmic"
          @change="updateFlag('isCosmic', ($event.target as HTMLInputElement).checked)"
        />
        <span class="flex items-center gap-1">
          <span class="text-purple-400">✧</span>
          Cosmic
        </span>
      </label>
    </div>

    <p class="text-xs text-gray-500 mt-2">
      Select all that apply. Most dyes have none of these flags.
    </p>
  </div>
</template>
