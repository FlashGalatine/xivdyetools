# H-PRESETS source preparation — 2026-10-28

**Status: source prepared; registry adoption and release pending.** Base is H-LOGGER/H-AUTH PR #352 at `9ff21e17`. Unit: `apps/presets-api`, pending version **2.8.1**. The existing version is retained; no extra release is invented before the pending version ships.

Move five diagnostic objects to the third logger argument: four preview cleanup/notification paths and Perspective status. RetentionJobLogger retains its intentional two-argument contract. Auth tests verify canonical controls and equivalent noncanonical JWT/v2 rejection.

Five new real-logger output/argument cases fail before the fix and when the five moves are reverted, then pass restored. Full presets suite: 58 files, 1,415 tests. App type-check/lint pass; the existing validation-service unused-variable warning is unchanged.

Integration receipt from the coordinated adoption working tree (including the later core and bot-logic import repairs): the shared local artifact run validates seven real tarballs, 44 native consumer checks and eight load-bearing negative controls. This is local build evidence, not CI provenance or a registry install. External runtime dependencies are linked from the existing locked installation; no lifecycle scripts or publication run. Logger browser errorTracker field traversal and direct callable-value limitations remain unchanged.

Coordinated integration gate: 62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. This receipt covers the completed adoption source tree; each draft PR also requires its own CI and the upstream release gates.

**Release prerequisite:** Publish auth 3.0.0 and worker-kit 1.6.0/logger 2.4.0 first. Retain every A-PRESETS identity, private-binding, storage and activation prerequisite; production deployment remains separate. No npm publish, manual deploy, main merge, secret/policy change or private XIVAuth report is included. Feature pushes may run existing automatic beta workflows.
