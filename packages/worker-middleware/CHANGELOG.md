# Changelog

All notable changes to `@xivdyetools/worker-middleware` will be documented in this file.

## [1.0.0] — 2026-04-07

### Added

- `requestIdMiddleware()` — Configurable Hono middleware for request ID management with optional UUID format validation (enabled by default for log injection prevention). Extracted from 5 worker-local implementations.
- `loggerMiddleware()` — Configurable Hono middleware for per-request structured logging via `@xivdyetools/logger`. Supports environment reading, API version, user-agent logging, and custom path sanitization. Extracted from 4 worker-local implementations.
- `getRequestId()` — Safe context helper with `'unknown'` fallback for error handlers.
- `getLogger()` — Safe context helper with `undefined` fallback for error handlers.
- `MiddlewareVariables` type — Base Hono context variables (`requestId`, `logger`) for workers to extend.

### Motivation

Resolves **REFACTOR-001** from the 2026-04-07 deep-dive audit: ~185 lines of nearly identical request ID and logger middleware were duplicated across discord-worker, presets-api, oauth, moderation-worker, and api-worker. This package provides a single, tested, configurable source of truth.
