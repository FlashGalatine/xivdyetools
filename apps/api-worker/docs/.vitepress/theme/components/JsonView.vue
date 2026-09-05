<script setup lang="ts">
import { computed } from 'vue'
import { toJsonLines } from '../lib/live'

const props = defineProps<{ value: unknown }>()

const lines = computed(() => toJsonLines(props.value))
</script>

<template>
  <div class="xdt-json">
    <span v-for="(ln, i) in lines" :key="i" class="xdt-json-line"><span>{{ ln.pad }}</span><span class="k">{{ ln.key }}</span><span class="p">{{ ln.sep }}</span><span class="v">{{ ln.rest }}</span></span>
  </div>
</template>
