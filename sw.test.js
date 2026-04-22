import { beforeEach, describe, expect, it, vi } from 'vitest';

let handlers;

function makeInstallEvent() {
  const waits = [];
  return {
    waits,
    waitUntil(promise) {
      waits.push(promise);
    }
  };
}

function makeFetchEvent(request) {
  let responsePromise;
  return {
    request,
    respondWith(promise) {
      responsePromise = promise;
    },
    get responsePromise() {
      return responsePromise;
    }
  };
}

describe('sw.js service worker', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();

    handlers = {};

    globalThis.self = {
      location: { origin: 'https://bennyhartnett.com' },
      clients: { claim: vi.fn(() => Promise.resolve()) },
      skipWaiting: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn((type, handler) => {
        handlers[type] = handler;
      })
    };

    const cacheStore = new Map();
    const activeCache = {
      addAll: vi.fn(() => Promise.resolve()),
      put: vi.fn(() => Promise.resolve())
    };

    globalThis.caches = {
      open: vi.fn(() => Promise.resolve(activeCache)),
      keys: vi.fn(() => Promise.resolve(['swu-calculator-v136', 'swu-calculator-v137'])),
      delete: vi.fn(() => Promise.resolve(true)),
      match: vi.fn((request) => Promise.resolve(cacheStore.get(String(request.url ?? request)) ?? undefined)),
      __cacheStore: cacheStore,
      __activeCache: activeCache
    };

    globalThis.fetch = vi.fn((request) => Promise.resolve(new Response('network', { status: 200 })));

    await import('./sw.js');
  });

  it('registers install, activate, fetch, and message handlers', () => {
    expect(typeof handlers.install).toBe('function');
    expect(typeof handlers.activate).toBe('function');
    expect(typeof handlers.fetch).toBe('function');
    expect(typeof handlers.message).toBe('function');
  });

  it('caches static assets on install and calls skipWaiting', async () => {
    const event = makeInstallEvent();
    handlers.install(event);
    await Promise.all(event.waits);

    expect(caches.open).toHaveBeenCalledTimes(1);
    expect(caches.__activeCache.addAll).toHaveBeenCalledTimes(1);
    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('deletes old versioned caches on activate and claims clients', async () => {
    const event = makeInstallEvent();
    handlers.activate(event);
    await Promise.all(event.waits);

    expect(caches.delete).toHaveBeenCalledWith('swu-calculator-v136');
    expect(caches.delete).not.toHaveBeenCalledWith('swu-calculator-v137');
    expect(self.clients.claim).toHaveBeenCalledTimes(1);
  });

  it('ignores non-GET fetch requests', () => {
    const event = makeFetchEvent(new Request('https://bennyhartnett.com/pages/home.html', { method: 'POST' }));
    handlers.fetch(event);

    expect(event.responsePromise).toBeUndefined();
  });

  it('uses cache-first strategy for approved CDN origins', async () => {
    const request = new Request('https://cdnjs.cloudflare.com/ajax/libs/three.js/r1/three.min.js');
    const event = makeFetchEvent(request);
    handlers.fetch(event);

    const response = await event.responsePromise;
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(request);
    expect(caches.open).toHaveBeenCalled();
    expect(caches.__activeCache.put).toHaveBeenCalled();
  });

  it('bypasses non-whitelisted external origins', () => {
    const request = new Request('https://example.com/script.js');
    const event = makeFetchEvent(request);
    handlers.fetch(event);

    expect(event.responsePromise).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses network-first strategy for HTML and falls back to cache on failure', async () => {
    const request = new Request('https://bennyhartnett.com/pages/contact.html');
    const cached = new Response('cached contact', { status: 200 });
    caches.__cacheStore.set(request.url, cached);

    fetch.mockRejectedValueOnce(new Error('offline'));

    const event = makeFetchEvent(request);
    handlers.fetch(event);
    const response = await event.responsePromise;

    expect(await response.text()).toBe('cached contact');
  });

  it('uses cache-first strategy for same-origin assets', async () => {
    const request = new Request('https://bennyhartnett.com/assets/logo.png');
    fetch.mockResolvedValueOnce(new Response('image bytes', { status: 200 }));

    const event = makeFetchEvent(request);
    handlers.fetch(event);

    const response = await event.responsePromise;
    expect(await response.text()).toBe('image bytes');
    expect(caches.__activeCache.put).toHaveBeenCalled();
  });

  it('handles skipWaiting message', () => {
    handlers.message({ data: 'skipWaiting' });

    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
  });
});
