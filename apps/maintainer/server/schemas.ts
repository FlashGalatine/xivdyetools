import { z } from 'zod'
// MAINT-REF-003 FIX: Import from centralized constants
import { LOCALE_CODES } from '../src/utils/constants.js'

/**
 * RGB Color Schema
 * Validates RGB values (0-255 for each channel)
 */
const RGBSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
})

/**
 * HSV Color Schema
 * Validates HSV values (hue 0-360, saturation/value 0-100)
 */
const HSVSchema = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  v: z.number().min(0).max(100),
})

/**
 * Dye Object Schema
 * Validates individual dye objects from colors_xiv.json
 */
export const DyeSchema = z.object({
  itemID: z.number().int().positive().nullable(),
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color format'),
  acquisition: z.string().min(1).max(100),
  price: z.number().int().min(0).nullable(),
  currency: z.string().min(1).max(50).nullable(),
  rgb: RGBSchema,
  hsv: HSVSchema,
  isMetallic: z.boolean(),
  isPastel: z.boolean(),
  isDark: z.boolean(),
  isCosmic: z.boolean(),
})

/**
 * Dye Array Schema
 * Validates the entire colors_xiv.json file (array of dyes)
 */
export const DyeArraySchema = z.array(DyeSchema).min(1, 'At least one dye is required')

/**
 * Locale Metadata Schema
 * Validates the meta section of locale files
 */
const LocaleMetaSchema = z.object({
  version: z.string().min(1),
  generated: z.string().min(1),
  dyeCount: z.number().int().min(0),
})

/**
 * Locale Labels Schema
 * Validates the labels section of locale files
 */
const LocaleLabelsSchema = z.object({
  dye: z.string().min(1),
  dark: z.string().min(1),
  metallic: z.string().min(1),
  pastel: z.string().min(1),
  cosmic: z.string().min(1),
  cosmicExploration: z.string().min(1),
  cosmicFortunes: z.string().min(1),
})

/**
 * Locale Data Schema
 * Validates locale JSON files (en.json, ja.json, etc.)
 */
export const LocaleDataSchema = z.object({
  // MAINT-REF-003 FIX: Use centralized constant
  locale: z.enum(LOCALE_CODES),
  meta: LocaleMetaSchema,
  labels: LocaleLabelsSchema,
  dyeNames: z.record(z.string(), z.string()).refine(
    (data) => Object.keys(data).length > 0,
    'dyeNames must contain at least one entry'
  ),
  // Optional fields that may be present in locale files
  categories: z.record(z.string(), z.string()).optional(),
  acquisitions: z.record(z.string(), z.string()).optional(),
  harmonyTypes: z.record(z.string(), z.string()).optional(),
  visionTypes: z.record(z.string(), z.string()).optional(),
  jobs: z.record(z.string(), z.string()).optional(),
  grandCompanies: z.record(z.string(), z.string()).optional(),
  metallicDyeIds: z.array(z.number().int().positive()).optional(),
})
