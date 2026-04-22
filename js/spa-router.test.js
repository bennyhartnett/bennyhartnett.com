import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./meta-manager.js', () => ({
  updateMetaTags: vi.fn(),
  getMetaMap: vi.fn(() => ({
    'pages/home.html': { title: 'Home' }
  })),
  getBaseOgImage: vi.fn(() => '/assets/og-image.png')
}));

vi.mock('./analytics.js', () => ({
  trackPageView: vi.fn()
}));

vi.mock('./performance-profile.js', () => ({
  getPerformanceProfile: vi.fn(() => ({
    prefetchPages: false,
    heavyWorkDelayMs: 0,
    maxPrefetchPages: 0
  })),
  scheduleDeferredTask: vi.fn()
}));

import { __test__ } from './spa-router.js';

function makeLink({ href, dataHref, external } = {}) {
  return {
    dataset: {
      external: external ? 'true' : undefined
    },
    getAttribute(name) {
      if (name === 'href') return href ?? null;
      if (name === 'data-href') return dataHref ?? null;
      return null;
    }
  };
}

describe('js/spa-router', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    globalThis.location = {
      hostname: 'bennyhartnett.com',
      pathname: '/',
      hash: ''
    };

    globalThis.window = {
      location: {
        href: 'https://bennyhartnett.com'
      },
      open: vi.fn()
    };

    const storage = new Map();
    globalThis.sessionStorage = {
      getItem: vi.fn((key) => storage.get(key) ?? null),
      setItem: vi.fn((key, value) => storage.set(key, value)),
      removeItem: vi.fn((key) => storage.delete(key))
    };
  });

  it('uses matching root domain for bennyhartnett.com hosts', () => {
    globalThis.location.hostname = 'contact.bennyhartnett.com';

    expect(__test__.getRootDomain()).toBe('bennyhartnett.com');
  });

  it('uses matching root domain for federalinnovations.com hosts', () => {
    globalThis.location.hostname = 'www.federalinnovations.com';

    expect(__test__.getRootDomain()).toBe('federalinnovations.com');
  });

  it('resolves IDN subdomain aliases in initial route selection', () => {
    globalThis.location.hostname = 'xn--rsum-bpad.bennyhartnett.com';

    expect(__test__.getInitialPage()).toBe('pages/resume.html');
  });

  it('uses sessionStorage spa-redirect when present', () => {
    sessionStorage.setItem('spa-redirect', 'projects');

    expect(__test__.getInitialPage()).toBe('pages/projects.html');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('spa-redirect');
  });

  it('uses clean pathname when provided', () => {
    globalThis.location.pathname = '/contact';

    expect(__test__.getInitialPage()).toBe('pages/contact.html');
  });

  it('uses hash fallback when pathname is root', () => {
    globalThis.location.hash = '#tools';

    expect(__test__.getInitialPage()).toBe('pages/tools');
  });

  it('opens external links in a new tab', () => {
    const link = makeLink({ href: 'https://example.com', external: true });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener');
  });

  it('redirects nuclear links to the nuclear subdomain', () => {
    const link = makeLink({ href: '/nuclear' });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.location.href).toBe('https://nuclear.bennyhartnett.com');
  });

  it('redirects home links to root domain', () => {
    globalThis.location.hostname = 'contact.bennyhartnett.com';
    const link = makeLink({ href: '/home' });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(window.location.href).toBe('https://bennyhartnett.com');
  });

  it('redirects clean route links to canonical subdomains', () => {
    const link = makeLink({ href: '/projects' });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(window.location.href).toBe('https://projects.bennyhartnett.com');
  });

  it('redirects resume route links to IDN subdomain', () => {
    const link = makeLink({ href: '/resume' });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(window.location.href).toBe('https://xn--rsum-bpad.bennyhartnett.com');
  });

  it('does not intercept excluded asset paths', () => {
    const link = makeLink({ href: '/css/main.css' });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(window.location.href).toBe('https://bennyhartnett.com');
  });
});
