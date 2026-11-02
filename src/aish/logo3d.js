// El logo de AISH en 3D: el calco del logo (letras con contorno y sombra, óvalo y estrellas) extruido con bisel,
// en cromo que refleja las luces de neón rosa y verde de la pista. mount() lo monta vivo en la galería (mira al
// cursor, se gira arrastrando y rebota y destella si lo tocás); renderStill() saca las escenas fijas
// (tools/render3d.mjs).
import * as THREE from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {AISH_D, AISH_H, AISH_W} from './logo-path.js';
import {live, shot, still} from '../three/kit.js';

// colores del manual: el logo sobre negro; el cromo toma los colores de las luces
export const AISH = {black: '#161616', green: '#c6df4c', pink: '#e9a5c9', orange: '#f0592b', yellow: '#f3ec4a'};
const CHROME = {color: '#e9e9ec', metal: 1, rough: 0.12};

let shapesCache = null;
// puntos de un contorno, sin repetidos ni casi repetidos (los tramos de largo cero tuercen el bisel)
function cleanPoints(curve, divisions) {
  const pts = curve.getPoints(divisions);
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || q.distanceToSquared(p) > 0.36) out.push(p);
  }
  if (out.length > 2 && out[0].distanceToSquared(out[out.length - 1]) < 0.36) out.pop();
  return out;
}
function logoShapes() {
  if (shapesCache) return shapesCache;
  // evenodd: el interior de las letras queda hueco, como en el logo
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AISH_W} ${AISH_H}"><path fill-rule="evenodd" d="${AISH_D}"/></svg>`);
  shapesCache = data.paths
    .flatMap((p) => SVGLoader.createShapes(p))
    .map((shape) => {
      const clean = new THREE.Shape(cleanPoints(shape, 10));
      clean.holes = shape.holes.map((h) => new THREE.Path(cleanPoints(h, 10)));
      return clean;
    });
  return shapesCache;
}

/** para revisar la triangulación (tools/aish/revisar.mjs): los triángulos de la cara, en coordenadas del calco */
export function logoTriangles() {
  return logoShapes().flatMap((shape) => {
    const outer = shape.getPoints(1);
    const holes = shape.holes.map((h) => h.getPoints(1));
    const all = [...outer, ...holes.flat()];
    return THREE.ShapeUtils.triangulateShape(outer, holes).map((t) => t.map((i) => [all[i].x, all[i].y]));
  });
}

/** el logo extruido, centrado, de unas 2,2 unidades de ancho, mirando a +z */
export function logoGeometry({depth = 60, bevel = 7} = {}) {
  // el bisel va hacia adentro (bevelOffset = -bevelSize): así no se ensancha y no choca con la forma vecina en
  // los huecos finos del logo. Es angosto (2 de 1580): más ancho se cruza en las puntas de las estrellas y
  // deja astillas; la profundidad (bevelThickness) es la que le da el brillo al borde.
  const size = 2;
  const geo = new THREE.ExtrudeGeometry(logoShapes(), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: size,
    bevelOffset: -size,
    bevelSegments: 3,
    // los contornos ya vienen en puntos (cleanPoints)
    curveSegments: 1,
  });
  geo.center();
  geo.rotateX(Math.PI);
  const s = 2.2 / AISH_W;
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  return geo;
}

/** la estrella de cuatro puntas del logo: lados cóncavos */
export function starGeometry(depth = 0.06) {
  const sh = new THREE.Shape();
  const r = 0.5, k = 0.12;
  sh.moveTo(0, r);
  sh.quadraticCurveTo(k, k, r, 0);
  sh.quadraticCurveTo(k, -k, 0, -r);
  sh.quadraticCurveTo(-k, -k, -r, 0);
  sh.quadraticCurveTo(-k, k, 0, r);
  const geo = new THREE.ExtrudeGeometry(sh, {depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10});
  geo.center();
  return geo;
}

