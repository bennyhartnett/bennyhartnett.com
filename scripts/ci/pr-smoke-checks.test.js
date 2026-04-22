import { describe, expect, it, vi } from 'vitest';
import { fileExistsFromWebPath, parseStaticAssets, runPrSmokeChecks } from './pr-smoke-checks.mjs';

describe('scripts/ci/pr-smoke-checks', () => {
  it('parses static assets entries from service worker content', () => {
    const assets = parseStaticAssets("const STATIC_ASSETS = ['/', '/css/main.css'];");

    expect(assets.has('/')).toBe(true);
    expect(assets.has('/css/main.css')).toBe(true);
  });

  it('treats absolute external and root paths as existing', () => {
    expect(fileExistsFromWebPath('https://example.com/file.js')).toBe(true);
    expect(fileExistsFromWebPath('/')).toBe(true);
    expect(fileExistsFromWebPath('/nuclear')).toBe(true);
  });

  it('reports missing static assets from STATIC_ASSETS', () => {
    const exists = vi.fn((path) => path.endsWith('index.html'));
    const readFile = vi.fn((file) => {
      if (file === 'index.html') return '<a href="/missing.css"></a>';
      return '';
    });

    const failures = runPrSmokeChecks({
      swContent: "const STATIC_ASSETS = ['/', '/missing.css'];",
      pagePaths: [],
      readFile,
      exists
    });

    expect(failures.some((failure) => failure.includes('STATIC_ASSETS entry does not exist: /missing.css'))).toBe(true);
  });

  it('reports broken page references and broken internal links', () => {
    const exists = vi.fn((path) => path.endsWith('index.html'));
    const readFile = vi.fn((file) => {
      if (file === 'index.html') {
        return '<script src="/js/missing.js"></script><a href="/pages/missing.html">Missing</a>';
      }
      return '';
    });

    const failures = runPrSmokeChecks({
      swContent: "const STATIC_ASSETS = ['/', '/index.html'];",
      pagePaths: [],
      readFile,
      exists
    });

    expect(failures.some((failure) => failure.includes('references missing page: /pages/missing.html'))).toBe(true);
    expect(failures.some((failure) => failure.includes('contains broken internal path: /js/missing.js'))).toBe(true);
  });

  it('passes when assets and references exist', () => {
    const exists = vi.fn(() => true);
    const readFile = vi.fn(() => '<a href="/css/main.css">CSS</a>');

    const failures = runPrSmokeChecks({
      swContent: "const STATIC_ASSETS = ['/', '/css/main.css'];",
      pagePaths: ['pages/home.html'],
      readFile,
      exists
    });

    expect(failures).toEqual([]);
  });
});
