/** Audit probes assert the observed defect, not the desired fixed behavior. */
import { describe, it, expect, vi } from 'vitest';
import { GlamourBlock } from '../../../../../apps/web-app/src/components/glamour-block';
import { CharaSessionService } from '../../../../../apps/web-app/src/services/chara-session-service';

const deferred = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@components/glamour-sheet', () => ({ openGlamourSheet: deferred.open, closeGlamourSheet: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (original) => ({
  ...await original<typeof import('../../../../../apps/web-app/src/services/chara-resolve-service')>(),
  resolveCharaEquipment: vi.fn().mockResolvedValue({ items: {}, glasses: null, version: null }),
}));

describe('audit reproduction', () => {
  it('a pending export-sheet chunk still opens the cleared character after SWAP', async () => {
    const resolved = {
      slots: [], issues: [], gearDyes: [],
      gearModels: [{ slot: 'HeadGear', base: 1, variant: 1 }],
      glassesId: null, gender: null, race: null, tribe: null,
      nickname: null, producer: null, eyesShareIndex: false,
    } as never;
    CharaSessionService.setSession({ resolved, fileName: 'old.chara' });
    const root = document.createElement('div');
    document.body.appendChild(root);
    const block = new GlamourBlock(root);
    try {
      block.init();
      await vi.waitFor(() => expect(root.querySelector<HTMLButtonElement>('[data-role="copy-list"]')?.disabled).toBe(false));
      root.querySelector<HTMLButtonElement>('[data-role="copy-list"]')!.click();
      CharaSessionService.setSession(null);
      expect(root.querySelector('[data-role="copy-list"]')).toBeNull();
      await vi.waitFor(() => expect(deferred.open).toHaveBeenCalledOnce());
      expect(deferred.open.mock.calls[0][0].resolved).toBe(resolved);
    } finally {
      block.destroy(); root.remove(); CharaSessionService.setSession(null);
    }
  });
});