const chrome = () =>
  new THREE.MeshPhysicalMaterial({color: new THREE.Color(CHROME.color), metalness: CHROME.metal, roughness: CHROME.rough, clearcoat: 1, clearcoatRoughness: 0.1});

// la pista: un cuarto negro con paneles de neón rosa y verde a los costados y una tira blanca arriba;
// el cromo y la bola de espejos reflejan eso
function neonEnv(renderer, {sparkles = false} = {}) {
  const room = new THREE.Scene();
  room.background = new THREE.Color('#060607');
  const panel = (c, w, h, x, y, z, rx, ry, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide}));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    room.add(m);
  };
  // al frente, lo que el cromo refleja de cara: un horizonte. Arriba, franjas de luz (blanca, rosa, lila);
  // abajo, negro. Así cada letra tiene su degradé y su línea de horizonte, como el cromo de verdad.
  const front = (y, h, c, k) => panel(c, 18, h, 0, y, 6, 0, Math.PI, k);
  front(0.18, 0.36, '#ffffff', 2.6);
  front(0.6, 0.5, AISH.pink, 1.7);
  front(1.2, 0.7, '#b9a6ff', 0.9);
  front(2.4, 1.7, '#3a3550', 0.6);
  // abajo del horizonte, el piso de la pista: oscuro, con un reflejo verde (así la mitad de abajo no se pierde)
  front(-0.25, 0.5, '#2c2a36', 1.2);
  front(-0.7, 0.4, AISH.green, 0.55);
  front(-1.6, 1.4, '#141418', 1);
  // luz cenital blanca
  panel('#ffffff', 9, 4, 0, 5, 0, Math.PI / 2, 0, 2.2);
  // neones de costado
  panel(AISH.pink, 2.4, 7, -5.5, 0.4, 0.5, 0, Math.PI / 2, 4);
  panel(AISH.green, 2.4, 7, 5.5, -0.2, 0.5, 0, -Math.PI / 2, 4);
  // lucecitas por todo alrededor (también abajo): los destellos de la bola de espejos (solo para la bola: en
  // los bordes finos del logo se ven como rayitas)
  if (sparkles) addSparkles(room);
  const pmrem = new THREE.PMREMGenerator(renderer);
  return pmrem.fromScene(room, 0.01).texture;
}

function addSparkles(room) {
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tints = ['#ffffff', AISH.pink, AISH.green, '#ffffff', '#ffffff'];
  const v = new THREE.Vector3();
  for (let i = 0; i < 260; i++) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(8);
    // nada justo al frente: ahí está el horizonte
    if (v.z > 6.5 && Math.abs(v.y) < 3) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({color: new THREE.Color(tints[i % tints.length]).multiplyScalar(2.6), side: THREE.DoubleSide}));
    m.position.copy(v);
    m.lookAt(0, 0, 0);
    room.add(m);
  }
}

// la noche: negro, la pista reflejada y dos luces de color suaves de costado
function night(renderer, {bg = AISH.black, env = 1, sparkles = false} = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  scene.environment = neonEnv(renderer, {sparkles});
  scene.environmentIntensity = env;
  const pink = new THREE.PointLight(AISH.pink, 3.5, 10, 1.2);
  pink.position.set(-3.4, 0.8, 3);
  const green = new THREE.PointLight(AISH.green, 3.5, 10, 1.2);
  green.position.set(3.4, -0.5, 3);
  const key = new THREE.DirectionalLight('#ffffff', 1.7);
  key.position.set(0.5, 3, 4);
  scene.add(pink, green, key, new THREE.HemisphereLight('#ffffff', '#2a2a2a', 0.55));
  return {scene, pink, green, key};
}

/* ------------------------------------------------------------------ */
/* en vivo                                                             */
/* ------------------------------------------------------------------ */

