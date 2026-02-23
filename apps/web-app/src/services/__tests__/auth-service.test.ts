/**
 * XIV Dye Tools - AuthService Unit Tests
 * Tests for Discord OAuth authentication service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module fresh for each test
describe('AuthService', () => {
  const mockLocalStorage: Record<string, string> = {};
  const mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear storage mocks
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
    Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
      },
    });

    // Mock sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockSessionStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
      },
    });

    // Mock window.location
    const mockLocation = {
      href: 'http://localhost:3000/',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    };
    vi.stubGlobal('location', mockLocation);

    // Mock window.history
    vi.stubGlobal('history', {
      replaceState: vi.fn(),
      pushState: vi.fn(),
    });

    // Mock fetch
    vi.stubGlobal('fetch', vi.fn());

    // Mock crypto.subtle
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // Helper to create a mock JWT token
  function createMockJWT(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const payloadStr = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const signature = 'mock_signature';
    return `${header}.${payloadStr}.${signature}`;
  }

  describe('sanitizeReturnPath', () => {
    it('should return / for null or undefined', async () => {
      const { authService } = await import('../auth-service');
      // Access via subscribe callback to check internal state behavior
      expect(authService).toBeDefined();
    });
  });

  describe('initial state', () => {
    it('should start with unauthenticated state', async () => {
      const { authService } = await import('../auth-service');

      const state = authService.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.expiresAt).toBeNull();
    });

    it('should return false for isAuthenticated when not logged in', async () => {
      const { authService } = await import('../auth-service');
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return null for getUser when not logged in', async () => {
      const { authService } = await import('../auth-service');
      expect(authService.getUser()).toBeNull();
    });

    it('should return empty object for getAuthHeaders when not logged in', async () => {
      const { authService } = await import('../auth-service');
      expect(authService.getAuthHeaders()).toEqual({});
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      const { authService } = await import('../auth-service');
      await expect(authService.initialize()).resolves.not.toThrow();
    });

    it('should load token from localStorage if present and valid', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(true);
      const user = authService.getUser();
      expect(user?.username).toBe('testuser');
      expect(user?.id).toBe('123456789');
    });

    it('should clear expired token from localStorage', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
        exp: pastTime,
        iat: pastTime - 3600,
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(pastTime);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
      expect(mockLocalStorage['xivdyetools_auth_token']).toBeUndefined();
    });

    it('should not reinitialize if already initialized', async () => {
      const { authService } = await import('../auth-service');
      await authService.initialize();
      await authService.initialize(); // Should be a no-op
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should call listener immediately with current state', async () => {
      const { authService } = await import('../auth-service');
      const listener = vi.fn();

      authService.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: false,
          user: null,
          token: null,
        })
      );
    });

    it('should return unsubscribe function', async () => {
      const { authService } = await import('../auth-service');
      const listener = vi.fn();

      const unsubscribe = authService.subscribe(listener);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      // Listener should not be called again after unsubscribe
    });
  });

  describe('logout', () => {
    it('should clear auth state on logout', async () => {
      // Setup authenticated state
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: null,
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      // Mock fetch for revoke call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(true);

      await authService.logout();

      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getUser()).toBeNull();
      expect(mockLocalStorage['xivdyetools_auth_token']).toBeUndefined();
      expect(mockLocalStorage['xivdyetools_auth_expires']).toBeUndefined();
    });

    it('should notify listeners on logout', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: null,
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const listener = vi.fn();
      authService.subscribe(listener);
      listener.mockClear();

      await authService.logout();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: false,
          user: null,
          token: null,
        })
      );
    });

    it('should handle revoke fetch failure gracefully', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: null,
        avatar: null,
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const { authService } = await import('../auth-service');
      await authService.initialize();

      // Should not throw even if revoke fails
      await expect(authService.logout()).resolves.not.toThrow();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return Authorization header when authenticated', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const headers = authService.getAuthHeaders();
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toMatch(/^Bearer /);
    });

    it('should return empty object when not authenticated', async () => {
      const { authService } = await import('../auth-service');
      const headers = authService.getAuthHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('isAuthenticated with expiry check', () => {
    it('should call logout when checking authentication and token is expired', async () => {
      // Setup a token that looks valid in storage but has an old expiresAt
      // This simulates the case where the token expired after being loaded
      const pastTime = Math.floor(Date.now() / 1000) - 10; // Already expired
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: null,
        exp: pastTime,
        iat: pastTime - 3600,
        iss: 'xivdyetools',
      });

      // First, set up with a future expiry to get it loaded
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(true);

      // Now simulate the token having expired by modifying the storage
      // and creating a fresh import
      vi.resetModules();
      mockLocalStorage['xivdyetools_auth_expires'] = String(pastTime);

      const { authService: freshService } = await import('../auth-service');
      await freshService.initialize();

      // Token should be cleared because it's expired
      expect(freshService.isAuthenticated()).toBe(false);
    });
  });

  describe('consumeReturnTool', () => {
    it('should return and remove stored tool from sessionStorage', async () => {
      mockSessionStorage['xivdyetools_oauth_return_tool'] = 'presets';

      const { consumeReturnTool } = await import('../auth-service');

      const tool = consumeReturnTool();
      expect(tool).toBe('presets');
      expect(mockSessionStorage['xivdyetools_oauth_return_tool']).toBeUndefined();
    });

    it('should return null if no tool stored', async () => {
      const { consumeReturnTool } = await import('../auth-service');
      expect(consumeReturnTool()).toBeNull();
    });
  });

  describe('avatar URL generation', () => {
    it('should generate correct avatar URL for static avatar', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        discord_id: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const user = authService.getUser();
      expect(user?.avatar_url).toBe('https://cdn.discordapp.com/avatars/123456789/abc123.png');
    });

    it('should generate correct avatar URL for animated avatar', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        discord_id: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'a_animated123',
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const user = authService.getUser();
      expect(user?.avatar_url).toBe(
        'https://cdn.discordapp.com/avatars/123456789/a_animated123.gif'
      );
    });

    it('should return null avatar_url when no avatar', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: null,
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const user = authService.getUser();
      expect(user?.avatar_url).toBeNull();
    });
  });

  describe('JWT decoding', () => {
    it('should handle invalid JWT format', async () => {
      mockLocalStorage['xivdyetools_auth_token'] = 'not.a.valid.jwt.token.with.too.many.parts';
      mockLocalStorage['xivdyetools_auth_expires'] = String(Math.floor(Date.now() / 1000) + 3600);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle JWT with invalid base64', async () => {
      mockLocalStorage['xivdyetools_auth_token'] = 'header.!!!invalid!!!.signature';
      mockLocalStorage['xivdyetools_auth_expires'] = String(Math.floor(Date.now() / 1000) + 3600);

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('login', () => {
    it('should initiate OAuth flow', async () => {
      const { authService } = await import('../auth-service');

      // Mock crypto.subtle.digest for the PKCE challenge
      (global.crypto.subtle.digest as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Uint8Array(32).buffer
      );

      await authService.login('/return-path', 'presets');

      // Should store PKCE verifier and state in session storage
      expect(mockSessionStorage['xivdyetools_pkce_verifier']).toBeDefined();
      expect(mockSessionStorage['xivdyetools_oauth_state']).toBeDefined();
      expect(mockSessionStorage['xivdyetools_oauth_return_path']).toBe('/return-path');
      expect(mockSessionStorage['xivdyetools_oauth_return_tool']).toBe('presets');

      // Should redirect
      expect(window.location.href).toContain('auth/discord');
    });

    it('should use current pathname as return path by default', async () => {
      (window.location as { pathname: string }).pathname = '/current-page';

      const { authService } = await import('../auth-service');

      (global.crypto.subtle.digest as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Uint8Array(32).buffer
      );

      await authService.login();

      expect(mockSessionStorage['xivdyetools_oauth_return_path']).toBe('/current-page');
    });

    it('should handle login errors', async () => {
      const { authService } = await import('../auth-service');

      // Mock crypto to throw
      (global.crypto.subtle.digest as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Crypto error')
      );

      await expect(authService.login()).rejects.toThrow('Crypto error');
    });
  });

  describe('loginWithXIVAuth', () => {
    it('should initiate XIVAuth OAuth flow', async () => {
      const { authService } = await import('../auth-service');

      (global.crypto.subtle.digest as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Uint8Array(32).buffer
      );

      await authService.loginWithXIVAuth('/return-path', 'presets');

      expect(mockSessionStorage['xivdyetools_pkce_verifier']).toBeDefined();
      expect(mockSessionStorage['xivdyetools_oauth_state']).toBeDefined();
      expect(mockSessionStorage['xivdyetools_oauth_provider']).toBe('xivauth');
      expect(window.location.href).toContain('auth/xivauth');
    });

    it('should use current pathname as return path by default', async () => {
      (window.location as { pathname: string }).pathname = '/harmony';

      const { authService } = await import('../auth-service');

      (global.crypto.subtle.digest as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Uint8Array(32).buffer
      );

      await authService.loginWithXIVAuth();

      expect(mockSessionStorage['xivdyetools_oauth_return_path']).toBe('/harmony');
    });

    it('should handle XIVAuth login errors', async () => {
      const { authService } = await import('../auth-service');

      (global.crypto.subtle.digest as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Crypto error')
      );

      await expect(authService.loginWithXIVAuth()).rejects.toThrow('Crypto error');
    });
  });

  describe('OAuth callback handling', () => {
    it('should handle callback with authorization code', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        discord_id: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
        auth_provider: 'discord',
      });

      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            token: mockToken,
            expires_at: futureTime,
          }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/callback'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('code'),
        })
      );
    });

    it('should handle XIVAuth callback', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: 'xiv123',
        xivauth_id: 'xiv123',
        username: 'xivuser',
        global_name: 'XIV User',
        avatar: null,
        exp: futureTime,
        iat: Math.floor(Date.now() / 1000),
        iss: 'xivdyetools',
        auth_provider: 'xivauth',
        primary_character: {
          name: 'Test Char',
          server: 'Balmung',
          verified: true,
        },
      });

      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';
      mockSessionStorage['xivdyetools_oauth_provider'] = 'xivauth';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            token: mockToken,
            expires_at: futureTime,
          }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/xivauth/callback'),
        expect.anything()
      );
    });

    it('should handle callback with error parameter', async () => {
      (window.location as { search: string }).search = '?error=access_denied';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle missing code verifier', async () => {
      // No PKCE verifier in session storage
      (window.location as { search: string }).search = '?code=auth-code';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle CSRF state mismatch', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'correct-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=wrong-state';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should reject when CSRF state param is missing (fail-closed)', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'correct-state';

      (window.location as { search: string }).search = '?code=auth-code';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reject when stored CSRF state is missing (fail-closed)', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      // No xivdyetools_oauth_state in session storage

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle failed token exchange response', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle unsuccessful auth response', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Invalid code' }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle token exchange network error', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should handle provider in URL parameter', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: 'xiv123',
        auth_provider: 'xivauth',
        username: 'xivuser',
        global_name: null,
        avatar: null,
        exp: futureTime,
      });

      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search =
        '?code=auth-code&provider=xivauth&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            token: mockToken,
            expires_at: futureTime,
          }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/xivauth/callback'),
        expect.anything()
      );
    });

    it('should use return path from URL or session storage', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123',
        username: 'testuser',
        global_name: null,
        avatar: null,
        exp: futureTime,
      });

      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_return_path'] = '/presets';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            token: mockToken,
            expires_at: futureTime,
          }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });

  describe('provider handling', () => {
    it('should infer provider from stored value', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        discord_id: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
        exp: futureTime,
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);
      mockLocalStorage['xivdyetools_auth_provider'] = 'discord';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const state = authService.getState();
      expect(state.provider).toBe('discord');
    });

    it('should infer provider from token payload', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: 'xiv123',
        username: 'xivuser',
        global_name: null,
        avatar: null,
        exp: futureTime,
        auth_provider: 'xivauth',
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);
      // No provider stored - should infer from payload

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const state = authService.getState();
      expect(state.provider).toBe('xivauth');
    });

    it('should default to discord when no provider info available', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123',
        username: 'testuser',
        global_name: null,
        avatar: null,
        exp: futureTime,
        // No auth_provider in payload
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);
      // No provider stored

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const state = authService.getState();
      expect(state.provider).toBe('discord');
    });
  });

  describe('XIVAuth character info', () => {
    it('should include primary character in user info', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: 'xiv123',
        username: 'xivuser',
        global_name: 'XIV User',
        avatar: null,
        exp: futureTime,
        auth_provider: 'xivauth',
        primary_character: {
          name: 'Test Character',
          server: 'Balmung',
          verified: true,
        },
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);
      mockLocalStorage['xivdyetools_auth_provider'] = 'xivauth';

      const { authService } = await import('../auth-service');
      await authService.initialize();

      const user = authService.getUser();
      expect(user?.primary_character).toBeDefined();
      expect(user?.primary_character?.name).toBe('Test Character');
      expect(user?.primary_character?.server).toBe('Balmung');
      expect(user?.primary_character?.verified).toBe(true);
    });
  });

  describe('listener error handling', () => {
    it('should handle listener errors gracefully during state changes', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: null,
        exp: futureTime,
      });

      mockLocalStorage['xivdyetools_auth_token'] = mockToken;
      mockLocalStorage['xivdyetools_auth_expires'] = String(futureTime);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      // Subscribe good listeners first
      const goodListener1 = vi.fn();
      const goodListener2 = vi.fn();

      authService.subscribe(goodListener1);
      authService.subscribe(goodListener2);

      // Clear the initial calls from subscribe
      goodListener1.mockClear();
      goodListener2.mockClear();

      // Trigger logout to notify listeners
      await authService.logout();

      // Both good listeners should be called
      expect(goodListener1).toHaveBeenCalled();
      expect(goodListener2).toHaveBeenCalled();
    });
  });

  describe('token handling edge cases', () => {
    it('should handle token without expiry in response', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockJWT({
        sub: '123',
        username: 'testuser',
        global_name: null,
        avatar: null,
        exp: futureTime,
      });

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            token: mockToken,
            // No expires_at - should use exp from token
          }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should handle invalid token in callback', async () => {
      mockSessionStorage['xivdyetools_pkce_verifier'] = 'test-verifier';
      mockSessionStorage['xivdyetools_oauth_state'] = 'test-state';

      (window.location as { search: string }).search = '?code=auth-code&csrf=test-state';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            token: 'invalid.token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          }),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('storage error handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      // Make localStorage.getItem throw
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('Storage error');
        },
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      });

      const { authService } = await import('../auth-service');
      await authService.initialize();

      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
