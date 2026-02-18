# Discord Bot Migration to Cloudflare Workers

**Date:** December 7, 2025
**Status:** In Progress - Phase 1 (Core Commands)
**Author:** Claude Code Assistant
**Last Updated:** December 7, 2025

---

## Executive Summary

This document outlines a potential migration of the XIV Dye Tools Discord Bot from traditional server hosting (PebbleHost) to Cloudflare Workers, using a hybrid approach with photon-wasm for image processing and SVG generation for vector graphics.

### Motivation

The current PebbleHost hosting does not support inbound HTTP connections, preventing the Worker → Bot webhook notification system from functioning. Rather than working around this limitation, we're evaluating a full architectural shift to Cloudflare Workers using Discord's HTTP Interactions model.

### Key Documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Current vs proposed architecture comparison |
| [TECHNOLOGY_STACK.md](./TECHNOLOGY_STACK.md) | photon-wasm, SVG, color extraction analysis |
| [MIGRATION_PHASES.md](./MIGRATION_PHASES.md) | Phased implementation plan |
| [RISK_ASSESSMENT.md](./RISK_ASSESSMENT.md) | Risks and mitigation strategies |
| [COST_ANALYSIS.md](./COST_ANALYSIS.md) | Cost comparison between approaches |
| [FONTS.md](./FONTS.md) | Font strategy (Space Grotesk + Onest + Habibi) |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Secrets & config management |

---

## Quick Decision Matrix

| Approach | Effort | Risk | Cost | Recommendation |
|----------|--------|------|------|----------------|
| **A: Full Workers Migration** | High | Medium | Low | Long-term best |
| **B: Hybrid (Keep PebbleHost)** | Low | Low | Medium | Quick fix |
| **C: Alternative Host** | Medium | Low | Medium | Middle ground |

---

## Current Problem

```
Web App → Worker → Bot (PebbleHost)
                    ↑
                    ✗ BLOCKED
                    Error 1003: Direct IP Access Not Allowed
```

PebbleHost blocks inbound HTTP connections to custom ports, preventing:
- Webhook notifications from Worker to Bot
- Real-time preset submission alerts
- Moderation workflow automation

---

## Proposed Solutions Overview

### Solution A: Full Cloudflare Workers Migration

Move the entire Discord bot to Cloudflare Workers using HTTP Interactions.

**Pros:**
- No server management
- Infinite scaling
- Native integration with existing Worker
- Lower long-term cost

**Cons:**
- Major rewrite required
- Some features need alternatives (image processing)
- Learning curve for HTTP Interactions model

### Solution B: Polling Architecture (Quick Fix)

Keep bot on PebbleHost, but reverse the data flow:

```
Bot polls Worker periodically for new submissions
```

**Pros:**
- Minimal code changes
- Works immediately
- No hosting changes

**Cons:**
- Not real-time (polling delay)
- Wastes API calls when no new submissions
- Doesn't solve underlying architecture limitation

### Solution C: Alternative Hosting

Move bot to a platform that supports inbound HTTP (Railway, Fly.io, Render).

**Pros:**
- Keeps existing codebase
- Push notifications work
- Modern deployment options

**Cons:**
- Migration effort
- New platform to learn
- May have different limitations

---

## Recommended Path Forward

**Phase 1 (Immediate):** Implement polling solution to unblock preset notifications
**Phase 2 (Short-term):** Evaluate alternative hosting options
**Phase 3 (Long-term):** Plan full Workers migration with HTTP Interactions

This approach:
1. Gets the feature working immediately
2. Provides time to properly evaluate the full migration
3. Allows incremental learning and testing

---

## Current Progress

**Phase 0: Foundation** ✅ Complete
- Worker project created and deployed
- Discord HTTP Interactions endpoint configured
- Signature verification working

**Phase 1: Core Commands** ✅ Complete
- [x] /about command
- [x] /harmony command (7 types, SVG wheel, emojis, Facewear filtering)
- [x] /dye command (search, info, list, random subcommands + Facewear filtering)
- [x] /match command (single/multi match, quality scoring, hex+RGB+HSV display)
- [x] /mixer command (gradient SVG, RGB interpolation, dye matching per step)
- [x] /manual command (multi-embed help documentation, ephemeral)

**Phase 2: Image Processing** ⏳ Not Started
- [ ] photon-wasm integration
- [ ] Color extraction (median-cut + k-means fallback)
- [ ] /match_image command
- [ ] /accessibility command

---

## Next Steps

1. [x] ~~Review all documentation in this folder~~
2. [x] ~~Decide on approach~~ → Full Workers Migration (Solution A)
3. [x] ~~Create proof-of-concept~~ → /harmony command working
4. [x] ~~Implement /dye command with subcommands~~ → All 4 subcommands working
5. [x] ~~Implement /match command~~ → Single/multi match with quality scoring
6. [x] ~~Implement /mixer command~~ → Gradient SVG with dye matching
7. [x] ~~Implement /manual command~~ → Multi-embed help documentation
8. [ ] Move to Phase 2 (Image Processing)
9. [ ] Implement /match_image command
10. [ ] Implement /accessibility command

---

## Related Documentation

- [COMMUNITY_PRESETS_SPEC.md](../COMMUNITY_PRESETS_SPEC.md) - Original preset feature specification
- [xivdyetools-worker](../../xivdyetools-worker/) - Existing Cloudflare Worker
- [xivdyetools-discord-bot](../../xivdyetools-discord-bot/) - Current Discord bot
