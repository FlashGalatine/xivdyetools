# v3.0.0 Component Architecture

## BaseComponent Pattern

All v3.0 UI components extend `BaseComponent`, which provides:

- Lifecycle hooks: `render()`, `bindEvents()`, `onMount()`, `destroy()`
- DOM helpers: `createElement()`, `querySelector()`, `clearContainer()`
- Event management: `on()` for adding listeners (auto-cleanup on destroy)
- Event emission: `emit()` for custom events
- Safe timeouts: `safeTimeout()` (auto-cleared on destroy)

```typescript
import { BaseComponent } from '@components/base-component';

class MyComponent extends BaseComponent {
  constructor(container: HTMLElement) {
    super(container);
  }

  render(): void {
    const el = this.createElement('div', {
      className: 'my-component',
      attributes: { style: 'color: var(--theme-text);' },
    });
    this.element = el;
    this.container.appendChild(el);
  }

  bindEvents(): void {
    this.on(this.element!, 'click', this.handleClick);
  }

  handleClick = () => { /* ... */ };

  destroy(): void {
    // Custom cleanup here
    super.destroy();
  }
}
```

## MockupShell Architecture

The `MockupShell` is the main container component that orchestrates the two-panel layout.

### Component Hierarchy

```
MockupShell
├── Left Panel (aside)
│   ├── Tool Navigation (nav)
│   │   └── Tool buttons (icon + label)
│   ├── Left Panel Content (div)
│   │   └── [Tool-specific config injected here]
│   └── Collapse Button (button)
│
├── Right Panel (main)
│   ├── Mobile Header (div, md:hidden)
│   │   ├── Menu Button
│   │   └── Current Tool Display
│   └── Right Panel Content (div)
│       └── [Tool-specific results injected here]
│
├── Mobile Bottom Nav (nav, fixed, md:hidden)
│   └── Tool buttons (icon + label)
│
└── Mobile Drawer (MobileDrawer component)
    └── [Tool navigation + config cloned here]
```

### Key Methods

```typescript
// Get containers for injecting tool content
shell.getLeftPanelContent(): HTMLElement | null
shell.getRightPanelContent(): HTMLElement | null
shell.getMobileDrawerContent(): HTMLElement | null

// Tool management
shell.getActiveToolId(): MockupToolId
shell.setActiveToolId(toolId: MockupToolId): void

// State
shell.getIsCollapsed(): boolean
shell.getIsMobile(): boolean
shell.toggleCollapse(): void
```

### Events

The shell emits a `tool-change` event when the active tool changes:

```typescript
shell.on('tool-change', ({ toolId }) => {
  console.log('Active tool:', toolId);
});
```

## Tool Mockup Pattern

Each tool mockup follows a consistent pattern:

```typescript
export interface ToolMockupOptions {
  leftPanel: HTMLElement;    // Config container
  rightPanel: HTMLElement;   // Results container
  drawerContent?: HTMLElement | null; // Mobile drawer
}

export class ToolMockup extends BaseComponent {
  private options: ToolMockupOptions;
  private somePanel: CollapsiblePanel | null = null;

  constructor(container: HTMLElement, options: ToolMockupOptions) {
    super(container);
    this.options = options;
  }

  render(): void {
    this.renderLeftPanel();
    this.renderRightPanel();
    if (this.options.drawerContent) this.renderDrawerContent();
    this.element = this.container;
  }

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Add sections with config controls
    left.appendChild(this.createSection('Section Name'));

    // Add collapsible panels
    const container = this.createElement('div');
    left.appendChild(container);
    this.somePanel = new CollapsiblePanel(container, {
      title: 'Panel Title',
      storageKey: 'tool_panel_key',
      defaultOpen: false,
      icon: SOME_ICON,
    });
    this.somePanel.init();
    this.somePanel.setContent(this.createPanelContent());
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Add result visualizations
    right.appendChild(this.createResults());
  }

  destroy(): void {
    this.somePanel?.destroy();
    super.destroy();
  }
}
```

## Responsive Breakpoints

The layout uses Tailwind's responsive prefixes:

| Prefix | Min Width | Usage |
|--------|-----------|-------|
| (none) | 0px | Mobile-first styles |
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Desktop breakpoint |
| `lg:` | 1024px | Large screens |
| `xl:` | 1280px | Extra large |

### Key Responsive Patterns

```html
<!-- Hide on mobile, show on desktop -->
<div class="hidden md:flex">Desktop Only</div>

<!-- Show on mobile, hide on desktop -->
<div class="md:hidden">Mobile Only</div>

<!-- Grid changes by breakpoint -->
<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <!-- 1 col on mobile, 2 on tablet, 3 on desktop -->
</div>

<!-- Padding changes by breakpoint -->
<div class="p-4 md:p-6">Content</div>
```

## Flexbox Height Propagation

For charts and visualizations that need to fill available space, ensure the full flex chain is established:

```html
<!-- Parent must have defined height -->
<div class="flex flex-col h-[400px]">
  <!-- Header with fixed height -->
  <h3 class="flex-shrink-0">Title</h3>

  <!-- Content expands to fill remaining space -->
  <div class="flex-1 flex flex-col min-h-0">
    <!-- Inner content also needs flex-1 + h-full -->
    <div class="flex-1 h-full flex items-end">
      <!-- Bars align to bottom -->
    </div>
  </div>
</div>
```

### CSS Grid Equal Height Rows

When using CSS Grid, rows automatically have equal height:

```html
<div class="grid grid-cols-2 gap-4">
  <!-- Both cells same height, even if content differs -->
  <div class="p-4 rounded-lg flex flex-col">
    <h4 class="flex-shrink-0">Chart 1</h4>
    <div class="flex-1">Content</div>
  </div>
  <div class="p-4 rounded-lg flex flex-col">
    <h4 class="flex-shrink-0">Chart 2</h4>
    <div class="flex-1">Content</div>
  </div>
</div>
```

## State Persistence

User preferences are persisted via `StorageService`:

```typescript
import { StorageService } from '@services/index';

// Save state
StorageService.setItem('mockup_sidebar_collapsed', true);
StorageService.setItem('mockup_panel_filters', false);

// Load state
const collapsed = StorageService.getItem<boolean>('mockup_sidebar_collapsed');
const filtersOpen = StorageService.getItem<boolean>('mockup_panel_filters');
```

### Storage Keys Used

| Key | Type | Description |
|-----|------|-------------|
| `mockup_sidebar_collapsed` | `boolean` | Left panel collapsed state |
| `mockup_panel_<name>` | `boolean` | CollapsiblePanel open states |

## Accessibility Considerations

1. **ARIA Labels**: All interactive elements have `aria-label` attributes
2. **Role Attributes**: Drawer uses `role="dialog"` and `aria-modal="true"`
3. **Focus Management**: Drawer traps focus and restores on close
4. **Screen Reader Announcements**: Via `AnnouncerService.announce()`
5. **Keyboard Navigation**: Escape closes drawer, buttons are focusable
6. **aria-current**: Active tool marked with `aria-current="page"`

## Event Flow

```
User clicks tool in nav
        │
        ▼
handleToolSelect(toolId)
        │
        ├──▶ Update activeToolId
        │
        ├──▶ Re-render navigations
        │    ├── Desktop tool nav
        │    ├── Mobile drawer nav
        │    └── Mobile bottom nav
        │
        ├──▶ Update mobile header
        │
        ├──▶ Call options.onToolChange?.(toolId)
        │
        └──▶ Emit 'tool-change' event
```
