# Core Library Types

**Type system and branded types in @xivdyetools/core**

---

## Branded Types

The library uses TypeScript branded types for type-safe identifiers. These prevent accidental misuse of raw values where validated types are expected.

### HexColor

```typescript
import { HexColor, createHexColor, isValidHexColor } from '@xivdyetools/core';

// Create validated hex color
const hex: HexColor = createHexColor('#FF6B6B');  // ✅ Valid

// Validation happens at runtime
createHexColor('#invalid');  // ❌ Throws Error

// Check before creating
if (isValidHexColor(userInput)) {
  const hex = createHexColor(userInput);
}

// Type prevents raw strings
function processColor(hex: HexColor) { ... }
processColor('#FF6B6B');           // ❌ Type error
processColor(createHexColor('#FF6B6B')); // ✅ Works
```

### DyeId

```typescript
import { DyeId, createDyeId, isValidDyeId } from '@xivdyetools/core';

// Valid dye IDs are 1-136
const dyeId: DyeId = createDyeId(42);  // ✅ Valid

createDyeId(0);    // ❌ Throws: Invalid dye ID
createDyeId(200);  // ❌ Throws: Invalid dye ID

// Validation
if (isValidDyeId(userInput)) {
  const id = createDyeId(userInput);
}
```

### Hue, Saturation, Value

```typescript
import { Hue, Saturation, Value, createHue, createSaturation } from '@xivdyetools/core';

// Hue: 0-360 degrees
const hue: Hue = createHue(180);  // ✅

// Saturation: 0-100%
const sat: Saturation = createSaturation(50);  // ✅

// Value/Lightness: 0-100%
const val: Value = createValue(75);  // ✅
```

---

## Color Types

### RGB

```typescript
interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}
```

### HSV (Hue-Saturation-Value)

```typescript
interface HSV {
  h: number;  // 0-360 degrees
  s: number;  // 0-100%
  v: number;  // 0-100%
}
```

### HSL (Hue-Saturation-Lightness)

```typescript
interface HSL {
  h: number;  // 0-360 degrees
  s: number;  // 0-100%
  l: number;  // 0-100%
}
```

### LAB (CIE L*a*b*)

```typescript
interface LAB {
  l: number;  // 0-100 (lightness)
  a: number;  // -128 to 127 (green-red)
  b: number;  // -128 to 127 (blue-yellow)
}
```

---

## Dye Types

### Dye

```typescript
interface Dye {
  id: DyeId;
  name: string;
  hex: HexColor;
  rgb: RGB;
  category: DyeCategory;
  itemId?: number;     // FFXIV item ID for market lookup
  sellable: boolean;
}
```

### DyeCategory

```typescript
type DyeCategory =
  | 'basic'
  | 'brown'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'metallic';
```

### DyeMatch

```typescript
interface DyeMatch {
  dye: Dye;
  distance: number;   // RGB Euclidean distance
  deltaE: number;     // CIE deltaE (perceptual difference)
}
```

### HarmonyResult

```typescript
interface HarmonyResult {
  type: HarmonyType;
  colors: DyeMatch[];
}

type HarmonyType =
  | 'complementary'
  | 'triadic'
  | 'analogous'
  | 'split-complementary'
  | 'tetradic'
  | 'monochromatic';
```

---

## Accessibility Types

### WCAGResult

```typescript
interface WCAGResult {
  ratio: number;      // Contrast ratio (1:1 to 21:1)
  AA: boolean;        // 4.5:1 normal text
  AAA: boolean;       // 7:1 normal text
  AALarge: boolean;   // 3:1 large text
  AAALarge: boolean;  // 4.5:1 large text
}
```

### ColorblindnessType

```typescript
type ColorblindnessType =
  | 'protanopia'     // Red-green (L-cone deficiency)
  | 'deuteranopia'   // Red-green (M-cone deficiency)
  | 'tritanopia';    // Blue-yellow (S-cone deficiency)
```

---

## API Types

### PriceData

```typescript
interface PriceData {
  itemId: number;
  server: string;
  listings: PriceListing[];
  recentHistory: PriceHistory[];
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  lastUploadTime: number;
}

interface PriceListing {
  pricePerUnit: number;
  quantity: number;
  total: number;
  hq: boolean;
  retainerName: string;
  worldName?: string;
}
```

### ICacheBackend

Interface for custom cache implementations:

```typescript
interface ICacheBackend {
  get(key: string): Promise<CachedData | null>;
  set(key: string, value: CachedData): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface CachedData {
  data: unknown;
  timestamp: number;
  ttl: number;
}
```

---

## Preset Types

### Preset

```typescript
interface Preset {
  id: string;
  name: string;
  description?: string;
  colors: PresetColor[];
  category: PresetCategory;
  author?: PresetAuthor;
  upvotes: number;
  downvotes: number;
  status: PresetStatus;
  isCurated: boolean;
  createdAt: string;
}

interface PresetColor {
  dyeId: DyeId;
  name: string;
  hex: HexColor;
}

type PresetStatus = 'pending' | 'approved' | 'rejected';
```

---

## Localization Types

### Locale

```typescript
type Locale = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';
```

### TranslationKey

```typescript
type TranslationKey =
  | `dye.${string}`
  | `category.${string}`
  | `harmony.${string}`
  | `ui.${string}`;
```

---

## Utility Types

### DeepReadonly

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Used for immutable dye database
type ImmutableDyeDatabase = DeepReadonly<Dye[]>;
```

### Result Type

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Used in validation functions
function validateHex(input: string): Result<HexColor, string> {
  if (isValidHexColor(input)) {
    return { success: true, data: createHexColor(input) };
  }
  return { success: false, error: 'Invalid hex color format' };
}
```

---

## Related Documentation

- [Services](services.md) - Service API reference
- [Overview](overview.md) - Quick start guide
- [Algorithms](algorithms.md) - Implementation details
