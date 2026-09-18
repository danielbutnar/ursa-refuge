/* Ursa — the night sky behind "Up here the stars go all the way down".
   Seeded stars, a Milky Way rising from behind the ridge, and the Plough (Carul Mare).
   Faint stars are drawn once; only the brighter ones twinkle, and only while the section
   is on screen. The pause button stops it; reduced motion never starts it. */
(() => {
  "use strict";

  const canvas = document.querySelector("[data-sky]");
  if (!canvas || !canvas.getContext) return;
  const section = canvas.closest(".sky");
  const toggle = document.querySelector("[data-motion-toggle]");
  const root = document.documentElement;
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const seeded = (a) => () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const gauss = (rand) => (rand() + rand() + rand() + rand() - 2) / 1.15;

  // The Plough, from right ascension and declination (projected, east to the left)
  const PLOUGH = [
    ["Alkaid", 0.2, 49.3, 1.9], ["Mizar", 3.5, 54.9, 2.2], ["Alioth", 7.9, 56.0, 2.2], ["Megrez", 13.4, 57.0, 1.4],
    ["Phecda", 16.5, 53.7, 1.9], ["Merak", 24.0, 56.4, 1.9], ["Dubhe", 23.8, 61.75, 2.3],
  ];
  const PLOUGH_LINES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]];

  let W = 0, H = 0, DPR = 1, base = null, twinkly = [], plough = [];
  let raf = 0, visible = false, paused = false, nextMeteor = 0, meteor = null;

  function build() {
    const r = section.getBoundingClientRect();
    W = r.width; H = r.height;
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    const rand = seeded(1936);
    base = document.createElement("canvas");
    base.width = canvas.width; base.height = canvas.height;
    const ctx = base.getContext("2d");
    ctx.scale(DPR, DPR);

    const dusk = (y) => smooth(H * 0.16, H * 0.36, y); // stars come out as the sky darkens
    const band = W > 900 ? { x0: W * 0.3, y0: H * 1.05, x1: W * 1.02, y1: H * 0.12 } : { x0: W * 0.1, y0: H * 1.05, x1: W * 1.1, y1: H * 0.2 };
    const bandLen = Math.hypot(band.x1 - band.x0, band.y1 - band.y0);
    const nx = -(band.y1 - band.y0) / bandLen, ny = (band.x1 - band.x0) / bandLen;
    const bandW = Math.max(90, Math.min(W, H) * 0.13);

    // Milky Way glow: overlapping soft blobs along the band, then a darker rift down its middle
    for (let i = 0; i < 90; i++) {
      const t = rand();
      const off = gauss(rand) * bandW * 0.5;
      const x = band.x0 + (band.x1 - band.x0) * t + nx * off;
      const y = band.y0 + (band.y1 - band.y0) * t + ny * off;
      const rr = bandW * (0.6 + rand() * 0.9);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      const warm = rand() < 0.3;
      const a = 0.05 * dusk(y) * (0.6 + rand() * 0.6);
      g.addColorStop(0, warm ? `rgba(255,226,196,${a})` : `rgba(196,210,255,${a})`);
      g.addColorStop(1, "rgba(196,210,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 40; i++) {
      const t = 0.1 + rand() * 0.75;
      const off = (rand() - 0.4) * bandW * 0.2;
      const x = band.x0 + (band.x1 - band.x0) * t + nx * off;
      const y = band.y0 + (band.y1 - band.y0) * t + ny * off;
      const rr = bandW * (0.25 + rand() * 0.3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, "rgba(0,0,0,.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.globalCompositeOperation = "source-over";

    twinkly = [];
    const colours = ["238,240,230", "238,240,230", "238,240,230", "203,216,255", "255,227,184"];
    const star = (x, y, b) => {
      const a = (0.25 + b * 0.75) * dusk(y);
      if (a < 0.02) return;
      const s = { x, y, r: 0.35 + b * 1.5, a, c: colours[Math.floor(rand() * colours.length)], sp: 0.6 + rand() * 1.8, ph: rand() * 6.28 };
      if (b > 0.28 && motionOK) twinkly.push(s);
      else dot(ctx, s, s.a);
    };
    const count = Math.round((W * H) / 1300);
    for (let i = 0; i < count; i++) star(rand() * W, rand() * H, Math.pow(rand(), 5));
    // more, fainter stars crowd into the band
    for (let i = 0; i < count * 0.9; i++) {
      const t = rand();
      const off = gauss(rand) * bandW * 0.42;
      star(band.x0 + (band.x1 - band.x0) * t + nx * off, band.y0 + (band.y1 - band.y0) * t + ny * off, Math.pow(rand(), 7) * 0.7);
    }

    // the Plough sits low in the north on autumn evenings: under the text, above the ridge
    const copy = section.querySelector(W > 900 ? ".sky__copy" : ".tonight");
    const ridge = section.querySelector(".sky__ridge");
    const cb = copy ? copy.getBoundingClientRect() : { bottom: r.top + H * 0.6, left: r.left + 20 };
    const top = cb.bottom - r.top + 56;
    const room = H - (ridge ? ridge.getBoundingClientRect().height * 0.55 : 120) - top;
    const sc = Math.max(4, Math.min(Math.min(W * 0.3, 360) / 24, room / 13));
    const px = cb.left - r.left + (W > 900 ? 40 : 8);
    const py = top;
    plough = PLOUGH.map(([name, x, dec, mag]) => ({ name, x: px + x * sc, y: py + (61.75 - dec) * sc, r: mag }));
    ctx.strokeStyle = "rgba(238,240,230,.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of PLOUGH_LINES) { ctx.moveTo(plough[a].x, plough[a].y); ctx.lineTo(plough[b].x, plough[b].y); }
    ctx.stroke();
    ctx.font = 'italic 500 14px "Brygada 1918", Georgia, serif';
    ctx.fillStyle = "rgba(238,240,230,.55)";
    ctx.fillText("Carul Mare", plough[0].x + 14, plough[0].y + 5);
    for (const p of plough) {
      const s = { x: p.x, y: p.y, r: p.r, a: 0.95, c: "238,240,230", sp: 0.8 + rand(), ph: rand() * 6.28 };
      if (motionOK) twinkly.push(s); else dot(ctx, s, s.a);
    }
  }

  function dot(ctx, s, a) {
    ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
    if (s.r < 0.9) { ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); return; }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.r > 1.6) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      g.addColorStop(0, `rgba(${s.c},${(a * 0.25).toFixed(3)})`);
      g.addColorStop(1, `rgba(${s.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
    }
  }

  function draw(now) {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const t = now / 1000;
    for (const s of twinkly) dot(ctx, s, s.a * (0.7 + 0.3 * Math.sin(t * s.sp + s.ph)));

    // now and then, a meteor
    if (motionOK && !paused) {
      if (!meteor && now > nextMeteor) {
        const r = Math.random();
        meteor = { x: W * (0.35 + r * 0.55), y: H * (0.3 + Math.random() * 0.15), start: now, len: 120 + r * 80, ang: 2.5 + Math.random() * 0.4 };
      }
      if (meteor) {
        const p = (now - meteor.start) / 900;
        if (p >= 1) { meteor = null; nextMeteor = now + 7000 + Math.random() * 9000; }
        else {
          const dx = Math.cos(meteor.ang), dy = Math.sin(meteor.ang);
          const hx = meteor.x + dx * meteor.len * 2 * p, hy = meteor.y + dy * meteor.len * 2 * p;
          const g = ctx.createLinearGradient(hx, hy, hx - dx * meteor.len, hy - dy * meteor.len);
          const a = Math.sin(p * Math.PI) * 0.8;
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - dx * meteor.len, hy - dy * meteor.len);
          ctx.stroke();
        }
      }
    }
  }

  const loop = (now) => {
    draw(now);
    raf = visible && !paused && motionOK ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (base && !raf && visible && !paused && motionOK) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  function init() {
    build();
    nextMeteor = performance.now() + 4000;
    draw(performance.now());
    start();
  }

  // Nothing is drawn until the section comes near: the sky costs nothing while you read the map.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  let built = false, lastW = 0, lastH = 0, timer = 0;
  const rebuild = () => fontsReady.then(() => {
    const r = section.getBoundingClientRect();
    lastW = r.width; lastH = r.height;
    built = true;
    stop();
    init();
  });

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !built) rebuild();
  }, { rootMargin: "800px 0px" }).observe(section);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  }, { rootMargin: "100px 0px" }).observe(section);

  new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (!built || (Math.abs(width - lastW) < 2 && Math.abs(height - lastH) < 60)) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  }).observe(section);

  if (toggle) {
    if (!motionOK) toggle.hidden = true;
    toggle.addEventListener("click", () => {
      paused = !paused;
      root.classList.toggle("motion-paused", paused);
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.textContent = paused ? "Play the stars" : "Pause the stars";
      if (paused) stop(); else start();
    });
  }

})();
