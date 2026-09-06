# Dye Collections & Favorites - Specification

> Feature Status: ✅ Implemented — web app only
> Platforms: Web App. The Discord side (`/favorites`, `/collection`) was **removed in 5.0**.
> Core Library Changes: None (app-level persistence)

## Overview

Allow users to save favorite dyes and organize them into named collections for quick access across all tools.

### User Value

- **Quick access** - Star frequently used dyes for instant selection
- **Organization** - Group dyes by theme, project, or purpose
- **Persistence** - Collections saved across sessions
- **Portability** - Export/import collections between devices or share with others

---

## Feature Breakdown

### 1. Favorites (Quick Access)

Simple starred dyes that appear prominently in dye selectors.

**Characteristics:**
- Single flat list (no organization)
- Maximum 40 favorites (prevent clutter)
- Displayed at top of dye selector
- One-click add/remove

### 2. Collections (Organized Groups)

Named groups of dyes for specific purposes. In 5.0 these are typed records written by the tools' own
Save actions (**Save mix**, **Save swap**, **Save character colours**, **Make a palette**) rather
than folders the user files dyes into by hand.

**Characteristics:**
- User-defined names
- Optional description
- Typed `kind`: `palette`, `swap` (budget substitutes, carries the `target` dye) or `character`
- Maximum 50 collections per user
- Maximum 20 dyes per collection
- Deleting a record leaves a tombstone so an import can never resurrect it

---

## Data Structures

### Web App (LocalStorage + IndexedDB)

```typescript
interface FavoritesData {
  version: string;
  favorites: DyeId[];           // Ordered list of favorite dye IDs
  lastModified: string;         // ISO timestamp
}

type CollectionKind = 'palette' | 'swap' | 'character';

interface Collection {
  id: string;                   // UUID
  name: string;                 // User-defined name
  description?: string;         // Optional description
  kind: CollectionKind;         // 4.x records without one read as 'palette'
  target?: DyeId;               // swap records only: the dye these substitutes replace
  dyes: DyeId[];               // Ordered list of dye IDs (5.0: stainIDs)
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
}

interface Tombstone {
  id: string;                   // The deleted record's id
  deletedAt: string;            // ISO timestamp
}

interface CollectionsData {
  version: string;
  collections: Collection[];
  tombstones?: Tombstone[];     // import/merge must never resurrect a deleted record
  lastModified: string;
}

// Storage keys
const FAVORITES_KEY = 'xivdyetools_favorites';
const COLLECTIONS_KEY = 'xivdyetools_collections';
```

### Discord Bot — removed in 5.0

There is no bot-side favorites or collections store. The v4 `/favorites` and `/collection` commands
were deleted with the 5.0 command roster and are not in the registry. Saved dyes and palettes live
only in the web app; every bot card carries a share link that opens the same result there, where the
dye can be starred or the palette saved.

Only community *presets* can be favourited from Discord, via `/preset favorite`, which is a
different feature with its own store.

### Export Format (JSON)

```json
{
  "version": "2.0.0",
  "exportedAt": "2024-12-04T12:00:00Z",
  "type": "xivdyetools-collection",
  "data": {
    "favorites": [40, 39, 12, 1],
    "collections": [
      {
        "id": "abc123",
        "name": "My Red Mage Glamour",
        "description": "Colors for my RDM artifact gear",
        "dyes": [40, 39, 12],
        "createdAt": "2024-12-01T10:00:00Z",
        "updatedAt": "2024-12-03T15:30:00Z"
      }
    ]
  }
}
```

---

## Web App Implementation

### CollectionService

```typescript
// src/services/CollectionService.ts

export class CollectionService {
  private storage: StorageService;

  // Favorites
  getFavorites(): DyeId[];
  addFavorite(dyeId: DyeId): boolean;
  removeFavorite(dyeId: DyeId): boolean;
  isFavorite(dyeId: DyeId): boolean;
  clearFavorites(): void;

  // Collections
  getCollections(): Collection[];
  getCollection(id: string): Collection | undefined;
  createCollection(name: string, description?: string): Collection;
  updateCollection(id: string, updates: Partial<Collection>): boolean;
  deleteCollection(id: string): boolean;
  addDyeToCollection(collectionId: string, dyeId: DyeId): boolean;
  removeDyeFromCollection(collectionId: string, dyeId: DyeId): boolean;

  // Import/Export
  exportAll(): string;  // JSON string
  exportCollection(id: string): string;
  importData(json: string): ImportResult;
}

interface ImportResult {
  success: boolean;
  favoritesImported: number;
  collectionsImported: number;
  errors: string[];
}
```

