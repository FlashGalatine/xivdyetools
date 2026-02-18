/**
 * Convert PNG icons to WebP format and create responsive sizes
 * 
 * This script requires sharp: npm install sharp --save-dev
 * Run: node scripts/convert-icons-to-webp.js
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '../assets/icons');
const sizes = [
  { name: 'icon-40x40.webp', width: 40, height: 40 },
  { name: 'icon-60x60.webp', width: 60, height: 60 },
  { name: 'icon-80x80.webp', width: 80, height: 80 },
  { name: 'icon-192x192.webp', width: 192, height: 192 },
  { name: 'icon-512x512.webp', width: 512, height: 512 }
];

async function convertIcons() {
  const sourceFile = path.join(iconsDir, 'icon-192x192.png');
  
  if (!fs.existsSync(sourceFile)) {
    console.error('Source file not found:', sourceFile);
    process.exit(1);
  }

  console.log('Converting icons to WebP format...');
  
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, size.name);
    
    try {
      await sharp(sourceFile)
        .resize(size.width, size.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .webp({ quality: 85 })
        .toFile(outputPath);
      
      const stats = fs.statSync(outputPath);
      console.log(`✓ Created ${size.name} (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      console.error(`✗ Failed to create ${size.name}:`, error.message);
    }
  }
  
  console.log('Icon conversion complete!');
}

// Run the conversion
convertIcons().catch((error) => {
  console.error('Error converting icons:', error.message);
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('sharp is not installed. Run: npm install sharp --save-dev');
  }
  process.exit(1);
});

