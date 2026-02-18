/**
 * Tests for auth context factories
 */
import { describe, it, expect } from 'vitest';
import {
  createAuthContext,
  createModeratorContext,
  createUnauthenticatedContext,
  createWebAuthContext,
  createBotAuthContext,
} from '../../src/auth/context.js';

describe('createAuthContext', () => {
  it('creates an authenticated user context with defaults', () => {
    const ctx = createAuthContext();

    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.isModerator).toBe(false);
    expect(ctx.userDiscordId).toBe('123456789');
    expect(ctx.userName).toBe('TestUser');
    expect(ctx.authSource).toBe('bot');
  });

  it('accepts overrides', () => {
    const ctx = createAuthContext({
      userDiscordId: '999888777',
      userName: 'CustomUser',
      isModerator: true,
    });

    expect(ctx.userDiscordId).toBe('999888777');
    expect(ctx.userName).toBe('CustomUser');
    expect(ctx.isModerator).toBe(true);
    expect(ctx.isAuthenticated).toBe(true);
  });

  it('can override authSource', () => {
    const ctx = createAuthContext({ authSource: 'web' });

    expect(ctx.authSource).toBe('web');
  });
});

describe('createModeratorContext', () => {
  it('creates a moderator context', () => {
    const ctx = createModeratorContext();

    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.isModerator).toBe(true);
    expect(ctx.userName).toBe('ModeratorUser');
    expect(ctx.authSource).toBe('bot');
  });

  it('accepts overrides', () => {
    const ctx = createModeratorContext({
      userDiscordId: '555666777',
      userName: 'SuperMod',
    });

    expect(ctx.userDiscordId).toBe('555666777');
    expect(ctx.userName).toBe('SuperMod');
    expect(ctx.isModerator).toBe(true);
  });
});

describe('createUnauthenticatedContext', () => {
  it('creates an unauthenticated context', () => {
    const ctx = createUnauthenticatedContext();

    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.isModerator).toBe(false);
    expect(ctx.authSource).toBe('none');
    expect(ctx.userDiscordId).toBeUndefined();
    expect(ctx.userName).toBeUndefined();
  });
});

describe('createWebAuthContext', () => {
  it('creates a web-authenticated context', () => {
    const ctx = createWebAuthContext();

    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.isModerator).toBe(false);
    expect(ctx.userName).toBe('WebUser');
    expect(ctx.authSource).toBe('web');
  });

  it('accepts overrides', () => {
    const ctx = createWebAuthContext({
      userDiscordId: '111222333',
      isModerator: true,
    });

    expect(ctx.userDiscordId).toBe('111222333');
    expect(ctx.isModerator).toBe(true);
    expect(ctx.authSource).toBe('web');
  });
});

describe('createBotAuthContext', () => {
  it('creates a bot-authenticated context', () => {
    const ctx = createBotAuthContext();

    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.isModerator).toBe(false);
    expect(ctx.userName).toBe('BotUser');
    expect(ctx.authSource).toBe('bot');
  });

  it('accepts overrides', () => {
    const ctx = createBotAuthContext({
      userName: 'DiscordBot',
      userDiscordId: '444555666',
    });

    expect(ctx.userName).toBe('DiscordBot');
    expect(ctx.userDiscordId).toBe('444555666');
    expect(ctx.authSource).toBe('bot');
  });
});
