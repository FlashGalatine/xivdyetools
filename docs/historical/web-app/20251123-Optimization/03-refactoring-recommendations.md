# Code Refactoring Recommendations
## xivdyetools-core & xivdyetools-discord-bot

**Date:** November 23, 2025  
**Status:** Planning Phase

---

## Executive Summary

This document outlines code quality improvements and refactoring opportunities for the XIVDyeTools ecosystem. The codebase is generally well-structured, but there are opportunities to improve maintainability, testability, type safety, and code reuse. Recommendations are categorized by priority and effort level.

---

## 1. xivdyetools-core Refactoring

### 1.1 Type Safety Improvements

#### Issue: Loose Type Definitions
**Location:** `src/types/index.ts`, various service files

**Current State:**
- `HexColor` is a type alias for `string` (no runtime validation)
- No branded types to prevent mixing different string types
- `any` used in some cache/data structures

**Recommended Refactoring:**

1. **Implement Branded Types**
   ```typescript
   // src/types/index.ts
   
   // Current
   export type HexColor = string;
   
   // Refactored - prevents accidental string assignment
   export type HexColor = string & { readonly __brand: 'HexColor' };
   
   export function createHexColor(hex: string): HexColor | null {
     if (!/^#[0-9A-F]{6}$/i.test(hex)) {
       return null;
     }
     return hex.toUpperCase() as HexColor;
   }
   
   // Similarly for other domain types
   export type DyeId = number & { readonly __brand: 'DyeId' };
   export type Hue = number & { readonly __brand: 'Hue' }; // 0-360
   export type Saturation = number & { readonly __brand: 'Saturation' }; // 0-100
   ```

2. **Stricter Function Signatures**
   ```typescript
   // Before
   hexToRgb(hex: string): RGB
   
   // After
   hexToRgb(hex: HexColor): RGB
   
   // Usage requires explicit validation
   const hex = createHexColor(userInput);
   if (hex) {
     const rgb = ColorService.hexToRgb(hex);
   }
   ```

3. **Generic Type Constraints**
   ```typescript
   // Make CachedData more specific
   export interface CachedData<T = unknown> {
     value: T;
     timestamp: number;
     ttl?: number;
   }
   
   // Add constraints for cache backends
   export interface ICacheBackend {
     get<T extends Serializable>(key: string): Promise<CachedData<T> | null>;
     set<T extends Serializable>(key: string, value: CachedData<T>): Promise<void>;
   }
   
   type Serializable = string | number | boolean | null | 
     Serializable[] | { [key: string]: Serializable };
   ```

**Priority:** Medium  
**Effort:** Medium (requires API changes, but backward compatible)

---

### 1.2 Service Class Refactoring

#### Issue: Large Monolithic Classes
**Location:** `src/services/ColorService.ts` (385 lines), `src/services/DyeService.ts` (511 lines)

**Analysis:**
- ColorService has 25 methods covering conversions, simulations, accessibility
- DyeService has 31 methods covering database, search, harmonies
- Violates Single Responsibility Principle

**Recommended Refactoring:**

**1. Split ColorService into Focused Classes**

```typescript
// src/services/color/ColorConverter.ts
export class ColorConverter {
  hexToRgb(hex: HexColor): RGB { ... }
  rgbToHex(r: number, g: number, b: number): HexColor { ... }
  rgbToHsv(r: number, g: number, b: number): HSV { ... }
  hsvToRgb(h: number, s: number, v: number): RGB { ... }
  hexToHsv(hex: HexColor): HSV { ... }
  hsvToHex(h: number, s: number, v: number): HexColor { ... }
}

// src/services/color/ColorAccessibility.ts
export class ColorAccessibility {
  getPerceivedLuminance(hex: HexColor): number { ... }
  getContrastRatio(hex1: HexColor, hex2: HexColor): number { ... }
  meetsWCAGAA(hex1: HexColor, hex2: HexColor, largeText?: boolean): boolean { ... }
  meetsWCAGAAA(hex1: HexColor, hex2: HexColor, largeText?: boolean): boolean { ... }
  getOptimalTextColor(backgroundColor: HexColor): HexColor { ... }
}

// src/services/color/ColorblindnessSimulator.ts
export class ColorblindnessSimulator {
  simulateColorblindness(rgb: RGB, visionType: VisionType): RGB { ... }
  simulateColorblindnessHex(hex: HexColor, visionType: VisionType): HexColor { ... }
  
  // Transformation matrices as private static constants
  private static readonly MATRICES = { ... };
}

// src/services/color/ColorManipulator.ts
export class ColorManipulator {
  adjustBrightness(hex: HexColor, amount: number): HexColor { ... }
  adjustSaturation(hex: HexColor, amount: number): HexColor { ... }
  rotateHue(hex: HexColor, degrees: number): HexColor { ... }
  invert(hex: HexColor): HexColor { ... }
  desaturate(hex: HexColor): HexColor { ... }
}

// Maintain backward compatibility with facade pattern
// src/services/ColorService.ts
export class ColorService {
  private converter = new ColorConverter();
  private accessibility = new ColorAccessibility();
  private simulator = new ColorblindnessSimulator();
  private manipulator = new ColorManipulator();
  
  // Delegate to sub-services (maintain existing API)
  hexToRgb(hex: HexColor): RGB {
    return this.converter.hexToRgb(hex);
  }
  // ... delegate all other methods
  
  // Expose sub-services for advanced usage
  get convert() { return this.converter; }
  get wcag() { return this.accessibility; }
  get simulate() { return this.simulator; }
  get manipulate() { return this.manipulator; }
}
```

