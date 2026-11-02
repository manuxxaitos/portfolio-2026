// Anillo de tapas en 3D: las tapas, curvadas, forman un cilindro y la cámara está adentro, cerca del borde.
// Las del fondo se ven chicas y nítidas; las de los costados pasan cerca y grandes. Se alternan dos tamaños a
// dos profundidades: las chicas quedan atrás, medio tapadas por las grandes.
//
// Dos pasadas: 1) las tapas, como placas de vidrio (brillo que corre al girar, filo de luz y un bisel que
// dobla el arte en el borde), a una textura; 2) el lente de los costados: hacia los bordes de la pantalla la
// imagen se estira en vertical, se corre hacia afuera, se desenfoca y separa sus colores, como vista a través
// de un vidrio grueso.
//
// Gira solo, despacio; se arrastra con inercia y, si tocás una tapa, gira hasta dejarla adelante. Sobre cada
// tapa visible hay una caja invisible con su data-say, para que la burbuja del cursor diga cuál es.
import * as THREE from 'three';

const R = 6; // radio del anillo de tapas grandes
const BIG = {h: 2.9, r: R};
const SMALL = {h: 1.9, r: R * 1.16};
const CAM_Z = R * 0.9;
const VFOV = 30;

const CARD_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

// una placa de vidrio con la tapa adentro
const CARD_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform float uLoaded;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float shape(vec2 p) { return rbox(p, vec2(0.497), 0.05); }
void main() {
  // visto desde adentro del cilindro: la tapa se lee al derecho
  vec2 uv = vec2(1.0 - vUv.x, vUv.y);
  vec2 p = uv - 0.5;
  float d = shape(p);
  float aa = fwidth(d) * 1.1;
  float a = 1.0 - smoothstep(-aa, aa, d);
  if (a < 0.002) discard;

  // bisel: cerca del borde, el arte se dobla hacia adentro (como el canto de un vidrio)
  const float E = 0.002;
  vec2 g = normalize(vec2(shape(p + vec2(E, 0.0)) - shape(p - vec2(E, 0.0)), shape(p + vec2(0.0, E)) - shape(p - vec2(0.0, E))) + 1e-6);
  float bev = smoothstep(-0.03, 0.0, d);
  vec3 c = texture2D(uMap, uv - g * 0.016 * bev * bev).rgb;
  c = mix(vec3(0.88, 0.89, 0.9), c, uLoaded);

  // luz: la normal de la cara de adentro del cilindro, mirando a la cámara
  vec3 V = normalize(vV);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  // la luz va a la altura del horizonte (las normales del cilindro son horizontales): su reflejo es una franja
  // vertical que cruza cada tapa cuando pasa a la derecha del centro
  vec3 L = normalize(vec3(-0.62, 0.0, 0.78));
  float nh = max(dot(N, normalize(L + V)), 0.0);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  // un reflejo ancho y suave, uno fino encima y el vidrio que blanquea al ir de canto
  float glow = fres * 0.22 + pow(nh, 9.0) * 0.05 + pow(nh, 90.0) * 0.24;
  // la luz que entra por el canto de arriba y un esmerilado suave en todo el borde
  glow += smoothstep(0.2, 0.5, p.y) * 0.05;
  glow += smoothstep(-0.07, 0.0, d) * 0.12;
  c = mix(c, vec3(1.0), clamp(glow, 0.0, 0.65));

  // canto: un filo de luz afuera y una línea apenas más oscura adentro
  float rim = 1.0 - smoothstep(0.0, 0.007, -d);
  float line = smoothstep(0.007, 0.011, -d) * (1.0 - smoothstep(0.011, 0.02, -d));
  c = mix(c, vec3(1.0), rim * 0.6);
  c *= 1.0 - line * 0.1;
  gl_FragColor = vec4(c, a);
}`;

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// el lente de los costados, sobre la imagen de las tapas (premultiplicada, con mipmaps para desenfocar)
const POST_FRAG = /* glsl */ `
uniform sampler2D tScene; uniform vec2 uRes; uniform float uDpr; uniform float uSeed;
varying vec2 vUv;

