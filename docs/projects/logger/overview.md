# Logger Package Overview

**@xivdyetools/logger** - Unified logging across environments

---

## What is @xivdyetools/logger?

A logging package that works consistently across browser, Node.js, and Cloudflare Workers. Provides structured logging with configurable levels and output formats.

---

## Installation

```bash
npm install @xivdyetools/logger
```

---

## Quick Start

```typescript
import { createLogger } from '@xivdyetools/logger';

const logger = createLogger('my-component');

logger.debug('Detailed information');
logger.info('Normal operation');
logger.warn('Warning condition');
logger.error('Error occurred', { error: err });
```

---

## Environment-Specific Imports

The package provides subpath exports for each environment:

```typescript
// Browser (console output with colors)
import { createLogger } from '@xivdyetools/logger/browser';

// Node.js (console + optional file output)
import { createLogger } from '@xivdyetools/logger/node';

// Cloudflare Workers (structured JSON)
import { createLogger } from '@xivdyetools/logger/worker';

// Auto-detect environment
import { createLogger } from '@xivdyetools/logger';
```

---

## Configuration

```typescript
const logger = createLogger('my-service', {
  level: 'info',           // 'debug' | 'info' | 'warn' | 'error'
  includeTimestamp: true,  // Add timestamp to logs
  structured: false,       // JSON output (useful for log aggregation)
});
```

---

## Log Levels

| Level | Use Case |
|-------|----------|
| `debug` | Detailed debugging information |
| `info` | Normal operational messages |
| `warn` | Warning conditions |
| `error` | Error conditions |

Logs at or above the configured level are output.

---

## Structured Logging

For log aggregation services (CloudWatch, etc.):

```typescript
const logger = createLogger('presets-api', { structured: true });

logger.info('Preset created', {
  presetId: '123',
  author: 'user#1234',
  category: 'glamour'
});

// Output:
// {"level":"info","service":"presets-api","message":"Preset created","presetId":"123","author":"user#1234","category":"glamour","timestamp":"2025-12-15T12:00:00Z"}
```

---

## Usage in Projects

### Web App (Browser)

```typescript
import { createLogger } from '@xivdyetools/logger/browser';

const logger = createLogger('color-matcher');
logger.info('Color matched', { dye: 'Dalamud Red' });
```

### Discord Worker

```typescript
import { createLogger } from '@xivdyetools/logger/worker';

const logger = createLogger('discord-worker', { structured: true });
logger.info('Command executed', { command: 'harmony', userId: '123' });
```

### OAuth Worker

```typescript
import { createLogger } from '@xivdyetools/logger/worker';

const logger = createLogger('oauth', { structured: true });
logger.info('Token issued', { userId: 'uuid' });
```

---

## Related Documentation

- [Types Package](../types/overview.md) - Shared types
- [Test Utils](../test-utils/overview.md) - Testing utilities
