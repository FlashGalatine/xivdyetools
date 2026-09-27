/**
 * Outposts for wilderness vendors (spec D10): the nearest area label the game
 * prints on the NPC's map. `MapMarker` positions are pixels on the 2048-px map
 * texture; NPC positions (Teamcraft) are in-game map coordinates.
 */

export interface MapLabel {
  name: string;
  x: number;
  y: number;
}

/** In-game map coordinate of a MapMarker pixel: 41 units across at SizeFactor 100. */
export function markerCoordinate(px: number, sizeFactor: number): number {
  return (41 / (sizeFactor / 100)) * (px / 2048) + 1;
}

/** The closest label within `maxDistance` map units, or null. */
export function nearestLabel(labels: readonly MapLabel[], x: number, y: number, maxDistance = 3): string | null {
  let best: MapLabel | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const label of labels) {
    const distance = Math.hypot(label.x - x, label.y - y);
    if (distance <= maxDistance && distance < bestDistance) {
      best = label;
      bestDistance = distance;
    }
  }
  return best?.name ?? null;
}
