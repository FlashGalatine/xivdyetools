# Core Library Upgrade to v1.1.0

**Date**: November 2025  
**Upgraded From**: `xivdyetools-core@1.0.1`  
**Upgraded To**: `xivdyetools-core@1.1.0`

## Summary

The web app has been upgraded to use `xivdyetools-core@1.1.0`, which includes significant performance optimizations, improved type safety, and architectural improvements. **No code changes were required** - the upgrade is fully backward compatible.

## What Changed

### 1. Performance Optimizations

#### LRU Caching (Automatic)
- **Color Conversions**: All color conversion operations (hex↔RGB↔HSV) are now cached
- **Expected Speedup**: 60-80% faster for repeated conversions
- **Cache Size**: 1000 entries per conversion type
- **Impact**: Faster UI interactions, especially in tools that perform many color conversions:
  - Color Matcher Tool
  - Dye Mixer Tool
  - Harmony Generator Tool
  - Color Wheel Display

#### Hue-Indexed Harmony Lookups (Automatic)
- **Harmony Generation**: 70-90% faster
- **Implementation**: Hue bucket indexing (10° buckets, 36 total)
- **Impact**: Faster harmony generation in Harmony Generator Tool

#### k-d Tree for Color Matching (Automatic)
- **Dye Matching**: 10-20x speedup for `findClosestDye()` and `findDyesWithinDistance()`
- **Algorithm**: Custom 3D RGB color space k-d tree
- **Complexity**: O(log n) average case vs O(n) linear search
- **Impact**: Faster color matching in:
  - Color Matcher Tool
  - Dye Mixer Tool
  - Harmony Generator Tool

### 2. Type Safety Improvements

#### Branded Types
- `HexColor`, `DyeId`, `Hue`, `Saturation` are now branded types
- Factory functions with validation: `createHexColor()`, `createDyeId()`
- **Note**: The web app's existing `HexColor` type is compatible (same structure)

### 3. Service Architecture

#### Service Class Splitting
- Services have been split into focused classes for better maintainability
- **Backward Compatibility**: All existing APIs remain unchanged
- The web app continues to use `ColorService` and `DyeService` as before
- Internal improvements don't affect the public API

## Benefits for the Web App

### Performance Improvements

1. **Faster Color Conversions**
   - Repeated color conversions are cached
   - UI feels more responsive
   - Less CPU usage during heavy operations

2. **Faster Dye Matching**
   - k-d tree makes color matching 10-20x faster
   - Better user experience in color matching tools
   - Can handle larger datasets efficiently

3. **Faster Harmony Generation**
   - Hue-indexed lookups make harmony generation 70-90% faster
   - Smoother interactions in Harmony Generator Tool

### Code Quality

- Better type safety (branded types)
- Improved code organization (internal refactoring)
- Better maintainability (split services)

## No Breaking Changes

✅ All existing APIs remain unchanged  
✅ All method signatures are identical  
✅ Type compatibility maintained  
✅ No code changes required in the web app

## Testing

The web app has been verified to work with the new core version:
- ✅ TypeScript type checking passes
- ✅ All existing functionality preserved
- ✅ Performance improvements are automatic

## Future Considerations

### Optional: Use Branded Types

The web app currently defines its own `HexColor` type. You could optionally:
- Import `HexColor` and `createHexColor` from `xivdyetools-core`
- Use `createHexColor()` for validation when accepting user input
- This would provide runtime validation in addition to type safety

### Optional: Use Cache Statistics

The new core provides cache statistics:
```typescript
import { ColorService } from 'xivdyetools-core';

const stats = ColorService.getCacheStats();
console.log('Cache hits:', stats);
```

This could be useful for:
- Performance monitoring
- Debugging
- Analytics

## Migration Notes

**No migration required!** The upgrade is seamless:
1. ✅ Dependency updated in `package.json`
2. ✅ `npm install` completed
3. ✅ Type checking passes
4. ✅ All functionality preserved

## References

- [Core Library CHANGELOG](../../xivdyetools-core/CHANGELOG.md)
- [Core Library README](../../xivdyetools-core/README.md)
- [Optimization Initiative Documentation](./optimization-20251123/README.md) (now in historical folder)

---

**Legal Disclaimer**: This is a fan-made tool and is not affiliated with or endorsed by Square Enix Co., Ltd. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.

**Copyright © 2025 Flash Galatine**

