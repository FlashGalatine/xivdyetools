# Logging Standards

**CROSS-002:** Established logging standards for consistent observability across all xivdyetools packages.

## Overview

All xivdyetools services should follow these logging standards to ensure consistent
observability and debugging experience across the ecosystem.

## Log Level Guidelines

| Level | Use Case | Examples |
|-------|----------|----------|
| **DEBUG** | Detailed information for debugging | Cache hits/misses, timing data, internal state |
| **INFO** | Notable events during normal operation | Service initialization, database loaded, locale set |
| **WARN** | Recoverable issues or unexpected conditions | Value clamping, fallback behavior, deprecation notices |
| **ERROR** | Failures requiring attention | API errors, validation failures, unrecoverable states |

## Per-Operation Logging Standards

### Initialization

- **Level:** INFO
- **Context:** Include service name, version, and configuration summary
- **Example:**

```typescript
this.logger.info('DyeDatabase initialized', {
  dyeCount: this.dyes.length,
  kdTreeEnabled: !!this.kdTree,
});
```

### Cache Operations

- **Level:** DEBUG
- **Context:** Include cache key, hit/miss status
- **Example:**

```typescript
this.logger.debug('Cache lookup', { key, hit: !!cachedValue });
```

### Errors

- **Level:** ERROR
- **Context:** Include error message, code, and relevant context
- **Example:**

```typescript
this.logger.error('API request failed', {
  url,
  statusCode: response.status,
  errorCode: ErrorCode.NETWORK_ERROR,
});
```

### Performance

- **Level:** DEBUG
- **Context:** Include operation name and duration
- **Example:**

```typescript
this.logger.debug('Color search completed', {
  targetHex: hex,
  durationMs: Date.now() - start,
  resultCount: results.length,
});
```

### Value Clamping/Defaults

- **Level:** WARN
- **Context:** Include original value and clamped/default value
- **Example:**

```typescript
this.logger.warn('Value clamped to valid range', {
  field: 'maxIterations',
  originalValue: opts.maxIterations,
  clampedValue: maxIterations,
  validRange: [1, 100],
});
```

## Optional Logger Pattern

Services should accept an optional logger in their constructor and fall back to `NoOpLogger`:

```typescript
import { NoOpLogger, type Logger } from '@xivdyetools/types';

class MyService {
  private readonly logger: Logger;

  constructor(config: { logger?: Logger } = {}) {
    this.logger = config.logger ?? NoOpLogger;
  }
}
```

## Current Package Status

| Package | Logging Level | Notes |
|---------|---------------|-------|
| xivdyetools-core | Varies | DyeDatabase: Extensive, ColorConverter: Errors only |
| xivdyetools-logger | N/A | Is the logger itself |
| xivdyetools-types | N/A | Type definitions only |
| xivdyetools-test-utils | Minimal | Test utilities don't need extensive logging |

## Future Work

- Standardize logging across all services in xivdyetools-core
- Add structured logging for performance metrics
- Consider log correlation IDs for request tracing

---

*Reference: NPM Libraries Audit CROSS-002 (December 24, 2025)*
