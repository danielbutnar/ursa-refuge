# Ursa (concept site)

Portfolio concept: a booking site for a fictional mountain refuge in the Făgăraș Mountains. Plain HTML/CSS/JS, no build step, no dependencies, no cookies, no third-party requests. Intended host: GitHub Pages at https://danielbutnar.github.io/ursa-refuge/ (see README for deploy and custom-domain notes).

## Layout
- Pages: `index.html` (everything), `colophon.html` (how it was made), `privacy.html`, `404.html`. Header, sprite `<svg>` symbols and footer are duplicated in each page; change shared chrome everywhere (`rg` first). `404.html` uses absolute `/ursa-refuge/` paths.
- `assets/css/style.css`: tokens first. `--map-*` tokens are read by `terrain.js` at draw time, so map colours and dark mode live in CSS, not JS.
- `assets/js/terrain.js`: seeded terrain, A* routes, contours, labels. `KM_PER_UNIT` sets the ground scale. Route stats, the summit height (2,236 m) and the route profiles in `index.html` were read off this terrain; changing the terrain means re-reading them.
- `assets/js/sky.js`: stars and the Plough; owns the "Pause the stars" button.
- `assets/js/main.js`: `CONFIG` at the top (form endpoint, price, season dates, coordinates).

## Hard rules
- CSP meta on every page. The only inline script is `document.documentElement.classList.add("js")`, allowed by its sha256 hash; recompute and update all pages if it changes. No inline event handlers.
- No third-party assets. Fonts are self-hosted woff2 (Brygada 1918, Schibsted Grotesk).
- Keep the concept honest: "Concept project" tag in the header, the footer note, the concept notice in the form's success state, and `noindex` on every page.
- Tabular figures only on the calendar dates: in Schibsted Grotesk `tnum` also widens commas and full stops ("1 , 120").
- Respect reduced motion (map draws finished, stars don't twinkle) and keep the pause control for the sky.

## Working here
- Preview with `npx serve .`; check 375 px and 1440 px, light and dark, and the console (CSP errors show there).
- Don't commit or push unless asked.
