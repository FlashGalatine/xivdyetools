/**
 * k-d Tree implementation for 3D color space (RGB)
 * Per P-7: Spatial indexing for fast nearest neighbor search
 *
 * k-d tree provides O(log n) average case for nearest neighbor queries
 * vs O(n) for linear search, significant improvement for color matching
 */

/**
 * Point in 3D space (RGB color)
 */
export interface Point3D {
  x: number; // R
  y: number; // G
  z: number; // B
  data?: unknown; // Associated data (e.g., Dye object)
}

/**
 * k-d Tree node
 */
class KDNode {
  point: Point3D;
  left: KDNode | null = null;
  right: KDNode | null = null;
  dimension: number; // 0 = R, 1 = G, 2 = B

  constructor(point: Point3D, dimension: number) {
    this.point = point;
    this.dimension = dimension;
  }
}

/**
 * k-d Tree for 3D color space (RGB)
 * Optimized for nearest neighbor search in color matching
 */
export class KDTree {
  private root: KDNode | null = null;
  private size: number = 0;

  /**
   * Build k-d tree from array of points
   * @param points - Array of 3D points (RGB colors)
   */
  constructor(points: Point3D[]) {
    if (points.length > 0) {
      // CORE-PERF-002: Use index-based construction to reduce memory allocations
      // Instead of slicing point arrays (O(n) copy each time), we pass index arrays
      // which are much smaller and reduce GC pressure
      const indices = points.map((_, i) => i);
      this.root = this.buildTreeOptimized(points, indices, 0);
      this.size = points.length;
    }
  }

  /**
   * Recursively build k-d tree using index arrays
   * CORE-PERF-002: Optimized to reduce temporary array allocations
   * @param points - Full points array (never copied)
   * @param indices - Indices into points array for current subtree
   * @param depth - Current depth (determines splitting dimension)
   */
  private buildTreeOptimized(points: Point3D[], indices: number[], depth: number): KDNode | null {
    if (indices.length === 0) {
      return null;
    }

    if (indices.length === 1) {
      return new KDNode(points[indices[0]], depth % 3);
    }

    // Select dimension to split on (alternate R, G, B)
    const dimension = depth % 3;

    // Sort indices by the value at that dimension (smaller allocations than sorting full points)
    indices.sort((a, b) => {
      const aPoint = points[a];
      const bPoint = points[b];
      const aVal = dimension === 0 ? aPoint.x : dimension === 1 ? aPoint.y : aPoint.z;
      const bVal = dimension === 0 ? bPoint.x : dimension === 1 ? bPoint.y : bPoint.z;
      return aVal - bVal;
    });

    // Find median
    const median = Math.floor(indices.length / 2);
    const medianPoint = points[indices[median]];

    // Create node
    const node = new KDNode(medianPoint, dimension);

    // Recursively build left and right subtrees using index slices
    // Index arrays are much smaller than point arrays (just numbers vs objects)
    node.left = this.buildTreeOptimized(points, indices.slice(0, median), depth + 1);
    node.right = this.buildTreeOptimized(points, indices.slice(median + 1), depth + 1);

    return node;
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private distance(p1: Point3D, p2: Point3D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Find nearest neighbor to target point
   * @param target - Target point to search for
   * @param excludeData - Optional function to exclude certain data points
   * @returns Nearest point or null if tree is empty
   */
  nearestNeighbor(target: Point3D, excludeData?: (data: unknown) => boolean): Point3D | null {
    if (!this.root) {
      return null;
    }

    const best = this.searchNearest(this.root, target, 0, null, excludeData);
    return best?.point ?? null;
  }

  /**
   * Recursive nearest neighbor search
   */
  private searchNearest(
    node: KDNode | null,
    target: Point3D,
    depth: number,
    best: { point: Point3D; distance: number } | null,
    excludeData?: (data: unknown) => boolean
  ): { point: Point3D; distance: number } | null {
    if (!node) {
      return best;
    }

    const dimension = node.dimension;
    const nodeValue =
      dimension === 0 ? node.point.x : dimension === 1 ? node.point.y : node.point.z;
    const targetValue = dimension === 0 ? target.x : dimension === 1 ? target.y : target.z;

    // Check if current node is better
    if (!excludeData || !excludeData(node.point.data)) {
      const dist = this.distance(target, node.point);
      if (!best || dist < best.distance) {
        best = { point: node.point, distance: dist };
      }
    }

    // Determine which side to search first
    const isLeft = targetValue < nodeValue;
    const nearChild = isLeft ? node.left : node.right;
    const farChild = isLeft ? node.right : node.left;

    // Search near side
    if (nearChild) {
      best = this.searchNearest(nearChild, target, depth + 1, best, excludeData);
    }

    // CORE-BUG-003 FIX: Check if we need to search far side
    // Search far side if:
    // 1. best is null (no valid node found yet, far side might have one), OR
    // 2. axis distance is within best.distance (far side might have closer match)
    // Use <= to handle edge case where target is exactly on splitting plane
    if (farChild) {
      if (!best || Math.abs(targetValue - nodeValue) <= best.distance) {
        best = this.searchNearest(farChild, target, depth + 1, best, excludeData);
      }
    }

    return best;
  }

  /**
   * Find all points within a distance threshold
   * @param target - Target point
   * @param maxDistance - Maximum distance
   * @param excludeData - Optional function to exclude certain data points
   * @returns Array of points within distance, sorted by distance
   */
  pointsWithinDistance(
    target: Point3D,
    maxDistance: number,
    excludeData?: (data: unknown) => boolean
  ): Array<{ point: Point3D; distance: number }> {
    if (!this.root) {
      return [];
    }

    const results: Array<{ point: Point3D; distance: number }> = [];
    this.searchWithinDistance(this.root, target, 0, maxDistance, results, excludeData);

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Recursive search for points within distance
   */
  private searchWithinDistance(
    node: KDNode | null,
    target: Point3D,
    depth: number,
    maxDistance: number,
    results: Array<{ point: Point3D; distance: number }>,
    excludeData?: (data: unknown) => boolean
  ): void {
    if (!node) {
      return;
    }

    const dimension = node.dimension;
    const nodeValue =
      dimension === 0 ? node.point.x : dimension === 1 ? node.point.y : node.point.z;
    const targetValue = dimension === 0 ? target.x : dimension === 1 ? target.y : target.z;

    // Check if current node is within distance
    if (!excludeData || !excludeData(node.point.data)) {
      const dist = this.distance(target, node.point);
      if (dist <= maxDistance) {
        results.push({ point: node.point, distance: dist });
      }
    }

    // Determine which side to search
    const isLeft = targetValue < nodeValue;
    const nearChild = isLeft ? node.left : node.right;
    const farChild = isLeft ? node.right : node.left;

    // Search near side
    if (nearChild) {
      this.searchWithinDistance(nearChild, target, depth + 1, maxDistance, results, excludeData);
    }

    // Check if we need to search far side
    if (farChild) {
      const axisDistance = Math.abs(targetValue - nodeValue);
      if (axisDistance <= maxDistance) {
        this.searchWithinDistance(farChild, target, depth + 1, maxDistance, results, excludeData);
      }
    }
  }

  /**
   * Get tree size
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if tree is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }
}
