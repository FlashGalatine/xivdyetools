# CLAUDE.md Audit Report

**Generated:** 2026-01-18
**Project Root:** c:\Users\DrawF\OneDrive\Projects\CodingProjects\XIVProjects
**Auditor:** Claude Code

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total Projects Audited** | 12 |
| **Projects with CLAUDE.md** | 12 (100%) |
| **Critical Issues** | 3 |
| **Recommended Fixes** | 8 |
| **Nice-to-Have Improvements** | 6 |

### Key Findings at a Glance

1. **All 12 projects have CLAUDE.md files** - excellent documentation coverage
2. **3 critical accuracy issues** - incorrect coverage thresholds and outdated versions
3. **Section naming is inconsistent** - "Commands" vs "Quick Commands" vs "Common Commands"
4. **Security documentation missing** from 4 auth-handling projects
5. **Testing section missing** from 7 projects that have test suites

---

## Section Coverage Matrix

Legend: ✓ = Present | ✗ = Missing | (variant) = Present with different name

| Section | core | discord-worker | docs | logger | maintainer | mod-worker | oauth | presets-api | test-utils | types | uni-proxy | web-app |
|---------|:----:|:--------------:|:----:|:------:|:----------:|:----------:|:-----:|:-----------:|:----------:|:-----:|:---------:|:-------:|
| Project Overview | ✓ | (Overview) | (Doc Bible) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Commands | ✓ | (Quick Cmd) | (Quick Cmd) | (Dev Cmd) | ✓ | (Common) | ✓ | ✓ | ✓ | ✓ | ✓ | (Quick Cmd) |
| Architecture | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Testing | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | (partial) |
| Key Patterns | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Env Variables | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Security Patterns | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Important Gotchas | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Related Projects | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Dependencies | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | (Service Deps) |
| Localization | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Deployment Checklist | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

---

## Findings by Severity

### CRITICAL (Must Fix)

#### C1: Incorrect Coverage Threshold - xivdyetools-core

| Attribute | Details |
|-----------|---------|
| **Project** | xivdyetools-core |
| **File** | [CLAUDE.md](../../xivdyetools-core/CLAUDE.md) line 127 |
| **Current State** | States "Coverage threshold: 85% minimum" |
| **Actual State** | vitest.config.ts enforces **90%** lines/functions/statements, **88%** branches |
| **Impact** | Developers may target wrong coverage, PRs could fail unexpectedly |
| **Recommendation** | Update CLAUDE.md line 127 to: "Coverage threshold: 90% (lines, functions, statements), 88% branches" |

#### C2: Outdated Version Number - xivdyetools-discord-worker

| Attribute | Details |
|-----------|---------|
| **Project** | xivdyetools-discord-worker |
| **File** | [CLAUDE.md](../../xivdyetools-discord-worker/CLAUDE.md) line 7 |
| **Current State** | States "**Version 2.0.0**" |
| **Actual State** | package.json shows **v2.3.3** |
| **Impact** | Misleading version information, confusion about feature availability |
| **Recommendation** | Either update version to current (2.3.3), or remove version from CLAUDE.md entirely (versions change frequently) |

#### C3: Missing Security Documentation for Auth-Handling Projects

| Attribute | Details |
|-----------|---------|
| **Projects Affected** | xivdyetools-oauth, xivdyetools-presets-api, xivdyetools-discord-worker, xivdyetools-moderation-worker |
| **Current State** | No "Security Patterns" section |
| **Expected State** | Security-sensitive projects should document: token handling, signature verification, CORS policies, input validation |
| **Impact** | AI assistants may not follow security best practices, contributors may introduce vulnerabilities |
| **Recommendation** | Add "Security Patterns" section modeled after xivdyetools-web-app's comprehensive security documentation |

---

### RECOMMENDED (Should Fix)

#### R1: Inconsistent Section Naming - "Commands"

| Variant | Projects Using |
|---------|---------------|
| "Commands" | core, maintainer, oauth, presets-api, test-utils, types, universalis-proxy |
| "Quick Commands" | discord-worker, docs, web-app |
| "Development Commands" | logger |
| "Common Commands" | moderation-worker |

