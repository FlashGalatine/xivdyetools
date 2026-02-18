# Security Hardening Plan
## xivdyetools-core & xivdyetools-discord-bot

**Date:** November 23, 2025  
**Status:** Planning Phase  
**Classification:** Internal Use

---

## Executive Summary

This document outlines security hardening measures for the XIVDyeTools ecosystem. The assessment identified several areas requiring attention: input validation, dependency management, secret management, rate limiting bypass prevention, and infrastructure security. While no critical vulnerabilities were identified, implementing these recommendations will significantly improve the security posture.

**Risk Level:** Low to Medium (no critical issues identified)

---

## 1. Threat Model

### 1.1 Attack Surface

| Component | Exposure | Threat Level |
|-----------|----------|--------------|
| Discord Bot Commands | Public (all Discord users) | Medium |
| Health Check Endpoint | Public HTTP | Low |
| Redis Cache | Internal (localhost/VPC) | Low |
| Image Processing | Public (user uploads) | Medium |
| API Integration (Universalis) | External (trusted) | Low |

### 1.2 Threat Actors

1. **Malicious Discord Users**
   - Goal: DoS attacks, data exfiltration, command abuse
   - Capability: Can invoke commands, upload images
   - Mitigation: Rate limiting, input validation

2. **Dependency Supply Chain Attacks**
   - Goal: Code injection via compromised packages
   - Capability: npm package compromise
   - Mitigation: Audit, lockfiles, checksum verification

3. **Infrastructure Attackers**
   - Goal: Container escape, Redis compromise
   - Capability: Network access, potential vulnerabilities
   - Mitigation: Network isolation, minimal privileges

---

## 2. Input Validation & Sanitization

### 2.1 Discord Command Inputs

#### Issue: Insufficient Input Validation
**Location:** Various command files in `xivdyetools-discord-bot/src/commands/`

**Current State:**
- Basic Discord.js validation for option types
- Limited range checking
- No sanitization of user-provided strings

**Vulnerabilities:**

1. **Hex Color Input** (`/match`, `/harmony`, etc.)
   ```typescript
   // Current: Basic regex check in validators.ts
   // Risk: Edge cases like "#GGGGGG" may cause crashes
   ```

2. **Dye ID Input**
   ```typescript
   // No bounds checking beyond Discord's integer validation
   // Risk: Negative IDs, out-of-range IDs
   ```

3. **String Inputs** (dye names, search queries)
   ```typescript
   // No length limits beyond Discord's 100-char limit
   // Risk: ReDoS via complex search patterns
   ```

**Recommended Actions:**

1. **Implement Strict Validators**
   ```typescript
   // Create: src/utils/validators.ts enhancements
   
   export function validateHexColor(hex: string): Result<HexColor, ValidationError> {
     // Normalize
     const normalized = hex.trim().toUpperCase();
     
     // Strict regex
     if (!/^#[0-9A-F]{6}$/.test(normalized)) {
       return { error: 'Invalid hex color format. Expected #RRGGBB' };
     }
     
     return { value: normalized as HexColor };
   }
   
   export function validateDyeId(id: number): Result<number, ValidationError> {
     if (!Number.isInteger(id) || id < 1) {
       return { error: 'Dye ID must be a positive integer' };
     }
     
     // Check against known dye range (1-125 currently)
     if (id > 200) { // Allow headroom for future dyes
       return { error: 'Dye ID out of known range' };
     }
     
     return { value: id };
   }
   
   export function sanitizeSearchQuery(query: string): string {
     // Remove control characters, limit length
     return query
       .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
       .substring(0, 50)
       .trim();
   }
   ```

2. **Add Pre-execution Validation Layer**
   ```typescript
   // In src/index.ts interaction handler
   
   // Validate all inputs before command execution
   const validationResult = validateCommandInputs(interaction);
   if (!validationResult.success) {
     await interaction.reply({
       content: `❌ Invalid input: ${validationResult.error}`,
       ephemeral: true
     });
     return;
   }
   ```

**Priority:** High  
**Impact:** Prevents 90% of malformed input attacks

---

### 2.2 Image Upload Security

#### Issue: Insufficient Image Validation
**Location:** `src/commands/match-image.ts`

**Current Vulnerabilities:**

1. **File Type Validation**
   ```typescript
   // Current: Relies on MIME type from Discord
   // Risk: MIME type spoofing
   ```

