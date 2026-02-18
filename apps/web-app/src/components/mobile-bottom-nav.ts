/**
 * XIV Dye Tools v2.0.0 - Mobile Bottom Navigation Component
 *
 * Phase 12.8: Bug Fixes
 * Provides mobile-optimized bottom navigation for tool switching on small screens
 *
 * @module components/mobile-bottom-nav
 */

import { BaseComponent } from './base-component';
import { clearContainer } from '@shared/utils';

/**
 * Tool definition for mobile navigation
 */
export interface MobileToolDef {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/**
 * Mobile Bottom Navigation Component
 * Displays fixed bottom navigation bar with tool icons for mobile devices
 * Hidden on desktop (>768px), visible on mobile (≤768px)
 */
export class MobileBottomNav extends BaseComponent {
  private tools: MobileToolDef[] = [];
  private currentToolId: string = 'harmony';

  constructor(container: HTMLElement, tools: MobileToolDef[]) {
    super(container);
    this.tools = tools;
  }

  /**
   * Render the mobile bottom navigation
   */
  renderContent(): void {
    const nav = this.createElement('nav', {
      className:
        'fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 ' +
        'md:hidden flex justify-around items-center h-16 z-40 safe-area-inset-bottom',
      attributes: {
        'aria-label': 'Mobile Navigation',
        'data-mobile-nav': 'true',
      },
    });

    // Create nav items for each tool
    this.tools.forEach((tool) => {
      const navItem = this.createElement('button', {
        className:
          'mobile-nav-item flex flex-col items-center justify-center w-full h-full transition-colors ' +
          'hover:bg-gray-100 dark:hover:bg-gray-700 ' +
          (tool.id === this.currentToolId
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 active'
            : 'text-gray-600 dark:text-gray-400'),
        attributes: {
          'data-tool-id': tool.id,
          title: tool.description,
          'aria-label': tool.name,
          'aria-selected': tool.id === this.currentToolId ? 'true' : 'false',
          role: 'tab',
        },
      });

      // Icon - support both inline SVG strings and image paths
      let icon: HTMLElement;
      if (tool.icon.includes('<svg')) {
        // Inline SVG for theme color inheritance
        icon = this.createElement('span', {
          className: 'w-6 h-6 mb-0.5 flex items-center justify-center',
          attributes: {
            'aria-hidden': 'true',
          },
        });
        icon.innerHTML = tool.icon;
      } else {
        // Fallback to img for paths
        icon = this.createElement('img', {
          className: 'w-6 h-6 mb-0.5',
          attributes: {
            src: tool.icon,
            alt: '',
            'aria-hidden': 'true',
          },
        });
      }

      // Label
      const label = this.createElement('span', {
        className: 'text-xs font-medium truncate max-w-[60px]',
        textContent: tool.name,
      });

      navItem.appendChild(icon);
      navItem.appendChild(label);
      nav.appendChild(navItem);
    });

    // Emit custom event on container to notify parent
    setTimeout(() => {
      this.container.dispatchEvent(
        new CustomEvent('mobile-nav-ready', {
          bubbles: true,
          composed: true,
        })
      );
    }, 0);

    // Replace container content
    clearContainer(this.container);
    this.element = nav;
    this.container.appendChild(this.element);
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    const buttons = this.querySelectorAll<HTMLButtonElement>('[data-tool-id]');

    buttons.forEach((btn) => {
      this.on(btn, 'click', () => {
        const toolId = btn.getAttribute('data-tool-id');
        if (toolId) {
          this.setActiveToolId(toolId);
          // Dispatch custom event on container for parent to listen
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
  }

  /**
   * Set the currently active tool
   */
  setActiveToolId(toolId: string): void {
    if (toolId === this.currentToolId) return;

    this.currentToolId = toolId;

    // Update button styles
    const buttons = this.querySelectorAll<HTMLButtonElement>('[data-tool-id]');
    buttons.forEach((btn) => {
      const isSelected = btn.getAttribute('data-tool-id') === toolId;

      // Remove all state classes
      btn.classList.remove(
        'text-blue-600',
        'dark:text-blue-400',
        'bg-blue-50',
        'dark:bg-blue-900/20',
        'text-gray-600',
        'dark:text-gray-400',
        'active'
      );

      // Add appropriate classes
      if (isSelected) {
        btn.classList.add(
          'text-blue-600',
          'dark:text-blue-400',
          'bg-blue-50',
          'dark:bg-blue-900/20',
          'active'
        );
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.add('text-gray-600', 'dark:text-gray-400');
        btn.setAttribute('aria-selected', 'false');
      }
    });
  }

  /**
   * Get the currently active tool ID
   */
  getActiveToolId(): string {
    return this.currentToolId;
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      currentToolId: this.currentToolId,
      toolCount: this.tools.length,
    };
  }
}
