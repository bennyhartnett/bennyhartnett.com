/**
 * Cloudflare Worker: Bidirectional subdomain/path routing
 *
 * - foo.bennyhartnett.com → serves /pages/foo.html content
 * - bennyhartnett.com/foo → redirects to foo.bennyhartnett.com
 */

const ROOT_DOMAIN = 'bennyhartnett.com';
const INTERNAL_HEADER = 'X-Internal-Fetch';

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Skip redirect logic for internal fetches to prevent loops
    if (request.headers.get(INTERNAL_HEADER)) {
      return fetch(request);
    }

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
 * Handle subdomain requests: foo.bennyhartnett.com → serve /pages/foo.html content
 */
async function handleSubdomain(request, url, hostname) {
  const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, '');

  // Rewrite the URL to fetch from the main domain's /pages/ directory
  const newUrl = new URL(url);
  newUrl.hostname = ROOT_DOMAIN;

  // Map subdomain to /pages/{subdomain}.html
  if (url.pathname === '/' || url.pathname === '') {
    newUrl.pathname = `/pages/${subdomain}.html`;
  } else {
    // For subpaths like contact.bennyhartnett.com/something, pass through
    return fetch(request);
  }

  // Create new headers with internal marker to prevent redirect loops
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_HEADER, 'true');

  // Fetch from origin with rewritten path
  const response = await fetch(newUrl.toString(), {
    method: request.method,
    headers: headers,
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
