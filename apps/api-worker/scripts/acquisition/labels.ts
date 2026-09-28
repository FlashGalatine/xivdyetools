/**
 * Outposts for wilderness vendors (spec D10): the settlement the game's map
 * draws nearest the NPC. `MapMarker` positions are pixels on the 2048-px map
 * texture; NPC positions (Teamcraft) are in-game map coordinates.
 *
 * Only the map's two settlement symbols count. Stables, shops, forges and raid
 * entrances carry labels too and stand right beside their vendors — the
 * nearest label of any kind named "Chocobokeep" for a vendor in Quarrymill and
 * "The Diamond Forge" for one in Revenant's Toll — so a vendor with no
 * settlement near gets no outpost at all (spec Goal 2: blank beats wrong).
 */

export interface MapLabel {
  name: string;
  x: number;
  y: number;
  /** `MapMarker.Icon` */
  icon: number;
  /** `MapMarker.DataType` */
  dataType: number;
}

/**
 * `MapMarker.DataType` of an aetheryte. From Heavensward on, the aetheryte's
 * marker carries the name of the settlement around it (Quarrymill, Revenant's
 * Toll, Worlar's Echo, Crick for the Onokoro aetheryte).
 */
const AETHERYTE_MARKER = 3;

/**
 * Icon 060448, the map's settlement symbol: A Realm Reborn's settlements, whose
 * aetheryte markers carry no label (Fallgourd Float, Horizon), and settlements
 * without an aetheryte (Hyrstmill, Vesper Bay, Whitebrim Front).
 */
const SETTLEMENT_ICON = 60448;

/** In-game map coordinate of a MapMarker pixel: 41 units across at SizeFactor 100. */
export function markerCoordinate(px: number, sizeFactor: number): number {
  return (41 / (sizeFactor / 100)) * (px / 2048) + 1;
}

function isSettlement(label: MapLabel): boolean {
  return label.dataType === AETHERYTE_MARKER || label.icon === SETTLEMENT_ICON;
}

/** The closest settlement label within `maxDistance` map units, or null. */
export function nearestSettlement(labels: readonly MapLabel[], x: number, y: number, maxDistance = 3): string | null {
  let best: MapLabel | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const label of labels) {
    if (!isSettlement(label)) continue;
    const distance = Math.hypot(label.x - x, label.y - y);
    if (distance <= maxDistance && distance < bestDistance) {
      best = label;
      bestDistance = distance;
    }
  }
  return best?.name ?? null;
}
