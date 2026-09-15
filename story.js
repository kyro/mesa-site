/* Mesa scroll story: the CAD notebook (assets/models/mesa.glb, built by tools/model.py), lit like a product photograph.
   Head-on and centred to start. It slides right as it comes up; stickers land on the leather cover; the cover unrolls off
   the spine and lies open; the notebook lifts and tilts to tuck the cover under, then settles onto it; the pen slides out
   of the spine, writes the Mesa wordmark, and goes back. Then the notebook turns to face the camera and its screen becomes
   the stage for the four feature demos.

   The GLB is device > body / cover_back / pen / screen / flap. The flap is the leather cover (the wrap round the pen and
   the flat top) as one mesh; bendFlap() below deforms it on the CPU: the wrap's curvature scales to zero as the cover
   opens, so it unrolls like leather instead of swinging like a door, and the straight cover then folds under as a rigid
   plate about its crease at the back panel's edge. */
(function () {
  const stage = document.querySelector('.stage');
  const section = document.querySelector('.story');
  const canvas = document.querySelector('.story-canvas');
  if (!stage || !section || !canvas) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const has3d = !!window.THREE && !!(window.THREE && THREE.GLTFLoader) && !reduced && !/no3d|flat/.test(location.search) && (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; } })();
  if (!has3d) { stage.classList.add('no3d'); return; }

  const T = THREE;
  const srgb = hex => new T.Color(hex).convertSRGBToLinear();
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.physicallyCorrectLights = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 1, 4000);

  // ---------- A studio: a soft room with three softboxes, baked into a PMREM environment ----------
  (function studio() {
    const env = new T.Scene();
    const room = new T.Mesh(new T.BoxGeometry(2400, 2400, 2400), new T.ShaderMaterial({
      side: T.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float t = smoothstep(-1200.0, 1200.0, vP.y); vec3 c = mix(vec3(0.30, 0.295, 0.285), vec3(0.95, 0.94, 0.92), t); gl_FragColor = vec4(c, 1.0); }',
    }));
    env.add(room);
    const box = (w, h, x, y, z, rx, ry, k) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(k, k * 0.995, k * 0.98), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
    box(900, 500, 150, 1000, 300, Math.PI / 2 + 0.35, 0, 5.5);   // key: big softbox above and in front
    box(500, 700, -1100, 500, 0, 0, Math.PI / 2, 2.2);            // fill: tall panel to the left
    box(400, 400, 1100, 300, -300, 0, -Math.PI / 2, 1.6);         // rim: small panel to the right rear
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.05).texture;
    pmrem.dispose();
  })();

  scene.add(new T.HemisphereLight(0xfff8f0, 0x8a8781, 0.32));
  const sun = new T.DirectionalLight(0xfff6ec, 1.35);
  sun.position.set(-170, 360, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 50, far: 1000 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.6; sun.shadow.radius = 9;
  scene.add(sun);
  const fill = new T.DirectionalLight(0xeef2ff, 0.3); fill.position.set(220, 160, 260); scene.add(fill);

  // Body footprint (mm) for framing; the screen numbers are refined from the GLB's extras once it loads
  const BW = 107.8, BD = 150.9, BT = 7.0;
  let SW = 98, SD = 130.7, SZ = -3.9, screenY = 6.78, groundY = -2.5, LIFT = 2.5;

  const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.ShadowMaterial({ opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = groundY; ground.receiveShadow = true; scene.add(ground);

  // ---------- Procedural textures ----------
  function grain(size, count, minR, maxR, light, dark, base, blur) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    let seed = 13; const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < count; i++) {
      const x = r() * size, y = r() * size, rad = minR + r() * (maxR - minR);
      const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
      gr.addColorStop(0, light); gr.addColorStop(0.7, 'rgba(128,128,128,0)'); gr.addColorStop(1, dark);
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad, rad * (0.75 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2); g.fill();
    }
    if (blur) { g.filter = 'blur(' + blur + 'px)'; g.drawImage(c, 0, 0); g.filter = 'none'; }
    const tex = new T.CanvasTexture(c); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 8; return tex;
  }
  const leather = grain(512, 2600, 3, 9, 'rgba(255,255,255,.55)', 'rgba(0,0,0,.55)', '#808080', 0);
  leather.repeat.set(1 / 12, 1 / 12);               // the GLB's cover and shell UVs are box-projected in millimetres
  const shellGrain = grain(256, 3000, 0.6, 1.6, 'rgba(255,255,255,.18)', 'rgba(0,0,0,.18)', '#8c8c8c', 0.4);
  shellGrain.repeat.set(1 / 12, 1 / 12);
  const paperGrain = grain(256, 5000, 0.5, 1.2, 'rgba(255,255,255,.16)', 'rgba(0,0,0,.14)', '#808080', 0.3);
  paperGrain.repeat.set(6, 8);

  const engrave = (color) => { const c = document.createElement('canvas'); c.width = 240; c.height = 1024; const g = c.getContext('2d'); g.fillStyle = color ? '#f3f3f0' : '#808080'; g.fillRect(0, 0, 240, 1024); g.fillStyle = color ? '#9a9a97' : '#e6e6e6'; g.font = '600 40px "Inter Tight", Inter, Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.save(); g.translate(120, 60); g.rotate(Math.PI / 2); g.fillText('mesa', 0, 0); g.restore(); const t = new T.CanvasTexture(c); if (color) t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t; };

  // Screen: a canvas the pen writes on, mapped onto the GLB's screen plane (glTF UVs: v grows downwards, so no flip)
  const sc = document.createElement('canvas'); sc.width = 768; sc.height = 1024;
  const sx = sc.getContext('2d');
  const tex = new T.CanvasTexture(sc); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8; tex.flipY = false;

  const M = {
    cover: new T.MeshPhysicalMaterial({ color: srgb('#d6391e'), roughness: 0.78, metalness: 0, bumpMap: leather, bumpScale: 0.35, sheen: srgb('#ffb08c'), envMapIntensity: 0.4 }),
    shell: new T.MeshPhysicalMaterial({ color: srgb('#ecebe8'), roughness: 0.58, metalness: 0.0, clearcoat: 0.06, clearcoatRoughness: 0.5, roughnessMap: shellGrain, envMapIntensity: 0.8 }),
    glass: new T.MeshPhysicalMaterial({ color: srgb('#e6e5e1'), roughness: 0.6, clearcoat: 0.05, clearcoatRoughness: 0.5, envMapIntensity: 0.7 }),
    usb: new T.MeshStandardMaterial({ color: srgb('#3a3a3a'), roughness: 0.6 }),
    pen_barrel: new T.MeshStandardMaterial({ color: srgb('#f3f3f0'), roughness: 0.4, metalness: 0.55, envMapIntensity: 1.3, map: engrave(true), bumpMap: engrave(false), bumpScale: 0.16 }),
    pen_eraser: new T.MeshStandardMaterial({ color: srgb('#d6391e'), roughness: 0.85, envMapIntensity: 0.4 }),
    pen_tip: new T.MeshStandardMaterial({ color: srgb('#d9d9d6'), roughness: 0.35, metalness: 0.7, envMapIntensity: 1.2 }),
    screen: new T.MeshStandardMaterial({ map: tex, roughness: 0.92, bumpMap: paperGrain, bumpScale: 0.06, envMapIntensity: 0.25 }),
  };

  // Contact shadow: a soft dark pool under the body, so it sits on the table instead of hovering
  const contact = (function contact() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new T.CanvasTexture(c);
    const m = new T.Mesh(new T.PlaneGeometry(BW * 1.45, BD * 1.3), new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.rotation.x = -Math.PI / 2; m.position.y = groundY + 0.05; m.renderOrder = -1; scene.add(m); return m;
  })();

  // ---------- The notebook ----------
  let ready = false, dev, flap, pen, screen;
  const penRest = new T.Vector3(), penRestQ = new T.Quaternion();
  let flapBox = { x0: -56, x1: 55.9, z0: -76.9, z1: 77.5, top: 9.42 };   // device coordinates (the flat leather of the top)
  const stickerGroup = new T.Group();

  const MODEL_V = 3;   // bump when tools/model.py regenerates the GLB, so browsers refetch it
  const modelUrl = window.MESA_MODEL || ('assets/models/mesa.glb?v=' + MODEL_V);
  new T.GLTFLoader().load(modelUrl, gltf => {
    const root = gltf.scene;
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = M[o.material && o.material.name];
      if (m) o.material = m;
    });
    dev = root.getObjectByName('device'); flap = root.getObjectByName('flap'); pen = root.getObjectByName('pen'); screen = root.getObjectByName('screen');
    if (!dev || !flap || !pen || !screen) throw new Error('mesa.glb is missing a rig node');
    LIFT = dev.userData.lift || LIFT;
    if (dev.userData.ground_z != null) { groundY = dev.userData.ground_z; ground.position.y = groundY; contact.position.y = groundY + 0.05; }
    if (dev.userData.tilt_pivot) { PX = dev.userData.tilt_pivot[0]; PY = dev.userData.tilt_pivot[1]; }
    screen.castShadow = false;
    const su = screen.userData;
    if (su.size) { SW = su.size[0]; SD = su.size[1]; }
    if (su.center) { SZ = -su.center[1]; screenY = su.center[2]; }      // extras are in the CAD's z-up frame
    const fu = flap.userData;
    if (fu.x_range && fu.y_range) flapBox = { x0: AX + 3.5, x1: fu.x_range[1], z0: -fu.y_range[1], z1: -fu.y_range[0], top: fu.flat_top_z || flapBox.top };
    prepFlap(flap, fu);
    penRest.copy(pen.position); penRestQ.copy(pen.quaternion);
    dev.add(stickerGroup); layoutStickers();
    scene.add(root);
    if (/debug/.test(location.search)) window.MESA_STORY = { dev, flap, pen, screen, stickerGroup, scene, camera, renderer, bendFlap, place, rest: () => flapRest, params: () => ({ AX, AY, RM, CUT, S_ARC, PLATE_STEP, H0: H0.toArray(), FL, PX, PY }), draw: () => renderer.render(scene, camera) };
    ready = true; lastScreen = ''; resize(); onScroll(); render();
  }, undefined, err => { console.warn('mesa.glb failed to load', err); stage.classList.add('no3d'); stage.classList.add('flat'); });

  // ---------- Cover bend ----------
  // Profile of the cover from its crease H at the back panel's edge: an arc of mid radius RM round the pen-tube axis
  // (from CUT round the left side to the top, TOP) then the flat top. Opening scales the arc's curvature by (1 - open)
  // while the start tangent swings from 130 deg to 180 deg, so the plate's direction is 180 deg * open: it lifts off the
  // body, passes vertical and lies flat to the left, unrolled. beta then rotates the straight cover about the crease.
  const D2R = Math.PI / 180;
  let AX = -59.4, AY = 4.0, RM = 6.0, CUT = 220 * D2R, TOP = 90 * D2R, PLATE_MID = 8.17;
  let S_ARC, PLATE_STEP, PLATE_SLIP = 1.08, PLATE_HALF = 1.25, H0 = new T.Vector2(), FL = 129;
  let PX = 55.9, PY = -2.5;                 // the notebook tilts about this edge (x, y) when the cover folds under
  let flapRest = null, flapKey = '';
  function prepFlap(mesh, fu) {
    if (fu.axis) { AX = fu.axis[0]; AY = fu.axis[1]; }
    if (fu.r_mid) RM = fu.r_mid;
    if (fu.cut_deg) CUT = fu.cut_deg * D2R;
    if (fu.plate_mid_z) PLATE_MID = fu.plate_mid_z;
    S_ARC = (CUT - TOP) * RM; PLATE_STEP = AY + RM - PLATE_MID; PLATE_HALF = (fu.flat_top_z || 9.42) - PLATE_MID;
    H0.set(AX + RM * Math.cos(CUT), AY + RM * Math.sin(CUT));
    FL = S_ARC + ((fu.x_range && fu.x_range[1]) || 55.9) - AX;
    const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const r = { p: pos.array.slice(), n: nor.array.slice(), s: new Float32Array(n), d: new Float32Array(n), plate: new Uint8Array(n), tauRest: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const X = r.p[3 * i], Y = r.p[3 * i + 1];
      if (X > AX - 0.6 && Y > 3) { r.plate[i] = 1; r.s[i] = X - AX; r.d[i] = Y - PLATE_MID; }
      else {
        let th = Math.atan2(Y - AY, X - AX); if (th < 0) th += Math.PI * 2;
        r.s[i] = (CUT - th) * RM; r.d[i] = Math.hypot(X - AX, Y - AY) - RM; r.tauRest[i] = th - Math.PI / 2;
      }
    }
    flapRest = r; flapKey = '';
  }
  // world-ish helper: point s along the posed arc from H (curvature k, start tangent tau0)
  function arcPoint(H, tau0, k, s, out) {
    const tau = tau0 - k * s;
    if (k > 1e-6) { const R = 1 / k; out.set(H.x + R * (Math.sin(tau0) - Math.sin(tau)), H.y + R * (Math.cos(tau) - Math.cos(tau0))); }
    else out.set(H.x + s * Math.cos(tau0), H.y + s * Math.sin(tau0));
    return tau;
  }
  const _H = new T.Vector2(), _P = new T.Vector2(), _Q = new T.Vector2();
  function bendFlap(open, beta, hDrop) {
    if (!flapRest) return;
    const key = open.toFixed(4) + '|' + beta.toFixed(4) + '|' + hDrop.toFixed(3);
    if (key === flapKey) return; flapKey = key;
    const r = flapRest, g = flap.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array;
    const tau0 = (130 + 50 * open) * D2R + beta, k = (1 - open) / RM;
    _H.set(H0.x, H0.y + hDrop);
    const tauP = arcPoint(_H, tau0, k, S_ARC, _Q);                     // the plate's frame: origin _Q, tangent tauP
    const tpx = Math.cos(tauP), tpy = Math.sin(tauP), npx = -tpy, npy = tpx, slip = -PLATE_STEP + PLATE_SLIP * open;
    for (let i = 0, n = r.plate.length; i < n; i++) {
      const X0 = r.p[3 * i], Y0 = r.p[3 * i + 1], nx = r.n[3 * i], ny = r.n[3 * i + 1];
      let X, Y, dtau;
      if (r.plate[i]) {
        let dd = r.d[i]; if (dd > PLATE_HALF) dd = PLATE_HALF + (dd - PLATE_HALF) * (1 - open);   // the ridge over the spine flattens as the leather unrolls
        const off = dd + slip;
        X = _Q.x + r.s[i] * tpx + off * npx; Y = _Q.y + r.s[i] * tpy + off * npy; dtau = tauP;
      } else {
        const tau = arcPoint(_H, tau0, k, r.s[i], _P);
        X = _P.x - r.d[i] * Math.sin(tau); Y = _P.y + r.d[i] * Math.cos(tau); dtau = tau - r.tauRest[i];
      }
      pos[3 * i] = X; pos[3 * i + 1] = Y;
      const c = Math.cos(dtau), sn = Math.sin(dtau);
      nor[3 * i] = nx * c - ny * sn; nor[3 * i + 1] = nx * sn + ny * c;
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.computeBoundingSphere();
    // the stickers ride on the plate: same rigid motion, anchored at the plate's start on its mid-surface
    const ax = _Q.x + slip * npx, ay = _Q.y + slip * npy;
    stickerGroup.rotation.z = tauP;
    stickerGroup.position.set(ax - (AX * tpx - PLATE_MID * tpy), ay - (AX * tpy + PLATE_MID * tpx), 0);
  }

  // Stickers: vinyl PBR (so they receive each other's shadows and the studio reflections), curled in flight by a vertex
  // patch, tinted holographic by a fragment patch. [name, u, v, width mm, rotation deg, holo 0..1]
  const STICKERS = [
    ['circle-m-anarchy', 0.27, 0.20, 36, 8, 0.5], ['no-notifications-stencil', 0.71, 0.16, 39, -9, 0.2], ['skull-pencil', 0.76, 0.50, 36, 16, 0.8],
    ['safety-pin-holo', 0.24, 0.56, 31, -30, 1.0], ['you-make-typewriter', 0.49, 0.69, 55, 4, 0.2], ['lightning-holo', 0.80, 0.76, 21, 18, 1.0],
    ['cassette-demo', 0.24, 0.86, 39, -14, 0.7], ['barbed-heart', 0.62, 0.88, 31, 7, 0.9], ['eye-offline', 0.22, 0.38, 29, 10, 0.3],
    ['start-messy-ransom', 0.50, 0.40, 60, -5, 0.35],   // the message lands last, on top of the pile
  ];

  const CURL_GLSL = `uniform float bow; uniform vec2 size;
    vec3 stickerCurl(vec2 q){ float k = bow * 5.0;
      float dzdx = -k * 0.7 * 3.14159 * cos(q.x * 3.14159) / size.x; float dzdy = -k * 0.3 * 3.14159 * cos(q.y * 3.14159) / size.y;
      return vec3(dzdx, dzdy, k * (0.7 * (1.0 - sin(q.x * 3.14159)) + 0.3 * (1.0 - sin(q.y * 3.14159)))); }`;
  const patchCurl = (shader, u) => {
    shader.uniforms.bow = u.bow; shader.uniforms.size = u.size;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + CURL_GLSL)
      .replace('#include <beginnormal_vertex>', 'vec3 sc = stickerCurl(uv); vec3 objectNormal = normalize(vec3(-sc.x, -sc.y, 1.0));\n#ifdef USE_TANGENT\n vec3 objectTangent = vec3(tangent.xyz);\n#endif')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.xy, position.z + stickerCurl(uv).z);');
  };
  const patchHolo = (shader, u) => {
    patchCurl(shader, u);
    shader.uniforms.holo = u.holo; shader.uniforms.fade = u.fade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float holo; uniform float fade;\nvec3 stickerHue(float h){ vec3 c = abs(fract(h + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0) - 1.0; return clamp(c, 0.0, 1.0); }')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef USE_UV
        { vec3 vdir = normalize(vViewPosition); float ndv = clamp(dot(normal, vdir), 0.0, 1.0); float fres = pow(1.0 - ndv, 3.0);
          vec3 rainbow = stickerHue(ndv * 1.7 + vUv.x * 0.6 + vUv.y * 0.4);
          float lum = pow(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.4545);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62 + rainbow * 0.62, holo * (0.3 + 0.45 * fres) * smoothstep(0.3, 0.95, lum));
          diffuseColor.a *= fade; }
        #endif`);
  };
  const stickers = [];
  let seed = 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const manifest = window.MESA_STICKER_ASPECTS || null;
  const loader = new T.TextureLoader();
  STICKERS.forEach(([name, u, v, w, rot, holo], i) => {
    const src = (window.MESA_STICKERS && window.MESA_STICKERS[name]) || ('assets/stickers/' + name + '.webp');
    const uni = { bow: { value: 0 }, size: { value: new T.Vector2(w, w) }, holo: { value: holo }, fade: { value: 1 } };
    const mat = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.9, transparent: true, depthWrite: false, alphaTest: 0.02, side: T.DoubleSide });
    mat.onBeforeCompile = sh => patchHolo(sh, uni);
    const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
    mesh.visible = false; mesh.renderOrder = 10 + i; mesh.receiveShadow = true;
    const st = { mesh, uni, ready: false, u, v, i, target: new T.Vector3(), start: new T.Vector3(), jitter: new T.Vector3((rnd() - 0.5) * 8, 150 + rnd() * 70, (rnd() - 0.5) * 8), w, rot: rot * Math.PI / 180, spin: (rnd() - 0.5) * 0.5, tumble: (rnd() - 0.5) * 0.5, a: 0.031 + i * 0.0096, b: 0.031 + i * 0.0096 + 0.041 };
    stickers.push(st);
    stickerGroup.add(mesh);
    loader.load(src, t => {
      t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.minFilter = T.LinearMipmapLinearFilter;
      const aspect = (manifest && manifest[name]) || (t.image && t.image.width / t.image.height) || 1;
      mesh.geometry.dispose(); mesh.geometry = new T.PlaneGeometry(w, w / aspect, 16, 16); uni.size.value.set(w, w / aspect);
      mat.map = t; mat.needsUpdate = true;
      // die-cut shadow (the depth pass uses the sticker's own alpha and the same curl) falls on the cover and on the stickers already down
      const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: t, alphaTest: 0.5, side: T.DoubleSide });
      depth.onBeforeCompile = sh => patchCurl(sh, uni);
      mesh.customDepthMaterial = depth; mesh.castShadow = true; st.ready = true; render();
    });
  });
  // Sticker targets on the flat leather of the top, in device coordinates (x across, z down the cover, y up)
  function layoutStickers() {
    const margin = 10, fw = flapBox.x1 - flapBox.x0, fd = flapBox.z1 - flapBox.z0;
    stickers.forEach(st => {
      st.target.set(flapBox.x0 + margin + st.u * (fw - 2 * margin), flapBox.top + 0.1 + st.i * 0.12, flapBox.z0 + margin + st.v * (fd - 2 * margin));
      st.start.copy(st.target).add(st.jitter);
    });
  }
  layoutStickers();

  // Pen poses: the GLB's pen node is the rest pose (tip at the origin, barrel along local +Y, lying in the spine along -Z)
  const writeDir = new T.Vector3(0.55, 1, 0.42).normalize();
  const writeQ = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), writeDir);
  const slerp = (a, b, t) => pen.quaternion.slerpQuaternions ? pen.quaternion.slerpQuaternions(a, b, t) : T.Quaternion.slerp(a, b, pen.quaternion, t);
  const SLIDE = 150, HOVER = new T.Vector3(8, 26, -SLIDE);   // out of the spine along the barrel, then up a little

  // ---------- Ink: strokes in normalised page coordinates ----------
  let notes = null, logo = null, samples = {};
  const lengthOf = s => { let L = 0; for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], (s[i][1] - s[i - 1][1]) * 1.333); return Math.max(L, 0.002); };
  const prep = strokes => ({ strokes, lengths: strokes.map(lengthOf), total: strokes.reduce((a, s) => a + lengthOf(s), 0) });
  function setStrokes(data) {
    notes = prep(data.strokes); logo = prep(data.logo || []);
    Object.keys(data.samples || {}).forEach(k => { samples[k] = data.samples[k]; });
    render();
  }
  function paper(dots = true) {
    sx.fillStyle = '#f2efe7'; sx.fillRect(0, 0, sc.width, sc.height);
    sx.strokeStyle = 'rgba(40,40,40,.55)'; sx.lineWidth = 3; sx.strokeRect(1.5, 1.5, sc.width - 3, sc.height - 3);
    if (dots) { sx.fillStyle = 'rgba(63,62,59,.22)'; for (let y = 24; y < sc.height - 90; y += 30) for (let x = 24; x < sc.width; x += 30) sx.fillRect(x, y, 2, 2); }
    // the e-ink UI: a dark bar along the bottom with four glyphs, and a small glyph top-right
    sx.fillStyle = '#2b2b2d'; sx.fillRect(0, sc.height - 74, sc.width, 74);
    sx.strokeStyle = 'rgba(242,239,231,.75)'; sx.lineWidth = 2.2; const cy = sc.height - 37, gx = [sc.width * 0.3, sc.width * 0.43, sc.width * 0.57, sc.width * 0.7];
    sx.strokeRect(gx[0] - 9, cy - 9, 18, 18); sx.beginPath(); sx.arc(gx[1], cy, 9.5, 0, Math.PI * 2); sx.stroke();
    sx.beginPath(); sx.moveTo(gx[2], cy - 11); sx.lineTo(gx[2] + 11, cy); sx.lineTo(gx[2], cy + 11); sx.lineTo(gx[2] - 11, cy); sx.closePath(); sx.stroke();
    sx.beginPath(); sx.roundRect ? sx.roundRect(gx[3] - 14, cy - 8, 28, 16, 8) : sx.rect(gx[3] - 14, cy - 8, 28, 16); sx.stroke();
    sx.strokeStyle = 'rgba(63,62,59,.55)'; sx.lineWidth = 2; sx.strokeRect(sc.width - 52, 30, 18, 22); sx.beginPath(); sx.moveTo(sc.width - 56, 30); sx.lineTo(sc.width - 30, 30); sx.stroke();
  }
  // Draw `ink` up to fraction q of its total length; returns the pen position, or null.
  function inkTo(ink, q, width) {
    if (!ink) return null;
    let budget = q * ink.total, pos = null;
    sx.strokeStyle = '#3a3936'; sx.lineWidth = width; sx.lineCap = 'round'; sx.lineJoin = 'round';
    for (let k = 0; k < ink.strokes.length; k++) {
      const s = ink.strokes[k], L = ink.lengths[k];
      if (budget <= 0) break;
      const frac = Math.min(1, budget / L);
      sx.beginPath();
      let acc = 0; sx.moveTo(s[0][0] * sc.width, s[0][1] * sc.height); pos = s[0];
      for (let i = 1; i < s.length; i++) {
        const seg = Math.hypot(s[i][0] - s[i - 1][0], (s[i][1] - s[i - 1][1]) * 1.333);
        if (acc + seg > frac * L) {
          const f = (frac * L - acc) / seg;
          pos = [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f];
          sx.lineTo(pos[0] * sc.width, pos[1] * sc.height); break;
        }
        acc += seg; pos = s[i]; sx.lineTo(s[i][0] * sc.width, s[i][1] * sc.height);
      }
      sx.stroke();
      budget -= L;
    }
    return pos;
  }
  // Demo videos: Cliff's screen recordings play on the e-ink screen during the four demo beats
  // (demo-1 red-rocks page: dictate, write, draw; demo-2 write/speak/type; demo-3 tidy-up + edits; demo-4 talk from the index)
  const demoVersions = ['paced-v3', 'paced-v2', 'paced-v2', 'paced-v2'];
  const vids = [0, 1, 2, 3].map(i => {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
    // Versioned copies preserve earlier edits for rollback.
    v.src = (window.MESA_VIDEOS && window.MESA_VIDEOS[i]) || ('assets/video/demo-' + (i + 1) + '-' + demoVersions[i] + '.mp4');
    return v;
  });
  let liveDemo = -1, vidRaf = 0, vidTime = -1;
  function paintDemo(n) {
    const v = vids[n];
    if (v.readyState >= 2) { sx.drawImage(v, 0, 0, sc.width, sc.height); vidTime = v.currentTime; }
    else paper(true);
  }
  function tickVideo() {
    if (vidRaf) return;
    vidRaf = requestAnimationFrame(() => {
      vidRaf = 0;
      if (liveDemo < 0) return;
      const v = vids[liveDemo];
      if (v.readyState >= 2 && v.currentTime !== vidTime) { paintDemo(liveDemo); tex.needsUpdate = true; renderer.render(scene, camera); }
      tickVideo();
    });
  }
  function setLiveDemo(n) {
    if (n === liveDemo) return;
    if (liveDemo >= 0) vids[liveDemo].pause();
    liveDemo = n; vidTime = -1;
    if (n >= 0) { vids[n].play().catch(() => {}); tickVideo(); }
    else if (vidRaf) { cancelAnimationFrame(vidRaf); vidRaf = 0; }
  }
  // page uv -> device-local point just above the screen (v = 0 is the top edge of the page, away from the camera)
  function pagePoint(uv) { return new T.Vector3(-SW / 2 + uv[0] * SW, screenY + 0.15, SZ - SD / 2 + uv[1] * SD); }

  // ---------- Timeline ----------
  // The story is 1750vh tall: the notebook business happens in the first ~54%, then each demo video gets an equal ~11.6% (~200vh) of scroll.
  const K = { introB: 0.034, openA: 0.165, openB: 0.213, foldA: 0.213, foldB: 0.264, liftA: 0.274, liftB: 0.302, moveB: 0.329, logoA: 0.336, logoB: 0.398,
              backA: 0.480, backB: 0.521, demoA: 0.480, demoB: 0.535, d2: 0.651, d3: 0.767, d4: 0.884 };
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const TILT_MAX = 50 * D2R, HOP = 40;   // the notebook rolls up on its right edge and lifts while the cover tucks under
  const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const lerp = (a, b, t) => a + (b - a) * t;
  let progress = 0, lastScreen = '';

  function paintScreen(p) {
    let key, pos = null;
    if (p < K.logoA) { key = 'blank'; setLiveDemo(-1); if (lastScreen !== key) paper(); }
    else if (p < K.demoA) { key = 'logo' + Math.round(seg(p, K.logoA, K.logoB) * 300); setLiveDemo(-1); paper(false); pos = inkTo(logo, seg(p, K.logoA, K.logoB), 11); }
    else { const n = p < K.d2 ? 0 : p < K.d3 ? 1 : p < K.d4 ? 2 : 3; key = 'demo' + n; if (lastScreen !== key) paintDemo(n); setLiveDemo(n); }
    if (key !== lastScreen) { tex.needsUpdate = true; lastScreen = key; }
    else if (key.startsWith('logo')) tex.needsUpdate = true;
    return pos;
  }

  function place(p) {
    // stickers
    stickers.forEach(st => {
      const t = seg(p, st.a, st.b);
      st.mesh.visible = st.ready && t > 0;
      if (!st.mesh.visible) return;
      const e = easeOut(t);
      st.mesh.position.set(lerp(st.start.x, st.target.x, e), Math.max(st.target.y, lerp(st.start.y, st.target.y, e)), lerp(st.start.z, st.target.z, e));
      const s = lerp(1.35, 1, e); st.mesh.scale.set(s, s, s);
      st.mesh.rotation.set(-Math.PI / 2 + (1 - e) * st.tumble, (1 - e) * st.tumble * 0.4, st.rot + (1 - e) * st.spin);
      st.uni.bow.value = 1 - e;
      st.uni.fade.value = Math.min(1, t * 4);
    });
    // cover: unrolls off the spine and lies flat; then the notebook lifts and rolls up on its right edge, the straight
    // cover hangs from the crease (its far edge dragging on the table), swings under, and the notebook settles onto it
    const open = ease(seg(p, K.openA, K.openB)), foldT = seg(p, K.foldA, K.foldB);
    const fA = ease(seg(foldT, 0, 0.5)), fB = ease(seg(foldT, 0.45, 0.8)), fC = ease(seg(foldT, 0.8, 1));
    const hump = fA * (1 - fC);
    const dlt = -TILT_MAX * hump, cD = Math.cos(dlt), sD = Math.sin(dlt), liftY = HOP * hump + LIFT * fC;
    dev.rotation.z = dlt;
    dev.position.set(PX - (PX * cD - PY * sD), PY - (PX * sD + PY * cD) + liftY, 0);
    const hDrop = -2.14 * open - 1.0 * fC;                              // the crease settles onto the table as the leather unrolls
    const hWorld = dev.position.y + (H0.x * sD + (H0.y + hDrop) * cD);  // crease height above the table
    const hang = Math.asin(Math.min(1, Math.max(0, (hWorld - groundY) / FL)));
    const beta = (1 - fB) * (-dlt + hang) + fB * Math.PI;
    bendFlap(open, beta, hDrop);
    // screen + pen
    const pos = paintScreen(p);
    const liftT = seg(p, K.liftA, K.liftB);
    const slide = easeOut(seg(liftT, 0, 0.7)) * SLIDE, rise = easeOut(seg(liftT, 0.45, 1));
    const move = ease(seg(p, K.liftB, K.moveB));
    const back = ease(seg(p, K.backA, K.backB));
    const start = pagePoint(logo && logo.strokes.length ? logo.strokes[0][0] : [0.2, 0.45]);
    const hover = penRest.clone().add(HOVER);
    if (p < K.liftB) { pen.position.copy(penRest).add(new T.Vector3(HOVER.x * rise, HOVER.y * rise, -slide)); pen.quaternion.copy(penRestQ); }
    else if (p < K.logoA) { pen.position.lerpVectors(hover, start.clone().add(new T.Vector3(0, 6, 0)), move); pen.position.y += Math.sin(move * Math.PI) * 14; slerp(penRestQ, writeQ, move); }
    else if (p < K.backA) {
      const uv = pos || (logo && logo.strokes.length ? logo.strokes[logo.strokes.length - 1].slice(-1)[0] : [0.7, 0.45]);
      pen.position.copy(pagePoint(uv)); if (p >= K.logoB) pen.position.y += 3;
      pen.quaternion.copy(writeQ);
    } else {
      // back to the spine: swing to the mouth of the spine, then slide home along the barrel
      const from = pagePoint(logo && logo.strokes.length ? logo.strokes[logo.strokes.length - 1].slice(-1)[0] : [0.7, 0.45]);
      const b1 = easeOut(seg(back, 0, 0.55)), b2 = ease(seg(back, 0.55, 1));
      if (back < 0.55) { pen.position.lerpVectors(from, hover, b1); pen.position.y += Math.sin(b1 * Math.PI) * 30; }
      else pen.position.copy(penRest).add(new T.Vector3(HOVER.x * (1 - b2), HOVER.y * (1 - b2), -SLIDE * (1 - b2)));
      slerp(writeQ, penRestQ, b1);
    }
    // camera: centred and head-on, slides right as it comes up, turns for the writing, then faces the screen for the demos
    const intro = ease(seg(p, 0, K.introB));
    const turn = ease(seg(p, K.openA, K.foldB));
    const demo = ease(seg(p, K.demoA, K.demoB));
    const wide = viewW > 960;                                   // the stylesheet switches to the stacked phone layout at 960px
    // narrow (stacked) layout: the text is below the canvas, so the notebook is centred, seen more from above with no
    // yaw (the open cover is 250 mm wide and would leave the frame otherwise), and framed tighter: the horizontal
    // field of view is ~36 deg there, so the closed book fills about two thirds of the width
    // On phones the camera is in place by the time the cover lies flat (turnC), backs off a little while the cover
    // stands up mid-swing, and comes back in once the notebook has settled onto its folded cover (fC).
    const turnC = wide ? turn : ease(seg(p, K.openA, K.openB));
    let phi = lerp(1.43, wide ? 0.9 : 1.15, turnC), theta = lerp(0, wide ? 0.12 : 0, turnC) + lerp(0, 0.08, ease(seg(p, K.logoA, K.logoB)));
    let dist = wide ? lerp(365, 500, turn) : lerp(265, 480, turnC) + 90 * Math.sin(Math.PI * turnC) - 135 * fC;
    let tx = wide ? lerp(0, -64, intro) : 0, ty = 4 + 26 * hump, tz = wide ? -18 : 0;
    dist += 70 * hump;
    tx = lerp(tx, wide ? -112 : -62 * (1 - fC) - 8 * fC, turnC); tz = lerp(tz, 4, turnC);
    // demo pose: straight down, the screen filling the right half (wide) or most of the canvas (narrow)
    phi = lerp(phi, 1.5, demo); theta = lerp(theta, 0, demo); dist = lerp(dist, wide ? 350 : 235, demo);
    tx = lerp(tx, wide ? -80 : 0, demo); tz = lerp(tz, SZ, demo);
    if (!wide) dist *= narrowScale;
    const upY = Math.max(turn - demo, 0);
    camera.up.set(0, upY, -(1 - upY) - 0.02).normalize();
    camera.position.set(tx + dist * Math.cos(phi) * Math.sin(theta), ty + dist * Math.sin(phi), tz + dist * Math.cos(phi) * Math.cos(theta));
    camera.lookAt(new T.Vector3(tx, ty, tz));
  }

  // The canvas is the thing to measure, not the stage: on phones the stylesheet gives it the top 60% of the stage and
  // leaves the rest to the beat text. Portrait canvases keep a horizontal field of view of ~36 deg instead of a fixed
  // vertical one, so the notebook fills the width rather than shrinking into a tall, narrow frustum.
  let viewW = 0, viewH = 0, narrowScale = 1;   // narrowScale backs the phone camera off when the canvas is too short for the notebook (landscape phones)
  function resize() {
    const w = Math.round(canvas.clientWidth || stage.clientWidth), h = Math.round(canvas.clientHeight || stage.clientHeight);
    if (!w || !h) return;
    viewW = w; viewH = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 2 * Math.atan(Math.tan(18 * D2R) / camera.aspect) / D2R : (w < 700 ? 40 : 30);
    camera.updateProjectionMatrix();
    const tanV = Math.tan(camera.fov / 2 * D2R), tanH = tanV * camera.aspect;
    narrowScale = w <= 960 ? Math.max(1, BD / (0.75 * 2 * tanV) / 265, BW / (0.7 * 2 * tanH) / 265) : 1;
    // stacked layout: the fixed nav covers the top of the canvas, so sit the notebook a little lower in the frame
    if (w <= 960 && camera.aspect < 1.5) camera.setViewOffset(w, h, 0, -Math.round(h * 0.03), w, h); else camera.clearViewOffset();
    render();
  }
  let rafId = 0;
  function render() {
    if (!ready || rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; place(progress); renderer.render(scene, camera); requestAnimationFrame(() => renderer.render(scene, camera)); });
  }
  function onScroll() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    const p = Math.max(0, Math.min(1, -rect.top / total));
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) { setLiveDemo(-1); return; }
    progress = p; render();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  const relayout = () => { resize(); onScroll(); };
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);   // phone address bars come and go without a window resize
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastScreen = ''; onScroll(); render(); });
  window.addEventListener('load', relayout);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(entries => { if (entries.some(e => e.target === canvas)) resize(); onScroll(); });
    ro.observe(canvas); ro.observe(document.body);
  }
  if (window.MESA_STROKES) setStrokes(window.MESA_STROKES);
  else fetch('assets/story/strokes.json').then(r => r.json()).then(setStrokes).catch(() => {});
  resize(); onScroll();
})();
