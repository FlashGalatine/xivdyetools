<script setup lang="ts">
import { withBase } from 'vitepress'
import { ENDPOINTS, GROUPS, endpointCountLabel, endpointsIn } from '../lib/endpoints'
import LiveStrip from './LiveStrip.vue'

// The grouped live index (1d): one row per endpoint, one real request per
// row on load. The group headings carry ids so the right rail lists them;
// the count tag is `ignore-header` so the rail prints the name alone.
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const short = (path: string) => path.replace(/^\/v1/, '')
</script>

<template>
  <div class="xdt-index">
    <p class="xdt-meta">
      {{ ENDPOINTS.length }} endpoints · {{ GROUPS.length }} sections · live from data.xivdyetools.app
    </p>
    <template v-for="g in GROUPS" :key="g.name">
      <h2 :id="slug(g.name)" class="xdt-index-h">
        <a class="header-anchor" :href="`#${slug(g.name)}`" :aria-label="`Permalink to “${g.name}”`">&#8203;</a>
        {{ g.name }}
        <span class="xdt-label ignore-header">{{ endpointCountLabel(endpointsIn(g.name).length) }}</span>
      </h2>
      <a v-for="ep in endpointsIn(g.name)" :key="ep.key" class="xdt-row" :href="withBase(ep.link)">
        <span class="xdt-method" :class="{ 'xdt-method--post': ep.method === 'POST' }">{{ ep.method }}</span>
        <code class="xdt-row-path"><span class="xdt-row-path-full">{{ ep.path }}</span><span class="xdt-row-path-short">{{ short(ep.path) }}</span></code>
        <span class="xdt-row-sum">{{ ep.summary }}</span>
        <LiveStrip :query="ep.preview" :note="ep.previewNote" :max-swatches="12" />
      </a>
    </template>
  </div>
</template>

<style scoped>
.xdt-index {
  display: flex;
  flex-direction: column;
  gap: 8px;
  container-type: inline-size;
}
.xdt-index-h {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 24px 0 4px !important;
  padding: 0 !important;
  border: none !important;
  font-size: 15px !important;
  font-weight: 600 !important;
}
.xdt-row {
  display: grid;
  grid-template-columns: 50px minmax(0, 240px) minmax(0, 1fr) minmax(120px, 220px) 90px;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 11px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-gutter);
  color: var(--vp-c-text-1);
  text-decoration: none !important;
  transition: border-color 0.15s;
}
.xdt-row:hover {
  border-color: var(--vp-c-divider);
}
.xdt-row .xdt-method {
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}
.xdt-row-path {
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: none;
  padding: 0;
  border-radius: 0;
}
.xdt-row-path-short {
  display: none;
}
.xdt-row-sum {
  font-size: 12px;
  color: var(--vp-c-text-2);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Below ~760 px of column the one-liner has no room (the frame gives it the
   leftover 1fr); drop it rather than print a stray ellipsis. Placed after the
   base rule on purpose — same specificity, source order decides. */
@container (max-width: 760px) {
  .xdt-row {
    grid-template-columns: 50px minmax(0, 1fr) minmax(120px, 220px) 90px;
  }
  .xdt-row-sum {
    display: none;
  }
}

@media (max-width: 767px) {
  .xdt-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    min-height: 44px;
    padding: 0 10px;
    gap: 8px;
  }
  .xdt-row-sum,
  .xdt-row :deep(.xdt-live-meta),
  .xdt-row :deep(.xdt-live-name),
  .xdt-row :deep(.xdt-live-count-rest) {
    display: none;
  }
  .xdt-row-path-full {
    display: none;
  }
  .xdt-row-path-short {
    display: inline;
  }
  .xdt-row-path {
    font-size: 11.5px;
  }
  .xdt-row :deep(.xdt-swatch) {
    width: 12px;
    flex-basis: 12px;
  }
  .xdt-row :deep(.xdt-swatch:nth-child(n + 7)) {
    display: none;
  }
  .xdt-row :deep(.xdt-live-err) {
    max-width: 110px;
  }
}
</style>
