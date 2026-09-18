/**
 * Domain object factories for testing
 *
 * Provides factory functions to create mock domain objects with sensible
 * defaults (TEST-DESIGN-001). Preset and category rows still default to
 * random IDs (`randomId()`/`randomStringId()`) so parallel test runs don't
 * collide. `createMockDye()`'s default stainID is no longer one of those
 * random draws — it is a deterministic 1..254 sequence (`resetMockDyeSequence()`
 * restarts it between tests; `randomStainId()` is available opt-in for a
 * non-deterministic stainID).
 */

export * from './preset.js';
export * from './category.js';
export * from './dye.js';
