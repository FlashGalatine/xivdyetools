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
      expect(tree.getSize()).toBe(3);
      expect(tree.isEmpty()).toBe(false);
    });

    it('should handle empty tree', () => {
      const tree = new KDTree([]);
      expect(tree.getSize()).toBe(0);
      expect(tree.isEmpty()).toBe(true);
    });

    it('should handle single point', () => {
      const points: Point3D[] = [{ x: 255, y: 0, z: 0, data: 'red' }];
      const tree = new KDTree(points);
      expect(tree.getSize()).toBe(1);
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

      expect(nearest).toBeDefined();
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

      expect(nearest).toBeDefined();
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
      expect(nearest).toBeDefined();
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
      expect(tree.getSize()).toBe(136);

      // Should find nearest quickly
      const start = performance.now();
      const nearest = tree.nearestNeighbor({ x: 128, y: 128, z: 128 });
      const duration = performance.now() - start;

      expect(nearest).toBeDefined();
      // Should be fast (< 10ms for 136 points)
      expect(duration).toBeLessThan(10);
    });
  });
});
