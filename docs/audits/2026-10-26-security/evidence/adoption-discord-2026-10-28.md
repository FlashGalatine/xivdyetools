# H-DISCORD source preparation — 2026-10-28

**Status: source prepared; registry adoption and release pending.** Base is H-LOGGER/H-AUTH PR #352 at `9ff21e17`. Unit: `apps/discord-worker`, pending version **5.9.7**. The existing version is retained; no extra release is invented before the pending version ships.

Move three diagnostic objects to structured context: webhook minimum, changelog fetch status and missing interaction user. No command shape or response behavior changes.

The full index test passes 163 cases. Three independent call-site reversions fail. Tests observe the real logger, require the third argument, retain safe fields and independently suppress bearer, webhook and interaction path credentials.

Integration receipt from the coordinated adoption working tree (including the later core and bot-logic import repairs): the shared local artifact run validates seven real tarballs, 44 native consumer checks and eight load-bearing negative controls. This is local build evidence, not CI provenance or a registry install. External runtime dependencies are linked from the existing locked installation; no lifecycle scripts or publication run. Logger browser errorTracker field traversal and direct callable-value limitations remain unchanged.

Coordinated integration gate: 62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. This receipt covers the completed adoption source tree; each draft PR also requires its own CI and the upstream release gates.

**Release prerequisite:** Publish auth 3.0.0, bot-logic 4.12.0, SVG 4.4.1, core 5.16.0, worker-kit 1.6.0 and logger 2.4.0 before production adoption. Existing A-DISCORD activation prerequisites remain. No npm publish, manual deploy, main merge, secret/policy change or private XIVAuth report is included. Feature pushes may run existing automatic beta workflows.
