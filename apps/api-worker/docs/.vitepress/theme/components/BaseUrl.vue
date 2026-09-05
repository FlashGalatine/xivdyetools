<script setup lang="ts">
import { ref } from 'vue'
import { API_BASE } from '../lib/live'

const props = withDefaults(defineProps<{ path?: string }>(), { path: '/v1' })

const url = API_BASE + props.path
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // Clipboard denied — the URL is selectable text either way.
  }
}
</script>

<template>
  <div class="xdt-base">
    <span class="xdt-label">Base</span>
    <code class="xdt-base-url">{{ url }}</code>
    <button type="button" class="xdt-base-copy" @click="copy">{{ copied ? 'COPIED' : 'COPY' }}</button>
  </div>
</template>

<style scoped>
.xdt-base {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 6px 0 16px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  max-width: 560px;
  margin: 16px 0;
}
.xdt-base-url {
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  color: var(--vp-c-text-1);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: none;
  padding: 0;
  border-radius: 0;
}
.xdt-base-copy {
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: none;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.6px;
  cursor: pointer;
}
.xdt-base-copy:hover {
  background: rgba(255, 255, 255, 0.14);
}
@media (max-width: 639px) {
  .xdt-base {
    height: 44px;
    padding-left: 12px;
    gap: 8px;
  }
  .xdt-base .xdt-label {
    display: none;
  }
  .xdt-base-url {
    font-size: 12px;
  }
}
</style>
