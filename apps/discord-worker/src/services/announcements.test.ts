/**
 * Tests for the release-announcement embed (the `/webhooks/github` path).
 *
 * The announcement stays product-level — it is formatted from the ROOT
 * `CHANGELOG-laymans.md`, which covers every surface — so when it has to cut
 * a long release short it must point at the full notes on GitHub, not at
 * `/changelog`, which since 5.0 shows the bot's own notes only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/discord-api.js', () => ({
  sendMessage: vi.fn(),
}));

import { formatAnnouncementEmbed, sendAnnouncement } from './announcements.js';
import { sendMessage } from '../utils/discord-api.js';
import type { ChangelogEntry } from './changelog-parser.js';

const REPO_URL = 'https://github.com/FlashGalatine/xivdyetools';
const FULL_NOTES_URL = `${REPO_URL}/blob/main/CHANGELOG-laymans.md`;

function entry(items: string[]): ChangelogEntry {
  return {
    version: '5.0.0',
    date: '2026-08-16',
    sections: [{ title: '🎨 The 5.0 redesign', items }],
  };
}

describe('formatAnnouncementEmbed', () => {
  it('renders a short release in full, with the date and repository in the footer', () => {
    const embed = formatAnnouncementEmbed(entry(['Web app: one', 'Discord bot: two']), REPO_URL);

    expect(embed.title).toBe('🆕 XIV Dye Tools v5.0.0');
    expect(embed.description).toContain('### 🎨 The 5.0 redesign');
    expect(embed.description).toContain('• Web app: one');
    expect(embed.description).toContain('• Discord bot: two');
    expect(embed.description).not.toContain('Summary shown');
    expect(embed.footer.text).toContain('2026-08-16');
    expect(embed.footer.text).toContain(REPO_URL);
  });

  it('cuts a long release on a line boundary and links the full notes on GitHub', () => {
    const items = Array.from(
      { length: 200 },
      (_, i) => `Web app: change number ${i} with enough words in it to matter`
    );

    const embed = formatAnnouncementEmbed(entry(items), REPO_URL);

    expect(embed.description.length).toBeLessThanOrEqual(4096);
    const [body, summary] = embed.description.split('\n\n*Summary shown');
    expect(summary, 'the cut has to announce itself').toBeDefined();
    // Line boundary: the last kept line is a whole bullet, never a torn one.
    const lastLine = body.split('\n').pop();
    expect(items.some((item) => lastLine === `• ${item}`)).toBe(true);
    // The pointer goes to the product-level notes on GitHub — /changelog is
    // the bot's own notes and would not contain what was cut here.
    expect(embed.description).toContain(FULL_NOTES_URL);
    expect(embed.description).not.toContain('/changelog');
  });

  it('stays under Discord’s 4096-character ceiling however long the repository URL is', () => {
    // The summary line carries the repo URL; it must be budgeted INSIDE the
    // cut, not appended after it — otherwise a long owner/repo name pushes
    // the description over 4096 and Discord rejects the announcement.
    const longRepo = `https://github.com/${'o'.repeat(39)}/${'r'.repeat(100)}`;
    const items = Array.from({ length: 400 }, (_, i) => `Web app: short change ${i}`);

    const embed = formatAnnouncementEmbed(entry(items), longRepo);

    expect(embed.description.length).toBeLessThanOrEqual(4096);
    expect(embed.description).toContain(`${longRepo}/blob/main/CHANGELOG-laymans.md`);
  });
});

// ============================================================================
// discord-core-14: `sendAnnouncement` itself had NO test
// ============================================================================
//
// This file covered `formatAnnouncementEmbed` only. `sendAnnouncement` -- the
// function whose dropped Response caused BUG-026 -- was never called, and
// index.test.ts mocks it wholesale, so nothing anywhere observed what it does
// with a non-2xx from Discord.
describe('sendAnnouncement', () => {
  const ENTRY = entry(['Something changed']);

  beforeEach(() => {
    vi.mocked(sendMessage).mockReset();
  });

  it('reports success when Discord accepts the message', async () => {
    vi.mocked(sendMessage).mockResolvedValue(new Response(null, { status: 200 }));

    await expect(sendAnnouncement('token', 'channel', ENTRY, REPO_URL)).resolves.toEqual({
      ok: true,
    });
  });

  it.each([
    ['403 Missing Permissions', 403],
    ['400 rejected embed', 400],
    ['500 Discord outage', 500],
  ])('reports FAILURE for a %s, rather than resolving as sent', async (_label, status) => {
    vi.mocked(sendMessage).mockResolvedValue(new Response('nope', { status }));

    const result = await sendAnnouncement('token', 'channel', ENTRY, REPO_URL);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status });
  });
});
