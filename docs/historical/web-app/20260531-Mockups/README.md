# Web-App Design Mockups (relocated 2026-05-31)

These are the dev-only design mockups that used to live in `apps/web-app/src/mockups/`. They were static layout prototypes from
the **v4 glassmorphism redesign**, loaded only in dev via `?mockup=true` (behind an `import.meta.env.DEV` guard) and stripped
from every production build.

They were relocated here during the **2026-05-31 web-app dead-code audit** (finding **DEAD-112**) to remove ~4,443 lines of
dev-only code from the application source while preserving the design references.

## What was changed in the app at relocation time
- Removed the `?mockup=true` dev-loader block from `apps/web-app/src/main.ts`.
- Removed the `@mockups` alias from `apps/web-app/vite.config.ts` and the `"@mockups/*"` path from `apps/web-app/tsconfig.json`.
- Updated the directory map + alias list in `apps/web-app/CLAUDE.md`.

## Contents
- `index.ts` — `loadMockupSystem()` entry + the mockup nav/shell.
- `MockupShell.ts`, `MockupNav.ts`, `IconRail.ts`, `MobileDrawer.ts`, `CollapsiblePanel.ts` — shell pieces.
- `tools/*Mockup.ts` — per-tool layout mockups (Harmony, Matcher, Comparison, Mixer, Budget, Accessibility, Presets).
- `mockup-gradient-themes.css` — mockup-only styles.

> These files are **historical references**, not buildable against the current app (the `@mockups` alias no longer exists).
> See `docs/audits/2026-05-31/findings/DEAD-112.md` for full context.
