/**
 * XIV Dye Tools 5.0 - Modal Container Component (the 16A shell)
 *
 * The load-bearing 5.0 change: the modal chrome finally reads the theme
 * tokens (the old shell hardcoded Tailwind greys and a 60vh cap). Four shell
 * variants per the confirmed Modal Directions:
 * - `sheet`  — the default. Mobile: bottom sheet with grab handle and
 *   drag-to-close (touchmove tracking, engaging only at `scrollTop === 0`).
 *   Desktop: centered 560px dialog.
 * - `panel`  — 480px right slide-over pinned below the app bar (settings-like
 *   surfaces: theme, language, collections).
 * - `card`   — centered card (600px desktop).
 * - `alert`  — compact centered alert; destructive confirms live here.
 *
 * Sizes are sheet heights (`content` / `tall` ≈ 60% / `full` = 88% for the
 * camera's full-bleed case); the 60vh content cap is deleted.
 *
 * Destructive convention suite-wide: primary = solid accent, destructive =
 * OUTLINED accent, Cancel is the wide thumb target.
 *
 * Fixes carried with the shell (register list): initial focus per modal,
 * `body.style.overflow` restored to its prior value (not blanked).
 *
 * @module components/modal-container
 */

import { BaseComponent } from './base-component';
import { LanguageService } from '@services/language-service';
import { ModalService, Modal, ModalId } from '@services/modal-service';
import { clearContainer } from '@shared/utils';

// ============================================================================
// 16A shell styles (theme tokens only — no hardcoded chrome colors)
// ============================================================================

const MOBILE_QUERY = '(max-width: 640px)';

const SHELL_STYLES = `
.m16-backdrop {
  position: fixed; inset: 0; z-index: var(--v4-z-modal, 1000);
  display: flex; align-items: center; justify-content: center; padding: 40px;
  background: rgba(0, 0, 0, 0.5);
}
.m16-backdrop[data-under] { background: transparent; }
/* Reduced scrim for live-preview modals (theme picker) */
.m16-backdrop--light-scrim { background: rgba(0, 0, 0, 0.18); }
.m16-dialog {
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--theme-background);
  border: 1px solid var(--theme-border);
  color: var(--theme-text);
  max-height: 100%;
}
.m16-sheet-desktop { width: 560px; border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,0.55); }
.m16-card { width: 600px; border-radius: 18px; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
.m16-alert {
  width: 420px; border-radius: 16px; gap: 14px; padding: 18px;
  background: var(--theme-card-background);
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
}
.m16-backdrop--panel { justify-content: flex-end; align-items: stretch; padding: 0; }
.m16-panel {
  width: var(--m16-panel-width, 480px); max-width: 100%;
  margin-top: calc(var(--v4-header-height, 48px) + var(--v4-tool-bar-height, 44px));
  border-radius: 14px 0 0 0;
  border-left: 1px solid var(--theme-border);
  border-top: 1px solid var(--theme-border);
  box-shadow: -22px 0 60px rgba(0,0,0,0.42);
}
.m16-header {
  flex-shrink: 0; display: flex; align-items: flex-start; gap: 12px;
  padding: 17px 18px 14px;
  border-bottom: 1px solid var(--theme-border);
}
.m16-header-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.m16-eyebrow {
  font-family: var(--font-mono); font-size: 9.5px;
  letter-spacing: 1.2px; color: var(--theme-text-muted);
}
.m16-title { font-weight: 700; font-size: 18px; line-height: 1.2; color: var(--theme-text); margin: 0; }
.m16-sub { font-size: 12px; line-height: 1.45; color: var(--theme-text-muted); }
.m16-close {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; cursor: pointer;
  background: var(--theme-card-background); border: none; color: var(--theme-text-muted);
}
.m16-close:hover { background: var(--theme-card-hover, var(--theme-background-secondary)); }
.m16-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; }
.m16-footer {
  flex-shrink: 0; display: flex; justify-content: flex-end; gap: 9px;
  padding: 13px 18px; border-top: 1px solid var(--theme-border);
}
.m16-btn {
  display: flex; align-items: center; justify-content: center;
  min-height: 42px; padding: 0 20px; border-radius: 11px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 700;
}
.m16-btn:hover { filter: brightness(1.1); }
.m16-btn--cancel {
  background: var(--theme-card-background); color: var(--theme-text);
  border: 1px solid var(--theme-border);
}
.m16-btn--primary {
  background: var(--theme-primary); color: #ffffff;
  border: 1px solid var(--theme-primary);
}
.m16-btn--destructive {
  background: transparent; color: var(--theme-primary);
  border: 1px solid var(--theme-primary);
}
.m16-grab { display: none; }
/* Shared mono section label for modal bodies (restLabel, pastLabel, ...) */
.m16-label {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 1.2px; color: var(--theme-text-muted);
  text-transform: uppercase;
}
/* Fragment Mono has no CJK coverage and CJK has no case — fall back to the
   body sans with CJK-appropriate tracking (per the Modal Directions finding) */
:lang(ja) .m16-eyebrow, :lang(ko) .m16-eyebrow, :lang(zh) .m16-eyebrow,
:lang(ja) .m16-label, :lang(ko) .m16-label, :lang(zh) .m16-label {
  font-family: inherit; letter-spacing: 0.04em;
}

@media ${MOBILE_QUERY} {
  .m16-backdrop { padding: 0; align-items: flex-end; }
  .m16-backdrop--alert { align-items: center; padding: 22px; }
  .m16-sheet-desktop {
    width: 100%; max-height: 88%;
    border-radius: 22px 22px 0 0; border: none;
    border-top: 1px solid var(--theme-border);
    box-shadow: 0 -16px 44px rgba(0,0,0,0.42);
  }
  .m16-sheet--content { max-height: 88%; }
  .m16-sheet--tall { height: 60%; }
  .m16-sheet--full { height: 88%; }
  .m16-card { width: 100%; margin: 12px; border-radius: 18px; }
  .m16-panel { width: 100%; margin-top: 0; border-radius: 0; }
  .m16-grab { display: flex; justify-content: center; padding: 8px 0 2px; flex-shrink: 0; }
  .m16-grab span {
    display: block; width: 36px; height: 4px; border-radius: 2px;
    background: var(--theme-border);
  }
  .m16-footer { padding: 11px 14px 26px; }
  .m16-btn { min-height: 50px; border-radius: 12px; font-size: 13.5px; flex: 1; }
  /* Primary is the widest thing on screen — except on destructive footers,
     where Cancel is the wide thumb target and the dangerous action narrow */
  .m16-btn--primary { flex: 1.4; }
  .m16-footer--destructive .m16-btn--cancel { flex: 1.5; }
  .m16-footer--destructive .m16-btn--destructive { flex: 1; }
}
`;