**Benefits:**
- Each class has <200 lines
- Easier to test in isolation
- Can import only what you need
- Maintains backward compatibility

**2. Split DyeService into Layers**

```typescript
// src/services/dye/DyeDatabase.ts
export class DyeDatabase {
  getAllDyes(): Dye[] { ... }
  getDyeById(id: DyeId): Dye | null { ... }
  getDyesByIds(ids: DyeId[]): Dye[] { ... }
  searchByName(query: string): Dye[] { ... }
  searchByCategory(category: string): Dye[] { ... }
  filterDyes(filter: DyeFilter): Dye[] { ... }
}

// src/services/dye/DyeSearch.ts
export class DyeSearch {
  constructor(private db: DyeDatabase) {}
  
  findClosestDye(hex: HexColor, excludeIds?: DyeId[]): Dye | null { ... }
  findDyesWithinDistance(hex: HexColor, maxDistance: number, limit?: number): Dye[] { ... }
  findClosestDyeByHue(targetHue: Hue, usedIds: Set<DyeId>, tolerance: number): Dye | null { ... }
}

// src/services/dye/HarmonyGenerator.ts
export class HarmonyGenerator {
  constructor(private db: DyeDatabase, private search: DyeSearch) {}
  
  findComplementaryPair(hex: HexColor): Dye | null { ... }
  findAnalogousDyes(hex: HexColor, angle?: number): Dye[] { ... }
  findTriadicDyes(hex: HexColor): Dye[] { ... }
  findTetradicDyes(hex: HexColor): Dye[] { ... }
  findSquareDyes(hex: HexColor): Dye[] { ... }
  findMonochromaticDyes(hex: HexColor, limit?: number): Dye[] { ... }
  findCompoundDyes(hex: HexColor): Dye[] { ... }
  findSplitComplementaryDyes(hex: HexColor): Dye[] { ... }
  findShadesDyes(hex: HexColor): Dye[] { ... }
  
  private findHarmonyDyesByOffsets(hex: HexColor, offsets: number[], options?: HarmonyOptions): Dye[] { ... }
}

// Facade for backward compatibility
// src/services/DyeService.ts
export class DyeService {
  private db: DyeDatabase;
  private search: DyeSearch;
  private harmony: HarmonyGenerator;
  
  constructor(dyeData?: unknown) {
    this.db = new DyeDatabase(dyeData);
    this.search = new DyeSearch(this.db);
    this.harmony = new HarmonyGenerator(this.db, this.search);
  }
  
  // Delegate methods...
  getAllDyes(): Dye[] { return this.db.getAllDyes(); }
  findClosestDye(hex: HexColor, excludeIds?: DyeId[]): Dye | null {
    return this.search.findClosestDye(hex, excludeIds);
  }
  findTriadicDyes(hex: HexColor): Dye[] {
    return this.harmony.findTriadicDyes(hex);
  }
  // ... etc
}
```