**Recommendation:** Standardize to "Commands" across all projects.

#### R2: Inconsistent Section Naming - "Project Overview"

| Variant | Projects Using |
|---------|---------------|
| "Project Overview" | core, logger, maintainer, moderation-worker, oauth, presets-api, test-utils, types, universalis-proxy, web-app |
| "Overview" | discord-worker |
| "Documentation Bible" | docs |

**Recommendation:** Standardize to "Project Overview" (docs can keep unique name as it's a special-purpose project).

#### R3: Missing "Testing" Section

| Projects Missing | Has Tests? |
|------------------|-----------|
| xivdyetools-discord-worker | Yes |
| xivdyetools-moderation-worker | Yes |
| xivdyetools-oauth | Has test scripts in package.json |
| xivdyetools-presets-api | No |
| xivdyetools-test-utils | Yes (meta - tests its own mocks) |
| xivdyetools-universalis-proxy | Yes |
| xivdyetools-maintainer | No |

**Recommendation:** Add "Testing" section to projects with test suites documenting:
- Test command (`npm test`)
- Running single test files
- Coverage thresholds (if applicable)

#### R4: Missing "Related Projects" Section

Only **xivdyetools-moderation-worker** has this section.

**Recommendation:** Add "Related Projects" to all projects listing:
- Dependencies (packages this project imports from ecosystem)
- Dependents (packages that depend on this)
- Sibling projects (related by function)

#### R5: Missing "Deployment Checklist" for Cloudflare Workers

Only **xivdyetools-universalis-proxy** has this section.

**Affected Workers:**
- xivdyetools-discord-worker
- xivdyetools-moderation-worker
- xivdyetools-oauth
- xivdyetools-presets-api

**Recommendation:** Add deployment checklist covering:
- Secret management (`wrangler secret put`)
- Environment verification
- Post-deploy validation

#### R6: Missing "Important Gotchas" Section

Only **xivdyetools-web-app** has this section.

**Recommendation:** Add gotchas sections to complex projects (at minimum: core, discord-worker, presets-api) documenting:
- Common mistakes
- Non-obvious behaviors
- Breaking change risks

#### R7: xivdyetools-docs CLAUDE.md Says "10 Active Projects"

| Attribute | Details |
|-----------|---------|
| **File** | [CLAUDE.md](../../xivdyetools-docs/CLAUDE.md) line 21 |
| **Current State** | States "**10 Active Projects**" |
| **Actual State** | There are **12** xivdyetools-* projects |
| **Recommendation** | Update count or clarify which projects are considered "active" |

#### R8: Inconsistent "Localization" Documentation

Projects supporting i18n but not documenting it in CLAUDE.md:
- xivdyetools-core (mentioned in Project Overview, not separate section)
- xivdyetools-web-app (mentioned in Service Dependencies table)

**Recommendation:** Standardize localization documentation across i18n-supporting projects.

---

### NICE-TO-HAVE (Optional Improvements)

#### N1: Standardize Architecture Diagram Style

| Style | Projects Using |
|-------|---------------|
| ASCII flow diagrams | core, oauth, presets-api, universalis-proxy |
| Directory tree structure | logger, maintainer, test-utils, web-app |
| Mixed (flow + tree) | discord-worker, moderation-worker |
| None | docs, types |

**Suggestion:** Use consistent style (ASCII flow for request flows, tree for directory structure).

#### N2: Add Pre-commit Checklist

Only **xivdyetools-web-app** documents the pre-commit workflow:
```bash
npm run lint && npm run test -- --run && npm run build
```

**Suggestion:** Standardize this pattern across all projects.

#### N3: Missing Documentation Links Section

Only **xivdyetools-web-app** has a "Documentation" section with links to additional docs.

**Suggestion:** Add documentation links section to projects with extensive docs folders.

#### N4: Environment Variable Documentation Format Inconsistency

| Format | Projects Using |
|--------|---------------|
| Bullet list with descriptions | oauth, universalis-proxy |
| Tables (Required/Optional) | discord-worker |
| Split (wrangler.toml + secrets) | presets-api |

**Suggestion:** Standardize on table format with columns: Variable, Source (toml/secret), Description.

#### N5: Add Line Count/Complexity Indicator

Some CLAUDE.md files are very detailed (218 lines for web-app) while others are minimal (40 lines for maintainer). Consider adding a complexity indicator to help Claude Code adjust verbosity expectations.

#### N6: Add "Last Updated" Timestamp

No CLAUDE.md files include a last-updated date, making it difficult to assess staleness.

---

## Per-Project Details

### xivdyetools-core
- **Lines:** 138
- **Sections:** 9 (Project Overview, Commands, Architecture, Usage Patterns, Testing, Publishing)
- **Strengths:** Comprehensive architecture docs, performance optimization details, branded types pattern well-documented
- **Issues:**
  - [CRITICAL] Coverage threshold incorrect (states 85%, actual 90%)
  - [RECOMMENDED] Missing "Key Patterns" section
  - [RECOMMENDED] Missing "Related Projects" section

### xivdyetools-discord-worker
- **Lines:** 215
- **Sections:** 13 (Overview, Quick Commands, Architecture, Key Patterns, Dependencies, Localization, Available Commands, Webhook Endpoints, Analytics)
- **Strengths:** Most comprehensive CLAUDE.md, excellent command documentation, rate limiting documented
- **Issues:**
  - [CRITICAL] Version outdated (2.0.0 vs actual 2.3.3)
  - [CRITICAL] Missing Security Patterns section despite handling Discord tokens
  - [RECOMMENDED] Missing Testing section despite having tests
  - [RECOMMENDED] Section name "Overview" instead of "Project Overview"
  - [RECOMMENDED] Section name "Quick Commands" instead of "Commands"

### xivdyetools-docs
- **Lines:** ~142
- **Sections:** 5 (Documentation Bible, Monorepo Quick Reference, Quick Commands, Architecture Quick Reference, Key Patterns, Cross-Project References)
- **Strengths:** Good index/reference structure, links to detailed documentation
- **Issues:**
  - [RECOMMENDED] States "10 Active Projects" but there are 12
  - [NICE-TO-HAVE] Unique section naming may be intentional (Documentation Bible)

### xivdyetools-logger
- **Lines:** 63
- **Sections:** 7 (Project Overview, Development Commands, Architecture, Entry Points, Testing, Key Patterns)
- **Strengths:** Clean structure, adapter pattern well-documented
- **Issues:**
  - [RECOMMENDED] Section name "Development Commands" instead of "Commands"

### xivdyetools-maintainer
- **Lines:** ~40
- **Sections:** 5 (Project Overview, Commands, Architecture, Path Alias)
- **Strengths:** Appropriate brevity for simple tool
- **Issues:**
  - [RECOMMENDED] Missing Core Dependency documentation (states dependency but doesn't explain version sync requirements)

### xivdyetools-moderation-worker
- **Lines:** 91
- **Sections:** 8 (Project Overview, Common Commands, Architecture, Key Patterns, Related Projects)
- **Strengths:** Only project with "Related Projects" section - good template for others
- **Issues:**
  - [CRITICAL] Missing Security Patterns section despite handling moderator verification
  - [RECOMMENDED] Section name "Common Commands" instead of "Commands"
  - [RECOMMENDED] Missing Testing section despite having tests

### xivdyetools-oauth
- **Lines:** 78
- **Sections:** 6 (Project Overview, Commands, Architecture, Environment Variables, Key Implementation Details)
- **Strengths:** OAuth flow well-documented, PKCE requirements clear
- **Issues:**
  - [CRITICAL] Missing Security Patterns section despite being core auth provider
  - [RECOMMENDED] Missing Testing section
  - [RECOMMENDED] Missing Deployment Checklist

### xivdyetools-presets-api
- **Lines:** 104
- **Sections:** 8 (Project Overview, Commands, Architecture, Key Patterns, Environment Variables, API Route Structure, Development Notes)
- **Strengths:** Good API documentation, moderation pipeline explained
- **Issues:**
  - [CRITICAL] Missing Security Patterns section despite handling JWT verification
  - [RECOMMENDED] Missing Deployment Checklist

### xivdyetools-test-utils
- **Lines:** 67
- **Sections:** 6 (Project Overview, Commands, Architecture, Key Patterns, Dependencies)
- **Strengths:** Clear subpath exports documentation, mock patterns documented
- **Issues:**
  - [RECOMMENDED] Missing Testing section (ironic for a test utils package)

### xivdyetools-types
- **Lines:** 59
- **Sections:** 5 (Project Overview, Commands, Architecture, Testing)
- **Strengths:** Branded types pattern well-documented, Result type pattern clear
- **Issues:**
  - [RECOMMENDED] Missing "Key Patterns" section (branded types could be elevated to key pattern)

### xivdyetools-universalis-proxy
- **Lines:** 73
- **Sections:** 7 (Project Overview, Commands, Architecture, Environment Variables, Testing Locally, Deployment Checklist)
- **Strengths:** Only worker with Deployment Checklist - good template, testing examples helpful
- **Issues:**
  - [RECOMMENDED] Missing "Key Patterns" section

### xivdyetools-web-app
- **Lines:** 218
- **Sections:** 11 (Project Overview, Quick Commands, Architecture, Key Patterns, Important Gotchas, Service Dependencies, Custom Vite Plugins, Security Patterns, Documentation)
- **Strengths:** **Model CLAUDE.md** - has Security Patterns, Important Gotchas, Documentation links. Most complete.
- **Issues:**
  - [RECOMMENDED] Section name "Quick Commands" instead of "Commands"

---

## Recommendations Summary

### Quick Wins (< 5 min each)

1. **Fix coverage threshold in xivdyetools-core** - Change "85%" to "90%/88%"
2. **Fix or remove version in xivdyetools-discord-worker** - Update to 2.3.3 or remove
3. **Fix project count in xivdyetools-docs** - Update "10 Active Projects" to 12
4. **Rename sections** - Global find/replace for section naming consistency

### Medium Effort (15-30 min each)

5. **Add Testing sections** - Copy pattern from xivdyetools-core or xivdyetools-logger to 7 missing projects
6. **Add Related Projects sections** - Copy pattern from xivdyetools-moderation-worker to all projects
7. **Add Deployment Checklist** - Copy pattern from xivdyetools-universalis-proxy to other Workers

### Larger Tasks (1+ hour)

8. **Add Security Patterns sections** - Write comprehensive security documentation for oauth, presets-api, discord-worker, moderation-worker using xivdyetools-web-app as template
9. **Add Important Gotchas sections** - Gather institutional knowledge for complex projects
10. **Create CLAUDE.md template** - Define standard structure and use it to sync all files

---

## Appendix A: Recommended Section Order

Based on analysis of all files, this order provides best readability:

1. **Project Overview** - 2-3 sentences describing purpose
2. **Commands** - All runnable commands with brief descriptions
3. **Architecture** - Directory structure and/or request flow diagrams
4. **Key Patterns** - Common patterns used in the codebase
5. **Environment Variables** - Configuration options (Workers only)
6. **Security Patterns** - Security considerations (auth projects only)
7. **Testing** - Test commands, coverage thresholds
8. **Important Gotchas** - Common mistakes, non-obvious behaviors
9. **Related Projects** - Dependencies and dependents
10. **Documentation** - Links to additional documentation

---

## Appendix B: Template CLAUDE.md Structure

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

[2-3 sentences describing what this project does and its role in the ecosystem]

## Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run test             # Run tests
npm run type-check       # TypeScript validation
npm run lint             # ESLint check
```

## Architecture

[Directory tree and/or request flow diagram]

## Key Patterns

[Common patterns with code examples]

## Testing

- Coverage threshold: X%
- Test location: `src/**/*.test.ts`
- Run single file: `npx vitest run path/to/file.test.ts`

## Related Projects

- **Dependencies:** [packages this imports]
- **Dependents:** [packages that import this]
```

---

*End of Audit Report*
