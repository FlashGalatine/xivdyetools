# Earlier-minor reconciliation — evidence note, 2026-10-30

**PREPARATION ONLY — production activation is on hold.** Nothing here authorizes a merge, package publication, deployment, workflow dispatch, remote database access, hosted Image request, command registration or announcement. The machine-readable receipt is [earlier-minor-reconciliation-2026-10-30.json](earlier-minor-reconciliation-2026-10-30.json); this note is its narrative and reproduction recipe. The release runbook section is [section 9 of the A/R/H runbook](../../../operations/REMEDIATION_RELEASE_2026_10.md).

## Cuts

| Cut | Draft PR | Head | Tree | Based on |
|---|---|---|---|---|
| e-00 logger declarations | [#407](https://github.com/FlashGalatine/xivdyetools/pull/407) | `f461b94578c7` | `d9533007ceb9` | cut 01 |
| e-01 integrated verification tip | [#408](https://github.com/FlashGalatine/xivdyetools/pull/408) | `71ed0595ccf9` | `7491501c58f8` | cut 06 |
| e-02 dye-name selection (#390) | [#409](https://github.com/FlashGalatine/xivdyetools/pull/409) | `b0efa0f26518` | `c95faa82f9e3` | e-01 |
| e-03 web 5.16.4 development bridge | [#410](https://github.com/FlashGalatine/xivdyetools/pull/410) | `e1293ba5e069` | `da12c3ea9c7d` | cut 12 |

Every cut is a flat `codex/release-cut-*` ref, which all three automatic beta workflows exclude; every push of such a ref was checked against every workflow trigger (CI runs on pull requests only; every production deploy is main/master only; the publisher and emoji sync are dispatch-only). No version number changes in any cut.

## Method

1. **Companions, not rebuilds.** The existing isolated cuts and their receipts were left untouched. The corrective companions were combined by merge commits so that every companion commit keeps its identity: e-01 is cut 06 plus the logger repair (e-00), #393 and #401, and its tree is identical to merging the three onto cut 06 in any order (checked with `git merge-tree`).
2. **Gates.** Each cut ran the same gate set as the earlier receipts (whole graph with serial Turbo, coverage, the six root gates, the Web bundle budget, compile-only Worker budgets, an outgoing secret scan), and the tree had to be identical before and after.
3. **Native proofs.** Packages were packed with pnpm 11.17 and lifecycle scripts suppressed, installed offline into an isolated Node 22 consumer, and exercised (every export, six locales of manual strings, the real private JWT producer, native JSON import attributes without a loader), then compiled with `strict`, `skipLibCheck: false` over every public entry point of the six pending packages. A negative control rebuilt logger, Core and Bot Logic with the `@internal` tags restored and had to fail the same compile naming every reverted symbol.
4. **Queue simulation (labelled e-04 in the receipt; a local ref, never pushed).** A commit of cut 17 plus e-02 plus e-03 was gated cold (all 62 tasks executed), and the whole M and F wave (f-03) was merged on top of it with `git merge-tree`. Rebuild it with `git merge-tree --write-tree` from the three heads in the receipt; the merge is deterministic.

## Results

| Cut | Whole graph | Worker bundles (gzip KiB, limit 3,072) | Outgoing secret scan |
|---|---|---|---|
| e-00 | 62 tasks, 0 failed (56 executed, 6 reused) | discord 2,734.33, og 1,953.78 | clean |
| e-01 | 62 tasks, 0 failed (50 executed, 12 reused) | discord 2,736.61, og 1,954.01 | clean |
| e-02 | 62 tasks, 0 failed (33 executed, 29 reused) | discord 2,736.55, og 1,953.94 | clean |
| e-03 | 62 tasks, 0 failed (51 executed, 11 reused) | not applicable (web only) | clean |

Native proofs: `e01` FAIL, `e01b` PASS, `e02` FAIL, `e02b` PASS. The first run (`e01`, on the tip before the logger repair) failed for exactly the logger reason and is kept in the receipt.

## Findings

1. **Logger declarations (new).** Six `@internal`-tagged declarations that the logger barrels re-export as published API are deleted from the emitted declarations by `stripInternal`; a `skipLibCheck: false` consumer meets six TS2305 errors. The already-published logger 2.3.0 has the same defect (read from its registry tarball). e-00 repairs it in the pending 2.4.0. It is prepared and recommended before P1; requiring it is the maintainer's decision.
2. **Strict-declaration scope.** The M and F wave receipts did not cover logger; the F tip ships the same unrepaired logger source; e-00 merges cleanly onto it.
3. **Archive reproducibility.** For identical dist content, `pnpm pack` writes the expanded workspace dependency keys in varying order, so tarballs can differ in `package.json` key order only. Local archives built from a long-lived builder can also carry stale dist files (four `__fixtures__` files appeared once and were removed by a forced clean rebuild); the registry artifact must come from the clean publisher run.
4. **Peer range observation.** auth 3.0.0 declares peer `@cloudflare/workers-types` ^4.0.0 while the builder lock resolves 5.20261023.1.
5. **Environment trap.** The first `test:scripts` run failed 48 tests because Git's GNU tar read `C:` as a remote host; the attempt is preserved in the e-01 record and the rerun put Windows bsdtar first on PATH. No test or assertion was changed.

## Convergence with the M and F wave

Merging the whole F tip (f-03) onto the queue simulation is conflict-free, and the merged tree differs from f-03 only by the earlier-minor release notes and the logger repair (the F tip ships the unrepaired logger).

## Reproduce

```bash
git fetch origin 'refs/heads/codex/release-cut-e-*:refs/remotes/origin/codex/release-cut-e-*'
# e-01 equals merging the three companions onto cut 06:
git merge-tree --write-tree origin/codex/release-cut-06-bot-logic-20261029 origin/codex/release-cut-e-01-minors-20261030
```