**Priority:** Low to Medium (improves maintainability but doesn't affect functionality)  
**Effort:** High (major refactoring, requires thorough testing)

---

### 1.3 Error Handling Standardization

#### Issue: Inconsistent Error Handling
**Current State:**
- Some methods throw errors, others return `null`
- No custom error types
- Error messages not standardized

**Recommended Refactoring:**

1. **Create Custom Error Types**
   ```typescript
   // src/errors/index.ts
   
   export class XivDyeToolsError extends Error {
     constructor(message: string, public code: string) {
       super(message);
       this.name = 'XivDyeToolsError';
     }
   }
   
   export class InvalidColorError extends XivDyeToolsError {
     constructor(value: string) {
       super(`Invalid color format: ${value}`, 'INVALID_COLOR');
       this.name = 'InvalidColorError';
     }
   }
   
   export class DyeNotFoundError extends XivDyeToolsError {
     constructor(id: DyeId) {
       super(`Dye not found: ${id}`, 'DYE_NOT_FOUND');
       this.name = 'DyeNotFoundError';
     }
   }
   
   export class DatabaseNotLoadedError extends XivDyeToolsError {
     constructor() {
       super('Dye database not loaded', 'DATABASE_NOT_LOADED');
       this.name = 'DatabaseNotLoadedError';
     }
   }
   ```

2. **Use Result Type Pattern (Alternative)**
   ```typescript
   // For operations that commonly fail
   export type Result<T, E = Error> = 
     | { success: true; value: T }
     | { success: false; error: E };
   
   // Usage
   findClosestDye(hex: HexColor, excludeIds?: DyeId[]): Result<Dye, 'NOT_FOUND' | 'DATABASE_ERROR'> {
     if (!this.isLoaded) {
       return { success: false, error: 'DATABASE_ERROR' };
     }
     
     const dye = /* search logic */;
     if (!dye) {
       return { success: false, error: 'NOT_FOUND' };
     }
     
     return { success: true, value: dye };
   }
   ```

**Priority:** Medium  
**Effort:** Medium

---

### 1.4 Utility Functions Extraction

#### Issue: Duplicate Code Patterns
**Location:** Throughout ColorService and DyeService

**Recommended Refactoring:**

```typescript
// src/utils/math.ts
export const MathUtils = {
  clamp: (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  },
  
  normalize: (value: number, min: number, max: number): number => {
    return (value - min) / (max - min);
  },
  
  lerp: (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
  },
  
  modulo: (n: number, m: number): number => {
    return ((n % m) + m) % m; // Handles negative numbers correctly
  },
};

// src/utils/color.ts
export const ColorUtils = {
  normalizeHue: (hue: number): Hue => {
    return MathUtils.modulo(hue, 360) as Hue;
  },
  
  hueDifference: (h1: Hue, h2: Hue): number => {
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
  },
  
  euclideanDistance: (rgb1: RGB, rgb2: RGB): number => {
    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  },
};
```

**Priority:** Low  
**Effort:** Low

---

## 2. xivdyetools-discord-bot Refactoring

### 2.1 Command Structure Standardization

#### Issue: Inconsistent Command Patterns
**Location:** `src/commands/*.ts`

**Current State:**
- Some commands have separate test files, others don't
- Varying patterns for option handling
- Inconsistent error handling

**Recommended Refactoring:**

1. **Create Command Base Class**
   ```typescript
   // src/commands/base/CommandBase.ts
   
   export abstract class CommandBase implements BotCommand {
     abstract data: SlashCommandBuilder;
     
     abstract executeImpl(interaction: ChatInputCommandInteraction): Promise<void>;
     
     // Template method with error handling
     async execute(interaction: ChatInputCommandInteraction): Promise<void> {
       try {
         await this.executeImpl(interaction);
       } catch (error) {
         await this.handleError(interaction, error);
       }
     }
     
     protected async handleError(interaction: ChatInputCommandInteraction, error: unknown): Promise<void> {
       logger.error(`Error in ${this.data.name}:`, error);
       
       const errorMessage = this.getErrorMessage(error);
       
       if (interaction.replied || interaction.deferred) {
         await interaction.followUp({ content: errorMessage, ephemeral: true });
       } else {
         await interaction.reply({ content: errorMessage, ephemeral: true });
       }
     }
     
     protected getErrorMessage(error: unknown): string {
       if (error instanceof InvalidColorError) {
         return '❌ Invalid color format. Please use #RRGGBB format.';
       }
       if (error instanceof DyeNotFoundError) {
         return '❌ Dye not found. Please check the dye ID.';
       }
       return '❌ An error occurred while processing your command.';
     }
   }
   ```

2. **Refactor Commands to Use Base Class**
   ```typescript
   // src/commands/match.ts
   
   export class MatchCommand extends CommandBase {
     data = new SlashCommandBuilder()
       .setName('match')
       .setDescription('Find the closest dye to a color')
       .addStringOption(/* ... */);
     
     async executeImpl(interaction: ChatInputCommandInteraction): Promise<void> {
       const hexInput = interaction.options.getString('color', true);
       const hex = createHexColor(hexInput);
       
       if (!hex) {
         throw new InvalidColorError(hexInput);
       }
       
       const closestDye = dyeService.findClosestDye(hex);
       if (!closestDye) {
         throw new DyeNotFoundError(0); // or specific error
       }
       
       const embed = this.buildEmbed(closestDye, hex);
       await interaction.reply({ embeds: [embed] });
     }
     
     private buildEmbed(dye: Dye, targetColor: HexColor): EmbedBuilder {
       // Extract embed building logic
       return new EmbedBuilder()
         .setTitle(`🎨 Closest Match: ${dye.name}`)
         .setColor(dye.hex)
         // ... etc
     }
   }
   
   export default new MatchCommand();
   ```

**Priority:** Medium  
**Effort:** Medium

---

### 2.2 Service Layer Extraction

#### Issue: Business Logic in Command Files
**Location:** Various command files

**Current State:**
- Commands contain complex logic for data formatting
- Duplicate code across similar commands
- Hard to test business logic in isolation

**Recommended Refactoring:**

1. **Create Domain Services**
   ```typescript
   // src/services/dye-formatting.ts
   
   export class DyeFormattingService {
     formatDyeInfo(dye: Dye, options?: FormattingOptions): string {
       let info = `**${dye.name}**\n`;
       info += `ID: ${dye.id}\n`;
       info += `Color: ${dye.hex}\n`;
       
       if (options?.includeHSV) {
         const hsv = ColorService.hexToHsv(dye.hex);
         info += `HSV: ${hsv.h}°, ${hsv.s}%, ${hsv.v}%\n`;
       }
       
       if (options?.includeCategory) {
         info += `Category: ${dye.category}\n`;
       }
       
       return info;
     }
     
     formatDyeList(dyes: Dye[], format: 'inline' | 'detailed' = 'inline'): string {
       if (format === 'inline') {
         return dyes.map(d => `${emojiService.getDyeEmoji(d.id)} ${d.name}`).join(', ');
       } else {
         return dyes.map((d, i) => `${i + 1}. ${this.formatDyeInfo(d)}`).join('\n\n');
       }
     }
   }
   
   // src/services/harmony-calculator.ts
   
   export class HarmonyCalculatorService {
     calculateHarmony(
       baseDye: Dye,
       harmonyType: HarmonyType,
       options?: HarmonyOptions
     ): HarmonyResult {
       const companionCount = this.getCompanionCount(harmonyType);
       const companions = dyeService.findHarmonyDyes(baseDye.hex, harmonyType);
       
       return {
         base: baseDye,
         companions,
         type: harmonyType,
         devianceScore: this.calculateDeviance(baseDye, companions, harmonyType),
       };
     }
     
     private calculateDeviance(base: Dye, companions: Dye[], type: HarmonyType): number {
       // Extract complex deviance calculation logic
       // ...
     }
   }
   ```

2. **Use Services in Commands**
   ```typescript
   // src/commands/harmony.ts
   
   const formattingService = new DyeFormattingService();
   const harmonyService = new HarmonyCalculatorService();
   
   export class HarmonyCommand extends CommandBase {
     async executeImpl(interaction: ChatInputCommandInteraction): Promise<void> {
       const dyeId = interaction.options.getInteger('dye', true) as DyeId;
       const harmonyType = interaction.options.getString('type', true) as HarmonyType;
       
       const baseDye = dyeService.getDyeById(dyeId);
       if (!baseDye) {
         throw new DyeNotFoundError(dyeId);
       }
       
       const harmony = harmonyService.calculateHarmony(baseDye, harmonyType);
       const embed = this.buildHarmonyEmbed(harmony);
       
       await interaction.reply({ embeds: [embed] });
     }
   }
   ```

**Priority:** Medium  
**Effort:** Medium

---

### 2.3 Renderer Improvements

#### Issue: Renderers Have Side Effects
**Location:** `src/renderers/*.ts`

**Current State:**
- Renderers use Canvas/Sharp to generate images
- Tightly coupled to specific libraries
- Hard to mock for testing

**Recommended Refactoring:**

1. **Interface-based Rendering**
   ```typescript
   // src/renderers/interfaces.ts
   
   export interface ImageRenderer {
     render(data: RenderData): Promise<Buffer>;
   }
   
   export interface RenderData {
     width: number;
     height: number;
     // Specific data for each renderer type
   }
   
   export interface ColorWheelRenderData extends RenderData {
     baseDye: Dye;
     companions: Dye[];
     harmonyType: HarmonyType;
   }
   ```

2. **Separate Rendering Logic from Data Preparation**
   ```typescript
   // src/renderers/color-wheel/ColorWheelDataPreparation.ts
   
   export class ColorWheelDataPreparation {
     prepare(baseDye: Dye, companions: Dye[], harmonyType: HarmonyType): ColorWheelRenderData {
       // Pure function - no side effects
       return {
         width: 512,
         height: 512,
         baseDye,
         companions,
         harmonyType,
         // Calculate positions, angles, etc.
       };
     }
   }
   
   // src/renderers/color-wheel/ColorWheelRenderer.ts
   
   export class ColorWheelRenderer implements ImageRenderer {
     constructor(private canvasFactory: () => Canvas) {}
     
     async render(data: ColorWheelRenderData): Promise<Buffer> {
       const canvas = this.canvasFactory();
       const ctx = canvas.getContext('2d');
       
       // Rendering logic using prepared data
       // ...
       
       return canvas.toBuffer('image/webp');
     }
   }
   ```

3. **Testable Factory**
   ```typescript
   // src/renderers/factory.ts
   
   export class RendererFactory {
     static createColorWheelRenderer(): ColorWheelRenderer {
       if (process.env.NODE_ENV === 'test') {
         // Use mock canvas for testing
         return new ColorWheelRenderer(() => new MockCanvas());
       } else {
         return new ColorWheelRenderer(() => createCanvas(512, 512));
       }
     }
   }
   ```

**Priority:** Low to Medium  
**Effort:** High

---

### 2.4 Configuration Management

#### Issue: Scattered Configuration
**Location:** `src/config.ts`, various service files

**Current State:**
- Hard-coded values in multiple places
- Configuration validation only at startup
- No type-safe config access

**Recommended Refactoring:**

1. **Centralized Config with Validation**
   ```typescript
   // src/config/schema.ts
   
   import { z } from 'zod';
   
   const configSchema = z.object({
     discord: z.object({
       token: z.string().min(50, 'Invalid Discord token'),
       clientId: z.string().regex(/^\d+$/, 'Client ID must be numeric'),
       guildId: z.string().regex(/^\d+$/).optional(),
     }),
     redis: z.object({
       url: z.string().url().optional(),
       password: z.string().optional(),
       db: z.number().int().min(0).max(15).default(0),
     }),
     rateLimit: z.object({
       commandsPerMinute: z.number().int().positive().default(10),
       commandsPerHour: z.number().int().positive().default(100),
     }),
     image: z.object({
       maxSizeMB: z.number().int().positive().default(8),
       cacheTTL: z.number().int().positive().default(3600),
       maxDimensions: z.number().int().positive().default(4096),
     }),
     security: z.object({
       imageProcessingTimeout: z.number().int().positive().default(10000),
       maxConcurrentImageProcessing: z.number().int().positive().default(3),
     }),
   });
   
   export type BotConfig = z.infer<typeof configSchema>;
   
   export function validateConfig(raw: unknown): BotConfig {
     return configSchema.parse(raw);
   }
   ```

2. **Type-safe Config Access**
   ```typescript
   // src/config/index.ts
   
   import { validateConfig } from './schema.js';
   import { loadEnv } from 'dotenv';
   
   loadEnv();
   
   const rawConfig = {
     discord: {
       token: process.env.DISCORD_TOKEN,
       clientId: process.env.DISCORD_CLIENT_ID,
       guildId: process.env.DISCORD_GUILD_ID,
     },
     redis: {
       url: process.env.REDIS_URL,
       password: process.env.REDIS_PASSWORD,
       db: parseInt(process.env.REDIS_DB || '0', 10),
     },
     // ... etc
   };
   
   // Validates and provides type-safe config
   export const config = validateConfig(rawConfig);
   ```

**Priority:** Medium  
**Effort:** Low to Medium

---

## 3. Testing Improvements

### 3.1 Test Coverage Gaps

**Current Coverage Analysis:**
- xivdyetools-core: Good coverage for ColorService, DyeService
- xivdyetools-discord-bot: Some command tests, missing service tests

**Recommended Additions:**

1. **Integration Tests**
   ```typescript
   // xivdyetools-core/src/__tests__/integration/harmony-workflows.test.ts
   
   describe('Harmony Workflow Integration', () => {
     test('complete harmony generation pipeline', () => {
       const baseDye = dyeService.getDyeById(1);
       const harmony = dyeService.findTriadicDyes(baseDye.hex);
       
       expect(harmony).toHaveLength(3);
       
       // Verify harmonies form valid triadic relationship
       const hues = harmony.map(d => ColorService.hexToHsv(d.hex).h);
       const hueDiffs = [
         Math.abs(hues[1] - hues[0]),
         Math.abs(hues[2] - hues[1]),
         Math.abs(hues[0] - hues[2]),
       ];
       
       // Should be approximately 120° apart
       hueDiffs.forEach(diff => {
         expect(diff).toBeCloseTo(120, 0); // ±0.5 degrees
       });
     });
   });
   ```

2. **Performance Benchmarks**
   ```typescript
   // xivdyetools-core/benchmarks/search-performance.bench.ts
   
   import { bench, describe } from 'vitest';
   
   describe('Dye Search Performance', () => {
     bench('findClosestDye - cold', () => {
       dyeService.findClosestDye('#FF5733');
     });
     
     bench('findClosestDye - warm (should hit cache)', () => {
       dyeService.findClosestDye('#FF5733');
     });
     
     bench('findTriadicDyes', () => {
       dyeService.findTriadicDyes('#FF5733');
     });
   });
   ```

3. **Bot Integration Tests**
   ```typescript
   // xivdyetools-discord-bot/src/__tests__/integration/command-flow.test.ts
   
   describe('Command Flow Integration', () => {
     test('/match command end-to-end', async () => {
       const interaction = createMockInteraction('match', {
         color: '#FF5733',
       });
       
       await matchCommand.execute(interaction);
       
       expect(interaction.reply).toHaveBeenCalledWith(
         expect.objectContaining({
           embeds: expect.arrayContaining([
             expect.objectContaining({
               data: expect.objectContaining({
                 title: expect.stringContaining('Closest Match'),
               }),
             }),
           ]),
         })
       );
     });
   });
   ```

**Priority:** Medium  
**Effort:** Medium

---

### 3.2 Test Utilities

**Create Shared Test Helpers:**

```typescript
// xivdyetools-core/src/__tests__/helpers.ts

export const TestData = {
  sampleDyes: [
    { id: 1, name: 'Dalamud Red', hex: '#E42313', category: 'Red', /* ... */ },
    { id: 2, name: 'Soot Black', hex: '#000000', category: 'Black', /* ... */ },
    // ... more test dyes
  ],
  
  sampleColors: {
    red: '#FF0000' as HexColor,
    green: '#00FF00' as HexColor,
    blue: '#0000FF' as HexColor,
    white: '#FFFFFF' as HexColor,
    black: '#000000' as HexColor,
  },
};

export function expectHexColor(value: string): void {
  expect(value).toMatch(/^#[0-9A-F]{6}$/);
}

export function expectValidRGB(rgb: RGB): void {
  expect(rgb.r).toBeGreaterThanOrEqual(0);
  expect(rgb.r).toBeLessThanOrEqual(255);
  expect(rgb.g).toBeGreaterThanOrEqual(0);
  expect(rgb.g).toBeLessThanOrEqual(255);
  expect(rgb.b).toBeGreaterThanOrEqual(0);
  expect(rgb.b).toBeLessThanOrEqual(255);
}

// xivdyetools-discord-bot/src/__tests__/helpers.ts

export function createMockInteraction(
  commandName: string,
  options: Record<string, any>
): ChatInputCommandInteraction {
  return {
    commandName,
    options: {
      getString: (name: string, required?: boolean) => options[name] ?? (required ? '' : null),
      getInteger: (name: string, required?: boolean) => options[name] ?? (required ? 0 : null),
      getBoolean: (name: string, required?: boolean) => options[name] ?? (required ? false : null),
    },
    reply: vi.fn(),
    followUp: vi.fn(),
    deferReply: vi.fn(),
    user: { id: 'test-user-123' },
    guildId: 'test-guild-123',
    // ... other required properties
  } as any; // Cast to avoid full mock implementation
}
```

**Priority:** Low  
**Effort:** Low

---

## 4. Documentation Improvements

### 4.1 API Documentation

**Current State:**
- JSDoc comments present but inconsistent
- No generated API documentation
- Missing usage examples

**Recommended Improvements:**

1. **Enhance JSDoc Comments**
   ```typescript
   /**
    * Find the closest dye to a target color using Euclidean distance in RGB space.
    *
    * @param hex - Target color in #RRGGBB format
    * @param excludeIds - Optional array of dye IDs to exclude from search
    * @returns The closest matching dye, or null if database is empty
    *
    * @example
    * ```typescript
    * const dye = dyeService.findClosestDye('#FF5733');
    * if (dye) {
    *   console.log(`Closest dye: ${dye.name} (${dye.hex})`);
    * }
    * ```
    *
    * @throws {DatabaseNotLoadedError} If the dye database hasn't been initialized
    *
    * @see {@link findDyesWithinDistance} for finding multiple close matches
    */
   findClosestDye(hex: HexColor, excludeIds?: DyeId[]): Dye | null {
     // ...
   }
   ```

2. **Generate API Docs with TypeDoc**
   ```json
   // package.json additions
   {
     "scripts": {
       "docs": "typedoc --out docs/api src/index.ts"
     },
     "devDependencies": {
       "typedoc": "^0.25.0"
     }
   }
   ```

**Priority:** Low  
**Effort:** Low to Medium

---

### 4.2 Architecture Documentation

**Create:**
- `docs/ARCHITECTURE.md` - System overview, component diagram
- `docs/DEVELOPMENT.md` - Setup, workflows, contribution guide
- `docs/DEPLOYMENT.md` - Production deployment guide

**Priority:** Medium  
**Effort:** Medium

---

## 5. Build & Development Tooling

### 5.1 Monorepo Consideration

**Current State:**
- Separate repositories for core and bot
- Duplicate dev dependencies
- Manual version coordination

**Recommendation: Stay Separate (but improve linking)**

**Reasons:**
- Different deployment cadences
- Core is published to npm, bot is deployed to Fly.io
- Smaller repo size for contributors

**Improvements Without Monorepo:**

1. **Use npm link for Local Development**
   ```bash
   # In xivdyetools-core
   npm link
   
   # In xivdyetools-discord-bot
   npm link xivdyetools-core
   ```

2. **Automated Version Updates**
   ```yaml
   # .github/workflows/update-core-version.yml (in discord-bot repo)
   name: Update Core Version
   
   on:
     repository_dispatch:
       types: [core-published]
   
   jobs:
     update:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Update xivdyetools-core version
           run: |
             npm update xivdyetools-core
             git add package*.json
             git commit -m "chore: update xivdyetools-core to latest"
             git push
   ```

**Priority:** Low  
**Effort:** Low

---

### 5.2 Linting & Formatting

**Current State:**
- TypeScript compilation serves as linting
- No code formatting enforcement

**Recommended Additions:**

1. **ESLint Configuration**
   ```json
   // .eslintrc.json
   {
     "extends": [
       "eslint:recommended",
       "plugin:@typescript-eslint/recommended",
       "plugin:@typescript-eslint/recommended-requiring-type-checking"
     ],
     "parser": "@typescript-eslint/parser",
     "parserOptions": {
       "project": "./tsconfig.json"
     },
     "rules": {
       "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
       "@typescript-eslint/explicit-function-return-type": "warn",
       "@typescript-eslint/no-floating-promises": "error",
       "@typescript-eslint/await-thenable": "error"
     }
   }
   ```

2. **Prettier for Formatting**
   ```json
   // .prettierrc
   {
     "semi": true,
     "singleQuote": true,
     "trailingComma": "es5",
     "tabWidth": 2,
     "printWidth": 100
   }
   ```

3. **Pre-commit Hooks**
   ```json
   // package.json
   {
     "scripts": {
       "lint": "eslint src --ext .ts",
       "lint:fix": "eslint src --ext .ts --fix",
       "format": "prettier --write \"src/**/*.ts\"",
       "prepare": "husky install"
     },
     "devDependencies": {
       "eslint": "^8.50.0",
       "prettier": "^3.0.3",
       "husky": "^8.0.3",
       "lint-staged": "^14.0.1"
     },
     "lint-staged": {
       "*.ts": ["eslint --fix", "prettier --write"]
     }
   }
   ```

**Priority:** Medium  
**Effort:** Low

---

## 6. Implementation Priority Matrix

| Category | Task | Priority | Effort | Impact |
|----------|------|----------|--------|--------|
| **Type Safety** | Branded types | Medium | Medium | Medium |
| **Type Safety** | Strict generics | Medium | Medium | Medium |
| **Services** | Split ColorService | Low | High | Low |
| **Services** | Split DyeService | Low | High | Low |
| **Error Handling** | Custom errors | Medium | Medium | High |
| **Error Handling** | Result types | Medium | Medium | Medium |
| **Commands** | Base command class | Medium | Medium | High |
| **Commands** | Service extraction | Medium | Medium | High |
| **Renderers** | Interface-based | Low | High | Low |
| **Config** | Zod validation | Medium | Low | Medium |
| **Testing** | Integration tests | Medium | Medium | High |
| **Testing** | Test utilities | Low | Low | Medium |
| **Documentation** | JSDoc enhancement | Low | Low | Low |
| **Documentation** | TypeDoc generation | Low | Low | Low |
| **Tooling** | ESLint + Prettier | Medium | Low | Medium |
| **Tooling** | Pre-commit hooks | Medium | Low | High |

---

## 7. Refactoring Roadmap

### Phase 1: Foundation (1-2 weeks)
- [ ] Add ESLint and Prettier
- [ ] Set up pre-commit hooks
- [ ] Create custom error types
- [ ] Implement Zod config validation
- [ ] Create test utilities

### Phase 2: Type Safety (1-2 weeks)
- [ ] Implement branded types for HexColor, DyeId, etc.
- [ ] Add strict generic constraints
- [ ] Update function signatures
- [ ] Fix any TypeScript errors from stricte typing

### Phase 3: Command Standardization (2-3 weeks)
- [ ] Create CommandBase class
- [ ] Refactor all commands to use base
- [ ] Extract service layer (formatting, calculation)
- [ ] Add integration tests for commands

### Phase 4: Service Refactoring (3-4 weeks)
- [ ] Split ColorService (if needed)
- [ ] Split DyeService (if needed)
- [ ] Update tests
- [ ] Update documentation

### Phase 5: Testing & Documentation (1-2 weeks)
- [ ] Add integration tests
- [ ] Add performance benchmarks
- [ ] Generate API documentation
- [ ] Write architecture docs

---

##8. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| TypeScript strict mode | Disabled | Enabled | tsconfig.json |
| Test coverage (core) | ~70% | >85% | Vitest coverage report |
| Test coverage (bot) | ~40% | >70% | Vitest coverage report |
| ESLint errors | N/A | 0 | CI pipeline |
| Inconsistent error handling | High | Low | Code review |
| Duplicate code | Medium | Low | SonarQube / manual review |
| API documentation | Minimal | Complete | TypeDoc output |

---

## 9. Breaking Changes Policy

**For xivdyetools-core:**
- Follow semantic versioning strictly
- Major version bump for breaking changes
- Deprecation warnings for 1 minor version before removal
- Changelog must document all breaking changes

**For xivdyetools-discord-bot:**
- Can make breaking changes more freely (internal deployment)
- Document in CHANGELOG.md
- Test thoroughly before deployment

---

## 10. Code Review Checklist

**For Future Refactoring PRs:**

- [ ] Code follows established patterns (or intentionally diverges with justification)
- [ ] Types are strict (no `any` without comment explanation)
- [ ] Error handling is consistent
- [ ] Tests added/updated for changes
- [ ] Documentation updated (JSDoc, README, etc.)
- [ ] No new ESLint warnings
- [ ] Performance impact considered (add benchmark if significant)
- [ ] Backward compatibility maintained (or breaking change documented)

---

## Appendix A: Refactoring Examples

*See separate files for before/after examples of major refactorings*

---

## Appendix B: Design Patterns Reference

**Patterns Used:**
- **Facade Pattern:** ColorService, DyeService maintain backward compatibility
- **Strategy Pattern:** Different harmony algorithms
- **Factory Pattern:** Renderer creation
- **Singleton Pattern:** Rate limiter, analytics
- **Template Method:** CommandBase error handling

**Patterns to Consider:**
- **Repository Pattern:** Encapsulate dye database access
- **Builder Pattern:** Complex embed construction
- **Observer Pattern:** Event-driven architecture (if needed)

---

**Document Owner:** XIV Dye Tools Team  
**Last Updated:** November 23, 2025  
**Next Review:** January 1, 2026
