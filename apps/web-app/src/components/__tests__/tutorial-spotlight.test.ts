/**
 * XIV Dye Tools - TutorialSpotlight Unit Tests
 *
 * BUG-106 (2026-10-04 deep-dive): the spotlight re-measured its target on
 * window scroll only. The shell host is height: 100vh with overflow: hidden,
 * so every tool scrolls inside a container in a shadow root
 * (.v4-layout-content-scroll, .v4-tool-main, the palette drawer's list), and
 * element scroll events neither bubble nor cross a shadow boundary -- window
 * never hears them. A step whose target sat near the viewport edge was
 * smooth-scrolled into view, measured once at a fixed 100 ms mid-scroll, and
 * the highlight and tooltip stayed on that stale rect.
 *
 * The scrollers below sit inside a shadow root and get a plain, non-bubbling
 * `scroll` event, like a real element scroll; a bubbling light-DOM dispatch
 * would reach the window listener and pass without the fix.
 *
 * @module components/__tests__/tutorial-spotlight.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@services/tutorial-service', () => ({
  TutorialService: {
    subscribe: vi.fn(() => () => {}),
    getState: vi.fn(() => ({ isActive: true })),
    next: vi.fn(),
    previous: vi.fn(),
    skip: vi.fn(),
  },
}));

import { TutorialSpotlight } from '../tutorial-spotlight';
import { ToastContainer } from '../toast-container';
import { TutorialService, type TutorialStep } from '@services/tutorial-service';
import { ModalService } from '@services/modal-service';
import { ToastService } from '@services/toast-service';
import { KeyboardService } from '@services/keyboard-service';
import { RouterService } from '@services/router-service';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** A scroll container, as the shell's are: inline overflow so jsdom computes it. */
function scroller(): HTMLElement {
  const el = document.createElement('div');
  el.style.overflowY = 'auto';
  return el;
}