export function mount(root, opts) {
  live(
    root,
    (renderer) => {
      const {scene, pink, green} = night(renderer);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0.1, 4.6);
      camera.lookAt(0, 0, 0);
      const mesh = new THREE.Mesh(logoGeometry(), chrome());
      const pivot = new THREE.Group();
      pivot.add(mesh);
      scene.add(pivot);
      // estrellas que flotan y titilan alrededor
      const sgeo = starGeometry();
      const stars = [];
      const spots = [[-1.55, 0.95, -0.6, 0.22], [1.7, 0.8, -0.4, 0.16], [1.45, -0.95, -0.8, 0.2], [-1.75, -0.7, -0.3, 0.13], [0.2, 1.25, -1.1, 0.12]];
      spots.forEach(([x, y, z, s], i) => {
        const m = new THREE.Mesh(sgeo, new THREE.MeshPhysicalMaterial({color: i % 2 ? AISH.pink : AISH.green, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color(i % 2 ? AISH.pink : AISH.green), emissiveIntensity: 0.25}));
        m.position.set(x, y, z);
        m.scale.setScalar(s);
        scene.add(m);
        stars.push(m);
      });
      let flash = 0;
      return {
        scene,
        camera,
        pivot,
        mesh,
        setWay() {},
        poke() {
          flash = 1;
        },
        update(t, dt) {
          // un toque: las luces destellan como un flash de la pista
          flash *= Math.exp(-dt * 5);
          pink.intensity = 3.5 + flash * 16;
          green.intensity = 3.5 + flash * 16;
          stars.forEach((m, i) => {
            m.rotation.z = t * (0.3 + i * 0.07);
            m.scale.setScalar(spots[i][3] * (0.85 + 0.15 * Math.sin(t * 2.2 + i * 1.7) + flash * 0.5));
          });
        },
      };
    },
    opts,
  );
}

/* ------------------------------------------------------------------ */
/* escenas fijas                                                       */
/* ------------------------------------------------------------------ */

/** cromo: el logo espejado con las luces de la pista */
function cromo(renderer, w, h) {
  const {scene} = night(renderer, {env: 1.2});
  const m = new THREE.Mesh(logoGeometry({depth: 80, bevel: 9}), chrome());
  m.rotation.set(-0.12, -0.32, 0.05);
  scene.add(m);
  const sgeo = starGeometry();
  [[-1.5, 0.85, -0.5, 0.24, AISH.green], [1.62, -0.78, -0.4, 0.2, AISH.pink], [1.25, 0.95, -1.2, 0.12, '#ffffff']].forEach(([x, y, z, s, c]) => {
    const st = new THREE.Mesh(sgeo, new THREE.MeshPhysicalMaterial({color: c, roughness: 0.2, clearcoat: 1, emissive: new THREE.Color(c), emissiveIntensity: 0.3}));
    st.position.set(x, y, z);
    st.scale.setScalar(s);
    st.rotation.z = 0.3;
    scene.add(st);
  });
  const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
  camera.position.set(0.15, 0.2, 4.6);
  camera.lookAt(0, 0, 0);
  return shot(renderer, scene, camera);
}

/** detalle: el cromo de cerca, rasante, con los neones reflejados en las letras */
function detalle(renderer, w, h) {
  const {scene} = night(renderer, {env: 1.3});
  const m = new THREE.Mesh(logoGeometry({depth: 80, bevel: 9}), chrome());
  m.rotation.set(-0.08, -0.62, 0.05);
  scene.add(m);
  const camera = new THREE.PerspectiveCamera(26, w / h, 0.05, 50);
  camera.position.set(-0.2, 0.06, 1.75);
  camera.lookAt(-0.32, 0.04, 0);
  return shot(renderer, scene, camera);
}

