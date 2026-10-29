# H-SVG-ADOPT source preparation — 2026-10-28

**Status: source prepared; registry adoption and release pending.** Base is H-LOGGER/H-AUTH PR #352 at `9ff21e17`. Unit: `packages/svg`, pending version **4.4.1**. The existing version is retained; no extra release is invented before the pending version ships.

The actual package pins core 5.16.0 and types 3.3.0, carrying logger 2.4.0 transitively. No card API change is needed.

The real extracted package generates a comparison SVG from installed core dye data. The seven-package validator checks exact pins and a stale logger pin is rejected.

Integration receipt from the coordinated adoption working tree (including the later core and bot-logic import repairs): the shared local artifact run validates seven real tarballs, 44 native consumer checks and eight load-bearing negative controls. This is local build evidence, not CI provenance or a registry install. External runtime dependencies are linked from the existing locked installation; no lifecycle scripts or publication run. Logger browser errorTracker field traversal and direct callable-value limitations remain unchanged.

Coordinated integration gate: 62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. This receipt covers the completed adoption source tree; each draft PR also requires its own CI and the upstream release gates.

**Release prerequisite:** Publish adopted core 5.16.0 first, then SVG 4.4.1 through Actions; verify both exact registry dependencies. No npm publish, manual deploy, main merge, secret/policy change or private XIVAuth report is included. Feature pushes may run existing automatic beta workflows.
