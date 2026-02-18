# Architecture Comparison

## Current Architecture (PebbleHost + Gateway Bot)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURRENT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────────────────────────────┐  │
│  │   Discord    │◄───────►│         PebbleHost Server            │  │
│  │   Gateway    │WebSocket│                                      │  │
│  │              │         │  ┌────────────────────────────────┐  │  │
│  └──────────────┘         │  │      Discord.js Bot            │  │  │
│         ▲                 │  │                                │  │  │
│         │                 │  │  • Gateway connection          │  │  │
│    Slash Commands         │  │  • Slash command handlers      │  │  │
│    Button Clicks          │  │  • Button/Modal handlers       │  │  │
│    Autocomplete           │  │  • Image processing (Sharp)    │  │  │
│         │                 │  │  • Canvas rendering            │  │  │
│         ▼                 │  │  • Redis caching               │  │  │
│  ┌──────────────┐         │  │  • Express health server       │  │  │
│  │    Users     │         │  │                                │  │  │
│  └──────────────┘         │  └────────────────────────────────┘  │  │
│                           │              │                        │  │
│                           │              │ ✗ BLOCKED              │  │
│                           │              ▼ (Error 1003)           │  │
│  ┌──────────────┐         │  ┌────────────────────────────────┐  │  │
│  │  Web App     │────────►│  │   Internal Webhook Endpoint   │  │  │
│  │  (Presets)   │         │  │   POST /internal/notify        │  │  │
│  └──────────────┘         │  └────────────────────────────────┘  │  │
│         │                 └──────────────────────────────────────┘  │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Cloudflare Workers (xivdyetools-worker)          │   │
│  │                                                                │   │
│  │  • Presets API (D1 database)                                  │   │
│  │  • Moderation endpoints                                        │   │
│  │  • Profanity filtering                                         │   │
│  │  • OAuth handling                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Bot Runtime | Node.js 20 | JavaScript execution |
| Discord Library | discord.js v14 | Gateway connection, interactions |
| Image Processing | Sharp + Canvas | Color extraction, rendering |
| Caching | Redis (Upstash) | Rate limiting, analytics |
| Database | D1 (via Worker) | Presets storage |
| Hosting | PebbleHost | Server hosting |

### Limitations

1. **No Inbound HTTP** - PebbleHost blocks external HTTP requests
2. **Fixed Resources** - Limited to server allocation
3. **Manual Scaling** - Can't auto-scale with demand
4. **Deployment** - SFTP-based, no CI/CD integration

---

## Proposed Architecture (Cloudflare Workers + HTTP Interactions)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PROPOSED ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │   Discord    │                                                   │
│  │   API        │                                                   │
│  └──────┬───────┘                                                   │
│         │                                                            │
│         │ HTTP POST (Interactions)                                   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Cloudflare Workers (Unified)                     │   │
│  │                                                                │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │              Discord Interactions Handler                │  │   │
│  │  │                                                          │  │   │
│  │  │  • Slash command routing                                 │  │   │
│  │  │  • Button/Modal handling                                 │  │   │
│  │  │  • Autocomplete responses                                │  │   │
│  │  │  • Interaction verification (Ed25519)                    │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  │                          │                                     │   │
│  │         ┌────────────────┼────────────────┐                   │   │
│  │         ▼                ▼                ▼                   │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐      │   │
│  │  │ SVG Engine │  │photon-wasm│  │ Color Extraction   │      │   │
│  │  │            │  │            │  │                    │      │   │
│  │  │ • Harmony  │  │ • Swatches │  │ • Median-cut WASM │      │   │
│  │  │   wheels   │  │ • Colorblind│  │ • API fallback   │      │   │
│  │  │ • Gradients│  │   simulation│  │   (Imagga)       │      │   │
│  │  │ • Labels   │  │ • Resize   │  │                    │      │   │
│  │  └────────────┘  └────────────┘  └────────────────────┘      │   │
│  │                          │                                     │   │
│  │                          ▼                                     │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │                    Shared Services                       │  │   │
│  │  │                                                          │  │   │
│  │  │  • D1 Database (presets, votes, moderation)             │  │   │
│  │  │  • KV Storage (caching, rate limits)                    │  │   │
│  │  │  • Durable Objects (optional: stateful operations)      │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  │                                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         ▲                                                            │
│         │ HTTP (API calls)                                           │
│         │                                                            │
│  ┌──────┴───────┐                                                   │
│  │   Web App    │                                                   │
│  │  (Presets)   │                                                   │
│  └──────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Proposed Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Bot Runtime | Cloudflare Workers | Edge computing |
| Discord Integration | HTTP Interactions | Slash commands, buttons |
| Image Processing | photon-wasm | WASM-based image manipulation |
| Vector Graphics | SVG generation | Harmony wheels, gradients |
| Color Extraction | Median-cut WASM + API | Dominant color detection |
| Caching | Cloudflare KV | Rate limiting, session data |
| Database | D1 | Presets, votes, moderation |

