# Cost Analysis

This document provides a comprehensive cost comparison between the current PebbleHost architecture and the proposed Cloudflare Workers migration.

---

## Executive Summary

| Aspect | Current (PebbleHost) | Proposed (Workers) | Savings |
|--------|---------------------|--------------------|---------|
| **Monthly Cost** | ~$15-25/month | ~$0-5/month | 60-100% |
| **Cost Model** | Fixed | Pay-per-use | Flexible |
| **Scaling Cost** | Step increases | Linear | Better |
| **Idle Cost** | Full price | $0 | Significant |

---

## Current Architecture Costs

### PebbleHost Server

| Item | Cost | Notes |
|------|------|-------|
| Basic Plan | $5/month | 2GB RAM, shared CPU |
| **Recommended Plan** | $10/month | 4GB RAM, dedicated vCPU |
| Premium Plan | $20/month | 8GB RAM, 2 vCPUs |

**Current Plan:** Basic ($5/month) or Recommended ($10/month) based on memory needs for Sharp image processing.

### Redis (Upstash)

| Tier | Cost | Limits |
|------|------|--------|
| Free | $0/month | 10,000 commands/day |
| Pay As You Go | ~$0.20/100k commands | No daily limits |

**Current Usage:** ~2,000-5,000 commands/day → **Free tier**

### Total Current Cost

| Component | Monthly Cost |
|-----------|-------------|
| PebbleHost | $5-10 |
| Upstash Redis | $0 |
| Domain (yearly) | ~$1 (amortized) |
| **Total** | **$6-11/month** |

---

## Proposed Architecture Costs

### Cloudflare Workers

| Resource | Free Tier | Paid ($5/month) | Expected Usage |
|----------|-----------|-----------------|----------------|
| Requests | 100,000/day | 10M/month | ~5,000/day |
| CPU time | 10ms/request | 50ms/request | ~20ms avg |
| Subrequests | 50/request | 1000/request | ~5/request |

**Expected Tier:** Free (100k requests/day far exceeds needs)

### Cloudflare KV

| Resource | Free Tier | Notes |
|----------|-----------|-------|
| Read operations | 100,000/day | Rate limiting, preferences |
| Write operations | 1,000/day | State updates |
| Storage | 1GB | Minimal for KV data |

**Expected Usage:**
- Reads: ~10,000/day (well under limit)
- Writes: ~2,000/day (may need paid tier)

| Tier | Cost |
|------|------|
| Free | $0 |
| Paid | $5/month (includes 10M reads, 1M writes) |

### Cloudflare R2

| Resource | Free Tier | Cost After |
|----------|-----------|------------|
| Storage | 10GB/month | $0.015/GB |
| Class A ops (write) | 1M/month | $4.50/million |
| Class B ops (read) | 10M/month | $0.36/million |

**Expected Usage:**
- Storage: ~500MB-1GB (generated images, auto-expire)
- Writes: ~50,000/month
- Reads: ~100,000/month

**Expected Tier:** Free

### Cloudflare D1 (Already in use)

| Resource | Free Tier | Notes |
|----------|-----------|-------|
| Rows read | 5M/day | Preset queries |
| Rows written | 100k/day | Preset submissions |
| Storage | 5GB | Presets, votes |

**Current Usage:** Well within free tier

### External APIs

**No external APIs required.** Color extraction is handled entirely by WASM (median-cut + k-means algorithms).

This eliminates:
- API cost risks
- External dependencies
- Rate limit concerns
- Network latency

### Total Proposed Cost

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Workers | $0 | Within free tier |
| KV | $0-5 | May need paid for writes |
| R2 | $0 | Within free tier |
| D1 | $0 | Already in use, free |
| External APIs | $0 | None required (WASM-only) |
| **Total** | **$0-5/month** |

---

## Cost Comparison by Usage Level

### Low Usage (Current)
~1,000 commands/day

| Architecture | Monthly Cost |
|--------------|-------------|
| PebbleHost | $5-10 |
| Workers | $0 |
| **Savings** | **$5-10 (100%)** |

### Medium Usage
~10,000 commands/day

| Architecture | Monthly Cost |
|--------------|-------------|
| PebbleHost | $10-15 |
| Workers | $0-5 |
| **Savings** | **$5-15 (50-100%)** |

### High Usage
~50,000 commands/day

| Architecture | Monthly Cost |
|--------------|-------------|
| PebbleHost | $20-30 |
| Workers | $5-10 |
| **Savings** | **$15-20 (50-67%)** |

### Very High Usage
~100,000 commands/day

| Architecture | Monthly Cost |
|--------------|-------------|
| PebbleHost | $40-60 (may need multiple servers) |
| Workers | $10-15 |
| **Savings** | **$30-45 (60-75%)** |

---

## Scaling Cost Comparison

### PebbleHost Scaling

```
Commands/day    Server Tier       Monthly Cost
─────────────────────────────────────────────────
1,000          Basic (2GB)       $5
5,000          Basic (2GB)       $5
10,000         Recommended (4GB) $10
25,000         Premium (8GB)     $20
50,000         Premium + Redis   $30
100,000        Multiple servers  $60+
```

**Pattern:** Step-function scaling, must pay for unused capacity.

### Workers Scaling

```
Commands/day    Tier              Monthly Cost
─────────────────────────────────────────────────
1,000          Free              $0
5,000          Free              $0
10,000         Free              $0
25,000         Free              $0
50,000         Free              $0
100,000        Paid ($5 base)    $5 + ~$3 usage
500,000        Paid              $5 + ~$15 usage
```

