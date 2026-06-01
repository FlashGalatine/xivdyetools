/**
 * XIV Dye Tools v3.0.0 - Mockup Shell Component
 *
 * Two-panel layout shell for the v3.0.0 UI mockups.
 * Desktop (≥768px): Left sidebar (nav + config) | Right content (results)
 * Mobile (<768px): Full-width content + Drawer trigger
 *
 * @module mockups/MockupShell
 */

import { BaseComponent } from '@components/base-component';
import { StorageService, LanguageService } from '@services/index';
import {
  ICON_TOOL_HARMONY,
  ICON_TOOL_MATCHER,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_PRESETS,
  ICON_TOOL_BUDGET,
} from '@shared/tool-icons';
import { MobileDrawer } from './MobileDrawer';
import { getLocalizedMockupTools } from './MockupNav';

export type MockupToolId =
  | 'harmony'
  | 'matcher'
  | 'accessibility'
  | 'comparison'
  | 'mixer'
  | 'presets'
  | 'budget';

// Map tool IDs to their v2.x SVG icons
const TOOL_ICONS: Record<MockupToolId, string> = {
  harmony: ICON_TOOL_HARMONY,
  matcher: ICON_TOOL_MATCHER,
  accessibility: ICON_TOOL_ACCESSIBILITY,
  comparison: ICON_TOOL_COMPARISON,
  mixer: ICON_TOOL_MIXER,
  presets: ICON_TOOL_PRESETS,
  budget: ICON_TOOL_BUDGET,
};

export interface MockupShellOptions {
  initialTool?: MockupToolId;
  onToolChange?: (toolId: MockupToolId) => void;
}

/**
 * Main shell component for the two-panel mockup layout
 */
export class MockupShell extends BaseComponent {
  private options: MockupShellOptions;
  private isCollapsed: boolean = false;
  private isMobile: boolean = false;
  private activeToolId: MockupToolId;

  // Child components
  private mobileDrawer: MobileDrawer | null = null;

  // DOM references
  private leftPanel: HTMLElement | null = null;
  private rightPanel: HTMLElement | null = null;
  private leftPanelContent: HTMLElement | null = null;
  private rightPanelContent: HTMLElement | null = null;
  private toolNavContainer: HTMLElement | null = null;
  private mobileMenuBtn: HTMLElement | null = null;
  private collapseBtn: HTMLElement | null = null;
  private mobileBottomNav: HTMLElement | null = null;

  constructor(container: HTMLElement, options: MockupShellOptions = {}) {
    super(container);
    this.options = options;
    this.activeToolId = options.initialTool ?? 'harmony';

    // Load collapsed state from storage
    const storedCollapsed = StorageService.getItem<boolean>('mockup_sidebar_collapsed');
    this.isCollapsed = storedCollapsed ?? false;

    // Check if mobile
    this.isMobile = window.innerWidth < 768;
  }

  renderContent(): void {
    const shell = this.createElement('div', {
      className: 'mockup-shell flex flex-col md:flex-row min-h-[600px]',
      attributes: {
        style: 'background: var(--theme-background);',
      },
    });

    // ========================
    // LEFT PANEL (Desktop sidebar)
    // ========================
    this.leftPanel = this.createElement('aside', {
      className: 'hidden md:flex flex-col flex-shrink-0 border-r transition-all duration-300',
      attributes: {
        style: `
          width: ${this.isCollapsed ? 'var(--panel-collapsed-width)' : 'var(--panel-left-width)'};
          border-color: var(--theme-border);
          background: var(--theme-card-background);
        `.replace(/\s+/g, ' '),
      },
    });

    // Tool navigation (icons + labels or just icons when collapsed)
    this.toolNavContainer = this.createElement('nav', {
      className: 'flex-shrink-0 border-b',
      attributes: {
        style: 'border-color: var(--theme-border);',
        'aria-label': 'Tool navigation',
      },
    });
    this.renderToolNav();
    this.leftPanel.appendChild(this.toolNavContainer);

    // Left panel content area (tool-specific config)
    this.leftPanelContent = this.createElement('div', {
      className: 'flex-1 overflow-y-auto',
      attributes: {
        'data-panel': 'left-config',
        style: this.isCollapsed ? 'display: none;' : '',
      },
    });
    this.leftPanel.appendChild(this.leftPanelContent);

    // Collapse toggle button at bottom
    const collapseContainer = this.createElement('div', {
      className: 'flex-shrink-0 border-t p-2',
      attributes: { style: 'border-color: var(--theme-border);' },
    });
    this.collapseBtn = this.createElement('button', {
      className:
        'w-full flex items-center justify-center gap-2 p-2 rounded-lg transition-colors hover:brightness-90',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        'aria-label': this.isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
        type: 'button',
      },
    });
    this.updateCollapseButton();
    collapseContainer.appendChild(this.collapseBtn);
    this.leftPanel.appendChild(collapseContainer);

