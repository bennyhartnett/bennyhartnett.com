import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './router.js';

const makeResponse = (body = 'ok', status = 200) => new Response(body, { status });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workers/router', () => {
  it('passes through requests marked as internal worker fetches', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('internal'));

    const request = new Request('https://bennyhartnett.com/contact', {
      headers: {
        'X-CF-Worker-Internal': '1'
      }
    });
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('internal');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(String(request));
  });

  it('passes unsupported domains through without redirect', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('external'));

    const request = new Request('https://example.com/contact');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('external');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('redirects /foo path requests to foo subdomain', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse());

    const request = new Request('https://bennyhartnett.com/contact?x=1');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://contact.bennyhartnett.com/?x=1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes excluded paths through without redirect', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('asset'));

    const request = new Request('https://bennyhartnett.com/js/spa-router.js');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('passes non-html file paths through on main domain', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('file passthrough'));

    const request = new Request('https://bennyhartnett.com/favicon.svg');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('file passthrough');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('strips .html extension on path redirects', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse());

    const request = new Request('https://bennyhartnett.com/projects.html?tab=all');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://projects.bennyhartnett.com/?tab=all');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('supports federalinnovations.com root domain redirects', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse());

    const request = new Request('https://federalinnovations.com/contact');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://contact.federalinnovations.com/');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes static assets on subdomains through main domain with internal header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('asset ok'));

    const response = await worker.fetch(new Request('https://contact.bennyhartnett.com/css/main.css'), {}, {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset ok');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://bennyhartnett.com/css/main.css');
    expect(init.method).toBe('GET');
    expect(init.headers.get('X-CF-Worker-Internal')).toBe('1');
  });

  it('serves nuclear and centrus subdomains from /nuclear.html', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('nuclear page'));

    const nuclearResponse = await worker.fetch(new Request('https://nuclear.bennyhartnett.com/'), {}, {});
    const centrusResponse = await worker.fetch(new Request('https://centrus.bennyhartnett.com/'), {}, {});

    expect(nuclearResponse.status).toBe(200);
    expect(centrusResponse.status).toBe(200);

    const calledUrls = fetchSpy.mock.calls.map(([arg]) => String(arg));
    expect(calledUrls).toContain('https://bennyhartnett.com/nuclear.html');
  });

  it('treats sent subdomain like a normal SPA subdomain', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('index ok'));

    const response = await worker.fetch(new Request('https://sent.bennyhartnett.com/'), {}, {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('index ok');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://bennyhartnett.com/');
    expect(init.headers.get('X-CF-Worker-Internal')).toBe('1');
  });

  it('redirects ascii resume subdomain to canonical punycode idn', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse());

    const response = await worker.fetch(new Request('https://resume.bennyhartnett.com/'), {}, {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://xn--rsum-bpad.bennyhartnett.com/');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves card subdomain root as card.vcf with vcard headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('VCARD', {
      status: 200,
      headers: {
        'content-type': 'text/plain'
      }
    }));

    const response = await worker.fetch(new Request('https://card.bennyhartnett.com/'), {}, {});

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/vcard');
    expect(response.headers.get('content-disposition')).toContain('Hartnett_Benny.vcf');
    expect(await response.text()).toBe('VCARD');
  });
});
