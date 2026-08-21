/**
 * XIV Dye Tools - Example-link / preview-image URL guards
 *
 * `exampleLinkError` is the submit/edit-form validator (client mirror of the
 * presets-api host allowlist). The `sanitize*` helpers apply the same policy
 * on the READ path: `exampleLink` / `previewImageUrl` arrive from the API (or
 * from a localStorage snapshot) and are bound to `href` / `src` in trusted
 * cards, so a server-side regression must not be able to render an arbitrary
 * link there (2026-08-21 security audit, WEB-14).
 *
 * @module shared/__tests__/example-link.test
 */

import { describe, it, expect } from 'vitest';
import { exampleLinkError, sanitizeExampleLink, sanitizePreviewImageUrl } from '../example-link';

describe('exampleLinkError (form validator — positive control)', () => {
  it('accepts https links on allowlisted hosts and their subdomains', () => {
    expect(exampleLinkError('https://mirapri.com/100814')).toBeNull();
    expect(exampleLinkError('https://www.eorzeacollection.com/glamour/1')).toBeNull();
    expect(exampleLinkError('  https://bsky.app/profile/x/post/y  ')).toBeNull();
  });

  it('rejects http, unknown hosts and unparsable values', () => {
    expect(exampleLinkError('http://mirapri.com/100814')).not.toBeNull();
    expect(exampleLinkError('https://evil.example/glam')).not.toBeNull();
    expect(exampleLinkError('https://mirapri.com.evil.example/')).not.toBeNull();
    expect(exampleLinkError('not a url at all')).not.toBeNull();
  });

  it('treats an empty value as "no link"', () => {
    expect(exampleLinkError('')).toBeNull();
    expect(exampleLinkError('   ')).toBeNull();
  });
});

describe('sanitizeExampleLink (read path)', () => {
  it('returns an allowlisted https link unchanged (trimmed)', () => {
    expect(sanitizeExampleLink('https://mirapri.com/100814')).toBe('https://mirapri.com/100814');
    expect(sanitizeExampleLink('  https://www.reddit.com/r/ffxivglamours/x ')).toBe(
      'https://www.reddit.com/r/ffxivglamours/x'
    );
  });

  it('drops anything the form validator would have refused', () => {
    expect(sanitizeExampleLink('javascript:alert(1)')).toBeNull();
    expect(sanitizeExampleLink('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeExampleLink('http://mirapri.com/100814')).toBeNull();
    expect(sanitizeExampleLink('https://evil.example/phish')).toBeNull();
    expect(sanitizeExampleLink('//evil.example/phish')).toBeNull();
  });

  it('maps absent values to null', () => {
    expect(sanitizeExampleLink(null)).toBeNull();
    expect(sanitizeExampleLink(undefined)).toBeNull();
    expect(sanitizeExampleLink('')).toBeNull();
    expect(sanitizeExampleLink('   ')).toBeNull();
  });
});

describe('sanitizePreviewImageUrl (read path)', () => {
  it('returns an https URL unchanged', () => {
    expect(sanitizePreviewImageUrl('https://shots.xivdyetools.app/p1/a.webp')).toBe(
      'https://shots.xivdyetools.app/p1/a.webp'
    );
  });

  it('drops non-https schemes and unparsable values', () => {
    expect(sanitizePreviewImageUrl('http://shots.xivdyetools.app/p1/a.webp')).toBeNull();
    expect(sanitizePreviewImageUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizePreviewImageUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(sanitizePreviewImageUrl('blob:https://xivdyetools.app/abc')).toBeNull();
    expect(sanitizePreviewImageUrl('/relative/path.webp')).toBeNull();
    expect(sanitizePreviewImageUrl('not a url')).toBeNull();
  });

  it('maps absent values to null', () => {
    expect(sanitizePreviewImageUrl(null)).toBeNull();
    expect(sanitizePreviewImageUrl(undefined)).toBeNull();
    expect(sanitizePreviewImageUrl('')).toBeNull();
  });
});
