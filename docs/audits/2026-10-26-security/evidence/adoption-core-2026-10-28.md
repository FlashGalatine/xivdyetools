# H-CORE-ADOPT source preparation — 2026-10-28

**Status: source prepared; registry adoption and release pending.** Base is H-LOGGER/H-AUTH PR #352 at `9ff21e17`. Unit: `packages/core`, pending version **5.16.0**. The existing version is retained; no extra release is invented before the pending version ships.

The actual package pins logger 2.4.0 and types 3.3.0. Eleven missing character/shader JSON import attributes are corrected without changing data, APIs or lazy loading.

Native core probe: 20/20. Eager creator tables, lazy hair/skin and shared/race shader tables pass in Node 22.21.0. Attribute-removal controls fail. The published 5.15.0 tarball reproduces the original missing-attribute failure.

Integration receipt from the coordinated adoption working tree (including the later core and bot-logic import repairs): the shared local artifact run validates seven real tarballs, 44 native consumer checks and eight load-bearing negative controls. This is local build evidence, not CI provenance or a registry install. External runtime dependencies are linked from the existing locked installation; no lifecycle scripts or publication run. Logger browser errorTracker field traversal and direct callable-value limitations remain unchanged.

Coordinated integration gate: 62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. This receipt covers the completed adoption source tree; each draft PR also requires its own CI and the upstream release gates.

**Release prerequisite:** Publish logger 2.4.0 first, then core 5.16.0 through Actions. Verify both registry manifests before dependent publication. No npm publish, manual deploy, main merge, secret/policy change or private XIVAuth report is included. Feature pushes may run existing automatic beta workflows.
