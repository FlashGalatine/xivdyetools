/**
 * Tests for /collection command handler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCollectionCommand } from './collection.js';
import type { DiscordInteraction, Env, InteractionResponseBody } from '../../types/env.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const dyeSnow = { id: 1, name: 'Snow White', hex: '#ffffff', category: 'General', itemID: 5001 };
const dyeBlack = { id: 2, name: 'Soot Black', hex: '#000000', category: 'General', itemID: 5002 };

vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    searchByName(query: string) {
      if (query.toLowerCase().includes('snow')) return [dyeSnow];
      return [];
    }
    findClosestDye(hex: string) {
      return hex ? dyeBlack : null;
    }
    getDyeById(id: number) {
      if (id === dyeSnow.id) return dyeSnow;
      if (id === dyeBlack.id) return dyeBlack;
      return null;
    }
  }
  return { DyeService: MockDyeService, dyeDatabase: [] };
});

vi.mock('../../services/emoji.js', () => ({ getDyeEmoji: () => '🎨' }));
vi.mock('../../services/i18n.js', () => ({
  initializeLocale: vi.fn().mockResolvedValue(undefined),
  getLocalizedDyeName: (_id: number, name: string) => `${name}-loc`,
  discordLocaleToLocaleCode: () => 'en',
}));

// User storage functions to be controlled per test
const mockStorage = vi.hoisted(() => ({
  getCollections: vi.fn(),
  getCollection: vi.fn(),
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  renameCollection: vi.fn(),
  addDyeToCollection: vi.fn(),
  removeDyeFromCollection: vi.fn(),
}));

vi.mock('../../services/user-storage.js', () => ({
  ...mockStorage,
  MAX_COLLECTIONS: 5,
  MAX_DYES_PER_COLLECTION: 10,
  MAX_COLLECTION_NAME_LENGTH: 20,
}));

vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: vi.fn(async () => translator),
  createTranslator: () => translator,
}));

// ---------------------------------------------------------------------------
// Translator stub
// ---------------------------------------------------------------------------
const translator = {
  t: (key: string, vars?: Record<string, any>) => {
    const table: Record<string, string> = {
      'errors.userNotFound': 'user not found',
      'errors.missingSubcommand': 'missing subcommand',
      'errors.unknownSubcommand': `unknown subcommand: ${vars?.name}`,
      'errors.missingName': 'missing name',
      'errors.missingInput': 'missing input',
      'errors.dyeNotFound': `dye not found: ${vars?.name}`,
      'errors.failedToSave': 'failed to save',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.dye': 'Dye',
      'common.dyes': 'dyes',
      'common.createdAt': 'Created',
      'collection.created': `created ${vars?.name}`,
      'collection.nameTooLong': `name too long (${vars?.max})`,
      'collection.alreadyExists': `collection exists: ${vars?.name}`,
      'collection.limitReached': `collection limit ${vars?.max}`,
      'collection.notFound': `collection not found: ${vars?.name}`,
      'collection.dyeAlreadyInCollection': `${vars?.dye} already in ${vars?.collection}`,
      'collection.dyeLimitReached': `dye limit ${vars?.max}`,
      'collection.dyeAdded': `${vars?.dye} added to ${vars?.collection}`,
      'collection.dyeRemoved': `${vars?.dye} removed from ${vars?.collection}`,
      'collection.dyeNotInCollection': `${vars?.dye} not in ${vars?.collection}`,
      'collection.collectionEmpty': 'collection empty',
      'collection.addDyeHint': `add more to ${vars?.name}`,
      'collection.title': 'Collections',
      'collection.empty': 'no collections',
      'collection.createHint': 'use /collection create',
      'collection.showHint': 'use /collection show',
      'collection.renamed': `${vars?.oldName} -> ${vars?.newName}`,
    };
    return table[key] ?? key;
  },
  getLocale: () => 'en',
};

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------
const env: Env = {
  KV: {} as KVNamespace,
  DISCORD_PUBLIC_KEY: 'pk',
  DISCORD_CLIENT_ID: 'app',
  DISCORD_TOKEN: 'token',
  PRESETS_API_URL: 'https://test-api.example.com',
} as unknown as Env;

const ctx: ExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
} as unknown as ExecutionContext;

const baseInteraction: DiscordInteraction = {
  id: 'test-interaction',
  application_id: 'test-app-id',
  token: 'test-token',
  type: 2,
  data: { name: 'collection', options: [] },
  locale: 'en-US',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/collection command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when user is missing', async () => {
    const res = await handleCollectionCommand({ ...baseInteraction }, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('user not found');
  });

  it('returns error when subcommand missing', async () => {
    const interaction = { ...baseInteraction, member: { user: { id: 'u1', username: 't' } } };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('subcommand');
  });

  it('returns error for unknown subcommand', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'mystery', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('Unknown subcommand');
  });

  it('creates a collection successfully', async () => {
    mockStorage.createCollection.mockResolvedValueOnce({ success: true });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('created MyCol');
  });

  it('adds dye and handles alreadyExists', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: false, reason: 'alreadyExists' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [
          { type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] },
        ],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('is already in **MyCol**');
  });

  it('shows empty collection info', async () => {
    mockStorage.getCollection.mockResolvedValueOnce({ name: 'MyCol', description: 'desc', dyes: [], createdAt: Date.now() });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'show', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection empty');
  });

  it('lists empty collections', async () => {
    mockStorage.getCollections.mockResolvedValueOnce([]);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'list', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('no collections');
  });

  it('renames collection not found', async () => {
    mockStorage.renameCollection.mockResolvedValueOnce({ success: false, reason: 'notFound' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'rename', options: [{ name: 'name', value: 'Old' }, { name: 'new_name', value: 'New' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection not found');
  });

  // Additional create tests
  it('handles create with nameTooLong error', async () => {
    mockStorage.createCollection.mockResolvedValueOnce({ success: false, reason: 'nameTooLong' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [{ name: 'name', value: 'VeryLongCollectionName' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('name too long');
  });

  it('handles create with alreadyExists error', async () => {
    mockStorage.createCollection.mockResolvedValueOnce({ success: false, reason: 'alreadyExists' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection exists');
  });

  it('handles create with limitReached error', async () => {
    mockStorage.createCollection.mockResolvedValueOnce({ success: false, reason: 'limitReached' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [{ name: 'name', value: 'NewCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection limit');
  });

  it('handles create with generic failure', async () => {
    mockStorage.createCollection.mockResolvedValueOnce({ success: false, reason: 'unknown' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('failed to save');
  });

  it('handles create with missing name', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('missing name');
  });

  it('handles create with description', async () => {
    mockStorage.createCollection.mockResolvedValueOnce({ success: true });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'create', options: [{ name: 'name', value: 'MyCol' }, { name: 'description', value: 'My awesome collection' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('created MyCol');
    expect(body.data!.embeds![0].description).toContain('My awesome collection');
  });

  // Delete tests
  it('handles delete missing name', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'delete', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('missing name');
  });

  it('handles delete success', async () => {
    mockStorage.deleteCollection.mockResolvedValueOnce(true);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'delete', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].title).toContain('Success');
  });

  it('handles delete not found', async () => {
    mockStorage.deleteCollection.mockResolvedValueOnce(false);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'delete', options: [{ name: 'name', value: 'Missing' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection not found');
  });

  // Add tests
  it('handles add missing input', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'add', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('missing input');
  });

  it('handles add dye not found', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'NotARealDye' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('dye not found');
  });

  it('handles add with hex color', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: true });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: '#FF0000' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('added to MyCol');
  });

  it('handles add with hex color without hash', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: true });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'FF0000' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('added to MyCol');
  });

  it('handles add success', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: true });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('added to MyCol');
  });

  it('handles add notFound error', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: false, reason: 'notFound' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection not found');
  });

  it('handles add limitReached error', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: false, reason: 'limitReached' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('dye limit');
  });

  it('handles add generic failure', async () => {
    mockStorage.addDyeToCollection.mockResolvedValueOnce({ success: false, reason: 'unknown' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'add', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('failed to save');
  });

  // Remove tests
  it('handles remove missing input', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'remove', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('missing input');
  });

  it('handles remove dye not found', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'remove', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'NotARealDye' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('dye not found');
  });

  it('handles remove success', async () => {
    mockStorage.removeDyeFromCollection.mockResolvedValueOnce(true);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'remove', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('removed from MyCol');
  });

  it('handles remove not in collection', async () => {
    mockStorage.removeDyeFromCollection.mockResolvedValueOnce(false);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'remove', options: [{ name: 'name', value: 'MyCol' }, { name: 'dye', value: 'Snow White' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('is not in **MyCol**');
  });

  // Show tests
  it('handles show missing name', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'show', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('missing name');
  });

  it('handles show not found', async () => {
    mockStorage.getCollection.mockResolvedValueOnce(null);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'show', options: [{ name: 'name', value: 'Missing' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection not found');
  });

  it('handles show with dyes', async () => {
    mockStorage.getCollection.mockResolvedValueOnce({
      name: 'MyCol',
      description: 'A cool collection',
      dyes: [1, 2],
      createdAt: Date.now(),
    });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'show', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].title).toContain('MyCol');
    expect(body.data!.embeds![0].description).toContain('Snow White-loc');
    expect(body.data!.embeds![0].description).toContain('A cool collection');
  });

  it('handles show empty without description', async () => {
    mockStorage.getCollection.mockResolvedValueOnce({
      name: 'MyCol',
      dyes: [],
      createdAt: Date.now(),
    });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'show', options: [{ name: 'name', value: 'MyCol' }] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection empty');
  });

  // List tests
  it('handles list with collections', async () => {
    mockStorage.getCollections.mockResolvedValueOnce([
      { name: 'Col1', description: 'First collection', dyes: [1], createdAt: Date.now() },
      { name: 'Col2', description: 'A very long description that should be truncated for display', dyes: [1, 2], createdAt: Date.now() },
      { name: 'Col3', dyes: [], createdAt: Date.now() },
    ]);
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'list', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].title).toContain('Collections');
    expect(body.data!.embeds![0].description).toContain('Col1');
    expect(body.data!.embeds![0].description).toContain('Col2');
    expect(body.data!.embeds![0].description).toContain('Col3');
    expect(body.data!.embeds![0].description).toContain('1 Dye'); // singular
    expect(body.data!.embeds![0].description).toContain('2 dyes'); // plural
  });

  // Rename tests
  it('handles rename missing input', async () => {
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: { ...baseInteraction.data, options: [{ type: 1, name: 'rename', options: [] }] },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('missing input');
  });

  it('handles rename success', async () => {
    mockStorage.renameCollection.mockResolvedValueOnce({ success: true });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'rename', options: [{ name: 'name', value: 'OldName' }, { name: 'new_name', value: 'NewName' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('OldName');
    expect(body.data!.embeds![0].description).toContain('NewName');
  });

  it('handles rename nameTooLong', async () => {
    mockStorage.renameCollection.mockResolvedValueOnce({ success: false, reason: 'nameTooLong' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'rename', options: [{ name: 'name', value: 'Old' }, { name: 'new_name', value: 'VeryLongName' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('name too long');
  });

  it('handles rename alreadyExists', async () => {
    mockStorage.renameCollection.mockResolvedValueOnce({ success: false, reason: 'alreadyExists' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'rename', options: [{ name: 'name', value: 'Old' }, { name: 'new_name', value: 'Existing' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('collection exists');
  });

  it('handles rename generic failure', async () => {
    mockStorage.renameCollection.mockResolvedValueOnce({ success: false, reason: 'unknown' });
    const interaction: DiscordInteraction = {
      ...baseInteraction,
      member: { user: { id: 'u1', username: 't' } },
      data: {
        ...baseInteraction.data,
        options: [{ type: 1, name: 'rename', options: [{ name: 'name', value: 'Old' }, { name: 'new_name', value: 'New' }] }],
      },
    };
    const res = await handleCollectionCommand(interaction, env, ctx);
    const body = (await res.json()) as InteractionResponseBody;
    expect(body.data!.embeds![0].description).toContain('failed to save');
  });
});
