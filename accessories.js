/* Scroll-driven accessory rows. Each notebook has a complete, fitted pen.
   Isolated, antialiased layers receive premultiplied Gaussian blur and depth fades. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const coverStage = $('[data-cover-stage]'), penStage = $('[data-topper-stage]');
  if (!coverStage || !penStage) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const covers = [
    { id: 'orange', colour: '#d6391e', texture: 'pebble', roughness: .74, pen: 'silver' },
    { id: 'silver', colour: '#afb2ae', texture: 'cloth', roughness: .86, pen: 'silver' },
    { id: 'onyx', colour: '#34383a', texture: 'pebble', roughness: .72, pen: 'silver' },
    { id: 'darwin', colour: '#e41722', texture: 'pebble', roughness: .68, pen: 'red' },
    { id: 'kafka', colour: '#3457a5', texture: 'pebble', roughness: .68, pen: 'blue' },
    { id: 'composition', colour: '#ffffff', texture: 'cloth', roughness: .82, pen: 'pencil' },
  ];
  const toppers = [
    { id: 'round' }, { id: 'facet' },
    { id: 'orbit', action: 'Nudge the charm', instruction: 'Drag the star and let it drift.' },
    { id: 'loop' },
    { id: 'click', action: 'Press the clicker', instruction: 'Press, release, repeat.' },
  ];
  const buttons = [...document.querySelectorAll('[data-topper]')];
  const coverButtons = [...document.querySelectorAll('[data-cover]')];
  const actionButton = $('[data-topper-action]');
  const topperSelect = $('#po-topper'), coverSelect = $('#po-color');
  let selectedCover = Math.max(0, covers.findIndex(item => item.id === coverSelect.value));
  let active = 0, clickCount = 0, clickAmount = 0, clickVelocity = 0;
  let penView, coverView, models = [], coverModels = [], tether, plunger, compositionTexture, pageTexture;
  let frameId = 0, lastTime = 0, elapsed = 0, accumulator = 0, disposed = false;
  const views = [];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function describe() {
    const item = toppers[active];
    const introduced = penView && penView.reveal > .99;
    buttons.forEach((button, i) => button.setAttribute('aria-current', String(introduced && i === active)));
    actionButton.hidden = !item.action || !introduced || penView.lost;
    actionButton.closest('.depth-action').hidden = actionButton.hidden;
    actionButton.textContent = item.action || '';
    $('[data-topper-instruction]').textContent = item.instruction || '';
    penStage.classList.toggle('is-interactive', !!item.action && !!penView);
    penStage.classList.toggle('is-draggable', active === 2 && !!penView);
  }
  function focusOption(view, index) {
    if (!view || view.lost) return;
    if (motion.matches) { view.manual = index; view.phase = index; layout(1); wake(); return; }
    const sectionTop = window.scrollY + view.section.getBoundingClientRect().top;
    const distance = view.section.offsetHeight - view.section.querySelector('.depth-sticky').offsetHeight;
    // Align the middle of this option's dwell, without capturing wheel or touch events.
    window.scrollTo({ top: sectionTop - 64 + distance * (index + 1) / view.count, behavior: 'smooth' });
  }
  function selectTopper(index, manual) {
    if (index < 0) return;
    if (manual) topperSelect.value = toppers[index].id;
    active = index; describe(); focusOption(penView, index);
  }
  function bindChoices(list, choose) {
    list.forEach((button, index) => {
      button.addEventListener('click', () => choose(index));
      button.addEventListener('keydown', event => {
        const keys = { ArrowRight: (index + 1) % list.length, ArrowLeft: (index + list.length - 1) % list.length, Home: 0, End: list.length - 1 };
        if (!(event.key in keys)) return;
        event.preventDefault(); const next = keys[event.key]; list[next].focus(); choose(next);
      });
    });
  }
  bindChoices(buttons, index => selectTopper(index, true));
  bindChoices(coverButtons, index => {
    coverSelect.value = covers[index].id; coverSelect.dispatchEvent(new Event('change', { bubbles: true }));
    coverButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
    focusOption(coverView, index);
  });
  // Scroll is a preview; it never silently edits either order preference.
  topperSelect.addEventListener('change', () => {
    if (motion.matches && penView) penView.manual = Math.max(0, toppers.findIndex(item => item.id === topperSelect.value));
    wake();
  });
  window.addEventListener('mesa:cover', event => {
    const index = covers.findIndex(item => item.id === event.detail);
    if (index < 0) return;
    selectedCover = index;
    wake();
  });
  function motionMode() {
    [coverStage, penStage].forEach(stage => {
      stage.closest('[data-depth-section]').classList.toggle('is-reduced', motion.matches);
    });
    views.forEach(view => { view.manual = Math.max(0, Math.round(view.phase)); view.resize(); });
    describe(); wake();
  }
  motion.addEventListener('change', motionMode);
  motionMode();
  function unavailable(stage) {
    stage.classList.add('is-unavailable'); stage.classList.remove('is-ready');
    stage.closest('[data-depth-section]').classList.add('is-unavailable');
    stage.querySelector('.accessory-fallback').textContent = stage === coverStage
      ? 'Choose a cover colour below. The 3D preview is unavailable on this device.'
      : 'Choose a pen topper below. The 3D preview is unavailable on this device.';
    if (stage === penStage) { penView = null; describe(); }
  }
  if (!window.THREE || !THREE.GLTFLoader) { unavailable(coverStage); unavailable(penStage); return; }
  const T = THREE;
  const colour = hex => new T.Color(hex).convertSRGBToLinear();
  const textureCache = new Map();
  // Neutral height fields: actual surface response, with no baked-in colour.
  function surfaceTexture(kind) {
    if (textureCache.has(kind)) return textureCache.get(kind);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(256, 256);
    let seed = 37;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const woven = ['cloth', 'canvas', 'linen'].includes(kind);
      const thread = kind === 'canvas' ? 9 : kind === 'linen' ? 6 : 4;
      const wave = woven ? Math.sin(x * Math.PI * 2 / thread) * 26 + Math.sin(y * Math.PI * 2 / thread) * 22 : 0;
      const noise = (random() - .5) * (kind === 'suede' ? 72 : kind === 'smooth' ? 12 : 42);
      const i = (y * 256 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 128 + wave + noise;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    if (kind === 'pebble') for (let i = 0; i < 1900; i++) {
      const x = random() * 256, y = random() * 256, radius = 1 + random() * 3;
      const gradient = context.createRadialGradient(x, y, .2, x, y, radius);
      gradient.addColorStop(0, '#bbb'); gradient.addColorStop(1, '#696969');
      context.fillStyle = gradient; context.beginPath(); context.ellipse(x, y, radius, radius * .75, random() * Math.PI, 0, Math.PI * 2); context.fill();
    }
    const texture = new T.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    // CAD UV coordinates are millimetres; the repeat controls the weave size.
    texture.repeat.set(1 / 16, 1 / 16); texture.anisotropy = 4;
    textureCache.set(kind, texture); return texture;
  }

  function depthOfField(renderer, scene, camera, background) {
    // Blur whole premultiplied silhouettes, rather than sampling across depth
    // discontinuities. This avoids the dotted trails and hard cutout edges.
    const Target = renderer.capabilities.isWebGL2 ? T.WebGLMultisampleRenderTarget : T.WebGLRenderTarget;
    const raw = new Target(1, 1, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat });
    if (renderer.capabilities.isWebGL2) raw.samples = 4;
    raw.texture.encoding = T.sRGBEncoding;
    const horizontal = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const vertical = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const blurUniforms = { source: { value: raw.texture }, direction: { value: new T.Vector2() } };
    const blur = new T.ShaderMaterial({ uniforms: blurUniforms, vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D source;
        uniform vec2 direction;
        void main() {
          vec4 colour = vec4(0.);
          float total = 0.;
          for (int i = -16; i <= 16; i++) {
            float offset = float(i) / 16.;
            float weight = exp(-4.5 * offset * offset);
            colour += texture2D(source, vUv + direction * offset) * weight;
            total += weight;
          }
          gl_FragColor = colour / total;
        }`
    });
    const compositeUniforms = { source: { value: raw.texture }, opacity: { value: 1 } };
    const composite = new T.ShaderMaterial({ uniforms: compositeUniforms, vertexShader, depthTest: false, depthWrite: false, toneMapped: false,
      transparent: true, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendEquation: T.AddEquation,
      fragmentShader: 'varying vec2 vUv; uniform sampler2D source; uniform float opacity; void main(){gl_FragColor=texture2D(source,vUv)*opacity;}'
    });
    const postScene = new T.Scene(), postCamera = new T.Camera();
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), composite); postScene.add(quad);
    let width = 1, height = 1;
    return {
      resize(w, h) {
        width = w; height = h; raw.setSize(w, h);
        horizontal.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
        vertical.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
      },
      render(objects) {
        const savedAutoClear = renderer.autoClear;
        const savedVisibility = objects.map(object => object.visible);
        const layers = objects.filter(object => object.visible && object.userData.depthOpacity > .002).sort((a, b) => a.position.z - b.position.z);
        renderer.autoClear = false;
        renderer.setRenderTarget(null); renderer.setClearColor(background, 1); renderer.clear();
        objects.forEach(object => { object.visible = false; });
        for (const object of layers) {
          object.visible = true;
          renderer.setRenderTarget(raw); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
          object.visible = false;
          const radius = object.userData.blurRadius * renderer.getPixelRatio();
          let texture = raw.texture;
          if (radius > .6) {
            quad.material = blur; blurUniforms.source.value = raw.texture;
            blurUniforms.direction.value.set(radius / width, 0);
            renderer.setRenderTarget(horizontal); renderer.clear(); renderer.render(postScene, postCamera);
            blurUniforms.source.value = horizontal.texture; blurUniforms.direction.value.set(0, radius / height);
            renderer.setRenderTarget(vertical); renderer.clear(); renderer.render(postScene, postCamera);
            texture = vertical.texture;
          }
          quad.material = composite; compositeUniforms.source.value = texture; compositeUniforms.opacity.value = object.userData.depthOpacity;
          renderer.setRenderTarget(null); renderer.render(postScene, postCamera);
        }
        objects.forEach((object, index) => { object.visible = savedVisibility[index]; });
        renderer.autoClear = savedAutoClear;
      },
      dispose() { raw.dispose(); horizontal.dispose(); vertical.dispose(); blur.dispose(); composite.dispose(); quad.geometry.dispose(); }
    };
  }

  function createView(stage, minWidth, minHeight, centreY, count) {
    const canvas = stage.querySelector('canvas');
    const renderer = new T.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: 'low-power' });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .88;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 5, 2200);
    camera.position.set(0, centreY, 520); camera.lookAt(0, centreY, 0);
    const env = new T.Scene();
    const room = new T.Mesh(new T.BoxGeometry(1000, 1000, 1000), new T.MeshBasicMaterial({ color: '#242424', side: T.BackSide })); env.add(room);
    const panel = (w, h, x, y, z, power) => {
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(power, power, power), side: T.DoubleSide }));
      mesh.position.set(x, y, z); mesh.lookAt(0, 0, 0); env.add(mesh);
    };
    panel(240, 600, -300, 160, 300, 4); panel(180, 420, 360, 70, 120, 2.5); panel(450, 100, 0, 350, -180, 3);
    const pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(env, .035, .1, 1400);
    scene.environment = environment.texture; pmrem.dispose();
    env.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
    scene.add(new T.HemisphereLight(0xfffaf1, 0x777b85, .42));
    const light = new T.DirectionalLight(0xfff8ed, 1.3); light.position.set(-100, 160, 220); scene.add(light);
    const rim = new T.DirectionalLight(0xe5edff, .65); rim.position.set(170, 40, -40); scene.add(rim);
    const background = new T.Color(stage === coverStage ? '#e6e5e1' : '#deded9');
    const post = depthOfField(renderer, scene, camera, background);
    const section = stage.closest('[data-depth-section]');
    const labels = [...stage.querySelectorAll('[data-depth-label]')];
    const sealReflections = labels.map(label => label.querySelector('[data-seal-reflection]'));
    const intro = section.querySelector('[data-depth-intro]');
    const view = { stage, section, canvas, renderer, scene, camera, environment, post, labels, sealReflections, intro, count, phase: -1, target: -1, reveal: 0, manual: 0, current: -2, visible: false, ready: false, lost: false, width: 0, height: 0 };
    view.resize = () => {
      if (view.lost) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      view.width = w; view.height = h;
      renderer.setSize(w, h, false); post.resize(Math.round(w * pixelRatio), Math.round(h * pixelRatio));
      const viewHeight = Math.max(minHeight, minWidth / (w / h));
      camera.aspect = w / h; camera.fov = 2 * Math.atan(viewHeight / 1040) * 180 / Math.PI;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(); wake();
    };
    view.resizeObserver = new ResizeObserver(view.resize); view.resizeObserver.observe(stage);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); view.lost = true; view.visible = false; unavailable(stage); });
    views.push(view); view.resize(); return view;
  }
  const metal = new T.MeshStandardMaterial({ color: colour('#d7d9db'), metalness: 1, roughness: .25, envMapIntensity: 1.3 });
  const polished = new T.MeshStandardMaterial({ color: colour('#e9e5d9'), metalness: 1, roughness: .13, envMapIntensity: 1.5 });
  const darkMetal = new T.MeshStandardMaterial({ color: colour('#5d6065'), metalness: .85, roughness: .3 });
  const ceramic = new T.MeshPhysicalMaterial({ color: colour('#ecebe6'), roughness: .29, clearcoat: .32 });
  const penBarrel = new T.MeshStandardMaterial({ color: colour('#c9cbc8'), metalness: .45, roughness: .32, envMapIntensity: .75 });
  function mesh(group, geometry, material, x, y, z) {
    const object = new T.Mesh(geometry, material); object.position.set(x || 0, y || 0, z || 0); group.add(object); return object;
  }
  function cylinder(group, radius, height, y, material, sides) {
    return mesh(group, new T.CylinderGeometry(radius, radius, height, sides || 48), material, 0, y, 0);
  }
  function ring(group, radius, tube, y, material, flat) {
    const object = mesh(group, new T.TorusGeometry(radius, tube, 12, 48), material, 0, y, 0);
    if (flat) object.rotation.x = Math.PI / 2;
    return object;
  }
  function roundedEnd(group, material) {
    cylinder(group, 3.5, 4.1, 56.1, material);
    const dome = mesh(group, new T.SphereGeometry(3.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), material, 0, 58.15, 0);
    return dome;
  }
  function makeTopper(group, index) {
    ring(group, 4.05, .3, 53.9, metal, true);
    if (index === 0) {
      const capMaterial = new T.MeshPhysicalMaterial({ color: colour('#d6391e'), roughness: .75, reflectivity: .12, envMapIntensity: .35 });
      roundedEnd(group, capMaterial); group.userData.capMaterial = capMaterial;
    } else if (index === 1) {
      // A lathed eight-sided silhouette gives machined facets with chamfered ends.
      const points = [[0, 54], [3.8, 54], [4.65, 54.8], [4.65, 63.2], [3.85, 64], [0, 64]].map(p => new T.Vector2(...p));
      const facetedMetal = metal.clone(); facetedMetal.flatShading = true;
      mesh(group, new T.LatheGeometry(points, 8), facetedMetal).rotation.y = Math.PI / 8;
      ring(group, 3.5, .15, 64.1, darkMetal, true);
    } else if (index === 2 || index === 3) {
      cylinder(group, 4.2, 5.5, 56.75, index === 2 ? ceramic : metal);
      ring(group, 2.8, 1.1, 61.6, index === 2 ? polished : metal, false);
      if (index === 2) makeTether(group);
    } else {
      cylinder(group, 4.45, 8.2, 58.1, metal);
      for (let i = 0; i < 4; i++) ring(group, 4.44, .1, 55.1 + i * .8, darkMetal, true);
      cylinder(group, 3.2, .6, 62.4, darkMetal);
      plunger = new T.Group(); plunger.position.y = 0; group.add(plunger);
      cylinder(plunger, 2.55, 4.2, 64.1, darkMetal);
      cylinder(plunger, 3.55, 3.6, 66.8, metal);
      mesh(plunger, new T.SphereGeometry(3.55, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, 68.6, 0).scale.y = .2;
    }
  }

  function makeTether(group) {
    const anchor = new T.Vector3(0, 64.5, 0), count = 10, length = 2.25;
    const points = Array.from({ length: count + 1 }, (_, i) => anchor.clone().add(new T.Vector3(i * 1.8, i * 1.35, 0)));
    const previous = points.map(point => point.clone());
    const links = Array.from({ length: count }, (_, i) => {
      const link = mesh(group, new T.TorusGeometry(.62, .2, 6, 12), polished);
      link.scale.y = 1.7; link.userData.twist = i % 2 ? Math.PI / 2 : 0; return link;
    });
    const charm = new T.Group(); group.add(charm);
    const shape = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 2.7 : 5.8;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const star = mesh(charm, new T.ExtrudeGeometry(shape, { depth: 1.25, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .45, bevelThickness: .4 }), polished, 0, 5.1, -.6);
    star.rotation.z = -.2;
    ring(charm, .9, .3, 0, polished, false);
    tether = { group, anchor, points, previous, links, charm, length, dragging: false, target: new T.Vector3(), direction: new T.Vector3(), difference: new T.Vector3() };
    updateTetherMeshes();
  }

  function simulateTether(dt, time) {
    if (!tether) return;
    const t = tether, end = t.points.length - 1;
    t.points[0].copy(t.anchor); t.previous[0].copy(t.anchor);
    for (let i = 1; i <= end; i++) {
      const point = t.points[i], previous = t.previous[i];
      const x = point.x, y = point.y, z = point.z;
      // No gravity. Gentle changing currents and low drag keep the charm afloat;
      // moving a node changes its velocity, so release retains the drag momentum.
      point.x += (point.x - previous.x) * .994 + Math.sin(time * .9 + i * .15) * 1.8 * dt * dt;
      point.y += (point.y - previous.y) * .994 + Math.cos(time * .7 + i * .1) * 1.4 * dt * dt;
      point.z += (point.z - previous.z) * .994 + Math.sin(time * .6 + i * .2) * 1.6 * dt * dt;
      previous.set(x, y, z);
    }
    if (t.dragging) t.points[end].copy(t.target);
    for (let pass = 0; pass < 12; pass++) {
      t.points[0].copy(t.anchor);
      if (t.dragging) t.points[end].copy(t.target);
      for (let i = 0; i < end; i++) {
        const a = t.points[i], b = t.points[i + 1];
        t.difference.subVectors(b, a);
        const distance = t.difference.length();
        if (distance < .00001) continue;
        t.difference.multiplyScalar((distance - t.length) / distance);
        const aFixed = i === 0, bFixed = t.dragging && i + 1 === end;
        if (aFixed) b.sub(t.difference);
        else if (bFixed) a.add(t.difference);
        else { a.addScaledVector(t.difference, .5); b.addScaledVector(t.difference, -.5); }
      }
    }
    t.points[0].copy(t.anchor);
  }
  const up = new T.Vector3(0, 1, 0);
  function updateTetherMeshes() {
    if (!tether) return;
    const t = tether;
    t.links.forEach((link, i) => {
      link.position.copy(t.points[i]).add(t.points[i + 1]).multiplyScalar(.5);
      t.direction.subVectors(t.points[i + 1], t.points[i]).normalize();
      link.quaternion.setFromUnitVectors(up, t.direction); link.rotateY(link.userData.twist);
    });
    t.charm.position.copy(t.points[t.points.length - 1]);
    if (!motion.matches) t.charm.rotation.set(Math.sin(elapsed * .8) * .24, Math.sin(elapsed * .57) * .6, Math.sin(elapsed * .71) * .2);
  }
  function nudgeCharm() {
    if (!tether) return;
    tether.previous.forEach((point, i) => { if (i) { point.x -= .08 * i / 10; point.z -= .045 * i / 10; } });
    if (motion.matches) { for (let i = 0; i < 30; i++) simulateTether(1 / 120, elapsed); }
    $('[data-topper-feedback]').textContent = 'Charm nudged.'; wake();
  }
  function clickTopper() {
    clickVelocity = -52; clickCount++;
    if (motion.matches) { clickAmount = 0; clickVelocity = 0; }
    $('[data-topper-feedback]').textContent = 'Click ' + clickCount + '.';
    if (navigator.vibrate) navigator.vibrate(8);
    wake();
  }
  actionButton.addEventListener('click', () => {
    if (active === 2) nudgeCharm(); else if (active === 4) clickTopper();
    focusOption(penView, active);
  });

  function prepareFlap(source) {
    const flap = source.clone(true);
    flap.traverse(object => {
      if (!object.isMesh) return;
      object.geometry = object.geometry.clone();
      object.userData.restPositions = object.geometry.attributes.position.array.slice();
      object.userData.restNormals = object.geometry.attributes.normal.array.slice();
    });
    return flap;
  }
  function openCover(flap, amount) {
    if (Math.abs((flap.userData.openAmount || 0) - amount) < .0001) return;
    flap.userData.openAmount = amount;
    flap.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry, position = geometry.attributes.position, normal = geometry.attributes.normal;
      const rest = object.userData.restPositions, normals = object.userData.restNormals;
      for (let i = 0; i < position.count; i++) {
        const x = rest[i * 3] + 59.4, y = rest[i * 3 + 1] - 4;
        // The wrap stays attached. The flat front lifts, with a soft bend at the spine.
        const angle = amount * smooth(0, 18, x), c = Math.cos(angle), sn = Math.sin(angle);
        position.array[i * 3] = -59.4 + x * c - y * sn;
        position.array[i * 3 + 1] = 4 + x * sn + y * c;
        normal.array[i * 3] = normals[i * 3] * c - normals[i * 3 + 1] * sn;
        normal.array[i * 3 + 1] = normals[i * 3] * sn + normals[i * 3 + 1] * c;
      }
      position.needsUpdate = normal.needsUpdate = true; geometry.computeBoundingSphere();
    });
  }
  function wrapComposition(part) {
    part.traverse(object => {
      if (!object.isMesh) return;
      // Unroll one sheet around the spine, from front to back. The UVs stay
      // attached to the original surface when the front bends open.
      object.geometry = object.geometry.clone();
      const positions = object.geometry.attributes.position;
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + 59.4, y = positions.getY(i) - 4;
        let distance;
        if (x >= 0) distance = y >= 0 ? x : -Math.PI * 6 - x;
        else {
          let angle = Math.atan2(y, x);
          if (angle < 0) angle += Math.PI * 2;
          distance = -(angle - Math.PI / 2) * 6;
        }
        uv[i * 2] = (distance + 150) / 300;
        uv[i * 2 + 1] = (90 - positions.getZ(i)) / 300;
      }
      object.geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
    });
  }
  function notebookPen(source, finish) {
    // Preserve the CAD transform: the complete pen sits inside its spine holder.
    const pen = source.clone(true);
    const solidColour = { red: '#e41722', blue: '#3457a5' }[finish];
    const solid = solidColour && new T.MeshPhysicalMaterial({ color: colour(solidColour), roughness: .47, reflectivity: .12, envMapIntensity: .35 });
    const orange = new T.MeshPhysicalMaterial({ color: colour('#d6391e'), roughness: .6, reflectivity: .12, envMapIntensity: .35 });
    const pink = new T.MeshPhysicalMaterial({ color: colour('#ed3077'), roughness: .78, reflectivity: .12, envMapIntensity: .35 });
    pen.traverse(object => {
      if (!object.isMesh) return;
      const name = object.material.name;
      if (solid) object.material = solid;
      else if (finish === 'pencil') {
        if (name === 'pen_eraser') object.material = pink;
        else object.visible = false;
      } else object.material = name === 'pen_barrel' ? metal : orange;
    });
    if (finish === 'pencil') {
      const yellow = new T.MeshPhysicalMaterial({ color: colour('#dda000'), roughness: .5, flatShading: true, reflectivity: .12, envMapIntensity: .35 });
      const wood = new T.MeshStandardMaterial({ color: colour('#d5b18a'), roughness: .86, flatShading: true });
      const graphite = new T.MeshStandardMaterial({ color: colour('#424443'), roughness: .75 });
      cylinder(pen, 4.4, 124, 76, yellow, 6);
      mesh(pen, new T.CylinderGeometry(4.4, .65, 13, 6), wood, 0, 7.5, 0);
      mesh(pen, new T.CylinderGeometry(.8, 0, 2.8, 6), graphite, 0, 1.4, 0);
      cylinder(pen, 3.65, 4, 136, metal);
      [134.4, 135.2, 136.8, 137.6].forEach(y => ring(pen, 3.64, .1, y, darkMetal, true));
    }
    return pen;
  }
  function makeCovers(gltf) {
    coverView = createView(coverStage, 270, 270, 0, covers.length);
    const flapSource = gltf.scene.getObjectByName('flap'), back = gltf.scene.getObjectByName('cover_back');
    const sourcePen = gltf.scene.getObjectByName('pen');
    if (!flapSource || !back || !sourcePen) throw new Error('Missing notebook nodes');
    covers.forEach((item, index) => {
      const pivot = new T.Group(), tilt = new T.Group(), flap = prepareFlap(flapSource);
      const patterned = item.id === 'composition';
      const material = new T.MeshPhysicalMaterial({ color: colour(item.colour), map: patterned ? compositionTexture : null, roughness: item.roughness, metalness: 0, bumpMap: patterned ? null : surfaceTexture(item.texture), bumpScale: item.texture === 'pebble' ? .28 : .18, reflectivity: .12, envMapIntensity: .35 });
      [back.clone(true), flap].forEach(part => {
        if (patterned) wrapComposition(part);
        part.traverse(object => { if (object.isMesh) object.material = material; }); tilt.add(part);
      });
      // A glimpse of the tablet beneath the raised front makes the opening legible.
      const body = gltf.scene.getObjectByName('body');
      if (body) {
        const shell = body.clone(true); shell.traverse(object => { if (object.isMesh && !/usb/.test(object.material.name)) object.material = ceramic; }); tilt.add(shell);
      }
      const screen = gltf.scene.getObjectByName('screen');
      if (screen) {
        const page = screen.clone(true);
        page.material = new T.MeshStandardMaterial({ color: colour('#faf9f3'), map: pageTexture, roughness: .94 });
        tilt.add(page);
      }
      const pen = notebookPen(sourcePen, item.pen); tilt.add(pen);
      tilt.rotation.set(1.32, -.34, -.08); tilt.scale.setScalar(.88); pivot.add(tilt);
      pivot.userData = { index, tilt, flap, pen, penRestZ: pen.position.z, labelAnchor: new T.Vector3() };
      coverView.scene.add(pivot); coverModels.push(pivot);
    });
    coverView.ready = true; coverStage.classList.add('is-ready');
  }
  function makePens(gltf) {
    penView = createView(penStage, 135, 195, 37, toppers.length);
    const source = gltf.scene.getObjectByName('pen');
    if (!source) throw new Error('Missing pen node');
    toppers.forEach((item, index) => {
      const group = new T.Group(), body = source.clone(true);
      body.position.set(0, -84, 0); body.quaternion.identity();
      body.traverse(object => {
        if (!object.isMesh) return;
        if (object.material.name === 'pen_eraser') object.visible = false;
        else object.material = object.material.name === 'pen_tip' ? metal : penBarrel;
      });
      group.add(body); makeTopper(group, index); group.userData.index = index;
      group.userData.labelAnchor = new T.Vector3();
      penView.scene.add(group); models.push(group);
    });
    const touchTarget = document.createElement('div');
    touchTarget.className = 'charm-touch-target'; touchTarget.setAttribute('aria-hidden', 'true');
    penStage.appendChild(touchTarget); penView.touchTarget = touchTarget;
    bindPointer(); penView.ready = true; penStage.classList.add('is-ready'); describe();
  }
  function bindPointer() {
    const canvas = penView.canvas, raycaster = new T.Raycaster(), pointer = new T.Vector2();
    const plane = new T.Plane(), hitPoint = new T.Vector3(), normal = new T.Vector3(0, 0, 1), anchorWorld = new T.Vector3();
    let dragId = null, pointerDown = null;
    function ray(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, penView.camera);
    }
    function target(event) {
      ray(event);
      if (!raycaster.ray.intersectPlane(plane, hitPoint)) return;
      tether.group.worldToLocal(hitPoint);
      // Keep a dragged endpoint inside the tether's reachable sphere.
      hitPoint.sub(tether.anchor).clampLength(0, tether.length * (tether.points.length - 1) * .96).add(tether.anchor);
      tether.target.copy(hitPoint);
      if (motion.matches) for (let i = 0; i < 10; i++) simulateTether(1 / 120, elapsed);
      wake();
    }
    penStage.addEventListener('pointerdown', event => {
      if (!penView || (event.pointerType === 'mouse' && event.button !== 0)) return;
      ray(event); penView.scene.updateMatrixWorld(true);
      const hits = raycaster.intersectObjects(models, true);
      if (!hits.length) return;
      let model = hits[0].object;
      while (model.parent && !models.includes(model)) model = model.parent;
      if (!models.includes(model)) return;
      const index = model.userData.index;
      pointerDown = { x: event.clientX, y: event.clientY, index };
      if (index === active && index === 2 && raycaster.intersectObject(tether.charm, true).length) {
            tether.charm.getWorldPosition(anchorWorld); plane.setFromNormalAndCoplanarPoint(normal, anchorWorld);
        tether.dragging = true; dragId = event.pointerId; target(event);
        canvas.setPointerCapture(event.pointerId); penStage.classList.add('is-dragging'); event.preventDefault();
      }
    });
    penStage.addEventListener('pointermove', event => { if (event.pointerId === dragId) target(event); });
    const release = event => {
      if (dragId !== null && event.pointerId === dragId) {
        tether.dragging = false; dragId = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        penStage.classList.remove('is-dragging'); pointerDown = null; wake(); return;
      }
      if (event.type === 'pointerup' && pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 9) {
        const index = pointerDown.index;
        if (index === active && index === 4) clickTopper();
        else selectTopper(index, true);
      }
      pointerDown = null;
    };
    penStage.addEventListener('pointerup', release);
    penStage.addEventListener('pointercancel', release);
    penStage.addEventListener('lostpointercapture', release);
  }

  const projected = new T.Vector3();
  function reflectSeal(gradient, delta, screenX, screenY) {
    // One reflection field crosses all the foil, like a fixed studio light.
    // Position and viewing angle move it; there is no independent shimmer loop.
    const incidence = motion.matches ? 0 : clamp(delta, -1.1, 1.1);
    const offsetX = motion.matches ? 0 : incidence * 102 + clamp(screenX, -1, 1) * 18;
    const offsetY = motion.matches ? 0 : incidence * 16 + clamp(screenY, -1, 1) * 6;
    const angle = -8 + incidence * 24;
    const transform = `translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) rotate(${angle.toFixed(2)} 60 60)`;
    if (gradient.getAttribute('gradientTransform') !== transform) gradient.setAttribute('gradientTransform', transform);
  }
  function scrollTarget(view) {
    if (motion.matches) return view.manual;
    const sticky = view.section.querySelector('.depth-sticky');
    const distance = view.section.offsetHeight - sticky.offsetHeight;
    const raw = clamp((64 - view.section.getBoundingClientRect().top) / Math.max(1, distance), 0, 1) * view.count - 1;
    if (raw < 0) return -1 + smooth(.06, .94, raw + 1);
    const step = Math.floor(raw), fraction = raw - step;
    return Math.min(view.count - 1, step + smooth(.14, .86, fraction));
  }
  function layoutRow(view, objects, isCover, dt) {
    if (!view || !view.ready || view.lost) return;
    view.target = scrollTarget(view);
    view.phase += (view.target - view.phase) * (motion.matches ? 1 : 1 - Math.exp(-dt * 13));
    const reveal = smooth(-1, 0, view.phase), current = view.phase < -.025 ? -1 : Math.max(0, Math.round(view.phase));
    const wasIntroduced = view.reveal > .99;
    view.reveal = reveal;
    const introOpacity = 1 - smooth(.08, .7, reveal);
    view.intro.style.opacity = introOpacity.toFixed(3);
    view.intro.style.transform = `translate3d(0,${(-reveal * 70).toFixed(2)}px,${(-reveal * 150).toFixed(2)}px) rotateX(${(reveal * 18).toFixed(2)}deg)`;
    view.intro.style.visibility = introOpacity > .001 ? 'visible' : 'hidden';
    view.intro.setAttribute('aria-hidden', String(introOpacity < .5));
    if (current !== view.current) {
      view.current = current;
      view.section.querySelector('[data-depth-count]').textContent = current < 0 ? String(view.count).padStart(2, '0') + (isCover ? ' colours' : ' toppers') : String(current + 1).padStart(2, '0') + ' / ' + String(view.count).padStart(2, '0');
      const choices = isCover ? coverButtons : buttons;
      choices.forEach((button, index) => button.setAttribute('aria-current', String(index === current)));
      view.labels.forEach((label, index) => label.setAttribute('aria-hidden', String(index !== current)));
      if (!isCover) { active = Math.max(0, current); describe(); }
    }
    if (!isCover && wasIntroduced !== (reveal > .99)) describe();
    const worldHeight = 1040 * Math.tan(view.camera.fov * Math.PI / 360);
    const worldWidth = worldHeight * view.camera.aspect;
    // The opening collection is deliberately cropped at the bottom. Covers
    // overlap, while the taller pens leave room for the floating charm above.
    const introScale = isCover ? worldHeight * .69 / 140 : Math.min(1.05, worldWidth * .88 / (view.count * 32));
    const introSpacing = isCover ? worldWidth * .76 / Math.max(1, view.count - 1) / introScale : 32;
    const introY = isCover ? -worldHeight * .29 : 37 + worldHeight * (.5 - (view.intro.offsetTop + view.intro.offsetHeight + 24) / view.height) - introScale * 100;
    const rowScale = introScale + (1 - introScale) * reveal;
    const rowAngle = Math.atan2(175, isCover ? 113 : 31) * reveal;
    const rowSpacing = introSpacing * (1 - reveal) + Math.hypot(isCover ? 113 : 31, 175) * reveal;
    const rowCentre = (view.count - 1) / 2 * (1 - reveal) + Math.max(0, view.phase) * reveal;
    objects.forEach((object, index) => {
      const delta = index - Math.max(0, view.phase), rowOffset = index - rowCentre;
      const focus = (1 - smooth(.08, .82, Math.abs(delta))) * reveal;
      const depthFade = delta < 0 ? 1 - smooth(.12, 1.65, -delta) : 1 - smooth(.15, 2.7, delta);
      const depthBlend = smooth(.3, 1, reveal);
      object.userData.depthOpacity = 1 - (1 - depthFade) * depthBlend;
      object.userData.blurRadius = smooth(.08, 1.15, Math.abs(delta)) * 24 * depthBlend;
      object.visible = object.userData.depthOpacity > .002;
      const baseY = isCover ? -16 : -8;
      object.position.set(rowOffset * rowSpacing * Math.cos(rowAngle) * rowScale, introY * (1 - reveal) + (baseY + delta * (isCover ? 10 : 4)) * reveal, -rowOffset * rowSpacing * Math.sin(rowAngle) * rowScale);
      object.scale.setScalar(rowScale);
      object.rotation.set(0, Math.sin(reveal * Math.PI) * -.18, (isCover ? -.035 : -.095) * reveal);
      if (isCover) {
        object.userData.tilt.rotation.set(1.55 + (1.32 - 1.55) * reveal, -.08 + (-.34 + .08) * reveal, -.08 * reveal);
        openCover(object.userData.flap, .018 + focus * .55);
        object.userData.pen.position.z = object.userData.penRestZ - focus * 13;
      }
      object.updateMatrixWorld(true);
      const titleY = isCover ? Math.max(80, worldHeight * .22) : Math.max(index === 2 ? 96 : 74, 37 + worldHeight * .19);
      object.userData.labelAnchor.set(isCover ? -4 : 0, titleY - baseY, 0);
      projected.copy(object.userData.labelAnchor); object.localToWorld(projected); projected.project(view.camera);
      const scale = 520 / (520 + delta * 175);
      const label = view.labels[index];
      const opacity = (1 - smooth(.25, 1.08, Math.abs(delta))) * smooth(.65, 1, reveal);
      const x = (projected.x * .5 + .5) * view.width, y = (-projected.y * .5 + .5) * view.height;
      label.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-100%) scale(${clamp(scale, .3, 2).toFixed(3)}) rotateY(${(-delta * 11).toFixed(2)}deg)`;
      label.style.opacity = opacity.toFixed(3);
      label.style.filter = `blur(${(smooth(.15, 1, Math.abs(delta)) * 9).toFixed(2)}px)`;
      label.style.visibility = opacity > .001 && object.visible ? 'visible' : 'hidden';
      const reflection = view.sealReflections[index];
      if (reflection && opacity > .001 && object.visible) reflectSeal(reflection, delta, projected.x, projected.y);
    });
  }
  function layout(dt) {
    layoutRow(coverView, coverModels, true, dt); layoutRow(penView, models, false, dt);
    if (plunger) plunger.position.y = clickAmount;
    updateTetherMeshes();
    if (penView && penView.touchTarget && tether) {
      const target = penView.touchTarget;
      target.hidden = penView.reveal < .99 || active !== 2 || Math.abs(penView.phase - 2) > .15;
      projected.set(0, 5.1, 0); tether.charm.localToWorld(projected); projected.project(penView.camera);
      target.style.left = (projected.x * .5 + .5) * penView.width + 'px';
      target.style.top = (-projected.y * .5 + .5) * penView.height + 'px';
    }
  }
  function wake() {
    if (!disposed && !document.hidden && !frameId && views.some(view => !view.lost)) frameId = requestAnimationFrame(frame);
  }
  function frame(timestamp) {
    frameId = 0;
    if (disposed || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, .05) : 1 / 60;
    lastTime = timestamp;
    const penVisible = penView && penView.ready && penView.visible && !penView.lost;
    if (penVisible) {
      elapsed += dt; accumulator += dt;
      while (accumulator >= 1 / 120) {
        if (!motion.matches) simulateTether(1 / 120, elapsed);
        clickVelocity += (-460 * clickAmount - 22 * clickVelocity) / 120;
        clickAmount = clamp(clickAmount + clickVelocity / 120, -2.8, .4);
        accumulator -= 1 / 120;
      }
    }
    layout(dt);
    views.forEach(view => { if (view.ready && !view.lost && view.visible) view.post.render(view === coverView ? coverModels : models); });
    const unsettled = views.some(view => view.visible && Math.abs(view.phase - view.target) > .0001);
    if ((penVisible && !motion.matches && (active === 2 || Math.abs(clickVelocity) > .001)) || unsettled) wake();
    else lastTime = 0;
  }
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => { const view = views.find(item => item.stage === entry.target); if (view) view.visible = entry.isIntersecting; });
    lastTime = 0; wake();
  }, { rootMargin: '80px', threshold: 0 });
  window.addEventListener('scroll', wake, { passive: true });
  document.addEventListener('visibilitychange', () => { lastTime = 0; if (!document.hidden) wake(); });
  // Gallery measurement and webfont loading can change the distance to these rows.
  window.addEventListener('load', wake);
  if (document.fonts) document.fonts.ready.then(wake);

  const loadTexture = url => new Promise((resolve, reject) => new T.TextureLoader().load(url, texture => {
    texture.encoding = T.sRGBEncoding; texture.anisotropy = 8; resolve(texture);
  }, undefined, reject));
  Promise.all([
    new Promise((resolve, reject) => new T.GLTFLoader().load(window.MESA_MODEL || 'assets/models/mesa.glb?v=3', resolve, undefined, reject)),
    loadTexture(window.MESA_COMPOSITION || 'assets/textures/composition-reference.png'),
    loadTexture(window.MESA_ACCESSORY_PAGE || 'assets/pages/tpl-journal.webp')
  ]).then(([gltf, composition, page]) => {
    compositionTexture = composition;
    // Mirror the original marbling; a 1.6 repeat makes its marks 25% larger than the original 2.0 repeat.
    compositionTexture.wrapS = compositionTexture.wrapT = T.MirroredRepeatWrapping;
    compositionTexture.repeat.set(1.6, 1.6);
    pageTexture = page; pageTexture.flipY = false;
    try { makeCovers(gltf); } catch (error) { console.warn('Mesa covers:', error); unavailable(coverStage); }
    try { makePens(gltf); } catch (error) { console.warn('Mesa toppers:', error); unavailable(penStage); }
    views.forEach(view => visibility.observe(view.stage));
    layout(1); wake();
  }).catch(error => { console.warn('Mesa accessories:', error); unavailable(coverStage); unavailable(penStage); });

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true; cancelAnimationFrame(frameId); visibility.disconnect();
    const geometries = new Set(), materials = new Set();
    views.forEach(view => {
      view.resizeObserver.disconnect(); view.post.dispose();
      view.scene.traverse(object => { if (object.isMesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
      view.environment.dispose(); view.renderer.dispose();
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    textureCache.forEach(texture => texture.dispose());
    if (compositionTexture) compositionTexture.dispose();
    if (pageTexture) pageTexture.dispose();
  });
})();
