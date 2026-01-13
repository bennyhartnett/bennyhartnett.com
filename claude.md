# Claude Code Instructions

## Cache Busting and Versioning

**IMPORTANT:** Every commit that modifies code must include version bumps to prevent cached old code from being displayed in the PWA.

### Version Locations to Update

When making changes to the nuclear calculator app, you MUST update these version numbers:

1. **`sw.js` - Service Worker Cache Version (Line 3)**
   ```javascript
   const CACHE_VERSION = 'v5';  // Increment this number
   ```

2. **`nuclear.html` - Script Query Parameter (Line ~1791)**
   ```html
   <script src="nuclear.js?v=5"></script>  <!-- Increment this number -->
   ```

3. **`manifest.webmanifest` - App Version (Line 4)**
   ```json
   "version": "1.0.5"  // Increment patch version
   ```

### Version Numbering Convention

- **Service Worker (`sw.js`):** Use `v{N}` format (e.g., `v5`, `v6`, `v7`)
- **Script Query (`nuclear.html`):** Use integer matching SW version (e.g., `?v=5`, `?v=6`)
- **Manifest Version:** Use semver format `1.0.{N}` matching the other versions

### Why This Matters

The SWU Calculator is a Progressive Web App (PWA) that can be installed on mobile devices. Without proper cache busting:
- Users will see stale/old code
- Bug fixes won't reach users until they manually clear app data
- The service worker will continue serving cached files

### Commit Checklist

Before committing changes to `nuclear.js`, `nuclear.html`, or any PWA-related files:

- [ ] Increment `CACHE_VERSION` in `sw.js`
- [ ] Increment `?v=` query parameter in `nuclear.html`
- [ ] Increment `version` in `manifest.webmanifest`
- [ ] All three version numbers should use the same increment number

### Example

If current versions are `v5`, `?v=5`, and `1.0.5`, after making changes they should all become `v6`, `?v=6`, and `1.0.6`.
