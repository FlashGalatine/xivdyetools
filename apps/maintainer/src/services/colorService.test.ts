/**
 * Unit tests for colorService — thin wrapper over @xivdyetools/core color
 * helpers plus the local normalizeHex.
 */

import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  hexToHsv,
  rgbToHex,
  validateHexColor,
  normalizeHex,
} from './colorService'

describe('hexToRgb', () => {
  it('parses a 6-digit hex', () => {
    expect(hexToRgb('#8b4513')).toEqual({ r: 139, g: 69, b: 19 })
  })
})

describe('hexToHsv', () => {
  it('pure red → h=0, full saturation and value', () => {
    const hsv = hexToHsv('#ff0000')
    expect(hsv.h).toBe(0)
    expect(hsv.s).toBeGreaterThan(0.99)
    expect(hsv.v).toBeGreaterThan(0.99)
  })
})

describe('rgbToHex', () => {
  it('round-trips with hexToRgb', () => {
    const hex = rgbToHex(139, 69, 19).toLowerCase()
    expect(hex).toBe('#8b4513')
  })
})

describe('validateHexColor', () => {
  it('accepts valid 6-digit hex', () => {
    expect(validateHexColor('#8b4513')).toBe(true)
  })

  it('rejects malformed values', () => {
    expect(validateHexColor('not-a-color')).toBe(false)
    expect(validateHexColor('#12345')).toBe(false)
  })
})

describe('normalizeHex', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeHex('')).toBe('')
  })

  it('adds a missing # prefix', () => {
    expect(normalizeHex('8B4513')).toBe('#8b4513')
  })

  it('expands 3-digit shorthand', () => {
    expect(normalizeHex('#F80')).toBe('#ff8800')
  })

  it('lowercases the result', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc')
  })
})
