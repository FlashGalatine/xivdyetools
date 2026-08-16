# Dead Code Paths, Legacy & Debug Residue — Summary

## Overview
- **Total Findings:** 2 (DEAD-017, DEAD-018) — plus paths inside DEAD-015/016
- **Recommended for Removal:** 1 remove, 1 refactor
- **Estimated Lines:** ~30 (DEAD-017) + ~30 call sites (DEAD-018)

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| DEAD-017 | `FEATURE_FLAGS` (always-true; 6 of 7 unused), `HarmonyConfig.show*` completed-migration fields, `ICON_UPLOAD` alias | HIGH | REMOVE |
| DEAD-018 | ~24 `console.info` traces bypassing the dev-gated logger (auth-service echoes URL/params during sign-in) | MEDIUM | REFACTOR FIRST → `logger.info` + tighten `no-console` |

**Clean:** no unreachable statements, no `if (true/false)`, no commented-out code blocks (one single-line `console.log` comment), no `debugger`, no `window.__*` debug globals (the two DEV-gated `window.TutorialService/ShareService` are intentional).
