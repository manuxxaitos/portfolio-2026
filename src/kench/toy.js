// La llama de Kench en 3D: el vector del logo (con los ojos calados) extruido con bisel, en vinilo brillante.
// mount() la monta viva en la galería (mira al cursor, se gira arrastrando, rebota si la tocás y cambia de
// color); renderStill() saca las escenas fijas de la galería (tools/render3d.mjs).
import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {live, shot, still} from '../three/kit.js';

// colores del brandbook
export const KENCH = {red: '#e74539', cream: '#f6f5ae', black: '#1d1d1d', white: '#f7f6f0'};
// combinaciones del manual: llama sobre fondo
export const WAYS = {
  rojo: {flame: KENCH.red, bg: KENCH.cream},
  crema: {flame: KENCH.cream, bg: KENCH.red},
  negro: {flame: KENCH.black, bg: '#ffffff'},
  blanco: {flame: KENCH.white, bg: KENCH.black},
};

// el logo, tal cual sale de 04-Diseno/deck-y-brandbook/EXPORTS/1.svg
const FLAME_D = 'M745.75,399.12c-.38-.39-11.58-9.62-19.74-16.34-5.41-4.45-10.28-9.52-14.57-15.05-2.51-3.23-5.03-6.39-7.63-9.5-8.15-9.74-13.24-21.61-14.95-34.19-5.34-39.15-31.49-41.42-60.4-77.85-1.12-1.41-3.33-.12-2.66,1.55,6.11,15.08,2.84,17.41-11.09,27.9-7.75,5.92-18.78,6.74-26.53.82v-.2c4.7-48.17-22.04-84.71-63.07-107.77-35.52-20-64.51-51.84-48.99-90.01-33.88-5.51-62.86,13.47-68.58,46.54-3.07,17.96-4.29,37.97,1.42,55.72,6.94,21.23,23.27,54.09,7.35,67.56-4.49,3.67-35.52,18.57-41.23,39.8-8.98,32.86-41.23-51.03-29.6-87.56-29.8,5.72-55.31,24.09-64.29,52.46-13.68,43.27,36.94,46.33,36.94,78.38-.21,18.57-1.22,36.54-5.91,53.48-57.36,95.52-5.72-26.13-34.09-47.35,4.08,32.66-4.7,32.86-14.7,64.5-43.27,83.69-43.07,180.64,7.35,264.74,42.25,70.83,120.84,121.65,208.4,127.77,163.09,11.43,297.6-123.49,285.55-287.8,5.1-39.39,7.96-80.63-18.98-107.57ZM512.66,603.23c-2.25,9.8-5.92,18.98-10.21,27.96-.82,1.84-1.63,3.47-2.45,5.31-8.37,34.9-84.3,5.1-112.27-48.17-20.82-47.76-26.33-90.42-16.94-129,58.38,23.47,102.27,42.86,131.86,58.78,23.27,13.88,18.17,53.07,10.01,85.12ZM697.38,622.42c-27.15,31.23-82.67,39.39-82.88,14.49-1.02-4.29-2.03-8.57-2.85-12.86-1.43-24.09-1.23-60.21,19.59-66.75,22.46-6.12,54.91-12.25,97.77-18.78.21,27.35-10.21,55.11-31.64,83.89Z';

