# FederalInnovations

This repository contains a small set of static web pages. The main page uses [three.js](https://threejs.org/) to render an animated wave background and includes a fixed navigation bar with responsive styling.

## Usage

Simply open `index.html` in a modern web browser. The page fetches the required modules from a CDN, so no build or installation steps are necessary.

Mouse movement influences the animation, causing waves to react in real time. Navigation links are placeholders that can be updated for your specific content.

## Repository Layout

- `index.html` – Main landing page with the wave animation.
- `home.html` – A simple home page with contact links.
- `gis.html` – Placeholder page for GIS related work.
- `nuclear.html` – Placeholder page covering nuclear projects.
- `government-contracting.html` – Placeholder page for Government Contracting.
- `generative-ai.html` – Placeholder page discussing generative AI.
- `privacy.html` – Basic privacy policy information.
- `README.md` – This file.

Feel free to modify the HTML and CSS to fit your needs or extend the script for additional effects. Each page is intentionally minimal and can be expanded with your own content.

## Contact

- GitHub: [benyhartnett](https://github.com/benyhartnett)
- LinkedIn: [dev-dc](https://www.linkedin.com/in/dev-dc)

## Local Development

You can quickly preview the site by running a simple HTTP server from the repository root:

```bash
python3 -m http.server
```

Then open `http://localhost:8000` in your browser. Any changes to the files will be reflected immediately when you refresh the page.

### Customizing the Wave Animation

The wave effect on the landing page is controlled by the JavaScript code in `index.html`. Adjust the vertex shader parameters to tweak amplitude or frequency. You can also change the color scheme using CSS variables defined in the `<style>` section.

