# XIV Dye Tools v4.0 Route Migration Guide

This document details all routing changes for the v4.0 release, including URL paths, tool IDs, display names, and implementation steps.

---

## 1. Route Change Summary

### Complete Route Mapping

| # | v3 Route | v4 Route | v3 Tool Name | v4 Tool Name | Change Type |
|---|----------|----------|--------------|--------------|-------------|
| 1 | `/harmony` | `/harmony` | Color Harmony Explorer | Harmony Explorer | Name only |
| 2 | `/matcher` | `/extractor` | Color Matcher | Palette Extractor | Route + Name |
| 3 | `/accessibility` | `/accessibility` | Accessibility Checker | Accessibility Checker | None |
| 4 | `/comparison` | `/comparison` | Dye Comparison | Dye Comparison | None |
| 5 | `/mixer` | `/gradient` | Dye Mixer | Gradient Builder | Route + Name |
| 6 | — | `/mixer` | — | Dye Mixer | **NEW TOOL** |
| 7 | `/presets` | `/presets` | Preset Palettes | Community Presets | Name only |
| 8 | `/budget` | `/budget` | Budget Suggestions | Budget Suggestions | None |
| 9 | `/character` | `/swatch` | Character Matcher | Swatch Matcher | Route + Name |

### Breaking Changes

The following v3 URLs will **no longer work** in v4:

| v3 URL | Behavior in v4 | User Action |
|--------|----------------|-------------|
| `/matcher` | 404 / Falls to default | Navigate to `/extractor` |
| `/mixer` | Loads **new** Dye Mixer | Navigate to `/gradient` for old functionality |
| `/character` | 404 / Falls to default | Navigate to `/swatch` |

---

## 2. ToolId Type Definition

### v3 ToolId (Current)

```typescript
// src/services/router-service.ts (v3)
export type ToolId =
  | 'harmony'
  | 'matcher'
  | 'accessibility'
  | 'comparison'
  | 'mixer'
  | 'presets'
  | 'budget'
  | 'character';
```

### v4 ToolId (Target)

```typescript
// src/services/router-service.ts (v4)
export type ToolId =
  | 'harmony'
  | 'extractor'      // was 'matcher'
  | 'accessibility'
  | 'comparison'
  | 'gradient'       // was 'mixer'
  | 'mixer'          // NEW (crafting-style)
  | 'presets'
  | 'budget'
  | 'swatch';        // was 'character'
```

---

## 3. Route Definitions

### v4 ROUTES Array

```typescript
// src/services/router-service.ts (v4)
export interface RouteDefinition {
  id: ToolId;
  path: string;
  title: string;
  icon: string;
  description: string;
}

export const ROUTES: RouteDefinition[] = [
  {
    id: 'harmony',
    path: '/harmony',
    title: 'Harmony Explorer',
    icon: ICON_TOOL_HARMONY,
    description: 'Explore color harmonies and find complementary dyes'
  },
  {
    id: 'extractor',
    path: '/extractor',
    title: 'Palette Extractor',
    icon: ICON_TOOL_EXTRACTOR,  // renamed from MATCHER
    description: 'Extract color palettes from images and find matching dyes'
  },
  {
    id: 'accessibility',
    path: '/accessibility',
    title: 'Accessibility Checker',
    icon: ICON_TOOL_ACCESSIBILITY,
    description: 'Simulate colorblindness and check WCAG contrast'
  },
  {
    id: 'comparison',
    path: '/comparison',
    title: 'Dye Comparison',
    icon: ICON_TOOL_COMPARISON,
    description: 'Compare multiple dyes side by side'
  },
  {
    id: 'gradient',
    path: '/gradient',
    title: 'Gradient Builder',
    icon: ICON_TOOL_GRADIENT,  // renamed from MIXER
    description: 'Create smooth color transitions between dyes'
  },
  {
    id: 'mixer',
    path: '/mixer',
    title: 'Dye Mixer',
    icon: ICON_TOOL_DYE_MIXER,  // NEW icon
    description: 'Mix two dyes to find blended color matches'
  },
  {
    id: 'presets',
    path: '/presets',
    title: 'Community Presets',
    icon: ICON_TOOL_PRESETS,
    description: 'Browse and share community dye palettes'
  },
  {
    id: 'budget',
    path: '/budget',
    title: 'Budget Suggestions',
    icon: ICON_TOOL_BUDGET,
    description: 'Find affordable alternatives to expensive dyes'
  },
  {
    id: 'swatch',
    path: '/swatch',
    title: 'Swatch Matcher',
    icon: ICON_TOOL_SWATCH,  // renamed from CHARACTER
    description: 'Match dyes to character customization colors'
  }
];
```

---

## 4. Tool Banner Order

The Tool Banner displays all 9 tools in this order (left to right):

