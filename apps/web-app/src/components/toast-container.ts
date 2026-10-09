/**
 * XIV Dye Tools v2.1.0 - Toast Container Component
 *
 * Renders toast notifications with animations and accessibility support
 * Extends BaseComponent for consistent lifecycle management
 *
 * @module components/toast-container
 */

import { BaseComponent } from './base-component';
import { LanguageService } from '@services/language-service';
import { ToastService, Toast, ToastType } from '@services/toast-service';
import { ModalService } from '@services/modal-service';
import { clearContainer } from '@shared/utils';

// ============================================================================
// Toast Icons (inline SVG for independence)
// ============================================================================

const TOAST_ICONS: Record<ToastType, string> = {
  success: `<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon">
    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
  </svg>`,
  error: `<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon">
    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
  </svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon">
    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
  </svg>`,
  info: `<svg viewBox="0 0 20 20" fill="currentColor" class="toast-icon">
    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
  </svg>`,
};

// ============================================================================
// Toast Container Component
// ============================================================================

export class ToastContainer extends BaseComponent {
  private toasts: Toast[] = [];
  private unsubscribe: (() => void) | null = null;
  /** The #toast-container wrapper, kept across renders (BUG-105). */
  private wrapper: HTMLElement | null = null;
  /** Each showing toast's node, kept for as long as the toast is (BUG-105). */
  private toastElements: Map<string, HTMLElement> = new Map();
  /** Was a modal, sheet or popover open when the current Escape went down? */
  private escapeOwnedByOverlay = false;

  constructor(container: HTMLElement) {
    super(container);
  }

  /**
   * Lifecycle: Called after initialization
   */
  onMount(): void {
    // Subscribe to toast service
    this.unsubscribe = ToastService.subscribe((toasts) => {
      this.toasts = toasts;
      this.update();
    });
    // Escape is judged on `window`, around everyone else's document-level
    // handlers, and outside bindEvents() so update() never re-registers it.
    window.addEventListener('keydown', this.noteEscapeOwner, true);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Lifecycle: Called before destruction
   */
  onUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    window.removeEventListener('keydown', this.noteEscapeOwner, true);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.toastElements.clear();
  }

