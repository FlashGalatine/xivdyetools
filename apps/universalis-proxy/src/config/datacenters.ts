/**
 * FFXIV Datacenter Configuration
 *
 * Valid datacenter and world names for request validation.
 * This whitelist prevents requests with invalid datacenter values
 * from reaching the upstream Universalis API.
 *
 * SECURITY: Whitelisting prevents cache pollution and reduces attack surface.
 *
 * @module config/datacenters
 */

/**
 * Valid FFXIV datacenters (as of Patch 7.x / Dawntrail)
 *
 * Universalis API accepts datacenter names case-insensitively.
 * This set uses lowercase for consistent comparison.
 */
export const VALID_DATACENTERS = new Set([
  // Japan
  'elemental',
  'gaia',
  'mana',
  'meteor',
  // North America
  'aether',
  'crystal',
  'dynamis',
  'primal',
  // Europe
  'chaos',
  'light',
  // Oceania
  'materia',
]);

/**
 * Valid FFXIV worlds (servers)
 *
 * Universalis API also accepts world names instead of datacenter names.
 * This set allows querying by specific world.
 */
export const VALID_WORLDS = new Set([
  // Japan - Elemental
  'aegis',
  'atomos',
  'carbuncle',
  'garuda',
  'gungnir',
  'kujata',
  'tonberry',
  'typhon',
  // Japan - Gaia
  'alexander',
  'bahamut',
  'durandal',
  'fenrir',
  'ifrit',
  'ridill',
  'tiamat',
  'ultima',
  // Japan - Mana
  'anima',
  'asura',
  'chocobo',
  'hades',
  'ixion',
  'masamune',
  'pandaemonium',
  'titan',
  // Japan - Meteor
  'belias',
  'mandragora',
  'ramuh',
  'shinryu',
  'unicorn',
  'valefor',
  'yojimbo',
  'zeromus',
  // NA - Aether
  'adamantoise',
  'cactuar',
  'faerie',
  'gilgamesh',
  'jenova',
  'midgardsormr',
  'sargatanas',
  'siren',
  // NA - Crystal
  'balmung',
  'brynhildr',
  'coeurl',
  'diabolos',
  'goblin',
  'malboro',
  'mateus',
  'zalera',
  // NA - Dynamis
  'cuchulainn',
  'golem',
  'halicarnassus',
  'kraken',
  'maduin',
  'marilith',
  'rafflesia',
  'seraph',
  // NA - Primal
  'behemoth',
  'excalibur',
  'exodus',
  'famfrit',
  'hyperion',
  'lamia',
  'leviathan',
  'ultros',
  // EU - Chaos
  'cerberus',
  'louisoix',
  'moogle',
  'omega',
  'phantom',
  'ragnarok',
  'sagittarius',
  'spriggan',
  // EU - Light
  'alpha',
  'lich',
  'odin',
  'phoenix',
  'raiden',
  'shiva',
  'twintania',
  'zodiark',
  // Oceania - Materia
  'bismarck',
  'ravana',
  'sephirot',
  'sophia',
  'zurvan',
]);

/**
 * Check if a datacenter/world name is valid
 *
 * @param name - Datacenter or world name (case-insensitive)
 * @returns true if valid, false otherwise
 */
export function isValidDatacenterOrWorld(name: string): boolean {
  const lower = name.toLowerCase();
  return VALID_DATACENTERS.has(lower) || VALID_WORLDS.has(lower);
}