### UI Components

#### 1. Favorite Star on Dye Cards

Add heart/star icon to every dye card across all tools.

```
┌─────────────────────────────┐
│ [★]              #AA1111    │
│ ┌─────────────────────────┐ │
│ │         ████████        │ │
│ │         ████████        │ │
│ └─────────────────────────┘ │
│ Dalamud Red                 │
│ Reds • Achievement          │
└─────────────────────────────┘
```

- ☆ = Not favorited (outline)
- ★ = Favorited (filled, gold color)
- Click to toggle
- Toast notification: "Added to favorites" / "Removed from favorites"

#### 2. Favorites Panel in Dye Selector

Collapsible section at top of dye selector showing favorites.

```
┌─────────────────────────────────────────────┐
│  🔍 Search dyes...                          │
├─────────────────────────────────────────────┤
│  ★ Favorites (5)                      [▼]   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │█████│ │█████│ │█████│ │█████│ │█████│  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
│  Dalamud Jet    Snow   Metallic Bark      │
│  Red    Black  White    Gold    Brown     │
├─────────────────────────────────────────────┤
│  📁 Collections                       [▼]   │
│  • My Red Mage Glamour (3 dyes)            │
│  • Casual Outfits (5 dyes)                 │
│  • [+ New Collection]                       │
├─────────────────────────────────────────────┤
│  All Dyes                                   │
│  ...                                        │
└─────────────────────────────────────────────┘
```

#### 3. Collection Manager Modal

Full-featured collection management interface.

```
┌─────────────────────────────────────────────────────┐
│  📁 My Collections                            [×]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ My Red Mage Glamour                    [⋮]   │  │
│  │ Colors for my RDM artifact gear              │  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐                      │  │
│  │ │█████│ │█████│ │█████│ [+ Add Dye]         │  │
│  │ └─────┘ └─────┘ └─────┘                      │  │
│  │ Created: Dec 1, 2024                         │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Casual Outfits                         [⋮]   │  │
│  │ Everyday glamour colors                      │  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │  │
│  │ │█████│ │█████│ │█████│ │█████│ │█████│     │  │
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     │  │
│  │ Created: Nov 28, 2024                        │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [+ Create New Collection]                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Import] [Export All]                              │
└─────────────────────────────────────────────────────┘
```

**Context Menu (⋮):**
- Rename
- Edit Description
- Export
- Delete

#### 4. Add to Collection Quick Action

When selecting a dye, option to add to collection.

```
┌─────────────────────────────┐
│ Dalamud Red selected        │
│                             │
│ [Use in Tool]               │
│ [★ Add to Favorites]        │
│ [📁 Add to Collection ▶]    │
│    ├─ My Red Mage Glamour   │
│    ├─ Casual Outfits        │
│    └─ + New Collection...   │
└─────────────────────────────┘
```

### File Changes

| File | Changes |
|------|---------|
| `collection-service.ts` | New service |
| `dye-card.ts` | Add favorite star |
| `dye-selector.ts` | Add favorites panel, collections dropdown |
| `collection-manager-modal.ts` | New component |
| `add-to-collection-menu.ts` | New component |

---

## Discord Bot Implementation — REMOVED IN 5.0

**None of this shipped in the form described below, and what did ship was deleted.** The v4 bot's
`/favorites` and `/collection` commands were removed with the 5.0 command roster: neither name
appears in the command registry, the schema literal or the dispatcher, and neither is registered
with Discord. There is no bot-side favorites or collections store of any kind.

Two things in the original draft were never true even while the commands existed:

- **Storage was never Redis.** The bot runs on Cloudflare Workers; per-user state lives in
  Cloudflare KV. (The only Redis in the project's history was a third-party rate-limit counter,
  itself since replaced by native Workers rate-limit bindings.)
- **There is no cross-platform sync.** The bot never read or wrote the web app's favorites, and the
  web app's records have always been local to one browser.

