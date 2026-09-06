# XIV Dye Tools Documentation

> The documentation hub for the XIV Dye Tools monorepo — architecture, per-project deep dives,
> user guides, operations, specifications and research.

**Start at [index.md](./index.md)**, the navigable front page. This file is the folder map.

## Folders

| Folder | What lives there | Maintained? |
|--------|------------------|-------------|
| [architecture/](./architecture/index.md) | Ecosystem overview, dependency graph, service bindings, API contracts, data flows, security trade-offs | Yes |
| [projects/](./projects/) | Deep-dive documentation per package and application ([index](./projects/index.md)) | Yes |
| [developer-guides/](./developer-guides/) | Setup, testing, deployment, release process, contributing ([index](./developer-guides/index.md)) | Yes |
| [user-guides/](./user-guides/) | End-user guides for the web app, Discord bot, and public API ([index](./user-guides/index.md)) | Yes |
| [maintainer/](./maintainer/) | The canonical dye-addition workflow ([adding-dyes.md](./maintainer/adding-dyes.md)) | Yes |
| [operations/](./operations/index.md) | Deploy environments, secret rotation, moderation, analytics queries, the open items list | Yes |
| [specifications/](./specifications/) | Feature specifications and the roadmap ([index](./specifications/index.md)) | Yes |
| [reference/](./reference/index.md) | Glossary and FFXIV terminology | Yes |
| [versions.md](./versions.md) | **The** version matrix — the only version table in `docs/`, checked against `package.json` in CI | Yes |
| [research/](./research/index.md) | Investigations that preceded a build — one directory per decision ([index](./research/index.md)) | Body frozen once built; index and links kept valid |
| [superpowers/](./superpowers/README.md) | Design specs and implementation plans written by the planning skills, one pair per feature ([index](./superpowers/README.md)) | Body frozen once built; `Status:` lines and links kept valid |
| [audits/](./audits/index.md) | Dated audit archives — snapshots of what was found and what was done ([index](./audits/index.md)) | Frozen |
| [historical/](./historical/) | Archived documentation from previous development phases ([index](./historical/index.md)) | Frozen |

"Frozen" folders describe the state of the code on the date in their path or header and are not
corrected when the code moves on. `audits/` and `historical/` are pure archive (not even
link-checked); `research/` and `superpowers/` keep their bodies frozen but their `Status:` lines
and links are maintained, and `pnpm docs:check-links` covers them.

## Contributing

When adding new documentation:

1. Put it in the folder above that matches its purpose; dated snapshots (audits, research,
   plans) go under a `YYYY-MM-DD-<topic>` directory.
2. Include a header with status and date; add an author line if more than one person writes here.
3. Link it from the folder's index (`index.md` or `README.md`) so it is reachable from
   [index.md](./index.md).
4. Do not add a version table — link to [versions.md](./versions.md) instead. The two version
   tables that exist (root `README.md` and `versions.md`) are checked by `pnpm docs:check-versions`.

### Document Template

```markdown
# Feature Name

**Status**: Draft | In Progress | Complete
**Date**: YYYY-MM-DD

## Overview

Brief description of the feature.

## Requirements

- Requirement 1
- Requirement 2

## Design

Technical design details...

## Implementation Notes

Any implementation-specific details...
```

## License

MIT © 2025-2026 Flash Galatine

## Legal Notice

**This is a fan-made tool and is not affiliated with or endorsed by Square Enix Co., Ltd. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**

## Support

- **Issues**: [GitHub Issues](https://github.com/FlashGalatine/xivdyetools/issues)
- **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)
