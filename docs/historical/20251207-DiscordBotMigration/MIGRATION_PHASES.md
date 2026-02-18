# Migration Phases

This document outlines a phased approach to migrating the XIV Dye Tools Discord bot from PebbleHost (Gateway) to Cloudflare Workers (HTTP Interactions).

---

## Current Status (2024-12-07)

| Phase | Status | Completion |
|-------|--------|------------|
| **Phase 0: Foundation** | ✅ Complete | 100% |
| **Phase 1: Core Commands** | ✅ Complete | 100% |
| **Phase 2: Image Processing** | ✅ Complete | 95% (benchmarks pending) |
| **Phase 3: Full Parity** | ✅ Complete | 95% (/preset deferred) |
| **Phase 4: Cutover** | 🔄 Ready | 0% |

### Recent Accomplishments
- Full bot UI localization (6 locales: en, ja, de, fr, ko, zh)
- Dye name localization via xivdyetools-core LocalizationService
- Category name localization in all commands
- All 11 commands migrated and localized
- Button interactions and autocomplete working
- Rate limiting and user preferences via KV
- Image processing with K-means color extraction

### Remaining Items
- [ ] Performance benchmarks documentation
- [ ] /preset command (deferred to post-migration)
- [ ] Phase 4 cutover tasks

---

## Overview

The migration is divided into 5 phases, designed to:
- Minimize risk through incremental changes
- Allow rollback at each phase
- Maintain bot availability throughout
- Validate each component before proceeding

**Estimated Total Duration:** 4-6 weeks

---

## Phase 0: Foundation Setup
**Duration:** 2-3 days
**Risk Level:** Low
**Rollback:** Delete Worker, no impact to existing bot

### Objectives
- Create new Worker project
- Set up Discord application for HTTP Interactions
- Implement basic interaction handling
- Deploy "Hello World" command

### Tasks

#### 0.1 Create New Worker Project
```bash
cd XIVProjects
npx wrangler init xivdyetools-discord-worker
```

**Project Structure:**
```
xivdyetools-discord-worker/
├── src/
│   ├── index.ts           # Main entry point
│   ├── handlers/          # Command handlers
│   ├── services/          # Business logic
│   ├── utils/             # Utilities
│   └── types/             # TypeScript types
├── wrangler.toml
├── package.json
└── tsconfig.json
```

#### 0.2 Configure Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select existing bot application OR create test application
3. Navigate to "General Information"
4. Set "Interactions Endpoint URL" to Worker URL (after deployment)
5. Note the Public Key for signature verification

#### 0.3 Implement Signature Verification
```typescript
// src/utils/verify.ts
import { verifyKey } from 'discord-interactions';

export async function verifyDiscordRequest(
  request: Request,
  publicKey: string
): Promise<{ isValid: boolean; body: string }> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const body = await request.text();

  if (!signature || !timestamp) {
    return { isValid: false, body };
  }

  const isValid = verifyKey(body, signature, timestamp, publicKey);
  return { isValid, body };
}
```

#### 0.4 Implement Basic Handler
```typescript
// src/index.ts
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { verifyDiscordRequest } from './utils/verify';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { isValid, body } = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);

    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const interaction = JSON.parse(body);

    // Handle PING (required for Discord verification)
    if (interaction.type === InteractionType.PING) {
      return Response.json({ type: InteractionResponseType.PONG });
    }

    // Handle commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      return handleCommand(interaction, env);
    }

    return new Response('Unknown interaction type', { status: 400 });
  }
};
```

#### 0.5 Deploy and Verify
```bash
wrangler deploy
# Note the deployed URL

# Set Discord Interactions Endpoint URL to:
# https://xivdyetools-discord-worker.<subdomain>.workers.dev
```

### Deliverables
- [x] Worker project created ✅ (2024-12-07)
- [x] Signature verification working ✅ (2024-12-07)
- [x] PING/PONG response working ✅ (2024-12-07)
- [x] Discord endpoint URL configured ✅ (2024-12-07)
- [x] Test command responding ✅ (2024-12-07)

### Rollback Plan
- Delete Worker deployment
- Remove Interactions Endpoint URL from Discord app
- Existing Gateway bot unaffected

---

## Phase 1: Core Command Migration
**Duration:** 1-2 weeks
**Risk Level:** Medium
**Rollback:** Unregister Worker commands, Gateway bot continues

