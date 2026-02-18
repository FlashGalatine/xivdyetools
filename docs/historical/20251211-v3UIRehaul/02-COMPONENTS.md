# v3.0.0 Reusable Components Reference

## CollapsiblePanel

A collapsible section with animated expand/collapse, used for secondary configuration options like filters and market settings.

### Import

```typescript
import { CollapsiblePanel } from '@mockups/CollapsiblePanel';
```

### Options

```typescript
interface CollapsiblePanelOptions {
  title: string;           // Panel header text
  storageKey?: string;     // LocalStorage key for persistence
  defaultOpen?: boolean;   // Initial state (default: true)
  icon?: string;           // Optional SVG icon string
}
```

### Usage

```typescript
// Create container
const container = this.createElement('div');
this.leftPanel.appendChild(container);

// Initialize panel
const panel = new CollapsiblePanel(container, {
  title: 'Dye Filters',
  storageKey: 'tool_filters',
  defaultOpen: false,
  icon: ICON_FILTER,
});

// Initialize (calls render + bindEvents)
panel.init();

// Set content
panel.setContent(this.createFiltersContent());

// Or set HTML string
panel.setContent('<p>Filter content here</p>');

// Programmatic control
panel.open();
panel.close();
panel.toggle();

// Get content container
const contentEl = panel.getContentContainer();

// Clean up
panel.destroy();
```

### Visual Structure

```
┌─────────────────────────────────────┐
│ [icon] Panel Title          [▼/▶]  │  ← Header (button)
├─────────────────────────────────────┤
│                                     │
│  Content goes here                  │  ← Collapsible content
│  (animated height transition)       │
│                                     │
└─────────────────────────────────────┘
```

### Styling

- Header: `var(--theme-background-secondary)`, hover brightness effect
- Content: `var(--theme-card-background)`
- Border: `var(--theme-border)` (top border)
- Transition: 200ms for height and opacity

---

## MobileDrawer

A slide-out drawer from the left edge for mobile configuration panels.

### Import

```typescript
import { MobileDrawer } from '@mockups/MobileDrawer';
```

### Usage

```typescript
// Create container (can be empty div)
const container = document.createElement('div');

// Initialize
const drawer = new MobileDrawer(container);
drawer.init();

// Control
drawer.open();
drawer.close();
drawer.toggle();

// Check state
if (drawer.getIsOpen()) { /* ... */ }

// Get content container
const content = drawer.getContentContainer();

// Set title
drawer.setTitle('Configuration');

// Inject tool navigation
const navSection = document.createElement('div');
navSection.setAttribute('data-drawer-nav', '');
// ... add nav buttons
content?.insertBefore(navSection, content.firstChild);

// Clean up
drawer.destroy();
```

### Features

- **Backdrop Overlay**: Semi-transparent overlay that closes drawer on click
- **Slide Animation**: Smooth translateX transition
- **Focus Trapping**: First focusable element receives focus on open
- **Focus Restoration**: Previous focus restored on close
- **Keyboard Support**: Escape key closes drawer
- **Body Scroll Lock**: Prevents background scrolling when open
- **Screen Reader Announcements**: Via AnnouncerService

### Visual Structure

```
┌──────────────────────────────────────────┐
│ (Overlay - 50% black, click to close)    │
│  ┌─────────────────────────┐             │
│  │ Configuration      [✕]  │             │
│  ├─────────────────────────┤             │
│  │ Tool Navigation         │             │
│  │ ─────────────────       │             │
│  │                         │             │
│  │ Content                 │  ← 85vw     │
│  │ (scrollable)            │    max 384px│
│  │                         │             │
│  └─────────────────────────┘             │
└──────────────────────────────────────────┘
```

### CSS Variables Used

```css
--drawer-transition: 0.3s ease-out;
--theme-card-background
--theme-border
--theme-background-secondary
--theme-text
--theme-card-hover
```

---

## MockupShell

The main two-panel layout container.

### Import

```typescript
import { MockupShell, MockupToolId } from '@mockups/MockupShell';
```

### Options

```typescript
interface MockupShellOptions {
  initialTool?: MockupToolId;  // Starting tool (default: 'harmony')
  onToolChange?: (toolId: MockupToolId) => void;  // Callback
}

type MockupToolId =
  | 'harmony'
  | 'matcher'
  | 'accessibility'
  | 'comparison'
  | 'mixer'
  | 'presets';
```

