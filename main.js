(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  document.documentElement.classList.add('js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /flat/.test(location.search);
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Hand-drawn marks: circles, underlines, strikes over marked words; arrows from notes to things ----------
  const rnd = (seed) => { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
  const fmt = n => n.toFixed(1);
  function smooth(pts) {
    if (pts.length < 3) return 'M' + pts.map(p => fmt(p[0]) + ' ' + fmt(p[1])).join('L');
    let d = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; d += 'Q' + fmt(pts[i][0]) + ' ' + fmt(pts[i][1]) + ' ' + fmt(m[0]) + ' ' + fmt(m[1]); }
    return d + 'L' + fmt(pts[pts.length - 1][0]) + ' ' + fmt(pts[pts.length - 1][1]);
  }
  function markPath(kind, b, seed) {
    const r = rnd(seed), pts = [];
    if (kind === 'circle') {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + Math.max(7, b.h * 0.35), ry = b.h / 2 + Math.max(4, b.h * 0.22);
      const n = 34; const a0 = Math.PI * 0.85 + r() * 0.4;
      for (let i = 0; i <= n; i++) { const t = a0 + (i / n) * Math.PI * 2.18; const w = 1 + 0.035 * Math.sin(t * 3 + seed) + (r() - 0.5) * 0.03; pts.push([cx + Math.cos(t) * rx * w, cy + Math.sin(t) * ry * w + (i / n) * 2.5]); }
    } else if (kind === 'underline') {
      const y = b.y + b.h - 1, n = 8;
      for (let i = 0; i <= n; i++) pts.push([b.x - 3 + (i / n) * (b.w + 6), y + (r() - 0.5) * 2.2 + (i / n) * 1.5]);
    } else if (kind === 'strike') {
      const y = b.y + b.h * 0.55, n = 8;
      for (let i = 0; i <= n; i++) pts.push([b.x - 4 + (i / n) * (b.w + 8), y + (r() - 0.5) * 2.4 - (i / n) * 1.8]);
    }
    return smooth(pts);
  }
  // A hand-drawn arrow from (x0,y0) to (x1,y1): a bowed shaft with a small open head.
  function arrowPath(x0, y0, x1, y1, seed, bowK) {
    const r = rnd(seed);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    // bowK (from data-bow) fixes the curve's side and depth; otherwise the seed picks a gentle random bow
    const nx = -dy / L, ny = dx / L, bow = bowK != null ? bowK * L : (r() - 0.5) * L * 0.3;
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) { const t = i / n; const s = Math.sin(Math.PI * t); pts.push([x0 + dx * t + nx * bow * s + (r() - 0.5) * 1.6, y0 + dy * t + ny * bow * s + (r() - 0.5) * 1.6]); }
    const tip = pts[pts.length - 1], prev = pts[pts.length - 2];
    const ang = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]), hl = 11;
    const head = 'M' + fmt(tip[0] - Math.cos(ang - 0.5) * hl) + ' ' + fmt(tip[1] - Math.sin(ang - 0.5) * hl) + 'L' + fmt(tip[0]) + ' ' + fmt(tip[1]) + 'L' + fmt(tip[0] - Math.cos(ang + 0.5) * hl) + ' ' + fmt(tip[1] - Math.sin(ang + 0.5) * hl);
    return smooth(pts) + head;
  }
  function layerFor(root) {
    let layer = root.querySelector(':scope > svg.ann-layer');
    if (!layer) { layer = document.createElementNS(NS, 'svg'); layer.classList.add('ann-layer'); layer.setAttribute('aria-hidden', 'true'); root.appendChild(layer); }
    return layer;
  }
  const marks = new Map();
  let seedCounter = 1;
  function syncMarks(scope) {
    $$('.ann', scope || document).forEach(el => {
      const root = el.closest('[data-ann-root]') || document.body;
      const layer = layerFor(root);
      const rr = root.getBoundingClientRect();
      const frags = Array.from(el.getClientRects()).filter(r => r.width > 1 && r.height > 2);
      if (!frags.length) return;
      const rects = [];
      frags.sort((a, b) => a.top - b.top || a.left - b.left).forEach(r => {
        const row = rects.find(q => Math.abs(q.top - r.top) < r.height * 0.6);
        if (row) { row.left = Math.min(row.left, r.left); row.right = Math.max(row.right, r.right); row.bottom = Math.max(row.bottom, r.bottom); }
        else rects.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      });
      rects.forEach(q => { q.width = q.right - q.left; q.height = q.bottom - q.top; });
      const kind = el.dataset.ann || 'underline';
      const boxes = kind === 'circle' ? [rects.reduce((a, b) => (b.width > a.width ? b : a))] : rects;
      let group = marks.get(el);
      if (!group) { group = document.createElementNS(NS, 'g'); el.dataset.seed = el.dataset.seed || String(seedCounter++); marks.set(el, group); }
      if (group.parentNode !== layer) layer.appendChild(group);
      while (group.childNodes.length > boxes.length) group.removeChild(group.lastChild);
      boxes.forEach((r, i) => {
        let path = group.childNodes[i];
        if (!path) { path = document.createElementNS(NS, 'path'); path.setAttribute('pathLength', '1'); path.setAttribute('fill', 'none'); group.appendChild(path); }
        path.setAttribute('d', markPath(kind, { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height }, +el.dataset.seed + i * 7));
        path.setAttribute('stroke', getComputedStyle(el).color);
        path.style.animationDelay = (i * 0.25) + 's';
        path.classList.toggle('in', el.classList.contains('in'));
      });
    });
  }
  // Pointer notes: a handwritten phrase with an arrow to a point given in % of its stage.
  function syncPointers(stage) {
    const layer = layerFor(stage);
    const sr = stage.getBoundingClientRect();
    $$('.pointer', stage).forEach(el => {
      if (el.dataset.tx == null) return;
      let path = marks.get(el);
      if (!path) { path = document.createElementNS(NS, 'path'); path.setAttribute('pathLength', '1'); path.setAttribute('fill', 'none'); path.classList.add('arrow'); el.dataset.seed = el.dataset.seed || String(seedCounter++); marks.set(el, path); }
      if (path.parentNode !== layer) layer.appendChild(path);
      const r = el.getBoundingClientRect();
      const tx = sr.width * (+el.dataset.tx) / 100, ty = sr.height * (+el.dataset.ty) / 100;
      const cx = r.left - sr.left + r.width / 2, cy = r.top - sr.top + r.height / 2;
      // leave from the side of the note that faces the target
      let x0, y0;
      if (Math.abs(tx - cx) > Math.abs(ty - cy)) { x0 = tx > cx ? r.right - sr.left + 10 : r.left - sr.left - 10; y0 = cy + (ty > cy ? 4 : -4); }
      else { y0 = ty > cy ? r.bottom - sr.top + 8 : r.top - sr.top - 8; x0 = cx + (tx > cx ? 10 : -10); }
      const ex = tx - (tx - x0) * 0.04, ey = ty - (ty - y0) * 0.04;
      path.setAttribute('d', arrowPath(x0, y0, ex, ey, +el.dataset.seed, el.dataset.bow != null ? +el.dataset.bow : null));
      path.setAttribute('stroke', getComputedStyle(el).color);
      path.classList.toggle('in', el.classList.contains('in'));
    });
  }
  window.MESA_ANN = { sync: syncMarks };

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    syncMarks();
  }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
  $$('.ann:not(.stage .ann), .hw:not(.static):not(.stage .hw), .crossed').forEach(el => io.observe(el));
  $$('.hw').forEach(svg => $$('path', svg).forEach((p, i) => p.style.setProperty('--i', i)));
  // pointer notes share one handwriting size: the width follows each phrase's viewBox (FOLDS ROUND THE BACK = 148 units at 176px)
  $$('.pointer').forEach(el => { const svg = $('svg', el); const vb = svg && svg.viewBox && svg.viewBox.baseVal; if (vb && vb.width) el.style.width = Math.round(vb.width * 176 / 148) + 'px'; });
  setTimeout(() => {
    $$('.hw:not(.static):not(.in)').forEach(el => {
      if (el.closest('.stage')) return;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) el.classList.add('in');
    });
  }, 900);

  // ---------- Scroll stories: a sticky stage whose beats move up and in, then up and out ----------
  const stories = $$('[data-scrolly]').map(sec => {
    const stage = $('.stage', sec);
    const groups = new Map();
    $$('.beat', sec).forEach(b => { const k = b.parentElement; if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ el: b, from: +b.dataset.from, to: +b.dataset.to }); });
    const pointers = $$('.pointer', sec).map(el => ({ el, at: +el.dataset.at, until: el.dataset.until != null ? +el.dataset.until : 2 }));
    const counter = $('.story-counter', sec);
    return { sec, stage, groups, pointers, counter, p: -1 };
  });
  function updateStory(st, force) {
    const rect = st.sec.getBoundingClientRect();
    if (!force && (rect.bottom < -100 || rect.top > window.innerHeight + 100)) return;
    const total = Math.max(1, st.sec.offsetHeight - window.innerHeight);
    const p = st.stage.classList.contains('no3d') ? 1 : clamp(-rect.top / total, 0, 1);
    st.p = p;
    st.groups.forEach(list => {
      list.forEach((b, i) => {
        const next = list[i + 1] ? list[i + 1].from : 2;
        // each beat holds right up to the next one's cue; the handover itself is timed (out first, then in), never a blank stretch of scroll
        const on = p >= b.from && p < next;
        if (on) b.el.style.setProperty('--drift', ((0.5 - clamp((p - b.from) / (next - b.from), 0, 1)) * 32).toFixed(1) + 'px');
        b.el.classList.toggle('on', on);
        b.el.classList.toggle('above', !on && p >= next);
        b.el.classList.toggle('below', !on && p < b.from);
      });
    });
    st.pointers.forEach(pt => { const on = p >= pt.at && p < pt.until; pt.el.classList.toggle('in', on); $$('.hw', pt.el).forEach(h => h.classList.toggle('in', on)); });
    if (st.counter) {
      const list = Array.from(st.groups.values())[0] || [];
      const idx = list.reduce((k, b, i) => (p >= b.from ? i + 1 : k), 1);
      st.counter.textContent = String(idx).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
    }
    syncPointers(st.stage);
    syncMarks(st.stage);
  }
  stories.forEach(st => {
    if (st.stage.classList.contains('no3d') || reduced) {
      st.stage.classList.add('flat');
      st.groups.forEach(list => list.forEach(b => b.el.classList.add('on')));
      st.pointers.forEach(pt => { pt.el.classList.add('in'); $$('.hw', pt.el).forEach(h => h.classList.add('in')); });
    }
  });
  // the stage can change height without a scroll (mobile toolbars, late layout); keep the arrows and beats in step
  if (window.ResizeObserver) new ResizeObserver(() => stories.forEach(st => updateStory(st, true))).observe(document.documentElement);

  // ---------- Template gallery: the title scrolls away, the pages pin and grow one at a time to near full screen ----------
  const galleries = $$('[data-gallery]').map(sec => {
    const g = { sec, head: $('.head', sec), stage: $('.gstage', sec), sticky: $('.gsticky', sec), track: $('.track', sec), shots: $$('.gitem', sec),
                ASPECT: 202 / 246, SCALE_MAX: 1.0, SCALE_MIN: 0.84, RAMP_END: 0.04, PEAK_FRAC: 0.62, ROW_CENTER: 0.46, CAPTION_SPACE: 118,
                PLATEAU: 40, FALLOFF: 220, textLeft: 0, focalStart: 0, focalEnd: 0, range: 0, scrollS: 0, shotW: 0, shotH: 0, spacing: 0, tyPeak: 0 };
    g.shots.forEach((shot, i) => shot.addEventListener('click', () => window.scrollTo({ top: Math.round(window.scrollY + g.stage.getBoundingClientRect().top + i * g.spacing), behavior: reduced ? 'auto' : 'smooth' })));
    return g;
  });
  const prominence = (g, d) => d <= g.PLATEAU ? 1 : d >= g.PLATEAU + g.FALLOFF ? 0 : 0.5 + 0.5 * Math.cos(((d - g.PLATEAU) / g.FALLOFF) * Math.PI);
  function measureGallery(g) {
    if (g.sec.classList.contains('flat')) return;
    const viewH = window.innerHeight, viewW = window.innerWidth;
    g.textLeft = g.head.getBoundingClientRect().left + parseFloat(getComputedStyle(g.head).paddingLeft);
    g.track.style.paddingLeft = g.textLeft + 'px';
    const peakH = Math.min(viewH - g.CAPTION_SPACE - 40, viewH * g.PEAK_FRAC);
    let restH = peakH / g.SCALE_MAX, w = restH * g.ASPECT;
    const maxW = (viewW * 0.85) / g.SCALE_MAX;
    if (w > maxW) { w = maxW; restH = w / g.ASPECT; }
    g.shotW = w; g.shotH = restH;
    const root = document.documentElement.style;
    root.setProperty('--shot-w', w.toFixed(1) + 'px');
    const cardTop = Math.max(viewH * g.ROW_CENTER - restH / 2, 24);
    root.setProperty('--card-top', cardTop.toFixed(0) + 'px');
    g.stage.style.marginTop = Math.min(0, 40 - cardTop).toFixed(0) + 'px';
    g.tyPeak = -14;
    g.spacing = g.shots.length > 1 ? g.shots[1].offsetLeft - g.shots[0].offsetLeft : w;
    g.PLATEAU = g.spacing * 0.15; g.FALLOFF = g.spacing * 0.8;
    g.focalStart = g.textLeft + w / 2;
    g.focalEnd = Math.max(viewW - g.textLeft - w / 2, g.focalStart);
    const first = g.shots[0].offsetLeft + w / 2, last = g.shots[g.shots.length - 1].offsetLeft + w / 2;
    g.range = last - g.focalEnd; g.scrollS = last - first;
    g.stage.style.height = 'calc(100vh + ' + Math.round(g.scrollS) + 'px)';
    updateGallery(g);
  }
  function updateGallery(g) {
    if (g.sec.classList.contains('flat')) return;
    const rect = g.stage.getBoundingClientRect();
    if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
    const p = g.scrollS > 0 ? clamp(-rect.top / g.scrollS, 0, 1) : 0;
    const tx = -p * g.range;
    g.track.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,0)';
    const focal = g.focalStart + (g.focalEnd - g.focalStart) * p;
    const ramp = Math.min(1, p / g.RAMP_END);
    g.shots.forEach(shot => {
      const center = shot.offsetLeft + g.shotW / 2 + tx;
      const t = prominence(g, Math.abs(center - focal)) * ramp;
      const s = g.SCALE_MIN + (g.SCALE_MAX - g.SCALE_MIN) * t;
      const ty = t * g.tyPeak;
      const st = shot.style;
      st.setProperty('--s', s.toFixed(4)); st.setProperty('--ty', ty.toFixed(1) + 'px'); st.setProperty('--glow', t.toFixed(3));
      st.setProperty('--cap', clamp((t - 0.55) / 0.35, 0, 1).toFixed(3));
      st.setProperty('--capY', (g.shotH / 2 + (g.shotH * s) / 2 + ty).toFixed(1) + 'px');
    });
  }
  if (reduced) galleries.forEach(g => g.sec.classList.add('flat'));
  galleries.forEach(measureGallery);

  // ---------- Nav: hidden behind the wordmark, then the black bar ----------
  const nav = $('.nav');
  const mast = $('.masthead');
  function navTone() {
    if (!nav) return;
    if (!mast) { nav.classList.add('show', 'dark'); return; }
    const past = window.scrollY > mast.offsetTop + mast.offsetHeight - 24;
    nav.classList.toggle('show', past);
    nav.classList.toggle('dark', past);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { ticking = false; stories.forEach(st => updateStory(st)); galleries.forEach(updateGallery); navTone(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { stories.forEach(st => updateStory(st, true)); galleries.forEach(measureGallery); syncMarks(); }, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { syncMarks(); stories.forEach(st => updateStory(st, true)); galleries.forEach(measureGallery); });
  window.addEventListener('load', () => { syncMarks(); stories.forEach(st => updateStory(st, true)); galleries.forEach(measureGallery); });
  stories.forEach(st => updateStory(st, true)); galleries.forEach(updateGallery); navTone(); syncMarks();

  // Keep deep links aligned after the gallery and fonts finish changing page height.
  const accessoryHash = /^#(?:covers|toppers)$/.test(location.hash) ? location.hash : '';
  if (accessoryHash) {
    let userMoved = false;
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(type => window.addEventListener(type, () => { userMoved = true; }, { once: true, passive: true }));
    const alignAccessory = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (userMoved || location.hash !== accessoryHash) return;
      const target = $(accessoryHash);
      if (target) window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - 64, behavior: 'instant' });
    }));
    window.addEventListener('load', alignAccessory, { once: true });
    if (document.fonts) document.fonts.ready.then(alignAccessory);
  }

  // ---------- Masthead: "a quiet place to think" swaps its two words in turn, up and out, then up and in ----------
  const swaps = $$('.mast-sub .swap').map(el => ({ el, words: el.dataset.words.split(','), i: 0 }));
  if (swaps.length && !reduced) {
    const measure = (sw, word) => { const m = document.createElement('span'); m.className = 'w'; m.textContent = word; m.style.visibility = 'hidden'; m.style.position = 'absolute'; sw.el.appendChild(m); const w = m.getBoundingClientRect().width; m.remove(); return w; };
    swaps.forEach(sw => { sw.el.style.width = measure(sw, sw.words[0]) + 'px'; });
    let turn = 0;
    const tick = () => {
      const sw = swaps[turn % swaps.length]; turn++;
      sw.i = (sw.i + 1) % sw.words.length;
      const word = sw.words[sw.i];
      const old = $('.w:not(.out)', sw.el);
      if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 420); }
      // three clean steps: the old word leaves straight up, then the line re-spaces with nothing showing, then the new word rises in
      setTimeout(() => { sw.el.style.width = measure(sw, word) + 'px'; }, 330);
      setTimeout(() => {
        const next = document.createElement('span'); next.className = 'w enter'; next.textContent = word; sw.el.appendChild(next);
        requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('enter')));
      }, 720);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => swaps.forEach(sw => { sw.el.style.width = measure(sw, sw.words[sw.i]) + 'px'; }));
    setTimeout(() => { tick(); setInterval(tick, 2600); }, 1800);
  }

  // ---------- Videos only play while visible ----------
  const vio = new IntersectionObserver(entries => {
    entries.forEach(e => { const v = e.target; if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); });
  }, { threshold: 0.2 });
  $$('video[data-lazy]').forEach(v => vio.observe(v));

  // ---------- Colorways ----------
  const NAMES = { orange: 'Sienna', silver: 'Mist', onyx: 'Graphite', darwin: 'Evolution', kafka: 'Metamorphosis', composition: 'Composition' };
  const sel = $('#po-color');
  function setColor(c, fromSelect) {
    $$('input[name="cover"]').forEach(s => { s.checked = s.value === c; });
    if (sel && !fromSelect) sel.value = c;
    window.dispatchEvent(new CustomEvent('mesa:cover', { detail: c }));
  }
  $$('input[name="cover"]').forEach(s => s.addEventListener('change', () => setColor(s.value)));
  if (sel) sel.addEventListener('change', () => setColor(sel.value, true));

  // Keep the native select as the form's source of truth, with a richer,
  // keyboard-accessible picker for colour and pattern swatches.
  const coverPicker = $('[data-cover-picker]');
  if (sel && coverPicker) {
    const trigger = $('#po-color-trigger'), menu = $('#po-color-options');
    const selectedName = $('#po-color-value'), selectedSwatch = $('[data-picker-swatch]');
    const choices = [], values = [...sel.options].map(option => option.value);
    let typeahead = '', typeaheadTime = 0;
    function swatch(value) {
      const source = document.querySelector(`[data-cover="${value}"] .cover-chip`);
      const chip = source.cloneNode(true); chip.setAttribute('aria-hidden', 'true'); return chip;
    }
    function syncPicker() {
      selectedName.textContent = sel.selectedOptions[0].textContent;
      selectedSwatch.replaceChildren(swatch(sel.value));
      choices.forEach((choice, index) => choice.setAttribute('aria-selected', String(values[index] === sel.value)));
    }
    function closePicker(restoreFocus) {
      menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
    function openPicker(index = sel.selectedIndex) {
      const rect = trigger.getBoundingClientRect();
      const above = rect.top, below = window.innerHeight - rect.bottom;
      const opensUp = below < 300 && above > below;
      menu.classList.toggle('opens-up', opensUp);
      menu.style.maxHeight = Math.max(120, Math.min(330, (opensUp ? above : below) - 20)) + 'px';
      menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      choices[Math.max(0, index)].focus({ preventScroll: true });
    }
    [...sel.options].forEach((option, index) => {
      const choice = document.createElement('button'); choice.type = 'button'; choice.tabIndex = -1;
      choice.setAttribute('role', 'option'); choice.setAttribute('aria-selected', String(option.selected));
      const copy = document.createElement('span'); copy.className = 'picker-option-copy';
      const name = document.createElement('span'), detail = document.createElement('small');
      const [title, ...details] = option.textContent.split(' · ');
      name.textContent = title; detail.textContent = details.join(' · '); copy.append(name, detail);
      choice.append(swatch(option.value), copy); menu.append(choice); choices.push(choice);
      choice.addEventListener('click', () => {
        sel.value = values[index]; sel.dispatchEvent(new Event('change', { bubbles: true })); closePicker(true);
      });
    });
    trigger.addEventListener('click', () => menu.hidden ? openPicker() : closePicker(false));
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); openPicker(event.key === 'ArrowUp' ? choices.length - 1 : sel.selectedIndex);
      }
    });
    menu.addEventListener('keydown', event => {
      const current = choices.indexOf(document.activeElement);
      const next = { ArrowDown: (current + 1) % choices.length, ArrowUp: (current + choices.length - 1) % choices.length, Home: 0, End: choices.length - 1 };
      if (event.key in next) { event.preventDefault(); choices[next[event.key]].focus({ preventScroll: true }); }
      else if (event.key === 'Escape') { event.preventDefault(); closePicker(true); }
      else if (event.key === 'Tab') closePicker(true);
      else if (event.key.length === 1 && /[a-z]/i.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const now = Date.now(); typeahead = (now - typeaheadTime > 600 ? '' : typeahead) + event.key.toLowerCase(); typeaheadTime = now;
        const match = choices.find(choice => choice.querySelector('.picker-option-copy > span').textContent.toLowerCase().startsWith(typeahead));
        if (match) match.focus({ preventScroll: true });
      }
    });
    document.addEventListener('pointerdown', event => { if (!coverPicker.contains(event.target)) closePicker(false); });
    document.addEventListener('focusin', event => { if (!coverPicker.contains(event.target)) closePicker(false); });
    window.addEventListener('resize', () => closePicker(false));
    sel.addEventListener('change', syncPicker);
    syncPicker(); sel.hidden = true; coverPicker.hidden = false;
    $('#po-color-label').htmlFor = trigger.id;
  }

  // ---------- Pre-order form: placeholder. Wire to your checkout (Stripe / Shopify) here. ----------
  const form = $('#preorder-form');
  const toast = $('.toast');
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 4200);
  }
  if (form) form.addEventListener('submit', ev => {
    ev.preventDefault();
    const email = $('#po-email').value.trim();
    const qty = $('#po-qty').value;
    const color = NAMES[$('#po-color').value];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say('Add an email so we know where to send the good news.'); $('#po-email').focus(); return; }
    const topper = $('#po-topper').selectedOptions[0].textContent.split(' · ')[0];
    say(`Demo only: ${qty} × Mesa in ${color}, with the ${topper} topper, for ${email}. Checkout is not connected; no reservation was made.`);
  });
})();
