# Loading & Feedback States Improvements

> **Focus**: Communicate system status clearly to users
> **Principle**: Users should never wonder "is it working?" or "did it fail?"

---

## Current State

The app currently:
- Makes async API calls to Universalis for market prices without visible loading indicators
- Has no consistent toast/notification system for success/error feedback
- Lacks skeleton loading states for content areas
- Has basic inline error messages but no global error handling UI
- Missing empty state designs for zero-result scenarios

---

## F1: Loading Spinners for Universalis API Calls

**Priority**: P0 | **Effort**: M

### Problem
When market prices are loading, users see stale or empty data with no indication that new data is being fetched.

### Solution
Add contextual loading indicators for all Universalis API calls.

### Loading States to Add

| Component | Loading Trigger | Indicator Style |
|-----------|-----------------|-----------------|
| Market Board | Price fetch | Spinner + "Fetching prices..." |
| Dye Selector (with prices) | Initial load | Skeleton rows |
| Server/DC Selector | On change | Brief spinner overlay |

### Implementation Concept

**Market Board Loading**:
```
┌────────────────────────────────────────────────┐
│  📊 Market Prices                              │
├────────────────────────────────────────────────┤
│                                                │
│      ◐  Fetching prices from Universalis...   │
│                                                │
│         Server: Cactuar (Aether)              │
│                                                │
└────────────────────────────────────────────────┘
```

**Market Board Loaded**:
```
┌────────────────────────────────────────────────┐
│  📊 Market Prices           [↻ Refresh]        │
├────────────────────────────────────────────────┤
│                                                │
│  Snow White      120 gil    ▼ -5%             │
│  Soot Black      89 gil     ▲ +12%            │
│  Rose Pink       340 gil    — 0%              │
│                                                │
│  Last updated: 2 minutes ago                   │
└────────────────────────────────────────────────┘
```

### Spinner Component

```typescript
// Reusable loading spinner
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  inline?: boolean;
}
```

### CSS Animation (respect reduced motion)
```css
.spinner {
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: pulse 2s ease-in-out infinite;
  }
}
```

---

## F2: Toast Notification System

**Priority**: P0 | **Effort**: M

### Problem
Users don't receive clear feedback when actions succeed or fail (e.g., copying to clipboard, export, filter application).

### Solution
Implement a toast notification system for transient messages.

### Toast Types

| Type | Color | Icon | Duration | Use Case |
|------|-------|------|----------|----------|
| Success | Green | ✓ | 3s | "Copied to clipboard", "Palette exported" |
| Error | Red | ✗ | 5s (dismissible) | "Failed to load prices", "Invalid color" |
| Warning | Yellow | ⚠ | 4s | "Some dyes unavailable", "Limited results" |
| Info | Blue | ℹ | 3s | "Prices updated", "New theme applied" |

### Visual Design

```
                                    ┌─────────────────────────────┐
                                    │ ✓ Copied to clipboard!  [×] │
                                    └─────────────────────────────┘

                                    ┌─────────────────────────────┐
                                    │ ✗ Failed to load prices     │
                                    │   Check your connection [×] │
                                    └─────────────────────────────┘
```

### Toast Positioning
- **Desktop**: Top-right corner, stacked
- **Mobile**: Bottom of screen (above bottom nav), full-width

### Implementation Pattern

```typescript
// Toast service singleton
class ToastService {
  show(message: string, type: ToastType, options?: ToastOptions): void;
  success(message: string): void;
  error(message: string, details?: string): void;
  warning(message: string): void;
  info(message: string): void;
  dismiss(id: string): void;
  dismissAll(): void;
}
```

### Usage Example
```typescript
// In a component
toastService.success('Palette copied to clipboard!');
toastService.error('Failed to fetch prices', 'Please try again later');
```

---

## F3: Empty State Designs

**Priority**: P1 | **Effort**: S

### Problem
When no results are found (e.g., no matching dyes after filtering), users see blank areas that feel broken.

### Solution
Design friendly empty states that explain why there's no content and suggest next steps.

### Empty States Needed

**Dye Search - No Results**:
```
┌────────────────────────────────────────────────┐
│                                                │
│           🔍                                   │
│                                                │
│     No dyes match "purpel"                     │
│                                                │
│     Try checking your spelling or             │
│     search for a category like "purple"       │
│                                                │
│          [ Clear search ]                      │
│                                                │
└────────────────────────────────────────────────┘
```

**Filtered Results - All Excluded**:
```
┌────────────────────────────────────────────────┐
│                                                │
│           🎨                                   │
│                                                │
│     All suggestions were filtered out          │
│                                                │
│     Your current filters are hiding all        │
│     matching dyes. Try adjusting filters.      │
│                                                │
│          [ Reset filters ]                     │
│                                                │
└────────────────────────────────────────────────┘
```

**Market Board - No Prices**:
```
┌────────────────────────────────────────────────┐
│                                                │
│           💰                                   │
│                                                │
│     No price data available                    │
│                                                │
│     This dye may not be tradeable or          │
│     Universalis doesn't have recent data.      │
│                                                │
│          [ Try different server ]             │
│                                                │
└────────────────────────────────────────────────┘
```

