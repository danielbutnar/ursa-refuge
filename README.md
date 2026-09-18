# Ursa: a mountain refuge (concept)

A concept booking site for a fictional stone refuge at 1,842 m in the Făgăraș Mountains, Romania, built as a portfolio piece. There are no photographs: the topographic map, floor plan, elevation profiles and night sky are all drawn in the browser with canvas and SVG.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies, no cookies, no third-party requests.

## What's on the page

- **Hero map** (`assets/js/terrain.js`): a mountain generated from seeded simplex noise (same mountain every visit), with hillshade, forest, contours from marching squares, a traced stream, and three waymarked routes found with A* over the terrain. Labels place themselves without overlapping. Point at the map to read the height.
- **The climb**: an altimeter and elevation profile that follow your reading position (sticky strip on phones).
- **The refuge**: an SVG floor plan; pointing at a room in the list lights it on the plan.
- **Routes**: the three routes with their painted trail markers and profiles on one shared scale.
- **Night sky** (`assets/js/sky.js`): seeded stars, Milky Way and the Plough; sunset, darkness and moon phase are calculated for the refuge's position and altitude.
- **Booking** (`assets/js/main.js`): a calendar of nights built from radio buttons, with the twelve bunks drawn per night, a live total, and validation. It runs in concept mode: nothing is sent.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The whole story: map, climb, refuge, routes, sky, booking, FAQ |
| `colophon.html` | How it was made (design notes for the portfolio) |
| `privacy.html` | Privacy and cookies (there are none) |
| `404.html` | Not-found page; uses absolute `/ursa-refuge/` paths because GitHub Pages serves it at any depth |
| `assets/css/style.css` | Design system: tokens at the top (map paper, spruce ink, marker red/blue/yellow, night), then components and sections |
| `assets/css/fonts.css`, `assets/fonts/` | Self-hosted Brygada 1918 and Schibsted Grotesk (variable woff2, latin + latin-ext), SIL OFL |
| `assets/js/main.js` | Header, mobile menu, altimeter, floor plan, booking calendar and form, tonight's sky numbers. Settings in `CONFIG` at the top |
| `assets/js/terrain.js` | The generated hero map |
| `assets/js/sky.js` | The night sky canvas |
| `assets/logo/` | Icon (SVG and PNG), Open Graph image |
| `docs/contra/` | Screenshots for the Contra portfolio (not linked from the site) |
| `robots.txt`, `sitemap.xml`, `site.webmanifest`, `.nojekyll`, `.well-known/security.txt` | Hosting and discovery files |
| `vercel.json`, `.vercelignore` | Vercel previews: maps the `/ursa-refuge/` paths used by `404.html` to the root, and leaves `docs/` and notes out of the upload |

## Preview locally

```bash
npx serve .
```

Then open http://localhost:3000. Opening `index.html` straight from disk won't load the fonts, because browsers block font files on `file://` pages.

## Deploy to GitHub Pages

1. Create the repository `ursa-refuge` under the `danielbutnar` account and push `main`.
2. Settings > Pages > Build and deployment: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. The site appears at https://danielbutnar.github.io/ursa-refuge/ within a minute or two.

The canonical URLs, Open Graph URLs, sitemap, `security.txt` and the absolute paths in `404.html` all assume that address. If you deploy somewhere else (a custom domain or another repo name), search for `danielbutnar.github.io/ursa-refuge` and `/ursa-refuge/` and update them.

### Custom domain (optional)

Add a `CNAME` file containing the domain, then at the DNS provider:

- apex: `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` and `AAAA` records to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
- `www`: `CNAME` to `danielbutnar.github.io`

On Cloudflare, leave the apex `A`/`AAAA` records unproxied (grey cloud) so GitHub can issue the certificate, and use SSL mode *Full*.

## Vercel preview

```bash
npx vercel deploy
```

No build step: Vercel serves the folder as is. New Vercel projects protect preview URLs with Vercel Authentication by default; turn it off under Project Settings > Deployment Protection if the preview should be public.

## Things to know

- **It's marked `noindex` on purpose.** Ursa is fictional; it shouldn't turn up when real hikers search for huts in the Făgăraș. Remove the `robots` meta tags if you ever want it indexed.
- **The booking form sends nothing.** To make it real, set `CONFIG.formEndpoint` in `main.js` (for example a FormSubmit AJAX URL) and add that origin to `connect-src` in the Content-Security-Policy of `index.html`.
- **One inline script.** `document.documentElement.classList.add("js")` is allowed by its sha256 hash in every page's CSP. If you change that line, recompute the hash and update all four pages.
- **The map's numbers are real outputs.** Summit height (2,236 m), route lengths and profiles in the Routes section were read off the generated terrain. If you change the terrain in `terrain.js`, re-read them and update the copy.
- **Renewal:** `.well-known/security.txt` expires on 18 September 2027.
