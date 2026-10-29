# H-STOAT source preparation — 2026-10-28

**Status: source prepared; registry adoption and release pending.** Base is H-LOGGER/H-AUTH PR #352 at `9ff21e17`. Unit: `apps/stoat-worker`, pending version **0.3.4**. The existing version is retained; no extra release is invented before the pending version ships.

Move gateway, startup and message-handler diagnostics to structured context. Retain existing logger options and the already implemented invisible-character sanitizer mirror. Stoat stays parked.

Sixty-eight focused cases pass across four files, including the existing response formatter and echo sanitizer. Three independent call-site reversions fail. Actual shared logger output suppresses independent credential samples and retains safe command fields.

Integration receipt from the coordinated adoption working tree (including the later core and bot-logic import repairs): the shared local artifact run validates seven real tarballs, 44 native consumer checks and eight load-bearing negative controls. This is local build evidence, not CI provenance or a registry install. External runtime dependencies are linked from the existing locked installation; no lifecycle scripts or publication run. Logger browser errorTracker field traversal and direct callable-value limitations remain unchanged.

Coordinated integration gate: 62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. This receipt covers the completed adoption source tree; each draft PR also requires its own CI and the upstream release gates.

**Release prerequisite:** Publish bot-logic 4.12.0 and logger 2.4.0 before any future adoption. This sprint is parked verification only: no activation or deployment. No npm publish, manual deploy, main merge, secret/policy change or private XIVAuth report is included. Feature pushes may run existing automatic beta workflows.
