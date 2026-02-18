# Performance Optimization Plan
## xivdyetools-core & xivdyetools-discord-bot

**Date:** November 23, 2025  
**Status:** Planning Phase

---

## Executive Summary

This document outlines performance optimization opportunities for the XIVDyeTools ecosystem, focusing on both the core library (`xivdyetools-core`) and the Discord bot (`xivdyetools-discord-bot`). The analysis identified several areas for improvement in computational efficiency, memory usage, caching strategies, and algorithm optimization.

---

## 1. xivdyetools-core Optimizations

### 1.1 ColorService Performance

#### Issue: Repeated Color Conversions
**Location:** `src/services/ColorService.ts`

**Current Behavior:**
- Color conversions (hex→RGB→HSV) are performed repeatedly for the same colors
- No memoization of expensive conversions
- Colorblindness simulation matrices are recalculated on each invocation

**Recommended Actions:**

1. **Implement Result Caching**
   - Add LRU cache for color conversions (max 1000 entries)
   - Cache colorblindness simulation results by `${hex}_${visionType}` key
   - Expected improvement: 60-80% reduction in repeated calculations

2. **Pre-compute Transformation Matrices**
   - Store colorblindness transformation matrices as static constants
   - Currently recalculated on every `simulateColorblindness()` call
   - Improvement: Eliminate 100+ operations per call

3. **Optimize RGB→HSV Conversion**
   ```typescript
   // Current: Multiple Math.min/max calls
   // Optimized: Single-pass min/max calculation
   const max = Math.max(r, g, b);
   const min = Math.min(r, g, b);
   const delta = max - min;
   ```

**Priority:** High  
**Estimated Impact:** 30-50% performance improvement for color-heavy operations

---

### 1.2 DyeService Database Queries

#### Issue: Linear Search for Dye Lookups
**Location:** `src/services/DyeService.ts`

**Current Behavior:**
- `findClosestDye()` performs O(n) linear search through all dyes
- No spatial indexing for color-space queries
- Harmony functions call multiple linear searches

**Recommended Actions:**

1. **Implement Color Space Indexing**
   - Build k-d tree or octree for color space (RGB or HSV)
   - Index dyes by hue buckets (0-359°) for harmony lookups
   - Reduce search complexity from O(n) to O(log n)

2. **Pre-compute Common Harmonies**
   - Cache harmony results for popular base colors
   - Store top 100 most-used dye combinations
   - TTL: 24 hours

3. **Optimize `findHarmonyDyesByOffsets()`**
   - Current: Searches entire database for each offset
   - Optimized: Use hue-indexed map for direct lookups
   - Example: For triadic (±120°), query hue buckets directly

**Priority:** High  
**Estimated Impact:** 70-90% reduction in harmony lookup time

---

### 1.3 Memory Footprint

#### Issue: Large Dye Database in Memory
**Current State:**
- Full dye database loaded in memory (~125 dyes × metadata)
- Defensive copies created by `getAllDyes()`

**Recommended Actions:**

1. **Lazy Loading Strategy**
   - Load only required dye properties initially
   - Defer loading full metadata (prices, categories) until needed
   - Reduce initial footprint by ~40%

2. **Immutable Data Structures**
   - Replace defensive copies with Object.freeze()
   - Use ReadonlyArray<Dye> return types
   - Eliminate unnecessary cloning overhead

**Priority:** Medium  
**Estimated Impact:** 30-40% memory reduction

---

## 2. xivdyetools-discord-bot Optimizations

### 2.1 Image Processing Pipeline

#### Issue: Synchronous Image Processing
**Location:** `src/commands/match-image.ts`, renderers

**Current Behavior:**
- Sharp/Canvas operations block the event loop
- No concurrency limits on image processing
- Missing image size pre-validation

**Recommended Actions:**

1. **Implement Worker Threads**
   - Move Sharp/Canvas operations to worker pool
   - Limit concurrent workers to CPU cores - 1
   - Prevent event loop blocking

2. **Early Size Validation**
   - Check image dimensions before full processing
   - Reject oversized images early (>8MB configured limit)
   - Add resolution limits (e.g., 4096×4096 max)

3. **Optimize Color Sampling**
   ```typescript
   // Current: Sample every pixel
   // Optimized: Downsample to 256×256 before dominant color extraction
   const thumbnail = await sharp(buffer)
     .resize(256, 256, { fit: 'inside' })
     .toBuffer();
   ```

**Priority:** High  
**Estimated Impact:** 50-70% faster image command response times

---

### 2.2 Redis Cache Strategy

#### Issue: Inefficient Cache Usage
**Location:** `src/services/redis-cache.ts`

**Current Behavior:**
- Fixed 5-minute TTL for all cache entries
- No cache warming for popular dyes
- Memory fallback uses Map without LRU eviction

**Recommended Actions:**

