# Baseline at the audit commit

**Commit:** `preview/integration-2026-10-04@80262a2f`. That is `main@8ecb878f` with the 13 PRs open on 2026-10-04 merged in, plus the two Sprint 0 fixes of the 2026-10-04 dead-code audit (#224 `10a1cb77`, #225 `ea264d49`). The branch is local and never pushed.

| Gate | Result | Log |
|---|---|---|
| `pnpm turbo run build type-check lint test --continue --concurrency=2` (uncached for the two re-run units) | 62/62 tasks | `../../2026-10-04-dead-code/evidence/gates-after-pr-fixes.txt` |
| `pnpm turbo run type-check lint test --continue --concurrency=2` | 59/59 tasks, cached against the run above | [gates-baseline.txt](gates-baseline.txt) |
| `pnpm turbo run test:coverage --continue --concurrency=2 --force` (uncached) | **24/25 tasks.** `@xivdyetools/bot-logic` fails its own global branch threshold: 88.38 % against 90 %. Its plain `test` task passes, and CI never runs `test:coverage`, so the threshold is not enforced anywhere. | [coverage-run.txt](coverage-run.txt) |
| `pnpm coverage:report` | 15 PASS, 1 WARN (bot-logic branches), 1 FAIL (web-app, see below) | [coverage-baseline.txt](coverage-baseline.txt) |
| `pnpm --filter xivdyetools-web-app run build:check` | PASS; 18 chunks use the 60 KB default budget | [bundle-web-app.txt](bundle-web-app.txt) |
| discord-worker bundle (`wrangler deploy --dry-run`, from the dead-code audit) | 7,977.20 KiB raw / **2,362.86 KiB gzip**, which is 76.9 % of the 3,072 KiB cap | `../../2026-10-04-dead-code/evidence/bundle-discord-worker.log` |
| `pnpm dead-code:check`, root knip, `workers:check-logs`, docs gates | all pass | dead-code audit evidence |

**Why web-app reads FAIL:** `coverage:report` compares against the shared 80 % app baseline. Web-app's actual gate is its own ratchet (71 / 55 / 65 / 72), which it passes.

## Coverage (statements / branches / functions / lines)

| Unit | Stmts | Branch | Funcs | Lines | Status |
|---|---:|---:|---:|---:|---|
| auth | 95.0 | 92.2 | 94.3 | 96.2 | PASS |
| bot-logic | 95.2 | **88.4** | 99.3 | 96.6 | WARN (below its own 90 % threshold) |
| core | 95.8 | 92.8 | 98.9 | 96.0 | PASS |
| logger | 96.8 | 90.8 | 100.0 | 96.7 | PASS |
| svg | 98.4 | 91.1 | 100.0 | 98.6 | PASS |
| test-utils | 96.3 | 94.3 | 96.3 | 96.1 | PASS |
| types | 97.4 | 100.0 | 100.0 | 97.4 | PASS |
| worker-kit | 99.5 | 95.0 | 97.0 | 99.7 | PASS |
| api-worker | 95.6 | 90.5 | 96.5 | 95.9 | PASS |
| discord-worker | 89.3 | 81.6 | 89.5 | 90.2 | PASS |
| image-worker | 91.9 | 87.7 | 97.4 | 95.9 | PASS |
| moderation-worker | 93.0 | 86.0 | 93.5 | 93.5 | PASS |
| oauth | 95.5 | 92.0 | 93.7 | 95.9 | PASS |
| og-worker | 97.8 | 94.0 | 100.0 | 98.1 | PASS |
| presets-api | 95.3 | 90.8 | 96.5 | 96.0 | PASS |
| stoat-worker | 99.3 | 90.7 | 97.9 | 99.6 | PASS |
| web-app | 81.3 | 68.3 | 78.4 | 82.7 | above its own ratchet |

## Lead lists

- **[src-files.txt](src-files.txt):** 531 non-test source files.
- **[pattern-grep.txt](pattern-grep.txt):** 1,257 lead hits.
- **[hot-spots.txt](hot-spots.txt), [unit-lines.txt](unit-lines.txt):** the largest files, and source lines per unit.
- **[cross-unit-dupes.txt](cross-unit-dupes.txt):** 59 symbol names defined in more than one unit.
- **[commits-since-last-audit.txt](commits-since-last-audit.txt):** 345 non-merge commits since the 2026-09-16 deep dive (`79a69d1f`).
- **[changed-src-since-79a69d1f.txt](changed-src-since-79a69d1f.txt):** 192 changed source files, with open-PR files marked.
- **[slices/](slices/):** the 27 review slices (649 files, including each app's `wrangler.toml` and `package.json`).
- **Scripts:** `scripts/lead-grep.mjs` (from 2026-09-16), `scripts/delta.py`, `scripts/slices.py`.
