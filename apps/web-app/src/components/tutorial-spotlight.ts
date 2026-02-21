/**
 * XIV Dye Tools v2.4.0 - Tutorial Spotlight Component
 *
 * Custom spotlight/coach-mark overlay for interactive tutorials
 * Highlights target elements and shows instructional tooltips
 *
 * @module components/tutorial-spotlight
 */

import { BaseComponent } from './base-component';
import { TutorialService, TutorialStep } from '@services/tutorial-service';
import { LanguageService } from '@services/language-service';
import { ModalService } from '@services/modal-service';
import { logger } from '@shared/logger';

// ============================================================================
// Spotlight Configuration
// ============================================================================

const SPOTLIGHT_PADDING = 8; // pixels around target element
const TOOLTIP_OFFSET = 12; // pixels from spotlight edge
const ANIMATION_DURATION = 300; // milliseconds
const SCROLL_MARGIN = 100; // pixels margin when scrolling element into view

// ============================================================================
// Shadow DOM Utilities
// ============================================================================

/**
 * Query selector that traverses through Shadow DOM boundaries.
 * Searches document and all shadow roots recursively.
 *
 * @param selector - CSS selector string (can be comma-separated for multiple selectors)
 * @returns The first matching element, or null if not found
 */
function querySelectorDeep(selector: string): HTMLElement | null {
  // First try regular document query (fast path)
  const regular = document.querySelector(selector) as HTMLElement | null;
  if (regular) return regular;

  // Split multiple selectors and try each
  const selectors = selector.split(',').map((s) => s.trim());

  // Search through all shadow roots
  function searchShadowRoots(root: Document | ShadowRoot): HTMLElement | null {
    for (const sel of selectors) {
      const found = root.querySelector(sel) as HTMLElement | null;
      if (found) return found;
    }

    // Get all elements that might have shadow roots
    const elements = root.querySelectorAll('*');
    for (const element of elements) {
      if (element.shadowRoot) {
        const found = searchShadowRoots(element.shadowRoot);
        if (found) return found;
      }
    }

    return null;
  }

  return searchShadowRoots(document);
}

// ============================================================================
// Tutorial Spotlight Class
// ============================================================================

/**
 * Spotlight component for tutorial highlighting
 * Creates an overlay with a cutout around the target element
 */
export class TutorialSpotlight extends BaseComponent {
  private overlay: HTMLElement | null = null;
  private spotlight: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private currentStep: TutorialStep | null = null;
  private currentStepIndex = 0;
  private totalSteps = 0;
  private unsubscribe: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  renderContent(): void {
    // Create overlay container
    this.element = this.createElement('div', {
      className: 'tutorial-spotlight-container',
      attributes: {
        'aria-live': 'polite',
        role: 'dialog',
        'aria-label': 'Tutorial',
      },
    });

    // Overlay backdrop (semi-transparent)
    this.overlay = this.createElement('div', {
      className: 'tutorial-overlay',
    });
    this.applyOverlayStyles();

    // Spotlight cutout
    this.spotlight = this.createElement('div', {
      className: 'tutorial-spotlight',
    });
    this.applySpotlightStyles();

    // Tooltip container
    this.tooltip = this.createElement('div', {
      className: 'tutorial-tooltip',
      attributes: {
        role: 'tooltip',
      },
    });
    this.applyTooltipStyles();

    this.element.appendChild(this.overlay);
    this.element.appendChild(this.spotlight);
    this.element.appendChild(this.tooltip);
    this.container.appendChild(this.element);

    // Start hidden
    this.element.style.display = 'none';
  }

  bindEvents(): void {
    // Subscribe to tutorial state changes
    this.unsubscribe = TutorialService.subscribe((state) => {
      if (state.isActive) {
        this.show();
      } else {
        this.hide();
      }
    });

    // Listen for step show events
    this.on(
      document as unknown as HTMLElement,
      'tutorial:show-step' as keyof HTMLElementEventMap,
      ((event: CustomEvent<{ step: TutorialStep; stepIndex: number; totalSteps: number }>) => {
        this.showStep(event.detail.step, event.detail.stepIndex, event.detail.totalSteps);
      }) as EventListener
    );

    // Listen for tutorial end
    this.on(document as unknown as HTMLElement, 'tutorial:end' as keyof HTMLElementEventMap, () => {
      this.hide();
    });

    // Handle window resize
    this.on(window as unknown as HTMLElement, 'resize' as keyof HTMLElementEventMap, () => {
      if (this.currentStep) {
        this.updatePositions();
      }
    });

    // Handle escape key
    this.on(
      document as unknown as HTMLElement,
      'keydown' as keyof HTMLElementEventMap,
      ((event: KeyboardEvent) => {
        if (event.key === 'Escape' && TutorialService.getState().isActive) {
          TutorialService.skip();
        }
      }) as EventListener
    );
  }

  // ============================================================================
  // Styling
  // ============================================================================

