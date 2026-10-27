import { describe, expect, it } from 'vitest';
import { presetModerationInput } from '../../src/services/preset-moderation-input';

describe('validated preset moderation projection', () => {
  const fields = { name: 'Ocean palette', description: 'A calm blue palette.', tags: ['navy', 'summer'] };
  it('preserves name and includes joined tags and decoded unicode path without URL private components', () => {
    expect(presetModerationInput({ ...fields, example_link: 'https://user:secret@ffxiv.eorzeacollection.com/%E6%97%A5%E6%9C%AC/%70alette?q=private#hidden' })).toEqual({
      name: 'Ocean palette', description: 'A calm blue palette. navy summer /日本/palette',
    });
  });
  it('malformed percent and UTF-8 escapes cannot discard other fields or valid path text', () => {
    const result = presetModerationInput({ ...fields, example_link: 'https://ffxiv.eorzeacollection.com/%oops/%E0%70%61%74%68marker' });
    expect(result.description).toBe('A calm blue palette. navy summer /%oops/�pathmarker');
  });
  it('defensively malformed URL still scores name description and tags without leaking raw credentials', () => {
    expect(presetModerationInput({ ...fields, example_link: 'not a valid URL?secret' })).toEqual({ name: 'Ocean palette', description: 'A calm blue palette. navy summer' });
  });
  it.each([null, undefined, ''])('an absent link %s leaves the other effective fields intact', link => {
    expect(presetModerationInput({ ...fields, example_link: link }).description).toBe('A calm blue palette. navy summer');
  });
});
