# [DEAD-029]: Stale documentation and manifest metadata that describe removed or never-deployed things

## Category
Stale Code (documentation / manifest)

## Location / Evidence
`evidence/agent-report-non-source.md` §E-F:

| File:line | Says | Reality |
|---|---|---|
| `apps/web-app/CLAUDE.md:49-50, 248` | `npm run build:css` → `assets/css/tailwind.css` (committed) | input `src/tailwind-input.css` does not exist; output is in the dead `assets/` dir; the real entry is `src/styles/tailwind.css` via PostCSS (DEAD-006) |
| `apps/web-app/CLAUDE.md:142` | `src/shared/… empty-state-icons.ts` | file is `state-icons.ts` |
| `apps/web-app/CLAUDE.md:147` | `public/ # robots.txt, manifest.json, _headers` | `public/robots.txt` does not exist — contradicts line 250 of the same file (DEAD-005) |
| `apps/web-app/CLAUDE.md:217` | "`service-worker.js` handles offline fallback for navigation requests" | the SW never ships (DEAD-003); the app has no service worker |
| `apps/web-app/scripts/README.md:40` | responsive image code in `src/components/app-layout.ts` | file does not exist (DEAD-024/026) |
| `apps/web-app/scripts/README.md` | documents 3 scripts | 8 exist |
| `apps/web-app/.env.development` (gitignored) comment | `cd xivdyetools-universalis-proxy && npm run dev` | no such directory (absorbed into api-worker) |
| `apps/web-app/package.json` `"main": "index.html"` | | no root `index.html` (DEAD-006) |
| `apps/web-app/package.json` `engines.node ">=18.0.0"` | | root `package.json` declares `>=22.13.0`; every workflow uses Node 22 — the app's floor is stale and looser than what CI runs |
| `apps/web-app/tailwind.config.js:3-5` | `darkMode` uses default `'media'` | contradicts `themes.css:130-133` ("darkMode is disabled … `dark:` variants don't exist") — needs a definitive check (DEAD-021) |

Verified accurate: `README.md:20-34` (all commands exist), `functions/README.md`, `src/__tests__/TESTING.md`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | `CLAUDE.md` is read by every future agent session — stale lines there actively mislead. |

## Recommendation
**REMOVE / CORRECT** in the same commits as the code changes they describe (DEAD-003/005/006/024/026), so docs and code never disagree.

### If Removing
1. Edit the lines above; bump `engines.node` to match the root
2. `git grep -n "build:css\|service-worker\|empty-state-icons\|app-layout.ts" apps/web-app` → 0 hits
