/**
 * XIV Dye Tools - Auth Button Component
 *
 * OAuth login/logout button with user display
 * Supports Discord and XIVAuth providers
 *
 * @module components/auth-button
 */

import { BaseComponent } from './base-component';
import { authService, LanguageService } from '@services/index';
import type { AuthState, AuthUser } from '@services/auth-service';
import { clearContainer } from '@shared/utils';

// Brand colors
const DISCORD_BLURPLE = '#5865F2';
const XIVAUTH_BLUE = '#3b82f6'; // Tailwind blue-500

// Discord logo SVG (simplified)
const ICON_DISCORD = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
</svg>`;

// XIVAuth logo SVG (shield with key - represents authentication)
const ICON_XIVAUTH = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
</svg>`;

/**
 * Auth button component options
 */
interface AuthButtonOptions {
  /** Tool ID to return to after login (e.g., 'presets') */
  returnTool?: string;
}

/**
 * Auth button component - Discord OAuth login/logout
 */
export class AuthButton extends BaseComponent {
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    expiresAt: null,
    provider: null,
  };
  private isDropdownOpen = false;
  private unsubscribe: (() => void) | null = null;
  private languageUnsubscribe: (() => void) | null = null;
  private returnTool: string | undefined;

  constructor(container: HTMLElement, options?: AuthButtonOptions) {
    super(container);
    this.returnTool = options?.returnTool;
  }

  /**
   * Render the auth button component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'relative',
    });

    if (this.authState.isAuthenticated && this.authState.user) {
      // Logged in state - show user info with dropdown
      wrapper.appendChild(this.renderLoggedIn(this.authState.user));
    } else {
      // Logged out state - show login button
      wrapper.appendChild(this.renderLoggedOut());
    }

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Render logged out state - Login buttons (Discord + XIVAuth)
   */
  private renderLoggedOut(): HTMLElement {
    const container = this.createElement('div', {
      className: 'flex flex-col sm:flex-row gap-2',
    });

    // Discord login button
    const discordBtn = this.createElement('button', {
      id: 'auth-login-discord-btn',
      className:
        'flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90',
      attributes: {
        style: `background-color: ${DISCORD_BLURPLE};`,
        'aria-label': LanguageService.t('auth.loginWithDiscord'),
      },
    });
    discordBtn.innerHTML = `${ICON_DISCORD}<span class="hidden sm:inline">Discord</span><span class="sm:hidden">Discord</span>`;

    // XIVAuth login button
    const xivauthBtn = this.createElement('button', {
      id: 'auth-login-xivauth-btn',
      className:
        'flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90',
      attributes: {
        style: `background-color: ${XIVAUTH_BLUE};`,
        'aria-label': LanguageService.t('auth.loginWithXIVAuth'),
      },
    });
    xivauthBtn.innerHTML = `${ICON_XIVAUTH}<span class="hidden sm:inline">XIVAuth</span><span class="sm:hidden">XIVAuth</span>`;

    container.appendChild(discordBtn);
    container.appendChild(xivauthBtn);

    return container;
  }

  /**
   * Render logged in state - User avatar with dropdown
   */
  private renderLoggedIn(user: AuthUser): HTMLElement {
    const container = this.createElement('div', {
      className: 'relative',
    });

    // User button (avatar + name)
    const button = this.createElement('button', {
      id: 'auth-user-btn',
      className: 'flex items-center gap-2 px-2 py-1 rounded-lg transition-colors border',
      attributes: {
        style: 'border-color: var(--theme-border); color: var(--theme-text);',
        'aria-label': LanguageService.t('auth.userMenu'),
        'aria-haspopup': 'true',
        'aria-expanded': String(this.isDropdownOpen),
      },
    });

    // Avatar
    const avatar = this.createElement('div', {
      className: 'w-8 h-8 rounded-full overflow-hidden bg-gray-300 flex-shrink-0',
    });

    if (user.avatar_url) {
      const img = this.createElement('img', {
        className: 'w-full h-full object-cover',
        attributes: {
          src: user.avatar_url,
          alt: user.global_name || user.username,
        },
      });
      avatar.appendChild(img);
    } else {
      // Default avatar with initials
      avatar.className =
        'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium';
      avatar.style.backgroundColor = DISCORD_BLURPLE;
      avatar.textContent = (user.global_name || user.username).charAt(0).toUpperCase();
    }

    // Username (hidden on mobile)
    const username = this.createElement('span', {
      className: 'hidden sm:inline text-sm font-medium max-w-[120px] truncate',
      textContent: user.global_name || user.username,
    });

    // Dropdown arrow
    const arrow = this.createElement('span', {
      className: 'text-xs transition-transform',
      attributes: {
        style: this.isDropdownOpen ? 'transform: rotate(180deg);' : '',
      },
      textContent: '▼',
    });

    button.appendChild(avatar);
    button.appendChild(username);
    button.appendChild(arrow);

    // Dropdown menu
    const dropdown = this.createElement('div', {
      id: 'auth-dropdown',
      className: `absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50 ${this.isDropdownOpen ? '' : 'hidden'}`,
      attributes: {
        style: 'background-color: var(--theme-card-background); border-color: var(--theme-border);',
      },
    });

    // User info header
    const header = this.createElement('div', {
      className: 'px-4 py-3 border-b',
      attributes: {
        style: 'border-color: var(--theme-border);',
      },
    });

    const headerName = this.createElement('div', {
      className: 'font-medium text-sm',
      textContent: user.global_name || user.username,
      attributes: {
        style: 'color: var(--theme-text);',
      },
    });

    const headerUsername = this.createElement('div', {
      className: 'text-xs opacity-70',
      textContent: `@${user.username}`,
      attributes: {
        style: 'color: var(--theme-text);',
      },
    });

    header.appendChild(headerName);
    header.appendChild(headerUsername);

    // Show character info for XIVAuth users
    if (user.auth_provider === 'xivauth' && user.primary_character) {
      const characterInfo = this.createElement('div', {
        className: 'text-xs mt-1 flex items-center gap-1',
        attributes: {
          style: 'color: var(--theme-text); opacity: 0.7;',
        },
      });
      characterInfo.innerHTML = `<span>${user.primary_character.name}</span><span class="opacity-50">@</span><span>${user.primary_character.server}</span>${user.primary_character.verified ? `<span class="text-green-500 ml-1" title="${LanguageService.t('auth.verified')}">✓</span>` : ''}`;
      header.appendChild(characterInfo);
    }

    // Menu items
    const menu = this.createElement('div', {
      className: 'py-1',
    });

    // Logout button
    const logoutBtn = this.createElement('button', {
      id: 'auth-logout-btn',
      className: 'w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2',
      attributes: {
        style: 'color: var(--theme-text);',
      },
    });
    logoutBtn.innerHTML = `<span class="text-red-500">↩</span> ${LanguageService.t('auth.logout')}`;

    // Add hover effect
    logoutBtn.addEventListener('mouseenter', () => {
      logoutBtn.style.backgroundColor = 'var(--theme-card-hover)';
    });
    logoutBtn.addEventListener('mouseleave', () => {
      logoutBtn.style.backgroundColor = 'transparent';
    });

    menu.appendChild(logoutBtn);

    dropdown.appendChild(header);
    dropdown.appendChild(menu);

    container.appendChild(button);
    container.appendChild(dropdown);

    return container;
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Discord login button click
    const discordBtn = this.querySelector<HTMLButtonElement>('#auth-login-discord-btn');
    if (discordBtn) {
      this.on(discordBtn, 'click', () => {
        authService.login(undefined, this.returnTool);
      });
    }

    // XIVAuth login button click
    const xivauthBtn = this.querySelector<HTMLButtonElement>('#auth-login-xivauth-btn');
    if (xivauthBtn) {
      this.on(xivauthBtn, 'click', () => {
        authService.loginWithXIVAuth(undefined, this.returnTool);
      });
    }

    // User button click (toggle dropdown)
    const userBtn = this.querySelector<HTMLButtonElement>('#auth-user-btn');
    const dropdown = this.querySelector<HTMLDivElement>('#auth-dropdown');

    if (userBtn && dropdown) {
      this.on(userBtn, 'click', (event) => {
        event.stopPropagation();
        this.isDropdownOpen = !this.isDropdownOpen;
        dropdown.classList.toggle('hidden', !this.isDropdownOpen);
        userBtn.setAttribute('aria-expanded', String(this.isDropdownOpen));

        // Update arrow rotation
        const arrow = userBtn.querySelector('span:last-child');
        if (arrow) {
          (arrow as HTMLElement).style.transform = this.isDropdownOpen ? 'rotate(180deg)' : '';
        }
      });
    }

    // Logout button click
    const logoutBtn = this.querySelector<HTMLButtonElement>('#auth-logout-btn');
    if (logoutBtn) {
      this.on(logoutBtn, 'click', async () => {
        await authService.logout();
        // State will update via subscription
      });
    }

    // Close dropdown when clicking outside
    this.on(document, 'click', (event) => {
      if (this.isDropdownOpen && this.element && !this.element.contains(event.target as Node)) {
        this.isDropdownOpen = false;
        const dropdown = this.querySelector<HTMLDivElement>('#auth-dropdown');
        if (dropdown) {
          dropdown.classList.add('hidden');
        }
        const userBtn = this.querySelector<HTMLButtonElement>('#auth-user-btn');
        if (userBtn) {
          userBtn.setAttribute('aria-expanded', 'false');
          const arrow = userBtn.querySelector('span:last-child');
          if (arrow) {
            (arrow as HTMLElement).style.transform = '';
          }
        }
      }
    });

    // Close dropdown on Escape key
    this.on(document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.isDropdownOpen) {
        this.isDropdownOpen = false;
        this.update();
      }
    });
  }

  /**
   * Subscribe to auth state changes on mount
   */
  onMount(): void {
    // Get initial state
    this.authState = authService.getState();

    // Subscribe to auth changes
    this.unsubscribe = authService.subscribe((state) => {
      this.authState = state;
      this.isDropdownOpen = false; // Close dropdown on state change
      this.update();
    });

    // Subscribe to language changes (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });
  }

  /**
   * Cleanup subscriptions on unmount
   */
  onUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    // Clean up language subscription to prevent memory leaks
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      isAuthenticated: this.authState.isAuthenticated,
      user: this.authState.user,
      isDropdownOpen: this.isDropdownOpen,
    };
  }
}
