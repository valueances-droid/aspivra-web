/* Aspivra v2: menu, header line, and the plan -> apply -> thanks flow. No libraries. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  const PLANS = {
    starter: { name: "Starter", price: 99, creatives: 15, videos: 5 },
    growth: { name: "Growth", price: 199, creatives: 35, videos: 12 },
    scale: { name: "Scale", price: 399, creatives: 70, videos: 25 },
    unsure: { name: "Not sure yet", price: null },
  };

  /* ---------- header line once the page scrolls ---------- */
  const header = $("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 4);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- announcement flips when applications open ---------- */
  const notice = $("[data-notice]");
  if (notice && Date.now() >= Date.parse("2026-10-29T00:00:00-04:00"))
    notice.textContent = "Now taking applications. We review new brands every week.";

  /* ---------- mobile menu (native dialog) ---------- */
  const menu = $("[data-menu]");
  const openBtn = $("[data-menu-open]");
  if (menu && openBtn && typeof menu.showModal === "function") {
    openBtn.addEventListener("click", () => { menu.showModal(); openBtn.setAttribute("aria-expanded", "true"); });
    $("[data-menu-close]", menu).addEventListener("click", () => menu.close());
    menu.addEventListener("close", () => { openBtn.setAttribute("aria-expanded", "false"); openBtn.focus(); });
    menu.addEventListener("click", (e) => { if (e.target === menu) menu.close(); });
    $$("a", menu).forEach((a) => a.addEventListener("click", () => menu.close()));
    matchMedia("(min-width: 900px)").addEventListener("change", (e) => { if (e.matches && menu.open) menu.close(); });
  }

  /* ---------- sample videos: no autoplay for reduced motion, pause when off screen ---------- */
  const vids = $$("video[autoplay]");
  if (vids.length) {
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches) vids.forEach((v) => { v.removeAttribute("autoplay"); v.pause(); v.controls = true; });
    else if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause())));
      vids.forEach((v) => io.observe(v));
    }
  }

  /* ---------- apply form ---------- */
  const form = $("[data-apply]");
  if (form) {
    const params = new URLSearchParams(location.search);
    const wanted = (params.get("plan") || "").toLowerCase();
    const planInput = $(`input[name="plan"][data-slug="${PLANS[wanted] ? wanted : "unsure"}"]`, form);
    if (planInput) planInput.checked = true;

    const sum = {
      plan: $("[data-sum-plan]"), price: $("[data-sum-price]"), mix: $("[data-sum-mix]"),
    };
    const slugOf = () => ($('input[name="plan"]:checked', form) || {}).dataset?.slug || "unsure";
    const renderSummary = () => {
      const p = PLANS[slugOf()];
      if (!sum.plan) return;
      sum.plan.textContent = p.name;
      sum.price.textContent = p.price ? `$${p.price}/month` : "We'll help you pick";
      sum.mix.textContent = p.price ? `${p.creatives} creatives a month, up to ${p.videos} of them video` : "Starter, Growth or Scale";
      const slug = slugOf();
      const title = $("[data-apply-title]");
      if (title) title.textContent = slug === "unsure" ? "Apply" : `Apply for ${p.name}`;
      history.replaceState(null, "", slug === "unsure" ? location.pathname : `?plan=${slug}`);
    };
    form.addEventListener("change", (e) => { if (e.target.name === "plan") renderSummary(); });
    renderSummary();

    const status = $("[data-status]", form);
    const button = $('button[type="submit"]', form);
    const fallback = $("[data-fallback]", form);
    const MSG = {
      name: "Enter your name.",
      email: "Enter an email like you@yourshop.com.",
      brand: "Enter your brand or store name.",
      url: "Add your store link, or a link to your Instagram or TikTok.",
      sell: "Choose what you sell.",
      ads: "Choose where you run ads, or Not yet.",
    };
    const errEl = (name) => $(`[data-err="${name}"]`, form);
    const setErr = (name, bad, target) => {
      const el = errEl(name);
      if (el) { el.hidden = !bad; $("span", el).textContent = bad ? MSG[name] : ""; }
      (target || $(`[name="${name}"]`, form))?.setAttribute("aria-invalid", bad ? "true" : "false");
      if (target) $$("input", target).forEach((i) => i.setAttribute("aria-invalid", bad ? "true" : "false"));
    };

    const normUrl = (v) => (v && !/^https?:\/\//i.test(v) ? "https://" + v : v);
    const checks = {
      name: () => !!form.name.value.trim(),
      email: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()),
      brand: () => !!form.brand.value.trim(),
      url: () => /^https?:\/\/[^\s/@]+\.[^\s/]+/i.test(normUrl(form.url.value.trim())),
      sell: () => !!$('input[name="sell"]:checked', form),
      ads: () => $$('input[name="ads"]:checked', form).length > 0,
    };
    const groupOf = (name) => $(`[data-group="${name}"]`, form);
    const clearStatusIfFixed = () => {
      if (status.dataset.state === "error" && Object.keys(checks).every((n) => checks[n]())) { status.textContent = ""; status.dataset.state = ""; }
    };
    const validate = (name) => {
      const ok = checks[name]();
      setErr(name, !ok, groupOf(name) || undefined);
      clearStatusIfFixed();
      return ok;
    };
    ["name", "email", "brand", "url"].forEach((n) => {
      form[n].addEventListener("blur", () => { if (form[n].value) validate(n); });
      form[n].addEventListener("input", () => { if (form[n].getAttribute("aria-invalid") === "true" && checks[n]()) validate(n); });
    });
    form.url.addEventListener("blur", () => { const v = form.url.value.trim(); if (v && !v.startsWith("@")) form.url.value = normUrl(v); });
    form.addEventListener("change", (e) => {
      const t = e.target;
      if (t.name === "ads" && t.checked) {
        // "Not yet" and the platforms can't both be true
        $$('input[name="ads"]', form).forEach((i) => { if (i !== t && (t.value === "Not yet" || i.value === "Not yet")) i.checked = false; });
      }
      if (t.name in checks && t.type !== "text" && t.type !== "url" && t.type !== "email") validate(t.name);
    });

    const collect = () => ({
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      brand: form.brand.value.trim(),
      url: normUrl(form.url.value.trim()),
      sell: ($('input[name="sell"]:checked', form) || {}).value || "",
      ads: $$('input[name="ads"]:checked', form).map((i) => i.value).join(", "),
      plan: PLANS[slugOf()].name,
      handle: form.handle.value.trim(),
      hp_extra: form.hp_extra.value,
    });

    const showFallback = (data) => {
      const body = Object.entries(data).filter(([k]) => k !== "hp_extra").map(([k, v]) => `${k}: ${v}`).join("\n");
      $("[data-fallback-mail]", fallback).href = `mailto:aspivrallc@gmail.com?subject=${encodeURIComponent("Application: " + data.brand)}&body=${encodeURIComponent(body)}`;
      const copy = $("[data-fallback-copy]", fallback);
      copy.onclick = () => navigator.clipboard?.writeText(body).then(() => (copy.textContent = "Copied"), () => (copy.textContent = "Copy failed"));
      fallback.hidden = false;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bad = Object.keys(checks).filter((n) => !validate(n));
      if (bad.length) {
        status.dataset.state = "error";
        status.textContent = bad.length === 1 ? "Fix the field marked above." : `Fix the ${bad.length} fields marked above.`;
        const first = groupOf(bad[0]) ? $("input", groupOf(bad[0])) : form[bad[0]];
        first?.focus();
        return;
      }
      const data = collect();
      const endpoint = form.dataset.endpoint;
      button.disabled = true;
      const label = button.textContent;
      button.textContent = "Sending…";
      status.dataset.state = "";
      status.textContent = "";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        if (!endpoint) throw new Error("no endpoint");
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data), signal: ctrl.signal });
        const out = await res.json().catch(() => ({ ok: false }));
        if (!out.ok) throw new Error(out.error || "failed");
        store.set("aspivra_name", data.name.split(/\s+/)[0]);
        location.replace(`${form.dataset.thanks}?plan=${slugOf()}`);
      } catch (err) {
        console.error("apply:", err);
        button.disabled = false;
        button.textContent = label;
        status.dataset.state = "error";
        status.textContent = "We couldn't send that. Your answers are still here. Try again, or send them by email.";
        showFallback(data);
        status.tabIndex = -1;
        status.focus();
      } finally {
        clearTimeout(timer);
      }
    });
    // Safari's back-forward cache can restore the page mid-send
    addEventListener("pageshow", (e) => { if (e.persisted) { button.disabled = false; button.textContent = "Send application"; } });
  }

  /* ---------- thanks page ---------- */
  const thanks = $("[data-thanks]");
  if (thanks) {
    const p = PLANS[(new URLSearchParams(location.search).get("plan") || "").toLowerCase()] || PLANS.unsure;
    const name = store.get("aspivra_name");
    $("[data-thanks-name]", thanks).textContent = name ? `Thanks, ${name}.` : "Thanks.";
    $("[data-thanks-plan]", thanks).textContent = p.price ? `You applied for ${p.name} ($${p.price}/month).` : "You applied without picking a plan. We'll help you choose.";
  }
})();
