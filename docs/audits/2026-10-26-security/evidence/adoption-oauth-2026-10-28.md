# H-OAUTH source preparation — 2026-10-28

**Status: source prepared; registry adoption and release pending.** Base is H-LOGGER/H-AUTH PR #352 at `9ff21e17`. Unit: `apps/oauth`, pending version **3.2.0**. The existing version is retained; no extra release is invented before the pending version ships.

Consumer tests accept canonical signing output and reject cryptographically equivalent padding/unused-bit JWT aliases through delegated verifier boundaries. Correct the stale permissiveness comment. Issuance, sessions, token claims, signature v2 and runtime auth code are unchanged.

Native Web Crypto verifies the equivalent alias bytes while the application rejects the noncanonical spelling. Full OAuth suite: 21 files, 554 tests; type-check/lint pass.

Integration receipt from the coordinated adoption working tree (including the later core and bot-logic import repairs): the shared local artifact run validates seven real tarballs, 44 native consumer checks and eight load-bearing negative controls. This is local build evidence, not CI provenance or a registry install. External runtime dependencies are linked from the existing locked installation; no lifecycle scripts or publication run. Logger browser errorTracker field traversal and direct callable-value limitations remain unchanged.

Coordinated integration gate: 62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. This receipt covers the completed adoption source tree; each draft PR also requires its own CI and the upstream release gates.

**Release prerequisite:** Publish auth 3.0.0 and worker-kit 1.6.0/logger 2.4.0 first. Preserve provider prerequisites and disabled identity activation. OAuth has no production beta stage; a future main merge is its production deploy. No npm publish, manual deploy, main merge, secret/policy change or private XIVAuth report is included. Feature pushes may run existing automatic beta workflows.
