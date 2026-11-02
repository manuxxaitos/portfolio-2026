// Piezas comunes de las escenas 3D de proyectos (Kench, AISH): el renderer, el ambiente de reflejos,
// la interacción del visor en vivo (mirar al cursor, girar arrastrando, rebotar al tocar, cambiar de color)
// y la foto fija para los renders.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export function makeRenderer(canvas, {preserve = false, w, h} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: preserve});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // neutral respeta los colores de las marcas (ACES los aclara)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  if (w) renderer.setSize(w, h, false);
  return renderer;
}

/** reflejos suaves de estudio, para vinilo y cromo */
export function studioEnv(renderer, scene, intensity = 0.55) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
}

export const shot = (renderer, scene, camera, composer) => {
  composer ? composer.render() : renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};

/** una escena fija en PNG (data URL) */
export function still(fn, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const renderer = makeRenderer(canvas, {preserve: true, w, h});
  renderer.setPixelRatio(1);
  const url = fn(renderer, w, h);
  renderer.dispose();
  return url;
}

/**
 * Visor en vivo dentro de una galería: canvas [data-toy-canvas], botones [data-way].
 * build(renderer) devuelve {scene, camera, pivot, mesh, setWay(key), update(t, dt), poke()}.
 */
export function live(root, build, {reduced = false, onPoke, onColor} = {}) {
  const canvas = root.querySelector('[data-toy-canvas]');
  const frame = canvas.parentElement;
  const renderer = makeRenderer(canvas);
  const s = build(renderer);
  const fit = () => {
    const w = frame.clientWidth, h = frame.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    s.camera.aspect = w / h;
    s.camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(frame);
  fit();

  // mira hacia el cursor; arrastrar gira con inercia; un toque sin arrastre la hace rebotar
  const look = {x: 0, y: 0};
  let spin = 0, vel = 0, dragging = false, moved = 0, lastX = 0, squash = 0, squashV = 0;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    look.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    look.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    vel = dx * 0.012;
    spin += vel;
  });
  canvas.addEventListener('pointerleave', () => ((look.x = 0), (look.y = 0)));
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
    if (moved < 6) {
      if (!reduced) squashV -= 9;
      s.poke?.();
      onPoke?.();
    }
  });
  let current = root.querySelector('[data-way][aria-pressed="true"]')?.dataset.way;
  root.querySelectorAll('[data-way]').forEach((b) =>
    b.addEventListener('click', () => {
      // el mismo color otra vez no cambia nada (ni suena)
      if (b.dataset.way === current) return;
      current = b.dataset.way;
      s.setWay(b.dataset.way);
      root.querySelectorAll('[data-way]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onColor?.(b.dataset.way);
    }),
  );

  const clock = new THREE.Timer();
  let raf = 0, visible = false, frames = 0;
  const tick = () => {
    raf = 0;
    if (!visible || document.hidden) return;
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = reduced ? 0 : clock.getElapsed();
    if (!dragging) {
      vel *= Math.exp(-dt * 2.2);
      spin += vel;
      // ya sin envión, vuelve de frente
      if (Math.abs(vel) < 0.002) spin += (Math.round(spin / (Math.PI * 2)) * Math.PI * 2 - spin) * (1 - Math.exp(-dt * 1.6));
    }
    squashV += (-120 * squash - 9 * squashV) * dt;
    squash += squashV * dt;
    s.pivot.rotation.y += (spin + look.x * 0.55 - s.pivot.rotation.y) * (1 - Math.exp(-dt * 8));
    s.pivot.rotation.x += (look.y * 0.22 - s.pivot.rotation.x) * (1 - Math.exp(-dt * 8));
    s.pivot.position.y = Math.sin(t * 1.6) * 0.035;
    s.mesh.scale.set(1 - squash * 0.06, 1 + squash * 0.09, 1 - squash * 0.06);
    s.update?.(t, dt);
    renderer.render(s.scene, s.camera);
    if (frames++ === 3) root.classList.add('is-live');
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(tick);
  }).observe(root);
  document.addEventListener('visibilitychange', () => !document.hidden && visible && !raf && (raf = requestAnimationFrame(tick)));
}
