import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMetaTags } from './meta-manager.js';
import { trackPageView } from './analytics.js';

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

import { __test__, initRouter, loadContent } from './spa-router.js';

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
        href: 'https://bennyhartnett.com',
        origin: 'https://bennyhartnett.com',
        pathname: '/'
      },
      open: vi.fn(),
      addEventListener: vi.fn()
    };

    globalThis.history = {
      pushState: vi.fn(),
      replaceState: vi.fn()
    };

    globalThis.CustomEvent = class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };

    const storage = new Map();
    globalThis.sessionStorage = {
      getItem: vi.fn((key) => storage.get(key) ?? null),
      setItem: vi.fn((key, value) => storage.set(key, value)),
      removeItem: vi.fn((key) => storage.delete(key))
    };

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: vi.fn(() => Promise.resolve())
        }
      }
    });

    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('<div>page</div>', { status: 200 })));
    globalThis.document = {
      body: {
        dataset: {},
        addEventListener: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn()
      },
      documentElement: { dataset: {} },
      dispatchEvent: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(() => null),
      getElementById: vi.fn(() => null),
      createElement: vi.fn(() => ({
        set type(value) { this._type = value; },
        set src(value) { this._src = value; },
        textContent: '',
        click: vi.fn()
      }))
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

  it('resolves nuclear subdomain to standalone page', () => {
    globalThis.location.hostname = 'nuclear.bennyhartnett.com';

    expect(__test__.getInitialPage()).toBe('nuclear.html');
  });

  it('detects subdomain status', () => {
    globalThis.location.hostname = 'projects.bennyhartnett.com';
    expect(__test__.isSubdomain()).toBe(true);

    globalThis.location.hostname = 'bennyhartnett.com';
    expect(__test__.isSubdomain()).toBe(false);
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

  it('handles .html route links', () => {
    const link = makeLink({ href: '/contact.html' });
    const event = {
      target: { closest: vi.fn((selector) => (selector === 'a' ? link : null)) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.location.href).toBe('https://contact.html.bennyhartnett.com');
  });

  it('returns early when no anchor is found', () => {
    const event = {
      target: { closest: vi.fn(() => null) },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('copies email for copy-email links', async () => {
    const emailLink = { dataset: { email: 'hello@example.com' } };
    const event = {
      target: {
        closest: vi.fn((selector) => (selector === '.copy-email' ? emailLink : null))
      },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);
    await Promise.resolve();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello@example.com');
  });

  it('handles secure resume download action', () => {
    const createdLink = { click: vi.fn() };
    document.createElement.mockReturnValue(createdLink);

    const event = {
      target: {
        closest: vi.fn((selector) => (selector === '[data-action="download-resume"]' ? {} : null))
      },
      preventDefault: vi.fn()
    };

    __test__.handleLinkClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(createdLink.href).toBe('/assets/d/r-8f3a2c9e7b1d.pdf');
    expect(createdLink.download).toBe('resume_benny_hartnett.pdf');
    expect(createdLink.click).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalledWith(createdLink);
    expect(document.body.removeChild).toHaveBeenCalledWith(createdLink);
  });

  it('initializes router and wires base navigation handlers', () => {
    const classSet = new Set();
    const container = {
      classList: {
        add: vi.fn((name) => classSet.add(name)),
        remove: vi.fn((name) => classSet.delete(name))
      },
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      innerHTML: ''
    };
    const canonicalTag = { setAttribute: vi.fn() };
    const ogUrlTag = { setAttribute: vi.fn() };
    const title = { addEventListener: vi.fn() };

    document.querySelector = vi.fn((selector) => {
      if (selector === '#main-content') return container;
      if (selector === 'nav .title') return title;
      return null;
    });
    document.getElementById = vi.fn((id) => {
      if (id === 'canonical-link') return canonicalTag;
      if (id === 'og-url') return ogUrlTag;
      return null;
    });

    initRouter();

    expect(document.body.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(history.replaceState).toHaveBeenCalled();
    expect(canonicalTag.setAttribute).toHaveBeenCalledWith('href', 'https://bennyhartnett.com/');
    expect(ogUrlTag.setAttribute).toHaveBeenCalledWith('content', 'https://bennyhartnett.com/');
  });

  it('loads content and updates meta, analytics, and history', async () => {
    vi.useFakeTimers();

    const classSet = new Set();
    const scriptNode = { type: '', src: '', textContent: 'console.log("x")', replaceWith: vi.fn() };
    const container = {
      classList: {
        add: vi.fn((name) => classSet.add(name)),
        remove: vi.fn((name) => classSet.delete(name))
      },
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn((selector) => (selector === 'script' ? [scriptNode] : [])),
      innerHTML: '',
      get offsetHeight() { return 0; }
    };
    const title = { addEventListener: vi.fn() };

    document.querySelector = vi.fn((selector) => {
      if (selector === '#main-content') return container;
      if (selector === 'nav .title') return title;
      return null;
    });
    initRouter();

    fetch.mockResolvedValueOnce(new Response('<section>projects</section>', { status: 200 }));
    loadContent('pages/projects.html', true, true);
    await vi.runAllTimersAsync();

    expect(updateMetaTags).toHaveBeenCalled();
    expect(trackPageView).toHaveBeenCalledWith(
      'pages/projects.html',
      'Home',
      'https://bennyhartnett.com/projects'
    );
    expect(history.pushState).toHaveBeenCalledWith({ url: 'pages/projects.html' }, '', '/projects');
    expect(document.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'spa:content-loaded' }));
    expect(document.body.dataset.page).toBe('projects');

    vi.useRealTimers();
  });

  it('loads fallback content when fetch fails', async () => {
    vi.useFakeTimers();

    const container = {
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      },
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      innerHTML: '',
      get offsetHeight() { return 0; }
    };
    const title = { addEventListener: vi.fn() };
    document.querySelector = vi.fn((selector) => {
      if (selector === '#main-content') return container;
      if (selector === 'nav .title') return title;
      return null;
    });
    initRouter();
    await vi.runAllTimersAsync();

    fetch.mockRejectedValueOnce(new Error('offline'));
    loadContent('pages/privacy.html', false, true);
    await vi.runAllTimersAsync();

    expect(container.innerHTML).toContain('Privacy Policy');
    expect(document.body.dataset.page).toBe('privacy');

    vi.useRealTimers();
  });
});