1. **Dynamic TTL by Command Type**
   ```typescript
   {
     harmony: 3600,    // 1 hour (stable results)
     match: 1800,      // 30 minutes
     mixer: 300,       // 5 minutes (personalized)
     stats: 86400      // 24 hours
   }
   ```

2. **Implement LRU Eviction for Memory Cache**
   - Use `lru-cache` package (zero dependencies)
   - Max 500 entries in memory fallback
   - Prevent unbounded memory growth

3. **Cache Warming on Startup**
   - Pre-compute harmonies for top 20 dyes by usage
   - Store in Redis with long TTL (24h)
   - Reduce cold-start latency

**Priority:** High  
**Estimated Impact:** 40-60% cache hit rate improvement

---

### 2.3 Rate Limiter Efficiency

#### Issue: Redis Round-trips
**Location:** `src/services/rate-limiter.ts`

**Current Behavior:**
- 3 separate Redis calls per command (user, hourly, global)
- No request batching
- TTL check requires additional round-trip

**Recommended Actions:**

1. **Use Redis Pipeline**
   ```typescript
   const pipeline = redis.pipeline();
   pipeline.incr(`ratelimit:user:${userId}:minute`);
   pipeline.incr(`ratelimit:user:${userId}:hour`);
   pipeline.incr('ratelimit:global:minute');
   const results = await pipeline.exec();
   ```

2. **Lua Script for Atomic Operations**
   - Combine INCR + EXPIRE + TTL in single Lua script
   - Reduce 3 round-trips to 1
   - Eliminate race conditions

**Priority:** Medium  
**Estimated Impact:** 60-70% reduction in rate limit check latency

---

### 2.4 Command Registration

#### Issue: Redundant Global Command Deployment
**Location:** `deploy-commands.ts`

**Current Behavior:**
- Re-registers all commands on every deployment
- No change detection
- ~2-5 seconds delay per deployment

**Recommended Actions:**

1. **Implement Command Hash Comparison**
   - Store SHA-256 hash of command definitions
   - Only re-register if hash changed
   - Skip unnecessary API calls

2. **Guild vs Global Commands**
   - Use guild commands for testing/staging
   - Reserve global commands for production
   - Instant updates in development

**Priority:** Low  
**Estimated Impact:** 80-90% faster development iteration

---

## 3. Database & Data Loading

### 3.1 Dye Database Format

#### Issue: JSON Parsing Overhead
**Location:** `xivdyetools-core/src/data/colors_xiv.json`

**Current Behavior:**
- Large JSON file parsed on every initialization
- No compression or binary format

**Recommended Actions:**

1. **Use MessagePack for Binary Encoding**
   - Reduce database size by 30-40%
   - Faster parsing than JSON
   - Keep JSON for development/debugging

2. **Separate Metadata from Core Data**
   - Split into `dyes-core.json` (id, name, hex, hsv)
   - And `dyes-meta.json` (prices, categories, descriptions)
   - Load metadata on-demand

**Priority:** Low  
**Estimated Impact:** 20-30% faster startup time

---

## 4. Infrastructure & Deployment

### 4.1 Dockerfile Optimization

#### Issue: Large Image Size
**Location:** `xivdyetools-discord-bot/Dockerfile`

**Current State:**
- Multi-stage build ✅
- But includes all npm dev dependencies in builder stage
- Final image: ~250MB

**Recommended Actions:**

1. **Optimize Alpine Dependencies**
   ```dockerfile
   # Use alpine with prebuilt binaries where possible
   RUN apk add --no-cache --virtual .build-deps \
       python3 make g++ cairo-dev jpeg-dev pango-dev
   # Remove after build
   RUN apk del .build-deps
   ```

2. **Use .dockerignore**
   - Exclude node_modules, .git, test files
   - Reduce build context size

**Priority:** Medium  
**Estimated Impact:** 20-30% smaller image size, faster deployments

---

### 4.2 Health Check Endpoint

#### Issue: Minimal Telemetry
**Location:** `src/index.ts` - `/health` endpoint

**Current Behavior:**
- Only returns uptime and guild count
- No performance metrics

**Recommended Actions:**

1. **Add Performance Metrics**
   ```typescript
   {
     uptime: uptimeSeconds,
     guilds: client.guilds.cache.size,
     memory: process.memoryUsage(),
     eventLoop: getEventLoopLag(),
     cacheHitRate: analytics.getCacheHitRate(),
     avgResponseTime: analytics.getAvgResponseTime()
   }
   ```

2. **Implement `/metrics` Prometheus Endpoint**
   - Expose metrics for Grafana/monitoring
   - Track command latency, error rates, cache performance

**Priority:** Medium  
**Estimated Impact:** Improved observability for performance tuning

---

## 5. Recommended Benchmarks

### 5.1 Core Service Benchmarks

**Create:** `xivdyetools-core/benchmarks/`

