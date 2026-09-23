# Ursa (concept site)

Portfolio concept: a booking site for a fictional mountain refuge in the Făgăraș Mountains. Plain HTML/CSS/JS, no build step, no dependencies, no cookies, no third-party requests. Live on GitHub Pages from `main` at https://danielbutnar.github.io/ursa-refuge/ (see README for deploy and custom-domain notes), so a push to `main` publishes it.

## Layout
- Pages: `index.html` (everything), `colophon.html` (how it was made), `privacy.html`, `404.html`. Header, sprite `<svg>` symbols and footer are duplicated in each page; change shared chrome everywhere (`rg` first). `404.html` uses absolute `/ursa-refuge/` paths.
- `assets/css/style.css`: tokens first. `--map-*` tokens are read by `terrain.js` at draw time, so map colours and dark mode live in CSS, not JS.
- `assets/js/terrain.js`: seeded terrain, A* routes, contours, labels. `KM_PER_UNIT` sets the ground scale. Route stats, the summit height (2,236 m) and the route profiles in `index.html` were read off this terrain; changing the terrain means re-reading them.
- `assets/js/sky.js`: stars and the Plough; owns the "Pause the stars" button.
- `assets/js/main.js`: `CONFIG` at the top (form endpoint, price, season dates, coordinates).
- `docs/contra/`: 10 tracked screenshots made for the Contra portfolio listing. No page links to them, but GitHub Pages publishes the whole branch, so they are public under `/ursa-refuge/docs/contra/`. `00-cover*.jpg` are local cover exports and git-ignored; don't commit them or other large images here.
- `vercel.json` and `.vercelignore`: Vercel previews (`npx vercel deploy`, only when asked). The rewrite maps the `/ursa-refuge/` paths of `404.html` to the root; `.vercelignore` keeps `docs/`, `.claude/` and the notes out of the upload. The project link in `.vercel/` is git-ignored.

## Hard rules
- CSP meta on every page. The only inline script is `document.documentElement.classList.add("js")`, allowed by its sha256 hash; recompute and update all pages if it changes. No inline event handlers.
- No third-party assets. Fonts are self-hosted woff2 (Brygada 1918, Schibsted Grotesk).
- Keep the concept honest: "Concept project" tag in the header, the footer note, the concept notice in the form's success state, and `noindex` on every page.
- Tabular figures only on the calendar dates: in Schibsted Grotesk `tnum` also widens commas and full stops ("1 , 120").
- Respect reduced motion (map draws finished, stars don't twinkle) and keep the pause control for the sky.

## Design
Draft 2026-09-23, owner to edit. The tokens in `assets/css/style.css` and the palette and type notes on `colophon.html` are the source of truth; update this section when they change.
- Idea (colophon): the page is the walk, from the car park on a hiking map, up the climb, to the refuge and into the night sky where the booking form is. Visual language: Romanian tourist maps and painted trail markers. No photographs: map, plan, profiles and sky are drawn in SVG and canvas.
- Palette, token → role → hex, day values; dark mode redefines them under `prefers-color-scheme: dark` and the map becomes a night map. The seven colophon swatches are the named colours; style.css records no contrast ratios.
  - `--paper` (map paper) → background → #E9EDE5; `--paper-2` → the refuge section, plan windows → #DDE4D6; `--paper-3` → plan furniture → #CBD5C3.
  - `--ink` (spruce ink) → text → #16261F; `--ink-2` → secondary text → #3E5047.
  - `--red` (marker red) → everything you act on: primary button, the red route, the active waypoint, day focus ring → #C8201A; `--red-hover` #A8170F; `--red-text` → red as text (prose links, lit room, "Book a bunk" in the menu) → #B01D17.
  - `--blue` (marker blue) #1F4E9A and `--yellow` (marker yellow) #EDB60C, stroke `--yellow-line` #B08A00 → only the other two routes and their markers.
  - `--night` #0A1430, `--night-2` #0F1B3C and `--ground` #060B1B → sky, booking, FAQ and footer; `--star` #EEF0E6 → text on night, `--star-2` #A9B3CF → secondary; `--lamp` (window light) #FFC46B → focus ring, selected night and messages on night.
  - Danger on night: error text is the literal #FF9A91, invalid-field border #FF8C82. `--map-*` tokens colour the canvas map (see Layout).
- Type: Brygada 1918 (variable 400-700, with italic) for headings, reading and map names, the italic doubling as cartographic lettering; Schibsted Grotesk (400-900) for data, labels and controls. Headings weight 500; body 1.125rem, 1.0625rem under 640px. No type-scale tokens: sizes are clamps on `.hero__title`, `.h2`, `.lede` and `.page__title`.
- Spacing and radius: `--section` clamp(88px, 11vw, 160px) is the only spacing token; `--wrap` 1320px, `--gutter` clamp(16px, 4vw, 48px), `--header-h` 68px. Radius `--r` 3px; 6px on the tonight card and the form panel; 999px only on the concept tag.
- Motion: `--ease` cubic-bezier(.2, .7, .1, 1). On load the contours rise and the red route draws itself to the refuge; the altimeter follows scroll through the climb; pointing at a room lights it on the plan; the brighter stars twinkle only while on screen; the window lamp glows. No scroll-reveal entrances.
- Voice: British English (`en-GB`), calm and exact: figures with units and non-breaking spaces (1,842 m, 7.4 km, 3 h 45), sentence-case headlines ("Sleep above the treeline."), "you" for the walker, "we" for the refuge. Audience: prospective clients reading a Contra portfolio piece, addressed as hikers booking a bunk. English only, so Sie/tu does not apply. Banned words: none named yet (owner to add).
- Keep: trail markers (red stripe, blue cross, yellow triangle) as the key to every route on the map, the legend and the route list; the map collar (legend, scale, grid reference) along the hero's lower edge; italic serif for the brand name and map labels; the dusk gradient from map paper to night above the booking form; the concept labels listed under Hard rules.
- Avoid: photographs or stock images; anything that softens the concept labels; new hex literals where a token exists.
- References (colophon): Romanian tourist maps, the painted waymarks on the ground, Swiss-map hillshade lit from the north-west. Reference sites: owner to add.
- Tried and rejected: none recorded yet (one direction was built from the 2026-09-18 brief).
- Redesign, new page or new page type: present two or three directions first (4-6 named hex values, type pairing, hero concept as an ASCII wireframe, one sentence on the memorable element) and wait for the owner's pick.
- Mechanical check: `design-lint.json` (web-qa `design-lint.mjs`, a ratchet).

## Working here
- Preview: `.claude/launch.json` config `site` (`npx -y serve@14 -l 5510 .`, http://localhost:5510); plain `npx serve .` uses port 3000. Check 375 px and 1440 px, light and dark, and the console (CSP errors show there).
- Don't commit or push unless asked.
