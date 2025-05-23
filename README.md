# BennyHartnett.com

BennyHartnett.com is the source code for Benny Hartnett's personal website. The site is a lightweight collection of static files that showcase contact information, projects, and a few web widgets.

## Directory Structure
All site files live in the repository root:

- `index.html` – Landing page with icon grid
- `email.html`, `gis.html`, `github.html`, `linkedin.html`, `rocketship.html`, `search.html` – individual panels
- `script.js` – Handles interactivity for showing panels, hover effects, and external redirects
- `style.css` – Styles for layout and animations
- `.vscode/` – Editor configuration
- `LICENSE` – Project license
- `searchData.js` – Records used by `search.html`
- `sitemap.xml` – Sitemap for search engines
- `newsfragments/` – Pending release notes

## Development
Open `index.html` directly or start a local server to test cross‑browser links. Run:

```bash
python3 -m http.server
```

and visit `http://localhost:8000` in your browser. The site uses Bootstrap and Remix Icon CDN links, so an internet connection is required for full styling. All pages include canonical links and Open Graph tags, and `robots.txt` plus `sitemap.xml` assist search engines. The landing page also defines Twitter card metadata for rich previews.

The GitHub panel includes a copy button with a prefilled `git clone` command so you can quickly grab the site's source.

## Editing Content
Because the site is entirely static, editing pages is as simple as modifying the
corresponding HTML, CSS or JavaScript file and reloading your browser. The icon
grid on `index.html` links to each panel page. To add a new panel, create a new
`*.html` file and update the grid markup accordingly.

Short text files in the `newsfragments/` folder act as release notes for future
site updates.

## Purpose
This repository hosts Benny's personal site and small experiments. The goal is to keep things simple and easily hackable.

## Features
- Interactive icon grid on the main page
- Dark-themed GIS map using Leaflet and OpenTopoMap
- Search demo backed by `searchData.js`
- Rocketship hardware ideas as an accordion list
- SEO-friendly metadata with canonical links, a sitemap and Twitter card tags

## Contributing
Pull requests are welcome! Fork the repository, create a feature branch, and open a PR describing your change. For larger proposals, open an issue first so we can discuss.

 
## License
This project is released under the MIT License. See [LICENSE](LICENSE) for details.
 
 
