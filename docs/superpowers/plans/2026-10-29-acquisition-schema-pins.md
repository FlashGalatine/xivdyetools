# Acquisition Schema Pinning Implementation Plan

**Status:** implemented and verified; awaiting PR integration. [Verification receipt](../../research/2026-10-29-acquisition-schema-pins/README.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Reproduce acquisition generation under fixed game/schema pins with unchanged output data.

**Architecture:** A private maintenance transport validates immutable provenance and optionally captures exact requests for offline replay. The generator validates CLI selections before fetching and performs all review requests before output writes.

**Tech Stack:** TypeScript, Node.js, Vitest; existing workspace dependencies.

**Spec:** [Approved scope](../specs/2026-10-29-acquisition-schema-pins-design.md).

## Global Constraints

- Preserve acquisition table, facewear mapping, recorded game version, Teamcraft commit and vendor rules.
- No runtime behavior, translation data, package publication or production activation changes.
- XIVAPI's supplied game-data translations take precedence over maintained alternatives.

## Review Focus

- Legacy metadata lacks a schema: explicit selection or fail before HTTP.
- Cursor requests retain both pins and response metadata cannot silently change them.
- Offline misses or malformed caches cannot fall through to live requests.
- A review-request failure leaves every existing output unchanged.
- Pinned generation must reproduce all acquisition/facewear bytes; no inferred historical schema provenance.

## Task 1: Private transport and generator integration

Files: `apps/api-worker/scripts/acquisition/upstream.ts`, `scripts/build-acquisition.ts`, `tests/acquisition/upstream.test.ts`, `tests/acquisition/generator.test.ts` (all under api-worker).

- [x] Observe CLI legacy-replay preflight fail before implementation; exercise pin capture, mismatches, cursor/batch identities, cache corruption/misses and request failures with focused tests.
- [x] Implement `AcquisitionSource` and `pinnedSelection`; integrate all sheet/search/Teamcraft reads and metadata provenance, optional cache/offline/output-directory arguments and pinned-output parity checks.
- [x] Move final review reads before any adoption; validate complete row/search payloads and reject incomplete pagination.
- [x] Pass tests and verify full cached regeneration/replay produces unchanged acquisition and facewear data. Record any unavailable evidence explicitly.

## Task 2: Documentation, release metadata and validation

- [x] Document invocation, first schema selection, offline replay and failure behavior in the maintainer guide; record authoritative translation policy.
- [x] Bump the API app patch and update its technical changelog/version tables; no player announcement for maintenance-only changes.
- [x] Run the affected API gate and root gates; obtain independent source review and address findings.
- [x] Scan staged changes for secrets. The coordinator owns the outgoing-commit scan, scoped commit/push and PR delivery; those results are reported with the PR.
