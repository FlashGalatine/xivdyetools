/**
 * Response-object field tables, authored once as data so the console card can
 * fold them under its parameter form (`<EndpointCard fields="dye">`). The
 * rows mirror `src/lib/dye-serializer.ts` — the serializer is the contract,
 * this is its description.
 */

export interface FieldRow {
  name: string;
  type: string;
  description: string;
}

export interface FieldSet {
  label: string;
  rows: FieldRow[];
}

export const FIELD_SETS: Record<'dye', FieldSet> = {
  dye: {
    label: 'Dye Object',
    rows: [
      { name: 'itemID', type: 'integer', description: 'Legacy game item ID (equals stainID for future consolidated-only dyes)' },
      { name: 'stainID', type: 'integer', description: 'Stain table ID (1–254)' },
      { name: 'id', type: 'integer', description: 'Same as itemID' },
      { name: 'name', type: 'string', description: 'English dye name' },
      { name: 'localizedName', type: 'string?', description: 'Present only when locale ≠ en' },
      { name: 'hex', type: 'string', description: 'Hex color (#RRGGBB)' },
      { name: 'rgb', type: 'object', description: '{ r, g, b } — 0–255' },
      { name: 'hsv', type: 'object', description: '{ h, s, v } — hue 0–360, sat/val 0–100' },
      { name: 'category', type: 'string', description: 'Blues · Browns · Greens · Neutral · Purples · Reds · Special · Yellows' },
      { name: 'acquisition', type: 'string', description: 'Dye Vendor · The Firmament · Cosmic Exploration · Venture Coffers' },
      { name: 'cost', type: 'integer', description: 'Vendor price' },
      { name: 'currency', type: 'string | null', description: 'Gil · Skybuilders Scrips · Cosmocredits · Venture Coffer (one per acquisition)' },
      { name: 'isMetallic', type: 'boolean', description: 'Metallic sheen' },
      { name: 'isPastel', type: 'boolean', description: 'Pastel shade' },
      { name: 'isDark', type: 'boolean', description: 'Dark shade' },
      { name: 'isCosmic', type: 'boolean', description: 'From Cosmic Exploration' },
      { name: 'isIshgardian', type: 'boolean', description: 'From Ishgardian Restoration' },
      { name: 'consolidationType', type: 'string | null', description: 'Patch 7.5 group: A, B, C, or null' },
      {
        name: 'marketItemID',
        type: 'integer',
        description:
          'Item ID for market-board lookups only (Universalis) — never a dye lookup key. 105 dyes share 52254 / 52255 / 52256 since Patch 7.5; GET /v1/dyes/:id rejects those with a hint pointing at /v1/dyes/consolidation-groups',
      },
    ],
  },
};
