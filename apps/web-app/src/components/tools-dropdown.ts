/**
 * XIV Dye Tools v2.0.0 - Tools Dropdown Component
 *
 * Phase 12.8: Bug Fixes
 * Provides desktop dropdown navigation for switching between tools
 *
 * @module components/tools-dropdown
 */

import { BaseComponent } from './base-component';
import { ThemeService, LanguageService } from '@services/index';
import { ColorService } from '@services/index';
import { clearContainer } from '@shared/utils';
import { ICON_TOOL_MENU } from '@shared/tool-icons';

/**
 * Tool definition for dropdown
 */
export interface ToolDef {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/**
 * Tools Dropdown Component
 * Displays a dropdown menu with all available tools on desktop
 * Hidden on mobile (≤768px), visible on desktop (>768px)
 */
export class ToolsDropdown extends BaseComponent {
  private tools: ToolDef[] = [];
  private isDropdownOpen: boolean = false;
  private closeOtherDropdownsHandler: EventListener | null = null;
  private languageUnsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, tools: ToolDef[]) {
    super(container);
    this.tools = tools;
  }

  /**
   * Render the tools dropdown component
   */
  renderContent(): void {
    // Get current theme to determine border opacity
    const currentTheme = ThemeService.getCurrentTheme();
    const themeObject = ThemeService.getTheme(currentTheme);
    const isLightText = ColorService.getOptimalTextColor(themeObject.palette.primary) === '#FFFFFF';

    // Create button to toggle dropdown
    const button = this.createElement('button', {
      id: 'tools-dropdown-btn',
      className:
        'p-2 rounded-lg border transition-colors ' + 'hidden md:inline-flex items-center gap-2',
      attributes: {
        'aria-label': 'Toggle tools menu',
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        style: `color: var(--theme-text-header); border-color: ${isLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};`,
      },
    });

    // Use inline SVG for theme color inheritance
    button.innerHTML = `<span class="inline-block w-5 h-5" aria-hidden="true">${ICON_TOOL_MENU}</span> ${LanguageService.t('header.tools')}`;

    // Add hover effect using theme colors
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = isLightText
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
    });

    // Create dropdown menu container - use theme CSS variables for background
    const dropdown = this.createElement('div', {
      id: 'tools-dropdown-menu',
      className: 'hidden absolute right-0 mt-2 border rounded-lg shadow-lg z-50 min-w-56',
      attributes: {
        style: 'background-color: var(--theme-card-background); border-color: var(--theme-border);',
      },
    });

    // Create tools list
    const toolsList = this.createElement('div', {
      className: 'flex flex-col p-2',
    });

    // Add tool buttons
    for (const tool of this.tools) {
      const toolBtn = this.createElement('button', {
        className: 'px-4 py-3 text-left text-sm rounded transition-colors flex items-center gap-3',
        attributes: {
          'data-tool-id': tool.id,
          title: tool.description,
        },
      });

      // Add hover effect using theme colors
      toolBtn.addEventListener('mouseenter', () => {
        toolBtn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      toolBtn.addEventListener('mouseleave', () => {
        toolBtn.style.backgroundColor = 'transparent';
      });

      // Tool icon - support both inline SVG strings and image paths
      let icon: HTMLElement;
      if (tool.icon.includes('<svg')) {
        // Inline SVG for theme color inheritance
        icon = this.createElement('span', {
          className: 'w-5 h-5 flex items-center justify-center',
          attributes: {
            'aria-hidden': 'true',
            style: 'color: var(--theme-text);',
          },
        });
        icon.innerHTML = tool.icon;
      } else {
        // Fallback to img for paths
        icon = this.createElement('img', {
          className: 'w-5 h-5',
          attributes: {
            src: tool.icon,
            alt: '',
            'aria-hidden': 'true',
          },
        });
      }

      // Tool info container (flex-col + justify-center for vertical alignment with icon)
      const infoContainer = this.createElement('div', {
        className: 'flex-1 flex flex-col justify-center',
      });

      // Tool name
      const nameElement = this.createElement('div', {
        className: 'font-medium',
        textContent: tool.name,
        attributes: {
          style: 'color: var(--theme-text);',
        },
      });

      // Tool description
      const descElement = this.createElement('div', {
        className: 'text-xs',
        textContent: tool.description,
        attributes: {
          style: 'color: var(--theme-text-muted);',
        },
      });

      infoContainer.appendChild(nameElement);
      infoContainer.appendChild(descElement);

      toolBtn.appendChild(icon);
      toolBtn.appendChild(infoContainer);
      toolsList.appendChild(toolBtn);
    }

    dropdown.appendChild(toolsList);

    // Create wrapper container for positioning
    const wrapper = this.createElement('div', {
      className: 'relative',
    });

    wrapper.appendChild(button);
    wrapper.appendChild(dropdown);

    // Clear and render
    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    const button = this.querySelector<HTMLButtonElement>('#tools-dropdown-btn');
    const dropdown = this.querySelector<HTMLElement>('#tools-dropdown-menu');

    if (!button || !dropdown) return;

    // Listen for close requests from other dropdowns
    this.closeOtherDropdownsHandler = ((e: CustomEvent<{ source: string }>) => {
      if (e.detail.source !== 'tools' && this.isDropdownOpen) {
        this.closeDropdown();
      }
    }) as EventListener;
    document.addEventListener('close-other-dropdowns', this.closeOtherDropdownsHandler);

    // Toggle dropdown on button click
    this.on(button, 'click', (e: Event) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Handle tool selection
    const toolButtons = this.querySelectorAll<HTMLButtonElement>('[data-tool-id]');
    toolButtons.forEach((btn) => {
      this.on(btn, 'click', (e: Event) => {
        const toolId = btn.getAttribute('data-tool-id');
        if (toolId) {
          e.stopPropagation();
          this.closeDropdown();
          // Dispatch custom event for parent to listen
          this.container.dispatchEvent(
            new CustomEvent('tool-selected', {
              detail: { toolId },
              bubbles: true,
              composed: true,
            })
          );
        }
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e: Event) => {
      if (this.isDropdownOpen) {
        const target = e.target as HTMLElement;
        if (!this.element?.contains(target)) {
          this.closeDropdown();
        }
      }
    });

    // Close dropdown on escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });
  }

  /**
   * Toggle dropdown visibility
   */
  private toggleDropdown(): void {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown
   */
  private openDropdown(): void {
    const dropdown = this.querySelector<HTMLElement>('#tools-dropdown-menu');
    const button = this.querySelector<HTMLButtonElement>('#tools-dropdown-btn');

    if (dropdown && button) {
      // Close other dropdowns (Theme switcher)
      document.dispatchEvent(
        new CustomEvent('close-other-dropdowns', { detail: { source: 'tools' } })
      );

      dropdown.classList.remove('hidden');
      button.setAttribute('aria-expanded', 'true');
      this.isDropdownOpen = true;
    }
  }

  /**
   * Close dropdown
   */
  private closeDropdown(): void {
    const dropdown = this.querySelector<HTMLElement>('#tools-dropdown-menu');
    const button = this.querySelector<HTMLButtonElement>('#tools-dropdown-btn');

    if (dropdown && button) {
      dropdown.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
      this.isDropdownOpen = false;
    }
  }

  /**
   * Initialize component - subscribe to theme and language changes
   */
  onMount(): void {
    // Subscribe to theme changes to update button text colors
    ThemeService.subscribe(() => {
      this.update();
    });
    // Subscribe to language changes to update translated text
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });
  }

  /**
   * Cleanup event listeners and subscriptions
   */
  onUnmount(): void {
    if (this.closeOtherDropdownsHandler) {
      document.removeEventListener('close-other-dropdowns', this.closeOtherDropdownsHandler);
      this.closeOtherDropdownsHandler = null;
    }
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      isOpen: this.isDropdownOpen,
      toolCount: this.tools.length,
    };
  }
}
