# Risk Assessment

This document analyzes potential risks associated with migrating the XIV Dye Tools Discord bot from PebbleHost (Gateway) to Cloudflare Workers (HTTP Interactions).

---

## Risk Matrix

| Risk Level | Probability | Impact | Definition |
|------------|-------------|--------|------------|
| Critical | High | High | Migration blocker, requires immediate resolution |
| High | Medium-High | High | Significant challenge, requires mitigation plan |
| Medium | Medium | Medium | Manageable with proper planning |
| Low | Low | Low-Medium | Minor inconvenience, acceptable |

---

## Technical Risks

### 1. WASM Memory Limits
**Risk Level:** High

| Aspect | Details |
|--------|---------|
| Description | Cloudflare Workers have 128MB memory limit. Complex image processing may exceed this. |
| Probability | Medium |
| Impact | High - Commands would fail entirely |
| Affected Features | /match_image, /accessibility |

**Current State:**
```
Gateway bot (PebbleHost): 2GB+ available memory
Sharp library: Can process large images freely
Worker environment: 128MB hard limit
```

**Mitigation Strategies:**
1. **Aggressive Image Resizing**
   ```typescript
   // Resize to max 800x800 before processing
   const MAX_DIMENSION = 800;
   if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
     const scale = MAX_DIMENSION / Math.max(width, height);
     resize(photonImage, Math.floor(width * scale), Math.floor(height * scale), 1);
   }
   ```

2. **Memory Cleanup**
   ```typescript
   try {
     const photonImage = PhotonImage.new_from_byteslice(buffer);
     // Process...
   } finally {
     photonImage.free(); // Critical: free WASM memory
   }
   ```

3. **Graceful Degradation**
   - If extraction fails, return best-effort results with warning
   - K-means fallback for images with poor color separation

4. **Image Size Validation**
   ```typescript
   const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
   if (imageBuffer.byteLength > MAX_FILE_SIZE) {
     return errorResponse('Image too large. Maximum 4MB allowed.');
   }
   ```

**Residual Risk:** Medium (with mitigations)

---

### 2. 3-Second Response Deadline
**Risk Level:** High

| Aspect | Details |
|--------|---------|
| Description | Discord requires initial response within 3 seconds. Image generation may exceed this. |
| Probability | High |
| Impact | High - User sees "interaction failed" |
| Affected Features | All image-generating commands |

**Current State:**
```
Gateway bot: No response time limit (can take 10+ seconds)
HTTP Interactions: 3 second limit for initial response
```

**Mitigation Strategies:**
1. **Deferred Responses**
   ```typescript
   // Immediately return deferred response
   return Response.json({
     type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
   });

   // Then process in background and follow up
   ctx.waitUntil(generateAndFollowUp(interaction, env));
   ```

2. **Use `ctx.waitUntil()` for Background Work**
   ```typescript
   export default {
     async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
       // Defer immediately
       ctx.waitUntil(async () => {
         const image = await generateImage();
         await followUp(interaction.token, image);
       });

       return deferredResponse();
     }
   };
   ```

3. **Pre-compute Common Results**
   - Cache popular dye combinations in KV
   - Pre-generate frequently used harmony wheels

4. **Optimize SVG Generation**
   - SVG generation is fast (<50ms)
   - Only resvg conversion takes time (~200-500ms)

**Residual Risk:** Low (with deferred responses)

---

### 3. Cold Start Latency
**Risk Level:** Medium

| Aspect | Details |
|--------|---------|
| Description | First request to a Worker may have 50-200ms additional latency. |
| Probability | Medium |
| Impact | Medium - Slower first response, but still within limits |
| Affected Features | All commands after idle period |

**Mitigation Strategies:**
1. **Cron Trigger Warmup**
   ```toml
   # wrangler.toml
   [triggers]
   crons = ["*/5 * * * *"]  # Ping every 5 minutes
   ```

2. **Minimize Bundle Size**
   - Tree-shake unused code
   - Lazy-load WASM modules
   - Target <1MB bundle

3. **Smart@edge Routing**
   - Cloudflare automatically routes to warm instances
   - High-traffic commands stay warm naturally

**Residual Risk:** Low

---

### 4. Color Extraction Accuracy
**Risk Level:** Medium

