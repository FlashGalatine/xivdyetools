# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Developer tool for adding new dyes to the `xivdyetools-core` library. A Vue 3 + TypeScript frontend with an Express backend for file I/O operations. This is a **local development tool only** - not meant for production deployment.

## Commands

```bash
npm run dev          # Start both frontend (Vite) and backend (Express) concurrently
npm run dev:client   # Start only the Vite dev server (port 5174)
npm run dev:server   # Start only the Express API server (port 3001)
npm run build        # Type-check with vue-tsc then build with Vite
npm run type-check   # Run vue-tsc type checking only
```

## Architecture

### Frontend-Backend Split
- **Frontend** (`src/`): Vue 3 SFC components with TypeScript
- **Backend** (`server/api.ts`): Express server that reads/writes JSON files to the sibling `xivdyetools-core` directory

### Core Dependency
This project depends on `@xivdyetools/core` located at `../xivdyetools-core`. The maintainer tool modifies files in that sibling repository:
- `xivdyetools-core/src/data/colors_xiv.json` - Main dye database
- `xivdyetools-core/src/data/locales/{en,ja,de,fr,ko,zh}.json` - Locale files

### Key Services
- `colorService.ts`: Wraps `@xivdyetools/core` ColorService for hex/RGB/HSV conversion
- `xivapiService.ts`: Fetches localized item names from XIVAPI v2 (supports en, ja, de, fr only)

### API Security
The Express server requires `MAINTAINER_API_KEY` environment variable for write operations (POST requests). Read operations (GET) don't require authentication.

## Path Alias

Use `@/` to import from `src/` directory (configured in both vite.config.ts and tsconfig.json).