function rectAt(top: number): DOMRect {
  return {
    top,
    bottom: top + 40,
    left: 100,
    right: 300,
    width: 200,
    height: 40,
    x: 100,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('TutorialSpotlight — scrolling inside the shell (BUG-106)', () => {
  let page: HTMLElement;
  let outer: HTMLElement;
  let inner: HTMLElement;
  let plain: HTMLElement;
  let target: HTMLElement;
  let top: number;
  let spotlight: TutorialSpotlight;

  const spotlightTop = (): string =>
    (document.querySelector('.tutorial-spotlight') as HTMLElement).style.top;

  function showStep(selector = '.swatch-grid'): void {
    const step: TutorialStep = {
      id: 'step-1',
      target: selector,
      titleKey: 'tutorial.next',
      descriptionKey: 'tutorial.next',
      position: 'bottom',
    };
    document.dispatchEvent(
      new CustomEvent('tutorial:show-step', { detail: { step, stepIndex: 0, totalSteps: 2 } })
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', StubResizeObserver);
    // jsdom has no scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    // page > outer (light-DOM scroller) > shell host #shadow > inner
    // (shadow scroller) > plain (no overflow) > target
    page = document.createElement('div');
    outer = scroller();
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    inner = scroller();
    plain = document.createElement('div');
    target = document.createElement('div');
    target.className = 'swatch-grid';
    plain.appendChild(target);
    inner.appendChild(plain);
    root.appendChild(inner);
    outer.appendChild(host);
    page.appendChild(outer);
    document.body.appendChild(page);

    // Near the bottom edge: the step smooth-scrolls it into view
    top = 700;
    target.getBoundingClientRect = () => rectAt(top);

    spotlight = new TutorialSpotlight(document.body);
    spotlight.init();
  });

  afterEach(() => {
    spotlight.destroy();
    page.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('measures once at 100 ms (the starting point the bug left it at)', () => {
    showStep();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(spotlightTop()).toBe('692px');
  });

  it('follows a scroll container inside a shadow root as it settles', () => {
    showStep();
    vi.advanceTimersByTime(100); // measured mid-scroll

    top = 300; // the smooth scroll lands
    inner.dispatchEvent(new Event('scroll'));

    expect(spotlightTop()).toBe('292px');
  });

  it('follows a scroll container outside the shadow root that holds the target', () => {
    showStep();
    vi.advanceTimersByTime(100);

    top = 420;
    outer.dispatchEvent(new Event('scroll'));

    expect(spotlightTop()).toBe('412px');
  });

  it('listens only on ancestors that can scroll', () => {
    const plainAdd = vi.spyOn(plain, 'addEventListener');
    showStep();
    expect(plainAdd).not.toHaveBeenCalledWith('scroll', expect.anything(), expect.anything());
  });

  it('stops listening when the tutorial ends', () => {
    showStep();
    const innerRemove = vi.spyOn(inner, 'removeEventListener');
    const outerRemove = vi.spyOn(outer, 'removeEventListener');

    document.dispatchEvent(new CustomEvent('tutorial:end'));

    expect(innerRemove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(outerRemove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('drops the previous step’s scrollers when the next step shows', () => {
    showStep();
    const innerRemove = vi.spyOn(inner, 'removeEventListener');

    // The next target is not found -- the old listeners must still go
    showStep('.not-in-the-page');

    expect(innerRemove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('stops listening on destroy', () => {
    showStep();
    const innerRemove = vi.spyOn(inner, 'removeEventListener');

    spotlight.destroy();

    expect(innerRemove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});

/*
 * The spotlight is a full-screen role=dialog overlay, but it never told the
 * page so. The shortcuts stand down only while ModalService.hasOpenModals()
 * is true, so a digit switched tools under the overlay (leaving the spotlight
 * on a target that had gone) and "/" sent focus to the dye search behind it.
 * And its Escape skipped the tour without marking the key handled, so the
 * same press also dismissed a dismissible toast (BUG-105's one-layer rule).
 */
describe('TutorialSpotlight — an overlay the rest of the page stands down for', () => {
  type Listener = Parameters<typeof TutorialService.subscribe>[0];
  type State = Parameters<Listener>[0];
  const ACTIVE: State = {
    isActive: true,
    currentTool: 'harmony',
    currentStepIndex: 0,
    totalSteps: 2,
  };
  const ENDED: State = { isActive: false, currentTool: null, currentStepIndex: 0, totalSteps: 0 };

  let spotlight: TutorialSpotlight;
  let notify: Listener;
  let target: HTMLElement;

  /** Start a tour the way TutorialService does: state first, then the step. */
  function startTour(): void {
    notify(ACTIVE);
    const step: TutorialStep = {
      id: 'step-1',
      target: '.swatch-grid',
      titleKey: 'tutorial.next',
      descriptionKey: 'tutorial.next',
    };
    document.dispatchEvent(
      new CustomEvent('tutorial:show-step', { detail: { step, stepIndex: 0, totalSteps: 2 } })
    );
  }

  const escape = (): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', StubResizeObserver);
    Element.prototype.scrollIntoView = vi.fn();
    target = document.createElement('div');
    target.className = 'swatch-grid';
    document.body.appendChild(target);

    spotlight = new TutorialSpotlight(document.body);
    spotlight.init();
    notify = vi.mocked(TutorialService.subscribe).mock.lastCall![0];
    // As the real service does: skipping ends the tour and tells subscribers,
    // so the spotlight hides in the middle of the Escape's dispatch
    vi.mocked(TutorialService.skip).mockImplementation(() => notify(ENDED));
  });

  afterEach(() => {
    spotlight.destroy();
    target.remove();
    vi.mocked(TutorialService.skip).mockReset();
    vi.unstubAllGlobals();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('holds the page-wide shortcuts off while a step shows, a digit included', () => {
    const navigate = vi.spyOn(RouterService, 'navigateTo').mockImplementation(() => {});
    KeyboardService.initialize();
    try {
      startTour();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

      expect(ModalService.hasOpenModals()).toBe(true);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      KeyboardService.destroy();
      navigate.mockRestore();
    }
  });

  it('registers once however many steps show', () => {
    startTour();
    notify({ ...ACTIVE, currentStepIndex: 1 }); // next()
    notify(ACTIVE); // previous()

    notify(ENDED);

    expect(ModalService.hasOpenModals()).toBe(false);
  });

  // A leaked registration would switch every shortcut off until a reload
  it('lets the shortcuts back on when the tour ends', () => {
    startTour();
    expect(ModalService.hasOpenModals()).toBe(true);

    notify(ENDED);
    document.dispatchEvent(new CustomEvent('tutorial:end'));

    expect(ModalService.hasOpenModals()).toBe(false);
  });

  it('lets the shortcuts back on when destroyed mid-tour', () => {
    startTour();

    spotlight.destroy();

    expect(ModalService.hasOpenModals()).toBe(false);
  });

  it('skips the tour on Escape and marks the key handled', () => {
    startTour();

    const event = escape();

    expect(TutorialService.skip).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(ModalService.hasOpenModals()).toBe(false);
  });

  it('closes only the tour when a dismissible toast is showing too', () => {
    const toastHost = createTestContainer('toast-host-under-test');
    const toasts = new ToastContainer(toastHost);
    toasts.init();
    try {
      ToastService.error('Error!'); // dismissible
      startTour();

      escape();

      expect(TutorialService.skip).toHaveBeenCalledTimes(1);
      expect(toastHost.querySelectorAll('[data-toast-id]')).toHaveLength(1);
    } finally {
      ToastService.dismissAll();
      toasts.destroy();
      cleanupTestContainer(toastHost);
    }
  });

  it('leaves Escape alone when no tour is running', () => {
    vi.mocked(TutorialService.getState).mockReturnValueOnce(ENDED);

    const event = escape();

    expect(TutorialService.skip).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