2. **Image Bomb Protection**
   ```typescript
   // Current: 8MB size limit via config
   // Risk: Decompression bombs (small file, huge decompressed size)
   ```

3. **Malicious Metadata**
   ```typescript
   // Current: No EXIF stripping
   // Risk: Privacy leaks, embedded scripts (unlikely but possible)
   ```

**Recommended Actions:**

1. **Implement Multi-layer Validation**
   ```typescript
   // Create: src/utils/image-validator.ts
   
   import sharp from 'sharp';
   
   export async function validateImage(buffer: Buffer): Promise<ValidationResult> {
     // 1. Size check (pre-processing)
     if (buffer.length > 8 * 1024 * 1024) {
       return { error: 'Image exceeds 8MB limit' };
     }
     
     // 2. Verify it's actually an image
     try {
       const metadata = await sharp(buffer).metadata();
       
       // 3. Dimension limits (prevent decompression bombs)
       if (!metadata.width || !metadata.height) {
         return { error: 'Invalid image metadata' };
       }
       
       if (metadata.width > 4096 || metadata.height > 4096) {
         return { error: 'Image dimensions exceed 4096x4096 limit' };
       }
       
       // 4. Pixel count limit (prevents 4096x4096x3 = 50MB uncompressed)
       const pixelCount = metadata.width * metadata.height;
       if (pixelCount > 16_777_216) { // 4096^2
         return { error: 'Image has too many pixels' };
       }
       
       // 5. Format whitelist
       const allowedFormats = ['jpeg', 'png', 'webp', 'gif'];
       if (!metadata.format || !allowedFormats.includes(metadata.format)) {
         return { error: 'Unsupported image format' };
       }
       
       return { success: true, metadata };
       
     } catch (error) {
       return { error: 'Failed to parse image' };
     }
   }
   
   export async function sanitizeImage(buffer: Buffer): Promise<Buffer> {
     // Strip all metadata, re-encode
     return sharp(buffer)
       .rotate() // Auto-rotate based on EXIF (then strip)
       .withMetadata({ exif: {}, icc: undefined })
       .toBuffer();
   }
   ```

2. **Add Timeout Protection**
   ```typescript
   // Prevent infinite processing
   const processWithTimeout = (promise: Promise<any>, ms: number) => {
     return Promise.race([
       promise,
       new Promise((_, reject) => 
         setTimeout(() => reject(new Error('Processing timeout')), ms)
       )
     ]);
   };
   
   // Usage
   await processWithTimeout(processImage(buffer), 10000); // 10s max
   ```

**Priority:** High  
**Impact:** Prevents DoS via malicious images

---

## 3. Dependency Security

### 3.1 Current Dependency Audit

**xivdyetools-core:**
```json
{
  "typescript": "^5.3.2",     // ✅ Up to date
  "vitest": "^4.0.13",        // ✅ Up to date
  "@types/node": "^20.10.0"   // ✅ Up to date
}
```

**xivdyetools-discord-bot:**
```json
{
  "discord.js": "^14.14.1",          // ✅ Check for updates
  "@napi-rs/canvas": "^0.1.52",      // ⚠️ Native module - pin exact version
  "sharp": "^0.33.1",                // ⚠️ Native module - pin exact version
  "express": "^5.1.0",               // ⚠️ Express 5 is in beta - consider risk
  "ioredis": "^5.3.2",               // ✅ Stable
  "dotenv": "^16.3.1"                // ✅ Stable
}
```

**Recommendations:**

1. **Pin Native Modules to Exact Versions**
   ```json
   {
     "@napi-rs/canvas": "0.1.52",  // Remove ^
     "sharp": "0.33.1"              // Remove ^
   }
   ```
   **Reason:** Native modules have platform-specific binaries. Caret ranges can introduce binary incompatibilities.

2. **Implement Automated Dependency Scanning**
   
   **GitHub Actions Workflow:**
   ```yaml
   # .github/workflows/security-audit.yml
   name: Security Audit
   
   on:
     schedule:
       - cron: '0 0 * * 1'  # Weekly on Monday
     pull_request:
       branches: [main]
     push:
       branches: [main]
   
   jobs:
     audit:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Setup Node
           uses: actions/setup-node@v4
           with:
             node-version: '18'
         
         - name: npm audit
           run: npm audit --audit-level=moderate
         
         - name: Snyk Security Scan
           uses: snyk/actions/node@master
           env:
             SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
   ```