### Advantages

1. **Unified Platform** - Bot and API on same infrastructure
2. **Global Edge** - Low latency worldwide
3. **Auto-scaling** - Handles traffic spikes automatically
4. **No Inbound Restrictions** - Workers receive HTTP natively
5. **Cost Efficient** - Pay per request, not idle time
6. **Simple Deployment** - `wrangler deploy`

---

## Architecture Comparison

| Aspect | Current (PebbleHost) | Proposed (Workers) |
|--------|---------------------|-------------------|
| **Connection Model** | WebSocket (Gateway) | HTTP (Interactions) |
| **Scaling** | Manual | Automatic |
| **Cold Start** | None (always running) | ~5-50ms |
| **Memory** | 2GB+ available | 128MB limit |
| **Execution Time** | Unlimited | 30s limit (standard) |
| **Image Processing** | Sharp (native) | photon-wasm (WASM) |
| **Text Rendering** | Canvas | SVG overlay |
| **Inbound HTTP** | Blocked | Native |
| **Cost Model** | Fixed monthly | Pay-per-request |
| **Deployment** | SFTP upload | CLI (`wrangler`) |

---

## Discord Interaction Models

### Gateway Bot (Current)

```typescript
// Persistent WebSocket connection
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // Handle command
  }
});

// Receives ALL events: messages, reactions, presence, etc.
```

### HTTP Interactions (Proposed)

```typescript
// Stateless HTTP handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Verify Discord signature
    const isValid = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);

    const interaction = await request.json();

    if (interaction.type === InteractionType.PING) {
      return Response.json({ type: 1 }); // PONG
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      // Handle slash command
      return Response.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: { content: 'Hello!' }
      });
    }
  }
};
```

### Key Differences

| Feature | Gateway | HTTP Interactions |
|---------|---------|-------------------|
| Message events | ✅ Yes | ❌ No |
| Presence updates | ✅ Yes | ❌ No |
| Typing indicators | ✅ Yes | ❌ No |
| Slash commands | ✅ Yes | ✅ Yes |
| Buttons/Modals | ✅ Yes | ✅ Yes |
| Autocomplete | ✅ Yes | ✅ Yes |
| Response time | Flexible | 3 second limit* |

*Can defer response for up to 15 minutes with follow-up

---

## Data Flow Comparison

### Current: Preset Submission

```
User submits on Web App
         │
         ▼
Worker receives POST /api/v1/presets
         │
         ▼
Worker calls Bot webhook ──────► BLOCKED (Error 1003)
         │
         ▼
Submission saved but no Discord notification
```

### Proposed: Preset Submission

```
User submits on Web App
         │
         ▼
Worker receives POST /api/v1/presets
         │
         ▼
Worker sends Discord message directly via REST API
         │
         ▼
Message appears in moderation channel with buttons
         │
         ▼
Moderator clicks button
         │
         ▼
Discord POSTs to Worker (HTTP Interaction)
         │
         ▼
Worker updates preset status in D1
         │
         ▼
Worker responds with updated embed
```

---

## Migration Considerations

### What Changes

1. **No persistent connection** - Can't receive arbitrary events
2. **Different interaction model** - Request/response instead of events
3. **Image processing** - WASM instead of native modules
4. **State management** - KV/D1 instead of in-memory + Redis

### What Stays the Same

1. **Slash command UX** - Users see no difference
2. **Button interactions** - Same functionality
3. **Business logic** - Color algorithms, dye database
4. **Data model** - Same D1 schema

### What Gets Better

1. **Webhook notifications** - Work natively
2. **Deployment** - Single `wrangler deploy`
3. **Monitoring** - Cloudflare dashboard
4. **Cost** - Lower for current usage levels
