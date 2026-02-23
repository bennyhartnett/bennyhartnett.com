/**
 * Cloudflare Worker: Bidirectional subdomain/path routing
 *
 * - foo.bennyhartnett.com → serves /foo/ content
 * - bennyhartnett.com/foo → redirects to foo.bennyhartnett.com
 *
 * Also supports federalinnovations.com with the same routing logic.
 */

const SUPPORTED_DOMAINS = ['bennyhartnett.com', 'federalinnovations.com'];

// Header to mark internal origin fetches (prevents redirect loops)
const INTERNAL_HEADER = 'X-CF-Worker-Internal';

// Paths that should NOT be treated as subdomains (static assets, etc.)
const EXCLUDED_PATHS = [
  'index.html',
  'sw.js',
  'manifest.json',
  'favicon',
  'assets',
  'images',
  'css',
  'js',
  'pages',
  '.well-known',
];

/**
 * Determine the root domain from a hostname
 * @param {string} hostname - The request hostname
 * @returns {string|null} The matching root domain, or null if not supported
 */
function getRootDomain(hostname) {
  for (const domain of SUPPORTED_DOMAINS) {
    if (hostname === domain || hostname === `www.${domain}` || hostname.endsWith(`.${domain}`)) {
      return domain;
    }
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    // Pass through internal origin fetches to prevent redirect loops
    if (request.headers.get(INTERNAL_HEADER)) {
      return fetch(request);
    }

    const url = new URL(request.url);
    const hostname = url.hostname;
    const rootDomain = getRootDomain(hostname);

    if (!rootDomain) {
      return fetch(request);
    }

    // Check if this is a subdomain request
    if (hostname.endsWith(`.${rootDomain}`) && hostname !== `www.${rootDomain}`) {
      return handleSubdomain(request, url, hostname, rootDomain);
    }

    // Check if this is a path that should redirect to subdomain
    if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
      return handleMainDomain(request, url, rootDomain);
    }

    // Fallback: pass through
    return fetch(request);
  }
};

/**
 * Handle subdomain requests: foo.example.com → serve index.html
 * The SPA will detect the subdomain and load the correct page content
 * Exception: nuclear.bennyhartnett.com → serve nuclear.html directly (standalone page)
 */
async function handleSubdomain(request, url, hostname, rootDomain) {
  const subdomain = hostname.replace(`.${rootDomain}`, '');

  // For static assets on subdomain, try to fetch from main domain
  // NOTE: .html is included to allow SPA to fetch page fragments (e.g., pages/contact.html)
  const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|pdf|webp|html)$/i);

  if (isStaticAsset) {
    // Fetch static asset from main domain
    const assetUrl = new URL(url);
    assetUrl.hostname = rootDomain;

    const headers = new Headers(request.headers);
    headers.set(INTERNAL_HEADER, '1');

    return fetch(assetUrl.toString(), {
      method: request.method,
      headers: headers,
    });
  }

  // Redirect thank-you subdomain to sent subdomain (at root)
  if (subdomain === 'thank-you') {
    return Response.redirect(`https://sent.${rootDomain}/`, 301);
  }

  // Nuclear subdomain (and centrus alias): serve nuclear.html directly (it's a standalone page, not an SPA fragment)
  if (subdomain === 'nuclear' || subdomain === 'centrus') {
    const nuclearUrl = new URL(url);
    nuclearUrl.hostname = rootDomain;
    nuclearUrl.pathname = '/nuclear.html';
    nuclearUrl.search = '';

    const headers = new Headers(request.headers);
    headers.set(INTERNAL_HEADER, '1');

    return fetch(nuclearUrl.toString(), {
      method: request.method,
      headers: headers,
    });
  }

  // For all other requests (HTML pages), serve index.html from main domain
  // The SPA will detect the subdomain via window.location.hostname and load correct content
  const indexUrl = new URL(url);
  indexUrl.hostname = rootDomain;
  indexUrl.pathname = '/';
  indexUrl.search = '';

  const headers = new Headers(request.headers);
  headers.set(INTERNAL_HEADER, '1');

  const response = await fetch(indexUrl.toString(), {
    method: request.method,
    headers: headers,
  });

  return response;
}

/**
 * Handle main domain paths: example.com/foo → redirect to foo.example.com
 */
async function handleMainDomain(request, url, rootDomain) {
  const pathParts = url.pathname.split('/').filter(Boolean);

  // No path or root - pass through
  if (pathParts.length === 0) {
    return fetch(request);
  }

  let firstSegment = pathParts[0];

  // Check if this path should be excluded from subdomain redirect
  if (isExcludedPath(firstSegment)) {
    return fetch(request);
  }

  // Handle .html extension: strip it and redirect to subdomain
  // e.g., /nuclear.html → nuclear.bennyhartnett.com
  if (firstSegment.endsWith('.html')) {
    firstSegment = firstSegment.slice(0, -5); // Remove '.html'
  } else if (firstSegment.includes('.')) {
    // Other file extensions (non-.html) should pass through
    return fetch(request);
  }

  // Redirect to subdomain
  const newUrl = new URL(url);
  newUrl.hostname = `${firstSegment}.${rootDomain}`;

  // Remove the first path segment since it's now the subdomain
  pathParts.shift();
  newUrl.pathname = '/' + pathParts.join('/');

  return Response.redirect(newUrl.toString(), 301);
}

/**
 * Check if a path segment should be excluded from subdomain treatment
 */
function isExcludedPath(segment) {
  const lower = segment.toLowerCase();
  return EXCLUDED_PATHS.some(excluded =>
    lower === excluded || lower.startsWith(excluded)
  );
}
