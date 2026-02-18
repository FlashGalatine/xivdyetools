<script setup lang="ts">
import { ref } from 'vue'
import DyeForm from './components/DyeForm.vue'

const notification = ref<{ type: 'success' | 'error'; message: string } | null>(null)

function showNotification(type: 'success' | 'error', message: string) {
  notification.value = { type, message }
  setTimeout(() => {
    notification.value = null
  }, 5000)
}

function handleSuccess(dyeName: string) {
  showNotification('success', `Successfully added "${dyeName}" to the library!`)
}

function handleError(error: string) {
  showNotification('error', error)
}
</script>

<template>
  <div class="min-h-screen bg-xiv-darker">
    <!-- Header -->
    <header class="bg-xiv-dark border-b border-gray-700 px-6 py-4">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">
          XIV Dye Tools
          <span class="text-xiv-accent">— Dye Maintainer</span>
        </h1>
        <span class="text-sm text-gray-400">Developer Tool</span>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-6 py-8">
      <DyeForm
        @success="handleSuccess"
        @error="handleError"
      />
    </main>

    <!-- Notification Toast -->
    <Transition name="slide">
      <div
        v-if="notification"
        class="fixed bottom-4 right-4 px-6 py-4 rounded-lg shadow-lg max-w-md"
        :class="{
          'bg-green-600': notification.type === 'success',
          'bg-red-600': notification.type === 'error'
        }"
      >
        <div class="flex items-center gap-3">
          <span v-if="notification.type === 'success'" class="text-xl">✓</span>
          <span v-else class="text-xl">✕</span>
          <p class="text-white font-medium">{{ notification.message }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
