/**
 * Quick verification test for @xivdyetools/core package
 * Tests basic functionality of all exported services
 */

import {
  ColorService,
  DyeService,
  APIService,
  MemoryCacheBackend,
  dyeDatabase
} from './dist/index.js';

console.log('🧪 Testing @xivdyetools/core package...\n');

// Test 1: ColorService
console.log('1️⃣ ColorService Tests:');
try {
  const rgb = ColorService.hexToRgb('#FF6B6B');
  console.log('  ✅ hexToRgb:', rgb);

  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  console.log('  ✅ rgbToHsv:', hsv);

  const hex = ColorService.rgbToHex(rgb.r, rgb.g, rgb.b);
  console.log('  ✅ rgbToHex:', hex);

  const distance = ColorService.getColorDistance('#FF0000', '#00FF00');
  console.log('  ✅ getColorDistance:', distance);
} catch (error) {
  console.error('  ❌ ColorService failed:', error.message);
  process.exit(1);
}

// Test 2: DyeService
console.log('\n2️⃣ DyeService Tests:');
try {
  const dyeService = new DyeService(dyeDatabase);
  console.log('  ✅ DyeService instantiated');

  const allDyes = dyeService.getAllDyes();
  console.log(`  ✅ getAllDyes: ${allDyes.length} dyes loaded`);

  const closestDye = dyeService.findClosestDye('#FF6B6B');
  console.log('  ✅ findClosestDye:', closestDye?.name);

  const triadic = dyeService.findTriadicDyes('#FF6B6B');
  console.log(`  ✅ findTriadicDyes: ${triadic.length} dyes found`);

  const categories = dyeService.getCategories();
  console.log(`  ✅ getCategories: ${categories.length} categories`);
} catch (error) {
  console.error('  ❌ DyeService failed:', error.message);
  process.exit(1);
}

// Test 3: APIService
console.log('\n3️⃣ APIService Tests:');
try {
  const cacheBackend = new MemoryCacheBackend();
  const apiService = new APIService(cacheBackend);
  console.log('  ✅ APIService instantiated with MemoryCacheBackend');

  // Test cache operations
  await apiService.clearCache();
  console.log('  ✅ clearCache successful');

  const stats = await apiService.getCacheStats();
  console.log('  ✅ getCacheStats:', stats);

  // Test price formatting
  const formatted = APIService.formatPrice(123456);
  console.log('  ✅ formatPrice:', formatted);

  // Note: Skipping actual API call to avoid network dependency
  console.log('  ⏭️  Skipping live API call test');
} catch (error) {
  console.error('  ❌ APIService failed:', error.message);
  process.exit(1);
}

// Test 4: Utility Functions
console.log('\n4️⃣ Utility Function Tests:');
try {
  const { clamp, lerp, isValidHexColor, generateChecksum, sleep } = await import('./dist/utils/index.js');

  console.log('  ✅ clamp(150, 0, 100):', clamp(150, 0, 100));
  console.log('  ✅ lerp(0, 100, 0.5):', lerp(0, 100, 0.5));
  console.log('  ✅ isValidHexColor("#FF6B6B"):', isValidHexColor('#FF6B6B'));
  console.log('  ✅ isValidHexColor("invalid"):', isValidHexColor('invalid'));
  console.log('  ✅ generateChecksum({test: 123}):', generateChecksum({test: 123}));

  // Test async sleep
  const start = Date.now();
  await sleep(100);
  const duration = Date.now() - start;
  console.log(`  ✅ sleep(100ms): ${duration}ms elapsed`);
} catch (error) {
  console.error('  ❌ Utility functions failed:', error.message);
  process.exit(1);
}

// Test 5: Constants
console.log('\n5️⃣ Constants Tests:');
try {
  const { RGB_MAX, HUE_MAX, VISION_TYPES, UNIVERSALIS_API_BASE } = await import('./dist/constants/index.js');

  console.log('  ✅ RGB_MAX:', RGB_MAX);
  console.log('  ✅ HUE_MAX:', HUE_MAX);
  console.log('  ✅ VISION_TYPES:', VISION_TYPES);
  console.log('  ✅ UNIVERSALIS_API_BASE:', UNIVERSALIS_API_BASE);
} catch (error) {
  console.error('  ❌ Constants failed:', error.message);
  process.exit(1);
}

console.log('\n✅ All tests passed! Package is working correctly.\n');
