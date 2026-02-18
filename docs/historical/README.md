# Historical Documentation Index

The `docs/historical/` folder preserves documentation from previous major versions, optimization initiatives, and phase reports. These files are no longer updated, but they provide helpful context when investigating regressions or comparing design decisions across phases.

## How the Folder Is Organized

All historical documentation is organized by date using the `YYYYMMDD-Name` naming convention:

### Date-Prefixed Folders

- **`20251113-Phase6/`** - Phase 6 testing, implementation planning, and setup documentation (6 files)
- **`20251115-Phase9/`** - Phase 9 bug audit, Phase 8 testing, and performance optimization guides (6 files)
- **`20251116-Phase11/`** - Phase 10-11 testing checklists and CSS fix reports (3 files)
- **`20251116-Phase12/`** - TypeScript migration phase documentation (19 files)
- **`20251117-v2.0.0/`** - v2.0.0 release notes, documentation cleanup, and browser testing (4 files)
- **`20251122-DiscordBot/`** - Discord bot documentation and guides (12 files)
- **`20251123-Optimization/`** - November 2025 3-phase optimization initiative (performance, security, refactoring) (10 files)
- **`20251124-CoreUpgrade/`** - Core library upgrade documentation and historical folder index (2 files)
- **`20251124-Opus45/`** - Comprehensive security and performance audit (4 files)

## When to Use These Files

- Confirm prior behavior before TypeScript migration (e.g., how Market Board caching worked in v1.6.x)
- Reference legacy UX patterns or assets that still live in the `legacy/` HTML snapshots
- Pull historical screenshots or copy for changelogs without rewriting old context
- Understand the evolution of architecture decisions across phases

## Editing Guidelines

1. **Do not modify** the historical markdown files unless you are fixing spelling or broken links
2. Add new research docs for v2.x work in `docs/` at the root instead of here
3. If a legacy document is superseded by modern docs, link to the replacement at the top of the historical file
4. When archiving new documentation, use the `YYYYMMDD-Name` format for folder names

Maintaining this archive prevents knowledge drift while keeping `docs/` focused on the current architecture.