3. **Implement Dependency Review**
   ```yaml
   # .github/workflows/dependency-review.yml
   name: Dependency Review
   
   on: [pull_request]
   
   jobs:
     dependency-review:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/dependency-review-action@v4
           with:
             fail-on-severity: moderate
   ```

**Priority:** High  
**Effort:** Low (automated)

---

### 3.2 Supply Chain Security

**Recommended Actions:**

1. **Enable npm Package Signature Verification**
   ```bash
   # Add to package.json scripts
   "postinstall": "check-pkg-integrity"
   ```

2. **Use npm Provenance**
   ```bash
   # When publishing xivdyetools-core
   npm publish --provenance
   ```

3. **Implement Subresource Integrity (SRI)**
   - For any CDN resources (if applicable)
   - Verify integrity of downloaded packages

**Priority:** Medium

---

## 4. Secrets & Configuration Management

### 4.1 Environment Variables

#### Issue: Secrets in Code/Logs
**Location:** `src/config.ts`, `.env`

**Current Risks:**

1. **Secrets Logging**
   ```typescript
   // Potential risk: logger.debug(config) would expose tokens
   ```

2. **No Secret Rotation Strategy**
   - Discord token has no expiration
   - Redis password (if set) is static

3. **Local .env Files**
   - Risk: Committed to git by accident
   - Risk: Shared in screenshots/logs

**Recommended Actions:**

1. **Implement Secret Redaction in Logger**
   ```typescript
   // src/utils/logger.ts
   
   const SENSITIVE_KEYS = ['token', 'password', 'secret', 'key', 'webhook'];
   
   function redactSensitive(obj: any): any {
     if (typeof obj !== 'object' || obj === null) return obj;
     
     const redacted = { ...obj };
     for (const key of Object.keys(redacted)) {
       const lowerKey = key.toLowerCase();
       if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
         redacted[key] = '[REDACTED]';
       } else if (typeof redacted[key] === 'object') {
         redacted[key] = redactSensitive(redacted[key]);
       }
     }
     return redacted;
   }
   
   // Use in all log statements
   logger.debug('Config loaded:', redactSensitive(config));
   ```

2. **Add .env Validation on Startup**
   ```typescript
   // src/config.ts enhancement
   
   function validateSecrets(): void {
     const token = process.env.DISCORD_TOKEN;
     
     // Check for placeholder values
     if (token?.includes('your_') || token?.includes('example')) {
       throw new Error('DISCORD_TOKEN appears to be a placeholder. Please set a real token.');
     }
     
     // Check for suspected leaks (public tokens start with specific prefixes)
     if (token && token.length < 50) {
       logger.warn('DISCORD_TOKEN appears unusually short. Please verify.');
     }
   }
   
   validateSecrets();
   ```

3. **Document Secret Rotation Procedure**
   
   **Create:** `docs/security/SECRET_ROTATION.md`
   ```markdown
   # Secret Rotation Procedure
   
   ## Discord Bot Token
   1. Go to Discord Developer Portal
   2. Navigate to Bot settings → Reset Token
   3. Update Fly.io secrets:
      ```bash
      fly secrets set DISCORD_TOKEN=<new_token>
      ```
   4. Restart bot: `fly apps restart`
   
   ## Redis Password (if applicable)
   1. Connect to Redis: `redis-cli`
   2. Set new password: `CONFIG SET requirepass <new_password>`
   3. Update Fly.io: `fly secrets set REDIS_PASSWORD=<new_password>`
   4. Restart bot
   
   ## Error Webhook URL
   - Regenerate webhook in Discord channel settings
   - Update environment variable
   ```

**Priority:** Medium  
**Effort:** Low

---

### 4.2 Secure Defaults

**Recommended Config Changes:**

```typescript
// src/config.ts

export const config: BotConfig = {
  // ... existing config
  
  // Add security defaults
  security: {
    // Require TLS for Redis in production
    redisUseTLS: process.env.NODE_ENV === 'production',
    
    // Disable debug logs in production
    allowDebugLogs: process.env.NODE_ENV !== 'production',
    
    // Image processing timeout
    imageProcessingTimeout: 10000, // 10s
    
    // Maximum concurrent image processes
    maxConcurrentImageProcessing: 3,
  },
};
```

