# OPT-001: LRU Cache Concurrency Improvements

## Impact
**MEDIUM**

## Category
Algorithm / Concurrency

## Location
- **File:** xivdyetools-core/src/utils/index.ts
- **Lines:** 58-118 (LRUCache class)

## Current Performance
LRUCache documented as not thread-safe for concurrent async operations. Used in ColorConverter which performs parallel conversions.

## Bottleneck Analysis
Under concurrent load:
1. Multiple workers check cache (all miss)
2. All start expensive conversion
3. All write result (LRU ordering corrupted)
4. Wasted computation (~60-80% speedup lost)

## Proposed Optimization
Add request deduplication wrapper:

```typescript
class LockedLRUCache<K, V> {
  private pending = new Map<K, Promise<V>>();

  async getOrCompute(key: K, compute: () => Promise<V>): Promise<V> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    const promise = compute();
    this.pending.set(key, promise);

    try {
      const result = await promise;
      this.cache.set(key, result);
      return result;
    } finally {
      this.pending.delete(key);
    }
  }
}
```

## Expected Improvement
- 40-60% reduction in wasted computation
- Better cache hit rates under concurrent load
- More predictable performance

## Trade-offs
- Slightly more complex implementation
- Small memory overhead for pending promises map

## Benchmark Approach
```typescript
// Simulate concurrent color conversions
const colors = Array(1000).fill('#AABBCC');
const results = await Promise.all(
  colors.map(c => converter.toRGB(c))
);
// Measure cache hits vs misses
```
