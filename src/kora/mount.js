// Monta la escena de Kora (src/kora/scene, copiada de exploraciones/kora-ascii) en la estampilla de la portada.
// Es la misma lógica que main.js de allá, con lo que pide una portada:
//  - se busca todo dentro de la estampilla, sin ids globales (las perforaciones las hace el componente);
//  - la rueda no hace zoom ni el espacio cambia el render (la página tiene que poder scrollear);
//  - se pausa fuera de pantalla y con la pestaña oculta;
//  - si los cuadros van lentos, baja la resolución;
//  - con movimiento reducido el viento se queda quieto y solo dibuja cuando algo cambia.
// Ella sigue al cursor por toda la página, como allá.
import * as THREE from 'three';
import {createAscii} from './scene/ascii.js';
import {U, daySpan} from './scene/common.js';
import {buildKora} from './scene/kora.js';
import {buildWorld} from './scene/world.js';

export function mountKora(root, {reduced = false} = {}) {
  const canvas = root.querySelector('[data-kora-canvas]');
  const frame = canvas.parentElement;
  const skyLabel = root.querySelector('[data-kora-sky]');
  const skyInput = skyLabel?.querySelector('input');

  // estado del bucle (arriba de todo: el slider y el tamaño lo despiertan desde el arranque)
  let running = false;
  let visible = true;
  let raf = 0;
  // con movimiento reducido: el tiempo de la escena no avanza y solo dibuja un rato después de cada cambio
  let awakeUntil = 0;
  // ritmo: 60 cuadros mientras la movés, la tocás o cambia la hora; quieta o mientras scrolleás, 30
  // (en ASCII no se nota y le deja aire al resto de la página)
  let hotUntil = 0,
    scrolledAt = -1e9,
    drawnAt = 0;
  addEventListener('scroll', () => (scrolledAt = performance.now()), {passive: true});
  function wake() {
    awakeUntil = performance.now() + 1200;
    hotUntil = performance.now() + 1500;
    if (reduced && running && !raf) raf = requestAnimationFrame(tick);
  }

  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#8fbde9', 40, 950);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);

  const sun = new THREE.DirectionalLight('#ffffff', 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 40});
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#ffffff', 1);
  scene.add(rim);
  const hemi = new THREE.HemisphereLight('#9cc8ff', '#4b6a2a', 1.1);
  scene.add(hemi);

  const world = buildWorld(scene);
  const kora = buildKora();
  kora.group.position.set(-0.25, 0.035, 0);
  kora.group.rotation.y = -0.8;
  scene.add(kora.group);

  const ascii = createAscii(renderer);

  // ---------- hora del día: mediodía, atardecer, noche ----------
  const LOOKS = [
    {sun: '#fff0d2', sunI: 2.6, dir: [-0.55, 0.72, 0.42], rim: '#ffd9b0', rimI: 1.2, sky: '#cfe2ff', ground: '#4f6a48', fill: 1.1, fog: '#c6dcef'},
    {sun: '#ffb889', sunI: 2.3, dir: [-0.8, 0.34, 0.5], rim: '#ff8a58', rimI: 2.6, sky: '#ffbfa0', ground: '#5a4a7a', fill: 1.15, fog: '#f2a58c'},
    {sun: '#9fb4ff', sunI: 0.75, dir: [-0.45, 0.8, 0.4], rim: '#8ea2ff', rimI: 0.9, sky: '#4f63b4', ground: '#1a2550', fill: 0.75, fog: '#1d2756'},
  ].map((l) => ({
    ...l,
    sun: new THREE.Color(l.sun),
    rim: new THREE.Color(l.rim),
    sky: new THREE.Color(l.sky),
    ground: new THREE.Color(l.ground),
    fog: new THREE.Color(l.fog),
    dir: new THREE.Vector3(...l.dir).normalize(),
  }));
  const LAMP = new THREE.Color('#ffa24a').multiplyScalar(2.2);
  function setTime(v) {
    U.uDay.value = v;
    const [ia, ib, k] = daySpan(v);
    const a = LOOKS[ia],
      b = LOOKS[ib];
    const lerp = (x, y) => x + (y - x) * k;
    U.uSunDir.value.copy(a.dir).lerp(b.dir, k).normalize();
    sun.color.copy(a.sun).lerp(b.sun, k);
    sun.intensity = lerp(a.sunI, b.sunI);
    sun.position.copy(U.uSunDir.value).multiplyScalar(12);
    U.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
    rim.color.copy(a.rim).lerp(b.rim, k);
    rim.intensity = lerp(a.rimI, b.rimI) * 0.65;
    rim.position.copy(U.uRimDir.value).multiplyScalar(10);
    U.uRimCol.value.copy(rim.color).multiplyScalar(lerp(a.rimI, b.rimI));
    hemi.color.copy(a.sky).lerp(b.sky, k);
    hemi.groundColor.copy(a.ground).lerp(b.ground, k);
    hemi.intensity = lerp(a.fill, b.fill);
    U.uSky.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.5);
    U.uGround.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 0.32);
    scene.fog.color.copy(a.fog).lerp(b.fog, k);
    U.uLampCol.value.copy(LAMP).multiplyScalar(THREE.MathUtils.smoothstep(v, 0.55, 0.95));
    world.setTime(v);
  }

  // ---------- el slider, como el de kshv.me: color del campo, del glifo y la luna salen de las mismas paradas ----------
  const SKY_STOPS = [
    [0, [111, 176, 220]],
    [0.36, [255, 198, 90]],
    [0.48, [240, 102, 58]],
    [0.58, [232, 72, 122]],
    [0.76, [74, 42, 150]],
    [1, [11, 18, 56]],
  ];
  function skyVars(v) {
    const i = SKY_STOPS.findIndex(([s]) => s >= v);
    let field;
    if (i <= 0) field = `rgb(${SKY_STOPS[0][1].join(' ')})`;
    else {
      const [s0, c0] = SKY_STOPS[i - 1],
        [s1, c1] = SKY_STOPS[i];
      const k = (v - s0) / (s1 - s0);
      field = `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * k)).join(' ')})`;
    }
    return {
      '--v': String(v),
      '--field': field,
      '--glyph': v > 0.16 && v < 0.5 ? '#2a1405' : v <= 0.16 ? '#0b2a5c' : '#fff3da',
      '--moon': String(Math.min(1, Math.max(0, (v - 0.62) / 0.14))),
    };
  }
  const time = {target: 0.5, now: 0.5};
  function onSky() {
    const v = Number(skyInput.value);
    time.target = v;
    for (const [k, val] of Object.entries(skyVars(v))) skyLabel.style.setProperty(k, val);
    wake();
  }
  if (skyInput) {
    skyInput.addEventListener('input', onSky);
    onSky();
    time.now = time.target;
  }
  setTime(time.now);

  // ---------- encuadre ----------
  const CAM = {
    orbit: new THREE.Vector3(-0.2, 0.45, 0),
    look: new THREE.Vector3(-0.2, 0.92, 0),
    dist: 2.5,
    elev: THREE.MathUtils.degToRad(6),
    azim: THREE.MathUtils.degToRad(6),
  };
  const VFOV = 50;
  // resolución: hasta 2× y baja si los cuadros vienen lentos
  let dprCap = Math.min(window.devicePixelRatio || 1, 2);
  // aunque los cuadros vengan lentos, en retina no baja de 1,5×: con menos, las celdas se agrandan y se pierde densidad
  const dprFloor = dprCap >= 2 ? 1.5 : 0.75;
  function fit() {
    const w = frame.clientWidth,
      h = frame.clientHeight;
    if (!w || !h) return;
    // celdas chicas: ~360 columnas en la estampa de 724 px, más en pantallas anchas
    ascii.state.cssCell = THREE.MathUtils.clamp(Math.round((w / 362) * 4) / 4, 2, 2.75);
    renderer.setPixelRatio(dprCap);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov =
      w / h < 1.15
        ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(VFOV) / 2) * (1.15 / (w / h))))
        : VFOV;
    camera.updateProjectionMatrix();
    ascii.resize(w, h, dprCap);
    wake();
  }
  new ResizeObserver(fit).observe(frame);
  fit();

  // puntero → hacia dónde mira, medido contra la imagen: lo sigue por toda la página
  const ndc = new THREE.Vector2(0, 0.1);
  let lastMove = -10,
    speed = 0,
    hasPointer = false;
  window.addEventListener(
    'pointermove',
    (e) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.6, 1.6);
      const y = THREE.MathUtils.clamp(-((e.clientY - r.top) / r.height) * 2 + 1, -1.6, 1.6);
      speed += Math.hypot(x - ndc.x, y - ndc.y);
      ndc.set(x, y);
      lastMove = performance.now() / 1000;
      hasPointer = true;
      wake();
    },
    {passive: true},
  );
  document.addEventListener('pointerleave', () => (hasPointer = false));
  // un toque en la estampilla: se entusiasma como con un movimiento rápido (se para y barre la cola)
  document.addEventListener('kora:poke', () => {
    speed += 2.4;
    wake();
  });

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const target = new THREE.Vector3();
  const look = new THREE.Vector3(0, 0.75, 2);
  const camDir = new THREE.Vector3();
  let excite = 0;

  const clock = new THREE.Timer();
  let frames = 0;
  // medición de cuadros para bajar la resolución
  let slow = 0,
    sampled = 0;

  function tick(now = performance.now()) {
    raf = 0;
    if (!running) return;
    const calm = now > hotUntil || now - scrolledAt < 300;
    if (calm && !reduced && now - drawnAt < 31) {
      raf = requestAnimationFrame(tick);
      return;
    }
    drawnAt = now;
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = reduced ? 4 : clock.getElapsed();
    U.uTime.value = t;
    U.uGust.value = 0.75 + 0.35 * Math.sin(t * 0.31) + 0.2 * Math.sin(t * 0.83 + 1.3);

    if (Math.abs(time.target - time.now) > 1e-4) {
      time.now += (time.target - time.now) * (1 - Math.exp(-dt * 9));
      setTime(time.now);
      awakeUntil = Math.max(awakeUntil, performance.now() + 200);
      hotUntil = Math.max(hotUntil, performance.now() + 200);
    }

    const p = hasPointer ? [ndc.x, ndc.y] : [0, 0.1];
    const az = CAM.azim + THREE.MathUtils.clamp(p[0], -1, 1) * 0.035,
      el = CAM.elev + THREE.MathUtils.clamp(p[1], -1, 1) * 0.015;
    camera.position
      .set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      .multiplyScalar(CAM.dist)
      .add(CAM.orbit);
    camera.lookAt(CAM.look);

    const head = kora.headWorld();
    camera.getWorldDirection(camDir);
    plane.setFromNormalAndCoplanarPoint(camDir.clone().negate(), head.clone().addScaledVector(camDir, -1.6));
    const tNow = performance.now() / 1000;
    const idle = !hasPointer || tNow - lastMove > 6;
    if (!idle) {
      ray.setFromCamera(new THREE.Vector2(p[0], p[1]), camera);
      ray.ray.intersectPlane(plane, target) || target.copy(camera.position);
    } else {
      // nadie mueve el cursor: te mira, y cada tanto mira alrededor
      const g = !reduced && Math.sin(t * 0.37) > 0.75 ? Math.sin(t * 0.9) * 1.2 : 0;
      target.copy(camera.position).add(new THREE.Vector3(g, -0.15, 0));
    }
    look.lerp(target, 1 - Math.exp(-dt * 10));

    speed *= Math.exp(-dt * 3);
    excite += (Math.min(speed * 0.8, 1) - excite) * (1 - Math.exp(-dt * 4));

    kora.update(t, dt, look, excite);
    world.update(t, camera);
    ascii.render(scene, camera, t);

    if (++frames === 8) root.classList.add('is-live');

    // si los cuadros pasan de ~40 ms seguido, una resolución menos (hasta 1×, después 0,75×)
    if (frames > 30 && !reduced) {
      sampled++;
      if (dt > 0.04) slow++;
      if (sampled >= 90) {
        if (slow > 45 && dprCap > dprFloor) {
          dprCap = Math.max(dprFloor, dprCap > 1 ? 1 : 0.75);
          fit();
        }
        sampled = slow = 0;
      }
    }

    if (!reduced || performance.now() < awakeUntil) raf = requestAnimationFrame(tick);
  }

  function run() {
    const should = visible && !document.hidden;
    if (should === running) return;
    running = should;
    if (running) {
      clock.reset?.();
      if (!raf) raf = requestAnimationFrame(tick);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      run();
    },
    {rootMargin: '120px 0px'},
  ).observe(root);
  document.addEventListener('visibilitychange', run);
  run();
}
