// El isologo de Supplycon en 3D: la S hecha de escalones (dos barras escalonadas y el punto), del vector oficial
// (tools/supplycon/src/iso.svg), extruida como una pieza maciza. mount() la monta viva en la galería (mira al
// cursor, se gira arrastrando, rebota si la tocás y cambia entre las combinaciones del manual y acero);
// renderStill() saca las escenas fijas (tools/render3d.mjs).
import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {live, shot, still, studioEnv} from '../three/kit.js';

export const SUPPLY = {lima: '#adde4e', carbon: '#1c1c1c', crema: '#efefed', acero: '#c9ccd1', hormigon: '#b9b6ae'};
// combinaciones del manual (pieza sobre fondo) y una de obra: acero
const WAYS = {
  lima: {piece: 'lima', bg: SUPPLY.carbon},
  carbon: {piece: 'carbon', bg: SUPPLY.lima},
  crema: {piece: 'lima', bg: SUPPLY.crema},
  acero: {piece: 'acero', bg: SUPPLY.carbon},
};

const W = 322.91, H = 268.86;
/** medio alto del isologo a escala 1 (mide 2 de ancho): el piso va siempre debajo, nunca lo corta */
const HALF = H / W;
const ISO = [
  'M322.9,159.07c.02-5.77-.01-12.09,0-17.76-.02-4.67.08-7.63-.4-10.76v-.08c-2.43-13.83-13.36-19.65-26.67-18.88l-84.25-.11c-5.51.22-11.18.34-16.54,1.73-17.36,4.37-18.73,25.21-19.8,40.1-.96,10.68-1.97,26.87-12.02,32.92-4.07,2.49-8.68,2.56-13.29,2.55-7.53,0-19.66-.02-27.31-.03-22.2-.24-65.15-.07-97.36-.12-5.33-.11-8.85.12-13.6,2.49-5.77,2.7-9.73,8.52-10.89,14.71-.81,3.55-.42,8.17-.53,13.3-.02,6.86.02,14.39,0,21.14.03,5.35-.14,8.45.69,12.13,1.64,7.5,7.13,13.4,14.54,15.48,2.7.81,4.37.94,6.77.98,15.45.02,65.48,0,90.14,0,5.1-.02,10.51.23,15.87-1.02,27.01-7.32,15.05-43.98,25.45-64.53.64-1.28,1.38-2.63,2.22-3.93,2.68-4.17,7.3-6.68,12.26-6.75,23.2-.33,80.54,0,95.53-.14,7.48,0,18.03,0,26.16,0,6.96-.12,13.22.57,18.87-1.68,6.95-2.4,12.07-8.77,13.5-15.86,1.05-4.19.52-10.38.66-15.86Z',
  'M25.27,77.15c-5.33-.11-8.85.12-13.6,2.49-5.77,2.7-9.73,8.52-10.89,14.71-.81,3.55-.42,8.17-.53,13.3-.02,6.86.02,14.39,0,21.14.03,5.35-.14,8.45.69,12.13,1.64,7.5,7.13,13.4,14.54,15.48,2.7.81,4.37.94,6.77.98,15.45.02,65.48,0,90.14,0,5.1-.02,10.51.23,15.87-1.02,27.01-7.32,15.05-43.98,25.45-64.53.64-1.28,1.38-2.63,2.22-3.93,2.68-4.17,7.3-6.68,12.26-6.75,23.2-.33,80.54,0,95.53-.14,7.48,0,18.03,0,26.16,0,6.96-.12,13.22.57,18.87-1.68,6.95-2.4,12.07-8.77,13.5-15.86,1.05-4.19.52-10.38.66-15.86.02-5.77-.01-12.09,0-17.76-.02-4.67.08-7.63-.4-10.76v-.08c-2.43-13.83-13.36-19.65-26.67-18.88l-84.25-.11c-5.51.22-11.18.34-16.54,1.73-17.36,4.37-18.73,25.21-19.8,40.1-.96,10.68-1.97,26.87-12.02,32.92-4.07,2.49-8.68,2.56-13.29,2.55-7.53,0-19.66-.02-27.31-.03-22.2-.24-65.15-.07-97.36-.12Z',
];

