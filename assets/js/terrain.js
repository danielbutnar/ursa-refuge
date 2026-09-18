/* Ursa — the hero map.
   A made-up mountain, generated from seeded noise so it is the same mountain on every visit,
   drawn the way a Romanian hiking map would draw it: hillshade, forest, contours, the stream,
   and the three waymarked routes (found with A* over the terrain, so they switchback where
   a real path would). Everything is computed once, in a worker; after the intro nothing runs. */
(() => {
  "use strict";

  // This file runs twice: as the page script that draws the map, and as a Web Worker
  // (same URL) that does the terrain maths, so the page stays responsive while it loads.
  const IS_WORKER = typeof document === "undefined";
  const SCRIPT_URL = IS_WORKER ? "" : document.currentScript?.src;

  /* ---------- Seeded simplex noise ---------- */
  const mulberry32 = (a) => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = mulberry32(1842);
  const perm = new Uint8Array(512);
  {
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const GX = [1, -1, 1, -1, 1, -1, 0, 0];
  const GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  function noise(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - i + t;
    const y0 = y - j + t;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = perm[ii + perm[jj]] & 7; t0 *= t0; n += t0 * t0 * (GX[g] * x0 + GY[g] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = perm[ii + i1 + perm[jj + j1]] & 7; t1 *= t1; n += t1 * t1 * (GX[g] * x1 + GY[g] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = perm[ii + 1 + perm[jj + 1]] & 7; t2 *= t2; n += t2 * t2 * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  }

  const fbm = (x, y, octaves) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- The mountain. World units: x east, y south, refuge at 0,0 ---------- */
  // One world unit is 1.72 km on the ground: that makes the red-stripe route the 7.4 km the page promises.
  const KM_PER_UNIT = 1.72;
  const FLOOR = 560;
  const REFUGE_H = 1842;
  const crestY = (x) => -1.85 + 0.3 * Math.sin(x * 0.7 + 0.4) + 0.12 * Math.sin(x * 1.9 + 1.3);
  const crestH = (x) => 2130 + 80 * Math.sin(x * 1.1 + 0.2) + 45 * Math.sin(x * 2.7 + 2);
  const valleyX = (y) => -1.05 + 0.3 * Math.sin(y * 1.3 + 0.5) + 0.1 * Math.sin(y * 3.1 + 1) - 0.1 * y;
  const spurX = (y) => 1.3 + 0.14 * (y + 1.5) + 0.12 * Math.sin(y * 1.7);
  const SUMMIT_GUESS = { x: 1.25, y: -1.55 };

  function raw(x, y) {
    const wx = x + 0.3 * noise(x * 0.45 + 7.1, y * 0.45 - 3.3);
    const wy = y + 0.3 * noise(x * 0.45 - 5.4, y * 0.45 + 9.2);
    const d = wy - crestY(wx);
    const g = d >= 0 ? Math.exp(-Math.pow(d / 3.455, 2.565)) : Math.exp(-((d / 1.05) ** 2));
    let h = FLOOR + (crestH(wx) - FLOOR) * g;
    // relief fades out towards the valley floor, so the lowlands stay calm
    const relief = Math.pow(g, 0.6);
    // spurs and gullies run downslope, so the noise is stretched north–south
    h += 220 * relief * fbm(wx * 1.05, wy * 0.36 + 4, 3);
    // Muchia Lupului, the long spur east of the refuge
    h += 170 * relief * smooth(-2, -0.5, wy) * Math.exp(-(((wx - spurX(wy)) / 0.32) ** 2));
    // Valea Ursului and the cirque at its head
    const vx = valleyX(wy);
    const vw = 0.34 + 0.09 * Math.max(0, wy);
    h -= 250 * smooth(-1.2, 0.4, wy) * Math.exp(-(((wx - vx) / vw) ** 2));
    h -= 170 * Math.exp(-(((wx + 1.05) / 0.75) ** 2 + ((wy + 1.15) / 0.55) ** 2));
    // Vârful Ursoaica
    h += 110 * Math.exp(-(((x - SUMMIT_GUESS.x) / 0.45) ** 2 + ((y - SUMMIT_GUESS.y) / 0.38) ** 2));
    h += 5 * relief * noise(x * 5, y * 5);
    return h;
  }

  const K = (REFUGE_H - FLOOR) / (raw(0, 0) - FLOOR);
  function height(x, y) {
    let h = FLOOR + (raw(x, y) - FLOOR) * K;
    h += (REFUGE_H - h) * 0.75 * Math.exp(-(x * x + y * y) / 0.045); // the bench the refuge sits on
    const low = FLOOR + 30;
    return h < low ? low - (low - h) * 0.15 : h;
  }
  const treeLine = (x, y) => 1590 + 55 * noise(x * 3.1, y * 3.1) + 25 * noise(x * 9, y * 9);

  /* ---------- Features: summit, stream, trailheads, routes ---------- */
  function climb(p) {
    // walk uphill to the local top
    let { x, y } = p;
    for (let step = 0.05; step > 0.002; step /= 2) {
      for (let moved = true; moved;) {
        moved = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = x + dx * step, ny = y + dy * step;
          if (height(nx, ny) > height(x, y)) { x = nx; y = ny; moved = true; }
        }
      }
    }
    return { x, y, h: height(x, y) };
  }

  function traceStream(x, y) {
    const pts = [[x, y]];
    let dx = 0, dy = 1;
    const e = 0.01;
    for (let i = 0; i < 1200 && y < 6.5; i++) {
      const gx = height(x + e, y) - height(x - e, y);
      const gy = height(x, y + e) - height(x, y - e);
      const len = Math.hypot(gx, gy) || 1;
      dx = 0.7 * dx - 0.3 * gx / len;
      dy = 0.7 * dy - 0.3 * gy / len + 0.02; // the valley drains south; nudge through flat pools
      const l2 = Math.hypot(dx, dy) || 1;
      dx /= l2; dy /= l2;
      x += dx * 0.015; y += dy * 0.015;
      pts.push([x, y]);
    }
    return pts;
  }

  const GRID = { x0: -5, y0: -3.6, step: 0.045, nx: 223, ny: 214, h: null };
  function buildGrid() {
    const { nx, ny, x0, y0, step } = GRID;
    const h = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = height(x0 + i * step, y0 + j * step);
    GRID.h = h;
  }

  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
    [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];

  function findPath(a, b, penalty) {
    const { nx, ny, x0, y0, step, h } = GRID;
    const node = (p) => Math.round((p.y - y0) / step) * nx + Math.round((p.x - x0) / step);
    const start = node(a), goal = node(b);
    const gx = goal % nx, gy = (goal / nx) | 0;
    const cost = new Float32Array(nx * ny).fill(Infinity);
    const from = new Int32Array(nx * ny).fill(-1);
    const done = new Uint8Array(nx * ny);
    const heap = []; // [f, node] pairs, binary min-heap
    const push = (f, n) => {
      heap.push([f, n]);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top[1];
    };
    cost[start] = 0;
    push(0, start);
    while (heap.length) {
      const n = pop();
      if (n === goal) break;
      if (done[n]) continue;
      done[n] = 1;
      const x = n % nx, y = (n / nx) | 0;
      for (const [dx, dy] of NB) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
        const m = Y * nx + X;
        if (done[m]) continue;
        const run = Math.hypot(dx, dy) * step;
        const grade = Math.abs(h[m] - h[n]) / (run * 1000);
        const c = cost[n] + run * (1 + penalty(grade));
        if (c < cost[m]) {
          cost[m] = c;
          from[m] = n;
          push(c + Math.hypot(X - gx, Y - gy) * step, m);
        }
      }
    }
    const pts = [];
    for (let n = goal; n !== -1; n = from[n]) pts.push([x0 + (n % nx) * step, y0 + ((n / nx) | 0) * step]);
    pts.reverse();
    pts[0] = [a.x, a.y];
    pts[pts.length - 1] = [b.x, b.y];
    return chaikin(chaikin(chaikin(simplify(pts, 0.035))));
  }

  // Douglas–Peucker: drop the grid's stair-steps, keep the switchbacks
  function simplify(pts, eps) {
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      let far = -1, farD = eps;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
        if (d > farD) { farD = d; far = i; }
      }
      if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  function chaikin(pts) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // the point along a line where the ground first reaches a given height
  function pointAt(pts, target) {
    for (let i = 1; i < pts.length; i++) {
      const h0 = height(...pts[i - 1]), h1 = height(...pts[i]);
      if ((h0 - target) * (h1 - target) <= 0 && h0 !== h1) {
        const t = (target - h0) / (h1 - h0);
        return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, i };
      }
    }
    return null;
  }

  function buildWorld() {
    buildGrid();
    const summit = climb(SUMMIT_GUESS);
    const stream = traceStream(-1.05, -0.95);
    const th = pointAt(stream, 640) || { x: stream.at(-1)[0], y: stream.at(-1)[1] };
    const trailhead = { x: th.x, y: th.y };
    const refuge = { x: 0, y: 0 };
    const hutEast = { x: spurX(3.1) + 0.5, y: 3.1 };
    // the crest of the spur at y = 1.1, which the blue route follows
    let spurTop = { x: 1, y: 1.1 };
    for (let x = 0.8; x < 2.8; x += 0.02) if (height(x, 1.1) > height(spurTop.x, 1.1)) spurTop = { x, y: 1.1 };
    const easy = (g) => 9 * g * g + (g > 0.26 ? 380 * (g - 0.26) ** 2 : 0);
    const steep = (g) => 4 * g * g + (g > 0.5 ? 220 * (g - 0.5) ** 2 : 0);
    const red = findPath(trailhead, refuge, easy);
    const blue = [...findPath(hutEast, spurTop, steep), ...findPath(spurTop, refuge, steep).slice(1)];
    const yellow = findPath(refuge, summit, easy);
    const trough = pointAt(red, 1120);
    const fold = pointAt(red, 1580);
    return { summit, stream, trailhead, refuge, hutEast, red, blue, yellow, trough, fold };
  }

  /* ---------- One view of the map: heights on a screen grid, hillshade pixels, contour segments ---------- */
  function computeLayers({ W, H, S, OX, OY, cell, colours: C, shadeStrength: k }) {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const hs = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      const y = (j * cell - OY) / S;
      for (let i = 0; i < gw; i++) hs[j * gw + i] = height((i * cell - OX) / S, y);
    }

    // hillshade + forest + rock, one pixel per grid cell; the page scales it up with smoothing
    const px = new Uint8ClampedArray(gw * gh * 4);
    const cellM = (cell / S) * 1000;
    const L = [-0.6, -0.75, 0.9]; // light from the north-west, as on Swiss maps
    const Ll = Math.hypot(...L);
    const flat = L[2] / Ll;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const n = j * gw + i;
        const h = hs[n];
        const dzdx = (hs[j * gw + Math.min(gw - 1, i + 1)] - hs[j * gw + Math.max(0, i - 1)]) / (2 * cellM) * 1.25;
        const dzdy = (hs[Math.min(gh - 1, j + 1) * gw + i] - hs[Math.max(0, j - 1) * gw + i]) / (2 * cellM) * 1.25;
        const lum = (-dzdx * L[0] - dzdy * L[1] + L[2]) / (Ll * Math.hypot(dzdx, dzdy, 1));
        const x = (i * cell - OX) / S, y = (j * cell - OY) / S;
        let [r, g, b] = C.paper;
        const f = smooth(12, -12, h - treeLine(x, y)) * smooth(FLOOR + 25, FLOOR + 70, h);
        r += (C.forest[0] - r) * f; g += (C.forest[1] - g) * f; b += (C.forest[2] - b) * f;
        const rock = smooth(1960, 2140, h) * 0.8;
        r += (C.rock[0] - r) * rock; g += (C.rock[1] - g) * rock; b += (C.rock[2] - b) * rock;
        const dark = clamp((flat - lum) * 1.5, 0, 1) * 0.36 * k;
        const lit = clamp((lum - flat) * 2.2, 0, 1) * 0.42 * k;
        r += (C.shadow[0] - r) * dark; g += (C.shadow[1] - g) * dark; b += (C.shadow[2] - b) * dark;
        r += (C.light[0] - r) * lit; g += (C.light[1] - g) * lit; b += (C.light[2] - b) * lit;
        const o = n * 4;
        px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
      }
    }

    // contours by marching squares: flat [x0, y0, x1, y1, …] segments per level
    const interval = S >= 150 ? 25 : 50;
    const indexEvery = interval === 25 ? 100 : 200;
    let lo = Infinity, hi = -Infinity;
    for (const h of hs) { if (h < lo) lo = h; if (h > hi) hi = h; }
    const first = Math.ceil((Math.max(lo, FLOOR + 32)) / interval) * interval;
    const segs = new Map();
    for (let v = first; v <= hi; v += interval) segs.set(v, []);
    const lerp = (a, b, v) => (v - a) / (b - a);
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = hs[j * gw + i], b = hs[j * gw + i + 1], c = hs[(j + 1) * gw + i + 1], d = hs[(j + 1) * gw + i];
        const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
        const from = Math.max(first, Math.ceil(mn / interval) * interval);
        for (let v = from; v < mx; v += interval) {
          const list = segs.get(v);
          if (!list) continue;
          const x = i * cell, y = j * cell;
          const tx = x + lerp(a, b, v) * cell, ty = y;
          const rx = x + cell, ry = y + lerp(b, c, v) * cell;
          const bx = x + lerp(d, c, v) * cell, by = y + cell;
          const lx = x, ly = y + lerp(a, d, v) * cell;
          switch ((a > v ? 8 : 0) | (b > v ? 4 : 0) | (c > v ? 2 : 0) | (d > v ? 1 : 0)) {
            case 1: case 14: list.push(lx, ly, bx, by); break;
            case 2: case 13: list.push(bx, by, rx, ry); break;
            case 3: case 12: list.push(lx, ly, rx, ry); break;
            case 4: case 11: list.push(tx, ty, rx, ry); break;
            case 6: case 9: list.push(tx, ty, bx, by); break;
            case 7: case 8: list.push(lx, ly, tx, ty); break;
            case 5: list.push(lx, ly, tx, ty, bx, by, rx, ry); break;
            case 10: list.push(tx, ty, rx, ry, lx, ly, bx, by); break;
            default: break;
          }
        }
      }
    }
    const levels = [];
    for (const [v, list] of segs) if (list.length) levels.push({ h: v, index: v % indexEvery === 0, segs: new Float32Array(list) });
    return { gw, gh, cell, interval, pixels: px, levels };
  }

  /* ---------- Worker: build the world once, then answer each view request ---------- */
  if (IS_WORKER) {
    let world = null;
    self.onmessage = ({ data }) => {
      if (!world) world = buildWorld();
      const layers = computeLayers(data);
      self.postMessage({ id: data.id, world: data.needWorld ? world : null, layers },
        [layers.pixels.buffer, ...layers.levels.map((l) => l.segs.buffer)]);
    };
    return;
  }

  /* =================== Page: everything below draws =================== */
  const canvas = document.querySelector("[data-terrain]");
  if (!canvas || !canvas.getContext) return;
  const hero = canvas.closest(".hero");
  const readout = document.querySelector("[data-readout]");
  const scaleBar = document.querySelector("[data-scale]");
  const avoidEl = document.querySelector(".hero__copy");
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Colours come from CSS tokens, so dark mode and the palette live in one place ---------- */
  const hex = (v) => {
    const s = v.trim().replace("#", "");
    const n = parseInt(s.length === 3 ? s.replace(/./g, "$&$&") : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  let C = {};
  function readColours() {
    const cs = getComputedStyle(canvas);
    const get = (name) => cs.getPropertyValue(name).trim();
    C = {
      paper: hex(get("--map-paper")),
      forest: hex(get("--map-forest")),
      rock: hex(get("--map-rock")),
      shadow: hex(get("--map-shadow")),
      light: hex(get("--map-light")),
      contour: get("--map-contour"),
      index: get("--map-index"),
      water: get("--map-water"),
      label: get("--map-label"),
      halo: get("--map-halo"),
      red: get("--red"),
      blue: get("--blue"),
      yellow: get("--yellow"),
      yellowEdge: get("--map-yellow-edge"),
      forestLabel: get("--map-forest-label"),
      shadeStrength: parseFloat(get("--map-shade")) || 1,
    };
  }

  /* ---------- Layout: where the world sits on screen ---------- */
  let W = 0, H = 0, DPR = 1, S = 1, OX = 0, OY = 0;
  let lastW = 0, lastH = 0;
  const toX = (x) => OX + x * S;
  const toY = (y) => OY + y * S;

  function measure() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    lastW = W; lastH = H;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const wide = W / H > 1.05;
    if (wide) {
      S = Math.max(W / 8.4, H / 5.3);
      OX = W * 0.69; OY = H * 0.47;
    } else {
      S = Math.max(W / 3.3, H / 6.8);
      OX = W * 0.6; OY = H * 0.36;
    }
    if (scaleBar) scaleBar.style.width = `${Math.round(S / KM_PER_UNIT)}px`;
  }

  let world = null;
  let layers = null; // { shade: canvas, gw, gh, cell, interval, levels: [{ h, index, segs, path }] }

  // Every label claims a box; later labels flip sides or give way, so names never pile up.
  let boxes = [];
  const collar = document.querySelector(".hero__collar");
  const siteHeader = document.querySelector(".site-header");
  function resetBoxes() {
    boxes = [];
    const c = canvas.getBoundingClientRect();
    if (avoidEl) {
      const a = avoidEl.getBoundingClientRect();
      boxes.push({ x0: a.left - c.left - 20, y0: a.top - c.top - 20, x1: a.right - c.left + 20, y1: a.bottom - c.top + 20 });
    }
    const top = (siteHeader?.offsetHeight || 68) + 6;
    const bottom = collar && collar.offsetParent ? collar.offsetHeight + 6 : 8;
    boxes.push({ x0: -1e4, y0: -1e4, x1: 1e4, y1: top }, { x0: -1e4, y0: H - bottom, x1: 1e4, y1: 1e4 });
  }
  const fits = (b) => b.x0 > 4 && b.x1 < W - 4 && !boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);

  const SANS = '"Schibsted Grotesk", system-ui, sans-serif';
  const SERIF = '"Brygada 1918", Georgia, serif';

  function labelText(ctx, text, x, y, font, colour, align = "left", angle = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = C.halo;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = colour;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function contourLabels(ctx) {
    const cols = W > 900 ? [W * 0.93, W * 0.52, W * 0.8] : [W * 0.88, W * 0.3];
    let n = 0;
    for (const lvl of layers.levels) {
      if (!lvl.index) continue;
      const col = cols[n++ % cols.length];
      let best = null, bestD = 16;
      const sg = lvl.segs;
      for (let s = 0; s < sg.length; s += 4) {
        const ax = sg[s], ay = sg[s + 1], bx = sg[s + 2], by = sg[s + 3];
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const d = Math.abs(mx - col);
        if (d >= bestD) continue;
        let ang = Math.atan2(by - ay, bx - ax);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        if (Math.abs(ang) > 0.9) continue;
        const box = { x0: mx - 16, y0: my - 10, x1: mx + 16, y1: my + 10 };
        if (!fits(box)) continue;
        best = { mx, my, ang, box }; bestD = d;
      }
      if (best) {
        labelText(ctx, String(lvl.h), best.mx, best.my, `500 10px ${SANS}`, C.index, "center", best.ang);
        boxes.push(best.box);
      }
    }
  }

  function strokeLine(ctx, pts, upto = 1) {
    const sp = pts.map(([x, y]) => [toX(x), toY(y)]);
    let total = 0;
    const lens = [0];
    for (let i = 1; i < sp.length; i++) { total += Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]); lens.push(total); }
    const limit = total * upto;
    ctx.beginPath();
    ctx.moveTo(sp[0][0], sp[0][1]);
    for (let i = 1; i < sp.length; i++) {
      if (lens[i] > limit) {
        const t = (limit - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
        ctx.lineTo(sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * t, sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * t);
        break;
      }
      ctx.lineTo(sp[i][0], sp[i][1]);
    }
    ctx.stroke();
  }

  function drawRoute(ctx, pts, colour, upto, edge) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.strokeStyle = C.halo;
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 6;
    strokeLine(ctx, pts, upto);
    ctx.globalAlpha /= 0.7;
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3.6;
      ctx.setLineDash([7, 5]);
      strokeLine(ctx, pts, upto);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    strokeLine(ctx, pts, upto);
    ctx.restore();
  }

  // the painted trail markers: white square, coloured symbol
  function marker(ctx, kind, x, y) {
    const s = 13;
    ctx.save();
    ctx.translate(Math.round(x - s / 2) + 0.5, Math.round(y - s / 2) + 0.5);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = C.label;
    ctx.lineWidth = 1;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeRect(0, 0, s, s);
    if (kind === "stripe") { ctx.fillStyle = C.red; ctx.fillRect(0.5, s / 3, s - 1, s / 3); }
    if (kind === "cross") { ctx.fillStyle = C.blue; ctx.fillRect(s / 2 - 1.6, 2, 3.2, s - 4); ctx.fillRect(2, s / 2 - 1.6, s - 4, 3.2); }
    if (kind === "triangle") { ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(s / 2, 2.2); ctx.lineTo(s - 2.2, s - 2.6); ctx.lineTo(2.2, s - 2.6); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  function symbols(ctx, alpha) {
    const w = world;
    ctx.save();
    ctx.globalAlpha = alpha;
    const SUB = `500 11px ${SANS}`;
    const put = (p, drawSymbol, name, sub, font = `italic 500 15px ${SERIF}`, colour = C.label) => {
      const x = toX(p.x), y = toY(p.y);
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
      drawSymbol(x, y);
      boxes.push({ x0: x - 8, y0: y - 9, x1: x + 8, y1: y + 8 });
      ctx.font = font;
      let wd = ctx.measureText(name).width;
      ctx.font = SUB;
      if (sub) wd = Math.max(wd, ctx.measureText(sub).width);
      const ht = sub ? 34 : 20;
      // beside the symbol first, then diagonally above or below it
      for (const [side, dy] of [[1, 0], [-1, 0], [1, -22], [-1, -22], [1, 22], [-1, 22]]) {
        const lx = x + side * 12, ly = y + dy;
        const box = side > 0 ? { x0: lx, y0: ly - ht / 2, x1: lx + wd + 4, y1: ly + ht / 2 } : { x0: lx - wd - 4, y0: ly - ht / 2, x1: lx, y1: ly + ht / 2 };
        if (!fits(box)) continue;
        const align = side > 0 ? "left" : "right";
        labelText(ctx, name, lx, ly - (sub ? 7 : 0), font, colour, align);
        if (sub) labelText(ctx, sub, lx, ly + 10, SUB, colour, align);
        boxes.push(box);
        return;
      }
    };
    const fmt = (h) => `${Math.round(h)} m`;
    put(w.refuge, (x, y) => {
      ctx.fillStyle = C.label;
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 6); ctx.lineTo(x - 7, y - 1); ctx.lineTo(x, y - 8); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 7, y + 6); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFC46B";
      ctx.fillRect(x - 2, y, 4, 4);
    }, "Refugiul Ursa", "1842 m", `italic 600 17px ${SERIF}`);
    put(w.summit, (x, y) => {
      ctx.fillStyle = C.label;
      ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x - 6, y + 4); ctx.closePath(); ctx.fill();
    }, "Vârful Ursoaica", fmt(w.summit.h));
    put(w.trailhead, (x, y) => {
      ctx.fillStyle = C.blue;
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.fillStyle = "#fff";
      ctx.font = `700 11px ${SANS}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("P", x, y + 0.5);
    }, "Poiana Neagră", "640 m");
    if (w.fold) put(w.fold, (x, y) => {
      ctx.strokeStyle = C.label; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.stroke();
    }, "Stâna din Deal", "1580 m");
    if (w.trough) put(w.trough, (x, y) => {
      ctx.fillStyle = C.water; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }, "Făgetul Mare", "1120 m", `italic 500 15px ${SERIF}`, C.forestLabel);
    put(w.hutEast, (x, y) => {
      ctx.strokeStyle = C.label; ctx.lineWidth = 1.5; ctx.fillStyle = C.halo;
      ctx.fillRect(x - 5, y - 5, 10, 10); ctx.strokeRect(x - 5, y - 5, 10, 10);
    }, "Cantonul Lupului", fmt(height(w.hutEast.x, w.hutEast.y)));
    // one painted marker per route, wherever there's room for it
    const placeMarker = (kind, pts) => {
      for (const t of [0.45, 0.6, 0.3, 0.72, 0.2, 0.85]) {
        const q = pts[Math.floor(pts.length * t)];
        const x = toX(q[0]), y = toY(q[1]);
        const box = { x0: x - 10, y0: y - 10, x1: x + 10, y1: y + 10 };
        if (!fits(box)) continue;
        marker(ctx, kind, x, y);
        boxes.push(box);
        return;
      }
    };
    placeMarker("stripe", w.red);
    placeMarker("cross", w.blue);
    placeMarker("triangle", w.yellow);
    // the stream's name, written along the stream, just to its west
    for (const frac of [0.62, 0.5, 0.74, 0.4]) {
      const si = w.stream.findIndex(([, y]) => toY(y) > H * frac);
      if (si < 4 || si > w.stream.length - 5) continue;
      const [ax, ay] = w.stream[si - 4], [bx, by] = w.stream[si + 4];
      let ang = Math.atan2(toY(by) - toY(ay), toX(bx) - toX(ax));
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      const x = toX(w.stream[si][0]) - 12, y = toY(w.stream[si][1]);
      const box = { x0: x - 14, y0: y - 48, x1: x + 14, y1: y + 48 };
      if (!fits(box)) continue;
      labelText(ctx, "Valea Ursului", x, y, `italic 500 14px ${SERIF}`, C.water, "center", ang);
      boxes.push(box);
      break;
    }
    ctx.restore();
  }

  function draw(t) {
    // t: seconds since the intro started; Infinity draws the finished map
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const ease = (v) => 1 - Math.pow(1 - clamp(v, 0, 1), 3);

    ctx.globalAlpha = ease(t / 0.8);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(layers.shade, 0, 0, layers.gw * layers.cell, layers.gh * layers.cell);

    // contours rise from the valley floor to the ridge
    const lv = layers.levels;
    const top = lv.length ? lv[lv.length - 1].h : 1, bottom = lv.length ? lv[0].h : 0;
    for (const l of lv) {
      const appear = 0.15 + 1.25 * ((l.h - bottom) / (top - bottom || 1));
      const a = ease((t - appear) / 0.35);
      if (a <= 0) continue;
      ctx.globalAlpha = a * (l.index ? 0.85 : 0.5);
      ctx.strokeStyle = l.index ? C.index : C.contour;
      ctx.lineWidth = l.index ? 1.1 : 0.6;
      ctx.stroke(l.path);
    }

    const w = world;
    ctx.globalAlpha = ease((t - 0.5) / 0.6);
    ctx.save();
    ctx.strokeStyle = C.water;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokeLine(ctx, w.stream);
    ctx.restore();

    ctx.globalAlpha = ease((t - 1.9) / 0.6);
    if (ctx.globalAlpha > 0) {
      drawRoute(ctx, w.blue, C.blue, 1);
      drawRoute(ctx, w.yellow, C.yellow, 1, C.yellowEdge);
    }
    ctx.globalAlpha = 1;
    const redT = clamp((t - 1.2) / 1.6, 0, 1);
    if (redT > 0) drawRoute(ctx, w.red, C.red, redT < 1 ? 0.5 - Math.cos(Math.PI * redT) / 2 : 1);

    const labelsA = ease((t - 2.6) / 0.5);
    if (labelsA > 0) {
      resetBoxes();
      symbols(ctx, labelsA);
      ctx.globalAlpha = labelsA;
      contourLabels(ctx);
      ctx.globalAlpha = 1;
    }
  }

  let raf = 0;
  function intro() {
    cancelAnimationFrame(raf);
    if (!motionOK) { draw(Infinity); return; }
    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / 1000;
      draw(t);
      if (t < 3.2) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  // Ask for a view of the map; the worker (or the main thread, if workers are unavailable) answers.
  let reqId = 0, animateNext = true, worker = null;
  try { if (window.Worker && SCRIPT_URL) worker = new Worker(SCRIPT_URL); } catch { worker = null; }
  if (worker) {
    worker.onmessage = ({ data }) => receive(data.id, data.world, data.layers);
    worker.onerror = (e) => { e.preventDefault(); worker = null; request(); };
  }

  function request() {
    measure();
    readColours();
    const params = {
      id: ++reqId, W, H, S, OX, OY, cell: W < 700 ? 3 : 4,
      colours: { paper: C.paper, forest: C.forest, rock: C.rock, shadow: C.shadow, light: C.light },
      shadeStrength: C.shadeStrength, needWorld: !world,
    };
    if (worker) worker.postMessage(params);
    else setTimeout(() => { if (!world) world = buildWorld(); receive(params.id, null, computeLayers(params)); }, 0);
  }

  function receive(id, w, L) {
    if (w) world = w;
    if (id !== reqId || !world) return;
    const shade = document.createElement("canvas");
    shade.width = L.gw; shade.height = L.gh;
    shade.getContext("2d").putImageData(new ImageData(L.pixels, L.gw, L.gh), 0, 0);
    const levels = L.levels.map((l) => {
      const path = new Path2D(), sg = l.segs;
      for (let i = 0; i < sg.length; i += 4) { path.moveTo(sg[i], sg[i + 1]); path.lineTo(sg[i + 2], sg[i + 3]); }
      return { ...l, path };
    });
    document.querySelectorAll("[data-interval]").forEach((el) => { el.textContent = `${L.interval} m`; });
    const animate = animateNext;
    animateNext = false;
    fontsReady.then(() => {
      if (id !== reqId) return;
      layers = { shade, gw: L.gw, gh: L.gh, cell: L.cell, interval: L.interval, levels };
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      if (animate) intro();
      else { cancelAnimationFrame(raf); draw(Infinity); }
    });
  }

  /* ---------- Pointer readout: height and ground under the cursor ---------- */
  const zone = (x, y, h) => {
    if (h <= FLOOR + 40) return "valley floor";
    if (h < treeLine(x, y) - 10) return h < 1250 ? "beech forest" : "spruce forest";
    if (h < 1980) return "alpine meadow";
    return "scree and rock";
  };
  if (readout && hero && window.matchMedia("(pointer: fine)").matches) {
    const [hEl, zEl] = readout.children;
    hero.addEventListener("pointermove", (e) => {
      if (!world || e.pointerType !== "mouse" || e.target.closest("a, button, .hero__copy, .hero__collar")) {
        readout.hidden = true;
        return;
      }
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const x = (px - OX) / S, y = (py - OY) / S;
      const h = height(x, y);
      hEl.textContent = `${Math.round(h).toLocaleString("en-GB")} m`;
      zEl.textContent = zone(x, y, h);
      readout.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
      readout.hidden = false;
    });
    hero.addEventListener("pointerleave", () => { readout.hidden = true; });
  }

  /* ---------- Start ---------- */
  const fontsReady = document.fonts
    ? Promise.race([
      Promise.all([document.fonts.load(`italic 500 15px ${SERIF}`), document.fonts.load(`500 11px ${SANS}`)]),
      new Promise((r) => setTimeout(r, 1500)),
    ])
    : Promise.resolve();

  request();

  let timer = 0;
  new ResizeObserver(([entry]) => {
    const { width, height: h } = entry.contentRect;
    if (!layers || (Math.abs(width - lastW) < 2 && Math.abs(h - lastH) < 100)) return;
    clearTimeout(timer);
    timer = setTimeout(request, 180);
  }).observe(canvas);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", request);
})();
