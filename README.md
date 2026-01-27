# bennyhartnett.com

BennyHartnett.com is a minimalist static website built with plain HTML and a little JavaScript. The landing page uses [three.js](https://threejs.org/) to draw an animated wave background. Because every library loads from public CDNs, you can open the files directly in a browser with no build step required.

## Features

- **Animated wave background** &ndash; `index.html` draws a 3D wave using three.js and `SimplexNoise`. The waves react to mouse movement and smoothly cycle through colors.
- **Responsive navigation** &ndash; On small screens, a hamburger button toggles the navigation links for easier mobile browsing.
- **Modular pages** &ndash; Additional pages (`home.html`, `nuclear.html`, and `privacy.html`) are simple templates that can be edited or replaced.
- **No build step** &ndash; All dependencies load from CDNs, so you can open the files directly or serve them with a simple HTTP server.

## File Overview

- `index.html` &ndash; Entry point that loads `home.html` via `fetch` and initializes the wave canvas.
- `home.html` &ndash; Landing page with quick links such as email, GitHub, and LinkedIn.
- `nuclear.html` &ndash; Placeholder summarizing nuclear projects.
- `privacy.html` &ndash; Static privacy policy.
- `sitemap.xml` &ndash; Search engine sitemap listing all pages.
- `robots.txt` &ndash; Crawling directives that reference the sitemap.
- `.vscode/launch.json` &ndash; VS Code configuration for launching `index.html`.
- `README.md` &ndash; Project documentation.

## Quick Start

Clone or download the repository and start a simple HTTP server from the project root:

```bash
python3 -m http.server
```

Open `http://localhost:8000` in your browser. Because all scripts load from CDNs, no installation is required.

## Customization

- **Navigation links** &ndash; Edit the `<nav>` element in `index.html` to change the menu structure or link targets.
- **Wave parameters** &ndash; Adjust `planeWidth`, `planeHeight`, color values, and the animation loop inside `index.html` to modify the effect.
- **Fonts and styles** &ndash; Each page includes inline CSS that imports Google Fonts. Update these `<style>` blocks to match your branding.
- **Adding content** &ndash; Replace the placeholder text in the individual HTML files or add new pages and update the navigation accordingly.

## Deployment

The site is entirely static, so you can host it anywhere that serves HTML files. Copy the repository contents to your preferred platform&mdash;GitHub Pages, an S3 bucket, Netlify, and so on&mdash;and it will work without additional configuration.

### GitHub Pages

1. Ensure the `gh-pages.yml` workflow is enabled in the repository's **Actions** tab.
2. In the repository **Settings** &rarr; **Pages**, choose **GitHub Actions** as the source.
3. Push changes to the `main` branch and the workflow will automatically deploy the site.

The repository includes a `.nojekyll` file so Pages serves the files as-is.

## Dependencies

The pages load the following libraries from public CDNs:

- `three` and `SimplexNoise` for 3D rendering and noise calculations.
- `es-module-shims` to support modern module syntax across browsers.

## Contact

- GitHub: [bennyhartnett](https://github.com/bennyhartnett)
- LinkedIn: [dev-dc](https://www.linkedin.com/in/dev-dc)
 

## License

This repository currently does not include a license file. If you plan to distribute or reuse the code, consider adding an appropriate license.

---

Feel free to modify any file to suit your needs. The project is intentionally minimal so you can extend it in any direction.