### Objectives
- Implement SVG generation engine
- Migrate simple commands (/about, /manual)
- Migrate color-only commands (/harmony, /match, /dye)
- Set up R2 for image hosting

### Tasks

#### 1.1 SVG Generation Engine
Create reusable SVG generators for all visual outputs.

```typescript
// src/services/svg/
├── base.ts          # Base SVG utilities
├── harmony-wheel.ts # Harmony wheel generator
├── swatch-grid.ts   # Color swatch grids
├── gradient-bar.ts  # Gradient visualizations
└── index.ts         # Exports
```

#### 1.2 R2 Storage Setup
```toml
# wrangler.toml
[[r2_buckets]]
binding = "IMAGES"
bucket_name = "xivdyetools-images"
```

```typescript
// src/services/image-store.ts
export async function storeImage(
  env: Env,
  imageId: string,
  content: Uint8Array,
  contentType: string
): Promise<string> {
  await env.IMAGES.put(`images/${imageId}.png`, content, {
    httpMetadata: { contentType }
  });

  return `https://r2.xivdyetools.com/images/${imageId}.png`;
}
```

#### 1.3 Integrate xivdyetools-core
```bash
npm install xivdyetools-core
```

```typescript
// src/services/dye-service.ts
import { DyeService, dyeDatabase, ColorService } from 'xivdyetools-core';

export const dyeService = new DyeService(dyeDatabase);
export const colorService = new ColorService();
```

#### 1.4 Migrate Commands

**Priority Order:**
1. `/about` - Static text, no images
2. `/manual` - Static text, no images
3. `/dye` - Single dye lookup, simple swatch
4. `/match` - Color matching, swatch output
5. `/harmony` - Harmony generation, wheel output

**Example: /harmony command**
```typescript
// src/handlers/harmony.ts
export async function handleHarmony(
  interaction: Interaction,
  env: Env
): Promise<Response> {
  const colorOption = interaction.data.options.find(o => o.name === 'color');
  const color = colorOption?.value as string;

  // Parse color
  const rgb = colorService.hexToRgb(color);

  // Find harmony dyes
  const harmonies = dyeService.findHarmonyDyes(rgb, 'triadic');

  // Generate SVG
  const svg = generateHarmonyWheel(harmonies);

  // Convert to PNG
  const png = await svgToPng(svg);

  // Store in R2
  const imageId = crypto.randomUUID();
  const imageUrl = await storeImage(env, imageId, png, 'image/png');

  // Build response
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🎨 Color Harmony',
        image: { url: imageUrl },
        color: parseInt(color.slice(1), 16)
      }]
    }
  });
}
```

#### 1.5 Command Registration
```typescript
// scripts/register-commands.ts
const commands = [
  {
    name: 'harmony',
    description: 'Find harmonious dye combinations',
    options: [
      {
        name: 'color',
        description: 'Base color (hex or dye name)',
        type: 3, // STRING
        required: true
      }
    ]
  },
  // ... more commands
];

// Register with Discord API
await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bot ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(commands)
});
```

### Deliverables
- [x] SVG generation engine complete ✅ (2024-12-07) - base.ts, harmony-wheel.ts, gradient.ts, renderer.ts
- [x] Image hosting configured ✅ (2024-12-07) - Using Discord file attachments instead of R2
- [x] xivdyetools-core integrated ✅ (2024-12-07)
- [x] /about command working ✅ (2024-12-07)
- [x] /manual command working ✅ (2024-12-07) - Multi-embed help documentation, ephemeral
- [x] /dye command working ✅ (2024-12-07) - search, info, list, random subcommands with Facewear filtering
- [x] /match command working ✅ (2024-12-07) - Single/multi match, quality scoring (🎯✨👍⚠️🔍), hex+RGB+HSV
- [x] /mixer command working ✅ (2024-12-07) - Gradient SVG, RGB interpolation, dye matching per step
- [x] /harmony command working ✅ (2024-12-07) - 7 harmony types, SVG wheel visualization
- [x] Discord App Emojis uploaded ✅ (2024-12-07) - 125 dye emojis via upload-emojis.ts script
- [x] Dye emoji integration in harmony embeds ✅ (2024-12-07)
- [x] Facewear dye filtering (core v1.3.6) ✅ (2024-12-07) - Native exclusion of generic Facewear dyes

**Phase 1 Status: ✅ COMPLETE**

### Rollback Plan
- Unregister Worker commands from Discord
- Gateway bot handles all commands
- R2 images remain (cleanup later)

---

## Phase 2: Image Processing Migration
**Duration:** 1-2 weeks
**Risk Level:** Medium-High
**Rollback:** Disable Worker /match_image, Gateway handles it

### Objectives
- Implement photon-wasm integration
- Implement color extraction
- Migrate /match_image command
- Migrate /accessibility command

### Tasks

#### 2.1 photon-wasm Integration
```typescript
// src/services/image-processor.ts
import { PhotonImage, resize } from '@aspect-ratio/photon';

