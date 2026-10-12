(function () {
  "use strict";

  var C = window.LP_COPY;
  var params = new URLSearchParams(location.search);
  var debug = params.get("debug") === "1";

  /* ---------------------------------------------------------------------
   * ANALYTICS: NO-OP STUBS. Nothing is sent anywhere.
   * Wire a real provider inside track() when the test goes live.
   * With ?debug=1 events are logged to the console for QA.
   * ------------------------------------------------------------------- */
  var analytics = {
    track: function (event, props) {
      if (debug) console.info("[analytics stub]", event, props || {});
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

  /* --- variant resolution --------------------------------------------- */
  var V = C.variants;
  var angleKey = C.angles[params.get("angle")] ? params.get("angle") : V.defaultAngle;
  var priceKey = V.prices.indexOf(params.get("price")) > -1 ? params.get("price") : V.defaultPrice;
  var A = C.angles[angleKey];
  var variant = { angle: angleKey, price: priceKey };

  var tokens = {
    project: C.productName,
    ai: C.ai.useFallback ? C.ai.fallback : C.ai.name,
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

  /* --- copy ------------------------------------------------------------ */
  $$("[data-c]").forEach(function (n) { n.textContent = fill(get(C, n.dataset.c)); });
  $$("[data-a]").forEach(function (n) { n.textContent = fill(A[n.dataset.a]); });
  $$("[data-alt]").forEach(function (n) { n.alt = fill(get(C, n.dataset.alt)); });
  $("#amount").textContent = tokens.price;

  A.proofs.forEach(function (p) { $("#proofs").appendChild(el("li", null, p)); });
  A.story.forEach(function (s, i) {
    var li = el("li");
    li.appendChild(el("span", "step-n", String(i + 1).padStart(2, "0")));
    li.appendChild(el("h3", null, s.title));
    li.appendChild(el("p", null, s.body));
    $("#steps").appendChild(li);
  });
  C.price.details.forEach(function (d) { $("#details").appendChild(el("li", null, d)); });

  document.title = fill(C.meta.title);
  function meta(sel, val) { var m = $(sel); if (m) m.setAttribute("content", fill(val)); }
  meta('meta[name="description"]', C.meta.description);
  meta('meta[property="og:title"]', C.meta.title);
  meta('meta[property="og:description"]', C.meta.description);
  meta('meta[property="og:image:alt"]', C.meta.ogImageAlt);

  /* --- headline guard -------------------------------------------------- */
  var headlines = [A.headline, A.storyTitle, C.price.title, C.thanks.title, C.disclosure.title];
  var aiHeadlines = headlines.map(fill).filter(function (h) { return /\bAI\b/i.test(h); });
  if (aiHeadlines.length) console.warn("[copy] Headlines must not contain 'AI':", aiHeadlines);

  /* --- DRAFT tag ------------------------------------------------------- */
  var showDraft = C.flags.showDraftTag && params.get("draft") !== "0";
  if (showDraft) {
    var tag = $("#draft");
    tag.textContent = "DRAFT · angle " + angleKey.toUpperCase() + " · " + tokens.price +
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
      analytics.track("signup_submit", { form: form.dataset.form, angle: angleKey, price: priceKey });
      submitSignup(input.value.trim()).then(function () { show("thanks"); });
    });
  });

  /* --- views: page -> thanks -> disclosure ---------------------------- */
  var page = $("#page"), thanks = $("#thanks"), offer = $("#offer"), disclosure = $("#disclosure");
  function show(view) {
    var onThanks = view === "thanks" || view === "disclosure";
    page.hidden = onThanks;
    thanks.hidden = !onThanks;
    $(".bar-cta").hidden = onThanks;
    offer.hidden = view === "disclosure";
    disclosure.hidden = view !== "disclosure";
    window.scrollTo(0, 0);
    if (view === "thanks") { $("#thanks-title").focus(); analytics.track("thanks_view", variant); }
    if (view === "disclosure") { $("#disclosure-title").focus(); analytics.track("disclosure_view", variant); }
  }

  $("#reserve").addEventListener("click", function () {
    analytics.track("reserve_click", { angle: angleKey, price: priceKey, deposit: C.reserve.deposit });
    startReserve().then(function () { show("disclosure"); });
  });
  $("#back").addEventListener("click", function (e) {
    e.preventDefault();
    show("page");
    $("#h1").focus({ preventScroll: true });
  });
  $$("[data-track]").forEach(function (n) {
    n.addEventListener("click", function () { analytics.track(n.dataset.track, variant); });
  });

  // ?view=thanks or ?view=disclosure jumps straight to that state for QA/screenshots.
  var startView = params.get("view");
  if (startView === "thanks" || startView === "disclosure") show(startView);

  analytics.track("page_view", variant);
  document.documentElement.classList.add("ready");
})();
