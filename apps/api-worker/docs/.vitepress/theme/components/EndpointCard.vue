<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { FIELD_SETS } from '../lib/fields'
import { API_BASE, buildUrl, curlFor, send, type ParamSpec, type SentResponse } from '../lib/live'
import JsonView from './JsonView.vue'
import LiveStrip from './LiveStrip.vue'

// The console card (API Docs Directions 1b–1d): one per endpoint, open by
// default. The parameter form on the left IS the parameter table — there is
// no second copy in Markdown — with the response object's fields folded under
// it. The right pane sends on tap only; nothing is fetched until asked.
const props = withDefaults(
  defineProps<{
    endpoint: string
    method?: 'GET' | 'POST'
    summary?: string
    params?: ParamSpec[]
    /** Fold a response-object field table under the form (`fields.ts`). */
    fields?: keyof typeof FIELD_SETS
    /** Live-strip request for the header (fetched on load, like the index rows). */
    preview?: string | null
    /** POST only: the default JSON body, editable. */
    body?: string
    open?: boolean
  }>(),
  { method: 'GET', summary: '', params: () => [], preview: null, body: '', open: true },
)

const values = reactive<Record<string, string>>(
  Object.fromEntries(props.params.map((p) => [p.name, p.default ?? ''])),
)
const bodyText = ref(props.body ? JSON.stringify(JSON.parse(props.body), null, 2) : '')
const isOpen = ref(props.open)
const fieldsOpen = ref(false)
const busy = ref(false)
const result = ref<SentResponse | null>(null)
const fetchError = ref<string | null>(null)
const copied = ref(false)

const url = computed(() => buildUrl(props.endpoint, props.params, values))
const displayUrl = computed(() => url.value.replace(API_BASE, ''))
const fieldSet = computed(() => (props.fields ? FIELD_SETS[props.fields] : null))
const paramGroups = computed(() =>
  (['path', 'query'] as const)
    .map((where) => ({ where, items: props.params.filter((p) => p.in === where) }))
    .filter((g) => g.items.length),
)
const showSnippets = computed(() => props.method === 'GET' && props.params.length === 0)
const inputId = (name: string) => `${props.endpoint.replace(/[^a-z0-9]+/gi, '-')}-${name}`

const meta = computed(() => {
  if (busy.value) return 'sending…'
  if (fetchError.value) return 'fetch failed'
  const r = result.value
  if (!r) return 'STATUS · TIME · X-REQUEST-ID — after Send'
  // HTTP/2 carries no reason phrase, so statusText is usually empty.
  return [`${r.status} ${r.statusText}`.trim(), `${r.ms} ms`, r.requestId ?? '—'].join(' · ')
})

function releaseImage() {
  if (result.value?.imageUrl) URL.revokeObjectURL(result.value.imageUrl)
}
onUnmounted(releaseImage)

async function doSend() {
  if (busy.value) return
  busy.value = true
  fetchError.value = null
  releaseImage()
  result.value = null
  try {
    const init: RequestInit | undefined =
      props.method === 'POST'
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyText.value }
        : undefined
    result.value = await send(url.value, init)
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : 'Network error'
  } finally {
    busy.value = false
  }
}