What replaced it: saved dyes and palettes live in the web app, and every bot card carries a share
link that reopens the same result there. Community *presets* — a different feature with its own
store — can still be favourited from Discord with `/preset favorite add|remove|list`.

---


## Validation Rules

### Favorites

| Rule | Limit |
|------|-------|
| Maximum favorites | 40 |
| Duplicate prevention | Yes |

### Collections

| Rule | Limit |
|------|-------|
| Maximum collections per user | 50 |
| Maximum dyes per collection | 20 |
| Collection name length | 1-50 characters |
| Description length | 0-200 characters |
| Allowed name characters | Alphanumeric, spaces, hyphens, underscores |
| Duplicate names | Not allowed |
| Duplicate dyes in collection | Not allowed |

### Import

| Rule | Behavior |
|------|----------|
| Invalid JSON | Reject with error |
| Wrong version | Attempt migration or reject |
| Invalid dye IDs | Skip with warning |
| Exceeds limits | Truncate with warning |
| Name conflicts | Rename with suffix (_imported_1) |

---

## Keyboard Shortcuts (Web App)

| Shortcut | Action |
|----------|--------|
| `F` | Toggle favorite on selected dye |
| `C` | Open add-to-collection menu |
| `Ctrl+Shift+C` | Open collection manager |

---

## Accessibility

### Screen Reader Support

```html
<!-- Favorite button -->
<button
  aria-label="Add Dalamud Red to favorites"
  aria-pressed="false"
>
  ☆
</button>

<!-- Favorited state -->
<button
  aria-label="Remove Dalamud Red from favorites"
  aria-pressed="true"
>
  ★
</button>
```

### Announcements

- "Dalamud Red added to favorites"
- "Dalamud Red removed from favorites"
- "Collection 'My Red Mage Glamour' created"
- "Dalamud Red added to 'My Red Mage Glamour'"

---

## Error Handling

### Web App

```typescript
// Toast notifications for errors
ToastService.error('Maximum 40 favorites allowed');
ToastService.error('Collection name already exists');
ToastService.error('Failed to import: Invalid format');
```

### Discord Bot

Not applicable — the bot has no favorites or collections commands (removed in 5.0).

---

## Migration Strategy

### Existing Saved Palettes (Web App)

The web app already has a `PaletteService` for saving harmony palettes. Collections should:

1. Coexist with existing palette saves (different purpose)
2. Offer migration: "Import palettes as collections?"
3. Not break existing functionality

### Future: Cross-Platform Sync

Consider optional cloud sync:
1. User creates account (optional)
2. Collections sync between web and Discord
3. Privacy-first: opt-in only

---

## Testing Strategy

### Unit Tests

```typescript
describe('CollectionService', () => {
  it('should add favorite', () => { ... });
  it('should not exceed 40 favorites', () => { ... });
  it('should not add duplicate favorites', () => { ... });
  it('should create collection', () => { ... });
  it('should not exceed 50 collections', () => { ... });
  it('should export valid JSON', () => { ... });
  it('should import valid JSON', () => { ... });
  it('should reject invalid import', () => { ... });
});
```

### Integration Tests

- Test localStorage persistence
- Test import/export round-trip
- Test tombstones surviving an import
- Test UI interactions

---

## Rollout Plan

### Phase 1: Web App Favorites
1. Implement `CollectionService` (favorites only)
2. Add favorite stars to dye cards
3. Add favorites panel to dye selector

### Phase 2: Web App Collections
4. Implement collections in `CollectionService`
5. Add collection manager modal
6. Add import/export functionality

### Phase 3: Discord Bot — CANCELLED
7. ~~Implement `/favorites` commands~~ — removed in 5.0
8. ~~Implement `/collection` commands~~ — removed in 5.0
9. ~~Add Redis storage~~ — never built; the bot runs on Cloudflare Workers and uses KV

### Phase 4: Polish
10. Cross-tool integration (use collection in Mixer, Harmony, etc.)
11. Keyboard shortcuts
12. Accessibility improvements

---

## Future Enhancements

### Sharing
- Public collection URLs
- Share via Discord embed
- Community collection gallery

### Smart Collections
- Auto-generated: "Recently Used"
- Auto-generated: "Most Used"
- Smart suggestions: "You might like..."

### Organization
- Collection folders/categories
- Tags on collections
- Search within collections
