/* Ursa — site scripts */
(() => {
  "use strict";

  /* ------------------------------------------------------------------
     EDIT THESE
     ------------------------------------------------------------------ */
  const CONFIG = {
    // Leave empty to keep the booking form in concept mode (nothing is sent).
    // For a real refuge, point it at a form service, e.g. "https://formsubmit.co/ajax/you@example.com",
    // and add that origin to connect-src in the Content-Security-Policy of index.html.
    formEndpoint: "",
    pricePerNight: 170, // lei, per bunk, dinner and breakfast included
    bunks: 12,
    // The season: first and last night the refuge is open (month is 1–12).
    seasonStart: { month: 6, day: 15 },
    seasonEnd: { month: 10, day: 14 },
    // Where the sky is calculated: the refuge, including its altitude for the horizon dip.
    lat: 45.59,
    lng: 24.63,
    altitude: 1842,
    timeZone: "Europe/Bucharest",
  };

  const body = document.body;
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = new Intl.NumberFormat("en-GB");

  /* ---------- Header: scrolled state, and dark once the night starts ---------- */
  const header = document.querySelector(".site-header");
  const sky = document.querySelector(".sky");
  let nightFrom = Infinity;
  const measureNight = () => {
    nightFrom = sky ? sky.getBoundingClientRect().top + window.scrollY + sky.offsetHeight * 0.2 : Infinity;
  };
  const onScroll = () => {
    if (!header) return;
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 24);
    header.classList.toggle("is-night", y + header.offsetHeight / 2 > nightFrom && !body.classList.contains("menu-open"));
  };
  measureNight();
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measureNight(); onScroll(); });
  window.addEventListener("load", () => { measureNight(); onScroll(); });

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector(".burger");
  const menu = document.querySelector(".mobile-menu");
  const setMenu = (open) => {
    body.classList.toggle("menu-open", open);
    if (burger) {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    if (menu) menu.inert = !open;
    // the menu covers the page, so keep Tab inside it while it's open
    document.querySelectorAll("main, .site-footer").forEach((el) => { el.inert = open; });
    onScroll();
  };
  if (menu) menu.inert = true;
  burger?.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  menu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  window.addEventListener("resize", () => { if (window.innerWidth > 1000 && body.classList.contains("menu-open")) setMenu(false); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("menu-open")) { setMenu(false); burger?.focus(); }
  });

  /* ---------- The climb: an altimeter that follows your reading ---------- */
  const profile = document.querySelector("[data-profile]");
  if (profile) {
    const line = profile.querySelector("[data-profile-line]");
    const walker = profile.querySelector("[data-profile-walker]");
    const hOut = profile.querySelector("[data-profile-h]");
    const whereOut = profile.querySelector("[data-profile-where]");
    const stops = [...document.querySelectorAll(".waypoint")];
    const pts = line.getAttribute("points").trim().split(/\s+/).map((p) => p.split(",").map(Number));
    // svg geometry: x 20–580 is 0–7.4 km, y 230 is 600 m and each 200 units is 1,300 m
    const KM = 7.4, X0 = 20, X1 = 580, Y0 = 230;
    const at = (km) => {
      const x = X0 + (km / KM) * (X1 - X0);
      let i = 1;
      while (i < pts.length - 1 && pts[i][0] < x) i++;
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const y = ay + (by - ay) * ((x - ax) / (bx - ax || 1));
      return { x, y, h: 600 + ((Y0 - y) * 1300) / 200 };
    };
    const kms = stops.map((s) => parseFloat(s.dataset.km));
    let lastKm = -1, ticking = false;

    const update = () => {
      ticking = false;
      const reading = window.innerHeight * (window.innerWidth > 900 ? 0.45 : 0.55);
      const anchors = stops.map((s) => s.getBoundingClientRect().top + 12);
      let km = 0, here = -1;
      for (let i = 0; i < anchors.length; i++) {
        if (reading >= anchors[i]) {
          here = i;
          km = kms[i];
          if (i < anchors.length - 1 && reading < anchors[i + 1]) {
            km += (kms[i + 1] - kms[i]) * ((reading - anchors[i]) / (anchors[i + 1] - anchors[i]));
          }
        }
      }
      stops.forEach((s, i) => s.classList.toggle("is-here", i === here));
      if (Math.abs(km - lastKm) < 0.005) return;
      lastKm = km;
      const p = at(km);
      walker.setAttribute("cx", p.x.toFixed(1));
      walker.setAttribute("cy", p.y.toFixed(1));
      hOut.textContent = nf.format(Math.round(p.h));
      const near = kms.findIndex((k) => Math.abs(k - km) < 0.12);
      whereOut.textContent = near >= 0
        ? `${stops[near].dataset.name}, ${km.toFixed(1)} km`
        : `${km.toFixed(1)} km from the barrier`;
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    let listening = false;
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !listening) { window.addEventListener("scroll", request, { passive: true }); listening = true; request(); }
      if (!entry.isIntersecting && listening) { window.removeEventListener("scroll", request); listening = false; request(); }
    }, { rootMargin: "20% 0px" }).observe(document.querySelector(".climb"));
    window.addEventListener("resize", request);
  }

  /* ---------- Floor plan: point at a room in the list to find it on the plan ---------- */
  const plan = document.querySelector("[data-plan]");
  const rooms = document.querySelector("[data-rooms]");
  if (plan && rooms) {
    const light = (id, on) => {
      plan.querySelectorAll(`[data-room="${id}"]`).forEach((el) => el.classList.toggle("is-lit", on));
      rooms.querySelectorAll(`[data-room="${id}"]`).forEach((el) => el.classList.toggle("is-lit", on));
    };
    [...rooms.querySelectorAll("[data-room]"), ...plan.querySelectorAll("[data-room]")].forEach((el) => {
      el.addEventListener("pointerenter", () => light(el.dataset.room, true));
      el.addEventListener("pointerleave", () => light(el.dataset.room, false));
    });
  }

  /* ---------- Booking: a calendar of nights with the bunks drawn in ---------- */
  const form = document.querySelector("[data-booking]");
  const cal = document.querySelector("[data-calendar]");
  const DAY = 864e5;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const shortDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

  const inSeason = (d) => {
    const start = new Date(d.getFullYear(), CONFIG.seasonStart.month - 1, CONFIG.seasonStart.day);
    const end = new Date(d.getFullYear(), CONFIG.seasonEnd.month - 1, CONFIG.seasonEnd.day);
    return d >= start && d <= end;
  };
  // Made-up but stable occupancy: the same night always shows the same bunks taken.
  const taken = (d) => {
    if (!inSeason(d)) return CONFIG.bunks;
    let h = 2166136261;
    for (const c of iso(d)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    const r = ((h >>> 0) % 1000) / 1000;
    const dow = d.getDay();
    const weekend = dow === 5 || dow === 6;
    const month = d.getMonth() + 1;
    const busy = month === 7 || month === 8 ? 1.25 : month === 10 ? 0.6 : 1;
    const n = Math.round(((weekend ? 8.5 : 3) + r * 5 - 1.5) * busy);
    return Math.max(0, Math.min(CONFIG.bunks, n));
  };
  const free = (d) => CONFIG.bunks - taken(d);

  if (form && cal) {
    const bunksIn = form.querySelector("#bunks");
    const bunksMsg = form.querySelector("[data-bunks-msg]");
    const totalOut = form.querySelector("[data-total]");
    const status = form.querySelector("[data-status]");
    const submit = form.querySelector('[type="submit"]');
    const submitLabel = submit.querySelector(".btn__label");
    const success = document.querySelector("[data-success]");
    const successText = document.querySelector("[data-success-text]");

    // first bookable night: tomorrow, or the next opening day
    let first = addDays(new Date(), 1);
    if (!inSeason(first)) {
      let y = first.getFullYear();
      let open = new Date(y, CONFIG.seasonStart.month - 1, CONFIG.seasonStart.day);
      if (first > open) open = new Date(y + 1, CONFIG.seasonStart.month - 1, CONFIG.seasonStart.day);
      first = open;
    }
    const lead = (first.getDay() + 6) % 7; // Monday first
    const cells = 35;
    const last = addDays(first, cells - lead - 1);
    const frag = document.createDocumentFragment();

    const title = document.createElement("p");
    title.className = "cal__month";
    const m1 = monthYear.format(first), m2 = monthYear.format(last);
    title.textContent = m1 === m2 ? m1 : `${m1.replace(/ \d{4}$/, first.getFullYear() === last.getFullYear() ? "" : "$&")} to ${m2}`;
    frag.append(title);
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
      const el = document.createElement("span");
      el.className = "cal__dow";
      el.setAttribute("aria-hidden", "true");
      el.textContent = d;
      frag.append(el);
    });
    for (let i = 0; i < lead; i++) {
      const blank = document.createElement("span");
      blank.className = "day day--blank";
      blank.setAttribute("aria-hidden", "true");
      frag.append(blank);
    }
    let anyClosed = false;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const open = inSeason(d);
      const t = taken(d);
      const label = document.createElement("label");
      label.className = `day${open ? "" : " day--closed"}`;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "Arrival";
      input.value = iso(d);
      input.required = true;
      input.disabled = !open || t >= CONFIG.bunks;
      const state = !open ? "closed" : t >= CONFIG.bunks ? "fully booked" : `${CONFIG.bunks - t} of ${CONFIG.bunks} bunks free`;
      input.setAttribute("aria-label", `${longDate.format(d)}, ${state}`);
      const box = document.createElement("span");
      box.className = "day__box";
      box.setAttribute("aria-hidden", "true");
      const date = document.createElement("span");
      date.className = "day__date";
      date.textContent = d.getDate() === 1 || +d === +first ? `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}` : d.getDate();
      box.append(date);
      if (open) {
        const grid = document.createElement("span");
        grid.className = "day__bunks";
        for (let b = 0; b < CONFIG.bunks; b++) {
          const i = document.createElement("i");
          if (b < t) i.className = "is-taken";
          grid.append(i);
        }
        box.append(grid);
      } else anyClosed = true;
      label.append(input, box);
      frag.append(label);
    }
    if (anyClosed) {
      const note = document.createElement("p");
      note.className = "cal__note";
      note.textContent = `Faded nights are after the season closes on ${CONFIG.seasonEnd.day + 1} ${new Date(2000, CONFIG.seasonEnd.month - 1).toLocaleString("en-GB", { month: "long" })}.`;
      frag.append(note);
    }
    cal.append(frag);
    // the calendar replaces the plain date field
    document.querySelector("[data-arrival-fallback]")?.remove();

    const selected = () => form.querySelector('input[name="Arrival"]:checked');
    const nights = () => Number(form.querySelector('input[name="Nights"]:checked')?.value || 1);

    const check = () => {
      const bunks = Math.max(1, Math.min(CONFIG.bunks, Number(bunksIn.value) || 1));
      const n = nights();
      let msg = "";
      let max = CONFIG.bunks;
      const arr = selected();
      if (arr) {
        const start = fromIso(arr.value);
        for (let i = 0; i < n; i++) {
          const d = addDays(start, i);
          if (!inSeason(d)) { msg = `The refuge is closed on ${shortDate.format(d)}. Choose fewer nights or an earlier date.`; max = 0; break; }
          if (free(d) < max) { max = free(d); if (bunks > max) msg = `Only ${max} ${max === 1 ? "bunk is" : "bunks are"} free on ${shortDate.format(d)}.`; }
        }
      }
      bunksIn.setCustomValidity(msg);
      bunksMsg.textContent = msg;
      const unit = (v, w) => `${v} ${w}${v === 1 ? "" : "s"}`;
      const strong = document.createElement("strong");
      strong.textContent = `${nf.format(bunks * n * CONFIG.pricePerNight)} lei`;
      totalOut.replaceChildren(`${unit(bunks, "bunk")} for ${unit(n, "night")}: `, strong);
    };

    form.addEventListener("change", check);
    bunksIn.addEventListener("input", check);
    form.querySelectorAll("[data-step]").forEach((btn) => btn.addEventListener("click", () => {
      const v = Math.max(1, Math.min(CONFIG.bunks, (Number(bunksIn.value) || 1) + Number(btn.dataset.step)));
      bunksIn.value = v;
      check();
    }));
    check();

    // keep aria-invalid in step with :user-invalid
    const syncAria = (el) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (el.type === "radio") return;
      el.setAttribute("aria-invalid", String(el.matches(":user-invalid")));
    };
    form.addEventListener("focusout", (e) => syncAria(e.target));
    form.addEventListener("input", (e) => { if (e.target.hasAttribute?.("aria-invalid")) syncAria(e.target); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.textContent = "";
      check();
      if (!form.checkValidity()) {
        form.reportValidity();
        form.querySelectorAll("input, textarea").forEach(syncAria);
        return;
      }
      const fd = new FormData(form);
      if (fd.get("_honey")) return;
      const data = {};
      for (const [k, v] of fd.entries()) if (k !== "_honey" && String(v).trim()) data[k] = String(v).trim();

      submit.disabled = true;
      submitLabel.textContent = "Sending…";
      try {
        if (CONFIG.formEndpoint) {
          data._subject = `Booking request: ${data.Arrival}, ${data.Bunks} bunks`;
          data._template = "table";
          data._captcha = "false";
          if (data.Email) data._replyto = data.Email;
          const res = await fetch(CONFIG.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || String(json.success) !== "true") throw new Error(json.message || `HTTP ${res.status}`);
        } else {
          await new Promise((r) => setTimeout(r, 650));
        }
        const n = Number(data.Nights), b = Number(data.Bunks);
        successText.textContent = `We’ve asked the warden to hold ${b} ${b === 1 ? "bunk" : "bunks"} from ${longDate.format(fromIso(data.Arrival))} for ${n} ${n === 1 ? "night" : "nights"}. You’ll get a reply at ${data.Email} within a day.`;
        form.hidden = true;
        success.hidden = false;
        success.scrollIntoView({ behavior: motionOK ? "smooth" : "auto", block: "center" });
        success.focus({ preventScroll: true });
      } catch {
        status.textContent = "The request didn’t go through. Check your connection and send it again.";
      } finally {
        submit.disabled = false;
        submitLabel.textContent = "Send booking request";
      }
    });

    document.querySelector("[data-reset]")?.addEventListener("click", () => {
      form.reset();
      form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
      check();
      success.hidden = true;
      form.hidden = false;
      form.querySelector('input[name="Arrival"]:not(:disabled)')?.focus();
    });
  }

  /* ---------- Tonight: sunset, darkness and the moon, worked out in the browser ---------- */
  const tonight = document.querySelector("[data-tonight]");
  if (tonight) {
    const rad = Math.PI / 180;
    const J1970 = 2440588, J2000 = 2451545;
    const toDays = (date) => date.valueOf() / DAY - 0.5 + J1970 - J2000;
    const fromJulian = (j) => new Date((j + 0.5 - J1970) * DAY);
    const obliquity = rad * 23.4397;

    // Standard low-precision solar position (good to a minute or two), as in NOAA's and SunCalc's methods.
    const sunTimes = (date, lat, lng, alt) => {
      const lw = rad * -lng, phi = rad * lat;
      const n = Math.round(toDays(date) - 0.0009 - lw / (2 * Math.PI));
      const ds = 0.0009 + lw / (2 * Math.PI) + n;
      const M = rad * (357.5291 + 0.98560028 * ds);
      const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
      const L = M + C + rad * 102.9372 + Math.PI;
      const dec = Math.asin(Math.sin(obliquity) * Math.sin(L));
      const dip = (-2.076 * Math.sqrt(alt)) / 60; // the horizon sits lower when you're up a mountain
      const at = (h) => {
        const cosW = (Math.sin(h * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
        if (cosW < -1 || cosW > 1) return null;
        const a = 0.0009 + (Math.acos(cosW) + lw) / (2 * Math.PI) + n;
        return fromJulian(J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L));
      };
      return { sunset: at(-0.833 + dip), dark: at(-18) };
    };

    const SYNODIC = 29.530588853;
    const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
    const moon = (date) => {
      let age = ((date - NEW_MOON) / DAY) % SYNODIC;
      if (age < 0) age += SYNODIC;
      const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
      const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent", "New moon"];
      return { age, lit, waxing: age < SYNODIC / 2, name: names[Math.floor((age / SYNODIC) * 8 + 0.5)] };
    };
    const moonPath = (k, waxing, r = 18) => {
      const rx = (Math.abs(1 - 2 * k) * r).toFixed(2);
      const limb = waxing ? 1 : 0;
      const term = (k < 0.5) === waxing ? 0 : 1;
      return `M0 ${-r}A${r} ${r} 0 0 ${limb} 0 ${r}A${rx} ${r} 0 0 ${term} 0 ${-r}Z`;
    };

    const now = new Date();
    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timeZone });
    const sun = sunTimes(now, CONFIG.lat, CONFIG.lng, CONFIG.altitude);
    const evening = sun.dark || now;
    const m = moon(evening);
    const set = (key, text) => { const el = tonight.querySelector(`[data-t="${key}"]`); if (el) el.textContent = text; };
    set("sunset", sun.sunset ? time.format(sun.sunset) : "–");
    set("dark", sun.dark ? time.format(sun.dark) : "not tonight");
    set("moon", `${m.name}, ${Math.round(m.lit * 100)}% lit`);
    tonight.querySelector("[data-moon]")?.setAttribute("d", moonPath(m.lit, m.waxing));
    const verdict = m.lit < 0.2
      ? "A dark night. If it’s clear, the Milky Way will be over the ridge by the time dinner’s cleared."
      : m.lit > 0.8
        ? "A bright moon. Fewer stars, but the ridge turns silver and you’ll barely need a torch on the porch."
        : m.waxing
          ? "The moon sets before the small hours. Stay up late and the sky goes properly dark."
          : "The moon rises late tonight, so the first hours after dark are the best for stars.";
    set("verdict", verdict);
  }
})();
