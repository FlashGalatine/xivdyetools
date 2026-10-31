# Chat Research Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Minimize PR #317's research files and enforce aggregate-only collectors.

**Status (2026-10-31):** carried out as a fresh single-commit replacement, PR #366 (`32a13b8b`), whose CI passed all four jobs including the gitleaks secret scan. The Task 3 boxes and the verification record below are as written before that commit. A follow-up commit adds two publication checks (log schema, collector defaults): 103 total.

**Architecture:** Fixed-schema CLI exports with contributor thresholds; aggregate
historical evidence; a publication gate rejects unexpected structured fields and
linked individual evidence.

**Tech Stack:** Node.js 22, dependency-free ECMAScript modules and node:test.

**Spec:** [Aggregate publication design](../specs/2026-10-29-chat-research-privacy-design.md).

## Global Constraints

- Existing PR worktree only; preserve unrelated untracked files.
- No live social services, private maps, removed PR material or history rewrites.
- One writer per file; coordinator owns prose, Git operations and public updates.
- No individual rows, ranks, activity histories, post text or identifying errors.
- Collector contributor threshold: five distinct subjects, including subsets.

## Review Focus

- Upstream errors and malformed JSON must not escape through stdout or stderr.
- Duplicate subjects and aliases must not satisfy contributor thresholds.
- Rare matching subsets and sparse tables must suppress their whole metric set.
- Unknown response fields and language metadata must not become output keys.
- Historical prose and workflow prompts must not reconstruct removed records.

## Task 1: Collector export boundary

**Files:** research evidence/scripts/{bsky-ffxiv-census,x-follower-counts}.mjs,
new shared helpers, collectors.test.mjs and synthetic fixtures in that directory.

- [x] Write CLI regression tests; confirm they fail against existing collectors.
- [x] Implement the design's fixed outputs, validation and safe diagnostics.
- [x] Run all CLI scenarios; prove a suppression mutation makes tests fail.

## Task 2: Historical publication boundary

**Files:** research JSON and TSV evidence, both READMEs, affected cloud reports
and saved workflow prompts; scripts/check-research-privacy.test.mjs; package.json.

- [x] Write a structured publication gate; confirm existing individual rows fail.
- [x] Remove linked records and hand counts; retain honest cohort totals.
- [x] Remove identifying narrative and unsafe collection instructions; explain
      the dated privacy exception to the normal frozen-body convention.
- [x] Wire collector and publication tests into the existing scripts CI gate.

## Task 3: Verify and update PR

- [ ] Run both new suites, existing scripts tests, docs links/versions, script
      type-check, dead-code gate, syntax checks, diff check and redacted gitleaks.
- [x] Obtain independent privacy-critical review and resolve confirmed findings.
- [ ] Commit only owned paths, push the existing PR branch, verify the remote
      ref and checks; keep the PR draft for unfinished research.
- [ ] Update PR status with current-tree results and the history limitation.

## Verification record before commit

- Ordinary Sol xhigh review and final Astra high privacy review pass for the current tree.
- 97 synthetic CLI regressions and four publication checks pass (101 total).
- Lowering the contributor threshold made 16 selected regressions fail; restored code passes.
- Existing scripts suite, script type-check, dead-code gate, docs links (1,064),
  version claims (34), module syntax and diff checks pass.
- Local gitleaks is unavailable; the PR's existing GitHub secret-scan job remains required.
- Earlier Git/PR revisions and caches are not purged by this change.