  private applyOverlayStyles(): void {
    if (!this.overlay) return;

    Object.assign(this.overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: '9998',
      transition: this.prefersReducedMotion() ? 'none' : `opacity ${ANIMATION_DURATION}ms ease-out`,
    });
  }

  private applySpotlightStyles(): void {
    if (!this.spotlight) return;

    Object.assign(this.spotlight.style, {
      position: 'fixed',
      zIndex: '9999',
      borderRadius: '8px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
      backgroundColor: 'transparent',
      pointerEvents: 'none',
      transition: this.prefersReducedMotion() ? 'none' : `all ${ANIMATION_DURATION}ms ease-out`,
    });
  }

  private applyTooltipStyles(): void {
    if (!this.tooltip) return;

    Object.assign(this.tooltip.style, {
      position: 'fixed',
      zIndex: '10000',
      maxWidth: '320px',
      padding: '16px',
      borderRadius: '12px',
      backgroundColor: 'var(--theme-card-background, #ffffff)',
      color: 'var(--theme-text, #1a1a1a)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
      border: '1px solid var(--theme-border, #e0e0e0)',
      transition: this.prefersReducedMotion()
        ? 'none'
        : `all ${ANIMATION_DURATION}ms ease-out, opacity ${ANIMATION_DURATION / 2}ms ease-out`,
    });
  }

  // ============================================================================
  // Step Display
  // ============================================================================

  private showStep(step: TutorialStep, stepIndex: number, totalSteps: number): void {
    this.currentStep = step;
    this.currentStepIndex = stepIndex;
    this.totalSteps = totalSteps;

    // Find target element (supports Shadow DOM traversal)
    const target = querySelectorDeep(step.target);
    if (!target) {
      logger.warn(`Tutorial target not found: ${step.target}`);
      // Skip to next step if target not found
      setTimeout(() => TutorialService.next(), 100);
      return;
    }

    // Scroll target into view if needed
    this.scrollIntoViewIfNeeded(target);

    // Wait for scroll to complete
    setTimeout(() => {
      this.updatePositions();
      this.updateTooltipContent(step, stepIndex, totalSteps);
    }, 100);

    // Set up resize observer for the target
    this.setupResizeObserver(target);
  }

  private updatePositions(): void {
    if (!this.currentStep || !this.spotlight || !this.tooltip) return;

    // Use Shadow DOM traversal to find target
    const target = querySelectorDeep(this.currentStep.target);
    if (!target) return;

    const rect = target.getBoundingClientRect();

    // Update spotlight position
    this.spotlight.style.top = `${rect.top - SPOTLIGHT_PADDING}px`;
    this.spotlight.style.left = `${rect.left - SPOTLIGHT_PADDING}px`;
    this.spotlight.style.width = `${rect.width + SPOTLIGHT_PADDING * 2}px`;
    this.spotlight.style.height = `${rect.height + SPOTLIGHT_PADDING * 2}px`;

    // Position tooltip based on preferred position
    this.positionTooltip(rect, this.currentStep.position || 'auto');
  }

  private positionTooltip(
    targetRect: DOMRect,
    preferredPosition: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  ): void {
    if (!this.tooltip) return;

    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = SPOTLIGHT_PADDING + TOOLTIP_OFFSET;

    let top = 0;
    let left = 0;
    let position = preferredPosition;

    // Auto-detect best position if auto
    if (position === 'auto') {
      const spaceAbove = targetRect.top;
      const spaceBelow = viewportHeight - targetRect.bottom;
      const spaceLeft = targetRect.left;
      const spaceRight = viewportWidth - targetRect.right;

      const maxSpace = Math.max(spaceAbove, spaceBelow, spaceLeft, spaceRight);

      if (maxSpace === spaceBelow) position = 'bottom';
      else if (maxSpace === spaceAbove) position = 'top';
      else if (maxSpace === spaceRight) position = 'right';
      else position = 'left';
    }

    // Calculate position based on direction
    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + padding;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, viewportWidth - tooltipRect.width - 16));
    top = Math.max(16, Math.min(top, viewportHeight - tooltipRect.height - 16));

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  private updateTooltipContent(step: TutorialStep, stepIndex: number, totalSteps: number): void {
    if (!this.tooltip) return;

    const title = LanguageService.t(step.titleKey);
    const description = LanguageService.t(step.descriptionKey);

    this.tooltip.innerHTML = '';

    // Step indicator
    const stepIndicator = this.createElement('div', {
      className: 'tutorial-step-indicator',
    });
    stepIndicator.style.cssText = `
      font-size: 12px;
      color: var(--theme-text-muted);
      margin-bottom: 8px;
    `;
    stepIndicator.textContent = `${LanguageService.t('tutorial.step')} ${stepIndex + 1} ${LanguageService.t('tutorial.of')} ${totalSteps}`;
    this.tooltip.appendChild(stepIndicator);

    // Title
    const titleEl = this.createElement('h3', {
      textContent: title,
    });
    titleEl.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--theme-text);
    `;
    this.tooltip.appendChild(titleEl);

    // Description
    const descEl = this.createElement('p', {
      textContent: description,
    });
    descEl.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 16px 0;
      color: var(--theme-text-muted);
    `;
    this.tooltip.appendChild(descEl);

    // Button container
    const buttonContainer = this.createElement('div', {
      className: 'tutorial-buttons',
    });
    buttonContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    `;

    // Skip button
    const skipBtn = this.createElement('button', {
      textContent: LanguageService.t('tutorial.skip'),
    });
    skipBtn.style.cssText = `
      padding: 8px 16px;
      font-size: 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: transparent;
      color: var(--theme-text-muted);
      transition: color 0.2s;
    `;
    skipBtn.addEventListener('mouseenter', () => {
      skipBtn.style.color = 'var(--theme-text)';
    });
    skipBtn.addEventListener('mouseleave', () => {
      skipBtn.style.color = 'var(--theme-text-muted)';
    });
    skipBtn.addEventListener('click', () => TutorialService.skip());
    buttonContainer.appendChild(skipBtn);

    // Navigation buttons
    const navContainer = this.createElement('div');
    navContainer.style.cssText = 'display: flex; gap: 8px;';

    // Previous button (if not first step)
    if (stepIndex > 0) {
      const prevBtn = this.createElement('button', {
        textContent: LanguageService.t('tutorial.previous'),
      });
      prevBtn.style.cssText = `
        padding: 8px 16px;
        font-size: 14px;
        border: 1px solid var(--theme-border);
        border-radius: 6px;
        cursor: pointer;
        background: var(--theme-card-background);
        color: var(--theme-text);
        transition: background-color 0.2s;
      `;
      prevBtn.addEventListener('mouseenter', () => {
        prevBtn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      prevBtn.addEventListener('mouseleave', () => {
        prevBtn.style.backgroundColor = 'var(--theme-card-background)';
      });
      prevBtn.addEventListener('click', () => TutorialService.previous());
      navContainer.appendChild(prevBtn);
    }

    // Next/Finish button
    const nextBtn = this.createElement('button', {
      textContent:
        stepIndex === totalSteps - 1
          ? LanguageService.t('tutorial.finish')
          : LanguageService.t('tutorial.next'),
    });
    nextBtn.style.cssText = `
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: var(--theme-primary);
      color: var(--theme-text-header);
      transition: filter 0.2s;
    `;
    nextBtn.addEventListener('mouseenter', () => {
      nextBtn.style.filter = 'brightness(1.1)';
    });
    nextBtn.addEventListener('mouseleave', () => {
      nextBtn.style.filter = '';
    });
    nextBtn.addEventListener('click', () => TutorialService.next());
    navContainer.appendChild(nextBtn);

    buttonContainer.appendChild(navContainer);
    this.tooltip.appendChild(buttonContainer);

    // Progress dots
    const progressContainer = this.createElement('div', {
      className: 'tutorial-progress',
    });
    progressContainer.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--theme-border);
    `;

    for (let i = 0; i < totalSteps; i++) {
      const dot = this.createElement('div');
      dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${i === stepIndex ? 'var(--theme-primary)' : 'var(--theme-border)'};
        transition: background-color 0.2s;
      `;
      progressContainer.appendChild(dot);
    }

    this.tooltip.appendChild(progressContainer);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private scrollIntoViewIfNeeded(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    if (rect.top < SCROLL_MARGIN || rect.bottom > viewportHeight - SCROLL_MARGIN) {
      element.scrollIntoView({
        behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }

  private setupResizeObserver(target: HTMLElement): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.updatePositions();
    });

    this.resizeObserver.observe(target);
  }

  private prefersReducedMotion(): boolean {
    return ModalService.prefersReducedMotion();
  }

  // ============================================================================
  // Visibility
  // ============================================================================

  override show(): void {
    if (this.element) {
      this.element.style.display = 'block';
      // Fade in
      requestAnimationFrame(() => {
        if (this.overlay) this.overlay.style.opacity = '1';
        if (this.spotlight) this.spotlight.style.opacity = '1';
        if (this.tooltip) this.tooltip.style.opacity = '1';
      });
    }
  }

  override hide(): void {
    if (this.element) {
      // Fade out
      if (this.overlay) this.overlay.style.opacity = '0';
      if (this.spotlight) this.spotlight.style.opacity = '0';
      if (this.tooltip) this.tooltip.style.opacity = '0';

      setTimeout(
        () => {
          if (this.element) {
            this.element.style.display = 'none';
          }
        },
        this.prefersReducedMotion() ? 0 : ANIMATION_DURATION
      );
    }

    // Cleanup
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.currentStep = null;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  override destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    super.destroy();
  }
}

/**
 * Initialize tutorial spotlight component
 */
export function initializeTutorialSpotlight(): TutorialSpotlight {
  const container = document.body;
  const spotlight = new TutorialSpotlight(container);
  spotlight.init();
  return spotlight;
}