    shell.appendChild(this.leftPanel);

    // ========================
    // RIGHT PANEL (Main content)
    // ========================
    this.rightPanel = this.createElement('main', {
      className: 'flex-1 flex flex-col min-w-0',
      attributes: {
        style: 'background: var(--theme-background-secondary);',
      },
    });

    // Mobile header with menu button (sticky)
    const mobileHeader = this.createElement('div', {
      className: 'md:hidden flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-10',
      attributes: {
        style: 'border-color: var(--theme-border); background: var(--theme-card-background);',
      },
    });

    this.mobileMenuBtn = this.createElement('button', {
      className: 'p-2 rounded-lg transition-colors hover:brightness-90',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        'aria-label': 'Open configuration menu',
        type: 'button',
      },
      innerHTML: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>`,
    });

    // Active tool display in mobile header
    const mobileToolDisplay = this.createElement('div', {
      className: 'flex items-center gap-2 flex-1',
    });
    const tools = getLocalizedMockupTools();
    const activeTool = tools.find((t) => t.id === this.activeToolId);
    mobileToolDisplay.innerHTML = `
      <span class="w-5 h-5" style="color: var(--theme-primary);">${TOOL_ICONS[this.activeToolId]}</span>
      <span class="font-medium" style="color: var(--theme-text);">${activeTool?.name ?? this.activeToolId}</span>
    `;

    mobileHeader.appendChild(this.mobileMenuBtn);
    mobileHeader.appendChild(mobileToolDisplay);
    this.rightPanel.appendChild(mobileHeader);

    // Right panel content area (results/visualizations)
    // Added pb-20 on mobile for bottom nav clearance
    this.rightPanelContent = this.createElement('div', {
      className: 'flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6',
      attributes: {
        'data-panel': 'right-results',
      },
    });
    this.rightPanel.appendChild(this.rightPanelContent);

    shell.appendChild(this.rightPanel);

    this.element = shell;
    this.container.appendChild(this.element);

    // Initialize mobile drawer
    this.initializeMobileDrawer();

    // Create mobile bottom navigation
    this.createMobileBottomNav();
  }

  /**
   * Create the mobile bottom navigation bar
   */
  private createMobileBottomNav(): void {
    this.mobileBottomNav = this.createElement('nav', {
      className: 'md:hidden fixed bottom-0 left-0 right-0 z-20 border-t',
      attributes: {
        style: 'background: var(--theme-card-background); border-color: var(--theme-border);',
        'aria-label': 'Tool navigation',
      },
    });

    this.renderMobileBottomNav();
    document.body.appendChild(this.mobileBottomNav);
  }

  /**
   * Render the mobile bottom nav buttons
   */
  private renderMobileBottomNav(): void {
    if (!this.mobileBottomNav) return;

    const tools = getLocalizedMockupTools();
    this.mobileBottomNav.innerHTML = '';

    const navContainer = this.createElement('div', {
      className: 'flex items-center justify-around py-2 px-1',
    });

    tools.forEach((tool) => {
      const isActive = this.activeToolId === tool.id;
      const btn = this.createElement('button', {
        className:
          'flex flex-col items-center justify-center px-2 py-1 rounded-lg transition-colors min-w-[48px]',
        attributes: {
          style: isActive ? 'color: var(--theme-primary);' : 'color: var(--theme-text-muted);',
          'aria-label': tool.name,
          ...(isActive && { 'aria-current': 'page' }),
          type: 'button',
        },
      });

      const icon = this.createElement('span', {
        className: 'w-6 h-6 mb-0.5',
        innerHTML: TOOL_ICONS[tool.id as MockupToolId],
      });

      const label = this.createElement('span', {
        className: 'text-[10px] font-medium truncate max-w-[56px]',
        textContent: tool.name.split(' ')[0], // First word only for space
      });

      btn.appendChild(icon);
      btn.appendChild(label);

      btn.addEventListener('click', () => this.handleToolSelect(tool.id as MockupToolId));
      navContainer.appendChild(btn);
    });

    this.mobileBottomNav.appendChild(navContainer);
  }

  private renderToolNav(): void {
    if (!this.toolNavContainer) return;

    const tools = getLocalizedMockupTools();

    if (this.isCollapsed) {
      // Icon-only mode
      this.toolNavContainer.className =
        'flex-shrink-0 border-b flex flex-col items-center py-2 gap-1';
      this.toolNavContainer.innerHTML = '';

      tools.forEach((tool) => {
        const isActive = this.activeToolId === tool.id;
        const btn = this.createElement('button', {
          className: 'w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
          attributes: {
            style: isActive
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: transparent; color: var(--theme-text);',
            'aria-label': tool.name,
            ...(isActive && { 'aria-current': 'page' }),
            title: tool.name,
            type: 'button',
          },
          innerHTML: `<span class="w-5 h-5">${TOOL_ICONS[tool.id as MockupToolId]}</span>`,
        });

        btn.addEventListener('click', () => this.handleToolSelect(tool.id as MockupToolId));
        this.toolNavContainer!.appendChild(btn);
      });
    } else {
      // Full mode with icons + labels
      this.toolNavContainer.className = 'flex-shrink-0 border-b p-2 space-y-1';
      this.toolNavContainer.innerHTML = '';

      tools.forEach((tool) => {
        const isActive = this.activeToolId === tool.id;
        const btn = this.createElement('button', {
          className:
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm',
          attributes: {
            style: isActive
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: transparent; color: var(--theme-text);',
            ...(isActive && { 'aria-current': 'page' }),
            type: 'button',
          },
        });

        const icon = this.createElement('span', {
          className: 'w-5 h-5 flex-shrink-0',
          innerHTML: TOOL_ICONS[tool.id as MockupToolId],
        });
        const name = this.createElement('span', {
          className: 'truncate',
          textContent: tool.name,
        });

        btn.appendChild(icon);
        btn.appendChild(name);
        btn.addEventListener('click', () => this.handleToolSelect(tool.id as MockupToolId));
        this.toolNavContainer!.appendChild(btn);
      });
    }
  }

  private updateCollapseButton(): void {
    if (!this.collapseBtn) return;

    const chevronLeft = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
    </svg>`;
    const chevronRight = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>`;

    if (this.isCollapsed) {
      this.collapseBtn.innerHTML = chevronRight;
      this.collapseBtn.setAttribute('aria-label', 'Expand sidebar');
    } else {
      this.collapseBtn.innerHTML = `${chevronLeft}<span class="text-sm">Collapse</span>`;
      this.collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
    }
  }

  private initializeMobileDrawer(): void {
    const drawerContainer = document.createElement('div');
    this.mobileDrawer = new MobileDrawer(drawerContainer);
    this.mobileDrawer.init();

    // Add tool navigation to drawer content
    this.updateMobileDrawerNav();
  }

  private updateMobileDrawerNav(): void {
    const drawerContent = this.mobileDrawer?.getContentContainer();
    if (!drawerContent) return;

    // Create navigation section at top of drawer
    const navSection = document.createElement('div');
    navSection.className = 'p-3 border-b';
    navSection.setAttribute('style', 'border-color: var(--theme-border);');

    const tools = getLocalizedMockupTools();
    tools.forEach((tool) => {
      const isActive = this.activeToolId === tool.id;
      const btn = document.createElement('button');
      btn.className =
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm mb-1';
      btn.setAttribute(
        'style',
        isActive
          ? 'background: var(--theme-primary); color: var(--theme-text-header);'
          : 'background: transparent; color: var(--theme-text);'
      );
      btn.innerHTML = `
        <span class="w-5 h-5 flex-shrink-0">${TOOL_ICONS[tool.id as MockupToolId]}</span>
        <span class="truncate">${tool.name}</span>
      `;
      btn.addEventListener('click', () => {
        this.handleToolSelect(tool.id as MockupToolId);
        this.mobileDrawer?.close();
      });
      navSection.appendChild(btn);
    });

    // Insert nav at the beginning of drawer content
    const existingNav = drawerContent.querySelector('[data-drawer-nav]');
    if (existingNav) {
      existingNav.replaceWith(navSection);
    } else {
      navSection.setAttribute('data-drawer-nav', '');
      drawerContent.insertBefore(navSection, drawerContent.firstChild);
    }
  }

  bindEvents(): void {
    // Mobile menu button
    if (this.mobileMenuBtn) {
      this.on(this.mobileMenuBtn, 'click', () => {
        this.mobileDrawer?.open();
      });
    }

    // Collapse button
    if (this.collapseBtn) {
      this.on(this.collapseBtn, 'click', () => {
        this.toggleCollapse();
      });
    }

    // Resize handler
    this.on(window, 'resize', this.handleResize);
  }

  private handleResize = (): void => {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;

    if (wasMobile !== this.isMobile) {
      if (!this.isMobile && this.mobileDrawer?.getIsOpen()) {
        this.mobileDrawer.close();
      }
    }
  };

  private handleToolSelect(toolId: MockupToolId): void {
    this.activeToolId = toolId;

    // Update all navigations
    this.renderToolNav();
    this.updateMobileDrawerNav();
    this.renderMobileBottomNav();

    // Update mobile header
    const mobileToolDisplay = this.rightPanel?.querySelector('.md\\:hidden .flex-1');
    if (mobileToolDisplay) {
      const tools = getLocalizedMockupTools();
      const activeTool = tools.find((t) => t.id === toolId);
      mobileToolDisplay.innerHTML = `
        <span class="w-5 h-5" style="color: var(--theme-primary);">${TOOL_ICONS[toolId]}</span>
        <span class="font-medium" style="color: var(--theme-text);">${activeTool?.name ?? toolId}</span>
      `;
    }

    // Notify parent
    this.options.onToolChange?.(toolId);

    // Emit event
    this.emit('tool-change', { toolId });
  }

  /**
   * Toggle sidebar collapsed state
   */
  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;

    // Persist state
    StorageService.setItem('mockup_sidebar_collapsed', this.isCollapsed);

    // Update left panel width
    if (this.leftPanel) {
      this.leftPanel.style.width = this.isCollapsed
        ? 'var(--panel-collapsed-width)'
        : 'var(--panel-left-width)';
    }

    // Toggle config content visibility
    if (this.leftPanelContent) {
      this.leftPanelContent.style.display = this.isCollapsed ? 'none' : '';
    }

    // Update navigation
    this.renderToolNav();
    this.updateCollapseButton();
  }

  /**
   * Get the left panel content container (for tool-specific config)
   */
  getLeftPanelContent(): HTMLElement | null {
    return this.leftPanelContent;
  }

  /**
   * Get the right panel content container (for results/visualizations)
   */
  getRightPanelContent(): HTMLElement | null {
    return this.rightPanelContent;
  }

  /**
   * Get the mobile drawer content container
   */
  getMobileDrawerContent(): HTMLElement | null {
    return this.mobileDrawer?.getContentContainer() ?? null;
  }

  /**
   * Get current active tool ID
   */
  getActiveToolId(): MockupToolId {
    return this.activeToolId;
  }

  /**
   * Set active tool programmatically
   */
  setActiveToolId(toolId: MockupToolId): void {
    this.handleToolSelect(toolId);
  }

  /**
   * Check if sidebar is collapsed
   */
  getIsCollapsed(): boolean {
    return this.isCollapsed;
  }

  /**
   * Check if currently in mobile view
   */
  getIsMobile(): boolean {
    return this.isMobile;
  }

  onMount(): void {
    LanguageService.subscribe(() => {
      this.renderToolNav();
      this.updateMobileDrawerNav();
      this.renderMobileBottomNav();
    });
  }

  destroy(): void {
    this.mobileDrawer?.destroy();
    // Remove mobile bottom nav from body
    if (this.mobileBottomNav && this.mobileBottomNav.parentNode) {
      this.mobileBottomNav.parentNode.removeChild(this.mobileBottomNav);
    }
    super.destroy();
  }
}
