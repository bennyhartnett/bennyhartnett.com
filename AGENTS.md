# Agent Instructions

This file provides development instructions for AI coding agents (Cursor, Copilot, Windsurf, Cline, etc.). For Claude Code specifically, see `CLAUDE.md` which contains the same content plus Claude-specific hooks.

## Quick Start

```bash
npm ci          # Install dependencies (vitest for testing)
npm test        # Run unit tests (nuclear-math tests via vitest)
```

No build step is required — all frontend dependencies load from CDNs.

## Code Style

- 2 spaces indentation (no tabs)
- Semicolons always
- Single quotes in JS, double quotes in HTML attributes
- LF line endings
- Trailing newline on all files
- Prefer `const` over `let`; avoid `var`
- ES6 modules with `export function` / `export const`

See `.editorconfig` for editor-enforced settings.

## Testing

Tests use Vitest and live in `nuclear/nuclear-math.test.js`.

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## Pre-Commit Checklist

1. `npm test` passes
2. If you modified HTML, JS, CSS, or assets: **increment `CACHE_VERSION`** in `sw.js`
3. If you added a new page: update `sw.js` `STATIC_ASSETS` array
4. If you modified `config/llms.txt` or `config/llms-full.txt`: update the "Last Updated" date

## Architecture

This site uses a hybrid routing system: Cloudflare Workers (edge) + client-side SPA.

- `index.html` — SPA entry point, detects subdomain via `location.hostname`, loads `pages/*.html`
- `workers/router.js` — Cloudflare Worker that redirects path URLs to subdomains
- `sw.js` — Service worker with versioned cache for PWA offline support
- `pages/*.html` — Content fragments (18 pages) loaded dynamically by the SPA
- `nuclear/` — **Standalone** uranium enrichment calculator (intentionally separate from SPA)
- `js/` — SPA modules: routing, meta tags, analytics, 3D wave background, cursor effects
- `css/` — Stylesheets: main, components, animations, scrollbar

### Routing Rules

- Subdomain access: `contact.bennyhartnett.com` serves `pages/contact.html` via SPA
- Path access: `bennyhartnett.com/contact` → 301 redirect to `contact.bennyhartnett.com`
- Excluded paths: `/assets`, `/css`, `/js`, `/pages`, `/.well-known` bypass subdomain logic

### DO NOT

- Refactor the nuclear calculator (`nuclear/`) into the SPA — it is intentionally siloed with its own CSS (Tailwind), JS, and tests
- Hardcode paths in navigation — use subdomain-aware link handling
- Modify `workers/router.js` without understanding the `X-CF-Worker-Internal` redirect loop prevention

### Adding a New Page

1. Create `pages/newpage.html` (content fragment)
2. Routing automatically supports `newpage.bennyhartnett.com` and `bennyhartnett.com/newpage`
3. Update `sw.js` `STATIC_ASSETS` for offline caching
4. Increment `CACHE_VERSION` in `sw.js`
