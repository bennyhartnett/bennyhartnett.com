# Development Instructions

## PWA Cache Management

**IMPORTANT**: When making any changes to the site (HTML, JS, CSS, or other assets), you MUST increment the `CACHE_VERSION` in `sw.js` to ensure changes are immediately visible on the iPhone app and web.

### Steps:
1. Make your code changes
2. Open `sw.js` and increment `CACHE_VERSION` (e.g., `'v6'` -> `'v7'`)
3. Commit and push

The service worker uses this version to bust the cache. Without incrementing the version, users may see stale cached content.
