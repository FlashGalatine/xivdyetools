/**
 * The public endpoint registry — one row per documented route.
 *
 * Everything that counts or lists endpoints reads from here: the sidebar
 * counts in `config.ts`, the grouped live index on `/reference/`, the mobile
 * section sheet. `preview` is the one real request each index row makes on
 * load (hand-picked so the answer carries colours); `null` means the row is
 * never fetched and prints `previewNote` instead.
 */

export type HttpMethod = 'GET' | 'POST';

export interface GroupEntry {
  name: string;
  page: string;
  blurb: string;
}

export interface EndpointEntry {
  key: string;
  group: string;
  method: HttpMethod;
  path: string;
  summary: string;
  /** Doc page + anchor — the VitePress slug of the `## METHOD /path` heading. */
  link: string;
  preview: string | null;
  previewNote?: string;
}

export interface GuidePage {
  text: string;
  link: string;
  blurb: string;
}

export const GROUPS: readonly GroupEntry[] = [
  { name: 'Dyes', page: '/reference/dyes', blurb: 'Database, lookups, groups' },
  { name: 'Color Matching', page: '/reference/matching', blurb: 'Closest, within distance' },
  { name: 'Character Equipment', page: '/reference/chara', blurb: '.chara resolve, icons' },
  { name: 'Harmony', page: '/reference/harmony', blurb: 'Colour wheels, harmony slots' },
];

export const GUIDE_PAGES: readonly GuidePage[] = [
  { text: 'Quick Start', link: '/guide/', blurb: 'Base URL, first request' },
  { text: 'Responses', link: '/guide/responses', blurb: 'The envelope' },
  { text: 'Errors', link: '/guide/errors', blurb: 'Typed codes' },
  { text: 'Rate Limits', link: '/guide/rate-limits', blurb: 'Headers, windows' },
];

export const ENDPOINTS: readonly EndpointEntry[] = [
  {
    key: 'dyes',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes',
    summary: 'List all dyes with filtering, sorting, and pagination.',
    link: '/reference/dyes#get-v1-dyes',
    preview: '/v1/dyes?category=Reds&perPage=12',
  },
  {
    key: 'dye',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes/:id',
    summary: 'Look up a single dye; ID type inferred by range.',
    link: '/reference/dyes#get-v1-dyes-id',
    preview: '/v1/dyes/1',
  },
  {
    key: 'stain',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes/stain/:stainId',
    summary: 'Look up a dye by stain table ID (1–254).',
    link: '/reference/dyes#get-v1-dyes-stain-stainid',
    preview: '/v1/dyes/stain/5',
  },
  {
    key: 'search',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes/search',
    summary: 'Case-insensitive substring match on names; localized when locale is set.',
    link: '/reference/dyes#get-v1-dyes-search',
    preview: '/v1/dyes/search?q=rose',
  },
  {
    key: 'categories',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes/categories',
    summary: 'All dye categories with their counts.',
    link: '/reference/dyes#get-v1-dyes-categories',
    preview: '/v1/dyes/categories',
  },
  {
    key: 'batch',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes/batch',
    summary: 'Multiple dyes by ID in one request; notFound array for misses.',
    link: '/reference/dyes#get-v1-dyes-batch',
    preview: '/v1/dyes/batch?ids=1,2,3,4,5,6',
  },
  {
    key: 'consolidation',
    group: 'Dyes',
    method: 'GET',
    path: '/v1/dyes/consolidation-groups',
    summary: 'Patch 7.5 consolidation groups A / B / C and their members.',
    link: '/reference/dyes#get-v1-dyes-consolidation-groups',
    preview: '/v1/dyes/consolidation-groups',
  },
  {
    key: 'closest',
    group: 'Color Matching',
    method: 'GET',
    path: '/v1/match/closest',
    summary: 'The single closest dye to a hex color.',
    link: '/reference/matching#get-v1-match-closest',
    preview: '/v1/match/closest?hex=EA4133',
  },
  {
    key: 'within',
    group: 'Color Matching',
    method: 'GET',
    path: '/v1/match/within-distance',
    summary: 'Every dye within a distance of a hex color.',
    link: '/reference/matching#get-v1-match-within-distance',
    preview: '/v1/match/within-distance?hex=EA4133&maxDistance=12',
  },
  {
    key: 'resolve',
    group: 'Character Equipment',
    method: 'POST',
    path: '/v1/chara/resolve',
    summary: 'Resolve .chara gear model keys to items.',
    link: '/reference/chara#post-v1-chara-resolve',
    preview: null,
    previewNote: 'POST · no preview',
  },
  {
    key: 'icon',
    group: 'Character Equipment',
    method: 'GET',
    path: '/v1/chara/icon/:iconId',
    summary: 'Item icon proxy (PNG).',
    link: '/reference/chara#get-v1-chara-icon-iconid',
    preview: null,
    previewNote: 'image · no preview',
  },
  {
    key: 'wheels',
    group: 'Harmony',
    method: 'GET',
    path: '/v1/wheels',
    summary: 'The five colour wheels harmony angles can be measured on.',
    link: '/reference/harmony#get-v1-wheels',
    preview: '/v1/wheels',
  },
  {
    key: 'wheel',
    group: 'Harmony',
    method: 'GET',
    path: '/v1/wheels/:id',
    summary: 'One wheel: its ring paint and where every dye sits on it.',
    link: '/reference/harmony#get-v1-wheels-id',
    preview: '/v1/wheels/ryb?stops=12',
  },
  {
    key: 'harmony-types',
    group: 'Harmony',
    method: 'GET',
    path: '/v1/harmony/types',
    summary: 'The ten harmony types and their hue offsets.',
    link: '/reference/harmony#get-v1-harmony-types',
    preview: '/v1/harmony/types',
  },
  {
    key: 'harmony',
    group: 'Harmony',
    method: 'GET',
    path: '/v1/harmony',
    summary: 'A dye for every slot of a harmony, on the wheel you choose.',
    link: '/reference/harmony#get-v1-harmony',
    preview: '/v1/harmony?dye=13&type=triadic&wheel=ryb',
  },
];

export function endpointsIn(group: string): EndpointEntry[] {
  return ENDPOINTS.filter((e) => e.group === group);
}

export function countFor(group: string): number {
  return endpointsIn(group).length;
}

/** `7 ENDPOINTS` / `1 ENDPOINT` — the mono group tag. */
export function endpointCountLabel(n: number): string {
  return `${n} ENDPOINT${n === 1 ? '' : 'S'}`;
}