### Usage

```typescript
const container = document.getElementById('mockup-root')!;

const shell = new MockupShell(container, {
  initialTool: 'harmony',
  onToolChange: (toolId) => {
    console.log('Tool changed to:', toolId);
    // Load new tool mockup
  },
});

shell.init();

// Get panel containers for tool content injection
const leftContent = shell.getLeftPanelContent();
const rightContent = shell.getRightPanelContent();
const drawerContent = shell.getMobileDrawerContent();

// Load tool mockup
const harmonyMockup = new HarmonyMockup(container, {
  leftPanel: leftContent!,
  rightPanel: rightContent!,
  drawerContent,
});
harmonyMockup.init();
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getLeftPanelContent()` | `HTMLElement \| null` | Left panel config container |
| `getRightPanelContent()` | `HTMLElement \| null` | Right panel results container |
| `getMobileDrawerContent()` | `HTMLElement \| null` | Mobile drawer content container |
| `getActiveToolId()` | `MockupToolId` | Current active tool |
| `setActiveToolId(id)` | `void` | Change active tool |
| `getIsCollapsed()` | `boolean` | Sidebar collapsed state |
| `getIsMobile()` | `boolean` | Mobile viewport detected |
| `toggleCollapse()` | `void` | Toggle sidebar collapse |

### Events

```typescript
shell.on('tool-change', ({ toolId }: { toolId: MockupToolId }) => {
  // Handle tool change
});
```

---

## Common UI Patterns

### Section Header

```typescript
private createSection(label: string): HTMLElement {
  const section = this.createElement('div', {
    className: 'p-4 border-b',
    attributes: { style: 'border-color: var(--theme-border);' },
  });
  section.appendChild(this.createElement('h3', {
    className: 'text-sm font-semibold uppercase tracking-wider mb-3',
    textContent: label,
    attributes: { style: 'color: var(--theme-text-muted);' },
  }));
  return section;
}
```

### Results Header

```typescript
private createHeader(text: string): HTMLElement {
  return this.createElement('h3', {
    className: 'text-sm font-semibold uppercase tracking-wider mb-3',
    textContent: text,
    attributes: { style: 'color: var(--theme-text-muted);' },
  });
}
```

### Dye Swatch

```typescript
// Small swatch
<div class="w-6 h-6 rounded" style="background: ${dye.hex};"></div>

// Medium swatch
<div class="w-8 h-8 rounded border"
     style="background: ${dye.hex}; border-color: var(--theme-border);">
</div>

// Large swatch with border
<div class="w-10 h-10 rounded-lg border-2 border-white/30"
     style="background: ${dye.hex};">
</div>
```

### Card Container

```typescript
const card = this.createElement('div', {
  className: 'p-4 rounded-lg',
  attributes: {
    style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);'
  },
});
```

### Button Styles

```typescript
// Primary button
<button style="background: var(--theme-primary); color: var(--theme-text-header);">
  Primary Action
</button>

// Secondary button
<button style="background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);">
  Secondary Action
</button>

// Ghost button (transparent)
<button style="background: transparent; color: var(--theme-text);">
  Ghost Action
</button>
```

### Form Controls

```typescript
// Select dropdown
<select class="w-full p-2 rounded text-sm"
        style="background: var(--theme-background-secondary);
               color: var(--theme-text);
               border: 1px solid var(--theme-border);">
  <option>Option 1</option>
</select>

// Checkbox with label
<label class="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" class="w-4 h-4 rounded">
  <span class="text-sm" style="color: var(--theme-text);">Label</span>
</label>

// Range slider
<input type="range" min="1" max="10" value="5" class="w-full">

// Text input
<input type="text" class="w-full px-3 py-2 rounded-lg text-sm"
       style="background: var(--theme-card-background);
              color: var(--theme-text);
              border: 1px solid var(--theme-border);">
```

---

## SVG Icons

Icons are stored as string constants and injected via `innerHTML`:

```typescript
const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
</svg>`;

// Usage in HTML
<span class="w-4 h-4">${ICON_FILTER}</span>
```

### Tool Icons (from v2.x)

Import from `@shared/tool-icons`:

```typescript
import {
  ICON_TOOL_HARMONY,
  ICON_TOOL_MATCHER,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_PRESETS,
} from '@shared/tool-icons';
```