### Design Principles
- Use relevant emoji/icon (not generic sad face)
- Explain *why* it's empty
- Suggest actionable next step
- Keep text concise and friendly

---

## F4: Skeleton Loading States

**Priority**: P2 | **Effort**: M

### Problem
When content loads, areas pop in suddenly which can feel jarring.

### Solution
Use skeleton placeholders that show content structure while loading.

### Skeleton Patterns

**Dye Swatch Grid (Loading)**:
```
┌────┐ ┌────┐ ┌────┐ ┌────┐
│░░░░│ │░░░░│ │░░░░│ │░░░░│
│░░░░│ │░░░░│ │░░░░│ │░░░░│
└────┘ └────┘ └────┘ └────┘
  ▒▒▒    ▒▒▒    ▒▒▒    ▒▒▒
```

**Market Price Row (Loading)**:
```
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░  │  ░░░░░░ gil  │
```

### CSS Implementation
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--theme-card-background) 0%,
    var(--theme-card-hover) 50%,
    var(--theme-card-background) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    opacity: 0.7;
  }
}
```

---

## F5: Progress Indicators for Operations

**Priority**: P2 | **Effort**: S

### Problem
Some operations (like generating harmony suggestions with many dyes) can take a moment, with no progress indication.

### Solution
Add determinate progress bars for operations with known steps.

### Use Cases

| Operation | Progress Type | Display |
|-----------|---------------|---------|
| Batch price fetch (multi-dye) | Determinate | "Fetching prices: 3/8 dyes" |
| Image analysis | Indeterminate | Spinner + "Analyzing image..." |
| Export generation | Quick flash | Brief progress bar |

### Visual Design
```
┌────────────────────────────────────────────────┐
│  Generating harmony suggestions...              │
│  ████████████░░░░░░░░░░░░░░░░░░  45%           │
│  Processing: Tetradic combinations              │
└────────────────────────────────────────────────┘
```

---

## F6: Inline Validation Feedback

**Priority**: P2 | **Effort**: S

### Problem
Invalid inputs (like malformed hex colors) only show errors after submission.

### Solution
Provide real-time validation feedback as users type.

### Validation States

**Valid Input**:
```
Color: #FF5733  ✓
       └── Valid hex color
```

**Invalid Input**:
```
Color: #GG5733  ✗
       └── Invalid hex character "G"
```

**Incomplete Input** (neutral, not error):
```
Color: #FF5___
       └── 6 characters required
```

### Implementation Notes
- Debounce validation (300ms delay)
- Don't show error immediately on focus
- Use subtle colors (not harsh red for incomplete)

---

## F7: Refresh/Retry Controls

**Priority**: P2 | **Effort**: S

### Problem
When data is stale or an error occurred, users can't easily retry without page refresh.

### Solution
Add explicit refresh buttons and retry prompts.

### Implementations

**Market Board Refresh**:
```
┌────────────────────────────────────────────────┐
│  📊 Market Prices      [↻]  Last: 5 min ago   │
```
- Clicking [↻] refetches prices
- Show last update timestamp

**Error Retry**:
```
┌────────────────────────────────────────────────┐
│  ✗ Failed to load prices                       │
│                                                │
│     [ Retry ]    [ Use cached data ]          │
└────────────────────────────────────────────────┘
```

---

## F8: Offline State Handling

**Priority**: P3 | **Effort**: XL

### Problem
If the user loses connection, API calls fail silently.

### Solution
Detect offline state and show appropriate UI.

### Offline Banner
```
┌────────────────────────────────────────────────────────────────┐
│  📡 You're offline. Some features may be limited.        [×]  │
└────────────────────────────────────────────────────────────────┘
```

### Graceful Degradation
- Color tools (Harmony, Mixer) work fully offline (no API needed)
- Market prices show cached data with "Cached" badge
- Hide API-dependent features when offline

### Implementation Notes
- Use `navigator.onLine` + `online`/`offline` events
- Consider service worker for full offline support (F4 in backlog)

---

## Implementation Priority Order

1. **F2 - Toast System** (foundation for all feedback)
2. **F1 - Loading Spinners** (most common pain point)
3. **F3 - Empty States** (quick polish, high impact)
4. **F6 - Inline Validation** (prevents errors)
5. **F7 - Refresh/Retry** (error recovery)
6. **F4 - Skeleton States** (perceived performance)
7. **F5 - Progress Indicators** (specific use cases)
8. **F8 - Offline Handling** (advanced, defer)

---

## Files Likely to Modify

| File | Changes |
|------|---------|
| New: `src/services/toast-service.ts` | Toast singleton |
| New: `src/components/toast-container.ts` | Toast rendering |
| New: `src/components/loading-spinner.ts` | Reusable spinner |
| New: `src/components/empty-state.ts` | Empty state component |
| `src/components/market-board.ts` | Loading states, refresh |
| `src/components/dye-selector.ts` | Loading, empty states |
| `src/styles/themes.css` | Toast, spinner, skeleton styles |
| `src/shared/constants.ts` | Toast timing, animation durations |