| Position | ToolId | Label | Icon |
|----------|--------|-------|------|
| 1 | `harmony` | Harmony | Color wheel |
| 2 | `extractor` | Extractor | Image/palette |
| 3 | `accessibility` | Accessibility | Eye |
| 4 | `comparison` | Compare | Overlapping squares |
| 5 | `gradient` | Gradient | Gradient bar |
| 6 | `mixer` | Mixer | Mixing beakers (NEW) |
| 7 | `presets` | Presets | Grid/cards |
| 8 | `budget` | Budget | Coin/price tag |
| 9 | `swatch` | Swatch | Color swatches |

---

## 5. File Rename Mapping

### Component Files

| v3 File | v4 File |
|---------|---------|
| `src/components/matcher-tool.ts` | `src/components/extractor-tool.ts` |
| `src/components/mixer-tool.ts` | `src/components/gradient-tool.ts` |
| `src/components/character-tool.ts` | `src/components/swatch-tool.ts` |
| — | `src/components/dye-mixer-tool.ts` (NEW) |

### Class Name Changes

| v3 Class | v4 Class |
|----------|----------|
| `MatcherTool` | `ExtractorTool` |
| `MixerTool` | `GradientTool` |
| `CharacterTool` | `SwatchTool` |
| — | `DyeMixerTool` (NEW) |

### Test Files

| v3 File | v4 File |
|---------|---------|
| `src/__tests__/matcher-tool.test.ts` | `src/__tests__/extractor-tool.test.ts` |
| `src/__tests__/mixer-tool.test.ts` | `src/__tests__/gradient-tool.test.ts` |
| `src/__tests__/character-tool.test.ts` | `src/__tests__/swatch-tool.test.ts` |
| — | `src/__tests__/dye-mixer-tool.test.ts` (NEW) |

---

## 6. Lazy Loading Updates

### v3 Dynamic Imports

```typescript
// src/components/v3-layout.ts (current)
const toolLoaders: Record<ToolId, () => Promise<unknown>> = {
  harmony: () => import('./harmony-tool'),
  matcher: () => import('./matcher-tool'),
  accessibility: () => import('./accessibility-tool'),
  comparison: () => import('./comparison-tool'),
  mixer: () => import('./mixer-tool'),
  presets: () => import('./preset-tool'),
  budget: () => import('./budget-tool'),
  character: () => import('./character-tool'),
};
```

### v4 Dynamic Imports

```typescript
// src/components/v4-layout.ts (target)
const toolLoaders: Record<ToolId, () => Promise<unknown>> = {
  harmony: () => import('./harmony-tool'),
  extractor: () => import('./extractor-tool'),      // renamed
  accessibility: () => import('./accessibility-tool'),
  comparison: () => import('./comparison-tool'),
  gradient: () => import('./gradient-tool'),        // renamed
  mixer: () => import('./dye-mixer-tool'),          // NEW file
  presets: () => import('./preset-tool'),
  budget: () => import('./budget-tool'),
  swatch: () => import('./swatch-tool'),            // renamed
};
```

---

## 7. i18n Key Updates

### Localization Keys to Update

In all locale files (`src/locales/*.json`):

```json
{
  "tools": {
    "harmony": {
      "name": "Harmony Explorer",
      "description": "Explore color harmonies..."
    },
    "extractor": {
      "name": "Palette Extractor",
      "description": "Extract color palettes from images..."
    },
    "gradient": {
      "name": "Gradient Builder",
      "description": "Create smooth color transitions..."
    },
    "mixer": {
      "name": "Dye Mixer",
      "description": "Mix two dyes to find blended colors..."
    },
    "swatch": {
      "name": "Swatch Matcher",
      "description": "Match dyes to character colors..."
    },
    "presets": {
      "name": "Community Presets",
      "description": "Browse and share community palettes..."
    }
  }
}
```

### Keys to Remove

```json
{
  "tools": {
    "matcher": { ... },    // Remove, replaced by 'extractor'
    "character": { ... }   // Remove, replaced by 'swatch'
  }
}
```

---

## 8. Storage Key Migration

### Keys Affected by Route Changes

| v3 Key | v4 Key |
|--------|--------|
| `xivdyetools_matcher_*` | `xivdyetools_extractor_*` |
| `xivdyetools_mixer_*` | `xivdyetools_gradient_*` |
| `xivdyetools_character_*` | `xivdyetools_swatch_*` |

### Migration Function

