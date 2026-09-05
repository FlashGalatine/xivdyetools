<script setup lang="ts">
import { withBase } from 'vitepress'
import BaseUrl from './BaseUrl.vue'
import Glyph from './Glyph.vue'
import JsonView from './JsonView.vue'

// Home (API Docs Directions 1b, kept verbatim by 1d): label, headline,
// one-liner, base URL, the two actions, and a sample envelope beside them —
// labelled as a sample, since nothing on this page fetches. Seven tiles below;
// a glyph only where a tool exists.
const SAMPLE = {
  success: true,
  data: {
    stainID: 1,
    itemID: 5729,
    name: 'Snow White',
    hex: '#e4dfd0',
    category: 'Neutral',
    acquisition: 'Dye Vendor',
    cost: 216,
    currency: 'Gil',
    consolidationType: 'A',
    marketItemID: 52254,
  },
  meta: { requestId: '9f2c…', apiVersion: 'v1' },
}

type GlyphName = 'extractor' | 'swatch' | 'globe'

const FEATURES: { title: string; details: string; glyph: GlyphName | null }[] = [
  {
    title: 'Full Dye Database',
    details: '125 standard dyes (schema v2, stainID-keyed). Hex, RGB, HSV, categories, acquisition methods, vendor costs, and Patch 7.5 consolidation groups.',
    glyph: null,
  },
  {
    title: 'Color Matching',
    details: 'Find the closest FFXIV dye to any hex color using six distance methods — CIEDE2000 (default), Oklab, CIE76, redmean, RGB, and distinguishability %.',
    glyph: 'extractor',
  },
  {
    title: 'No Auth Required',
    details: 'Every endpoint is anonymous. Open CORS — callable from any browser, Dalamud plugin, Discord bot, or mobile app.',
    glyph: null,
  },
  {
    title: 'Edge Cached',
    details: 'Deployed globally on Cloudflare Workers. Dye data is cached 1 hour in browsers and 24 hours at the edge.',
    glyph: null,
  },
  {
    title: '6 Languages',
    details: 'Dye names available in English, Japanese, German, French, Korean, and Chinese via the locale query parameter.',
    glyph: 'globe',
  },
  {
    title: 'Consistent Envelopes',
    details: 'Every /v1 response uses the same { success, data, meta } envelope with typed error codes and per-request UUIDs for easy debugging.',
    glyph: null,
  },
  {
    title: 'Character Equipment',
    details: 'Resolve the gear in a .chara file to real items — one search per file, icons proxied, six languages — and read its dyes as stain IDs.',
    glyph: 'swatch',
  },
]
</script>

<template>
  <div class="xdt-home">
    <div class="xdt-hero">
      <div class="xdt-hero-copy">
        <span class="xdt-eyebrow">Public REST API · No auth · v1</span>
        <h1 class="xdt-hero-h1">FFXIV dye data, served from the edge.</h1>
        <p class="xdt-hero-sub">125 standard dyes, color matching, and localization in 6 languages. No auth required.</p>
        <BaseUrl />
        <div class="xdt-hero-actions">
          <a class="xdt-btn xdt-btn--primary" :href="withBase('/guide/')">Quick Start</a>
          <a class="xdt-btn xdt-btn--secondary" :href="withBase('/reference/')">API Reference</a>
        </div>
      </div>
      <div class="xdt-hero-card">
        <div class="xdt-hero-card-hd">
          <span class="xdt-method">GET</span>
          <code class="xdt-hero-card-path">/v1/dyes/1</code>
          <span class="xdt-hero-card-meta">200 · sample</span>
        </div>
        <div class="xdt-hero-card-body">
          <JsonView :value="SAMPLE" />
        </div>
      </div>
    </div>

    <div class="xdt-tiles">
      <div v-for="f in FEATURES" :key="f.title" class="xdt-tile">
        <Glyph v-if="f.glyph" :name="f.glyph" :size="22" />
        <span class="xdt-tile-title">{{ f.title }}</span>
        <span class="xdt-tile-details">{{ f.details }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xdt-home {
  max-width: 1312px;
  margin: 0 auto;
  padding: 60px 64px 96px;
}
.xdt-hero {
  display: grid;
  grid-template-columns: minmax(0, 640px) minmax(0, 1fr);
  gap: 56px;
  align-items: start;
}
.xdt-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.xdt-eyebrow {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--vp-c-brand-2);
}
.xdt-hero-h1 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 46px;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
  text-wrap: pretty;
  margin: 0;
}
.xdt-hero-sub {
  font-size: 17px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  text-wrap: pretty;
  margin: 0;
}
.xdt-hero-copy :deep(.xdt-base) {
  margin: 6px 0 0;
  max-width: none;
}
.xdt-hero-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.xdt-hero-card {
  border-radius: 14px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  margin-top: 8px;
}
.xdt-hero-card-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-gutter);
}
.xdt-hero-card-path {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-1);
  flex: 1;
  background: none;
  padding: 0;
}
.xdt-hero-card-meta {
  font-family: var(--vp-font-family-mono);
  font-size: 10.5px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}
.xdt-hero-card-body {
  padding: 14px 16px;
  overflow-x: auto;
}

.xdt-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding-top: 52px;
}
.xdt-tile {
  background: var(--vp-c-bg-soft);
  border-radius: 13px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--vp-c-gutter);
  min-height: 118px;
}
.xdt-tile-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
  color: var(--vp-c-text-1);
}
.xdt-tile-details {
  font-size: 12px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
  text-wrap: pretty;
}

@media (max-width: 1023px) {
  .xdt-home {
    padding: 40px 32px 80px;
  }
  .xdt-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
  .xdt-hero-h1 {
    font-size: 38px;
  }
  .xdt-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-top: 36px;
  }
}
@media (max-width: 639px) {
  .xdt-home {
    padding: 30px 20px 64px;
  }
  .xdt-hero-h1 {
    font-size: 32px;
    line-height: 1.1;
  }
  .xdt-hero-sub {
    font-size: 15px;
  }
  .xdt-hero-actions .xdt-btn {
    flex: 1;
    justify-content: center;
    height: 46px;
  }
  .xdt-hero-card {
    display: none;
  }
  .xdt-tiles {
    gap: 8px;
    padding-top: 26px;
  }
  .xdt-tile {
    padding: 12px;
    min-height: 96px;
    gap: 6px;
  }
  .xdt-tile-title {
    font-size: 13px;
  }
  .xdt-tile-details {
    font-size: 10.5px;
  }
}
</style>