| Aspect | Details |
|--------|---------|
| Description | Custom WASM color extraction may be less accurate than Sharp's built-in. |
| Probability | Medium |
| Impact | Medium - Users may get poor dye matches |
| Affected Features | /match_image |

**Current State:**
```
Sharp: Mature, well-tested color extraction
Custom WASM: New implementation, untested at scale
```

**Mitigation Strategies:**
1. **Dual Algorithm Approach**
   ```typescript
   async function extractColors(image: ArrayBuffer): Promise<Color[]> {
     // Try median-cut first (faster)
     const colors = await medianCutExtraction(image);

     // Validate quality
     if (!hasColorDiversity(colors)) {
       // Fall back to k-means (more accurate for complex images)
       return await kMeansExtraction(image);
     }

     return colors;
   }
   ```

2. **Quality Validation**
   ```typescript
   function hasColorDiversity(colors: Color[]): boolean {
     // Check that colors are not too similar
     for (let i = 0; i < colors.length; i++) {
       for (let j = i + 1; j < colors.length; j++) {
         const distance = colorDistance(colors[i], colors[j]);
         if (distance < 30) return false; // Too similar
       }
     }
     return true;
   }
   ```

3. **User Feedback Loop**
   - Track when users retry /match_image
   - Log when k-means fallback is triggered
   - Iterate on algorithm thresholds based on data

**Residual Risk:** Medium (acceptable)

---

### 5. SVG-to-PNG Conversion Issues
**Risk Level:** Medium

| Aspect | Details |
|--------|---------|
| Description | resvg-wasm may render SVG differently than expected, especially text/fonts. |
| Probability | Medium |
| Impact | Medium - Visual glitches in generated images |
| Affected Features | All image outputs |

**Mitigation Strategies:**
1. **Use Web-Safe Fonts Only**
   ```typescript
   const TEXT_STYLE = 'font-family: Arial, Helvetica, sans-serif;';
   ```

2. **Embed Font Metrics**
   - Pre-calculate text widths
   - Use `text-anchor="middle"` for centering

3. **Test All Output Types**
   - Create visual regression tests
   - Compare Gateway vs Worker output

4. **Fallback Font Stack**
   ```xml
   <text font-family="Arial, Helvetica, 'Liberation Sans', sans-serif">
   ```

**Residual Risk:** Low (with testing)

---

### 6. Discord API Rate Limits
**Risk Level:** Medium

| Aspect | Details |
|--------|---------|
| Description | Discord API has rate limits that may be hit during high traffic or follow-up messages. |
| Probability | Low |
| Impact | High - Commands fail to complete |
| Affected Features | All commands using follow-up messages |

**Current State:**
```
Discord.js: Built-in rate limit handling
HTTP Interactions: Manual rate limit management required
```

**Mitigation Strategies:**
1. **Respect Rate Limit Headers**
   ```typescript
   async function discordFetch(url: string, options: RequestInit): Promise<Response> {
     const response = await fetch(url, options);

     if (response.status === 429) {
       const retryAfter = response.headers.get('Retry-After');
       await sleep(parseInt(retryAfter || '1000'));
       return discordFetch(url, options);
     }

     return response;
   }
   ```

2. **Queue Follow-Up Messages**
   - Don't flood Discord with rapid follow-ups
   - Batch updates where possible

3. **Monitor Rate Limit Usage**
   - Log rate limit headers
   - Alert when approaching limits

**Residual Risk:** Low

---

## Operational Risks

### 7. Migration Downtime
**Risk Level:** High

| Aspect | Details |
|--------|---------|
| Description | Users may experience service interruption during cutover. |
| Probability | Medium |
| Impact | High - User frustration, lost trust |
| Affected Features | All bot functionality |

**Mitigation Strategies:**
1. **Parallel Operation Period**
   - Run both Gateway and Worker simultaneously
   - Worker handles new commands, Gateway as fallback

2. **Off-Peak Cutover**
   - Execute final cutover at 3 AM UTC
   - Minimize affected users

3. **Rollback Plan**
   - Keep Gateway bot ready to restart
   - Document rollback steps
   - Test rollback procedure

4. **Communication**
   - Announce maintenance window in advance
   - Update bot status during migration

**Residual Risk:** Medium