let shapesCache = null;
function flameShapes() {
  if (shapesCache) return shapesCache;
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="${FLAME_D}"/></svg>`);
  shapesCache = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  return shapesCache;
}

/** la llama extruida, centrada, de 1 unidad de alto, mirando a +z */
export function flameGeometry({depth = 110, bevel = 16, segments = 6} = {}) {
  const geo = new THREE.ExtrudeGeometry(flameShapes(), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.75,
    bevelSegments: segments,
    curveSegments: 28,
  });
  geo.center();
  geo.rotateX(Math.PI); // el SVG tiene la y hacia abajo
  const s = 1 / 800;
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  return geo;
}

/** vinilo: color plano, brillo de laca encima */
export const vinyl = (color) =>
  new THREE.MeshPhysicalMaterial({color: new THREE.Color(color), roughness: 0.36, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14});

function stage(renderer, bg) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(-2.2, 3.4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0006;
  Object.assign(key.shadow.camera, {left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12});
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#b9b2a0', 0.65));
  // el piso solo recibe la sombra: se ve el color de fondo
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({opacity: 0.16}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.62;
  floor.receiveShadow = true;
  scene.add(floor);
  return {scene, key, floor};
}

/* ------------------------------------------------------------------ */
/* en vivo                                                             */
/* ------------------------------------------------------------------ */

export function mount(root, opts) {
  live(
    root,
    (renderer) => {
      let way = WAYS.rojo;
      const {scene} = stage(renderer, way.bg);
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
      camera.position.set(0, 0.25, 3.4);
      camera.lookAt(0, 0, 0);
      const mat = vinyl(way.flame);
      const mesh = new THREE.Mesh(flameGeometry(), mat);
      mesh.castShadow = true;
      const pivot = new THREE.Group();
      pivot.add(mesh);
      scene.add(pivot);
      const toColor = new THREE.Color(way.flame), toBg = new THREE.Color(way.bg);
      return {
        scene,
        camera,
        pivot,
        mesh,
        setWay(key) {
          way = WAYS[key];
          toColor.set(way.flame);
          toBg.set(way.bg);
        },
        update(t, dt) {
          mat.color.lerp(toColor, 1 - Math.exp(-dt * 7));
          scene.background.lerp(toBg, 1 - Math.exp(-dt * 7));
        },
      };
    },
    opts,
  );
}

/* ------------------------------------------------------------------ */
/* escenas fijas                                                       */
/* ------------------------------------------------------------------ */

/** familia: las cuatro combinaciones paradas en fila */
function family(renderer, w, h) {
  const {scene, floor} = stage(renderer, KENCH.cream);
  floor.material.opacity = 0.2;
  floor.position.y = -0.5; // paradas en el piso
  const geo = flameGeometry();
  [KENCH.red, KENCH.black, KENCH.white, '#f2ef9a'].forEach((c, i) => {
    const m = new THREE.Mesh(geo, vinyl(c));
    m.castShadow = true;
    m.position.set((i - 1.5) * 1.22, 0, (i % 2) * -0.25);
    m.rotation.y = -0.38 + i * 0.16;
    m.scale.setScalar(i === 0 ? 1.04 : 1);
    scene.add(m);
  });
  const camera = new THREE.PerspectiveCamera(23, w / h, 0.1, 50);
  camera.position.set(0.55, 1.2, 7.3);
  camera.lookAt(0, -0.1, 0);
  return shot(renderer, scene, camera);
}

/** héroe: una sola, grande, de tres cuartos */
function hero(renderer, w, h) {
  const {scene} = stage(renderer, KENCH.cream);
  const m = new THREE.Mesh(flameGeometry(), vinyl(KENCH.red));
  m.castShadow = true;
  m.rotation.set(-0.06, -0.42, 0.04);
  scene.add(m);
  const camera = new THREE.PerspectiveCamera(26, w / h, 0.1, 50);
  camera.position.set(0.25, 0.45, 3.2);
  camera.lookAt(0.05, -0.02, 0);
  return shot(renderer, scene, camera);
}

/** fichas: un montón de llamitas chatas desparramadas, vistas desde arriba */
function tokens(renderer, w, h) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(KENCH.red);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(-2, 6, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  Object.assign(key.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 20});
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#7a2a20', 0.5));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({opacity: 0.22}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const geo = flameGeometry({depth: 40, bevel: 10});
  const colors = [KENCH.cream, KENCH.cream, KENCH.white, KENCH.black, KENCH.cream];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(geo, vinyl(colors[i % colors.length]));
    m.castShadow = m.receiveShadow = true;
    const s = 0.55 + rnd() * 0.5;
    m.scale.setScalar(s);
    m.rotation.set(-Math.PI / 2 + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.4, rnd() * Math.PI * 2);
    m.position.set((rnd() - 0.5) * 9, 0.05 + rnd() * 0.25, (rnd() - 0.5) * 5.5);
    scene.add(m);
  }
  const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 50);
  camera.position.set(0, 7.2, 3.2);
  camera.lookAt(0, 0, 0.1);
  return shot(renderer, scene, camera);
}

/** neón: el contorno de la llama como tubo de luz sobre una pared oscura */
function neon(renderer, w, h) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#151312');
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({color: '#221e1c', roughness: 0.92}));
  wall.position.z = -0.12;
  scene.add(wall);
  const glow = new THREE.PointLight('#ff5a46', 2.2, 4, 1.8);
  glow.position.set(0, 0, 0.6);
  scene.add(glow, new THREE.AmbientLight('#ffffff', 0.05));
  const tubeMat = new THREE.MeshStandardMaterial({color: '#ffe3dc', emissive: new THREE.Color('#ff3b2a'), emissiveIntensity: 1.5, roughness: 0.4});
  const s = 1 / 800;
  for (const shape of flameShapes()) {
    for (const contour of [shape, ...shape.holes]) {
      const pts = contour.getSpacedPoints(contour === shape ? 420 : 160).map((p) => new THREE.Vector3((p.x - 450) * s, -(p.y - 540) * s, 0));
      const curve = new THREE.CatmullRomCurve3(pts, true);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.012, 12, true), tubeMat));
    }
  }
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(0.18, -0.05, 2.5);
  camera.lookAt(0, 0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const composer = new EffectComposer(renderer);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.38, 0.12));
  composer.addPass(new OutputPass());
  return shot(renderer, scene, camera, composer);
}

const PRESETS = {family, hero, tokens, neon};

/** una escena fija en PNG (data URL), para tools/render3d.mjs */
export const renderStill = (preset, w, h) => still(PRESETS[preset], w, h);
