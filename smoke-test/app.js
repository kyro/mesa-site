(function () {
  "use strict";

  var C = window.LP_COPY;
  var params = new URLSearchParams(location.search);
  var debug = params.get("debug") === "1";

  /* --- variant resolution --------------------------------------------- */
  var V = C.variants;
  var angleKey = C.angles[params.get("angle")] ? params.get("angle") : V.defaultAngle;
  var priceKey = resolvePrice();
  var A = C.angles[angleKey];
  var ho = C.flags.headlineOverride || {};
  var h1Override = !!ho.text && (ho.enabled || params.get("h1") === "override");

  // ?price= wins; otherwise a 50/50 random price, sticky per visitor.
  function resolvePrice() {
    var fromUrl = params.get("price");
    if (V.prices.indexOf(fromUrl) > -1) return fromUrl;
    var KEY = "lp_price";
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (!stored) {
      var m = document.cookie.match(/(?:^|; )lp_price=(\d+)/);
      stored = m && m[1];
    }
    if (V.prices.indexOf(stored) < 0) stored = V.prices[Math.floor(Math.random() * V.prices.length)];
    try { localStorage.setItem(KEY, stored); } catch (e) { /* storage blocked */ }
    document.cookie = KEY + "=" + stored + "; path=/; max-age=31536000; SameSite=Lax";
    return stored;
  }

  /* ---------------------------------------------------------------------
   * ANALYTICS: NO-OP STUBS. Nothing is sent anywhere.
   * Wire a real provider inside track() when the test goes live.
   * Events: lp_view, email_submit, thanks_view, reserve_click, skip_click.
   * Every event carries angle, price, utm_source, utm_campaign, utm_content.
   * With ?debug=1 events are logged to the console for QA.
   * ------------------------------------------------------------------- */
  var baseProps = {
    angle: angleKey,
    price: priceKey,
    h1: h1Override ? "override" : "angle",
    utm_source: params.get("utm_source") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || ""
  };
  var analytics = {
    track: function (event, extra) {
      var props = Object.assign({}, baseProps, extra);
      if (debug) console.info("[analytics stub]", event, props);
    }
  };

  /* ---------------------------------------------------------------------
   * HANDLER STUBS. No email capture or payment wiring yet.
   * Both resolve immediately and keep nothing.
   * ------------------------------------------------------------------- */
  function submitSignup(email) {
    void email;
    return Promise.resolve({ ok: true });
  }
  function startReserve() {
    return Promise.resolve({ ok: true, fakeDoor: true });
  }

  /* --- copy ------------------------------------------------------------ */
  var tokens = {
    project: C.productName,
    price: V.currency + priceKey,
    deposit: C.reserve.deposit
  };
  function fill(s) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return k in tokens ? tokens[k] : m; });
  }
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = fill(text);
    return n;
  }

  $$("[data-c]").forEach(function (n) { n.textContent = fill(get(C, n.dataset.c)); });
  $$("[data-a]").forEach(function (n) { n.textContent = fill(A[n.dataset.a]); });
  $$("[data-alt]").forEach(function (n) { n.alt = fill(get(C, n.dataset.alt)); });

  var headline = fill(h1Override ? ho.text : A.headline);
  var h1 = $("#h1");
  h1.textContent = headline;
  // Display type scales down for longer headlines.
  h1.dataset.len = headline.length <= 12 ? "s" : headline.length <= 26 ? "m" : "l";

  var norm = function (t) { return t.toLowerCase().replace(/[^a-z]/g, ""); };
  $("#sticker").textContent = fill(norm(headline) === norm(C.sticker.text) ? C.sticker.ifHeadlineMatches : C.sticker.text);

  A.proofs.forEach(function (p) { $("#proofs").appendChild(el("li", null, p)); });
  $("#amount").textContent = tokens.price;
  $("#price-note").textContent = fill(C.price.useFallback ? C.price.noteFallback : C.price.note);
  C.disclosure.body.forEach(function (p) { $("#disclosure-body").appendChild(el("p", null, p)); });
  C.footer.links.forEach(function (l) {
    var li = el("li"), a = el("a", null, l.label);
    a.href = /^\[.*\]$/.test(l.href) ? "#" : l.href;
    li.appendChild(a);
    $("#foot-links").appendChild(li);
  });

  document.title = fill(C.meta.title);
  function meta(sel, val) { var m = $(sel); if (m) m.setAttribute("content", fill(val)); }
  meta('meta[name="description"]', C.meta.description);
  meta('meta[property="og:title"]', C.meta.title);
  meta('meta[property="og:description"]', C.meta.description);
  meta('meta[property="og:image:alt"]', C.meta.ogImageAlt);

  /* --- headline guard -------------------------------------------------- */
  var headlines = [A.eyebrow, headline, C.band, C.about.title, C.signoff, C.thanks.title, C.disclosure.title];
  var aiHeadlines = headlines.map(fill).filter(function (h) { return /\bAI\b/i.test(h); });
  if (aiHeadlines.length) console.warn("[copy] Headlines must not contain 'AI':", aiHeadlines);

  /* --- DRAFT tag ------------------------------------------------------- */
  if (C.flags.showDraftTag && params.get("draft") !== "0") {
    var tag = $("#draft");
    tag.textContent = "DRAFT · angle " + angleKey.toUpperCase() + " · " + tokens.price +
      (h1Override ? " · H1 override" : "") +
      (aiHeadlines.length ? " · headline says AI" : "");
    tag.hidden = false;
  }

  /* --- signup forms (email first) ------------------------------------- */
  var tpl = $("#signup-tpl");
  $$("form[data-form]").forEach(function (form) {
    var id = "email-" + form.dataset.form;
    form.appendChild(tpl.content.cloneNode(true));
    var label = $("label", form), input = $("input", form), err = $(".form-error", form);
    label.htmlFor = id;
    label.textContent = fill(C.signup.label);
    input.id = id;
    input.placeholder = fill(C.signup.placeholder);
    $("button", form).textContent = fill(C.signup.button);
    $(".form-note", form).textContent = fill(C.signup.note);
    err.id = id + "-error";
    err.textContent = fill(C.signup.error);

    input.addEventListener("input", function () {
      if (!err.hidden && input.validity.valid) { err.hidden = true; input.removeAttribute("aria-invalid"); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!input.value.trim() || !input.validity.valid) {
        err.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", err.id);
        input.focus();
        return;
      }
      analytics.track("email_submit", { form: form.dataset.form });
      submitSignup(input.value.trim()).then(function () { show("thanks"); });
    });
  });

  /* --- views: page -> thanks (price + Reserve) -> disclosure ---------- */
  var page = $("#page"), thanks = $("#thanks");
  function show(view) {
    page.hidden = view !== "page";
    thanks.hidden = view === "page";
    $("#offer").hidden = view !== "thanks";
    $("#skipped").hidden = view !== "skipped";
    $("#disclosure").hidden = view !== "disclosure";
    window.scrollTo(0, 0);
    if (view === "thanks") { $("#thanks-title").focus(); analytics.track("thanks_view"); }
    if (view === "disclosure") $("#disclosure-title").focus();
  }

  $("#reserve").addEventListener("click", function () {
    analytics.track("reserve_click", { deposit: C.reserve.deposit });
    startReserve().then(function () { show("disclosure"); });
  });
  $("#skip").addEventListener("click", function () {
    analytics.track("skip_click");
    show("skipped");
    $("#skipped").focus();
  });

  // ?view=thanks or ?view=disclosure jumps straight to that state for QA/screenshots.
  var startView = params.get("view");
  if (startView === "thanks" || startView === "disclosure") show(startView);

  analytics.track("lp_view");
})();