async function copyCurl() {
  // Built outside the try: nothing here can throw except the clipboard call.
  const command = curlFor(url.value, props.method, props.method === 'POST' ? bodyText.value : '')
  try {
    await navigator.clipboard.writeText(command)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch (e) {
    fetchError.value = `clipboard: ${e instanceof Error ? e.message : 'denied'}`
  }
}
</script>

<template>
  <section class="xdt-card" :class="{ 'xdt-card--open': isOpen }">
    <div class="xdt-card-hd" role="button" tabindex="0" :aria-expanded="isOpen" @click="isOpen = !isOpen" @keydown.enter.prevent="isOpen = !isOpen" @keydown.space.prevent="isOpen = !isOpen">
      <span class="xdt-method" :class="{ 'xdt-method--post': method === 'POST' }">{{ method }}</span>
      <code class="xdt-card-path">{{ endpoint }}</code>
      <span v-if="summary" class="xdt-card-sum">{{ summary }}</span>
      <span v-else class="xdt-card-spacer" />
      <LiveStrip v-if="preview" :query="preview" size="sm" :max-swatches="8" class="xdt-card-strip" />
      <span class="xdt-chev" aria-hidden="true">›</span>
    </div>

    <div v-show="isOpen" class="xdt-card-body">
      <div class="xdt-card-left">
        <p v-if="summary" class="xdt-card-sum-m">{{ summary }}</p>

        <template v-for="g in paramGroups" :key="g.where">
          <span class="xdt-label">Parameters · {{ g.where }}</span>
          <div v-for="p in g.items" :key="p.name" class="xdt-param">
            <label class="xdt-param-name" :for="inputId(p.name)">
              {{ p.name }}<span v-if="p.required" class="xdt-req">REQ</span>
            </label>
            <select v-if="p.options" :id="inputId(p.name)" v-model="values[p.name]" class="xdt-input xdt-select">
              <option value="">—</option>
              <option v-for="opt in p.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input
              v-else
              :id="inputId(p.name)"
              v-model="values[p.name]"
              class="xdt-input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="p.default ?? ''"
            />
            <span v-if="p.description" class="xdt-param-desc">{{ p.description }}</span>
          </div>
        </template>

        <template v-if="method === 'POST'">
          <span class="xdt-label">Body · JSON</span>
          <textarea v-model="bodyText" class="xdt-input xdt-textarea" spellcheck="false" rows="10" />
        </template>

        <template v-if="showSnippets">
          <span class="xdt-label">cURL</span>
          <code class="xdt-snippet"><span class="xdt-snippet-prompt">$ </span>curl {{ url }}</code>
          <span class="xdt-label">JavaScript</span>
          <code class="xdt-snippet">const r = await fetch(<span class="xdt-snippet-str">'{{ url }}'</span>);<br />const { data } = await r.json();</code>
        </template>

        <slot />

        <div v-if="fieldSet" class="xdt-fields">
          <button type="button" class="xdt-fields-toggle" :aria-expanded="fieldsOpen" @click="fieldsOpen = !fieldsOpen">
            {{ fieldsOpen ? '▾' : '▸' }} Fields · {{ fieldSet.rows.length }} in the {{ fieldSet.label }}
          </button>
        </div>
      </div>

      <div class="xdt-card-right">
        <div class="xdt-card-url">
          <span class="xdt-url" :title="url">{{ method }} {{ displayUrl }}</span>
          <button type="button" class="xdt-btn-send" :disabled="busy" @click="doSend">{{ busy ? 'Sending…' : 'Send' }}</button>
          <button type="button" class="xdt-btn-curl" @click="copyCurl">{{ copied ? 'Copied' : 'cURL' }}</button>
        </div>
        <div class="xdt-card-meta" :class="{ 'xdt-card-meta--err': fetchError || (result && !result.ok) }">{{ meta }}</div>
        <div class="xdt-card-resp">
          <span v-if="fetchError" class="xdt-resp-err">{{ fetchError }}</span>
          <template v-else-if="result">
            <img v-if="result.imageUrl" class="xdt-resp-img" :src="result.imageUrl" alt="" width="80" height="80" />
            <JsonView v-if="result.json !== undefined" :value="result.json" />
            <pre v-else class="xdt-json xdt-resp-raw">{{ result.text }}</pre>
          </template>
          <span v-else class="xdt-resp-empty">// tap Send — nothing is fetched until you ask</span>
        </div>
      </div>
    </div>

    <!-- The fold opens full-width under both columns: three columns of field
         table do not fit beside the response pane. -->
    <div v-if="fieldSet" v-show="isOpen && fieldsOpen" class="xdt-card-fields">
      <div v-for="f in fieldSet.rows" :key="f.name" class="xdt-field">
        <code class="xdt-field-name">{{ f.name }}</code>
        <code class="xdt-field-type">{{ f.type }}</code>
        <span class="xdt-field-desc">{{ f.description }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.xdt-card {
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
  margin: 16px 0 28px;
}
.xdt-card-hd {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}
.xdt-card--open .xdt-card-hd {
  border-bottom: 1px solid var(--vp-c-gutter);
}
.xdt-card-hd:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}
.xdt-card-path {
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  background: none;
  padding: 0;
  border-radius: 0;
}
.xdt-card-sum,
.xdt-card-spacer {
  flex: 1;
  min-width: 0;
}
.xdt-card-sum {
  font-size: 13px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xdt-card-sum-m {
  display: none;
  margin: 0 0 4px !important;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}
.xdt-chev {
  color: var(--vp-c-text-2);
  font-size: 16px;
  transition: transform 0.15s;
  flex-shrink: 0;
}
.xdt-card--open .xdt-chev {
  transform: rotate(90deg);
}

.xdt-card-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.xdt-card-left {
  padding: 14px 16px;
  border-right: 1px solid var(--vp-c-gutter);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.xdt-card-left .xdt-label + .xdt-label,
.xdt-param + .xdt-label,
.xdt-snippet + .xdt-label {
  margin-top: 6px;
}

.xdt-param {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 4px 12px;
  align-items: center;
}
.xdt-param-name {
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-brand-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.xdt-req {
  font-size: 9px;
  letter-spacing: 0.6px;
  color: var(--vp-c-text-2);
}
.xdt-input {
  height: 34px;
  width: 100%;
  padding: 0 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
  outline: none;
}
.xdt-input::placeholder {
  color: var(--vp-c-text-2);
}
.xdt-input:focus {
  border-color: var(--xdt-accent-border);
}
.xdt-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--vp-c-text-2) 50%),
    linear-gradient(135deg, var(--vp-c-text-2) 50%, transparent 50%);
  background-position: calc(100% - 15px) 14px, calc(100% - 10px) 14px;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 28px;
}
.xdt-select option {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
}
.xdt-textarea {
  height: auto;
  min-height: 120px;
  padding: 10px;
  line-height: 1.5;
  resize: vertical;
}
.xdt-param-desc {
  grid-column: 2;
  font-size: 11.5px;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}

.xdt-snippet {
  display: block;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  overflow-wrap: anywhere;
  background: none;
  padding: 0;
  border-radius: 0;
}
.xdt-snippet-prompt {
  color: var(--vp-c-text-2);
}
.xdt-snippet-str {
  color: var(--vp-c-brand-2);
}

.xdt-fields {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--vp-c-gutter);
}
.xdt-fields-toggle {
  border: none;
  background: none;
  padding: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.xdt-fields-toggle:hover {
  color: var(--vp-c-text-1);
}
.xdt-card-fields {
  border-top: 1px solid var(--vp-c-gutter);
}
.xdt-field {
  display: grid;
  grid-template-columns: 160px 110px minmax(0, 1fr);
  gap: 12px;
  padding: 8px 16px;
  font-size: 12px;
  line-height: 1.45;
}
.xdt-field + .xdt-field {
  border-top: 1px solid var(--vp-c-gutter);
}
.xdt-field-name,
.xdt-field-type {
  font-family: var(--vp-font-family-mono);
  background: none;
  padding: 0;
  border-radius: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xdt-field-name {
  font-size: 12px;
  color: var(--vp-c-brand-2);
}
.xdt-field-type {
  font-size: 11px;
  color: var(--vp-c-text-2);
}
.xdt-field-desc {
  color: var(--vp-c-text-1);
}

.xdt-card-right {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.xdt-card-url {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-gutter);
}
.xdt-url {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-2);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xdt-btn-send {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}
.xdt-btn-send:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}
.xdt-btn-send:disabled {
  opacity: 0.55;
  cursor: progress;
}
.xdt-btn-curl {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--xdt-accent-border);
  background: transparent;
  color: var(--vp-c-brand-2);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}
