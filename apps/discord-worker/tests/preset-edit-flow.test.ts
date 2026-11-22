import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import presetsApi from '../../presets-api/src/index.js';
import { SqliteD1 } from '../../presets-api/tests/sqlite-d1.js';
import { createMockEnv as createPresetsEnv } from '../../presets-api/tests/test-utils.js';
import discord from '../src/index.js';
import { createMockEnv as createDiscordEnv } from '../src/test-utils.js';
import { InteractionResponseType, InteractionType } from '../src/types/env.js';
import type { DiscordInteraction, Env, InteractionResponseBody } from '../src/types/env.js';
import { MessageFlags } from '../src/utils/response.js';
import type { DiscordEmbed } from '../src/utils/response.js';

// Keep the actual command and embed generation. PNG rendering needs Wrangler's WASM loader.
vi.mock('../src/services/svg/renderer.js', () => ({
  renderSvgToPng: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
}));

const owner = '123456789123456789';
const otherOwner = '246813579246813579';
const moderator = '135792468135792468';
const botSecret = 'test-only-presets-api-bearer';
const signingSecret = 'test-only-presets-api-signing-secret';
const basePath = '/api/v1/presets';
const schema = readFileSync(new URL('../../presets-api/schema.sql', import.meta.url), 'utf8');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
const pending = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Moonflower Dawn', status: 'pending', author: owner,
};
const rejected = {
  id: '00000000-0000-4000-8000-000000000002', name: 'Moonflower Dusk', status: 'rejected', author: owner,
};
const foreign = {
  id: '00000000-0000-4000-8000-000000000003', name: 'Moonflower Private', status: 'pending', author: otherOwner,
};
const approved = {
  id: '00000000-0000-4000-8000-000000000004', name: 'Moonflower Gallery', status: 'approved', author: otherOwner,
};
const originalDescription = 'The original palette description.';
const editedDescription = 'An updated description for moderation.';

