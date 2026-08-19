# Stale Tests Summary

## Overview
- **Total Findings:** 2
- **Recommended for Removal / Refactor / Update:** 1
- **Kept (with a fix or a note):** 1

## Findings

| ID | Description | Confidence | Recommendation | Est. lines |
|----|-------------|------------|----------------|-----------|
| [DEAD-005](../findings/DEAD-005.md) | base.test.ts re-tests @xivdyetools/svg primitives (dup of packages/svg/src/base.test.ts) | HIGH | REMOVE | 342 test |
| [DEAD-025](../findings/DEAD-025.md) | vitest coverage excludes src/index.ts although index.test.ts (471 lines) covers it | HIGH | KEEP / REVISIT | 0 |
