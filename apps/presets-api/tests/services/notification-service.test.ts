import { describe, expect, it } from 'vitest';
import { toDeadLetterRecord, type PresetSubmissionNotification } from '../../src/services/notification-service';

describe('submission notification dead-letter allowlist', () => {
  it('drops current and replaced links and snapshot content while retaining revision identifiers', () => {
    const payload: PresetSubmissionNotification = {
      type: 'submission', is_edit: true, edited_from_status: 'approved',
      edited_from: { name: 'Before', description: 'Before description', tags: ['before'], dyes: [1, 2, 3], example_link: 'https://ffxiv.eorzeacollection.com/glamour/private-old?secret=old' },
      preset: {
        id: 'p', name: 'After', description: 'After description', category_id: 'jobs', dyes: [1, 2, 3], tags: ['after'],
        author_name: 'Owner', author_discord_id: 'owner', status: 'pending', content_revision: 7, moderation_status: 'flagged', source: 'bot', created_at: '2026-10-27T12:00:00.000Z',
        previous_values: { name: 'Approved', description: 'Approved description', tags: ['approved'], dyes: [1, 2, 3], example_link: 'https://ffxiv.eorzeacollection.com/glamour/private-snapshot?secret=snapshot' },
        ...{ example_link: 'https://ffxiv.eorzeacollection.com/glamour/private-current?secret=current' },
      },
    };
    expect(toDeadLetterRecord(payload)).toEqual({ type: 'submission', preset_id: 'p', moderation_status: 'flagged', content_revision: 7 });
  });
});
