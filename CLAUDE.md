# Development Instructions

## Quick Start

```bash
npm ci          # Install dependencies (vitest for testing)
npm test        # Run unit tests (nuclear-math tests via vitest)
npm run test:watch  # Run tests in watch mode
```

No build step is required — all frontend dependencies load from CDNs. To preview the site locally:

```bash
python3 -m http.server  # Serve at http://localhost:8000
```

## Code Style

- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Always
- **Quotes**: Single quotes in JS, double quotes in HTML attributes
- **Line endings**: LF (Unix)
- **Trailing newline**: Yes, all files end with a newline
- **Variables**: Prefer `const` over `let`; avoid `var`
- **Modules**: ES6 modules with `export function` / `export const`

See `.editorconfig` for editor-enforced settings.

## Testing

Tests use [Vitest](https://vitest.dev/) and live in `nuclear/nuclear-math.test.js`. They cover the uranium enrichment math functions (value function, SWU calculations, optimum tails assay, feed/product/waste calculations).

```bash
npm test              # Run all tests once
npm run test:watch    # Run in watch mode
npm run test:coverage # Run with coverage report
```

The test suite also runs in CI via `.github/workflows/test.yml` on every push and PR to `main`.

## Pre-Commit Checklist

Before committing changes, verify:

1. `npm test` passes
2. If you modified any HTML, JS, CSS, or assets: **increment `CACHE_VERSION`** in `sw.js` (e.g., `'v100'` → `'v101'`)
3. If you added a new page: update `sw.js` `STATIC_ASSETS` array and follow the "Adding a New Page" section below
4. If you modified `config/llms.txt` or `config/llms-full.txt`: update the "Last Updated" date at the bottom

---

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

### Nuclear Page Architecture (DO NOT REFACTOR)

The nuclear page (`nuclear.html`, `nuclear.js`, `nuclear-math.js`) is **intentionally siloed** as a completely separate application. This is by design:

- Uses Tailwind CSS (different from main site's custom CSS)
- Self-contained with its own JS modules
- Not integrated into the SPA framework
- Has its own test file (`nuclear-math.test.js`)

**Do not attempt to:**
- Migrate it into the SPA fragment system
- Consolidate its CSS with the main site
- Merge its JS into shared modules
- "Unify" its architecture with the rest of the site

This separation allows the calculator to be developed and maintained independently without risk of breaking the main site.

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