.xdt-btn-curl:hover {
  background: var(--vp-c-brand-soft);
}
.xdt-card-meta {
  padding: 8px 16px;
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-gutter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xdt-card-meta--err {
  color: var(--vp-c-brand-2);
}
.xdt-card-resp {
  padding: 12px 16px;
  max-height: 420px;
  overflow: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  line-height: 1.55;
}
.xdt-resp-empty {
  color: var(--vp-c-text-2);
}
.xdt-resp-err {
  color: var(--vp-c-brand-2);
}
.xdt-resp-raw {
  margin: 0;
  padding: 0;
  background: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.xdt-resp-img {
  display: block;
  margin-bottom: 10px;
  border-radius: 8px;
  background: var(--vp-c-bg);
  image-rendering: pixelated;
}

@media (max-width: 767px) {
  .xdt-card {
    border-radius: 13px;
  }
  .xdt-card-hd {
    gap: 8px;
    padding: 10px 12px;
  }
  .xdt-card-path {
    font-size: 13px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .xdt-card-sum {
    display: none;
  }
  .xdt-card-sum-m {
    display: block;
  }
  .xdt-card-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .xdt-card-left {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-gutter);
    padding: 10px 12px;
  }
  .xdt-param {
    grid-template-columns: 90px minmax(0, 1fr);
    gap: 4px 8px;
  }
  .xdt-input {
    height: 44px;
  }
  .xdt-textarea {
    height: auto;
  }
  .xdt-card-url {
    flex-wrap: wrap;
    padding: 10px 12px;
  }
  .xdt-url {
    flex-basis: 100%;
  }
  .xdt-btn-send {
    flex: 1;
    height: 44px;
    border-radius: 10px;
    font-size: 14px;
  }
  .xdt-btn-curl {
    height: 44px;
    padding: 0 14px;
    border-radius: 10px;
  }
  .xdt-card-meta,
  .xdt-card-resp {
    padding-left: 12px;
    padding-right: 12px;
  }
  .xdt-field {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 10px;
    padding: 8px 12px;
  }
  .xdt-field-desc {
    grid-column: 1 / -1;
  }
}
</style>
