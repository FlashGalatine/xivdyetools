/**
 * Script to add type flags to all dyes in colors_xiv.json
 *
 * Classification rules:
 * - isMetallic: name contains "Metallic"
 * - isPastel: name contains "Pastel"
 * - isDark: name starts with "Dark " (but NOT if name contains "Metallic")
 * - isCosmic: acquisition is "Cosmic Exploration" or "Cosmic Fortunes"
 */

import * as fs from 'fs';
import * as path from 'path';

const COLORS_FILE = path.join(__dirname, '../src/data/colors_xiv.json');

interface DyeData {
  itemID: number;
  category: string;
  name: string;
  hex: string;
  acquisition: string;
  price: number | null;
  currency: string | null;
  rgb: { r: number; g: number; b: number };
  hsv: { h: number; s: number; v: number };
  isMetallic?: boolean;
  isPastel?: boolean;
  isDark?: boolean;
  isCosmic?: boolean;
}

// Read the existing dyes
const dyes: DyeData[] = JSON.parse(fs.readFileSync(COLORS_FILE, 'utf-8'));

console.log(`Processing ${dyes.length} dyes...`);

let metallicCount = 0;
let pastelCount = 0;
let darkCount = 0;
let cosmicCount = 0;

// Add type flags to each dye
const updatedDyes = dyes.map((dye) => {
  const isMetallic = dye.name.includes('Metallic');
  const isPastel = dye.name.includes('Pastel');
  const isDark = dye.name.startsWith('Dark ') && !isMetallic;
  const isCosmic =
    dye.acquisition === 'Cosmic Exploration' || dye.acquisition === 'Cosmic Fortunes';

  if (isMetallic) metallicCount++;
  if (isPastel) pastelCount++;
  if (isDark) darkCount++;
  if (isCosmic) cosmicCount++;

  return {
    ...dye,
    isMetallic,
    isPastel,
    isDark,
    isCosmic,
  };
});

// Write back to file with proper formatting
fs.writeFileSync(COLORS_FILE, JSON.stringify(updatedDyes, null, 2) + '\n', 'utf-8');

console.log('✅ Type flags added successfully!');
console.log(`   - Metallic dyes: ${metallicCount}`);
console.log(`   - Pastel dyes: ${pastelCount}`);
console.log(`   - Dark dyes: ${darkCount}`);
console.log(`   - Cosmic dyes: ${cosmicCount}`);
console.log(`   - Total dyes: ${updatedDyes.length}`);
