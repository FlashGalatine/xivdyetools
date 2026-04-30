# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **local-only developer tool** for adding new dyes to the `@xivdyetools/core` package. It is a Vue 3 + Vite SPA backed by an Express 5 server that owns the file I/O against the sibling `@xivdyetools/core` workspace package.

This tool is **not deployed anywhere**. It refuses to run with `NODE_ENV=production`, and the Express server binds to `127.0.0.1` only. All mutations are gated behind a session token + write-rate-limit + Zod schema validation, but those are defenses against accidental misuse on the dev box, not a production posture.

The standard workflow:

1. Look up the new dye's item on XIVAPI.
2. Fill in the Vue form (item ID, hex, category, acquisition, flags, locale names).
3. Optionally auto-fetch en/ja/de/fr names from XIVAPI.
4. Save — Express writes both `colors_xiv.json` and the six `locales/*.json` files in `@xivdyetools/core`.
5. Continue downstream by hand: `dyenames.csv` for ko/zh and the `build:locales` regeneration.

## Commands

```bash
npm run dev                  # concurrently runs dev:server + dev:client
npm run dev:client           # vite, localhost:5174
npm run dev:server           # tsx server/api.ts, http://127.0.0.1:3001
npm run build                # vue-tsc --noEmit && vite build
npm run preview              # serve the built dist/
npm run type-check           # vue-tsc --noEmit
```

There is no test or lint script in this app; type-check is the only static gate.

### Pre-commit Checklist

```bash
npm run type-check && npm run build
```

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Vue 3 SPA (Vite, port 5174)                         │
│   App.vue ── DyeForm.vue                             │
│       ├─ ItemIdFetcher  ── xivapiService.fetchItemNames
│       ├─ ColorInput     ── colorService (hex/RGB/HSV)│
│       ├─ CategorySelect / AcquisitionInput / Flags   │
│       ├─ LocaleInputs   (en/ja/de/fr/ko/zh)          │
│       ├─ PreviewCard                                 │
│       └─ ValidationMessages                          │
│              │                                       │
│              ▼  fileService (HTTP @ localhost:3001)  │
└──────────────────────────────────────────────────────┘
                       │
                       ▼   X-Session-Token header
