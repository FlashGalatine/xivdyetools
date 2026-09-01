#!/usr/bin/env bash
# Dependency scan (mirrors CI's nightly gate: pnpm audit --prod --audit-level high).
# Run from the monorepo root: bash docs/audits/2026-08-29-security/evidence/scripts/01-pnpm-audit.sh
set -u
OUT=docs/audits/2026-08-29-security/evidence
mkdir -p "$OUT"
pnpm audit --prod --json > "$OUT/pnpm-audit.json" 2>&1 || true
pnpm audit --prod --audit-level high > "$OUT/pnpm-audit-summary.txt" 2>&1 || true
echo "--- summary ---"
head -40 "$OUT/pnpm-audit-summary.txt"
echo "--- json (first 400 bytes) ---"
head -c 400 "$OUT/pnpm-audit.json"
echo
