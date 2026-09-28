/** Builders for the acquisition stage tests: empty inputs and tables to fill per case. */

import type { Inputs, Npc, Tables } from '../../scripts/acquisition/model.js';

export function emptyInputs(): Inputs {
  return {
    items: new Map(),
    recipes: new Map(),
    offers: new Map(),
    npcs: new Map(),
    zoneLevels: new Map(),
    dutyNames: new Map(),
    duties: new Map(),
    containers: new Map(),
    onlineStore: new Set(),
    quests: new Map(),
    questInfo: new Map(),
    achievements: new Map(),
    fates: new Map(),
    voyages: new Map(),
    desynth: new Map(),
    relics: new Map(),
    unmappedTokens: new Set(),
  };
}

export function emptyTables(): Tables {
  return {
    gachaContainers: new Set(),
    eurekaLockboxes: new Map(),
    ishgardDistricts: new Set(['Foundation', 'The Pillars', 'The Firmament']),
  };
}

export function npc(id: number, name: string, zone: string | null, extra: Partial<Npc> = {}): Npc {
  return { id, name, zone, outpost: null, unreachable: false, ...extra };
}

const SET_KEYS = new Set(['onlineStore', 'unmappedTokens']);

/** The acceptance fixture stores every Map as entry pairs and every Set as an array. */
export function reviveInputs(json: Record<string, unknown>): Inputs {
  const out: Record<string, unknown> = { unmappedTokens: new Set() };
  for (const [key, value] of Object.entries(json)) {
    out[key] = SET_KEYS.has(key) ? new Set(value as number[]) : new Map(value as Array<[unknown, unknown]>);
  }
  return out as unknown as Inputs;
}
