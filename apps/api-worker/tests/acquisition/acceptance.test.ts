/**
 * Acceptance: a real glamour written by hand to the GPOSERS guide, reproduced
 * from the pinned data (research §5). The fixture is the normalized inputs for
 * these items only, written by `build-acquisition.ts --fixture`.
 */

import { describe, expect, it } from 'vitest';
import { formatEntries } from '../../scripts/acquisition/format.js';
import { tablesFrom } from '../../scripts/acquisition/inputs.js';
import { selectEntries } from '../../scripts/acquisition/select.js';
import { collectSources } from '../../scripts/acquisition/sources.js';
import eurekaLockboxes from '../../scripts/acquisition/tables/eureka-lockboxes.json';
import gacha from '../../scripts/acquisition/tables/gacha-containers.json';
import ishgardDistricts from '../../scripts/acquisition/tables/ishgard-districts.json';
import fixture from './fixtures/inputs.json';
import { reviveInputs } from './helpers.js';

const inputs = reviveInputs(fixture as unknown as Record<string, unknown>);
const tables = tablesFrom({ gacha, eurekaLockboxes, ishgardDistricts }, inputs);
const lineFor = (itemId: number): string | null =>
  formatEntries(selectEntries(collectSources(itemId, inputs), inputs, tables).entries, inputs, tables);

describe('acceptance — the user\'s "Cropsey" glamour', () => {
  it.each([
    [47878, 'Phantom Gear & Weapons'],
    [42027, "Crafted (WVR Lvl. 92) / Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)"],
    [42038, "Crafted (WVR Lvl. 93) / Independent Merchant - Urqopacha - Worlar's Echo (47,471 Gil)"],
    [32326, "Eden's Promise: Litany (Savage) / Eden's Promise: Anamorphosis (Savage)"],
    [47252, "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)"],
    [32797, "Enie - Ishgard - The Firmament (1,200 Skybuilders' Scrips)"],
  ])('item %i reads as written by hand', (itemId, expected) => {
    expect(lineFor(itemId)).toBe(expected);
  });
});

describe('acceptance — research §2–§3 pieces', () => {
  it.each([
    [36828, 'FFXIV Online Store'],
    [44665, 'FFXIV Online Store'],
    [10059, 'Zodiac Weapons Saga'],
  ])('item %i', (itemId, expected) => {
    expect(lineFor(itemId)).toBe(expected);
  });
});
