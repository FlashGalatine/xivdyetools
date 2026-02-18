/**
 * Type definitions for the Dye Maintainer app
 */

export type LocaleCode = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSV {
  h: number
  s: number
  v: number
}

export interface DyeFormState {
  itemID: number | null
  category: string
  name: string
  hex: string
  acquisition: string
  price: number | null
  currency: string | null
  isMetallic: boolean
  isPastel: boolean
  isDark: boolean
  isCosmic: boolean
  locales: Record<LocaleCode, string>
}

export interface Dye {
  itemID: number | null
  category: string
  name: string
  hex: string
  acquisition: string
  price: number | null
  currency: string | null
  rgb: RGB
  hsv: HSV
  isMetallic: boolean
  isPastel: boolean
  isDark: boolean
  isCosmic: boolean
}

export interface LocaleMeta {
  version: string
  generated: string
  dyeCount: number
}

export interface LocaleLabels {
  dye: string
  dark: string
  metallic: string
  pastel: string
  cosmic: string
  cosmicExploration: string
  cosmicFortunes: string
}

export interface LocaleData {
  locale: LocaleCode
  meta: LocaleMeta
  labels: LocaleLabels
  dyeNames: Record<string, string>
  categories?: Record<string, string>
  acquisitions?: Record<string, string>
  harmonyTypes?: Record<string, string>
  visionTypes?: Record<string, string>
  jobs?: Record<string, string>
  grandCompanies?: Record<string, string>
  metallicDyeIds?: number[]
}

export interface ValidationError {
  field: string
  message: string
}

export interface WriteResult {
  success: boolean
  error?: string
}

export interface XivapiItemResponse {
  schema: string
  version: string
  rows: Array<{
    row_id: number
    fields: {
      Icon?: {
        id: number
        path: string
        path_hr1?: string
      }
      Name: string
      Singular?: string
    }
  }>
}