let shapesCache = null;
// puntos de un contorno, sin repetidos (el punto donde el trazo arranca y termina tuerce el bisel)
function cleanPoints(curve, divisions) {
  const out = [];
  for (const p of curve.getPoints(divisions)) {
    const q = out[out.length - 1];
    if (!q || q.distanceToSquared(p) > 0.0004) out.push(p);
  }
  if (out.length > 2 && out[0].distanceToSquared(out[out.length - 1]) < 0.0004) out.pop();
  return out;
}
/** las tres partes, en el orden del SVG: [barra de abajo, barra de arriba, punto] */
function isoShapes() {
  if (shapesCache) return shapesCache;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${ISO.map((d) => `<path d="${d}"/>`).join('')}<circle cx="30.72" cy="30.72" r="30.72"/></svg>`;
  shapesCache = new SVGLoader().parse(svg).paths.map((p) =>
    SVGLoader.createShapes(p).map((shape) => {
      const clean = new THREE.Shape(cleanPoints(shape, 18));
      clean.holes = shape.holes.map((h) => new THREE.Path(cleanPoints(h, 18)));
      return clean;
    }),
  );
  return shapesCache;
}

/** una pieza extruida, centrada en el isologo entero, de 2 unidades de ancho, mirando a +z */
export function isoGeometry({depth = 46, bevel = 9, parts = [0, 1, 2]} = {}) {
  // bisel hacia adentro: no se ensancha ni choca en el hueco entre las barras
  const size = bevel * 0.5;
  const geo = new THREE.ExtrudeGeometry(
    parts.flatMap((i) => isoShapes()[i]),
    // los contornos ya vienen en puntos (cleanPoints)
    {depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: size, bevelOffset: -size, bevelSegments: 5, curveSegments: 1},
  );
  geo.translate(-W / 2, -H / 2, -depth / 2);
  geo.rotateX(Math.PI); // el SVG tiene la y hacia abajo
  const s = 2 / W;
  geo.scale(s, s, s);
  // costados lisos: une los vértices repetidos y promedia las normales (si no, las curvas se ven facetadas)
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const smooth = mergeVertices(geo, 1e-5);
  smooth.computeVertexNormals();
  return smooth;
}

// reflejos suaves (laca y metal cepillado): con brillo nítido, los bordes de la luz se ven como rayitas
const vinyl = (color) => new THREE.MeshPhysicalMaterial({color: new THREE.Color(color), roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.32});
const steel = () => new THREE.MeshPhysicalMaterial({color: new THREE.Color(SUPPLY.acero), roughness: 0.46, metalness: 1, clearcoat: 0.3, clearcoatRoughness: 0.45});
const concrete = () => new THREE.MeshStandardMaterial({color: new THREE.Color(SUPPLY.hormigon), roughness: 0.95, metalness: 0});
const materialFor = (piece) => (piece === 'acero' ? steel() : vinyl(SUPPLY[piece]));

function stage(renderer, bg, {floorY = -HALF - 0.02, shadow = 0.18} = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  studioEnv(renderer, scene, 0.6);
  const key = new THREE.DirectionalLight('#ffffff', 1.7);
  key.position.set(-2.2, 3.6, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0006;
  Object.assign(key.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 14});
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#9a9a94', 0.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({opacity: shadow}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
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
      let way = WAYS.lima;
      const {scene} = stage(renderer, way.bg);
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
      camera.position.set(0, 0.25, 5.4);
      camera.lookAt(0, 0, 0);
      const mats = {lima: vinyl(SUPPLY.lima), carbon: vinyl('#232323'), acero: steel()};
      const mesh = new THREE.Mesh(isoGeometry(), mats.lima);
      mesh.castShadow = true;
      const pivot = new THREE.Group();
      pivot.add(mesh);
      scene.add(pivot);
      const toBg = new THREE.Color(way.bg);
      return {
        scene,
        camera,
        pivot,
        mesh,
        setWay(key) {
          way = WAYS[key];
          mesh.material = mats[way.piece];
          toBg.set(way.bg);
        },
        update(t, dt) {
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

/** héroe: el isologo lima sobre carbón, de tres cuartos (es el póster del visor) */
function hero(renderer, w, h) {
  const {scene} = stage(renderer, SUPPLY.carbon, {shadow: 0.35});
  const m = new THREE.Mesh(isoGeometry(), vinyl(SUPPLY.lima));
  m.castShadow = true;
  m.rotation.y = -0.18;
  scene.add(m);
  const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
  camera.position.set(0, 0.25, 5.4);
  camera.lookAt(0, 0, 0);
  return shot(renderer, scene, camera);
}

/** familia: carbón, acero y crema, parados en fila sobre lima */
function familia(renderer, w, h) {
  const k = 0.62;
  const floorY = -0.5;
  const {scene} = stage(renderer, SUPPLY.lima, {floorY, shadow: 0.22});
  const geo = isoGeometry();
  ['carbon', 'acero', 'crema'].forEach((p, i) => {
    const m = new THREE.Mesh(geo, p === 'acero' ? steel() : vinyl(p === 'carbon' ? '#232323' : SUPPLY[p]));
    m.castShadow = true;
    m.scale.setScalar(k);
    m.position.set((i - 1) * 1.55, floorY + HALF * k + 0.005, (i % 2) * -0.35);
    m.rotation.y = -0.35 + i * 0.16;
    scene.add(m);
  });
  const camera = new THREE.PerspectiveCamera(24, w / h, 0.1, 50);
  camera.position.set(0.4, 1.05, 7.9);
  camera.lookAt(0, -0.1, 0);
  return shot(renderer, scene, camera);
}

/** escalones: la S hecha de escalones, literal: el isologo acostado, cada parte a otra altura, en hormigón con
    la pisada en lima, bajo un cielo claro (como las fotos de arquitectura del manual) */
function escalones(renderer, w, h) {
  // fondo y niebla del color del piso: el horizonte no se ve (asomaba como una línea arriba)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6e3dc');
  scene.fog = new THREE.Fog('#e6e3dc', 5, 12);
  studioEnv(renderer, scene, 0.5);
  const sun = new THREE.DirectionalLight('#fff6e8', 2.2);
  sun.position.set(-3, 5, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 16});
  scene.add(sun, new THREE.HemisphereLight('#dce9f2', '#8a8780', 0.75));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({color: '#d4d1ca', roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // [barra de abajo, barra de arriba, punto]: acostado, la de abajo queda adelante. De adelante hacia atrás,
  // cada una más alta, como escalones
  const heights = [0.1, 0.3, 0.58];
  [0, 1, 2].forEach((part) => {
    const d = heights[part];
    const geo = isoGeometry({depth: (d / 2) * 322.91, bevel: 3, parts: [part]});
    const m = new THREE.Mesh(geo, [vinyl(SUPPLY.lima), concrete()]);
    m.rotation.x = -Math.PI / 2; // acostado: la cara mira arriba
    m.position.y = d / 2 + 0.01;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  });
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(1.55, 1.3, 3.0);
  camera.lookAt(-0.12, 0.06, -0.12);
  return shot(renderer, scene, camera);
}

/** ladrillos: un muro de isologos en carbón, aparejados como ladrillos, con algunos en lima */
function ladrillos(renderer, w, h) {
  const k = 0.4;
  const floorY = -1.6;
  const {scene} = stage(renderer, SUPPLY.crema, {floorY, shadow: 0.2});
  const geo = isoGeometry({depth: 90, bevel: 7});
  const carbon = vinyl('#232323'), lima = vinyl(SUPPLY.lima);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // filas a 0,74 de alto (el isologo a esta escala mide 0,67): se tocan apenas, sin encastrarse
  for (let row = 0; row < 5; row++)
    for (let col = -4; col <= 4; col++) {
      const m = new THREE.Mesh(geo, rnd() < 0.18 ? lima : carbon);
      m.castShadow = m.receiveShadow = true;
      m.scale.setScalar(k);
      m.position.set(col * 0.9 + (row % 2) * 0.45, floorY + HALF * k + row * 0.74, 0);
      scene.add(m);
    }
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(-3.2, 0.4, 5.6);
  camera.lookAt(0.1, -0.05, 0);
  return shot(renderer, scene, camera);
}

const PRESETS = {hero, familia, escalones, ladrillos};

/** una escena fija en PNG (data URL), para tools/render3d.mjs */
export const renderStill = (preset, w, h) => still(PRESETS[preset], w, h);
