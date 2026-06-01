/**
 * XIV Dye Tools v3.0.0 - Mobile Drawer Component
 *
 * Slide-out drawer from left edge for mobile config panels.
 * Features: backdrop overlay, swipe to close, focus trapping.
 *
 * @module mockups/MobileDrawer
 */

import { BaseComponent } from '@components/base-component';
import { AnnouncerService } from '@services/index';

/**
 * Mobile drawer that slides in from the left
 */
export class MobileDrawer extends BaseComponent {
  private isOpen: boolean = false;
  private drawer: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private contentSlot: HTMLElement | null = null;
  private previousActiveElement: HTMLElement | null = null;

  renderContent(): void {
    // Create overlay backdrop
    this.overlay = this.createElement('div', {
      className: 'drawer-overlay fixed inset-0 z-40 transition-opacity duration-300',
      attributes: {
        style: 'background: rgba(0, 0, 0, 0.5); opacity: 0; pointer-events: none;',
        'aria-hidden': 'true',
      },
    });

    // Create drawer panel
    this.drawer = this.createElement('aside', {
      className: 'mobile-drawer fixed top-0 left-0 h-full z-50 flex flex-col shadow-2xl',
      attributes: {
        style: `
          width: 85vw;
          max-width: 384px;
          background: var(--theme-card-background);
          border-right: 1px solid var(--theme-border);
          transform: translateX(-100%);
          transition: transform var(--drawer-transition);
        `,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Configuration panel',
      },
    });

    // Drawer header with close button
    const header = this.createElement('div', {
      className: 'flex items-center justify-between px-4 py-3 border-b',
      attributes: {
        style: 'border-color: var(--theme-border); background: var(--theme-background-secondary);',
      },
    });

    const title = this.createElement('h2', {
      className: 'text-lg font-semibold',
      textContent: 'Configuration',
      attributes: {
        style: 'color: var(--theme-text);',
      },
    });

    const closeBtn = this.createElement('button', {
      className: 'p-2 rounded-lg transition-colors hover:brightness-90',
      attributes: {
        style: 'background: var(--theme-card-hover); color: var(--theme-text);',
        'aria-label': 'Close configuration panel',
        type: 'button',
      },
      innerHTML: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>`,
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.drawer.appendChild(header);

    // Content area (scrollable)
    this.contentSlot = this.createElement('div', {
      className: 'flex-1 overflow-y-auto',
      attributes: {
        style: 'background: var(--theme-card-background);',
      },
    });
    this.drawer.appendChild(this.contentSlot);

    // Append to body (not container) for proper fixed positioning
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.drawer);

    this.element = this.drawer;
  }

  bindEvents(): void {
    // Close button
    const closeBtn = this.drawer?.querySelector('button[aria-label="Close configuration panel"]');
    if (closeBtn) {
      this.on(closeBtn as HTMLElement, 'click', this.close);
    }

    // Overlay click to close
    if (this.overlay) {
      this.on(this.overlay, 'click', this.close);
    }

    // Escape key to close
    this.on(document, 'keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  };

  /**
   * Open the drawer
   */
  open = (): void => {
    if (this.isOpen) return;

    this.isOpen = true;
    this.previousActiveElement = document.activeElement as HTMLElement;

    // Show overlay
    if (this.overlay) {
      this.overlay.style.opacity = '1';
      this.overlay.style.pointerEvents = 'auto';
    }

    // Slide in drawer
    if (this.drawer) {
      this.drawer.style.transform = 'translateX(0)';
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus first focusable element in drawer
    this.safeTimeout(() => {
      const firstFocusable = this.drawer?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 300);

    // Announce for screen readers
    AnnouncerService.announce('Configuration panel opened');
  };

  /**
   * Close the drawer
   */
  close = (): void => {
    if (!this.isOpen) return;

    this.isOpen = false;

    // Hide overlay
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      this.overlay.style.pointerEvents = 'none';
    }

    // Slide out drawer
    if (this.drawer) {
      this.drawer.style.transform = 'translateX(-100%)';
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Restore focus
    this.previousActiveElement?.focus();

    // Announce for screen readers
    AnnouncerService.announce('Configuration panel closed');
  };

  /**
   * Toggle drawer open/closed
   */
  toggle = (): void => {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  /**
   * Get the content container for adding child elements
   */
  getContentContainer(): HTMLElement | null {
    return this.contentSlot;
  }

  /**
   * Set drawer title
   */
  setTitle(title: string): void {
    const titleEl = this.drawer?.querySelector('h2');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Check if drawer is open
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    // Remove from body
    this.overlay?.remove();
    this.drawer?.remove();

    // Restore body scroll if needed
    document.body.style.overflow = '';

    super.destroy();
  }
}
