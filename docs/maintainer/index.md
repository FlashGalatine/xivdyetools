# Maintainer Reference

**Technical reference for XIV Dye Tools maintainers**

> This section consolidates architectural decisions, known issues, technical debt, and audit findings for long-term project maintenance.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Adding New Dyes (Manual)](adding-dyes.md) | Manual process and data format reference |
| [Dye Maintainer Tool](dye-maintainer-tool.md) | Retired GUI — tombstone; points at the procedure that replaced it |
| [Moderation Guide](../operations/MODERATION.md) | Managing bans and community presets |
| [Current Versions](../versions.md) | The single source of truth for every package and app version |
| [Audit Archive](../audits/index.md) | Every dated audit, newest first |
| [Architecture Decisions](#architecture-decisions) | Why we built things this way |
| [Known Issues](#known-issues) | Current limitations and workarounds |
| [Technical Debt](#technical-debt) | Areas needing improvement |

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

**Issue:** KV reads are eventually consistent, so a write may not be visible everywhere immediately.

**Scope:** This no longer applies to dye favorites or collections — the bot's `/favorites` and
`/collection` commands were removed in 5.0 and those records live only in the web app's
localStorage. What remains on KV is per-user bot state: preferences, the 5.0 first-run flag, and
`/preset favorite` (capped at 50 presets per user).

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

**Do not track audit findings here.** Every dated audit and its remediation status lives in the
[Audit Archive](../audits/index.md); carried-forward items live in
[POST_MERGE_CHECKLIST.md](../operations/POST_MERGE_CHECKLIST.md).

The list that used to sit here dated from the **December 2025** code audit
([Historical: Code Audit](../historical/20251214-CodeAudit/)) and had gone stale — its "In Progress"
items, including CSP headers on the web app, have since shipped.

---

## Versions

Versions are **not** recorded in this file. `docs/versions.md` is the single source of truth for
every package and app version, and CI (`pnpm docs:check-versions`) checks it against each
`package.json`. A compatibility matrix maintained by hand here would only drift.

See [versions.md](../versions.md).

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Current system design
- [Audit Archive](../audits/index.md) - Every dated audit
- [Current Versions](../versions.md) - Package and app versions
- [Historical Index](../historical/index.md) - Development history
- [Environment Variables](../developer-guides/environment-variables.md) - All secrets and config
