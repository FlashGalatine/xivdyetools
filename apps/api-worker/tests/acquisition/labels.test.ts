import { describe, expect, it } from 'vitest';
import { markerCoordinate, nearestSettlement, type MapLabel } from '../../scripts/acquisition/labels.js';

describe('markerCoordinate', () => {
  it('maps the 2048-px texture onto 41 map units at SizeFactor 100', () => {
    expect(markerCoordinate(0, 100)).toBeCloseTo(1);
    expect(markerCoordinate(2048, 100)).toBeCloseTo(42);
    expect(markerCoordinate(2048, 200)).toBeCloseTo(21.5);
  });
});

// Real MapMarker rows at XIVAPI 541c0c12e07da325 (7.56x1). Icon 60453 + DataType 3
// is an aetheryte, 60448 the settlement symbol, 60311 a chocobo stable, 60442 a
// landmark dot, 60441 + DataType 1 a zone exit, icon 0 a region or area name.
const label = (name: string, x: number, y: number, icon: number, dataType = 0): MapLabel => ({ name, x, y, icon, dataType });

describe('nearestSettlement', () => {
  const urqopacha = [
    label('Ten Thousand Steps', 32.93, 34.83, 0),
    label("Worlar's Echo", 30.83, 34.21, 60453, 3),
    label('Solace', 29.43, 37.64, 0),
    label("Kozama'uka", 36.05, 34.23, 60441, 1),
  ];

  it("names the settlement an aetheryte marker labels (the Independent Merchant stands in Worlar's Echo)", () => {
    expect(nearestSettlement(urqopacha, 30.47, 34.64)).toBe("Worlar's Echo");
  });

  it('names the settlement, not the chocobo stable beside the vendor (E-Una-Kotor: Chocobokeep 0.22, Quarrymill 0.60)', () => {
    const southShroud = [
      label('Chocobokeep', 24.92, 20.56, 60311),
      label('Quarrymill', 25.08, 20.08, 60453, 3),
      label('Silent Arbor', 24.62, 18.78, 0),
    ];
    expect(nearestSettlement(southShroud, 25.11, 20.68)).toBe('Quarrymill');
  });

  it("names Revenant's Toll, not the shop or forge the vendor stands in", () => {
    const morDhona = [
      label('The Diamond Forge', 22.28, 5.58, 60442),
      label("Rowena's House of Splendors", 22.06, 5.96, 60442),
      label("Revenant's Toll", 22.3, 8.13, 60453, 3),
      label('Coerthas Central Highlands', 23.88, 6.29, 60441, 1),
    ];
    expect(nearestSettlement(morDhona, 22.31, 5.55)).toBe("Revenant's Toll");
  });

  it("takes A Realm Reborn's settlement symbol, whose aetheryte markers carry no label", () => {
    const southShroud = [label('Chocobokeep', 17.42, 20.32, 60311), label("Buscarron's Druthers", 17.86, 20.52, 60448)];
    expect(nearestSettlement(southShroud, 18.23, 19.92)).toBe("Buscarron's Druthers");
  });

  it('returns null when only facilities, landmarks, area names or zone exits are near (The Workbench, 0.50 away)', () => {
    const tempest = [
      label('The Workbench', 34.53, 25.32, 60442),
      label('Purpure', 33.73, 30.63, 60442),
      label('The Ondo Cups', 32.73, 17.52, 60453, 3),
    ];
    expect(nearestSettlement(tempest, 34.29, 25.76)).toBeNull();
    expect(nearestSettlement([label('Ten Thousand Steps', 30.5, 34.6, 0), label("Kozama'uka", 30.4, 34.7, 60441, 1)], 30.47, 34.64)).toBeNull();
  });

  it('returns null when no settlement is within 3 map units', () => {
    expect(nearestSettlement(urqopacha, 10, 10)).toBeNull();
    expect(nearestSettlement([], 30, 30)).toBeNull();
  });
});
