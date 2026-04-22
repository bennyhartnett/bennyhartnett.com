import { describe, expect, it } from 'vitest';
import { parseStaticAssets, runCheckSwGuardrails } from './check-sw-guardrails.mjs';

describe('scripts/ci/check-sw-guardrails', () => {
  it('parses static assets entries from sw.js content', () => {
    const assets = parseStaticAssets("const STATIC_ASSETS = ['/', '/pages/home.html'];");

    expect(assets.has('/')).toBe(true);
    expect(assets.has('/pages/home.html')).toBe(true);
  });

  it('fails when content files changed without sw.js update', () => {
    const failures = runCheckSwGuardrails(['js/spa-router.js']);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('sw.js was not updated');
  });

  it('fails when changed pages are missing from STATIC_ASSETS', () => {
    const failures = runCheckSwGuardrails(
      ['pages/new-page.html', 'sw.js'],
      "const STATIC_ASSETS = ['/', '/pages/home.html'];"
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/pages/new-page.html');
  });

  it('passes when changed page is present and sw.js changed', () => {
    const failures = runCheckSwGuardrails(
      ['pages/home.html', 'sw.js'],
      "const STATIC_ASSETS = ['/', '/pages/home.html'];"
    );

    expect(failures).toEqual([]);
  });
});
