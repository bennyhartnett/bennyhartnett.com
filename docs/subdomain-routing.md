# Subdomain Routing Architecture

This document explains the hybrid subdomain routing system used by `bennyhartnett.com`. It combines a **Cloudflare Worker** (edge-side routing) with a **client-side SPA router** (in-browser page loading). The system maps subdomains to content pages: `contact.bennyhartnett.com` serves the contact page, `projects.bennyhartnett.com` serves the projects page, etc.

---

## Table of Contents

- [High-Level Flow](#high-level-flow)
- [Infrastructure Requirements](#infrastructure-requirements)
- [Component 1: Cloudflare Worker (Edge Router)](#component-1-cloudflare-worker-edge-router)
  - [Worker Configuration](#worker-configuration)
  - [Request Routing Logic](#request-routing-logic)
  - [Subdomain Handler](#subdomain-handler)
  - [Main Domain Handler (Path → Subdomain Redirect)](#main-domain-handler-path--subdomain-redirect)
  - [Internal Fetch Header (Loop Prevention)](#internal-fetch-header-loop-prevention)
  - [Static Asset Proxying](#static-asset-proxying)
  - [Excluded Paths](#excluded-paths)
- [Component 2: Client-Side SPA Router](#component-2-client-side-spa-router)
  - [Subdomain Detection](#subdomain-detection)
  - [Page Fragment Loading](#page-fragment-loading)
  - [Link Interception](#link-interception)
  - [History API Integration](#history-api-integration)
  - [Prefetching](#prefetching)
- [Component 3: GitHub Pages 404 Fallback](#component-3-github-pages-404-fallback)
- [Component 4: Service Worker (PWA Caching)](#component-4-service-worker-pwa-caching)
- [Full Request Lifecycle Examples](#full-request-lifecycle-examples)
- [Adding a New Page](#adding-a-new-page)
- [Standalone Pages (Non-SPA)](#standalone-pages-non-spa)
- [DNS Configuration](#dns-configuration)
- [Edge Cases and Gotchas](#edge-cases-and-gotchas)

---

## High-Level Flow

```
Browser requests: contact.bennyhartnett.com
         │
         ▼
┌─────────────────────────────┐
│    Cloudflare DNS + Worker   │  ← Wildcard DNS (*.bennyhartnett.com → CF)
│                              │
│  1. Is it a subdomain?       │  ← Yes: contact.bennyhartnett.com
│  2. Is the path a static     │
│     asset (.js, .css, etc)?  │  ← No: it's the root path "/"
│  3. Is it a standalone page  │
│     (e.g., nuclear)?         │  ← No
│  4. Fetch index.html from    │
│     the main domain origin   │  ← Fetches bennyhartnett.com/index.html
│     with X-CF-Worker-Internal│     using internal header to prevent
│     header                   │     redirect loops
│                              │
└──────────────┬───────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Browser receives index.html │
│   (served on contact.         │
│    bennyhartnett.com)         │
│                               │
│   SPA Router boots:           │
│   1. Reads location.hostname  │  ← "contact.bennyhartnett.com"
│   2. Extracts subdomain       │  ← "contact"
│   3. Fetches pages/contact.   │
│      html via AJAX            │  ← fetch("pages/contact.html")
│   4. Injects HTML into        │
│      <main id="main-content"> │
│   5. Updates meta tags, URL,  │
│      analytics                │
└───────────────────────────────┘
```

For path-based access:

```
Browser requests: bennyhartnett.com/contact
         │
         ▼
┌─────────────────────────────┐
│    Cloudflare Worker          │
│                               │
│  1. Is it a subdomain? No.    │
│  2. Is it the main domain     │
│     with a path? Yes.         │
│  3. Is "/contact" excluded?   │  ← No (not in EXCLUDED_PATHS)
│  4. 301 redirect →            │
│     contact.bennyhartnett.com │
└───────────────────────────────┘
```

---

## Infrastructure Requirements

| Component | Purpose |
|-----------|---------|
| **Cloudflare** (or equivalent edge platform) | DNS, SSL, Workers runtime |
| **Wildcard DNS record** | `*.bennyhartnett.com` → Cloudflare proxy |
| **Wildcard SSL certificate** | Covers `*.bennyhartnett.com` (Cloudflare provides this) |
| **Static file hosting** (GitHub Pages) | Origin server for HTML/CSS/JS/assets |
| **Cloudflare Worker** | Edge routing logic (subdomain detection, redirects, asset proxying) |

---

## Component 1: Cloudflare Worker (Edge Router)

**File:** `workers/router.js`

This worker intercepts every HTTP request to the domain and any subdomain. It runs at the CDN edge before the request hits the origin server.

### Worker Configuration

**File:** `wrangler.toml`

```toml
name = "bennyhartnett-router"
main = "workers/router.js"
compatibility_date = "2024-01-01"

routes = [
  { pattern = "bennyhartnett.com/*", zone_name = "bennyhartnett.com" },
  { pattern = "*.bennyhartnett.com/*", zone_name = "bennyhartnett.com" }
]
```

The two route patterns ensure the worker runs on both:
- The bare domain (`bennyhartnett.com/*`)
- All subdomains (`*.bennyhartnett.com/*`)

### Request Routing Logic

The worker's `fetch` handler classifies every request into one of three categories:

```
request
  │
  ├─ Has X-CF-Worker-Internal header? → Pass through (internal fetch)
  │
  ├─ hostname ends with .bennyhartnett.com
  │  AND hostname ≠ www.bennyhartnett.com?
  │  └─→ handleSubdomain()
  │
  ├─ hostname = bennyhartnett.com
  │  OR hostname = www.bennyhartnett.com?
  │  └─→ handleMainDomain()
  │
  └─ Otherwise → Pass through
```

### Subdomain Handler

`handleSubdomain(request, url, hostname)` handles requests to `*.bennyhartnett.com`:

```
subdomain request (e.g., contact.bennyhartnett.com/some/path)
  │
  ├─ Extract subdomain: "contact"
  │
  ├─ Is the requested path a static asset?
  │  (matches: .js, .css, .png, .jpg, .svg, .html, .json, .pdf, etc.)
  │  └─ YES → Rewrite hostname to bennyhartnett.com, fetch from origin
  │           with X-CF-Worker-Internal header
  │           (e.g., contact.bennyhartnett.com/js/app.js
  │            → fetches bennyhartnett.com/js/app.js)
  │
  ├─ Is subdomain = "thank-you"?
  │  └─ YES → 301 redirect to sent.bennyhartnett.com
  │
  ├─ Is subdomain = "nuclear" or "centrus"?
  │  └─ YES → Fetch nuclear.html from origin (standalone page, not SPA)
  │
  └─ Otherwise (normal page) →
     Fetch index.html from bennyhartnett.com/ with internal header
     (The SPA running in index.html will detect the subdomain
      and load the right page fragment)
```

**Key detail: static assets include `.html`** because the SPA needs to fetch page fragments (e.g., `pages/contact.html`) from within subdomain-hosted `index.html`. Without this, `fetch("pages/contact.html")` from `contact.bennyhartnett.com` would fail.

### Main Domain Handler (Path → Subdomain Redirect)

`handleMainDomain(request, url)` handles requests to `bennyhartnett.com/*`:

```
main domain request (e.g., bennyhartnett.com/contact)
  │
  ├─ No path (root "/")? → Pass through to origin
  │
  ├─ Extract first path segment: "contact"
  │
  ├─ Is it an excluded path (assets, css, js, pages, etc.)?
  │  └─ YES → Pass through to origin
  │
  ├─ Does it end in .html?
  │  └─ YES → Strip .html, redirect to subdomain
  │     (e.g., /nuclear.html → nuclear.bennyhartnett.com)
  │
  ├─ Does it contain a dot (non-.html extension)?
  │  └─ YES → Pass through (it's a file, not a page name)
  │
  └─ 301 redirect to {segment}.bennyhartnett.com
     Remaining path segments are preserved.
     (e.g., /contact → contact.bennyhartnett.com/)
```

### Internal Fetch Header (Loop Prevention)

The worker uses a custom header `X-CF-Worker-Internal` to prevent infinite redirect loops. Here's the problem it solves:

1. User visits `contact.bennyhartnett.com`
2. Worker needs to serve `index.html` from origin
3. Worker fetches `bennyhartnett.com/` internally
4. **Without the header**, this fetch would hit the worker again and the worker would try to handle it as a main domain request
5. **With the header**, the worker sees `X-CF-Worker-Internal: 1` and passes the request directly to the origin server

```javascript
// When making internal origin fetches:
const headers = new Headers(request.headers);
headers.set('X-CF-Worker-Internal', '1');

// At the top of the fetch handler:
if (request.headers.get('X-CF-Worker-Internal')) {
  return fetch(request);  // Pass directly to origin
}
```

### Static Asset Proxying

When a browser loads `contact.bennyhartnett.com`, the HTML it receives is `index.html` from the main domain. All relative asset references in that HTML (e.g., `<link href="css/main.css">`) will resolve against `contact.bennyhartnett.com`, not `bennyhartnett.com`.

The worker handles this transparently: any request to a subdomain whose path matches a static file extension gets rewritten to the main domain:

```
contact.bennyhartnett.com/css/main.css
  → fetches bennyhartnett.com/css/main.css (with internal header)
  → returns the CSS file

contact.bennyhartnett.com/pages/contact.html
  → fetches bennyhartnett.com/pages/contact.html (with internal header)
  → returns the page fragment
```

The matched extensions are:
```
.js .css .png .jpg .jpeg .gif .svg .ico .woff .woff2 .ttf .eot .json .pdf .webp .html
```

### Excluded Paths

These path prefixes are never treated as subdomain names and always pass through to the origin:

```javascript
const EXCLUDED_PATHS = [
  'index.html', 'sw.js', 'manifest.json', 'favicon',
  'assets', 'images', 'css', 'js', 'pages', '.well-known'
];
```

This prevents requests like `bennyhartnett.com/assets/logo.png` from redirecting to `assets.bennyhartnett.com`.

---

## Component 2: Client-Side SPA Router

**File:** `js/spa-router.js`

The SPA router runs inside `index.html` in the browser. It detects which page to display by reading `location.hostname`.

### Subdomain Detection

On page load, the router calls `getInitialPage()`:

```javascript
function getInitialPage() {
  let initial = 'pages/home.html';
  const hostname = location.hostname;
  const rootDomain = 'bennyhartnett.com';
  const isSubdomain = hostname.endsWith('.' + rootDomain)
                   && hostname !== 'www.' + rootDomain;

  if (isSubdomain) {
    const subdomain = hostname.replace('.' + rootDomain, '');
    // "nuclear" gets its own standalone HTML; all others are SPA fragments
    initial = subdomain === 'nuclear'
      ? 'nuclear.html'
      : 'pages/' + subdomain + '.html';
  } else {
    // Fallback: check for SPA redirect from 404.html,
    // URL path, or hash fragment
    // ...
  }
  return initial;
}
```

The detection logic priority:
1. **Subdomain** → Extract name, map to `pages/{name}.html`
2. **Session storage redirect** → Set by `404.html` for GitHub Pages routing
3. **URL path** → `/contact` maps to `pages/contact.html`
4. **URL hash** → `#contact` maps to `pages/contact.html` (legacy support)
5. **Default** → `pages/home.html`

### Page Fragment Loading

Page fragments are HTML files in the `pages/` directory. They contain only the content markup -- no `<html>`, `<head>`, or `<body>` tags. They rely on styles and scripts already loaded by `index.html`.

The `loadContent(url)` function:

1. Optionally plays an exit animation (CSS class `page-exit`)
2. Checks the prefetch cache for a cached copy
3. If not cached, fetches the fragment via `fetch(url)`
4. Injects the HTML into `<main id="main-content">`
5. Re-executes any `<script>` tags in the fragment (by cloning them into new `<script>` elements)
6. Updates `<meta>` tags (title, description, Open Graph, canonical URL)
7. Fires a Google Analytics page view
8. Pushes a clean URL to the browser history via `history.pushState()`

```javascript
// Simplified flow:
fetch('pages/contact.html')
  .then(r => r.text())
  .then(html => {
    container.innerHTML = html;
    // Re-execute scripts, update meta, push history state
  });
```

### Link Interception

The SPA intercepts all `<a>` clicks via a delegated event listener on `document.body`:

```javascript
document.body.addEventListener('click', handleLinkClick);
```

Link handling rules:
- **`data-external="true"`** → Opens in new tab (`window.open`)
- **`/nuclear`** → Full page navigation to `nuclear.bennyhartnett.com` (standalone page)
- **`/` or `/home`** → Full navigation to `bennyhartnett.com`
- **`/contact`** (any clean URL) → Redirects to `contact.bennyhartnett.com` (full navigation, not SPA transition)
- **Excluded paths** (`/assets`, `/css`, etc.) → Default browser behavior

Links use `data-href` attributes instead of `href` to prevent the browser from showing the URL in the status bar on hover:

```html
<a data-href="/contact">Contact</a>
```

### History API Integration

When content loads, the router pushes a clean URL:
```javascript
const cleanUrl = url === 'pages/home.html' ? '/' : '/' + url.replace('pages/', '').replace('.html', '');
history.pushState({ url }, '', cleanUrl);
```

On browser back/forward (`popstate` event), the router loads the page from the stored state:
```javascript
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.url) {
    loadContent(e.state.url, false);
  }
});
```

### Prefetching

During browser idle time, the router prefetches likely navigation targets into an in-memory cache:

```javascript
const prefetchTargets = ['pages/home.html', 'pages/projects.html', 'pages/contact.html'];
requestIdleCallback(() => {
  prefetchTargets.forEach(target => {
    fetch(target, { priority: 'low' }).then(r => r.text()).then(html => {
      prefetchCache.set(target, html);
    });
  });
});
```

When a user navigates to a prefetched page, `loadContent()` reads from the cache instead of making a network request.

---

## Component 3: GitHub Pages 404 Fallback

**File:** `404.html`

GitHub Pages doesn't support dynamic routing. If someone navigates to `bennyhartnett.com/contact` and the Cloudflare Worker is somehow bypassed (or during local development), GitHub Pages would return a 404. The `404.html` page handles this:

1. GitHub Pages serves `404.html` for any path that doesn't match a real file
2. `404.html` stores the requested path in `sessionStorage`
3. It redirects to the root `/`
4. `index.html` loads, the SPA router checks `sessionStorage` for the redirect, and loads the correct page

This is a fallback mechanism. In production, the Cloudflare Worker handles all routing and this path is rarely triggered.

---

## Component 4: Service Worker (PWA Caching)

**File:** `sw.js`

The service worker provides offline support and performance caching. It uses a **versioned cache** (`CACHE_VERSION`) that must be incremented whenever files change.

Caching strategy:
- **HTML, JS, CSS**: Network-first (always try fresh, fall back to cache)
- **Images and other assets**: Cache-first (use cache, fall back to network)
- **CDN resources** (fonts, libraries): Cache-first
- **Non-GET requests**: Pass through

The `STATIC_ASSETS` array lists all files to pre-cache during service worker installation.

---

## Full Request Lifecycle Examples

### Example 1: First visit to `contact.bennyhartnett.com`

```
1. DNS:  *.bennyhartnett.com → Cloudflare proxy IP
2. TLS:  Wildcard cert covers contact.bennyhartnett.com
3. CF Worker:
   - hostname = "contact.bennyhartnett.com"
   - Is subdomain? Yes (ends with .bennyhartnett.com, not www)
   - Path "/" is not a static asset
   - Subdomain "contact" is not "nuclear" or "centrus"
   - Fetch https://bennyhartnett.com/ with X-CF-Worker-Internal: 1
   - Return index.html content
4. Browser:
   - Receives index.html
   - Parses HTML, loads CSS from contact.bennyhartnett.com/css/main.css
     (Worker proxies this to bennyhartnett.com/css/main.css)
   - SPA router initializes
   - getInitialPage() detects subdomain "contact"
   - loadContent("pages/contact.html") fires
   - fetch("pages/contact.html") hits Worker
     (Worker proxies to bennyhartnett.com/pages/contact.html)
   - Contact page HTML injected into <main>
   - Meta tags updated, analytics fired
   - Service worker installed, assets pre-cached
```

### Example 2: Visiting `bennyhartnett.com/contact`

```
1. CF Worker:
   - hostname = "bennyhartnett.com"
   - Path = "/contact"
   - First segment "contact" is not in EXCLUDED_PATHS
   - "contact" doesn't end in .html
   - "contact" doesn't contain a dot
   - 301 redirect → https://contact.bennyhartnett.com/
2. Browser follows redirect → same flow as Example 1
```

### Example 3: Visiting `nuclear.bennyhartnett.com`

```
1. CF Worker:
   - hostname = "nuclear.bennyhartnett.com"
   - Is subdomain? Yes
   - Path "/" is not a static asset
   - Subdomain is "nuclear" → standalone page
   - Fetch https://bennyhartnett.com/nuclear.html with internal header
   - Return nuclear.html content directly (NOT index.html)
2. Browser:
   - Receives nuclear.html (self-contained page with its own CSS/JS)
   - No SPA router involved
```

### Example 4: Static asset on subdomain

```
1. Browser (on contact.bennyhartnett.com) requests: /js/spa-router.js
2. CF Worker:
   - hostname = "contact.bennyhartnett.com"
   - Path = "/js/spa-router.js"
   - Matches static asset regex (.js extension)
   - Rewrite URL to bennyhartnett.com/js/spa-router.js
   - Fetch with X-CF-Worker-Internal header
   - Return the JS file
```

---

## Adding a New Page

To add a page accessible at `newpage.bennyhartnett.com`:

1. **Create the page fragment**: `pages/newpage.html`
   - Content only, no `<html>` / `<head>` / `<body>` wrapper
   - Can include `<style>` and `<script>` tags (scripts will be re-executed by the SPA)

2. **Routing is automatic**:
   - `newpage.bennyhartnett.com` → Worker serves `index.html` → SPA loads `pages/newpage.html`
   - `bennyhartnett.com/newpage` → Worker redirects to `newpage.bennyhartnett.com`

3. **Update the service worker** (`sw.js`):
   - Add `/pages/newpage.html` to the `STATIC_ASSETS` array
   - Increment `CACHE_VERSION`

4. **Optional: Add meta tags** in `js/meta-manager.js` for SEO (title, description, Open Graph)

5. **Optional: Add to prefetch list** in `js/spa-router.js` if it's a common navigation target

No changes to the Cloudflare Worker or `wrangler.toml` are needed.

---

## Standalone Pages (Non-SPA)

Some pages are served directly as full HTML documents, bypassing the SPA framework entirely. These are configured as special cases in the worker's `handleSubdomain()` function.

Example: `nuclear.bennyhartnett.com` serves `nuclear.html` directly. The worker fetches `nuclear.html` from the origin instead of `index.html`, so the SPA router never runs.

To add a new standalone page:

1. Create `newstandalone.html` in the root directory (not in `pages/`)
2. Add a condition in `handleSubdomain()`:
   ```javascript
   if (subdomain === 'newstandalone') {
     const standaloneUrl = new URL(url);
     standaloneUrl.hostname = ROOT_DOMAIN;
     standaloneUrl.pathname = '/newstandalone.html';
     standaloneUrl.search = '';
     const headers = new Headers(request.headers);
     headers.set(INTERNAL_HEADER, '1');
     return fetch(standaloneUrl.toString(), {
       method: request.method,
       headers: headers,
     });
   }
   ```
3. Deploy the updated worker with `wrangler deploy`

---

## DNS Configuration

The system requires:

| Record Type | Name | Value | Proxy |
|-------------|------|-------|-------|
| A | `bennyhartnett.com` | Origin IP (e.g., GitHub Pages) | Proxied (orange cloud) |
| CNAME | `*` | `bennyhartnett.com` | Proxied (orange cloud) |

The wildcard CNAME (`*`) ensures that all subdomains resolve to Cloudflare, where the Worker can intercept them. Cloudflare's universal SSL provides wildcard certificate coverage.

---

## Edge Cases and Gotchas

### Redirect Loops
If you forget the `X-CF-Worker-Internal` header when the worker fetches from the origin, you'll get an infinite loop: worker fetches `bennyhartnett.com/` → hits the worker again → fetches again → etc.

### `www` Subdomain
`www.bennyhartnett.com` is explicitly excluded from subdomain handling. It's treated the same as the bare domain.

### .html Extension in Paths
`bennyhartnett.com/nuclear.html` → the worker strips `.html` and redirects to `nuclear.bennyhartnett.com`. Other file extensions (e.g., `bennyhartnett.com/file.pdf`) pass through to the origin.

### Service Worker Cache Staleness
The service worker caches aggressively. If you update files but don't increment `CACHE_VERSION` in `sw.js`, users with the PWA installed will see stale content until the old cache expires or they manually clear it.

### Cross-Origin Considerations
Since `contact.bennyhartnett.com` and `bennyhartnett.com` are different origins, `fetch()` calls from the SPA to load page fragments are technically cross-origin. The worker handles this by proxying the requests, making them appear same-origin to the browser (the response comes from `contact.bennyhartnett.com`).

### Subdomain Aliases
The worker supports aliases: `centrus.bennyhartnett.com` → serves `nuclear.html` (same as `nuclear.bennyhartnett.com`). And `thank-you.bennyhartnett.com` → 301 redirects to `sent.bennyhartnett.com`.

### Static Asset Regex Includes .html
The static asset detection intentionally includes `.html` files. This is critical: the SPA fetches `pages/contact.html` via AJAX from within `contact.bennyhartnett.com`. Without `.html` in the static asset list, this fetch would return `index.html` again instead of the fragment, causing an infinite loading issue.
