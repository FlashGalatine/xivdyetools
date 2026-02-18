# Historical Documentation Index

The `docs/historical/` folder preserves documentation from previous major versions, optimization initiatives, and phase reports. These files are no longer updated, but they provide helpful context when investigating regressions or comparing design decisions across phases.

## How the Folder Is Organized

- **Optimization Initiative** (`optimization-20251123/`): Complete documentation from the November 2025 3-phase optimization initiative (performance, security, refactoring).
- **Core Library Upgrades** (`CORE_UPGRADE_1.1.0.md`): Documentation for major core library version upgrades.
- **Phase Reports** (`PHASE_*`): Session-by-session status updates, bug hunts, and release notes dating back to Phase 6.
- **Testing Guides**: Browser checklists, accessibility audits, and regression plans that predate the new Vitest suite.
- **Research & Planning** (`IMPLEMENTATION_PLAN.md`, `PERFORMANCE_OPTIMIZATION_GUIDE.md`, etc.): Deep dives on architecture experiments and performance spikes.
- **Session Logs**: Chronological notes from late 2025 refactors (see the `phase12/` subfolder for the TypeScript migration diary).

## When to Use These Files

- Confirm prior behavior before TypeScript migration (e.g., how Market Board caching worked in v1.6.x).
- Reference legacy UX patterns or assets that still live in the `legacy/` HTML snapshots.
- Pull historical screenshots or copy for changelogs without rewriting old context.

## Editing Guidelines

1. **Do not modify** the historical markdown files unless you are fixing spelling or broken links.
2. Add new research docs for v2.x work in `docs/` at the root instead of here.
3. If a legacy document is superseded by modern docs, link to the replacement at the top of the historical file.

Maintaining this archive prevents knowledge drift while keeping `docs/` focused on the current architecture.
