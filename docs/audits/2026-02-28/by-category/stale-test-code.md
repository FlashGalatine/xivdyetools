# Stale Test Code Summary

## Overview
- **Total Findings:** 1 (DEAD-030)
- **Recommended for Removal:** 1
- **Estimated Lines Removable:** ~50

## Discord Worker Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-030 | `src/test-utils.integration.ts` | 3 unused imports + 2 unused exports (integration test scaffolding never adopted) | HIGH | REMOVE |

The integration test approach was abandoned in favor of unit tests with targeted mocks. The file's `createFullMockEnv` and `assertDiscordJsonResponse` exports have zero consumers.
