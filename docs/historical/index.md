# Historical Documentation

**Development history of XIV Dye Tools, organized by topic**

> This index provides topic-based navigation to chronological development documentation. Documents are preserved in their original dated folders for commit history integrity.

---

## Quick Navigation

| Topic | Description | Key Documents |
|-------|-------------|---------------|
| [Security & Audits](#security--audits) | Security reviews, code audits | Code Audit Dec 2024, Opus 4.5 Review |
| [Performance](#performance) | Optimization work, bundle analysis | Performance Deep Dive, Cleanup Sessions |
| [UI/UX Evolution](#uiux-evolution) | Interface design, component development | v3 UI Rehaul, Phase 6-12, SVG Redesign |
| [Migrations](#migrations) | Platform migrations, integrations | Discord Bot Migration, Localization |
| [Releases](#releases) | Version releases, release notes | v2.0.0 Release |
| [Legacy](#legacy) | Pre-monorepo v1.6 documentation | Legacy v1.6 Archive |

---

## Security & Audits

Security reviews, code quality audits, and remediation work.

### December 2024 Code Audit
**Location:** [20251214-CodeAudit/](20251214-CodeAudit/)

Comprehensive security and code quality audit across all 5 projects.

| Document | Description |
|----------|-------------|
| [Executive Summary](20251214-CodeAudit/00-EXECUTIVE-SUMMARY.md) | High-level findings |
| [Core Library](20251214-CodeAudit/01-CORE-LIBRARY.md) | Core package audit |
| [Web App](20251214-CodeAudit/02-WEB-APP.md) | Web application audit |
| [Discord Worker](20251214-CodeAudit/03-DISCORD-WORKER.md) | Discord bot audit |
| [OAuth Worker](20251214-CodeAudit/04-OAUTH-WORKER.md) | OAuth service audit |
| [Presets API](20251214-CodeAudit/05-PRESETS-API.md) | Presets API audit |
| [Cross-Cutting](20251214-CodeAudit/06-CROSS-CUTTING.md) | Shared concerns |
| [Remediation Roadmap](20251214-CodeAudit/07-REMEDIATION-ROADMAP.md) | Fix prioritization |

### Deep Dive Analysis
**Location:** [20251207-DeepDive/](20251207-DeepDive/)

Architectural deep dive and system analysis.

### Opus 4.5 Security Review
**Location:** [web-app/20251124-Opus45/](web-app/20251124-Opus45/)

AI-assisted security and performance review.

| Document | Description |
|----------|-------------|
| [Audit Summary](web-app/20251124-Opus45/00-AUDIT-SUMMARY.md) | Overview |
| [Security Findings](web-app/20251124-Opus45/01-SECURITY-FINDINGS.md) | Security issues |
| [Performance Status](web-app/20251124-Opus45/02-PERFORMANCE-STATUS.md) | Performance analysis |
| [Refactoring](web-app/20251124-Opus45/03-REFACTORING-OPPORTUNITIES.md) | Improvement areas |

### Initial Optimization Review
**Location:** [web-app/20251123-Optimization/](web-app/20251123-Optimization/)

First comprehensive optimization pass.

| Document | Description |
|----------|-------------|
| [Executive Summary](web-app/20251123-Optimization/00-EXECUTIVE-SUMMARY.md) | Overview |
| [Performance](web-app/20251123-Optimization/01-performance-optimization.md) | Performance work |
| [Security Hardening](web-app/20251123-Optimization/02-security-hardening.md) | Security improvements |
| [Refactoring](web-app/20251123-Optimization/03-refactoring-recommendations.md) | Code improvements |

---

## Performance

Performance optimization, bundle analysis, and cleanup work.

### December 2024 Optimization
**Location:** [web-app/20251201-Optimize/](web-app/20251201-Optimize/)

Major optimization initiative focusing on architecture and bundle size.

| Document | Description |
|----------|-------------|
| [Executive Summary](web-app/20251201-Optimize/00-EXECUTIVE-SUMMARY.md) | Overview |
| [Component Architecture](web-app/20251201-Optimize/01-COMPONENT-ARCHITECTURE.md) | Architecture review |
| [Performance](web-app/20251201-Optimize/02-PERFORMANCE-OPTIMIZATION.md) | Optimization work |
| [Type Safety](web-app/20251201-Optimize/03-TYPE-SAFETY.md) | TypeScript improvements |
| [Design Patterns](web-app/20251201-Optimize/04-DESIGN-PATTERNS.md) | Pattern analysis |
| [Test Coverage](web-app/20251201-Optimize/05-TEST-COVERAGE.md) | Testing improvements |
| [Bundle Optimization](web-app/20251201-Optimize/06-BUNDLE-OPTIMIZATION.md) | Bundle size work |
| [Implementation Roadmap](web-app/20251201-Optimize/07-IMPLEMENTATION-ROADMAP.md) | Action plan |
| [Hidden Bugs](web-app/20251201-Optimize/08-HIDDEN-BUGS-REPORT.md) | Bug findings |

### Code Cleanup
**Location:** [web-app/20251202-Cleanup/](web-app/20251202-Cleanup/)

Code cleanup and critical issue resolution.

| Document | Description |
|----------|-------------|
| [Findings](web-app/20251202-Cleanup/findings.md) | Initial findings |
| [Findings 2](web-app/20251202-Cleanup/Findings2.md) | Additional findings |
| [Critical Issues Resolved](web-app/20251202-Cleanup/CRITICAL-ISSUES-RESOLVED.md) | Resolution summary |

---

## UI/UX Evolution

User interface design evolution and component development.

### v3 UI Rehaul (December 2024)
**Location:** [20251211-v3UIRehaul/](20251211-v3UIRehaul/)

Major UI redesign for version 3.0.

| Document | Description |
|----------|-------------|
| [Overview](20251211-v3UIRehaul/00-OVERVIEW.md) | Rehaul overview |
| [Architecture](20251211-v3UIRehaul/01-ARCHITECTURE.md) | New architecture |
| [Components](20251211-v3UIRehaul/02-COMPONENTS.md) | Component design |
| [Tool Mockups](20251211-v3UIRehaul/03-TOOL-MOCKUPS.md) | UI mockups |
| [Theme System](20251211-v3UIRehaul/04-THEME-SYSTEM.md) | 12 theme system |
| [Migration Checklist](20251211-v3UIRehaul/05-MIGRATION-CHECKLIST.md) | Migration guide |
| [Phase 0 Audit](20251211-v3UIRehaul/06-PHASE0-AUDIT-RESULTS.md) | Audit results |

### SVG Redesign
**Location:** [20251214-SVGRedesign/](20251214-SVGRedesign/)

SVG-based visual redesign for harmony diagrams and color outputs.

### UI/UX Improvements (November 2024)
**Location:** [web-app/20251130-UIUX/](web-app/20251130-UIUX/)

UX improvement initiative.

| Document | Description |
|----------|-------------|
| [Roadmap](web-app/20251130-UIUX/00-ROADMAP.md) | UX roadmap |
| [Onboarding](web-app/20251130-UIUX/01-ONBOARDING.md) | Onboarding flow |
| [Feedback States](web-app/20251130-UIUX/02-FEEDBACK-STATES.md) | UI feedback |
| [Accessibility](web-app/20251130-UIUX/03-ACCESSIBILITY.md) | A11y improvements |
| [Tool UX](web-app/20251130-UIUX/04-TOOL-SPECIFIC-UX.md) | Per-tool UX |
| [Quick Wins](web-app/20251130-UIUX/05-QUICK-WINS.md) | Quick improvements |
| [SVG Harmony Icons](web-app/20251130-UIUX/06-SVG-HARMONY-ICONS.md) | Icon design |

### Web App Development Phases

Original development phases for the web application.

| Phase | Location | Description |
|-------|----------|-------------|
| Phase 6 | [web-app/20251113-Phase6/](web-app/20251113-Phase6/) | Market board integration |
| Phase 9 | [web-app/20251115-Phase9/](web-app/20251115-Phase9/) | Performance & testing |
| Phase 11 | [web-app/20251116-Phase11/](web-app/20251116-Phase11/) | CSS fixes & problems |
| Phase 12 | [web-app/20251116-Phase12/](web-app/20251116-Phase12/) | Final pre-release |

---

## Migrations

Platform migrations and major integrations.

### Discord Bot Migration
**Location:** [20251207-DiscordBotMigration/](20251207-DiscordBotMigration/)

Migration to standalone Discord Worker.

| Document | Description |
|----------|-------------|
| [Architecture](20251207-DiscordBotMigration/ARCHITECTURE.md) | New architecture |
| [Fonts](20251207-DiscordBotMigration/FONTS.md) | Font handling |

### Original Discord Bot Development
**Location:** [web-app/20251122-DiscordBot/](web-app/20251122-DiscordBot/)

Initial Discord bot development documentation.

| Document | Description |
|----------|-------------|
| [README](web-app/20251122-DiscordBot/README.md) | Overview |
| [Quick Start](web-app/20251122-DiscordBot/QUICK_START.md) | Getting started |
| [Architecture](web-app/20251122-DiscordBot/ARCHITECTURE.md) | Bot architecture |
| [Commands](web-app/20251122-DiscordBot/COMMANDS.md) | Command list |
| [API Reference](web-app/20251122-DiscordBot/API_REFERENCE.md) | API docs |
| [Deployment](web-app/20251122-DiscordBot/DEPLOYMENT.md) | Deployment guide |
| [Testing](web-app/20251122-DiscordBot/TESTING.md) | Testing approach |

### Localization Implementation
**Location:** [web-app/20251127-Localization/](web-app/20251127-Localization/)

Multi-language support implementation.

| Document | Description |
|----------|-------------|
| [Implementation Plan](web-app/20251127-Localization/IMPLEMENTATION-PLAN.md) | i18n plan |
| [Translation Keys](web-app/20251127-Localization/TRANSLATION-KEYS.md) | Key structure |
| [TODO](web-app/20251127-Localization/TODO.md) | Remaining work |

### Preset Refinements
**Location:** [20251207-PresetRefinements/](20251207-PresetRefinements/)

Community presets system refinements.

---

## Releases

Version release documentation and notes.

### v2.0.0 Release
**Location:** [web-app/20251117-v2.0.0/](web-app/20251117-v2.0.0/)

Major version 2.0.0 release.

| Document | Description |
|----------|-------------|
| [Release Notes](web-app/20251117-v2.0.0/RELEASE_NOTES_v2.0.0.md) | Full release notes |
| [Browser Testing](web-app/20251117-v2.0.0/BROWSER_TESTING_CHECKLIST.md) | Testing checklist |
| [Documentation Cleanup](web-app/20251117-v2.0.0/DOCUMENTATION_CLEANUP.md) | Doc updates |
| [TODO](web-app/20251117-v2.0.0/TODO.md) | Post-release tasks |

### Core Library Upgrade
**Location:** [web-app/20251124-CoreUpgrade/](web-app/20251124-CoreUpgrade/)

Core library v1.1.0 upgrade.

| Document | Description |
|----------|-------------|
| [Core Upgrade 1.1.0](web-app/20251124-CoreUpgrade/CORE_UPGRADE_1.1.0.md) | Upgrade details |

---

## Legacy

Pre-monorepo documentation archive.

### Legacy v1.6 Archive
**Location:** [legacy-v1.6/](legacy-v1.6/)

Documentation from the original single-repository v1.6 codebase, before the monorepo restructure.

---

## Other Documents

| Document | Description |
|----------|-------------|
| [Multi-Bot Deployment](MULTI_BOT_DEPLOYMENT.md) | Running multiple bot instances |
| [README](README.md) | Historical folder overview |

---

## Chronological Index

For those who prefer date-based navigation:

| Date | Topic | Location |
|------|-------|----------|
| Nov 2024 | Web App Phases 6-12 | [web-app/](web-app/) |
| Nov 17 | v2.0.0 Release | [web-app/20251117-v2.0.0/](web-app/20251117-v2.0.0/) |
| Nov 22 | Discord Bot Dev | [web-app/20251122-DiscordBot/](web-app/20251122-DiscordBot/) |
| Nov 23 | Optimization | [web-app/20251123-Optimization/](web-app/20251123-Optimization/) |
| Nov 24 | Opus 4.5 Review | [web-app/20251124-Opus45/](web-app/20251124-Opus45/) |
| Nov 27 | Localization | [web-app/20251127-Localization/](web-app/20251127-Localization/) |
| Nov 30 | UI/UX | [web-app/20251130-UIUX/](web-app/20251130-UIUX/) |
| Dec 1-2 | Optimization & Cleanup | [web-app/20251201-Optimize/](web-app/20251201-Optimize/) |
| Dec 7 | Deep Dive | [20251207-DeepDive/](20251207-DeepDive/) |
| Dec 7 | Discord Migration | [20251207-DiscordBotMigration/](20251207-DiscordBotMigration/) |
| Dec 7 | Preset Refinements | [20251207-PresetRefinements/](20251207-PresetRefinements/) |
| Dec 11 | v3 UI Rehaul | [20251211-v3UIRehaul/](20251211-v3UIRehaul/) |
| Dec 14 | Code Audit | [20251214-CodeAudit/](20251214-CodeAudit/) |
| Dec 14 | SVG Redesign | [20251214-SVGRedesign/](20251214-SVGRedesign/) |

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Current system architecture
- [Projects Index](../projects/index.md) - Current project documentation
- [Maintainer Reference](../maintainer/index.md) - Known issues and tech debt
