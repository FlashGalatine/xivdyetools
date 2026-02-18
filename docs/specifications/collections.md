> **⚠️ DEPRECATED:** This document has been superseded by the Documentation Bible.
> See: [specifications/collections.md](specifications/collections.md)

# Dye Collections & Favorites - Specification

> Feature Status: Planned
> Platforms: Web App + Discord Bot
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
- Maximum 20 favorites (prevent clutter)
- Displayed at top of dye selector
- One-click add/remove

### 2. Collections (Organized Groups)

Named groups of dyes for specific purposes.

**Characteristics:**
- User-defined names
- Optional description
- Maximum 50 collections per user
- Maximum 20 dyes per collection
- Supports reordering

---

## Data Structures

### Web App (LocalStorage + IndexedDB)

```typescript
interface FavoritesData {
  version: string;
  favorites: DyeId[];           // Ordered list of favorite dye IDs
  lastModified: string;         // ISO timestamp
}

interface Collection {
  id: string;                   // UUID
  name: string;                 // User-defined name
  description?: string;         // Optional description
  dyes: DyeId[];               // Ordered list of dye IDs
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
}

interface CollectionsData {
  version: string;
  collections: Collection[];
  lastModified: string;
}

// Storage keys
const FAVORITES_KEY = 'xivdyetools_favorites';
const COLLECTIONS_KEY = 'xivdyetools_collections';
```

### Discord Bot (Redis)

```typescript
// Redis key patterns
`favorites:${userId}` → JSON string of DyeId[]
`collections:${userId}` → JSON string of Collection[]
`collection:${userId}:${collectionId}` → JSON string of Collection

// TTL: No expiration (permanent user data)
```

### Export Format (JSON)

```json
{
  "version": "1.0.0",
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
  reorderFavorites(dyeIds: DyeId[]): void;
  clearFavorites(): void;

  // Collections
  getCollections(): Collection[];
  getCollection(id: string): Collection | undefined;
  createCollection(name: string, description?: string): Collection;
  updateCollection(id: string, updates: Partial<Collection>): boolean;
  deleteCollection(id: string): boolean;
  addDyeToCollection(collectionId: string, dyeId: DyeId): boolean;
  removeDyeFromCollection(collectionId: string, dyeId: DyeId): boolean;
  reorderCollectionDyes(collectionId: string, dyeIds: DyeId[]): void;

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

## Discord Bot Implementation

### Commands

#### `/favorites`

Manage favorite dyes.

**Subcommands:**

```
/favorites add <dye>
  Add a dye to your favorites

/favorites remove <dye>
  Remove a dye from your favorites

/favorites list
  Show all your favorite dyes

/favorites clear
  Clear all favorites (with confirmation)
```

**Example Output - `/favorites list`:**

```
⭐ Your Favorite Dyes (5)

1. Dalamud Red (#AA1111)
2. Jet Black (#0A0A0A)
3. Snow White (#F5F5F5)
4. Metallic Gold (#CBA135)
5. Bark Brown (#5C3A1E)

[Attached: favorites_grid.png]
```

#### `/collection`

Manage dye collections.

**Subcommands:**

```
/collection create <name> [description]
  Create a new collection

/collection delete <name>
  Delete a collection (with confirmation)

/collection add <collection> <dye>
  Add a dye to a collection

/collection remove <collection> <dye>
  Remove a dye from a collection

/collection show <name>
  Display a collection's dyes

/collection list
  List all your collections

/collection rename <old_name> <new_name>
  Rename a collection
```

**Example Output - `/collection show`:**

```
📁 My Red Mage Glamour

Colors for my RDM artifact gear

Dyes (3):
1. Dalamud Red (#AA1111)
2. Jet Black (#0A0A0A)
3. Metallic Gold (#CBA135)

Created: Dec 1, 2024
Updated: Dec 3, 2024

[Attached: collection_rdm.png]
```

**Example Output - `/collection list`:**

```
📁 Your Collections (3)

1. My Red Mage Glamour (3 dyes)
   Colors for my RDM artifact gear

2. Casual Outfits (5 dyes)
   Everyday glamour colors

3. Dark Knight Vibes (4 dyes)
   Edgy and dramatic

Use `/collection show <name>` to view details
```

### Redis Storage

```typescript
// src/services/collection-storage.ts

export class CollectionStorage {
  private redis: Redis;

  // Favorites
  async getFavorites(userId: string): Promise<DyeId[]>;
  async setFavorites(userId: string, favorites: DyeId[]): Promise<void>;

  // Collections
  async getCollections(userId: string): Promise<Collection[]>;
  async getCollection(userId: string, name: string): Promise<Collection | null>;
  async saveCollection(userId: string, collection: Collection): Promise<void>;
  async deleteCollection(userId: string, name: string): Promise<boolean>;

  // Limits
  async canAddFavorite(userId: string): Promise<boolean>;  // Max 20
  async canCreateCollection(userId: string): Promise<boolean>;  // Max 50
}
```

### File Changes

| File | Changes |
|------|---------|
| `favorites.ts` | New command file |
| `collection.ts` | New command file |
| `collection-storage.ts` | New service |
| `collection-grid.ts` | New renderer |

---

## Validation Rules

### Favorites

| Rule | Limit |
|------|-------|
| Maximum favorites | 20 |
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
ToastService.error('Maximum 20 favorites allowed');
ToastService.error('Collection name already exists');
ToastService.error('Failed to import: Invalid format');
```

### Discord Bot

```typescript
// Embed error responses
{
  color: 0xFF0000,
  title: '❌ Error',
  description: 'You already have 20 favorites. Remove some to add more.',
}
```

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
  it('should not exceed 20 favorites', () => { ... });
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
- Test Redis persistence
- Test import/export round-trip
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

### Phase 3: Discord Bot
7. Implement `/favorites` commands
8. Implement `/collection` commands
9. Add Redis storage

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