**Pattern:** Linear scaling, pay only for what you use.

---

## Cost Breakdown by Feature

### /match_image (Most Resource-Intensive)

| Architecture | Cost Per Request | Notes |
|--------------|-----------------|-------|
| PebbleHost | ~$0.0001 | Amortized server cost |
| Workers (WASM) | ~$0.00001 | CPU time only |

**Optimization Strategy:**
- Median-cut algorithm for most images (~50ms)
- K-means fallback for images with poor color separation (~100-200ms)
- All processing is local - no external API costs

### /harmony, /match (SVG Generation)

| Architecture | Cost Per Request |
|--------------|-----------------|
| PebbleHost | ~$0.00005 |
| Workers | ~$0.000005 |

**Reason:** SVG generation is CPU-efficient, minimal resource usage.

### /preset (Database Operations)

| Architecture | Cost Per Request |
|--------------|-----------------|
| Current | ~$0.00001 (D1 read) |
| Workers | ~$0.00001 (same D1) |

**No change** - D1 already in use.

---

## One-Time Migration Costs

### Development Time

| Task | Estimated Hours | Notes |
|------|-----------------|-------|
| Phase 0: Setup | 4-8 | Project scaffolding |
| Phase 1: Core Commands | 20-30 | SVG engine, 5 commands |
| Phase 2: Image Processing | 20-40 | WASM integration |
| Phase 3: Full Parity | 15-25 | Remaining commands |
| Phase 4: Cutover | 8-12 | Testing, deployment |
| **Total** | **67-115 hours** |

### External Costs

| Item | Cost | Notes |
|------|------|-------|
| External APIs | $0 | None required |
| Additional domains | $0 | Using existing |
| Monitoring tools | $0 | Cloudflare dashboard |
| **Total** | **$0** |

---

## Return on Investment

### Break-Even Analysis

| Scenario | Monthly Savings | Dev Hours | Break-Even |
|----------|----------------|-----------|------------|
| Low usage | $5-10 | 80 | 8-16 months |
| Medium usage | $10-15 | 80 | 5-8 months |
| High usage | $20-30 | 80 | 3-4 months |

**Assumption:** Developer time valued at $0 (personal project) or opportunity cost only.

### Long-Term Value

Beyond cost savings, the migration provides:

| Benefit | Value |
|---------|-------|
| Auto-scaling | Handle traffic spikes without intervention |
| Global edge | Better latency worldwide |
| No maintenance | No server patching, updates |
| Unified platform | Simpler architecture |
| Webhook support | Enables new features |

---

## Cost Risks

### Risk: CPU Time Overuse

If color extraction takes longer than expected, Workers CPU time could accumulate.

| Scenario | Avg CPU Time | Impact |
|----------|--------------|--------|
| Normal (median-cut) | ~50ms | Within free tier |
| Complex images (k-means) | ~150ms | Still within limits |
| Edge cases | ~300ms | May need monitoring |

**Mitigation:**
- Image resize before processing (max 200x200)
- Timeout protection (fail fast if >500ms)
- Monitor CPU time in dashboard

### Risk: R2 Storage Growth

Generated images accumulate if not cleaned up.

| Storage | Monthly Cost |
|---------|-------------|
| 1GB | $0 |
| 10GB | $0 |
| 50GB | $0.60 |
| 100GB | $1.35 |

**Mitigation:**
- Set expiration on generated images (1 hour)
- Use lifecycle rules to auto-delete
- Monitor storage growth

### Risk: KV Write Limits

Rate limiting writes may exceed free tier.

| Writes/Day | Tier | Monthly Cost |
|------------|------|-------------|
| <1,000 | Free | $0 |
| 1,000-10,000 | Paid | $5 |

**Mitigation:**
- Optimize rate limiting window
- Batch writes where possible
- Accept $5/month if needed

---

## Pricing Comparison Table

| Resource | PebbleHost | Cloudflare | Winner |
|----------|------------|------------|--------|
| Compute | $5-20/month fixed | $0-5 pay-per-use | Cloudflare |
| Storage | N/A (ephemeral) | R2 free tier | Cloudflare |
| Caching | $0 (Upstash free) | KV free tier | Tie |
| Database | $0 (D1) | $0 (D1) | Tie |
| Bandwidth | Included | Included | Tie |
| Scaling | Manual + costly | Automatic + cheap | Cloudflare |

---

## Recommendation

### Short-Term (0-3 months)
**Proceed with migration.** The cost savings and operational benefits justify the development effort.

Expected costs:
- Migration: $0 (development time only)
- Operation: $0-5/month

### Medium-Term (3-12 months)
**Stay on free tier.** Monitor usage patterns and optimize as needed.

Expected costs:
- Operation: $0-5/month
- No external API costs (WASM-only approach)

### Long-Term (12+ months)
**Re-evaluate annually.** As bot grows, Workers continues to scale cost-effectively.

Projected costs at 10x current usage:
- Workers: ~$10/month
- Equivalent PebbleHost: ~$40/month

---

## Summary

| Metric | Current | Proposed | Change |
|--------|---------|----------|--------|
| Monthly cost | $6-11 | $0-5 | -$6-11 |
| Scaling capability | Limited | Unlimited | ++ |
| Maintenance overhead | Medium | Low | - |
| Feature capability | Limited (no inbound HTTP) | Full | ++ |
| Global latency | Single region | Edge (global) | ++ |

**Bottom Line:** The migration reduces costs by 50-100% while improving capabilities. The investment in development time pays off within 6-12 months, with ongoing operational benefits.