  /**
   * Capture phase, before any other handler runs: does an overlay own this
   * Escape? It has to be asked now — an overlay that closes on Escape releases
   * its registration as it goes, and the export sheet does so without marking
   * the key handled, so afterwards the page looks as if nothing was open.
   */
  private noteEscapeOwner = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.escapeOwnedByOverlay = ModalService.hasOpenModals();
  };

  /**
   * Escape dismisses a toast only when nothing else wanted the key.
   *
   * BUG-105: the toast and the overlays each listened on the document and
   * neither stood aside, so one press closed the toast AND the modal, sheet or
   * popover the user was working in. The overlay holding focus owns Escape; a
   * toast is a passive notice — it times out and has its own dismiss button —
   * so it yields, even though it is drawn above the modal layer. This runs in
   * `window`'s bubble phase, after every document-level handler, so a nearer
   * handler that consumed the key (`defaultPrevented`) wins too.
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    const ownedByOverlay = this.escapeOwnedByOverlay;
    this.escapeOwnedByOverlay = false;
    if (ownedByOverlay || event.defaultPrevented || ModalService.hasOpenModals()) return;
    const dismissibleToast = this.toasts.find((t) => t.dismissible);
    if (dismissibleToast) {
      ToastService.dismiss(dismissibleToast.id);
    }
  };

  /**
   * Get ARIA attributes for toast type
   */
  private getAriaAttributes(type: ToastType): { role: string; ariaLive: string } {
    // Error and warning use assertive for immediate attention
    if (type === 'error' || type === 'warning') {
      return { role: 'alert', ariaLive: 'assertive' };
    }
    // Success and info use polite for non-critical updates
    return { role: 'status', ariaLive: 'polite' };
  }

  /**
   * Get CSS classes for toast type
   * Colors are now applied via CSS variables in globals.css for theme support
   */
  private getToastClasses(type: ToastType): string {
    const baseClasses = 'toast flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm';
    // Type class applies themed colors via CSS variables
    return `${baseClasses} toast-${type}`;
  }

  /**
   * Create a single toast element
   */
  private createToastElement(toast: Toast): HTMLElement {
    const { role, ariaLive } = this.getAriaAttributes(toast.type);

    const toastEl = this.createElement('div', {
      className: this.getToastClasses(toast.type),
      attributes: {
        role,
        'aria-live': ariaLive,
        'data-toast-id': toast.id,
      },
    });

    // Icon
    const iconWrapper = this.createElement('div', {
      className: 'flex-shrink-0 w-5 h-5',
      innerHTML: TOAST_ICONS[toast.type],
    });
    toastEl.appendChild(iconWrapper);

    // Content
    const content = this.createElement('div', {
      className: 'flex-1 min-w-0',
    });

    const message = this.createElement('p', {
      className: 'text-sm font-medium',
      textContent: toast.message,
    });
    content.appendChild(message);

    if (toast.details) {
      const details = this.createElement('p', {
        className: 'mt-1 text-xs opacity-75',
        textContent: toast.details,
      });
      content.appendChild(details);
    }

    toastEl.appendChild(content);

    // Dismiss button (for dismissible toasts)
    if (toast.dismissible) {
      const dismissBtn = this.createElement('button', {
        className:
          'flex-shrink-0 w-5 h-5 rounded hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current transition-colors',
        attributes: {
          type: 'button',
          'aria-label': LanguageService.t('common.dismiss'),
        },
        innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>`,
      });
      dismissBtn.addEventListener('click', () => ToastService.dismiss(toast.id));
      toastEl.appendChild(dismissBtn);
    }

    return toastEl;
  }

  /**
   * Render the toast container.
   *
   * Keyed, not rebuilt (BUG-105). Clearing and redrawing every toast on each
   * change gave a toast already on screen a fresh `toast-animate-in` (it slid
   * in again) and a brand-new role=alert / aria-live node (screen readers
   * announced it again) whenever another toast came or went. Now only the
   * toasts that arrived are created and only the ones that went are removed.
   */
  renderContent(): void {
    // First render — or the content was replaced: the error boundary makes
    // its own panel `this.element`, so a retry must not draw into that
    let wrapper = this.wrapper;
    if (!wrapper || this.element !== wrapper || wrapper.parentNode !== this.container) {
      clearContainer(this.container);
      this.toastElements.clear();
      wrapper = this.createElement('div', {
        id: 'toast-container',
        className: `
          fixed pointer-events-none
          bottom-4 left-0 right-0
          flex flex-col gap-2
          items-center
        `
          .replace(/\s+/g, ' ')
          .trim(),
        attributes: {
          // Toasts sit at the bottom centre — the same band as the Options and
          // palette FABs, which are z-index 100. Tailwind's `z-50` put every
          // toast underneath them; the token puts toasts above the modal layer,
          // where a toast confirming a modal action belongs.
          style: `z-index: var(--v4-z-toast, 1100)`,
        },
      });
      this.container.appendChild(wrapper);
      this.wrapper = wrapper;
      this.element = wrapper;
    }
    wrapper.setAttribute('aria-label', LanguageService.t('aria.notifications'));

    // Drop the toasts that went
    const showing = new Set(this.toasts.map((toast) => toast.id));
    for (const [id, toastEl] of this.toastElements) {
      if (!showing.has(id)) {
        toastEl.remove();
        this.toastElements.delete(id);
      }
    }

    // Create the toasts that arrived; a survivor is never re-inserted (moving
    // a node restarts its animation), and the service only ever appends, so
    // the in-place check below leaves every survivor where it is.
    this.toasts.forEach((toast, index) => {
      let toastEl = this.toastElements.get(toast.id);
      if (!toastEl) {
        toastEl = this.createToastElement(toast);
        toastEl.classList.add('pointer-events-auto');

        // Add animation class based on motion preference
        if (!ToastService.prefersReducedMotion()) {
          toastEl.classList.add('toast-animate-in');
        }
        this.toastElements.set(toast.id, toastEl);
      }
      if (wrapper.children[index] !== toastEl) {
        wrapper.insertBefore(toastEl, wrapper.children[index] ?? null);
      }
    });
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Escape is handled on `window`, registered once in onMount()

    // Touch swipe to dismiss on mobile
    if ('ontouchstart' in window) {
      this.setupSwipeToDismiss();
    }
  }

  /**
   * Setup swipe-to-dismiss for mobile
   */
  private setupSwipeToDismiss(): void {
    let startX = 0;
    let startY = 0;

    this.on(this.container, 'touchstart', (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const toastEl = target.closest('[data-toast-id]') as HTMLElement;
      if (toastEl) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    });

    this.on(this.container, 'touchend', (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const toastEl = target.closest('[data-toast-id]') as HTMLElement;
      if (!toastEl) return;

      const deltaX = e.changedTouches[0].clientX - startX;
      const deltaY = Math.abs(e.changedTouches[0].clientY - startY);

      // Swipe right to dismiss (with minimal vertical movement)
      if (deltaX > 80 && deltaY < 50) {
        const toastId = toastEl.dataset.toastId;
        if (toastId) {
          toastEl.classList.add('toast-animate-out');
          setTimeout(() => ToastService.dismiss(toastId), 150);
        }
      }
    });
  }
}
