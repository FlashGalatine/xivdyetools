import { describe, it, expect } from 'vitest';
import { parseArgs, ROBOTS_MODES } from './smoke-test-pages.js';

const ok = ['--deployment-url', 'https://abc.example.pages.dev', '--domain', 'https://site.test', '--expect-robots', 'noindex'];

describe('parseArgs', () => {
  it('accepts the three flags in space-separated form', () => {
    expect(parseArgs(ok)).toEqual({
      deploymentUrl: 'https://abc.example.pages.dev',
      domain: 'https://site.test',
      expectRobots: 'noindex',
    });
  });

  it('accepts --flag=value form', () => {
    expect(
      parseArgs([
        '--deployment-url=https://abc.example.pages.dev',
        '--domain=https://site.test',
        '--expect-robots=none',
      ])
    ).toEqual({
      deploymentUrl: 'https://abc.example.pages.dev',
      domain: 'https://site.test',
      expectRobots: 'none',
    });
  });

  it('rejects a missing --deployment-url by naming wrangler-action as the cause', () => {
    // The realistic failure: wrangler-action's output is empty, so the workflow
    // interpolates nothing. Blaming the site here would send the operator to the
    // wrong system.
    expect(() => parseArgs(['--domain', 'https://site.test', '--expect-robots', 'noindex'])).toThrow(
      /deployment-url.*wrangler-action/is
    );
  });

  it('rejects an empty --deployment-url the same way', () => {
    expect(() =>
      parseArgs(['--deployment-url=', '--domain', 'https://site.test', '--expect-robots', 'noindex'])
    ).toThrow(/deployment-url.*wrangler-action/is);
  });

  it('rejects a missing --domain', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://abc.example.pages.dev', '--expect-robots', 'noindex'])
    ).toThrow(/--domain/);
  });

  it('rejects an unrecognised --expect-robots value', () => {
    expect(() =>
      parseArgs(['--deployment-url', 'https://a.test', '--domain', 'https://b.test', '--expect-robots', 'maybe'])
    ).toThrow(/--expect-robots.*noindex\|none.*maybe/s);
  });

  it('rejects a flag given no value', () => {
    expect(() => parseArgs(['--deployment-url', '--domain', 'https://b.test'])).toThrow(/needs a value/);
  });

  it('rejects a bare positional argument', () => {
    expect(() => parseArgs([...ok, 'stray'])).toThrow(/unexpected argument: stray/);
  });

  it('exposes exactly the two supported robots modes', () => {
    expect(ROBOTS_MODES).toEqual(['noindex', 'none']);
  });
});