// ============================================================================
// Modal Container Component
// ============================================================================

export class ModalContainer extends BaseComponent {
  private modals: Modal[] = [];
  private unsubscribe: (() => void) | null = null;
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapElements: HTMLElement[] = [];
  // WEB-PERF-002: Track rendered modal IDs for incremental rendering
  private renderedModalIds: Set<ModalId> = new Set();
  /** Register fix: restore body overflow to its PRIOR value, never blank it */
  private priorBodyOverflow: string | null = null;
  private stylesInjected = false;

  constructor(container: HTMLElement) {
    super(container);
  }

  onMount(): void {
    this.unsubscribe = ModalService.subscribe((modals) => {
      const hadModals = this.modals.length > 0;
      const hasModals = modals.length > 0;

      if (!hadModals && hasModals) {
        this.previousActiveElement = document.activeElement as HTMLElement;
        this.priorBodyOverflow = document.body.style.overflow;
      }

      this.modals = modals;
      this.update();

      // WEB-A11Y-002: Check isConnected to handle removed elements
      if (hadModals && !hasModals && this.previousActiveElement) {
        if (this.previousActiveElement.isConnected) {
          this.previousActiveElement.focus();
        }
        this.previousActiveElement = null;
      }
    });
  }

  onUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      const topModal = ModalService.getTopModal();
      if (topModal?.closeOnEscape && topModal.closable) {
        event.preventDefault();
        ModalService.dismiss(topModal.id);
      }
    }
    if (event.key === 'Tab' && this.modals.length > 0) {
      this.handleFocusTrap(event);
    }
  }

  private handleFocusTrap(event: KeyboardEvent): void {
    if (this.focusTrapElements.length === 0) return;
    const firstElement = this.focusTrapElements[0];
    const lastElement = this.focusTrapElements[this.focusTrapElements.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    return Array.from(container.querySelectorAll<HTMLElement>(selector));
  }

  private handleBackdropClick(event: MouseEvent, modal: Modal): void {
    if (
      modal.closeOnBackdrop &&
      modal.closable &&
      (event.target as HTMLElement).classList.contains('m16-backdrop')
    ) {
      ModalService.dismiss(modal.id);
    }
  }

  /**
   * Sheet drag-to-close (mobile): engages only when the body is scrolled to
   * the top, tracks touchmove, dismisses past the threshold — extends the
   * toast's gesture per the register.
   */
  private attachSheetDrag(dialog: HTMLElement, body: HTMLElement, modal: Modal): void {
    let startY = 0;
    let delta = 0;
    let engaged = false;

    this.on(dialog, 'touchstart', ((e: TouchEvent) => {
      if (!window.matchMedia(MOBILE_QUERY).matches) return;
      if (body.scrollTop > 0) return; // engage only at scrollTop === 0
      startY = e.touches[0].clientY;
      delta = 0;
      engaged = true;
      dialog.style.transition = 'none';
    }) as EventListener);

    this.on(dialog, 'touchmove', ((e: TouchEvent) => {
      if (!engaged) return;
      delta = Math.max(0, e.touches[0].clientY - startY);
      if (delta > 0 && body.scrollTop === 0) {
        dialog.style.transform = `translateY(${delta}px)`;
      }
    }) as EventListener);

    this.on(dialog, 'touchend', (() => {
      if (!engaged) return;
      engaged = false;
      dialog.style.transition = 'transform 0.2s ease';
      if (delta > 90 && modal.closable) {
        dialog.style.transform = 'translateY(100%)';
        this.safeTimeout(() => ModalService.dismiss(modal.id), 180);
      } else {
        dialog.style.transform = '';
      }
    }) as EventListener);
  }

  /**
   * Build a footer action button per the destructive convention.
   *
   * BUG-009: the click handler is NOT attached here. Listeners are attached by
   * `bindModalListeners`, which can run against an existing element, because
   * `BaseComponent.update()` clears the whole listener map on every render
   * while the incremental render deliberately keeps already-built modals.
   * `data-action` is what lets the binder find this button again.
   */
  private createActionButton(
    label: string,
    kind: 'cancel' | 'primary' | 'destructive',
    action: 'cancel' | 'confirm'
  ): HTMLElement {
    return this.createElement('button', {
      className: `m16-btn m16-btn--${kind}`,
      attributes: { type: 'button', 'data-action': action },
      textContent: label,
    });
  }

  /**
   * Attach every listener a modal needs, to an element that may already be in
   * the DOM from an earlier render.
   *
   * BUG-009: `update()` calls `unbindAllEvents()` (clearing the map) and then
   * `renderContent()`, which skips modals already in `renderedModalIds`. Those
   * modals kept their DOM but lost their listeners, so opening a second modal
   * left the first one's ✕, backdrop and footer buttons dead — a confirmation
   * dialog underneath became unanswerable by mouse. Escape still worked, which
   * is why it read as "the buttons stopped working". Binding is therefore
   * idempotent and re-runnable, and `renderContent` re-runs it for every
   * surviving modal.
   */
  private bindModalListeners(backdrop: HTMLElement, modal: Modal): void {
    this.on(backdrop, 'click', (e) => this.handleBackdropClick(e, modal));

    const closeBtn = backdrop.querySelector('.m16-close');
    if (closeBtn) {
      this.on(closeBtn as HTMLElement, 'click', () => ModalService.dismiss(modal.id));
    }

    const cancelBtn = backdrop.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      this.on(cancelBtn as HTMLElement, 'click', () => {
        if (modal.onCancel) modal.onCancel();
        ModalService.dismiss(modal.id);
      });
    }

    const confirmBtn = backdrop.querySelector('[data-action="confirm"]');
    if (confirmBtn) {
      this.on(confirmBtn as HTMLElement, 'click', () => {
        if (modal.onConfirm) modal.onConfirm();
        ModalService.dismiss(modal.id);
      });
    }

    const variant = modal.variant ?? (modal.type === 'confirm' ? 'alert' : 'sheet');
    if (variant === 'sheet') {
      const dialog = backdrop.querySelector('.m16-dialog') as HTMLElement | null;
      const body = backdrop.querySelector('.m16-body') as HTMLElement | null;
      if (dialog && body) this.attachSheetDrag(dialog, body, modal);
    }
  }

  private createModalElement(modal: Modal, index: number): HTMLElement {
    const isTopModal = index === this.modals.length - 1;
    const variant = modal.variant ?? (modal.type === 'confirm' ? 'alert' : 'sheet');

    const backdrop = this.createElement('div', {
      className: `m16-backdrop m16-backdrop--${variant}${modal.lightScrim ? ' m16-backdrop--light-scrim' : ''}`,
      attributes: {
        role: 'presentation',
        'data-modal-id': modal.id,
        // Stacked modals step up from the modal layer. This inline value beats
        // the class rule, so it has to name the same token — hardcoding a base
        // here is what silently left every modal under the app chrome.
        style: `z-index: calc(var(--v4-z-modal, 1000) + ${index})`,
        ...(isTopModal ? {} : { 'data-under': '' }),
      },
    });

    const dialogAttributes: Record<string, string> = {
      role: variant === 'alert' ? 'alertdialog' : 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': `modal-title-${modal.id}`,
      tabindex: '-1',
    };
    if (modal.content) {
      dialogAttributes['aria-describedby'] = `modal-content-${modal.id}`;
    }

    const variantClass =
      variant === 'panel'
        ? 'm16-panel'
        : variant === 'card'
          ? 'm16-card'
          : variant === 'alert'
            ? 'm16-alert'
            : `m16-sheet-desktop m16-sheet--${modal.sheetHeight ?? 'content'}`;

    const dialog = this.createElement('div', {
      className: `m16-dialog modal-dialog ${variantClass}`,
      attributes: dialogAttributes,
    });
    // Panel width override (desktop only — the mobile rule sets 100%)
    if (variant === 'panel' && modal.panelWidth) {
      dialog.style.setProperty('--m16-panel-width', `${modal.panelWidth}px`);
    }

    // Grab handle (mobile sheets only; hidden by CSS elsewhere)
    if (variant === 'sheet') {
      const grab = this.createElement('div', { className: 'm16-grab' });
      grab.appendChild(this.createElement('span'));
      dialog.appendChild(grab);
    }

    // Header (alerts render the eyebrow inline instead)
    if (variant !== 'alert') {
      const header = this.createElement('div', { className: 'm16-header' });
      const headerText = this.createElement('div', { className: 'm16-header-text' });
      if (modal.eyebrow) {
        headerText.appendChild(
          this.createElement('span', { className: 'm16-eyebrow', textContent: modal.eyebrow })
        );
      }
      headerText.appendChild(
        this.createElement('h2', {
          id: `modal-title-${modal.id}`,
          className: 'm16-title',
          textContent: modal.title,
        })
      );
      if (modal.subtitle) {
        headerText.appendChild(
          this.createElement('span', { className: 'm16-sub', textContent: modal.subtitle })
        );
      }
      header.appendChild(headerText);

      if (modal.closable) {
        const closeBtn = this.createElement('button', {
          className: 'm16-close',
          attributes: { type: 'button', 'aria-label': LanguageService.t('common.closeModal') },
          innerHTML:
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        });
        header.appendChild(closeBtn);
      }
      dialog.appendChild(header);
    } else {
      dialog.appendChild(
        this.createElement('span', {
          id: `modal-title-${modal.id}`,
          className: 'm16-eyebrow',
          textContent: modal.eyebrow ?? modal.title,
        })
      );
    }

    // Content — flexes and scrolls; the 60vh cap is dead
    const content = this.createElement('div', {
      id: `modal-content-${modal.id}`,
      className: 'm16-body',
    });
    if (modal.content) {
      content.appendChild(modal.content);
    }
    dialog.appendChild(content);

    // Footer
    if (modal.type === 'confirm' || modal.confirmText || modal.cancelText) {
      const footer = this.createElement('div', {
        className: `m16-footer${modal.destructive ? ' m16-footer--destructive' : ''}`,
      });

      if (modal.cancelText || modal.type === 'confirm') {
        footer.appendChild(
          this.createActionButton(
            modal.cancelText || LanguageService.t('common.cancel'),
            'cancel',
            'cancel'
          )
        );
      }
      if (modal.confirmText || modal.type === 'confirm') {
        footer.appendChild(
          this.createActionButton(
            modal.confirmText || LanguageService.t('common.confirm'),
            modal.destructive ? 'destructive' : 'primary',
            'confirm'
          )
        );
      }
      dialog.appendChild(footer);
    }

    backdrop.appendChild(dialog);
    this.bindModalListeners(backdrop, modal);

    return backdrop;
  }

  renderContent(): void {
    if (this.modals.length === 0) {
      if (this.element) {
        clearContainer(this.container);
        this.element = null;
      }
      this.renderedModalIds.clear();
      return;
    }

    if (!this.element) {
      this.element = this.createElement('div', {
        id: 'modal-container',
        className: 'modal-container',
        attributes: { 'aria-label': LanguageService.t('aria.modalDialogs') },
      });
      // Inject into <head>, NOT into this.element — the container is cleared
      // when the last modal closes, which would take the styles with it and
      // leave every subsequent modal unstyled
      if (!this.stylesInjected && !document.getElementById('m16-shell-styles')) {
        const style = document.createElement('style');
        style.id = 'm16-shell-styles';
        style.textContent = SHELL_STYLES;
        document.head.appendChild(style);
        this.stylesInjected = true;
      }
      this.container.appendChild(this.element);
    }

    // WEB-PERF-002: incremental rendering
    const currentModalIds = new Set(this.modals.map((m) => m.id));
    for (const renderedId of this.renderedModalIds) {
      if (!currentModalIds.has(renderedId)) {
        this.element.querySelector(`[data-modal-id="${renderedId}"]`)?.remove();
        this.renderedModalIds.delete(renderedId);
      }
    }
    this.modals.forEach((modal, index) => {
      if (!this.renderedModalIds.has(modal.id)) {
        this.element!.appendChild(this.createModalElement(modal, index));
        this.renderedModalIds.add(modal.id);
        return;
      }
      // BUG-009: this modal survives from an earlier render, so its DOM is
      // intact but its listeners were just cleared by unbindAllEvents(). Give
      // them back, or every modal under the top one goes inert to the mouse.
      const wrapper = this.element!.querySelector(
        `[data-modal-id="${modal.id}"]`
      ) as HTMLElement | null;
      if (wrapper) this.bindModalListeners(wrapper, modal);
    });

    // z-order + only the top modal shows a backdrop
    this.modals.forEach((modal, index) => {
      const wrapper = this.element?.querySelector(
        `[data-modal-id="${modal.id}"]`
      ) as HTMLElement | null;
      if (wrapper) {
        const isTopModal = index === this.modals.length - 1;
        // Re-stacking runs on every render and overwrites what
        // createModalElement set, so it has to name the same token — this
        // line is what kept every modal at 50, under the app chrome.
        wrapper.style.zIndex = `calc(var(--v4-z-modal, 1000) + ${index})`;
        if (isTopModal) wrapper.removeAttribute('data-under');
        else wrapper.setAttribute('data-under', '');
        // WEB-BUG-005: inert background modals
        if (isTopModal) wrapper.removeAttribute('inert');
        else wrapper.setAttribute('inert', '');
      }
    });

    // Focus: first focusable, falling back to the dialog itself (register fix)
    const topDialog = this.element.querySelector(
      `[data-modal-id="${this.modals[this.modals.length - 1].id}"] .modal-dialog`
    ) as HTMLElement | null;
    if (topDialog) {
      this.focusTrapElements = this.getFocusableElements(topDialog);
      this.safeTimeout(() => {
        (this.focusTrapElements[0] ?? topDialog).focus();
      }, 50);
    }

    document.body.style.overflow = 'hidden';
  }

  onUpdate(): void {
    // Register fix: restore the PRIOR overflow value, never assume ''.
    //
    // webapp-modals-22 (found while writing the test that proves the above):
    // the guard was `if (this.modals.length === 0)` alone, so this ran on the
    // very first update too -- when the container mounts with no modals and
    // `priorBodyOverflow` is still null. `?? ''` then BLANKED whatever overflow
    // the page had set before any modal existed, and the value captured on the
    // first open was therefore always '' -- which is exactly why the existing
    // test could not tell "restores the prior value" from "blanks it". Only
    // restore when there is something saved to restore.
    if (this.modals.length === 0 && this.priorBodyOverflow !== null) {
      document.body.style.overflow = this.priorBodyOverflow;
      this.priorBodyOverflow = null;
    }
  }

  bindEvents(): void {
    this.on(document, 'keydown', this.handleKeyDown);
  }
}
