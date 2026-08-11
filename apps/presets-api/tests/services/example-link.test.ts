/**
 * 8A example-link validation tests: https-only, host allowlist (exact +
 * subdomains), bounded length, optional/empty passes, normalization adds
 * the scheme a pasted bare host lacks.
 */

import { describe, it, expect } from 'vitest';
import {
  validateExampleLink,
  normalizeExampleLink,
  EXAMPLE_LINK_HOSTS,
} from '../../src/services/validation-service';

describe('validateExampleLink', () => {
  it('accepts absent/empty values (the field is optional)', () => {
    expect(validateExampleLink(undefined)).toBeNull();
    expect(validateExampleLink(null)).toBeNull();
    expect(validateExampleLink('')).toBeNull();
  });

  it('accepts every allowlisted host and their subdomains', () => {
    for (const host of EXAMPLE_LINK_HOSTS) {
      expect(validateExampleLink(`https://${host}/glamour/38412`)).toBeNull();
      expect(validateExampleLink(`https://www.${host}/a`)).toBeNull();
    }
  });

  it('accepts the glamour and social destinations', () => {
    expect(validateExampleLink('https://ffxiv.eorzeacollection.com/glamour/342206/x')).toBeNull();
    expect(validateExampleLink('https://mirapri.com/100814')).toBeNull();
    expect(validateExampleLink('https://www.reddit.com/r/FFXIVGlamours/comments/abc/x/')).toBeNull();
    expect(validateExampleLink('https://redd.it/abc123')).toBeNull();
    expect(validateExampleLink('https://x.com/user/status/123')).toBeNull();
    expect(validateExampleLink('https://twitter.com/user/status/123')).toBeNull();
    expect(validateExampleLink('https://bsky.app/profile/a.bsky.social/post/123')).toBeNull();
    expect(validateExampleLink('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('rejects bare image hosts — the field links a page, not an image', () => {
    expect(validateExampleLink('https://i.imgur.com/abc123.png')).not.toBeNull();
    expect(validateExampleLink('https://www.flickr.com/photos/x/123')).not.toBeNull();
  });

  it('accepts a bare host pasted without a scheme', () => {
    expect(validateExampleLink('eorzeacollection.com/glamour/44120')).toBeNull();
  });

  it('rejects non-allowlisted hosts, including suffix look-alikes', () => {
    expect(validateExampleLink('https://example.com/x')).not.toBeNull();
    expect(validateExampleLink('https://notimgur.com/x')).not.toBeNull();
    expect(validateExampleLink('https://imgur.com.evil.net/x')).not.toBeNull();
  });

  it('rejects http', () => {
    expect(validateExampleLink('http://imgur.com/abc')).not.toBeNull();
  });

  it('rejects non-strings and over-long values', () => {
    expect(validateExampleLink(42)).not.toBeNull();
    expect(validateExampleLink('https://imgur.com/' + 'a'.repeat(300))).not.toBeNull();
  });
});

describe('normalizeExampleLink', () => {
  it('adds https:// to a bare host and trims whitespace', () => {
    expect(normalizeExampleLink(' eorzeacollection.com/glamour/1 ')).toBe(
      'https://eorzeacollection.com/glamour/1'
    );
  });

  it('leaves a full URL untouched and nulls empty input', () => {
    expect(normalizeExampleLink('https://imgur.com/a')).toBe('https://imgur.com/a');
    expect(normalizeExampleLink('')).toBeNull();
    expect(normalizeExampleLink(null)).toBeNull();
    expect(normalizeExampleLink(undefined)).toBeNull();
  });
});