---

### 8. Loss of Gateway-Only Features
**Risk Level:** Medium

| Aspect | Details |
|--------|---------|
| Description | Some Discord features only work with Gateway bots. |
| Probability | Certain |
| Impact | Low - Features not currently used |
| Affected Features | Presence, message events, reactions |

**Features Lost:**
| Feature | Current Usage | Impact |
|---------|---------------|--------|
| Presence (online status) | Displayed | Low - Not critical |
| Message events | Not used | None |
| Reaction events | Not used | None |
| Typing indicators | Not used | None |
| Voice states | Not used | None |

**Mitigation:**
- Accept that these features are not available
- Document limitation for future feature planning
- If needed later, consider hybrid Gateway + HTTP approach

**Residual Risk:** Low (acceptable trade-off)

---

### 9. Vendor Lock-In
**Risk Level:** Low

| Aspect | Details |
|--------|---------|
| Description | Moving to Cloudflare creates dependency on their platform. |
| Probability | Certain |
| Impact | Low - Cloudflare is stable, migration is possible |
| Affected Features | Entire bot infrastructure |

**Considerations:**
- Cloudflare Workers use standard Web APIs
- Core logic (xivdyetools-core) is platform-agnostic
- SVG generation is pure TypeScript
- Could migrate to Deno Deploy, AWS Lambda@Edge if needed

**Mitigation:**
- Keep core logic in separate npm package
- Use standard APIs where possible
- Document Cloudflare-specific dependencies

**Residual Risk:** Low (acceptable)

---

### 10. Cost Overruns
**Risk Level:** Low

| Aspect | Details |
|--------|---------|
| Description | Usage may exceed free tier, resulting in unexpected costs. |
| Probability | Low |
| Impact | Low - Costs are predictable and capped |
| Affected Features | Budget |

**Cost Analysis:**
| Resource | Free Tier | Expected Usage | Risk |
|----------|-----------|----------------|------|
| Workers requests | 100k/day | ~5k/day | Very Low |
| KV reads | 100k/day | ~10k/day | Very Low |
| KV writes | 1k/day | ~2k/day | Low |
| R2 storage | 10GB | ~1GB | Very Low |
| R2 operations | 1M/month | ~100k/month | Very Low |
| D1 reads | 5M/day | ~50k/day | Very Low |
| External APIs | — | None required | None |

**Mitigation:**
- Set billing alerts at $5, $10, $20
- Monitor usage dashboard
- Optimize image caching to reduce R2 writes

**Residual Risk:** Very Low

---

## Security Risks

### 11. Signature Verification Failure
**Risk Level:** Critical (if it happens)

| Aspect | Details |
|--------|---------|
| Description | If signature verification is bypassed, attackers could send fake interactions. |
| Probability | Very Low |
| Impact | Critical - Full bot compromise |
| Affected Features | All commands |

**Mitigation Strategies:**
1. **Use Official Library**
   ```typescript
   import { verifyKey } from 'discord-interactions';
   // Well-tested, maintained by Discord
   ```

2. **Reject Invalid Signatures First**
   ```typescript
   const isValid = verifyKey(body, signature, timestamp, publicKey);
   if (!isValid) {
     return new Response('Unauthorized', { status: 401 });
   }
   // Only proceed if valid
   ```

3. **Keep Public Key Secret**
   - Store in Wrangler secrets
   - Never commit to repository

4. **Log Verification Failures**
   - Monitor for attack attempts
   - Alert on unusual patterns

**Residual Risk:** Very Low

---

### 12. Secret Exposure
**Risk Level:** High (if it happens)

| Aspect | Details |
|--------|---------|
| Description | Environment secrets could be exposed through logs, errors, or code. |
| Probability | Low |
| Impact | High - Bot token compromise |
| Affected Features | All bot functionality |

