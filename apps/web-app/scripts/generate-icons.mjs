/**
 * Generate PNG icons from sparkles.svg for various platforms
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVG_PATH = path.join(__dirname, '../public/assets/icons/sparkles.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/assets/icons');
const ASSETS_ICONS_DIR = path.join(__dirname, '../assets/icons');

// Icon sizes needed for various platforms
const ICON_SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'icon-40x40.png', size: 40 },
  { name: 'icon-60x60.png', size: 60 },
  { name: 'icon-80x80.png', size: 80 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

async function generateIcons() {
  console.log('Reading SVG file...');
  
  // Read SVG content
  const svgContent = fs.readFileSync(SVG_PATH, 'utf8');
  
  // Add a white/light background to the SVG for better visibility
  // Replace currentColor with a dark color for the brush handle
  const modifiedSvg = svgContent
    .replace(/fill="currentColor"/g, 'fill="#1e293b"'); // slate-800 for brush handle

  console.log('Generating PNG icons...\n');

  for (const icon of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, icon.name);
    const assetsOutputPath = path.join(ASSETS_ICONS_DIR, icon.name);
    
    try {
      await sharp(Buffer.from(modifiedSvg))
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      
      // Also copy to assets/icons for the main app
      fs.copyFileSync(outputPath, assetsOutputPath);
      
      console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
    } catch (err) {
      console.error(`✗ Failed to generate ${icon.name}:`, err.message);
    }
  }

  // Generate favicon.ico (multi-size ICO file using 32x32 PNG as base)
  console.log('\nGenerating favicon.ico...');
  try {
    const favicon32Path = path.join(OUTPUT_DIR, 'favicon-32x32.png');
    const faviconPath = path.join(OUTPUT_DIR, 'favicon.ico');
    const assetsFaviconPath = path.join(ASSETS_ICONS_DIR, 'favicon.ico');
    
    // Create ICO from PNG (sharp can output to ico format on some systems)
    // For now, just copy the 32x32 PNG with .ico extension as a fallback
    // Most modern browsers support PNG favicons
    await sharp(Buffer.from(modifiedSvg))
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath.replace('.ico', '.png'));
    
    // Copy the favicon
    fs.copyFileSync(favicon32Path, faviconPath);
    fs.copyFileSync(faviconPath, assetsFaviconPath);
    
    console.log('✓ Generated favicon.ico');
  } catch (err) {
    console.error('✗ Failed to generate favicon.ico:', err.message);
  }

  // Generate WebP versions for better compression
  console.log('\nGenerating WebP icons...');
  const webpSizes = [
    { name: 'icon-40x40.webp', size: 40 },
    { name: 'icon-60x60.webp', size: 60 },
    { name: 'icon-80x80.webp', size: 80 },
    { name: 'icon-192x192.webp', size: 192 },
    { name: 'icon-512x512.webp', size: 512 },
  ];

  for (const icon of webpSizes) {
    const outputPath = path.join(OUTPUT_DIR, icon.name);
    const assetsOutputPath = path.join(ASSETS_ICONS_DIR, icon.name);
    
    try {
      await sharp(Buffer.from(modifiedSvg))
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 90 })
        .toFile(outputPath);
      
      fs.copyFileSync(outputPath, assetsOutputPath);
      
      console.log(`✓ Generated ${icon.name}`);
    } catch (err) {
      console.error(`✗ Failed to generate ${icon.name}:`, err.message);
    }
  }

  console.log('\n✅ Icon generation complete!');
}

generateIcons().catch(console.error);