export async function processImage(
  imageBuffer: ArrayBuffer,
  maxWidth: number
): Promise<{ photonImage: PhotonImage; width: number; height: number }> {
  const photonImage = PhotonImage.new_from_byteslice(new Uint8Array(imageBuffer));

  let width = photonImage.get_width();
  let height = photonImage.get_height();

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    height = Math.floor(height * ratio);
    width = maxWidth;
    resize(photonImage, width, height, 1);
  }

  return { photonImage, width, height };
}
```

#### 2.2 Color Extraction (WASM)
```typescript
// src/services/color-extraction.ts
interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage: number;
}

export function extractDominantColors(
  imageData: Uint8Array,
  width: number,
  height: number,
  count: number = 5
): ExtractedColor[] {
  // Convert to pixel array
  const pixels: RGB[] = [];
  for (let i = 0; i < imageData.length; i += 4) {
    pixels.push({
      r: imageData[i],
      g: imageData[i + 1],
      b: imageData[i + 2]
    });
  }

  // Median-cut algorithm
  return medianCut(pixels, count);
}
```

#### 2.3 K-Means Fallback Algorithm
```typescript
// src/services/kmeans-extraction.ts
// Used when median-cut produces poor color separation

export function kMeansExtraction(
  imageData: Uint8Array,
  width: number,
  height: number,
  k: number = 5,
  maxIterations: number = 10
): ExtractedColor[] {
  // Convert to pixel array
  const pixels = imageDataToPixels(imageData, width, height);

  // Initialize centroids randomly
  let centroids = initializeCentroids(pixels, k);

  // Iterate until convergence or max iterations
  for (let i = 0; i < maxIterations; i++) {
    const clusters = assignToClusters(pixels, centroids);
    const newCentroids = calculateCentroids(clusters);

    if (centroidsConverged(centroids, newCentroids)) break;
    centroids = newCentroids;
  }

  // Convert centroids to colors with percentages
  return centroids.map(c => ({
    hex: rgbToHex(c),
    rgb: c,
    percentage: calculatePercentage(c, pixels)
  }));
}
```

#### 2.4 WASM-Only Color Extraction
```typescript
// src/services/color-extraction.ts
export async function extractColors(
  imageBuffer: ArrayBuffer
): Promise<ExtractedColor[]> {
  const { photonImage, width, height } = await processImage(imageBuffer, 200);

  try {
    const imageData = photonImage.get_raw_pixels();

    // Try median-cut first (faster)
    let colors = medianCutExtraction(imageData, width, height, 5);

    // If poor color diversity, try k-means (more accurate)
    if (!hasColorDiversity(colors)) {
      colors = kMeansExtraction(imageData, width, height, 5);
    }

    // If still poor results, return with warning
    if (!hasColorDiversity(colors)) {
      return { colors, warning: 'Color extraction may be imprecise for this image' };
    }

    return { colors, warning: null };

  } finally {
    photonImage.free();
  }
}
```

#### 2.5 Colorblind Simulation
```typescript
// src/services/colorblind-sim.ts
const MATRICES = {
  protanopia: {
    r: [0.567, 0.433, 0.000],
    g: [0.558, 0.442, 0.000],
    b: [0.000, 0.242, 0.758]
  },
  deuteranopia: {
    r: [0.625, 0.375, 0.000],
    g: [0.700, 0.300, 0.000],
    b: [0.000, 0.300, 0.700]
  },
  tritanopia: {
    r: [0.950, 0.050, 0.000],
    g: [0.000, 0.433, 0.567],
    b: [0.000, 0.475, 0.525]
  }
};