**Secrets to Protect:**
- `DISCORD_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `IMAGGA_API_KEY`
- `IMAGGA_API_SECRET`
- `INTERNAL_WEBHOOK_SECRET`

**Mitigation Strategies:**
1. **Use Wrangler Secrets**
   ```bash
   wrangler secret put DISCORD_TOKEN
   # Never in wrangler.toml or code
   ```

2. **Sanitize Error Logs**
   ```typescript
   function sanitizeError(error: Error): string {
     let message = error.message;
     // Remove any potential secrets
     message = message.replace(/[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g, '[REDACTED]');
     return message;
   }
   ```

3. **Audit Logging Code**
   - Review all console.log/error statements
   - Never log request bodies containing tokens

**Residual Risk:** Low

---

## Risk Summary Matrix

| Risk | Level | Probability | Impact | Residual |
|------|-------|-------------|--------|----------|
| WASM Memory Limits | High | Medium | High | Medium |
| 3-Second Response | High | High | High | Low |
| Cold Start Latency | Medium | Medium | Medium | Low |
| Color Extraction Accuracy | Medium | Medium | Medium | Medium |
| SVG-to-PNG Conversion | Medium | Medium | Medium | Low |
| Discord Rate Limits | Medium | Low | High | Low |
| Migration Downtime | High | Medium | High | Medium |
| Gateway Features Lost | Medium | Certain | Low | Low |
| Vendor Lock-In | Low | Certain | Low | Low |
| Cost Overruns | Low | Low | Low | Very Low |
| Signature Verification | Critical | Very Low | Critical | Very Low |
| Secret Exposure | High | Low | High | Low |

---

## Risk Acceptance Criteria

### Acceptable Risks
- Cold start latency (users tolerate <500ms additional delay)
- Gateway features lost (not using them anyway)
- Vendor lock-in (migration path exists)
- Cost overruns (well within budget with alerts)

### Risks Requiring Mitigation
- WASM memory limits → Aggressive resizing, cleanup, graceful degradation
- 3-second response → Deferred responses
- Color extraction accuracy → Dual algorithm (median-cut + k-means)
- Migration downtime → Parallel operation, off-peak cutover

### Unacceptable Risks
- Signature verification failure → Block migration if not resolved
- Secret exposure → Block migration if not resolved

---

## Monitoring and Alerting

### Key Metrics to Monitor

| Metric | Threshold | Alert Level |
|--------|-----------|-------------|
| Error rate | > 1% | Critical |
| P99 latency | > 5s | Warning |
| Memory usage | > 100MB | Warning |
| Rate limit hits | > 10/hour | Warning |
| K-means fallback rate | > 50% | Warning |
| R2 storage growth | > 5GB | Info |

### Alert Configuration

```typescript
// Example: Cloudflare Workers Analytics
// Set up in Cloudflare Dashboard > Workers > Analytics

// Custom alerting via webhook
async function logMetric(name: string, value: number, env: Env) {
  await fetch(env.METRICS_WEBHOOK, {
    method: 'POST',
    body: JSON.stringify({
      metric: name,
      value,
      timestamp: Date.now()
    })
  });
}
```

---

## Contingency Plans

### Scenario: Worker Down
1. Immediately start Gateway bot on PebbleHost
2. Remove Interactions Endpoint URL from Discord app
3. Gateway automatically handles all commands
4. Investigate Worker issue
5. Fix and redeploy
6. Test thoroughly before re-enabling Worker

### Scenario: High Error Rate
1. Check Cloudflare dashboard for errors
2. Review recent deployments
3. Rollback to previous version if recent change
4. If persists, activate Gateway fallback

### Scenario: Memory Exhaustion
1. Reduce image processing dimensions (max 150x150)
2. Skip color extraction for very large/complex images
3. Add circuit breaker for /match_image
4. Consider paid Worker tier (higher limits)

### Scenario: Cost Spike
1. Identify high-cost resource
2. Implement aggressive caching
3. Rate limit expensive operations
4. Set hard spending cap in Cloudflare

---

## Conclusion

The migration is **feasible** with acceptable risk levels when proper mitigations are in place. The main challenges are:

1. **WASM memory limits** - Manageable with aggressive resizing and graceful degradation
2. **Response time constraints** - Solved with deferred responses
3. **Color extraction accuracy** - Addressed with dual algorithm approach (median-cut + k-means)
4. **Migration downtime** - Minimized with parallel operation and off-peak cutover

The benefits (unified platform, auto-scaling, lower costs, no inbound HTTP issues) outweigh the risks when properly mitigated.

**Recommendation:** Proceed with migration using the phased approach outlined in MIGRATION_PHASES.md, with close monitoring at each phase.
