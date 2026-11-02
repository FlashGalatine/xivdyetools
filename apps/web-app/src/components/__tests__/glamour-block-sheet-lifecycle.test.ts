import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlamourBlock } from '../glamour-block';
import { CharaFileCard } from '../chara-file-card';
import { CharaSessionService } from '@services/chara-session-service';
import { loadCharaFile } from '@services/chara-file-loader';

const gate = vi.hoisted(() => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
});

// Hold the actual lazy chunk: assertions below exercise the real sheet and session services.
vi.mock('@components/glamour-sheet', async (original) => {
  await gate.ready;
  return original<typeof import('../glamour-sheet')>();
});
vi.mock('@services/chara-resolve-service', async (original) => ({
  ...(await original<typeof import('@services/chara-resolve-service')>()),
  resolveCharaEquipment: vi.fn(async () => ({ items: {}, glasses: null })),
}));

const hosts: HTMLElement[] = [];
const blocks: GlamourBlock[] = [];
const cards: CharaFileCard[] = [];
const sheet = () => document.querySelector('[data-role="glamour-sheet"]');
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function host(): HTMLElement {
  const node = document.createElement('div');
  document.body.appendChild(node);
  hosts.push(node);
  return node;
}
async function load(name: string): Promise<void> {
  const text = JSON.stringify({
    Body: { ModelBase: 200, ModelVariant: 1, DyeId: name == 'replacement' ? 6 : 56 },
    Nickname: name,
  });
  const file = new File([text], `${name}.chara`);
  Object.defineProperty(file, 'text', { value: async () => text });
  expect(await loadCharaFile(file)).toEqual({ ok: true });
}
afterEach(() => {
  gate.release();
  for (const block of blocks.splice(0)) block.destroy();
  for (const card of cards.splice(0)) card.destroy();
  CharaSessionService.setSession(null);
  for (const node of hosts.splice(0)) node.remove();
});

describe('glamour export sheet follows the loaded session', () => {
  it('invalidates deferred opens on clear, SWAP and replacement load, then opens the new session', async () => {
    const actions = host();
    const block = new GlamourBlock(host(), { actionsHost: actions, onSubmitPalette: vi.fn() });
    blocks.push(block);
    block.init();
    const cardHost = host();
    const card = new CharaFileCard(cardHost);
    cards.push(card);
    card.init();
    for (const transition of ['clear', 'swap', 'replace']) {
      await load(`old-${transition}`);
      await settle();
      const copy = actions.querySelector<HTMLButtonElement>('[data-role="copy-list"]')!;
      expect(copy.disabled).toBe(false);
      copy.click();
      if (transition === 'clear') CharaSessionService.setSession(null);
      else if (transition === 'swap') {
        Array.from(cardHost.querySelectorAll('button'))
          .find((button) => button.textContent === 'SWAP')!
          .click();
      } else await load('replacement');
    }
    gate.release();
    await import('../glamour-sheet');
    await settle();
    expect(sheet()).toBeNull();
    actions.querySelector<HTMLButtonElement>('[data-role="copy-list"]')!.click();
    await vi.waitFor(() => expect(sheet()).not.toBeNull());
    expect(sheet()!.textContent).toContain('Soot Black');
    expect(sheet()!.textContent).not.toContain('Deepwood Green');
  });

  it.each(['clear', 'swap', 'replace'])('closes an open sheet on %s', async (transition) => {
    gate.release();
    const actions = host();
    const block = new GlamourBlock(host(), { actionsHost: actions, onSubmitPalette: vi.fn() });
    blocks.push(block);
    block.init();
    const cardHost = host();
    const card = new CharaFileCard(cardHost);
    cards.push(card);
    card.init();
    await load('original');
    await settle();
    actions.querySelector<HTMLButtonElement>('[data-role="copy-list"]')!.click();
    await vi.waitFor(() => expect(sheet()).not.toBeNull());
    if (transition === 'clear') CharaSessionService.setSession(null);
    else if (transition === 'swap') {
      Array.from(cardHost.querySelectorAll('button'))
        .find((button) => button.textContent === 'SWAP')!
        .click();
    } else await load('new');
    expect(sheet()).toBeNull();
  });
});