/** bola: una bola de espejos con los colores de la fiesta */
function bola(renderer, w, h) {
  const {scene} = night(renderer, {env: 1.3, sparkles: true});
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 88, 44), new THREE.MeshStandardMaterial({color: '#e2e2e6', metalness: 1, roughness: 0.16, flatShading: true}));
  scene.add(ball);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3, 8), new THREE.MeshStandardMaterial({color: '#555', metalness: 1, roughness: 0.4}));
  cable.position.y = 2.5;
  scene.add(cable);
  // destellos: estrellitas planas que brillan alrededor
  const sgeo = starGeometry(0.01);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const c = [AISH.green, AISH.pink, '#ffffff'][i % 3];
    const st = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({color: c}));
    const a = rnd() * Math.PI * 2, r = 1.5 + rnd() * 1.6;
    st.position.set(Math.cos(a) * r * 1.4, Math.sin(a) * r * 0.75, -0.5 - rnd() * 1.5);
    st.scale.setScalar(0.04 + rnd() * 0.08);
    scene.add(st);
  }
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(0, -0.15, 5);
  camera.lookAt(0, 0.05, 0);
  return shot(renderer, scene, camera);
}

/** estrellas: un cielo de las estrellas del logo, en los colores de la fiesta */
function estrellas(renderer, w, h) {
  const {scene} = night(renderer, {env: 0.5});
  const sgeo = starGeometry(0.1);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const colors = [AISH.green, AISH.pink, AISH.yellow, AISH.orange, '#f2f2f2'];
  for (let i = 0; i < 60; i++) {
    const c = colors[i % colors.length];
    const st = new THREE.Mesh(sgeo, new THREE.MeshPhysicalMaterial({color: c, roughness: 0.28, clearcoat: 1, emissive: new THREE.Color(c), emissiveIntensity: 0.12}));
    st.position.set((rnd() - 0.5) * 7.5, (rnd() - 0.5) * 4.2, -rnd() * 4);
    st.rotation.set((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, rnd() * Math.PI);
    st.scale.setScalar(0.18 + rnd() * 0.45);
    scene.add(st);
  }
  const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 50);
  camera.position.set(0, 0, 4.2);
  return shot(renderer, scene, camera);
}

/** héroe: el logo en cromo como arranca el visor en vivo (es su póster) */
function hero(renderer, w, h) {
  const {scene} = night(renderer);
  const m = new THREE.Mesh(logoGeometry(), chrome());
  scene.add(m);
  const sgeo = starGeometry();
  [[-1.55, 0.95, -0.6, 0.22, AISH.green], [1.7, 0.8, -0.4, 0.16, AISH.pink], [1.45, -0.95, -0.8, 0.2, AISH.green], [-1.75, -0.7, -0.3, 0.13, AISH.pink], [0.2, 1.25, -1.1, 0.12, AISH.green]].forEach(([x, y, z, s, c]) => {
    const st = new THREE.Mesh(sgeo, new THREE.MeshPhysicalMaterial({color: c, roughness: 0.25, clearcoat: 1, emissive: new THREE.Color(c), emissiveIntensity: 0.25}));
    st.position.set(x, y, z);
    st.scale.setScalar(s);
    scene.add(st);
  });
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(0, 0.1, 4.6);
  camera.lookAt(0, 0, 0);
  return shot(renderer, scene, camera);
}

/** revisión: de costado, para ver que los bordes no tengan astillas (no va a la galería) */
function costado(renderer, w, h) {
  const {scene} = night(renderer);
  const m = new THREE.Mesh(logoGeometry(), chrome());
  m.rotation.set(0.15, -0.95, 0);
  scene.add(m);
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  camera.position.set(0, 0.1, 3.4);
  camera.lookAt(0, 0, 0);
  return shot(renderer, scene, camera);
}

/** revisión: la estrella de arriba bien de cerca (no va a la galería) */
function puntas(renderer, w, h) {
  const {scene} = night(renderer);
  const m = new THREE.Mesh(logoGeometry(), chrome());
  m.rotation.set(0.1, -0.35, 0);
  scene.add(m);
  const camera = new THREE.PerspectiveCamera(20, w / h, 0.02, 50);
  camera.position.set(0.95, 0.85, 1.1);
  camera.lookAt(0.62, 0.52, 0);
  return shot(renderer, scene, camera);
}

const PRESETS = {hero, cromo, detalle, bola, estrellas, costado, puntas};

/** una escena fija en PNG (data URL), para tools/render3d.mjs */
export const renderStill = (preset, w, h) => still(PRESETS[preset], w, h);