export function simulateColorblindness(
  rgb: RGB,
  type: keyof typeof MATRICES
): RGB {
  const matrix = MATRICES[type];
  return {
    r: Math.round(rgb.r * matrix.r[0] + rgb.g * matrix.r[1] + rgb.b * matrix.r[2]),
    g: Math.round(rgb.r * matrix.g[0] + rgb.g * matrix.g[1] + rgb.b * matrix.g[2]),
    b: Math.round(rgb.r * matrix.b[0] + rgb.g * matrix.b[1] + rgb.b * matrix.b[2])
  };
}
```

### Deliverables
- [x] photon-wasm working in Workers ✅ (2024-12-07) - Using @aspect-ratio/photon for image processing
- [x] Color extraction working ✅ (2024-12-07) - Using xivdyetools-core PaletteService with K-means clustering
- [x] K-means fallback algorithm working ✅ (2024-12-07) - Integrated into PaletteService.extractAndMatchPalette()
- [x] /match_image command working ✅ (2024-12-07) - Full implementation with 1-5 color extraction
- [x] /accessibility command working ✅ (2024-12-07) - Colorblind simulation + WCAG contrast matrix
- [x] Image size limits enforced ✅ (2024-12-07) - Validation in validateAndFetchImage()
- [ ] Performance benchmarks documented

**Phase 2 Status: ✅ COMPLETE** (except benchmarks documentation)

### Rollback Plan
- Route /match_image and /accessibility to Gateway bot
- Other commands continue on Worker
- Hybrid state is acceptable

---

## Phase 3: Full Feature Parity
**Duration:** 1 week
**Risk Level:** Medium
**Rollback:** Route specific commands to Gateway

### Objectives
- Migrate remaining commands
- Implement button interactions
- Implement autocomplete
- Migrate rate limiting to KV

### Tasks

#### 3.1 Remaining Commands
- [x] `/mixer` - Color mixing ✅ (2024-12-07) - Moved to Phase 1, gradient SVG with dye matching
- [x] `/comparison` - Side-by-side comparison ✅ (2024-12-07) - Visual diff, distance, contrast ratio
- [x] `/language` - Language preference ✅ (2024-12-07) - User language settings with KV storage
- [x] `/favorites` - User favorites ✅ (2024-12-07) - Add/remove/list favorites with KV storage
- [x] `/collection` - Dye collections ✅ (2024-12-07) - Full CRUD with create/delete/add/remove/show/list/rename
- [ ] `/preset` - Community presets (deferred to post-migration)

#### 3.2 Button Interactions
```typescript
// src/handlers/buttons.ts
export async function handleButton(
  interaction: Interaction,
  env: Env
): Promise<Response> {
  const customId = interaction.data.custom_id;

  if (customId.startsWith('copy_dye:')) {
    return handleCopyDye(interaction, customId);
  }

  if (customId.startsWith('preset_approve:')) {
    return handlePresetApprove(interaction, customId, env);
  }

  // ... more handlers
}
```

#### 3.3 Autocomplete
```typescript
// src/handlers/autocomplete.ts
export async function handleAutocomplete(
  interaction: Interaction,
  env: Env
): Promise<Response> {
  const focusedOption = interaction.data.options.find(o => o.focused);
  const query = focusedOption?.value as string || '';

  // Search dyes
  const matches = dyeService.searchDyes(query).slice(0, 25);

  return Response.json({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: {
      choices: matches.map(dye => ({
        name: `${dye.name} (${dye.hex})`,
        value: dye.id.toString()
      }))
    }
  });
}
```

#### 3.4 Rate Limiting with KV
```typescript
// src/services/rate-limiter.ts
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  userId: string,
  command: string,
  env: Env
): Promise<RateLimitResult> {
  const key = `rate:${userId}:${command}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  const data = await env.KV.get(key, 'json') as { count: number; start: number } | null;

  if (!data || now - data.start > windowMs) {
    // New window
    await env.KV.put(key, JSON.stringify({ count: 1, start: now }), {
      expirationTtl: 120
    });
    return { allowed: true, remaining: 9, resetAt: new Date(now + windowMs) };
  }

  if (data.count >= 10) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(data.start + windowMs)
    };
  }

  await env.KV.put(key, JSON.stringify({ count: data.count + 1, start: data.start }), {
    expirationTtl: 120
  });

  return {
    allowed: true,
    remaining: 10 - data.count - 1,
    resetAt: new Date(data.start + windowMs)
  };
}
```

### Deliverables
- [x] All commands migrated ✅ (2024-12-07) - 11 commands implemented (except /preset, deferred)
- [x] Button interactions working ✅ (2024-12-07) - Copy button handlers in handlers/buttons/
- [x] Autocomplete working ✅ (2024-12-07) - Dye name autocomplete with Facewear filtering
- [x] Rate limiting via KV ✅ (2024-12-07) - Per-user, per-command limits with sliding window
- [x] User preferences via KV ✅ (2024-12-07) - Language, favorites, collections stored in KV
- [x] Full Bot UI Localization ✅ (2024-12-07) - 6 locales (en, ja, de, fr, ko, zh)
- [ ] Feature parity with Gateway bot - Almost complete (missing /preset)

**Phase 3 Status: ✅ COMPLETE** (except /preset command which is deferred)

### Rollback Plan
- Route failing commands to Gateway bot
- Continue running both in parallel
- Debug and fix Worker issues

---

## Phase 4: Cutover and Cleanup
**Duration:** 3-5 days
**Risk Level:** High
**Rollback:** Restore Gateway bot, re-register commands

### Objectives
- Final testing and validation
- Update Discord endpoint permanently
- Shut down Gateway bot
- Cleanup old resources

### Tasks

#### 4.1 Pre-Cutover Checklist
- [ ] All commands tested in production
- [ ] Rate limiting validated
- [ ] Error handling tested
- [ ] Monitoring dashboards ready
- [ ] Rollback procedures documented
- [ ] Team notified

#### 4.2 Cutover Steps
```
Timeline: Execute during low-traffic period (e.g., 3 AM UTC)

1. [T+0m] Announce maintenance in bot status
2. [T+5m] Put Gateway bot in maintenance mode (reject new commands)
3. [T+10m] Wait for in-flight commands to complete
4. [T+15m] Verify Worker is receiving all traffic
5. [T+30m] Monitor error rates
6. [T+60m] If stable, proceed to cleanup
7. [T+24h] Full traffic analysis, declare success
```

#### 4.3 Gateway Bot Shutdown
```bash
# On PebbleHost
pm2 stop xivdyetools-bot
pm2 delete xivdyetools-bot
```

#### 4.4 Cleanup Tasks
- [ ] Delete Gateway bot files from PebbleHost
- [ ] Cancel PebbleHost subscription (if dedicated)
- [ ] Close Redis connection (Upstash)
- [ ] Remove old environment variables
- [ ] Update documentation
- [ ] Archive Gateway bot repository

### Deliverables
- [ ] Worker handling 100% of traffic
- [ ] Gateway bot shut down
- [ ] Old resources cleaned up
- [ ] Documentation updated

### Rollback Plan (Emergency)
```
If critical issues occur:

1. Re-deploy Gateway bot to PebbleHost
2. Start Gateway bot: pm2 start ecosystem.config.js
3. Remove Interactions Endpoint URL from Discord app
   (Gateway will resume handling commands)
4. Investigate Worker issues
5. Fix and retry cutover
```

---

## Phase Summary

| Phase | Duration | Risk | Dependencies |
|-------|----------|------|--------------|
| Phase 0: Foundation | 2-3 days | Low | None |
| Phase 1: Core Commands | 1-2 weeks | Medium | Phase 0 |
| Phase 2: Image Processing | 1-2 weeks | Medium-High | Phase 1 |
| Phase 3: Full Parity | 1 week | Medium | Phase 2 |
| Phase 4: Cutover | 3-5 days | High | Phase 3 |

**Total Estimated Duration:** 4-6 weeks

---

## Success Criteria

### Phase 0
- Discord verifies Worker endpoint (PING/PONG)
- Test command responds correctly

### Phase 1
- 5 commands working with <500ms response time
- Images display correctly in Discord
- No errors in Cloudflare dashboard

### Phase 2
- /match_image processes images <3 seconds
- Color extraction accuracy >90%
- Memory usage stays under 128MB

### Phase 3
- All 15 commands working
- Button interactions responsive
- Autocomplete responds in <100ms

### Phase 4
- Zero downtime during cutover
- Error rate <0.1% after 24 hours
- User feedback positive

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| WASM performance issues | Pre-test with real images, k-means fallback |
| Discord rate limits | Implement proper rate limiting, defer responses |
| R2 latency | Use edge caching, regional buckets |
| Memory limits | Profile memory usage, optimize image processing |
| Signature verification fails | Thorough testing, proper key management |

---

## Post-Migration Monitoring

### Metrics to Track
- Response latency (p50, p95, p99)
- Error rate by command
- Memory usage per request
- R2 storage growth
- KV read/write operations
- K-means fallback rate

### Alerts to Configure
- Error rate > 1%
- p99 latency > 5s
- Worker exceptions
- R2 storage > 80%
- K-means fallback > 50%