┌──────────────────────────────────────────────────────┐
│  Express 5 server (server/api.ts, 127.0.0.1:3001)    │
│   middleware: timeout → requestLogger → globalLimiter│
│               cors(localhost:5174) → contentType     │
│               json(10mb) → requireAuth (/api/*)      │
│   POST /api/auth/session   (sessionLimiter)          │
│   GET  /api/colors                                   │
│   POST /api/colors           (writeLimiter + Zod)    │
│   GET  /api/locale/:code                             │
│   POST /api/locale/:code     (writeLimiter + Zod)    │
│   GET  /api/validate/:itemId                         │
│   GET  /api/locales/labels                           │
│              │                                       │
│              ▼  fs/promises                          │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
   ../../packages/core/src/data/colors_xiv.json
   ../../packages/core/src/data/locales/{en,ja,de,fr,ko,zh}.json
```

### Key Directories

```
src/                                      (Vue 3 SPA)
├── App.vue                               # Header + DyeForm + toast
├── main.ts                               # createApp entry
├── env.d.ts                              # Vite env types
├── components/
│   ├── DyeForm.vue                       # Top-level form, validation, submit
│   ├── ItemIdFetcher.vue                 # XIVAPI lookup + en/ja/de/fr autofill
│   ├── ColorInput.vue                    # Hex picker + RGB/HSV preview
│   ├── CategorySelect.vue                # Dye category dropdown
│   ├── AcquisitionInput.vue              # Acquisition source(s) editor
│   ├── FlagsInput.vue                    # Boolean flags (gear/glamour/etc.)
│   ├── LocaleInputs.vue                  # Six per-locale name inputs
│   ├── PreviewCard.vue                   # Live dye-card preview
│   └── ValidationMessages.vue            # Aggregated error list
├── services/
│   ├── colorService.ts                   # Wraps @xivdyetools/core color helpers
│   ├── fileService.ts                    # HTTP client + session-token retry-once logic
│   └── xivapiService.ts                  # Calls https://v2.xivapi.com (en/ja/de/fr only)
├── utils/
│   ├── constants.ts                      # LOCALE_CODES, XIVAPI_SUPPORTED_LOCALES, defaults
│   └── fetchWithTimeout.ts               # AbortController-based fetch wrapper
├── types/index.ts                        # Dye, LocaleData, LocaleCode, FormState, ...
└── styles/                               # Tailwind input

server/                                   (Express 5 API)
├── api.ts                                # App wiring, route handlers, startup guard
├── schemas.ts                            # Zod: DyeArraySchema, LocaleDataSchema
├── auth/                                 # Session manager (token issuance + validation)
├── middleware/
│   ├── auth.ts                           # requireAuth + sessionManager
│   ├── validation.ts                     # validateBody(zodSchema)
│   ├── rateLimiting.ts                   # globalLimiter / writeLimiter / sessionLimiter
│   ├── timeout.ts                        # 30s request timeout
│   ├── requestLogger.ts                  # Adds requestId, structured access logs
│   ├── contentType.ts                    # Rejects non-JSON mutations
│   └── errorHandler.ts                   # 404 + global error handler
└── utils/
    ├── pathValidation.ts                 # validateBasePaths + validateFilePath (no escape)
    └── logger.ts                         # Backend logger
```

## Configuration

### Frontend (Vite)

- Dev server on port `5174`, opens automatically.
- `@/` alias points at `src/`.
- Tailwind via `@tailwindcss/postcss` (config in `tailwind.config.js`).

### Backend (Express)

| Env var | Default | Purpose |
|---------|---------|---------|
| `PORT` | `3001` | Bind port |
| `NODE_ENV` | — | If `production`, the server **refuses to start** |
| `MAINTAINER_API_KEY` | — | Optional alternate auth header (`X-API-Key`) for scripted callers |

The server resolves `CORE_PATH = path.resolve(__dirname, '../../xivdyetools-core')` — the imported sibling layout still uses the old `xivdyetools-core` directory name. If the workspace path changes, fix this constant.

## Workflow: Adding a New Dye End-to-End

1. **Start both processes:** `pnpm --filter xivdyetools-maintainer run dev`. The Vite app opens at `http://localhost:5174`. The form's mounted hook calls `checkServerHealth()`, which establishes a session token cached in memory.
2. **Item ID lookup (`ItemIdFetcher`):** Paste the FFXIV item ID. The frontend calls XIVAPI v2 for each of `en, ja, de, fr` (the only languages it serves) and pre-fills `LocaleInputs`. Korean and Chinese remain empty for manual entry.
3. **Duplicate check:** `GET /api/validate/:itemId` confirms the ID isn't already in `colors_xiv.json`. The form blocks submission if it is.
4. **Color, category, flags:** Hex feeds `colorService` to derive RGB/HSV for the preview card. Category, acquisition, and flag editors mirror the existing `Dye` shape from `@xivdyetools/types`.
5. **Submit:** `addDyeToDatabase()` runs four steps in order:
   - `GET /api/colors` (read).
   - Append the new dye locally.
   - `POST /api/colors` with the full array (Zod-validated by `DyeArraySchema`).
   - For each of six locales: `GET → mutate `dyeNames[itemID]` and `meta.dyeCount/generated` → `POST` (Zod-validated by `LocaleDataSchema`).
6. **What the maintainer does NOT do:** Update `dyenames.csv` (ko/zh source), regenerate locale builds via `build:locales`, or publish `@xivdyetools/core` to npm. After saving, finish manually: edit `dyenames.csv` for ko/zh, run `build:locales` in core, bump core's version, and publish.

## Key Patterns

### Auth Token Lifecycle

`fileService.ts` keeps a single in-memory `sessionToken`. Mutations attach it as `X-Session-Token`. On 401/403 the helper invalidates the token, calls `POST /api/auth/session` to mint a fresh one, and retries the request **exactly once**. This handles the common case where the dev server was restarted without the SPA reloading.

```typescript
const response = await fetchWithTimeout(url, { ...options, headers }, timeout);
if (response.status === 401 || response.status === 403) {
  invalidateSession();
  const newToken = await getSessionToken(true);
  return fetchWithTimeout(url, { ...options, headers: retryHeaders }, timeout);
}
```

### Path Traversal Hardening

Every locale endpoint runs the resolved file path through `validateFilePath(filePath, LOCALES_PATH)` before any read/write. `validateBasePaths` runs at startup to ensure `colors_xiv.json` and `locales/` exist where expected; if not, the server exits.

### Zod Schemas for Mutations

`server/schemas.ts` exports `DyeArraySchema` and `LocaleDataSchema`. The `validateBody(schema)` middleware short-circuits to `400` on shape mismatch, so the Express handlers only see well-formed payloads.

### Multi-Layer Rate Limits

| Limiter | Scope | Limit |
|---------|-------|-------|
| `globalLimiter` | All requests | 1000 / 15 min |
| `writeLimiter` | Mutation routes | 30 / 1 min |
| `sessionLimiter` | `POST /api/auth/session` | 10 / 15 min |

These are protective, not adversarial — the server is on `127.0.0.1` only.

### Production Guard

`server/api.ts` first lines:

```typescript
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Maintainer service must NOT run in production!');
  process.exit(1);
}
```

If the Express logs say `Maintainer service must NOT run in production`, you launched it with the wrong `NODE_ENV`.

## Dependencies

### Frontend

| Package | Purpose |
|---------|---------|
| `vue` | UI framework (3.5) |
| `@xivdyetools/core` | Dye types + color helpers |
| `zod` | Currently unused on the frontend; kept for parity |

### Backend

| Package | Purpose |
|---------|---------|
| `express` | HTTP server (5.x) |
| `cors` | CORS pinned to `localhost:5174` |
| `express-rate-limit` | Per-route limiters |
| `zod` | Mutation payload validation |
| `tsx` | Dev runtime for `server/api.ts` |
| `concurrently` | Parallel dev:client + dev:server |

## Related Projects

**Dependencies:**
- `@xivdyetools/core` — what this tool actually edits

**Edits files in:** `packages/core/src/data/colors_xiv.json` and `packages/core/src/data/locales/{en,ja,de,fr,ko,zh}.json` (the legacy path constant in `server/api.ts` resolves to `../../xivdyetools-core`).

**Downstream pipeline (manual):** `fetch_dye_names.py` → `dyenames.csv` → `build-locales.ts` (regenerates locale JSON, including `meta.generated` timestamps that may overwrite changes from this tool).
