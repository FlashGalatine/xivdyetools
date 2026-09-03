/**
 * Unit tests for k-d tree implementation
 * Per P-7: Tests spatial indexing for color matching
 */

import { describe, it, expect } from 'vitest';
import { KDTree, type Point3D } from '../kd-tree.js';

describe('KDTree', () => {
  describe('Construction', () => {
    it('should build tree from points', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 0, y: 255, z: 0, data: 'green' },
        { x: 0, y: 0, z: 255, data: 'blue' },
      ];

      const tree = new KDTree(points);
      expect(tree.isEmpty()).toBe(false);
    });

    it('should handle empty tree', () => {
      const tree = new KDTree([]);
      expect(tree.isEmpty()).toBe(true);
    });

    it('should handle single point', () => {
      const points: Point3D[] = [{ x: 255, y: 0, z: 0, data: 'red' }];
      const tree = new KDTree(points);
      expect(tree.isEmpty()).toBe(false);
    });
  });

  describe('Nearest Neighbor Search', () => {
    it('should find exact match', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 0, y: 255, z: 0, data: 'green' },
        { x: 0, y: 0, z: 255, data: 'blue' },
      ];

      const tree = new KDTree(points);
      const nearest = tree.nearestNeighbor({ x: 255, y: 0, z: 0 });

      expect(nearest).not.toBeNull();
      expect(nearest?.data).toBe('red');
    });

    it('should find closest point', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 0, y: 255, z: 0, data: 'green' },
        { x: 0, y: 0, z: 255, data: 'blue' },
      ];

      const tree = new KDTree(points);
      // Point closer to red
      const nearest = tree.nearestNeighbor({ x: 250, y: 10, z: 10 });

      expect(nearest).not.toBeNull();
      expect(nearest?.data).toBe('red');
    });

    it('should exclude points based on excludeData function', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 0, y: 255, z: 0, data: 'green' },
        { x: 0, y: 0, z: 255, data: 'blue' },
      ];

      const tree = new KDTree(points);
      const nearest = tree.nearestNeighbor({ x: 255, y: 0, z: 0 }, (data) => data === 'red');

      // Should find next closest (green or blue)
      expect(nearest).not.toBeNull();
      expect(nearest?.data).not.toBe('red');
    });

    it('should handle empty tree in nearest neighbor', () => {
      const tree = new KDTree([]);
      const nearest = tree.nearestNeighbor({ x: 255, y: 0, z: 0 });
      expect(nearest).toBeNull();
    });
  });

  describe('Points Within Distance', () => {
    it('should find all points within distance', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 250, y: 5, z: 5, data: 'red2' },
        { x: 0, y: 255, z: 0, data: 'green' },
        { x: 0, y: 0, z: 255, data: 'blue' },
      ];

      const tree = new KDTree(points);
      const results = tree.pointsWithinDistance({ x: 255, y: 0, z: 0 }, 20);

      expect(results.length).toBeGreaterThan(0);
      // Should include red and red2 (close to target)
      const dataValues = results.map((r) => r.point.data);
      expect(dataValues).toContain('red');
      expect(dataValues).toContain('red2');
    });

    it('should return empty array for no matches', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 0, y: 255, z: 0, data: 'green' },
      ];

      const tree = new KDTree(points);
      const results = tree.pointsWithinDistance({ x: 0, y: 0, z: 0 }, 1);

      expect(results.length).toBe(0);
    });

    it('should sort results by distance', () => {
      const points: Point3D[] = [
        { x: 255, y: 0, z: 0, data: 'red' },
        { x: 250, y: 5, z: 5, data: 'red2' },
        { x: 240, y: 10, z: 10, data: 'red3' },
      ];

      const tree = new KDTree(points);
      const results = tree.pointsWithinDistance({ x: 255, y: 0, z: 0 }, 50);

      expect(results.length).toBeGreaterThan(1);
      // First result should be closest
      expect(results[0]?.point.data).toBe('red');
      // Distances should be ascending
      for (let i = 1; i < results.length; i++) {
        expect(results[i]?.distance).toBeGreaterThanOrEqual(results[i - 1]?.distance ?? 0);
      }
    });
  });

  describe('Performance', () => {
    it('should handle many points efficiently', () => {
      // Create 136 points (matching dye database size)
      const points: Point3D[] = [];
      for (let i = 0; i < 136; i++) {
        points.push({
          x: Math.floor(Math.random() * 256),
          y: Math.floor(Math.random() * 256),
          z: Math.floor(Math.random() * 256),
          data: i,
        });
      }

      const tree = new KDTree(points);
      expect(tree.isEmpty()).toBe(false);

      // Should find nearest quickly
      const start = performance.now();
      const nearest = tree.nearestNeighbor({ x: 128, y: 128, z: 128 });
      const duration = performance.now() - start;

      expect(nearest).not.toBeNull();
      // Should be fast (< 10ms for 136 points)
      expect(duration).toBeLessThan(10);
    });
  });

  // ==========================================================================
  // core-color-06: the tree had no parity test, and its only correctness
  // assertions passed on `null`
  // ==========================================================================
  //
  // `nearestNeighbor` returns `Point3D | null`, and vitest's `toBeDefined()` is
  // `!== undefined` -- so `expect(null).toBeDefined()` PASSES. In the
  // Performance block that was the sole correctness check, so an implementation
  // returning null for every query passed the whole block, and the
  // `excludeData` case (`expect(nearest?.data).not.toBe('red')`) too. The three
  // Construction tests assert only `isEmpty()`, so a median or split error was
  // invisible. Those assertions are now `not.toBeNull()`; this block adds the
  // brute-force parity the file never had.
  describe('parity with a linear scan', () => {
    /** Deterministic PRNG so a failure is reproducible from its seed. */
    function makeRandom(seed: number): () => number {
      let state = seed >>> 0;
      return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
      };
    }

    function squaredDistance(a: Point3D, b: { x: number; y: number; z: number }): number {
      return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
    }

    function bruteForceNearest(
      points: Point3D[],
      query: { x: number; y: number; z: number },
      excludeData?: (data: unknown) => boolean
    ): Point3D | null {
      let best: Point3D | null = null;
      let bestDistance = Infinity;
      for (const point of points) {
        if (excludeData?.(point.data)) continue;
        const distance = squaredDistance(point, query);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = point;
        }
      }
      return best;
    }

    // Small coordinate ranges force ties and duplicates, which is where a
    // median/split error actually shows up.
    it.each([
      ['tight range, heavy duplicates', 4],
      ['small range', 20],
      ['full RGB range', 256],
    ])('matches a linear scan over a %s', (_label, range) => {
      const random = makeRandom(0xc0ffee + range);

      for (let trial = 0; trial < 200; trial++) {
        const count = 1 + Math.floor(random() * 40);
        const points: Point3D[] = Array.from({ length: count }, (_, i) => ({
          x: Math.floor(random() * range),
          y: Math.floor(random() * range),
          z: Math.floor(random() * range),
          data: `p${i}`,
        }));

        const tree = new KDTree(points);
        const query = {
          x: Math.floor(random() * range),
          y: Math.floor(random() * range),
          z: Math.floor(random() * range),
        };

        const fromTree = tree.nearestNeighbor(query);
        const fromScan = bruteForceNearest(points, query);

        expect(fromTree).not.toBeNull();
        // Ties are legitimate: compare the DISTANCE, not the identity.
        expect(squaredDistance(fromTree!, query)).toBe(squaredDistance(fromScan!, query));
      }
    });

    it('matches a linear scan when a predicate excludes candidates', () => {
      const random = makeRandom(0x5eed);

      for (let trial = 0; trial < 200; trial++) {
        const count = 2 + Math.floor(random() * 30);
        const points: Point3D[] = Array.from({ length: count }, (_, i) => ({
          x: Math.floor(random() * 20),
          y: Math.floor(random() * 20),
          z: Math.floor(random() * 20),
          data: `p${i}`,
        }));

        // Exclude roughly half of them.
        const excluded = new Set<unknown>(
          points.filter((_, i) => i % 2 === 0).map((p) => p.data)
        );
        const exclude = (data: unknown): boolean => excluded.has(data);

        const tree = new KDTree(points);
        const query = {
          x: Math.floor(random() * 20),
          y: Math.floor(random() * 20),
          z: Math.floor(random() * 20),
        };

        const fromTree = tree.nearestNeighbor(query, exclude);
        const fromScan = bruteForceNearest(points, query, exclude);

        if (fromScan === null) {
          expect(fromTree).toBeNull();
          continue;
        }

        expect(fromTree).not.toBeNull();
        expect(excluded.has(fromTree!.data)).toBe(false);
        expect(squaredDistance(fromTree!, query)).toBe(squaredDistance(fromScan, query));
      }
    });

    it('loses no points: every node is reachable by querying its own position', () => {
      const random = makeRandom(0xbadc0de);
      const points: Point3D[] = Array.from({ length: 200 }, (_, i) => ({
        x: Math.floor(random() * 256),
        y: Math.floor(random() * 256),
        z: Math.floor(random() * 256),
        data: `p${i}`,
      }));

      const tree = new KDTree(points);

      for (const point of points) {
        const found = tree.nearestNeighbor({ x: point.x, y: point.y, z: point.z });
        expect(found).not.toBeNull();
        // A point queried at its own coordinates must find something exactly
        // there -- a dropped node shows up as a non-zero distance.
        expect(squaredDistance(found!, point)).toBe(0);
      }
    });
  });
});
