import { describe, expect, it } from 'vitest';
import { markerCoordinate, nearestLabel } from '../../scripts/acquisition/labels.js';

describe('markerCoordinate', () => {
  it('maps the 2048-px texture onto 41 map units at SizeFactor 100', () => {
    expect(markerCoordinate(0, 100)).toBeCloseTo(1);
    expect(markerCoordinate(2048, 100)).toBeCloseTo(42);
    expect(markerCoordinate(2048, 200)).toBeCloseTo(21.5);
  });
});

describe('nearestLabel', () => {
  const urqopacha = [
    { name: 'Ten Thousand Steps', x: 32.93, y: 34.83 },
    { name: "Worlar's Echo", x: 30.83, y: 34.21 },
    { name: 'Solace', x: 29.43, y: 37.64 },
  ];

  it('picks the closest label (the Independent Merchant stands in Worlar\'s Echo)', () => {
    expect(nearestLabel(urqopacha, 30.47, 34.64)).toBe("Worlar's Echo");
  });

  it('returns null when nothing is within 3 map units', () => {
    expect(nearestLabel(urqopacha, 10, 10)).toBeNull();
    expect(nearestLabel([], 30, 30)).toBeNull();
  });
});
