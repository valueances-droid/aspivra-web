/* Aspivra · interactions. No build step; Lenis loads from CDN. The hero entrance lives in styles.css. */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Hero orb: honour reduced motion, give it a pause control, keep the poster if autoplay is refused ---------- */
  const orb = $(".orb__media");
  const orbBtn = $("[data-orb-toggle]");
  if (orb) {
    const sync = () => orbBtn && (orbBtn.textContent = orb.paused ? "Play" : "Pause");
    if (reduce) { orb.removeAttribute("autoplay"); orb.pause(); }
    else { const p = orb.play && orb.play(); if (p && p.catch) p.catch(() => orb.removeAttribute("autoplay")); }
    orb.addEventListener("play", sync);
    orb.addEventListener("pause", sync);
    sync();
    if (orbBtn) orbBtn.addEventListener("click", () => (orb.paused ? orb.play().catch(() => {}) : orb.pause()));
  }

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  // In-page links glide with Lenis, then hand keyboard focus to the target. The skip link keeps the browser's own jump.
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!lenis || a.classList.contains("skip") || id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -70 });
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    })
  );

  /* ---------- Nav border on scroll ---------- */
  const nav = $("[data-nav]");
  const onScroll = () => nav && nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveals (the hero animates in CSS) ---------- */
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }),
    { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
  );
  $$("[data-reveal]").filter((el) => !el.closest(".hero")).forEach((el) => {
    // stagger by position among siblings, so a list cascades and a lone paragraph doesn't wait
    el.style.transitionDelay = `${Math.min([...el.parentElement.children].indexOf(el), 4) * 70}ms`;
    io.observe(el);
  });
  window.__aspReady = true;

  /* ---------- Top bar flips once early access is open ---------- */
  const bar = $("[data-bar]");
  if (bar && Date.now() >= Date.parse("2026-10-29T00:00:00-04:00"))
    bar.innerHTML = 'Early access <strong>open now</strong><span class="bar__long"> · weekly batches, limited spots</span>';

  /* ---------- Footer clock, Eastern time ---------- */
  const clock = $("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
    const tick = () => (clock.textContent = `East Coast, USA · ${fmt.format(new Date())} ET`);
    tick(); setInterval(tick, 30000);
  }

  /* ---------- Count-up stats: the real numbers ship in the HTML; zero them only when we're about to animate ---------- */
  if (!reduce) {
    const counters = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const end = +el.dataset.count;
          const suffix = el.dataset.suffix || "";
          counters.unobserve(el);
          const t0 = performance.now();
          const dur = 1600;
          const tick = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 4);
            el.textContent = Math.round(end * eased) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { threshold: 0.5 }
    );
    $$("[data-count]").forEach((el) => {
      el.textContent = "0" + (el.dataset.suffix || "");
      counters.observe(el);
    });
  }

  /* ---------- Terrain: contour lines that drift. Scrolling speeds the world up. ---------- */
  const canvas = $("[data-terrain]");
  if (canvas) terrain(canvas);

  function terrain(cv) {
    const ctx = cv.getContext("2d");
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256).map((_, i) => i);
    for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
    const F3 = 1 / 3, G3 = 1 / 6;
    const noise = (x, y, z) => {
      const s = (x + y + z) * F3;
      const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3;
      const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const pts = [[x0, y0, z0, 0, 0, 0], [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1], [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2], [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1]];
      let n = 0;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      for (const [dx, dy, dz, a, b, c] of pts) {
        let tt = 0.6 - dx * dx - dy * dy - dz * dz;
        if (tt < 0) continue;
        const g = grad[perm[ii + a + perm[jj + b + perm[kk + c]]] % 12];
        tt *= tt;
        n += tt * tt * (g[0] * dx + g[1] * dy + g[2] * dz);
      }
      return 32 * n;
    };

    const LEVELS = 11;
    let w = 0, h = 0, cols = 0, rows = 0, cell = 16, dpr = 1, field = null;
    let z = Math.random() * 10, speed = 0.0009, boost = 0, visible = true, last = 0;
    let mx = 0, my = 0;

    // Returns false when nothing changed (iOS fires resize as the toolbar moves), so the canvas isn't cleared for nothing.
    const resize = () => {
      const nd = Math.min(window.devicePixelRatio || 1, 2), nw = cv.clientWidth, nh = cv.clientHeight;
      if (nw === w && nh === h && nd === dpr) return false;
      dpr = nd; w = nw; h = nh;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = w < 700 ? 14 : 18;
      cols = Math.ceil(w / cell) + 1; rows = Math.ceil(h / cell) + 1;
      field = new Float32Array(cols * rows);
      return true;
    };

    const draw = () => {
      const sc = 0.0042;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          field[y * cols + x] = noise(x * cell * sc + mx * 0.15, y * cell * sc + my * 0.15, z) * 0.5 + noise(x * cell * sc * 2.1, y * cell * sc * 2.1, z * 1.3) * 0.18;

      ctx.clearRect(0, 0, w, h);
      for (let l = 0; l < LEVELS; l++) {
        const iso = -0.55 + (l / (LEVELS - 1)) * 1.1;
        const major = l % 5 === 0;
        ctx.strokeStyle = major ? "rgba(242,240,234,0.22)" : "rgba(242,240,234,0.085)";
        ctx.lineWidth = major ? 1.1 : 0.8;
        ctx.beginPath();
        for (let y = 0; y < rows - 1; y++) {
          for (let x = 0; x < cols - 1; x++) {
            const a = field[y * cols + x], b = field[y * cols + x + 1], c = field[(y + 1) * cols + x + 1], d = field[(y + 1) * cols + x];
            const idx = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const px = x * cell, py = y * cell;
            const lerp = (v1, v2) => (iso - v1) / (v2 - v1 || 1e-6);
            const top = [px + cell * lerp(a, b), py];
            const right = [px + cell, py + cell * lerp(b, c)];
            const bottom = [px + cell * lerp(d, c), py + cell];
            const left = [px, py + cell * lerp(a, d)];
            const seg = (p1, p2) => { ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); };
            switch (idx) {
              case 1: case 14: seg(left, bottom); break;
              case 2: case 13: seg(bottom, right); break;
              case 3: case 12: seg(left, right); break;
              case 4: case 11: seg(top, right); break;
              case 5: seg(left, top); seg(bottom, right); break;
              case 6: case 9: seg(top, bottom); break;
              case 7: case 8: seg(left, top); break;
              case 10: seg(left, bottom); seg(top, right); break;
            }
          }
        }
        ctx.stroke();
      }
    };

    const loop = (t) => {
      requestAnimationFrame(loop);
      if (!visible || t - last < 33) return; // ~30fps is plenty for slow terrain
      last = t;
      boost *= 0.94;
      z += speed + boost;
      draw();
    };

    resize();
    window.addEventListener("resize", () => { if (resize() && reduce) draw(); });
    if (reduce) { draw(); return; }

    new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(cv);
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      boost = Math.min(0.02, boost + dy * 0.00004);
    }, { passive: true });
    window.addEventListener("pointermove", (e) => {
      mx += ((e.clientX / w - 0.5) - mx) * 0.08;
      my += ((e.clientY / h - 0.5) - my) * 0.08;
    }, { passive: true });
    requestAnimationFrame(loop);
  }

  /* ---------- Application form ----------
     Posts JSON to the Apps Script endpoint in data-endpoint (see backend/apply.gs).
     With no endpoint set, nothing pretends to send: the applicant gets a pre-filled email link and a copy button. */
  const form = $("[data-form]");
  if (form) {
    const status = $(".form__status", form);
    const button = $("button[type=submit]", form);
    const fallback = $("[data-fallback]", form);
    const MSG = {
      name: "Enter your name.",
      email: "Enter an email like you@yourshop.com.",
      brand: "Enter your brand or store name.",
      url: "Enter your store's web address, like yourstore.com.",
      sell: "Choose what you sell.",
      ads: "Choose where you advertise.",
    };
    const mark = (f, bad) => {
      f.setAttribute("aria-invalid", bad ? "true" : "false");
      const m = document.getElementById(f.id + "-err");
      if (m) { m.textContent = bad ? MSG[f.name] || "Fill this in." : ""; m.hidden = !bad; }
    };
    const clear = (e) => { if (e.target.getAttribute && e.target.getAttribute("aria-invalid") === "true") mark(e.target, false); };
    form.addEventListener("input", clear);
    form.addEventListener("change", clear);

    const offline = (data) => {
      const body = Object.entries(data).filter(([k]) => k !== "hp_extra").map(([k, v]) => `${k}: ${v}`).join("\n");
      $("[data-fallback-mail]", form).href = `mailto:aspivrallc@gmail.com?subject=${encodeURIComponent("Early access application: " + data.brand)}&body=${encodeURIComponent(body)}`;
      const copy = $("[data-fallback-copy]", form);
      copy.onclick = () => {
        if (!navigator.clipboard) { copy.textContent = "Copy not available"; return; }
        navigator.clipboard.writeText(`To: aspivrallc@gmail.com\n\n${body}`).then(() => (copy.textContent = "Copied"), () => (copy.textContent = "Copy failed"));
      };
      fallback.hidden = false;
      form.dataset.state = "offline";
      status.textContent = "Not sent yet. Send it to aspivrallc@gmail.com: open it in your email app, or copy it into any email.";
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let first = null;
      $$("input[required], select[required]", form).forEach((f) => {
        let v = f.value.trim();
        if (f.type === "url" && v && !/^https?:\/\//i.test(v)) { v = "https://" + v; f.value = v; } // people type "yourstore.com"
        const bad = !v || (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || (f.type === "url" && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(v));
        mark(f, bad);
        if (bad && !first) first = f;
      });
      if (first) { form.dataset.state = "invalid"; status.textContent = "Check the highlighted fields."; first.focus(); return; }

      const data = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
      const endpoint = form.dataset.endpoint;
      if (!endpoint) return offline(data);

      button.disabled = true;
      fallback.hidden = true;
      form.dataset.state = "sending";
      status.textContent = "Sending…";
      try {
        // Apps Script web apps answer with a redirect; text/plain keeps this a simple CORS request.
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({ ok: false, error: "non-JSON response" }));
        if (!out.ok) throw new Error(out.error || "failed");
        form.classList.add("is-sent");
        form.dataset.state = "ok";
        status.textContent = `Got it, ${data.name.split(/\s+/)[0]}. We review applications every week and reply from aspivrallc@gmail.com. Send 3 product photos when we do, so we can start fast.`;
      } catch (err) {
        console.error("apply:", err);
        button.disabled = false;
        form.dataset.state = "error";
        status.innerHTML = 'That didn\'t go through. Try again, or <a href="mailto:aspivrallc@gmail.com">email aspivrallc@gmail.com</a>.';
      }
    });
  }
})();
