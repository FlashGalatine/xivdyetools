# Preset Refinements - December 7, 2025

## Overview

This document tracks the implementation of preset refinements across the XIV Dye Tools ecosystem, including voting, editing, sharing, and bug fixes.

## Scope

### New Features

| Feature | API | Discord | Web App |
|---------|-----|---------|---------|
| Vote for presets | Exists | Exists | **Adding** |
| Edit presets (with moderation) | **Adding** | **Adding** | **Adding** |
| Share button (permalink) | Exists | N/A | **Adding** |

### Bug Fixes

| Bug | Platform | Status |
|-----|----------|--------|
| Facewear dyes shown in submission | Web App | Pending |
| Modal doesn't dismiss after submit | Web App | Pending |
| No link to duplicate preset | Web App | Pending |

## Projects Affected

1. **xivdyetools-presets-api** - Cloudflare Worker + D1 database
2. **xivdyetools-discord-worker** - Cloudflare Worker for Discord interactions
3. **xivdyetools-web-app** - Vite + Lit web application

## Key Design Decisions

1. **Edit Scope**: Name, description, dyes, and tags are editable. Category is read-only.

2. **Edit Moderation Flow**:
   - Content moderation runs on edited name/description
   - If flagged: status becomes 'pending', previous values stored
   - Moderators can Accept (keep changes) or Revert (restore previous with reason)

3. **Duplicate Detection**: When editing dyes, check if combination exists (excluding self)

4. **Share URLs**: Clean URLs at `/presets/{id}` with client-side routing

## Documentation Files

- [API_CHANGES.md](./API_CHANGES.md) - New endpoints and schema changes
- [DISCORD_CHANGES.md](./DISCORD_CHANGES.md) - New commands and moderation buttons
- [WEB_APP_CHANGES.md](./WEB_APP_CHANGES.md) - UI changes, routing, bug fixes
- [PROGRESS.md](./PROGRESS.md) - Implementation progress tracking

## Related Documentation

- [COMMUNITY_PRESETS_SPEC.md](../COMMUNITY_PRESETS_SPEC.md) - Original preset system specification
