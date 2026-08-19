# Stale Code (comments / assets) Summary

## Overview
- **Total Findings:** 4
- **Recommended for Removal / Refactor / Update:** 3
- **Kept (with a fix or a note):** 1

## Findings

| ID | Description | Confidence | Recommendation | Est. lines |
|----|-------------|------------|----------------|-----------|
| [DEAD-016](../findings/DEAD-016.md) | orphaned / detached JSDoc blocks in index.ts and og-data-generator.ts | HIGH | REMOVE / re-attach | ~20 (comments) |
| [DEAD-017](../findings/DEAD-017.md) | item-ID-era + 1200×630-era comments (index.ts:8/537, types.ts ×8, dye-helpers, renderer, base) | HIGH | UPDATE | comments |
| [DEAD-020](../findings/DEAD-020.md) | CJK subsets carry 99 job-name glyphs (~45 KB) — superset, no tofu risk | HIGH | REMOVE (regenerate) | ~45 KB |
| [DEAD-028](../findings/DEAD-028.md) | commented-out Googlebot pattern — deliberate, documented, but untested | HIGH | KEEP (+ test the decision) | 2 (comment) |
