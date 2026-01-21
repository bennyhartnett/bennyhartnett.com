# Development Instructions

## Subdomain Routing Architecture

This site uses a **hybrid routing system** with Cloudflare Workers + client-side SPA logic. **Read this before making routing changes.**

### How It Works

```
User Request
    │
    ├─→ foo.bennyhartnett.com (subdomain)
    │   └─→ Cloudflare Worker serves index.html
    │       └─→ index.html detects subdomain via location.hostname
    │           └─→ Loads pages/foo.html via fetch
    │
    └─→ bennyhartnett.com/foo (path)
        └─→ Cloudflare Worker 301 redirects to foo.bennyhartnett.com
```

### Key Files

| File | Purpose |
|------|---------|
| `workers/router.js` | **Edge routing** - Cloudflare Worker that handles subdomain↔path routing |
| `wrangler.toml` | Cloudflare Workers configuration |
| `index.html` | **SPA entry point** - Client-side page loading based on subdomain/path |
| `sw.js` | Service Worker for caching |
| `404.html` | GitHub Pages fallback routing |
| `pages/*.html` | Content fragments loaded by the SPA |
| `nuclear.html` | **Standalone page** (not an SPA fragment) |

### Bidirectional Routing Rules

1. **Subdomain → Serves content**: `contact.bennyhartnett.com` serves `pages/contact.html` via SPA
2. **Path → Redirects to subdomain**: `bennyhartnett.com/contact` → 301 redirect to `contact.bennyhartnett.com`
3. **Static assets on subdomains**: Fetched from main domain (URL rewrite)

### Special Cases

- **nuclear.bennyhartnett.com**: Serves `nuclear.html` directly (standalone, not SPA fragment)
- **Excluded paths**: `/assets`, `/css`, `/js`, `/pages`, `/.well-known` bypass subdomain logic

### Adding a New Page

1. Create `pages/newpage.html` (content fragment)
2. The routing automatically supports:
   - `newpage.bennyhartnett.com` (subdomain access)
   - `bennyhartnett.com/newpage` (redirects to subdomain)
3. Update `sw.js` STATIC_ASSETS if you want offline caching
4. Increment `CACHE_VERSION` in `sw.js`

### Common Pitfalls

- **Don't hardcode paths in navigation** - Use subdomain-aware link handling in `index.html`
- **Don't modify `workers/router.js`** without understanding the redirect loop prevention (`X-CF-Worker-Internal` header)
- **Static files must be listed** in the worker's `staticExtensions` array to be served correctly on subdomains

---

## PWA Cache Management

**IMPORTANT**: When making any changes to the site (HTML, JS, CSS, or other assets), you MUST increment the `CACHE_VERSION` in `sw.js` to ensure changes are immediately visible on the iPhone app and web.

### Steps:
1. Make your code changes
2. Open `sw.js` and increment `CACHE_VERSION` (e.g., `'v6'` -> `'v7'`)
3. Commit and push

The service worker uses this version to bust the cache. Without incrementing the version, users may see stale cached content.