```typescript
// color-conversions.bench.ts
benchmark('Color conversions', () => {
  bench('hexToRgb', () => ColorService.hexToRgb('#FF5733'));
  bench('rgbToHsv', () => ColorService.rgbToHsv(255, 87, 51));
  bench('simulateColorblindness', () => 
    ColorService.simulateColorblindness({ r: 255, g: 87, b: 51 }, 'protanopia')
  );
});

// dye-search.bench.ts
benchmark('Dye search operations', () => {
  bench('findClosestDye', () => dyeService.findClosestDye('#FF5733'));
  bench('findTriadicDyes', () => dyeService.findTriadicDyes('#FF5733'));
  bench('findMonochromaticDyes', () => dyeService.findMonochromaticDyes('#FF5733'));
});
```

**Baseline Targets:**
- Color conversions: <0.1ms per operation
- Dye search: <5ms for findClosestDye
- Harmony generation: <10ms for triadic/tetradic

---

### 5.2 Bot Command Benchmarks

**Create:** `xivdyetools-discord-bot/benchmarks/`

```typescript
// command-latency.bench.ts
benchmark('Command execution', () => {
  bench('/match command', async () => {
    await matchCommand.execute(mockInteraction);
  });
  bench('/harmony command', async () => {
    await harmonyCommand.execute(mockInteraction);
  });
});
```

**SLA Targets:**
- Simple commands (dye, stats): <500ms
- Medium commands (match, comparison): <1500ms
- Heavy commands (harmony, accessibility): <3000ms
- Image processing: <5000ms

---

## 6. Monitoring & Profiling

### 6.1 Application Performance Monitoring

**Recommended Tools:**

1. **Sentry Performance Monitoring**
   - Already have error webhook setup
   - Add performance tracing
   - Track slow transactions

2. **Custom Analytics Service**
   - Extend `src/services/analytics.ts`
   - Track P50, P95, P99 latencies per command
   - Store in Redis, expose via `/metrics`

3. **Node.js Profiling**
   ```bash
   # CPU profiling
   node --cpu-prof dist/index.js
   
   # Memory profiling
   node --heap-prof dist/index.js
   ```

**Priority:** Medium  
**Timeline:** Implement during optimization phase

---

## 7. Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)
- [ ] Implement color conversion caching in ColorService
- [ ] Add Redis pipeline to rate limiter
- [ ] Optimize image processing (downsampling)
- [ ] Dynamic cache TTLs

### Phase 2: Algorithmic Improvements (2-3 weeks)
- [ ] Implement hue-indexed map for DyeService
- [ ] k-d tree for color space queries
- [ ] Worker threads for image processing
- [ ] LRU cache for memory fallback

### Phase 3: Infrastructure (1-2 weeks)
- [ ] Dockerfile optimization
- [ ] Prometheus metrics endpoint
- [ ] Benchmark suite implementation
- [ ] APM integration

### Phase 4: Advanced Optimizations (2-3 weeks)
- [ ] MessagePack for dye database
- [ ] Precomputed harmony cache
- [ ] Command deployment optimization
- [ ] Load testing & tuning

---

## 8. Success Metrics

### Key Performance Indicators

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| `/match` response time | ~2000ms | <1500ms | P95 latency |
| `/harmony` response time | ~1800ms | <1000ms | P95 latency |
| Color conversion (1000 ops) | ~150ms | <50ms | Benchmark suite |
| Dye search (findClosest) | ~8ms | <3ms | Benchmark suite |
| Cache hit rate | ~35% | >60% | Redis analytics |
| Memory usage (bot) | ~180MB | <140MB | Process metrics |
| Docker image size | ~250MB | <180MB | Image inspect |
| Deployment time | ~45s | <30s | CI/CD pipeline |

---

## 9. Testing Strategy

### Performance Regression Prevention

1. **Automated Benchmarks in CI**
   - Run benchmark suite on every PR
   - Fail if regression >10% from baseline
   - Store results in GitHub artifacts

2. **Load Testing**
   - Simulate 100 concurrent users
   - 500 commands/minute sustained
   - Monitor for memory leaks

3. **Production Monitoring**
   - Alert if P95 latency exceeds targets
   - Weekly performance review
   - Monthly optimization sprints

---

## 10. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking changes in ColorService API | High | Low | Comprehensive test suite, semantic versioning |
| Cache invalidation bugs | Medium | Medium | TTL-based expiration, manual clear endpoint |
| Worker thread overhead | Low | Low | Benchmark before/after, configurable workers |
| Redis outage affecting performance | Medium | Low | Memory fallback already implemented |
| k-d tree implementation complexity | Medium | Medium | Use proven library (e.g., `kd-tree-javascript`) |

---

## Appendix A: Profiling Results

*To be populated after baseline profiling*

## Appendix B: Benchmark Data

*To be populated after benchmark suite implementation*

---

**Document Owner:** XIV Dye Tools Team  
**Last Updated:** November 23, 2025  
**Next Review:** December 15, 2025
