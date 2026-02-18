import path from 'path'
import fs from 'fs/promises'

/**
 * Validate base paths at server startup
 *
 * Ensures that:
 * 1. Core path resolves to the expected xivdyetools-core directory
 * 2. Colors file exists and is accessible
 * 3. Locales directory exists and is accessible
 *
 * This is a fail-fast check that catches configuration errors before the server starts.
 *
 * @param corePath - Path to the xivdyetools-core directory
 * @param colorsPath - Path to the colors_xiv.json file
 * @param localesPath - Path to the locales directory
 * @throws Error if validation fails
 */
export async function validateBasePaths(
  corePath: string,
  colorsPath: string,
  localesPath: string
): Promise<void> {
  console.log('🔒 Validating base paths...')

  // Check that core path resolves correctly
  const resolvedCore = path.resolve(corePath)
  const normalizedCore = path.normalize(resolvedCore)

  // Verify the path ends with 'xivdyetools-core' (platform-independent)
  if (!normalizedCore.endsWith(path.join('xivdyetools-core'))) {
    throw new Error(
      `Core path validation failed: Expected path ending with 'xivdyetools-core', got '${normalizedCore}'`
    )
  }

  // Check that required paths exist
  try {
    await fs.access(colorsPath, fs.constants.R_OK | fs.constants.W_OK)
    console.log(`  ✓ Colors file: ${colorsPath}`)
  } catch (error) {
    throw new Error(`Colors file not accessible: ${colorsPath}`)
  }

  try {
    await fs.access(localesPath, fs.constants.R_OK | fs.constants.W_OK)
    console.log(`  ✓ Locales directory: ${localesPath}`)
  } catch (error) {
    throw new Error(`Locales directory not accessible: ${localesPath}`)
  }

  console.log('✓ Path validation passed')
}

/**
 * Validate that a file path doesn't escape the base directory
 *
 * Protects against path traversal attacks by ensuring the resolved
 * file path stays within the expected base directory.
 *
 * Example attacks this prevents:
 * - /api/locale/../../etc/passwd
 * - /api/locale/..%2F..%2Fetc%2Fpasswd
 * - /api/locale/../../../sensitive-file
 *
 * @param filePath - The file path to validate
 * @param basePath - The base directory that the file must be within
 * @returns true if the file path is safe, false otherwise
 *
 * @example
 * // Safe path
 * validateFilePath('/data/locales/en.json', '/data/locales') // true
 *
 * // Path traversal attempt
 * validateFilePath('/data/locales/../../etc/passwd', '/data/locales') // false
 */
export function validateFilePath(filePath: string, basePath: string): boolean {
  // Resolve both paths to absolute paths
  const resolvedFile = path.resolve(filePath)
  const resolvedBase = path.resolve(basePath)

  // Normalize paths to handle platform differences
  const normalizedFile = path.normalize(resolvedFile)
  const normalizedBase = path.normalize(resolvedBase)

  // Check if the file path starts with the base path
  // Use path.sep to ensure we're checking for a directory boundary
  const isWithinBase =
    normalizedFile === normalizedBase ||
    normalizedFile.startsWith(normalizedBase + path.sep)

  if (!isWithinBase) {
    console.warn(
      `🚫 Path traversal attempt detected:\n  File: ${normalizedFile}\n  Base: ${normalizedBase}`
    )
  }

  return isWithinBase
}
