/**
 * Cloudflare Worker: Bidirectional subdomain/path routing
 *
 * - foo.bennyhartnett.com → serves /foo/ content
 * - bennyhartnett.com/foo → redirects to foo.bennyhartnett.com
 */

const ROOT_DOMAIN = 'bennyhartnett.com';

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
  '.well-known',
];

export default {
  async fetch(request, env, ctx) {
    // Pass through internal origin fetches to prevent redirect loops
    if (request.headers.get(INTERNAL_HEADER)) {
      return fetch(request);
    }

    const url = new URL(request.url);
    const hostname = url.hostname;

    // Check if this is a subdomain request
    if (hostname.endsWith(`.${ROOT_DOMAIN}`) && hostname !== `www.${ROOT_DOMAIN}`) {
      return handleSubdomain(request, url, hostname);
    }

    // Check if this is a path that should redirect to subdomain
    if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
      return handleMainDomain(request, url);
    }

    // Fallback: pass through
    return fetch(request);
  }
};

/**
 * Handle subdomain requests: foo.bennyhartnett.com → serve /foo/ content
 */
async function handleSubdomain(request, url, hostname) {
  const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, '');

  // Rewrite the URL to fetch from the main domain's path
  const newUrl = new URL(url);
  newUrl.hostname = ROOT_DOMAIN;

  // Prepend the subdomain as a path
  if (url.pathname === '/') {
    newUrl.pathname = `/${subdomain}/`;
  } else {
    newUrl.pathname = `/${subdomain}${url.pathname}`;
  }

  // Fetch from origin with rewritten path
  // Add internal header to prevent redirect loop
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_HEADER, '1');

  const response = await fetch(newUrl.toString(), {
    method: request.method,
    headers: headers,
    body: request.body,
  });

  return response;
}

/**
 * Handle main domain paths: bennyhartnett.com/foo → redirect to foo.bennyhartnett.com
 */
async function handleMainDomain(request, url) {
  const pathParts = url.pathname.split('/').filter(Boolean);

  // No path or root - pass through
  if (pathParts.length === 0) {
    return fetch(request);
  }

  const firstSegment = pathParts[0];

  // Check if this path should be excluded from subdomain redirect
  if (isExcludedPath(firstSegment)) {
    return fetch(request);
  }

  // Check if the path looks like a file (has extension)
  if (firstSegment.includes('.')) {
    return fetch(request);
  }

  // Redirect to subdomain
  const newUrl = new URL(url);
  newUrl.hostname = `${firstSegment}.${ROOT_DOMAIN}`;

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
