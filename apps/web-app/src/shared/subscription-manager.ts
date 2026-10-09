/**
 * XIV Dye Tools - Subscription Manager
 *
 * Utility class to manage service subscriptions lifecycle.
 * Prevents memory leaks by centralizing subscription cleanup.
 *
 * @module shared/subscription-manager
 */

/**
 * Unsubscribe function type
 */
export type Unsubscribe = () => void;

/**
 * SubscriptionManager collects subscription unsubscribe functions
 * and provides a single method to clean them all up.
 *
 * @example
 * ```typescript
 * class MyComponent extends BaseComponent {
 *   private subs = new SubscriptionManager();
 *
 *   onMount(): void {
 *     this.subs.add(ThemeService.subscribe(this.onThemeChange));
 *     this.subs.add(LanguageService.subscribe(this.onLanguageChange));
 *     this.subs.add(RouterService.subscribe(this.onRouteChange));
 *   }
 *
 *   destroy(): void {
 *     this.subs.unsubscribeAll();
 *     super.destroy();
 *   }
 * }
 * ```
 */
export class SubscriptionManager {
  private subscriptions: Unsubscribe[] = [];

  /**
   * Add an unsubscribe function to be called during cleanup.
   *
   * @param unsubscribe - Function to call to unsubscribe
   * @returns The same unsubscribe function (for chaining if needed)
   */
  add(unsubscribe: Unsubscribe): Unsubscribe {
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Call all unsubscribe functions and clear the list.
   * Safe to call multiple times.
   */
  unsubscribeAll(): void {
    for (const unsub of this.subscriptions) {
      try {
        unsub();
      } catch {
        // Silently ignore errors during cleanup
      }
    }
    this.subscriptions = [];
  }
}