vec3 bgAt(vec2 uv) {
  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  return mix(vec3(0.957, 0.965, 0.969), vec3(0.91, 0.922, 0.93), smoothstep(0.25, 1.15, length(q)));
}

// cuánto lente hay en x: nada en el medio, todo en el borde
float edge(float x) { return smoothstep(0.47, 1.04, abs(x * 2.0 - 1.0)); }

// dónde mirar para un canal: estirado en vertical y corrido hacia afuera según el borde
vec2 lens(vec2 uv, float e, float k) {
  vec2 p = uv * 2.0 - 1.0;
  float e2 = e * e;
  p.y /= 1.0 + k * 0.85 * e2;
  p.x = sign(p.x) * (abs(p.x) - k * 0.09 * e2 * e);
  return p * 0.5 + 0.5;
}

// una muestra desenfocada, corrida a lo largo del radio (el vidrio arrastra la imagen hacia afuera)
vec4 smear(vec2 uv, vec2 dir, float len, float lod) {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 7; i++) {
    float t = float(i) / 6.0 - 0.5;
    acc += textureLod(tScene, uv + dir * len * t, lod);
  }
  return acc / 7.0;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }

void main() {
  vec3 bg = bgAt(vUv);
  float e = edge(vUv.x);
  vec3 col;
  if (e < 0.0005) {
    vec4 s = textureLod(tScene, vUv, 0.0);
    col = s.rgb + bg * (1.0 - s.a);
  } else {
    // dirección del radio, en uv
    vec2 dpx = normalize((vUv - 0.5) * uRes + 1e-4);
    vec2 dir = dpx / uRes;
    float len = e * e * 0.07 * uRes.x;
    float lod = e * 5.0 + log2(uDpr);
    // cada canal con su propio lente: los colores se separan en los cantos
    float ca = 0.2 * e;
    // y deja pasar un poco del fondo, como vidrio
    float clear = 1.0 - 0.3 * e * e;
    vec4 sr = smear(lens(vUv, e, 1.0 - ca), dir, len, lod) * clear;
    vec4 sg = smear(lens(vUv, e, 1.0), dir, len, lod) * clear;
    vec4 sb = smear(lens(vUv, e, 1.0 + ca), dir, len, lod) * clear;
    col = vec3(sr.r + bg.r * (1.0 - sr.a), sg.g + bg.g * (1.0 - sg.a), sb.b + bg.b * (1.0 - sb.a));
    // el vidrio ilumina lo que dobla: un poco más claro y saturado hacia el borde
    float cov = max(sr.a, max(sg.a, sb.a));
    vec3 lum = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
    col = mix(col, mix(lum, col, 1.25), cov * e);
    col = mix(col, vec3(1.0), 0.1 * e * cov);
  }
  // grano finito para que los degradés no hagan escalones
  col += (hash(gl_FragCoord.xy) - 0.5) * (2.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export function mountRing(root, {covers, interactive = false, reduced = false, onPick} = {}) {
  const frame = root.querySelector('[data-ring-stage]');
  const canvas = root.querySelector('[data-ring-canvas]');
  const hits = root.querySelector('[data-ring-hits]');
  const cap = root.querySelector('[data-ring-cap]');

  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, alpha: false});
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VFOV, 1.6, 0.1, 40);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, -R);
  const ring = new THREE.Group();
  scene.add(ring);

  // las tapas, a una textura con mipmaps (para que el lente pueda desenfocar barato)
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const res = new THREE.Vector2(1, 1);
  const post = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {tScene: {value: rt.texture}, uRes: {value: res}, uDpr: {value: 1}, uSeed: {value: 0}},
      depthTest: false,
      depthWrite: false,
    }),
  );
  post.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(post);
  const postCam = new THREE.Camera();

  // tamaños alternados: una grande, una chica, repartidas parejo alrededor del anillo
  const n = covers.length;
  const step = (Math.PI * 2) / n;
  const loader = new THREE.TextureLoader();
  const cards = covers.map((cv, i) => {
    const big = i % 2 === 0;
    const s = big ? BIG : SMALL;
    const len = s.h / s.r; // tapas cuadradas: el arco mide lo mismo que el alto
    const geo = new THREE.CylinderGeometry(s.r, s.r, s.h, 40, 1, true, -len / 2, len);
    const mat = new THREE.ShaderMaterial({
      vertexShader: CARD_VERT,
      fragmentShader: CARD_FRAG,
      uniforms: {uMap: {value: null}, uLoaded: {value: 0}},
      side: THREE.BackSide,
      transparent: true,
    });
    const tex = loader.load(cv.src, () => {
      mat.uniforms.uLoaded.value = 1;
      wake();
    });
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = maxAniso;
    mat.uniforms.uMap.value = tex;
    const mesh = new THREE.Mesh(geo, mat);
    // el cilindro arranca en +z; la tapa i va a su ángulo, la 0 al fondo (−z)
    const angle = Math.PI + i * step;
    mesh.rotation.y = angle;
    // las grandes se dibujan después: tapan a las chicas que tienen atrás
    mesh.renderOrder = big ? 2 : 1;
    mesh.userData = {i, angle, s, len};
    ring.add(mesh);
    let hit = null;
    if (interactive && hits) {
      hit = document.createElement('span');
      hit.className = 'ring__hit';
      if (big) hit.classList.add('is-big');
      hit.dataset.say = `${cv.title} · ${cv.artist}`;
      hit.dataset.i = String(i);
      hits.append(hit);
    }
    return {mesh, hit, cv};
  });

  // ---------- encuadre ----------
  const fit = () => {
    const w = frame.clientWidth, h = frame.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(res);
    rt.setSize(res.x, res.y);
    post.material.uniforms.uDpr.value = dpr;
    camera.aspect = w / h;
    // en cajas angostas, abre el campo para que entren las mismas tapas
    camera.fov = w / h < 1.6 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(VFOV) / 2) * (1.6 / (w / h)))) : VFOV;
    camera.updateProjectionMatrix();
    wake();
  };
  new ResizeObserver(fit).observe(frame);

  // ---------- giro ----------
  let rot = 0; // giro del anillo
  let vel = 0; // inercia del arrastre
  let goal = null; // giro hacia el que va al tocar una tapa
  let hover = false;
  let drag = null;
  const AUTO = reduced ? 0 : 0.07; // rad/s
  let front = -1;

  // qué tapa queda adelante (la más cercana al fondo del anillo, que es lo que se mira)
  const offFront = (i) => {
    const a = cards[i].mesh.userData.angle + rot - Math.PI;
    return Math.atan2(Math.sin(a), Math.cos(a));
  };
  const frontmost = () => {
    let best = 0, bd = Infinity;
    for (const {mesh} of cards) {
      const d = Math.abs(offFront(mesh.userData.i)) * (mesh.userData.s === BIG ? 1 : 1.6);
      if (d < bd) (bd = d), (best = mesh.userData.i);
    }
    return best;
  };
  const toFront = (i) => {
    // el giro más corto que deja la tapa i en el fondo
    goal = rot - offFront(i);
    vel = 0;
    if (i !== front) onPick?.(i);
    wake();
  };

  if (interactive) {
    frame.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      drag = {x: e.clientX, last: e.clientX, t: performance.now(), moved: false, id: e.pointerId};
      goal = null;
    });
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.last;
      if (Math.abs(e.clientX - drag.x) > 4 && !drag.moved) {
        drag.moved = true;
        frame.setPointerCapture?.(e.pointerId);
        root.classList.add('is-dragging');
      }
      if (!drag.moved) return;
      const now = performance.now();
      const k = 1.6 / frame.clientWidth; // un ancho de caja ≈ 1,6 rad
      rot -= dx * k;
      vel = (-dx * k) / Math.max(0.008, (now - drag.t) / 1000);
      drag.last = e.clientX;
      drag.t = now;
      wake();
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tapped = !drag.moved;
      drag = null;
      root.classList.remove('is-dragging');
      if (tapped) {
        const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.ring__hit');
        if (t) toFront(Number(t.dataset.i));
      }
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    frame.addEventListener('pointerenter', () => (hover = true));
    frame.addEventListener('pointerleave', () => (hover = false));
  }

  // ---------- cajas para la burbuja ----------
  const v = new THREE.Vector3();
  // si el anillo gira bajo el puntero quieto, la burbuja se entera (como si lo hubieras movido)
  let px = -1, py = -1, under = null;
  if (interactive) addEventListener('pointermove', (e) => ((px = e.clientX), (py = e.clientY)), {passive: true});
  const resync = () => {
    if (px < 0 || drag) return;
    const r = frame.getBoundingClientRect();
    if (px < r.left || px > r.right || py < r.top || py > r.bottom) return (under = null);
    const n = document.elementFromPoint(px, py)?.closest?.('.ring__hit') ?? null;
    if (n === under) return;
    under = n;
    (n ?? frame).dispatchEvent(new PointerEvent('pointermove', {clientX: px, clientY: py, pointerType: 'mouse', bubbles: true}));
  };
  const place = () => {
    if (!hits) return;
    const w = frame.clientWidth, h = frame.clientHeight;
    for (const {mesh, hit} of cards) {
      const {s, len} = mesh.userData;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, ok = true;
      for (const u of [-0.5, 0, 0.5]) for (const y of [-0.5, 0.5]) {
        const a = u * len;
        v.set(s.r * Math.sin(a), y * s.h, s.r * Math.cos(a)).applyMatrix4(mesh.matrixWorld);
        v.applyMatrix4(camera.matrixWorldInverse);
        if (v.z > -0.2) ok = false;
        v.applyMatrix4(camera.projectionMatrix);
        const sx = (v.x * 0.5 + 0.5) * w, sy = (0.5 - v.y * 0.5) * h;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      // solo las tapas que se ven casi enteras: las de los bordes son las que dobla el vidrio
      ok = ok && x0 > -w * 0.08 && x1 < w * 1.08 && x1 - x0 < w * 0.45;
      hit.hidden = !ok;
      if (ok) hit.style.cssText = `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`;
    }
    resync();
  };

  // ---------- cuadro ----------
  let raf = 0, last = 0, visible = false, awake = 0;
  function wake() {
    awake = performance.now() + 400;
    if (!raf && visible) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!drag) {
      if (goal !== null) {
        rot += (goal - rot) * (1 - Math.exp(-dt * 6));
        if (Math.abs(goal - rot) < 0.0005) (rot = goal), (goal = null);
      } else {
        vel *= Math.exp(-dt * 2.6);
        // sobre el anillo, el giro solo se frena para que puedas leer
        const auto = hover ? 0 : AUTO;
        rot += (vel + auto) * dt;
      }
    }
    ring.rotation.y = rot;
    ring.updateMatrixWorld();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    post.material.uniforms.uSeed.value = (now % 1000) / 1000;
    renderer.render(postScene, postCam);
    if (interactive) place();
    const f = frontmost();
    if (f !== front) {
      front = f;
      if (cap) cap.textContent = `${covers[f].title} — ${covers[f].artist}`;
    }
    if (!root.classList.contains('is-live')) root.classList.add('is-live');
    const moving = drag || goal !== null || Math.abs(vel) > 0.001 || (AUTO && !hover);
    if (visible && !document.hidden && (moving || now < awake)) raf = requestAnimationFrame(tick);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    last = 0;
    if (visible) wake();
  }).observe(root);
  document.addEventListener('visibilitychange', () => !document.hidden && wake());
  fit();
}
