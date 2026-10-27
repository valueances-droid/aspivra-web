/* Worlds: four scenes drawn live on one canvas behind a bike photo that never moves.
   Scroll progress through the pinned section picks the world and crossfades between neighbors. */
(() => {
  const section = document.querySelector("[data-worlds]");
  if (!section) return;
  const canvas = section.querySelector("[data-worlds-canvas]");
  const ctx = canvas.getContext("2d");
  const names = [...section.querySelectorAll("[data-world-name]")];
  const ticks = [...section.querySelectorAll(".worlds__ticks li")];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- 2D simplex noise (for the dirt contours) --- */
  const perm = new Uint8Array(512);
  {
    const p = new Uint8Array(256).map((_, i) => i);
    for (let i = 255; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const noise2 = (x, y) => {
    const F = 0.366025403784, G = 0.211324865405;
    const s = (x + y) * F, i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const c = [[x0, y0, 0, 0], [x0 - i1 + G, y0 - j1 + G, i1, j1], [x0 - 1 + 2 * G, y0 - 1 + 2 * G, 1, 1]];
    let n = 0;
    for (const [dx, dy, a, b] of c) {
      let tt = 0.5 - dx * dx - dy * dy;
      if (tt < 0) continue;
      const g = G2[perm[((i + a) & 255) + perm[(j + b) & 255]] & 7];
      tt *= tt; n += tt * tt * (g[0] * dx + g[1] * dy);
    }
    return 70 * n;
  };

  let w = 0, h = 0, dpr = 1;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* --- particle pools, sized on resize --- */
  let snow = [], stars = [], debris = [], streaks = [];
  const build = () => {
    const area = (w * h) / (1440 * 900);
    snow = Array.from({ length: Math.round(220 * area) + 60 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(0.6, 2.4), v: rand(0.4, 1.4), drift: rand(-0.3, 0.3) }));
    stars = Array.from({ length: Math.round(260 * area) + 80 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(0.3, 1.4), tw: rand(0, Math.PI * 2) }));
    debris = Array.from({ length: Math.round(34 * area) + 12 }, () => ({ x: rand(0, w), y: rand(0, h), s: rand(3, 16), rot: rand(0, 6.28), vr: rand(-0.01, 0.01), vy: rand(-0.35, -0.08), vx: rand(-0.12, 0.12), shade: rand(0.15, 0.4) }));
    streaks = Array.from({ length: 70 }, () => newStreak(true));
  };
  const newStreak = (anywhere) => {
    const lane = rand(-1, 1);
    return { lane, x: anywhere ? rand(-w, w) : w + rand(0, w * 0.5), len: rand(80, 360), v: rand(9, 22), hue: Math.random() < 0.7 ? "255,214,150" : Math.random() < 0.5 ? "255,90,70" : "220,235,255", a: rand(0.25, 0.8) };
  };

  // Skips same-size resizes (iOS fires them as the toolbar moves) so particles aren't re-seeded mid-story.
  const namesWrap = section.querySelector(".worlds__names");
  let namesTop = Infinity;
  const resize = () => {
    const nd = Math.min(window.devicePixelRatio || 1, 2), nw = canvas.clientWidth, nh = canvas.clientHeight;
    if (nw === w && nh === h && nd === dpr) return;
    dpr = nd; w = nw; h = nh;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // top of the Frost name block, so the white ground always sits behind its dark lettering
    if (namesWrap && names[1]) namesTop = namesWrap.offsetTop + names[1].offsetTop - 24;
    build();
    if (reduce || visible) { readProgress(); render(); }
  };

  /* --- the four worlds --- */
  let t = 0;
  const horizon = () => h * 0.62;

  function dirt(alpha) {
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1d150d"); g.addColorStop(0.62, "#3a2716"); g.addColorStop(1, "#140e08");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // drifting contour lines (cheap marching squares on a coarse grid)
    const cell = w < 700 ? 18 : 22, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    const f = new Float32Array(cols * rows), sc = 0.0035;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) f[y * cols + x] = noise2(x * cell * sc + t * 0.05, y * cell * sc - t * 0.03);
    ctx.lineWidth = 1;
    for (let l = 0; l < 7; l++) {
      const iso = -0.6 + l * 0.2;
      ctx.strokeStyle = `rgba(232,188,128,${l % 3 === 0 ? 0.32 : 0.13})`;
      ctx.beginPath();
      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
        const a = f[y * cols + x], b = f[y * cols + x + 1], c = f[(y + 1) * cols + x + 1], d = f[(y + 1) * cols + x];
        const k = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
        if (k === 0 || k === 15) continue;
        const px = x * cell, py = y * cell, L = (p, q) => (iso - p) / (q - p || 1e-6);
        const T = [px + cell * L(a, b), py], R = [px + cell, py + cell * L(b, c)], B = [px + cell * L(d, c), py + cell], Lf = [px, py + cell * L(a, d)];
        const s = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        if (k === 1 || k === 14) s(Lf, B); else if (k === 2 || k === 13) s(B, R); else if (k === 3 || k === 12) s(Lf, R);
        else if (k === 4 || k === 11) s(T, R); else if (k === 6 || k === 9) s(T, B); else if (k === 7 || k === 8) s(Lf, T);
        else if (k === 5) { s(Lf, T); s(B, R); } else if (k === 10) { s(Lf, B); s(T, R); }
      }
      ctx.stroke();
    }
    // low sun haze
    const sun = ctx.createRadialGradient(w * 0.7, horizon() - 40, 10, w * 0.7, horizon() - 40, w * 0.6);
    sun.addColorStop(0, "rgba(255,170,90,0.35)"); sun.addColorStop(1, "rgba(255,170,90,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  }

  function frost(alpha) {
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0c1621"); g.addColorStop(0.62, "#24394a"); g.addColorStop(1, "#dfe9f0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // frozen ground plane
    ctx.fillStyle = "rgba(235,244,250,0.85)";
    ctx.fillRect(0, Math.min(horizon() + 40, namesTop), w, h);
    // breath of cold at the edges
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(220,235,248,0)"); v.addColorStop(1, "rgba(220,235,248,0.35)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(245,250,255,0.9)";
    for (const p of snow) {
      if (!reduce) { p.y += p.v; p.x += p.drift + Math.sin((t + p.y) * 0.01) * 0.3; }
      if (p.y > h) { p.y = -4; p.x = rand(0, w); }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
  }

  function zeroG(alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#050507"; ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(s.tw + t * 0.02));
      ctx.fillStyle = `rgba(235,240,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    // planet limb
    const R = Math.max(w, h) * 1.1;
    const limb = ctx.createRadialGradient(w / 2, h + R * 0.82, R * 0.9, w / 2, h + R * 0.82, R);
    limb.addColorStop(0, "rgba(40,60,90,0)"); limb.addColorStop(0.97, "rgba(120,170,255,0.35)"); limb.addColorStop(1, "rgba(120,170,255,0)");
    ctx.fillStyle = limb; ctx.fillRect(0, 0, w, h);
    // floating rocks: the world drifts up, the bike doesn't
    for (const d of debris) {
      if (!reduce) { d.y += d.vy; d.x += d.vx; d.rot += d.vr; }
      if (d.y < -20) { d.y = h + 20; d.x = rand(0, w); }
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.fillStyle = `rgba(200,205,215,${d.shade})`;
      ctx.beginPath(); ctx.moveTo(-d.s, -d.s * 0.4); ctx.lineTo(-d.s * 0.2, -d.s); ctx.lineTo(d.s, -d.s * 0.3); ctx.lineTo(d.s * 0.6, d.s * 0.8); ctx.lineTo(-d.s * 0.7, d.s * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function midnight(alpha) {
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#04040a"); g.addColorStop(0.6, "#0d0b1a"); g.addColorStop(1, "#050508");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // road perspective lines
    const hz = horizon(), cx = w * 0.5;
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -6; i <= 6; i++) { ctx.moveTo(cx, hz); ctx.lineTo(cx + i * w * 0.25, h); }
    const off = (t * 4) % 60;
    for (let y = hz; y < h; y += 0) { const k = (y - hz) / (h - hz); y += 6 + k * 60; const yy = y + off * k; ctx.moveTo(0, yy); ctx.lineTo(w, yy); }
    ctx.stroke();
    // light streaks rushing past
    ctx.globalCompositeOperation = "lighter";
    for (const s of streaks) {
      if (!reduce) s.x -= s.v;
      if (s.x + s.len < -w * 0.2) Object.assign(s, newStreak(false));
      const y = hz - 120 + s.lane * 140;
      const grd = ctx.createLinearGradient(s.x, 0, s.x + s.len, 0);
      grd.addColorStop(0, `rgba(${s.hue},0)`); grd.addColorStop(1, `rgba(${s.hue},${s.a * alpha})`);
      ctx.strokeStyle = grd; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, y); ctx.lineTo(s.x + s.len, y); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  const worlds = [dirt, frost, zeroG, midnight];

  /* --- scroll progress through the pinned section --- */
  let progress = 0, current = -1;
  const readProgress = () => {
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    progress = Math.min(1, Math.max(0, -r.top / (total || 1)));
  };

  const render = () => {
    const pos = progress * (worlds.length - 1);
    const a = Math.floor(pos), b = Math.min(worlds.length - 1, a + 1);
    // hold each world, then blend quickly near the boundary
    const local = pos - a;
    const mix = Math.min(1, Math.max(0, (local - 0.62) / 0.3));
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    worlds[a](1);
    if (mix > 0 && b !== a) worlds[b](mix);
    ctx.globalAlpha = 1;
    const idx = mix > 0.5 ? b : a;
    if (idx !== current) {
      current = idx;
      section.dataset.world = idx;
      names.forEach((n, i) => { n.classList.toggle("is-on", i === idx); n.setAttribute("aria-hidden", i === idx ? "false" : "true"); });
      ticks.forEach((tk, i) => tk.classList.toggle("is-on", i <= idx));
    }
  };

  let visible = false, last = 0;
  new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(section);
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || now - last < 30) return;
    last = now;
    t += 1;
    readProgress();
    render();
  };

  window.addEventListener("resize", resize);
  resize();
  if (!reduce) requestAnimationFrame(loop);
  else window.addEventListener("scroll", () => { readProgress(); render(); }, { passive: true });
})();