---

## 5. Rate Limiting & Abuse Prevention

### 5.1 Enhanced Rate Limiting

#### Issue: Potential Bypass Vectors
**Location:** `src/services/rate-limiter.ts`

**Current Implementation:**
- ✅ Per-user rate limiting (10/min, 100/hr)
- ✅ Global rate limiting
- ✅ Redis + memory fallback

**Potential Bypasses:**

1. **User ID Farming**
   - Attacker creates multiple Discord accounts
   - Each gets separate rate limit bucket
   - Mitigation: Not feasible to prevent at app level (Discord's responsibility)

2. **Clock Skew in Memory Fallback**
   - System time manipulation could affect memory store
   - Low risk (requires host access)

**Recommended Enhancements:**

1. **Add IP-based Rate Limiting (for HTTP endpoints)**
   ```typescript
   // For /health and future HTTP endpoints
   import rateLimit from 'express-rate-limit';
   
   const healthLimiter = rateLimit({
     windowMs: 60 * 1000, // 1 minute
     max: 120, // 120 requests per minute per IP
     message: 'Too many requests from this IP'
   });
   
   app.get('/health', healthLimiter, (req, res) => { ... });
   ```

2. **Implement Command-specific Limits**
   ```typescript
   // Heavy commands get stricter limits
   const commandLimits: Record<string, { perMinute: number; perHour: number }> = {
     'match-image': { perMinute: 3, perHour: 20 },  // Image processing
     'harmony': { perMinute: 6, perHour: 60 },
     'dye': { perMinute: 20, perHour: 200 },        // Cheap lookup
     // ... etc
   };
   
   async function checkCommandLimit(userId: string, command: string): Promise<RateLimitResult> {
     const limits = commandLimits[command] || config.rateLimit;
     // ... check against limits
   }
   ```

3. **Add Abuse Detection**
   ```typescript
   // Track repeated failed commands (might indicate probing)
   interface AbuseMetrics {
     failedCommands: number;
     lastFailure: number;
   }
   
   const abuseTracker = new Map<string, AbuseMetrics>();
   
   function checkAbuse(userId: string): boolean {
     const metrics = abuseTracker.get(userId);
     if (!metrics) return false;
     
     // 10 failures in 5 minutes = suspicious
     if (metrics.failedCommands > 10 && 
         Date.now() - metrics.lastFailure < 5 * 60 * 1000) {
       logger.warn(`Potential abuse detected from user ${userId}`);
       return true;
     }
     
     return false;
   }
   ```

**Priority:** Medium

---

### 5.2 DoS Protection

**Additional Safeguards:**

1. **Request Queue with Concurrency Limit**
   ```typescript
   // Limit concurrent command executions
   import pLimit from 'p-limit';
   
   const commandQueue = pLimit(10); // Max 10 concurrent
   
   // Wrap command execution
   await commandQueue(() => command.execute(interaction));
   ```

2. **Circuit Breaker for External APIs**
   ```typescript
   // If Universalis API fails repeatedly, stop calling it
   import CircuitBreaker from 'opossum';
   
   const universalisBreaker = new CircuitBreaker(fetchPrices, {
     timeout: 5000,
     errorThresholdPercentage: 50,
     resetTimeout: 30000
   });
   ```

**Priority:** Low to Medium

---

## 6. Data Protection & Privacy

### 6.1 User Data Handling

**Current Data Collection:**
- User IDs (for rate limiting and analytics)
- Guild IDs
- Command usage statistics
- Error logs (may contain user IDs)

**Compliance Considerations:**

> [!IMPORTANT]
> While the bot doesn't collect PII beyond Discord IDs, documenting data practices is important for transparency.

**Recommended Actions:**

1. **Create Privacy Policy**
   
   **Add to:** `docs/PRIVACY.md` and bot's Discord presence
   ```markdown
   # Privacy Policy
   
   ## Data We Collect
   - Discord User IDs (for rate limiting)
   - Command usage statistics (anonymous)
   - Error logs (may include User/Guild IDs)
   
   ## Data We Don't Collect
   - Message content
   - User demographics
   - Personal information
   
   ## Data Retention
   - Rate limit data: 1 hour (Redis TTL)
   - Analytics: 7 days (Redis TTL)
   - Error logs: 30 days (Webhook delivery)
   
   ## Data Sharing
   - No data is shared with third parties
   - Error webhooks sent to private Discord channel (admin only)
   ```

2. **Implement Data Deletion Endpoint**
   ```typescript
   // For GDPR-style "right to be forgotten" requests
   // Internal admin endpoint (not public)
   
   app.delete('/admin/user/:userId/data', async (req, res) => {
     // Verify admin authentication
     const userId = req.params.userId;
     
     await rateLimiter.resetUserLimit(userId);
     await analytics.deleteUserData(userId);
     
     logger.info(`Deleted all data for user ${userId}`);
     res.json({ success: true });
   });
   ```

**Priority:** Low (nice-to-have for transparency)

---

### 6.2 Redis Security

**Current Risk:** Low (Redis runs on localhost / private VPC)

**Hardening Checklist:**

1. **Enable Redis Authentication (if exposed)**
   ```bash
   # In redis.conf or via Fly.io configuration
   requirepass [strong_password]
   ```

2. **Disable Dangerous Commands**
   ```bash
   # Prevent accidental data loss
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command CONFIG ""
   ```

3. **Enable TLS for Redis Connections**
   ```typescript
   // src/services/redis.ts
   
   const redis = new Redis(config.redisUrl, {
     tls: process.env.NODE_ENV === 'production' ? {
       rejectUnauthorized: true
     } : undefined,
     password: process.env.REDIS_PASSWORD,
   });
   ```

4. **Set Maxmemory Policy**
   ```bash
   # Prevent unbounded memory growth
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

**Priority:** Medium (if Redis is network-exposed)

---

## 7. Infrastructure Hardening

### 7.1 Docker Security

#### Issue: Container Running as Root
**Location:** `Dockerfile`

**Current Risk:** Medium (container escape = root on host)

**Recommended Actions:**

1. **Run as Non-root User**
   ```dockerfile
   # Add to Dockerfile after copying files
   
   # Create non-root user
   RUN addgroup -g 1001 -S botuser && \
       adduser -u 1001 -S botuser -G botuser
   
   # Change ownership
   RUN chown -R botuser:botuser /app
   
   # Switch to non-root user
   USER botuser
   
   CMD ["node", "dist/index.js"]
   ```

2. **Drop Unnecessary Capabilities**
   ```yaml
   # fly.toml
   [processes]
     app = "node dist/index.js"
   
   [[services]]
     internal_port = 3000
     protocol = "tcp"
     
     # Security options
     [services.security]
       drop_capabilities = ["ALL"]
       add_capabilities = ["NET_BIND_SERVICE"] # If needed for port 80
   ```

3. **Read-only Root Filesystem**
   ```yaml
   # fly.toml
   [mount]
     source = "cache_volume"
     destination = "/tmp"
   
   [deploy]
     read_only = true  # Make root filesystem read-only
   ```

4. **Scan Image for Vulnerabilities**
   ```yaml
   # .github/workflows/docker-scan.yml
   name: Docker Security Scan
   
   on:
     push:
       branches: [main]
     pull_request:
   
   jobs:
     scan:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Build image
           run: docker build -t xivdyetools-bot .
         
         - name: Run Trivy scanner
           uses: aquasecurity/trivy-action@master
           with:
             image-ref: xivdyetools-bot
             severity: 'CRITICAL,HIGH'
   ```

**Priority:** High  
**Impact:** Significantly reduces blast radius of container escape

---

### 7.2 Network Security

**Recommended Configuration:**

1. **Firewall Rules (Fly.io)**
   ```toml
   # fly.toml
   
   # Only expose health check port
   [[services]]
     internal_port = 3000
     protocol = "tcp"
     
     # Public health check
     [[services.ports]]
       port = 80
       handlers = ["http"]
   
   # Redis should NOT be exposed publicly
   # Use Fly.io private network or VPC
   ```

2. **TLS for All External Connections**
   - Discord API: ✅ (HTTPS by default)
   - Universalis API: ✅ (HTTPS)
   - Redis: ⚠️ (Add TLS if network-connected)

**Priority:** Medium

---

## 8. Monitoring & Incident Response

### 8.1 Security Logging

**Enhance Logger with Security Events:**

```typescript
// src/utils/logger.ts

export const securityLogger = {
  authFailure: (userId: string, reason: string) => {
    logger.warn(`AUTH_FAILURE: User ${userId} - ${reason}`);
  },
  
  rateLimitExceeded: (userId: string, limit: string) => {
    logger.warn(`RATE_LIMIT: User ${userId} exceeded ${limit}`);
  },
  
  suspiciousActivity: (userId: string, activity: string) => {
    logger.warn(`SUSPICIOUS: User ${userId} - ${activity}`);
  },
  
  dataAccess: (userId: string, resource: string) => {
    logger.info(`DATA_ACCESS: User ${userId} accessed ${resource}`);
  },
};
```

**Priority:** Medium

---

### 8.2 Incident Response Plan

**Create:** `docs/security/INCIDENT_RESPONSE.md`

```markdown
# Security Incident Response Plan

## Severity Levels

### P0 - Critical
- Active exploit of vulnerability
- Data breach
- Complete service outage
- **Response Time:** Immediate (< 15 minutes)

### P1 - High
- Suspected security issue
- Abnormal traffic patterns
- DoS attack
- **Response Time:** < 1 hour

### P2 - Medium
- Security scan findings
- Dependency vulnerabilities
- **Response Time:** < 24 hours

## Response Procedures

### 1. Detection
- Monitor error webhook for suspicious patterns
- Check Fly.io metrics for anomalies
- Review rate limiter logs

### 2. Containment
- Rate limit suspected users: `rateLimiter.resetUserLimit(userId)`
- Emergency bot shutdown: `fly apps restart` or `fly scale count 0`
- Rotate compromised secrets

### 3. Investigation
- Export logs: `fly logs --app xivdyetools-bot`
- Check Redis for suspicious keys: `redis-cli KEYS *`
- Review recent deployments: `fly releases`

### 4. Recovery
- Deploy patched version
- Restore from backup if needed
- Monitor for recurrence

### 5. Post-mortem
- Document incident in `docs/security/incidents/YYYY-MM-DD.md`
- Update security measures
- Notify users if data was compromised
```

**Priority:** Medium

---

## 9. Code Security Best Practices

### 9.1 Secure Coding Standards

**Implement in Code Reviews:**

1. **No Eval or Dynamic Code Execution**
   - ❌ `eval()`, `Function()`, `vm.runInContext()`
   - Risk: Arbitrary code execution

2. **Parameterized Queries** (if SQL is ever added)
   - ❌ String concatenation for queries
   - ✅ Prepared statements

3. **Principle of Least Privilege**
   - Code should only have access to what it needs
   - Example: Image processing shouldn't have Redis access

4. **Error Messages**
   - ❌ Don't leak stack traces to users
   - ✅ Generic error messages, detailed logs internally

**Recommended ESLint Rules:**

```json
// .eslintrc.json additions
{
  "rules": {
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-call": "warn"
  }
}
```

---

### 9.2 Dependency Pinning Strategy

**For Production:**
```json
{
  "dependencies": {
    // Exact versions for critical deps
    "discord.js": "14.14.1",
    "sharp": "0.33.1",
    "@napi-rs/canvas": "0.1.52",
    
    // Allow patch updates for stable deps
    "express": "~5.1.0",
    "ioredis": "~5.3.2",
    "dotenv": "~16.3.1"
  }
}
```

**Update Strategy:**
- Critical security patches: Immediately
- Minor updates: Monthly review
- Major updates: Quarterly review + testing

---

## 10. Implementation Roadmap

### Phase 1: Critical Security (Week 1-2)
- [ ] Implement input validation for all commands
- [ ] Add image validation and sanitization
- [ ] Enable security audit in CI/CD
- [ ] Implement secret redaction in logs
- [ ] Docker: Run as non-root user

### Phase 2: Enhanced Protection (Week 3-4)
- [ ] Command-specific rate limits
- [ ] Abuse detection system
- [ ] Redis TLS and authentication
- [ ] Dependency pinning for native modules
- [ ] Error message sanitization

### Phase 3: Monitoring & Compliance (Week 5-6)
- [ ] Security event logging
- [ ] Incident response procedures
- [ ] Privacy policy documentation
- [ ] Container vulnerability scanning
- [ ] Network hardening

### Phase 4: Advanced Hardening (Week 7-8)
- [ ] Read-only container filesystem
- [ ] Circuit breakers for external APIs
- [ ] Data deletion endpoint
- [ ] Automated secret rotation
- [ ] Security penetration testing

---

## 11. Compliance & Audit

### 11.1 Security Checklist

**Monthly Review:**
- [ ] Run `npm audit` and address findings
- [ ] Review rate limiter logs for abuse patterns
- [ ] Check for outdated dependencies
- [ ] Verify all secrets are rotated (if policy requires)
- [ ] Review error logs for leaked secrets

**Quarterly Review:**
- [ ] Full dependency update cycle
- [ ] Penetration testing (if applicable)
- [ ] Review and update security documentation
- [ ] Audit user data retention compliance

---

### 11.2 Security Metrics

Track and report:

| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| High/Critical CVEs | 0 | TBD | - |
| Mean Time to Patch (MTTP) | <7 days | TBD | - |
| Rate limit violations | <0.1% of requests | TBD | - |
| Failed validation attempts | <1% of requests | TBD | - |
| Security incidents | 0 | 0 | ✅ |

---

## 12. Testing Strategy

### 12.1 Security Tests

**Create Test Suite:**

```typescript
// tests/security/input-validation.test.ts

describe('Input Validation Security', () => {
  test('rejects malformed hex colors', () => {
    expect(validateHexColor('GGGGGG')).toHaveError();
    expect(validateHexColor('#GGGGGG')).toHaveError();
    expect(validateHexColor('#FF')).toHaveError();
    expect(validateHexColor('rgb(255,0,0)')).toHaveError();
  });
  
  test('sanitizes search queries', () => {
    const malicious = '\x00\x1F<script>alert(1)</script>';
    const sanitized = sanitizeSearchQuery(malicious);
    expect(sanitized).not.toContain('\x00');
    expect(sanitized).not.toContain('\x1F');
  });
  
  test('enforces dye ID bounds', () => {
    expect(validateDyeId(-1)).toHaveError();
    expect(validateDyeId(0)).toHaveError();
    expect(validateDyeId(999)).toHaveError();
    expect(validateDyeId(50)).toBeValid();
  });
});

// tests/security/rate-limiting.test.ts

describe('Rate Limiting Security', () => {
  test('prevents rapid-fire requests', async () => {
    const userId = 'test-user';
    
    // Send 11 requests (limit is 10/min)
    for (let i = 0; i < 11; i++) {
      await rateLimiter.checkUserLimit(userId);
    }
    
    const result = await rateLimiter.checkUserLimit(userId);
    expect(result.allowed).toBe(false);
  });
  
  test('resets after time window', async () => {
    // Advance time by 61 seconds
    jest.advanceTimersByTime(61000);
    
    const result = await rateLimiter.checkUserLimit('test-user');
    expect(result.allowed).toBe(true);
  });
});
```

---

## 13. Risk Assessment Summary

| Risk | Likelihood | Impact | Current Mitigation | Additional Mitigation Needed |
|------|------------|--------|-------------------|------------------------------|
| Malicious image upload | Medium | Medium | Size limit | ✅ Decompression bomb protection |
| Rate limit bypass | Low | Low | Redis-backed limits | ❌ None (acceptable risk) |
| Dependency vulnerability | Medium | High | npm audit | ✅ Automated scanning in CI |
| Secret leakage | Low | Critical | .gitignore | ✅ Log redaction |
| DoS via command spam | Medium | Medium | Rate limiting | ✅ Command-specific limits |
| Container escape | Low | High | Alpine Linux | ✅ Non-root user |
| Data exfiltration | Very Low | Low | No PII collected | ❌ None needed |
| Supply chain attack | Low | Critical | package-lock.json | ✅ Provenance, SRI |

---

## Appendix A: Security Contacts

- **Security Lead:** XIV Dye Tools Team
- **Incident Reporting:** [Create GitHub Issue with 'security' label]
- **Vulnerability Disclosure:** security@xivdyetools.example (if we set up)

---

## Appendix B: References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Discord.js Security Best Practices](https://discordjs.guide/popular-topics/common-questions.html#security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)

---

**Document Owner:** XIV Dye Tools Team  
**Last Updated:** November 23, 2025  
**Next Review:** December 23, 2025  
**Classification:** Internal Use
