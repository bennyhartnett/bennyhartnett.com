import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './router.js';

const makeResponse = (body = 'ok', status = 200) => new Response(body, { status });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workers/router', () => {
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

  it('serves nuclear and centrus subdomains from /nuclear.html', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse('nuclear page'));

    const nuclearResponse = await worker.fetch(new Request('https://nuclear.bennyhartnett.com/'), {}, {});
    const centrusResponse = await worker.fetch(new Request('https://centrus.bennyhartnett.com/'), {}, {});

    expect(nuclearResponse.status).toBe(200);
    expect(centrusResponse.status).toBe(200);

    const calledUrls = fetchSpy.mock.calls.map(([arg]) => String(arg));
    expect(calledUrls).toContain('https://bennyhartnett.com/nuclear.html');
  });

  it('redirects thank-you subdomain to sent subdomain', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponse());

    const response = await worker.fetch(new Request('https://thank-you.bennyhartnett.com/'), {}, {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://sent.bennyhartnett.com/');
    expect(fetchSpy).not.toHaveBeenCalled();
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
