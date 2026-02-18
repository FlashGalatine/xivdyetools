# Maintainer Reference

**Technical reference for XIV Dye Tools maintainers**

> This section consolidates architectural decisions, known issues, technical debt, and audit findings for long-term project maintenance.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Dye Maintainer Tool](dye-maintainer-tool.md) | GUI application for adding new dyes |
| [Adding New Dyes (Manual)](adding-dyes.md) | Manual process and data format reference |
| [Moderation Guide](../operations/MODERATION.md) | Managing bans and community presets |
| [Architecture Decisions](#architecture-decisions) | Why we built things this way |
| [Known Issues](#known-issues) | Current limitations and workarounds |
| [Technical Debt](#technical-debt) | Areas needing improvement |
| [Audit Remediation](#audit-remediation) | Security audit action items |

---

## Architecture Decisions

### Why HTTP Interactions for Discord?

**Decision:** Use Cloudflare Workers with HTTP Interactions instead of Gateway-based bot.

**Rationale:**
- Zero cold start latency (Workers are globally distributed)
- No persistent connections to maintain
- Automatic scaling with no infrastructure management
- Lower cost at scale (pay per request vs always-on server)

**Trade-offs:**
- Cannot receive Gateway events (presence, guild member updates)
- Limited to slash commands and interactions
- 15-minute timeout for deferred responses

### Why Service Bindings?

**Decision:** Use Cloudflare Service Bindings for worker-to-worker communication.

**Rationale:**
- Zero HTTP overhead between workers
- Automatic request routing
- Shared security context
- Type-safe with proper bindings

### Why D1 for Presets?

**Decision:** Use Cloudflare D1 (SQLite) instead of KV for community presets.

**Rationale:**
- Relational data model (presets, votes, users)
- SQL query capabilities for filtering/sorting
- ACID transactions for vote integrity
- Lower cost for read-heavy workloads

---

## Known Issues

### Discord Interaction Timeouts

**Issue:** Complex image processing can approach the 3-second initial response deadline.

**Workaround:** All image commands use deferred responses immediately.

**Status:** Monitored, no action needed unless latency increases.

### CORS Limitations

**Issue:** Some image URLs cannot be fetched due to CORS restrictions.

**Workaround:** Proxy requests through worker when possible, or request users upload directly.

**Status:** Accepted limitation of browser security model.

### KV Eventual Consistency

**Issue:** Favorites/collections may show stale data for up to 60 seconds.

**Workaround:** Cache TTL set to 60s, users informed in documentation.

**Status:** Acceptable for non-critical user data.

---

## Technical Debt

### Priority 1 (High)

| Item | Location | Notes |
|------|----------|-------|
| Error boundaries | Web app | Add React-style error boundaries to Lit components |
| Rate limiting tests | Discord worker | Improve coverage of edge cases |
| D1 migrations | Presets API | Document rollback procedures |

### Priority 2 (Medium)

| Item | Location | Notes |
|------|----------|-------|
| Bundle size | Web app | Tree-shake unused core library exports |
| Test coverage | Core library | Increase from 85% to 90% |
| Documentation | All | Add JSDoc to all public APIs |

### Priority 3 (Low)

| Item | Location | Notes |
|------|----------|-------|
| Legacy cleanup | Deprecated folder | Remove after 6 months |
| Unused translations | Core library | Audit and remove dead keys |
| SVG optimization | Discord worker | Run SVGO on all assets |

---

## Audit Remediation

Summary of action items from the December 2024 code audit.

### Completed

- [x] Input validation on all API endpoints
- [x] Rate limiting on Discord commands
- [x] JWT signature verification
- [x] D1 parameterized queries (no SQL injection)

### In Progress

- [ ] Add CSP headers to web app
- [ ] Implement request signing between workers
- [ ] Add security headers to all responses

### Planned

- [ ] Regular dependency audits (monthly)
- [ ] Penetration testing (quarterly)
- [ ] Security documentation review (bi-annually)

For detailed audit findings, see [Historical: Code Audit](../historical/20251214-CodeAudit/).

---

## Version Compatibility Matrix

| Core Version | Web App | Discord Worker | Notes |
|--------------|---------|----------------|-------|
| 1.4.0 | 3.1.0+ | 2.2.0+ | Current |
| 1.3.x | 3.0.x | 2.0.x | Previous stable |
| 1.2.x | 2.x | 1.x | Legacy (unsupported) |

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Current system design
- [Historical Index](../historical/index.md) - Development history
- [Environment Variables](../developer-guides/environment-variables.md) - All secrets and config