```typescript
// src/services/storage-service.ts
export function migrateV3ToV4Keys(): void {
  const migrations: Record<string, string> = {
    'matcher': 'extractor',
    'mixer': 'gradient',
    'character': 'swatch',
  };

  const prefix = 'xivdyetools_';

  for (const [oldKey, newKey] of Object.entries(migrations)) {
    // Find all keys starting with old prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${prefix}${oldKey}_`)) {
        const value = localStorage.getItem(key);
        const newStorageKey = key.replace(`${prefix}${oldKey}_`, `${prefix}${newKey}_`);
        if (value !== null) {
          localStorage.setItem(newStorageKey, value);
          localStorage.removeItem(key);
        }
      }
    }
  }

  // Mark migration as complete
  localStorage.setItem(`${prefix}v4_migration_complete`, 'true');
}
```

---

## 9. Default Route Handling

### Default Tool

The default tool when visiting `/` or an unknown route:

```typescript
export const DEFAULT_TOOL_ID: ToolId = 'harmony';
```

### Unknown Route Fallback

```typescript
// src/services/router-service.ts
public navigateTo(path: string): void {
  const route = ROUTES.find(r => r.path === path);

  if (!route) {
    // Unknown route - navigate to default
    console.warn(`Unknown route: ${path}, redirecting to default`);
    this.navigateTo(`/${DEFAULT_TOOL_ID}`);
    return;
  }

  // ... proceed with navigation
}
```

---

## 10. Query Parameter Handling

### Design Decision: Item IDs Over Names

**Important:** All dye references in URLs use **item IDs** instead of localized names.

**Rationale:**
- **Locale-agnostic** - Links work regardless of UI language
- **No URL encoding** - IDs are simple integers (no `%20` for spaces)
- **Stable** - IDs don't change, names might be corrected
- **Shareable** - Japanese user can share link with English user

**Common Dye IDs:**
| Dye Name | Item ID |
|----------|---------|
| Jet Black | `13115` |
| Pure White | `13116` |
| Wine Red | `5740` |
| Dalamud Red | `5739` |
| Metallic Silver | `8847` |

### Preserved Query Parameters

These parameters should persist across tool navigation:

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `dc` | Data center selection | `?dc=Crystal` |
| `dye` | Pre-selected dye (item ID) | `?dye=13115` |
| `ui` | UI state flags | `?ui=compact` |

### Tool-Specific Parameters

| Tool | Parameter | Example | Notes |
|------|-----------|---------|-------|
| `harmony` | `dye`, `type` | `?dye=13115&type=triadic` | Dye ID + harmony type |
| `extractor` | `url` | `?url=https://...` | Image URL to extract |
| `gradient` | `start`, `end`, `steps` | `?start=5740&end=13115&steps=5` | Start/end dye IDs |
| `mixer` | `slot1`, `slot2` | `?slot1=13115&slot2=13116` | Dye IDs for mixing slots |
| `comparison` | `dyes` | `?dyes=13115,5740,5739` | Comma-separated dye IDs |
| `budget` | `dye`, `maxPrice` | `?dye=13115&maxPrice=50000` | Target dye ID + budget |
| `swatch` | `sheet`, `race`, `gender` | `?sheet=eyes&race=hyur&gender=female` | Character customization |
| `presets` | `id` | `?id=abc123` | Preset ID to open |

---

## 11. Implementation Steps

### Step 1: Update ToolId Type
- [ ] Edit `src/services/router-service.ts`
- [ ] Change type definition
- [ ] Fix all TypeScript errors that surface

### Step 2: Update ROUTES Array
- [ ] Update path strings
- [ ] Update title strings
- [ ] Update description strings
- [ ] Add new 'mixer' route

### Step 3: Rename Tool Files
- [ ] `git mv matcher-tool.ts extractor-tool.ts`
- [ ] `git mv mixer-tool.ts gradient-tool.ts`
- [ ] `git mv character-tool.ts swatch-tool.ts`
- [ ] Create `dye-mixer-tool.ts`

### Step 4: Update Class Names
- [ ] Find/replace `MatcherTool` → `ExtractorTool`
- [ ] Find/replace `MixerTool` → `GradientTool`
- [ ] Find/replace `CharacterTool` → `SwatchTool`

### Step 5: Update Lazy Loading
- [ ] Edit `v4-layout.ts` import map
- [ ] Verify chunk names in build output

### Step 6: Update i18n
- [ ] Edit all 6 locale files
- [ ] Add new keys, remove old keys

### Step 7: Add Storage Migration
- [ ] Add migration function to `storage-service.ts`
- [ ] Call on app startup (once)

### Step 8: Update Tests
- [ ] Rename test files
- [ ] Update route assertions
- [ ] Add tests for new Dye Mixer

---

## 12. Verification Checklist

### Route Navigation
- [ ] `/harmony` loads Harmony Explorer
- [ ] `/extractor` loads Palette Extractor
- [ ] `/accessibility` loads Accessibility Checker
- [ ] `/comparison` loads Dye Comparison
- [ ] `/gradient` loads Gradient Builder
- [ ] `/mixer` loads Dye Mixer (NEW)
- [ ] `/presets` loads Community Presets
- [ ] `/budget` loads Budget Suggestions
- [ ] `/swatch` loads Swatch Matcher

### Browser Behavior
- [ ] Direct URL access works for all routes
- [ ] Browser back button navigates correctly
- [ ] Browser forward button navigates correctly
- [ ] Page refresh preserves current route
- [ ] Query parameters preserved on navigation

### Default/Fallback
- [ ] `/` redirects to `/harmony`
- [ ] Unknown routes redirect to `/harmony`
- [ ] No console errors on redirect

### Tool Banner
- [ ] All 9 tools visible
- [ ] Correct tool highlighted as active
- [ ] Click navigates to correct route
- [ ] Keyboard navigation works (Tab + Enter)
