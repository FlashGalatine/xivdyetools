# Unused Exports Summary

## Overview
- **Total Findings:** 4 (DEAD-008, DEAD-009, DEAD-012, DEAD-013, DEAD-014, DEAD-016)
- **Recommended for Removal:** 6
- **Estimated Lines Removable:** ~450+

## Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-008 | `src/components/index.ts` | Nearly-dead barrel file (1/35 exports used) | HIGH | REMOVE |
| DEAD-009 | `src/components/v4/index.ts` | Completely unused barrel file | HIGH | REMOVE |
| DEAD-012 | `src/shared/constants.ts` | ~30 exported constants never imported | HIGH | REMOVE |
| DEAD-013 | `src/shared/empty-state-icons.ts` | Dead lookup function + 3 unused icons | HIGH | REMOVE |
| DEAD-014 | `src/shared/ui-icons.ts` | Dead lookup function + 12 unused icons | HIGH | REMOVE |
| DEAD-016 | `src/services/index.ts` | Dead barrel re-exports (SHARE_URL_VERSION, BASE_URL, etc.) | MEDIUM-HIGH | REMOVE WITH CAUTION |