describe('Discord preset selection through Presets API and SQLite', () => {
  let db: SqliteD1;
  let env: Env;
  const background: Promise<unknown>[] = [];
  const context = {
    waitUntil(work: Promise<unknown>) {
      background.push(work);
    },
    passThroughOnException: () => {},
    props: {},
  };
  const apiCalls: Array<{
    method: string;
    path: string;
    query: string;
    actor: string | null;
    signed: boolean;
    status: number;
  }> = [];
  const replies: Array<{ embeds: DiscordEmbed[] }> = [];

  beforeEach(async () => {
    db = new SqliteD1(schema);
    const presetsEnv = createPresetsEnv({
      DB: db as unknown as D1Database,
      MODERATOR_IDS: moderator,
      BOT_API_SECRET: botSecret,
      BOT_SIGNING_SECRET: signingSecret,
      INTERNAL_WEBHOOK_SECRET: 'test-only-local-notification-secret',
      DISCORD_WORKER: {
        fetch: async () => new Response(null, { status: 204 }),
      } as unknown as Fetcher,
    });
    env = createDiscordEnv({
      DISCORD_PUBLIC_KEY: rawPublicKey,
      BOT_API_SECRET: botSecret,
      BOT_SIGNING_SECRET: signingSecret,
      PRESETS_API: {
        async fetch(request: Request) {
          const url = new URL(request.url);
          const response = await presetsApi.fetch(request, presetsEnv, context);
          apiCalls.push({
            method: request.method,
            path: url.pathname,
            query: url.search,
            actor: request.headers.get('X-User-Discord-ID'),
            signed: request.headers.has('X-Request-Signature-V2'),
            status: response.status,
          });
          return response;
        },
      } as Fetcher,
    });
    await env.KV.put(`firstrun:v5:${owner}`, '1');
    await db.batch([pending, rejected, foreign, approved].map(({ id, name, status, author }) =>
      db.prepare(`
        INSERT INTO presets (id, name, status, author_discord_id, category_id, description, dyes, tags)
        VALUES (?, ?, ?, ?, 'jobs', ?, '[1,2,3]', '[]')
      `).bind(id, name, status, author, originalDescription),
    ));

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      expect(request.method).toBe('PATCH');
      expect(request.url).toBe(
        `https://discord.com/api/v10/webhooks/${env.DISCORD_CLIENT_ID}/local-token/messages/@original`,
      );
      const payloadJson = init?.body instanceof FormData
        ? init.body.get('payload_json')
        : await request.text();
      if (typeof payloadJson !== 'string') throw new Error('Expected Discord response JSON');
      const payload = JSON.parse(payloadJson) as { embeds: DiscordEmbed[] };
      replies.push(payload);
      return new Response(null, { status: 204 });
    });
  });

  afterEach(() => {
    db.close();
    apiCalls.length = 0;
    replies.length = 0;
    vi.restoreAllMocks();
  });

  async function interact(subcommand: 'edit' | 'show', value: string, autocomplete = false) {
    const interaction: DiscordInteraction = {
      id: crypto.randomUUID(),
      application_id: env.DISCORD_CLIENT_ID,
      token: 'local-token',
      type: autocomplete ? InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE : InteractionType.APPLICATION_COMMAND,
      locale: 'en-US',
      user: { id: owner, username: 'Owner' },
      data: {
        name: 'preset',
        options: [{
          name: subcommand,
          type: 1,
          options: [
            { name: subcommand === 'edit' ? 'preset' : 'name', type: 3, value, focused: autocomplete },
            ...(!autocomplete && subcommand === 'edit'
              ? [{ name: 'description', type: 3, value: editedDescription }]
              : []),
          ],
        }],
      },
    };
    const body = JSON.stringify(interaction);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await discord.request('/', {
      method: 'POST',
      headers: {
        'X-Signature-Timestamp': timestamp,
        'X-Signature-Ed25519': sign(null, Buffer.from(timestamp + body), privateKey).toString('hex'),
      },
      body,
    }, env, context);
    // The API can enqueue moderation notifications while the deferred command runs.
    while (background.length) await Promise.all(background.splice(0));
    expect(response.status).toBe(200);
    return (await response.json()) as InteractionResponseBody;
  }

  function readPreset(id: string) {
    return db.prepare('SELECT description, status, content_revision FROM presets WHERE id = ?')
      .bind(id).first();
  }

  it.each([pending, rejected])('edits the UUID offered for an owned $status preset', async (preset) => {
    const result = await interact('edit', 'Moonflower', true);
    expect(result.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
    expect(result.data?.choices?.map(({ value }) => value).sort()).toEqual([pending.id, rejected.id]);
    const selection = result.data?.choices?.find(({ name }) => name.startsWith(preset.name));
    expect(selection).toMatchObject({ value: preset.id });

    const acknowledgement = await interact('edit', selection!.value);

    expect(await readPreset(preset.id)).toEqual({
      description: editedDescription,
      status: 'pending',
      content_revision: 1,
    });
    expect(acknowledgement).toEqual({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: MessageFlags.EPHEMERAL },
    });
    expect(apiCalls).toEqual([
      {
        method: 'GET', path: `${basePath}/mine/suggestions`, query: '?q=Moonflower',
        actor: owner, signed: true, status: 200,
      },
      {
        method: 'GET', path: `${basePath}/${preset.id}`, query: '',
        actor: owner, signed: true, status: 200,
      },
      {
        method: 'PATCH', path: `${basePath}/${preset.id}`, query: '',
        actor: owner, signed: true, status: 200,
      },
    ]);
    expect(replies).toMatchObject([
      { embeds: [{ title: expect.stringContaining('Preset Updated - Pending Review') }] },
    ]);
  });

  it('rejects a manually entered foreign unpublished UUID before making a PATCH', async () => {
    await interact('edit', foreign.id);

    expect(apiCalls).toEqual([
      { method: 'GET', path: `${basePath}/${foreign.id}`, query: '', actor: owner, signed: true, status: 404 },
    ]);
    expect(replies).toMatchObject([
      { embeds: [{ description: 'Could not find a preset matching that name.' }] },
    ]);
    expect(await readPreset(foreign.id)).toEqual({
      description: originalDescription,
      status: 'pending',
      content_revision: 0,
    });
  });

  it('keeps show suggestions and lookup public even for the owner of an unpublished preset', async () => {
    const result = await interact('show', 'Moonflower', true);
    expect(result.data?.choices).toEqual([{ name: `${approved.name} (0★)`, value: approved.id }]);
    await interact('show', pending.id);
    const acknowledgement = await interact('show', result.data!.choices![0].value);
    expect(acknowledgement).toEqual({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

    expect(apiCalls.slice(1)).toEqual([
      { method: 'GET', path: `${basePath}/${pending.id}`, query: '', actor: null, signed: true, status: 404 },
      { method: 'GET', path: `${basePath}/${approved.id}`, query: '', actor: null, signed: true, status: 200 },
    ]);
    expect(replies).toMatchObject([
      { embeds: [{ description: 'Could not find a preset matching that name.' }] },
      { embeds: [{ title: expect.stringContaining(approved.name), image: { url: 'attachment://preset.png' } }] },
    ]);
  });
});
