<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

interface Param {
  name: string
  in: 'path' | 'query'
  required: boolean
  default?: string
  description: string
  options?: string[]
}

interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

const props = defineProps<{
  endpoint: string
  params?: Param[]
}>()

const BASE = 'https://data.xivdyetools.app'

const SHOWN_HEADERS = [
  'X-Request-ID',
  'X-API-Version',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Cache-Control',
]

// Initialise values from defaults
const values = reactive<Record<string, string>>(
  Object.fromEntries((props.params ?? []).map((p) => [p.name, p.default ?? ''])),
)

const loading = ref(false)
const response = ref<ApiResponse | null>(null)
const fetchError = ref<string | null>(null)
const copied = ref(false)

function buildUrl(): string {
  let path = props.endpoint
  const query: string[] = []

  for (const p of props.params ?? []) {
    const val = values[p.name]
    if (!val) continue
    if (p.in === 'path') {
      path = path.replace(`:${p.name}`, encodeURIComponent(val))
    } else {
      query.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`)
    }
  }

  return BASE + path + (query.length ? '?' + query.join('&') : '')
}

const displayUrl = computed(() => buildUrl().replace(BASE, ''))

async function send() {
  loading.value = true
  fetchError.value = null
  response.value = null

  try {
    const res = await fetch(buildUrl())
    const text = await res.text()

    const headers: Record<string, string> = {}
    for (const key of SHOWN_HEADERS) {
      const val = res.headers.get(key)
      if (val) headers[key] = val
    }

    let body = text
    try {
      body = JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      // leave as-is if not JSON
    }

    response.value = {
      status: res.status,
      statusText: res.statusText,
      headers,
      body,
    }
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : 'Network error'
  } finally {
    loading.value = false
  }
}

async function copyCurl() {
  const cmd = `curl "${buildUrl()}"`
  await navigator.clipboard.writeText(cmd)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="try-it">
    <!-- Header: method badge + live URL -->
    <div class="try-it-header">
      <span class="http-method">GET</span>
      <code class="try-it-path">{{ displayUrl }}</code>
    </div>

    <!-- Parameter inputs -->
    <div v-if="params?.length" class="try-it-params">
      <div v-for="p in params" :key="p.name" class="param-row">
        <div class="param-meta">
          <code class="param-name">{{ p.name }}</code>
          <span class="param-tag param-tag--in">{{ p.in }}</span>
          <span v-if="p.required" class="param-tag param-tag--required">required</span>
        </div>
        <select v-if="p.options" v-model="values[p.name]" class="param-input">
          <option value="">— choose —</option>
          <option v-for="opt in p.options" :key="opt" :value="opt">{{ opt }}</option>
        </select>
        <input
          v-else
          v-model="values[p.name]"
          :placeholder="p.default ?? p.description"
          class="param-input"
        />
        <span class="param-desc">{{ p.description }}</span>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="try-it-actions">
      <button class="btn-send" :disabled="loading" @click="send">
        {{ loading ? 'Sending…' : 'Send Request' }}
      </button>
      <button class="btn-copy" @click="copyCurl">
        {{ copied ? 'Copied!' : 'Copy as cURL' }}
      </button>
    </div>

    <!-- Response panel -->
    <div v-if="response" class="try-it-response">
      <div class="response-meta">
        <span
          class="status-badge"
          :class="response.status < 300 ? 'status-ok' : 'status-err'"
        >
          {{ response.status }} {{ response.statusText }}
        </span>
        <span
          v-for="(val, key) in response.headers"
          :key="key"
          class="response-header-chip"
        >
          {{ key }}: {{ val }}
        </span>
      </div>
      <pre class="response-body"><code>{{ response.body }}</code></pre>
    </div>

    <div v-if="fetchError" class="try-it-error">
      {{ fetchError }}
    </div>
  </div>
</template>

<style scoped>
.try-it {
  border: 1px solid var(--try-it-border);
  border-radius: 8px;
  background: var(--try-it-bg);
  margin: 1.5rem 0;
  overflow: hidden;
}

/* Header */
.try-it-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--try-it-border);
  background: var(--vp-c-bg-alt);
}
.http-method {
  background: var(--try-it-method-bg);
  color: #fff;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 0.2em 0.55em;
  border-radius: 4px;
  letter-spacing: 0.04em;
}
.try-it-path {
  font-size: 0.9rem;
  color: var(--vp-c-text-1);
  word-break: break-all;
}

/* Params */
.try-it-params {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  border-bottom: 1px solid var(--try-it-border);
}
.param-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: auto auto;
  gap: 0.25rem 0.75rem;
  align-items: start;
}
.param-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}
.param-name {
  font-size: 0.85rem;
  color: var(--vp-c-text-1);
}
.param-tag {
  font-size: 0.7rem;
  padding: 0.1em 0.45em;
  border-radius: 4px;
  font-family: var(--vp-font-family-base);
}
.param-tag--in {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-border);
}
.param-tag--required {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}
.param-input {
  grid-column: 2;
  width: 100%;
  padding: 0.4em 0.6em;
  font-size: 0.85rem;
  font-family: var(--vp-font-family-mono);
  background: var(--try-it-input-bg);
  border: 1px solid var(--try-it-border);
  border-radius: 4px;
  color: var(--vp-c-text-1);
  outline: none;
}
.param-input:focus {
  border-color: var(--vp-c-brand-1);
}
.param-desc {
  grid-column: 2;
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}

/* Actions */
.try-it-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}
.btn-send,
.btn-copy {
  padding: 0.45em 1.1em;
  font-size: 0.85rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-family: var(--vp-font-family-base);
  transition: opacity 0.15s;
}
.btn-send {
  background: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.btn-send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-copy {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  border: 1px solid var(--try-it-border);
}
.btn-send:hover:not(:disabled),
.btn-copy:hover {
  opacity: 0.8;
}

/* Response */
.try-it-response {
  border-top: 1px solid var(--try-it-border);
}
.response-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--try-it-border);
}
.status-badge {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2em 0.55em;
  border-radius: 4px;
}
.status-ok {
  background: rgba(22, 163, 74, 0.12);
  color: var(--try-it-status-ok);
}
.status-err {
  background: rgba(220, 38, 38, 0.1);
  color: var(--try-it-status-err);
}
.response-header-chip {
  font-size: 0.72rem;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--try-it-border);
  border-radius: 4px;
  padding: 0.15em 0.4em;
}
.response-body {
  margin: 0;
  padding: 1rem;
  font-size: 0.8rem;
  max-height: 400px;
  overflow: auto;
  background: var(--vp-c-bg);
  border-radius: 0;
}

/* Error */
.try-it-error {
  padding: 0.75rem 1rem;
  color: var(--try-it-status-err);
  font-size: 0.85rem;
  border-top: 1px solid var(--try-it-border);
}
</style>
