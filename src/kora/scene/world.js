// Copiado de exploraciones/kora-ascii/src/world.js con tools/kora/sync.mjs: no editar acá.
// The shrine: a stone path running from Kora back under a vermilion torii, steps up to a hall with a green copper roof,
// stone lanterns, red maples and gold ginkgo, cypresses, and Fuji behind as a woodblock print draws it. The sky, the
// sun, the moon, the clouds, the lanterns and the falling leaves (fireflies at night) follow the time of day (uDay).
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DAY_GLSL, LIGHT_GLSL, TAG, U, rand, rr, sstep, tagged, vnoise} from './common.js';
import {emptyStrands, strandMesh} from './strands.js';

// a hex colour as a linear GLSL vec3
const G = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};
// The sky by elevation (degrees) for the hour: a woodblock bokashi from a pale horizon up to deep Prussian blue by
// day, gold through coral and rose to violet at dusk, ink blue at night. Needs DAY_GLSL.
const SKY_AT = /* glsl */ `
vec3 skyAt(float el) {
  vec3 day = mix(${G('#f4dfb4')}, ${G('#9cc8e2')}, smoothstep(0.0, 4.5, el));
  day = mix(day, ${G('#2f80c2')}, smoothstep(3.5, 15.0, el));
  day = mix(day, ${G('#0a3a86')}, smoothstep(13.0, 36.0, el));
  vec3 dusk = mix(${G('#ffc66a')}, ${G('#ff8f52')}, smoothstep(0.0, 5.0, el));
  dusk = mix(dusk, ${G('#ef7a8c')}, smoothstep(5.0, 15.0, el));
  dusk = mix(dusk, ${G('#9a6ac2')}, smoothstep(13.0, 29.0, el));
  dusk = mix(dusk, ${G('#4a3a98')}, smoothstep(25.0, 46.0, el));
  vec3 night = mix(${G('#2c3a76')}, ${G('#121c50')}, smoothstep(0.0, 8.0, el));
  night = mix(night, ${G('#050a22')}, smoothstep(7.0, 32.0, el));
  return byTime(day, dusk, night);
}`;

export const WC = {
  vermilion: new THREE.Color('#d9381c'),
  torijiTop: new THREE.Color('#1c1a1a'),
  stone: new THREE.Color('#8e8b84'),
  stoneDark: new THREE.Color('#615f5a'),
  grass: new THREE.Color('#4f8f34'),
  grassDry: new THREE.Color('#93ad46'),
  ground: new THREE.Color('#3f6f1f'),
  maple: [new THREE.Color('#b8321e'), new THREE.Color('#cc4a26'), new THREE.Color('#8f2416'), new THREE.Color('#d9662e')],
  ginkgo: [new THREE.Color('#e3b81f'), new THREE.Color('#f0cc3a'), new THREE.Color('#c99a12')],
  cypress: [new THREE.Color('#1f6236'), new THREE.Color('#2a7a45'), new THREE.Color('#174d2a')],
  trunk: new THREE.Color('#3a2a20'),
  wall: new THREE.Color('#ece6d8'),
  wood: new THREE.Color('#6a3a22'),
  roof: new THREE.Color('#3f7a62'),
};

function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = color.r;
    a[i * 3 + 1] = color.g;
    a[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const box = (w, h, d, x, y, z, color, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateZ(rz);
  g.rotateY(ry);
  g.translate(x, y, z);
  return colored(g, color);
};
const cyl = (rt, rb, h, x, y, z, color, seg = 16) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y + h / 2, z);
  return colored(g, color);
};
const mat = (opts = {}, extra, tag = TAG.world) => tagged(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.85, ...opts}), tag, extra || {});

// Many copies of one small mesh, each with its own transform and colour, written straight into one geometry.
function scatterGeo(template, items) {
  const t = template.index ? template.toNonIndexed() : template;
  const tp = t.attributes.position.array, tn = t.attributes.normal.array, nv = tp.length / 3;
  const P = new Float32Array(items.length * nv * 3), N = new Float32Array(items.length * nv * 3), C = new Float32Array(items.length * nv * 3);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  items.forEach((it, k) => {
    nm.getNormalMatrix(it.m);
    for (let i = 0; i < nv; i++) {
      const o = (k * nv + i) * 3;
      v.set(tp[i * 3], tp[i * 3 + 1], tp[i * 3 + 2]).applyMatrix4(it.m);
      P[o] = v.x; P[o + 1] = v.y; P[o + 2] = v.z;
      v.set(tn[i * 3], tn[i * 3 + 1], tn[i * 3 + 2]).applyMatrix3(nm).normalize();
      N[o] = v.x; N[o + 1] = v.y; N[o + 2] = v.z;
      C[o] = it.c.r; C[o + 1] = it.c.g; C[o + 2] = it.c.b;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(items.length * nv * 2), 2));
  return g;
}
const CLUMP = new THREE.IcosahedronGeometry(1, 0);
// A canopy of many small faceted clumps, denser and darker inside, lumpy at the edge.
function canopyItems(items, cx, cy, cz, rx, ry, rz, n, palette, size) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = rand() * Math.PI * 2, v = Math.acos(rr(-0.75, 1)), r = 0.45 + 0.55 * Math.sqrt(rand());
    p.set(cx + Math.cos(u) * Math.sin(v) * rx * r, cy + Math.cos(v) * ry * r, cz + Math.sin(u) * Math.sin(v) * rz * r);
    const k = size * rr(0.65, 1.2);
    s.set(k, k * rr(0.7, 0.95), k);
    q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3));
    items.push({m: m.clone().compose(p, q, s), c: palette[Math.floor(rand() * palette.length)].clone().multiplyScalar((0.55 + 0.55 * r) * rr(0.85, 1.1))});
  }
}
// trunk plus a few branches reaching into the canopy
function trunkGeos(x, y0, z, h, r) {
  const out = [];
  const t = new THREE.CylinderGeometry(r * 0.65, r, h, 9, 4);
  t.translate(x, y0 + h / 2, z);
  out.push(colored(t, WC.trunk));
  const nb = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + rr(-0.4, 0.4), L = h * rr(0.45, 0.7);
    const b = new THREE.CylinderGeometry(r * 0.25, r * 0.45, L, 6);
    b.translate(0, L / 2, 0);
    b.rotateZ(rr(0.6, 1.0));
    b.rotateY(a);
    b.translate(x, y0 + h * rr(0.55, 0.85), z);
    out.push(colored(b, WC.trunk));
  }
  return out;
}

// height of the ground at (x, z): flat around the path and the shrine terrace, rolling beyond
export function groundY(x, z) {
  const flat = sstep(7, 18, Math.hypot(x, Math.max(0, Math.abs(z + 8) - 13)));
  return flat * (Math.sin(x * 0.11) * 1.4 + Math.cos(z * 0.09 + x * 0.05) * 1.8 + vnoise(x * 0.05, 0, z * 0.05) * 3) - 0.02;
}

export function buildWorld(scene) {
  const updates = [];

  // ---------- sky: the woodblock gradient for the hour, the sun, stars, and the moon on Fuji (tag sky: no glyphs) ----------
  // Colours follow kshv.me's day / dusk / night stops; elevations are in degrees above the horizon.
  const peak = new THREE.Vector2(0, 25); // azimuth and elevation of Fuji's summit from the camera, set every frame
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {uDay: U.uDay, uTime: U.uTime, uPeak: {value: peak}},
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `${DAY_GLSL}
        uniform float uTime; uniform vec2 uPeak; varying vec3 vD;
        const float DEG = 57.29578;
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
        ${SKY_AT}
        void main(){
          vec3 dir = normalize(vD);
          float el = asin(clamp(dir.y, -1.0, 1.0)) * DEG;
          float az = atan(dir.x, -dir.z) * DEG;
          vec3 col = skyAt(max(el, 0.0));
          // stars, once it's dark enough to see them
          vec2 sc = vec2(az, el) * 1.15;
          float seed = h2(floor(sc));
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + seed * 3.0) + seed * 40.0);
          col += step(0.955, seed) * smoothstep(0.24, 0.04, length(fract(sc) - 0.5)) * tw * 1.6 * smoothstep(0.68, 0.95, uDay) * smoothstep(1.5, 9.0, el);
          // the sun: high and out of frame at midday, low and huge to the right of Fuji at dusk, gone at night
          float sunEl = byTimeF(52.0, 17.0, -9.0);
          float r = length(vec2(az - 16.0, el - sunEl)) / 2.9;
          col += byTime(${G('#fff0c8')}, ${G('#ff8a3a')}, vec3(0.0)) * smoothstep(4.0, 0.9, r) * 0.32;
          if (r < 1.02) {
            vec3 face = mix(byTime(${G('#fff4cc')}, ${G('#ffd27a')}, ${G('#ffd27a')}), byTime(${G('#fff4c4')}, ${G('#ff6a1f')}, ${G('#ff6a1f')}), smoothstep(0.05, 1.0, r));
            col = mix(col, face * byTimeF(1.6, 1.2, 1.2), smoothstep(1.02, 0.98, r));
          }
          // the moon comes up behind Fuji and sits on the summit: "pearl Fuji"
          float up = smoothstep(0.62, 0.95, uDay);
          float mR = 2.3;
          vec2 mq = vec2(az - uPeak.x, el - (uPeak.y - mR * 1.8 + mR * 2.75 * up)) / mR;
          float mr = length(mq);
          col += ${G('#9fb6ff')} * smoothstep(3.6, 1.0, mr) * 0.16 * smoothstep(0.55, 0.8, uDay);
          if (mr < 1.02) {
            float maria = n2(mq * 2.6 + 11.0) * 0.6 + n2(mq * 5.3 + 3.0) * 0.4;
            vec3 face = mix(${G('#c9cfd8')}, ${G('#fff6dc')}, smoothstep(0.32, 0.62, maria)) * 1.5;
            col = mix(col, face, smoothstep(1.02, 0.96, mr) * smoothstep(0.55, 0.8, uDay));
          }
          gl_FragColor = vec4(col, ${TAG.sky.toFixed(3)});
        }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---------- ground ----------
  const ground = new THREE.Mesh(
    (() => {
      const g = new THREE.PlaneGeometry(260, 260, 120, 120);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      const c = new Float32Array(p.count * 3), col = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        p.setY(i, groundY(x, z));
        const n = vnoise(x * 0.35, 1, z * 0.35);
        col.copy(WC.ground).lerp(WC.grassDry, n * 0.35);
        c.set([col.r, col.g, col.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.computeVertexNormals();
      return g;
    })(),
    mat({roughness: 1}, {detail: 4}, TAG.grass),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- stone path, steps, terrace ----------
  const stones = [];
  for (let z = 9.0; z > -8.2; z -= 0.62) {
    let x = -0.78;
    while (x < 0.78) {
      const w = rr(0.36, 0.62);
      const ww = Math.min(w, 0.8 - x);
      const col = WC.stone.clone().lerp(WC.stoneDark, rand() * 0.6);
      stones.push(box(ww - 0.05, 0.06 + rr(0, 0.02), 0.55, x + ww / 2, 0.01, z + rr(-0.02, 0.02), col, rr(-0.04, 0.04)));
      x += w;
    }
  }
  // steps up to the terrace, between two stepped side walls
  const STEP_H = 0.17, STEP_D = 0.42, N_STEPS = 8, STEP_Z0 = -8.6;
  for (let i = 0; i < N_STEPS; i++) {
    const col = WC.stone.clone().lerp(WC.stoneDark, (i % 2) * 0.35 + rand() * 0.2);
    stones.push(box(2.6, STEP_H * (i + 1), STEP_D, 0, (STEP_H * (i + 1)) / 2, STEP_Z0 - i * STEP_D, col));
    stones.push(box(0.4, STEP_H * (i + 1) + 0.22, STEP_D, -1.5, (STEP_H * (i + 1) + 0.22) / 2, STEP_Z0 - i * STEP_D, WC.stoneDark));
    stones.push(box(0.4, STEP_H * (i + 1) + 0.22, STEP_D, 1.5, (STEP_H * (i + 1) + 0.22) / 2, STEP_Z0 - i * STEP_D, WC.stoneDark));
  }
  const TERR_Y = STEP_H * N_STEPS, TERR_Z = STEP_Z0 - N_STEPS * STEP_D;
  stones.push(box(14, TERR_Y, 9, 0, TERR_Y / 2, TERR_Z - 4.3, WC.stoneDark.clone().lerp(WC.stone, 0.3)));
  // a low stone wall along the front edge of the terrace
  for (const s of [-1, 1]) stones.push(box(5.4, 0.35, 0.35, s * 4.4, TERR_Y + 0.17, TERR_Z + 0.1, WC.stone));
  const path = new THREE.Mesh(mergeGeometries(stones), mat({roughness: 0.95}, {detail: 1}, TAG.stone));
  path.receiveShadow = true;
  path.castShadow = true;
  scene.add(path);

  // ---------- torii: curved kasagi, shimaki, nuki through the posts, wedges, plaque ----------
  const tz = -7.6; // at the foot of the steps, far enough back that Fuji's cap rises clear above it
  const bent = (w, h, d, y, color, lift) => {
    const g = new THREE.BoxGeometry(w, h, d, 32, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (w / 2);
      p.setY(i, p.getY(i) + lift * Math.pow(Math.abs(u), 3.2));
    }
    g.computeVertexNormals();
    g.translate(0, y, tz);
    return colored(g, color);
  };
  const torii = [
    cyl(0.12, 0.14, 3.2, -1.3, 0, tz, WC.vermilion, 20),
    cyl(0.12, 0.14, 3.2, 1.3, 0, tz, WC.vermilion, 20),
    cyl(0.18, 0.18, 0.34, -1.3, 0, tz, WC.torijiTop, 20),
    cyl(0.18, 0.18, 0.34, 1.3, 0, tz, WC.torijiTop, 20),
    cyl(0.26, 0.3, 0.12, -1.3, -0.04, tz, WC.stoneDark, 16),
    cyl(0.26, 0.3, 0.12, 1.3, -0.04, tz, WC.stoneDark, 16),
    box(3.7, 0.16, 0.16, 0, 2.55, tz, WC.vermilion), // nuki, ends past the posts
    ...[-1, 1].map((s) => box(0.1, 0.2, 0.22, s * 1.48, 2.55, tz, WC.vermilion)), // kusabi wedges
    box(0.16, 0.5, 0.16, 0, 2.85, tz, WC.vermilion), // gakuzuka
    box(0.5, 0.62, 0.06, 0, 2.86, tz + 0.1, WC.torijiTop), // plaque
    box(0.38, 0.48, 0.07, 0, 2.86, tz + 0.1, new THREE.Color('#c9a54a')),
    bent(3.9, 0.16, 0.28, 3.15, WC.vermilion, 0.08), // shimaki
    bent(4.5, 0.2, 0.34, 3.32, WC.vermilion, 0.2), // kasagi
    bent(4.7, 0.1, 0.4, 3.46, WC.torijiTop, 0.24), // black cap
  ];
  const toriiMesh = new THREE.Mesh(mergeGeometries(torii), mat({roughness: 0.55}, {detail: 2}, TAG.wood));
  toriiMesh.castShadow = true;
  scene.add(toriiMesh);

  // ---------- stone lanterns (kasuga style, hexagonal) ----------
  const hex = (r1, r2, h, x, y, z, c) => {
    const g = new THREE.CylinderGeometry(r1, r2, h, 6);
    g.rotateY(Math.PI / 6);
    g.translate(x, y + h / 2, z);
    return colored(g, c);
  };
  const lantern = (x, y, z) => {
    const s = WC.stone.clone().lerp(WC.stoneDark, rand() * 0.4);
    const out = [
      hex(0.3, 0.34, 0.12, x, y, z, s), // kiso
      hex(0.22, 0.28, 0.08, x, y + 0.12, z, s),
      cyl(0.075, 0.09, 0.56, x, y + 0.2, z, s, 12), // sao
      cyl(0.1, 0.1, 0.05, x, y + 0.45, z, s, 12), // ring
      hex(0.28, 0.16, 0.1, x, y + 0.76, z, s), // chudai
      hex(0.13, 0.13, 0.26, x, y + 0.86, z, new THREE.Color('#2a2622')), // dark firebox core
    ];
    for (let k = 0; k < 6; k++) {
      // corner posts of the firebox: the gaps read as windows
      const a = (k / 6) * Math.PI * 2;
      out.push(box(0.05, 0.26, 0.05, x + Math.cos(a) * 0.17, y + 0.99, z + Math.sin(a) * 0.17, s));
      // upturned corners of the roof
      const g = new THREE.ConeGeometry(0.035, 0.12, 5);
      g.rotateZ(-0.9);
      g.rotateY(-a);
      g.translate(x + Math.cos(a) * 0.38, y + 1.17, z + Math.sin(a) * 0.38);
      out.push(colored(g, s));
    }
    out.push(hex(0.17, 0.17, 0.04, x, y + 1.11, z, s));
    const roof = new THREE.ConeGeometry(0.4, 0.24, 6);
    roof.rotateY(Math.PI / 6);
    roof.translate(x, y + 1.27, z);
    out.push(colored(roof, s));
    const bud = new THREE.SphereGeometry(0.065, 10, 8);
    bud.scale(1, 1.25, 1);
    bud.translate(x, y + 1.46, z);
    out.push(colored(bud, s));
    return out;
  };
  const LANTERNS = [...[-1.9, -5.0].flatMap((z) => [-1.6, 1.6].map((x) => [x, 0, z])), [-2.4, TERR_Y, TERR_Z - 1.0], [2.4, TERR_Y, TERR_Z - 1.0]];
  const lanternMesh = new THREE.Mesh(mergeGeometries(LANTERNS.flatMap(([x, y, z]) => lantern(x, y, z))), mat({roughness: 0.95}, {detail: 1}, TAG.stone));
  lanternMesh.castShadow = true;
  scene.add(lanternMesh);
  // the fire inside: dark by day, lit as night comes, with a real light at each lantern on the path
  const glowMat = tagged(new THREE.MeshBasicMaterial({color: '#2a2622'}), TAG.world);
  const glow = new THREE.Mesh(mergeGeometries(LANTERNS.map(([x, y, z]) => new THREE.CylinderGeometry(0.11, 0.11, 0.18, 6).translate(x, y + 0.99, z))), glowMat);
  scene.add(glow);
  const lampLights = LANTERNS.slice(0, 4).map(([x, y, z]) => {
    const l = new THREE.PointLight('#ffad5c', 0, 7, 2);
    l.position.set(x, y + 1.0, z);
    scene.add(l);
    return l;
  });

  // ---------- shrine hall ----------
  const hz = TERR_Z - 4.6, HY = TERR_Y;
  const hall = [
    box(5.6, 0.4, 3.9, 0, HY + 0.2, hz, WC.stoneDark), // podium
    box(4.6, 1.9, 3.0, 0, HY + 1.35, hz, WC.wall),
    ...[-2.25, -1.12, 0, 1.12, 2.25].flatMap((x) => [box(0.16, 2.1, 0.16, x, HY + 1.45, hz + 1.55, WC.wood), box(0.16, 2.1, 0.16, x, HY + 1.45, hz - 1.55, WC.wood)]),
    box(4.9, 0.18, 0.2, 0, HY + 2.42, hz + 1.55, WC.wood),
    box(4.9, 0.12, 0.18, 0, HY + 0.62, hz + 1.55, WC.wood),
    // lattice bars over the doors (the doors themselves are their own mesh below, so they can glow at night)
    ...[-1.68, -0.56, 0.56, 1.68].flatMap((x) => [-0.3, 0, 0.3].map((dx) => box(0.03, 1.4, 0.05, x + dx, HY + 1.32, hz + 1.55, WC.wood))),
    // veranda and railing
    box(5.4, 0.08, 0.7, 0, HY + 0.62, hz + 1.95, WC.wood),
    box(5.4, 0.06, 0.06, 0, HY + 1.05, hz + 2.28, WC.vermilion),
    ...Array.from({length: 13}, (_, i) => box(0.05, 0.42, 0.05, -2.6 + i * (5.2 / 12), HY + 0.85, hz + 2.28, WC.vermilion)),
    box(0.9, 0.45, 0.45, 0, HY + 0.62 + 0.22, hz + 2.75, WC.wood), // offering box
  ];
  const roofParts = [];
  const roofW = 6.6, roofD = 2.9, pitch = 0.5;
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(roofW, 0.2, roofD, 40, 1, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (roofW / 2), v = p.getZ(i) / (roofD / 2);
      // eaves sweep up at the corners and along the lower edge
      p.setY(i, p.getY(i) + 0.28 * Math.pow(Math.abs(u), 4) * (0.5 + 0.5 * v * s) + 0.12 * Math.max(0, v * s) ** 2);
    }
    g.computeVertexNormals();
    g.rotateX(s * pitch);
    g.translate(0, HY + 3.05, hz + s * roofD * 0.42);
    roofParts.push(colored(g, WC.roof));
  }
  const ridgeY = HY + 3.7;
  const ornaments = [box(roofW + 0.3, 0.26, 0.34, 0, ridgeY, hz, WC.roof.clone().multiplyScalar(0.55))];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.55, 10);
    g.rotateX(Math.PI / 2);
    g.translate(-2.0 + i, ridgeY + 0.2, hz);
    ornaments.push(colored(g, new THREE.Color('#c9a54a'))); // katsuogi
  }
  for (const sx of [-1, 1]) for (const r of [-1, 1]) ornaments.push(box(0.1, 1.0, 0.06, sx * (roofW / 2 + 0.05) + r * 0.15, ridgeY + 0.35, hz, WC.roof.clone().multiplyScalar(0.55), 0, r * 0.55)); // chigi
  // shimenawa: a thick straw rope across the front with zigzag paper streamers
  const rope = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-2.3, HY + 2.3, hz + 1.75), new THREE.Vector3(0, HY + 2.05, hz + 1.8), new THREE.Vector3(2.3, HY + 2.3, hz + 1.75)]), 30, 0.09, 8);
  const ropeParts = [colored(rope, new THREE.Color('#d9c48a'))];
  for (const x of [-1.5, -0.5, 0.5, 1.5]) for (let k = 0; k < 4; k++) ropeParts.push(box(0.12, 0.1, 0.01, x + (k % 2 ? 0.05 : -0.05), HY + 2.0 - k * 0.1 - Math.abs(x) * 0.05, hz + 1.82, new THREE.Color('#ffffff')));
  const hallMesh = new THREE.Mesh(mergeGeometries(hall), mat({roughness: 0.7}, {detail: 2}, TAG.wood));
  const roofMesh = new THREE.Mesh(mergeGeometries([...roofParts, ...ornaments]), mat({roughness: 0.6}, {detail: 3}, TAG.wood));
  const ropeMesh = new THREE.Mesh(mergeGeometries(ropeParts), mat({roughness: 0.9}, {}, TAG.world));
  for (const m of [hallMesh, roofMesh, ropeMesh]) {
    m.castShadow = true;
    scene.add(m);
  }
  // paper doors behind the lattice: dark wood by day, lamplight from inside at night
  const doorMat = mat({roughness: 0.9, emissive: new THREE.Color('#ff9a3c'), emissiveIntensity: 0}, {}, TAG.wood);
  scene.add(new THREE.Mesh(mergeGeometries([-1.68, -0.56, 0.56, 1.68].map((x) => box(0.92, 1.4, 0.04, x, HY + 1.32, hz + 1.52, new THREE.Color('#2a1d16')))), doorMat));

  // ---------- trees ----------
  const leafItems = [], trunks = [];
  // trees frame the sides and stay low, so the sky and Fuji stay open above the torii
  const maples = [[-7.8, -9.5, 1.0], [7.6, -10.5, 0.95], [9.5, -15, 1.1], [-6.8, -3.2, 0.8]];
  for (const [x, z, s] of maples) {
    trunks.push(...trunkGeos(x, groundY(x, z), z, 2.4 * s, 0.14 * s));
    canopyItems(leafItems, x, groundY(x, z) + 2.9 * s, z, 1.9 * s, 1.05 * s, 1.7 * s, 340, WC.maple, 0.26 * s);
  }
  const ginkgos = [[-9.5, -5.0, 1.0], [8.8, -5.5, 0.95], [-11.5, -15, 1.1]];
  for (const [x, z, s] of ginkgos) {
    trunks.push(...trunkGeos(x, groundY(x, z), z, 3.0 * s, 0.16 * s));
    canopyItems(leafItems, x, groundY(x, z) + 3.6 * s, z, 1.6 * s, 1.7 * s, 1.5 * s, 380, WC.ginkgo, 0.24 * s);
  }
  const leafMesh = new THREE.Mesh(scatterGeo(CLUMP, leafItems), mat({roughness: 0.8, flatShading: true}, {sway: 0.03, swayBase: 1.2, detail: 5}, TAG.foliage));
  leafMesh.castShadow = true;
  scene.add(leafMesh);
  const trunkMesh = new THREE.Mesh(mergeGeometries(trunks), mat({roughness: 1}, {detail: 6}, TAG.wood));
  trunkMesh.castShadow = true;
  scene.add(trunkMesh);

  // forest around the clearing, so the wide view is full
  const forest = [], forestTrunks = [], forestLeaves = [];
  for (let i = 0; i < 46; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * rr(7.5, 30), z = rr(-40, 6);
    if (Math.abs(x) < 9 && z > -2) continue;
    const s = rr(0.9, 1.6), y = groundY(x, z);
    const kind = rand();
    if (kind < 0.4) {
      for (let k = 0; k < 3; k++) {
        const g = new THREE.ConeGeometry(s * 1.3 * (1 - k * 0.2), s * 3.2, 9);
        g.translate(x, y + s * (1.8 + k * 1.2), z);
        forest.push(colored(g, WC.cypress[(i + k) % 3]));
      }
    } else {
      const pal = kind < 0.72 ? WC.maple : kind < 0.88 ? WC.ginkgo : WC.cypress;
      forestTrunks.push(...trunkGeos(x, y, z, 2.2 * s, 0.13 * s));
      canopyItems(forestLeaves, x, y + 2.8 * s, z, 1.7 * s, 1.1 * s, 1.6 * s, 160, pal, 0.3 * s);
    }
  }
  scene.add(new THREE.Mesh(mergeGeometries(forest), mat({roughness: 0.85}, {sway: 0.02, swayBase: 1.0, detail: 5}, TAG.foliage)));
  scene.add(new THREE.Mesh(scatterGeo(CLUMP, forestLeaves), mat({roughness: 0.85, flatShading: true}, {sway: 0.02, swayBase: 1.0, detail: 5}, TAG.foliage)));
  scene.add(new THREE.Mesh(mergeGeometries(forestTrunks), mat({roughness: 1}, {detail: 6}, TAG.wood)));

  // five-storey pagoda on the left, above the trees
  const pag = [], px = -11, pz = -19, py = groundY(px, pz);
  pag.push(box(3.2, 0.5, 3.2, px, py + 0.25, pz, WC.stoneDark));
  for (let k = 0; k < 5; k++) {
    const w = 2.3 - k * 0.3, y0 = py + 0.5 + k * 1.45;
    pag.push(box(w, 1.0, w, px, y0 + 0.5, pz, WC.vermilion.clone().multiplyScalar(0.92)));
    const r = new THREE.ConeGeometry((w + 1.4) * 0.72, 0.55, 4);
    r.rotateY(Math.PI / 4);
    r.translate(px, y0 + 1.25, pz);
    pag.push(colored(r, new THREE.Color('#2b2a2e')));
  }
  pag.push(cyl(0.05, 0.08, 1.8, px, py + 7.7, pz, new THREE.Color('#b08a3a'), 6));
  const pagoda = new THREE.Mesh(mergeGeometries(pag), mat({roughness: 0.7}, {detail: 2}, TAG.wood));
  pagoda.castShadow = true;
  scene.add(pagoda);

  // cypresses behind the hall
  const cyp = [];
  for (const [x, z, h] of [[-5.6, TERR_Z - 6, 4.2], [-7.6, TERR_Z - 8.5, 4.8], [5.8, TERR_Z - 6.5, 4.0], [7.8, TERR_Z - 9, 4.6], [-9.8, TERR_Z - 4, 3.8], [10.2, TERR_Z - 4.5, 3.6]]) {
    for (let k = 0; k < 4; k++) {
      const g = new THREE.ConeGeometry(h * 0.16 * (1 - k * 0.15), h * (0.5 - k * 0.06), 10);
      g.translate(x + rr(-0.1, 0.1), TERR_Y + h * (0.3 + k * 0.17), z);
      cyp.push(colored(g, WC.cypress[k % 3]));
    }
  }
  const cypMesh = new THREE.Mesh(mergeGeometries(cyp), mat({roughness: 0.9}, {sway: 0.012, swayBase: TERR_Y + 2, detail: 5}, TAG.foliage));
  scene.add(cypMesh);

  // ---------- far: hills, Fuji, clouds ----------
  const far = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.SphereGeometry(1, 16, 10);
    const r = rr(18, 40);
    g.scale(r, r * rr(0.25, 0.45), r);
    g.translate(rr(-120, 120), -2, rr(-140, -60));
    far.push(colored(g, WC.cypress[i % 3].clone().lerp(new THREE.Color('#3d6e9a'), 0.25)));
  }
  const FUJI = {x: -12, z: -430, h: 212, r: 290};
  const fujiGeo = new THREE.CylinderGeometry(1, 1, FUJI.h, 120, 28, true);
  {
    // concave flanks rising to a flat, truncated summit: the crater rim, not a spike
    const p = fujiGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + FUJI.h / 2) / FUJI.h, u = 1 - t;
      const R = FUJI.r * (0.055 + 0.945 * (0.28 * u + 0.72 * Math.pow(u, 1.75)));
      const a = Math.atan2(p.getZ(i), p.getX(i));
      p.setX(i, Math.cos(a) * R);
      p.setZ(i, Math.sin(a) * R);
    }
    fujiGeo.translate(FUJI.x, FUJI.h / 2 - 2, FUJI.z);
    fujiGeo.computeVertexNormals();
  }
  // Fuji as a woodblock print draws it: Prussian blue rock, lighter toward the hazy foot, a white cap whose lower edge
  // breaks into long streaks down the gullies, the shaded side of the snow in pale blue. Rose at dusk (akafuji), ink
  // blue at night. Painted per pixel from the world position, so the streaks stay crisp at any size.
  const fuji = new THREE.Mesh(
    fujiGeo,
    new THREE.ShaderMaterial({
      uniforms: {uDay: U.uDay, uC: {value: new THREE.Vector3(FUJI.x, -2, FUJI.z)}, uH: {value: FUJI.h}},
      vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `${DAY_GLSL}
        uniform vec3 uC; uniform float uH; varying vec3 vW; varying vec3 vN;
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { return n2(p) * 0.55 + n2(p * 2.1 + 7.0) * 0.3 + n2(p * 4.3 + 3.0) * 0.15; }
        ${SKY_AT}
        void main(){
          vec3 d = vW - uC;
          float h = clamp(d.y / uH, 0.0, 1.0);
          float ang = atan(d.z, d.x);
          // the cap's ragged lower edge, and fingers of snow down the gullies: each at its own angle, running its own
          // length, narrowing as it goes
          float g = fbm(vec2(ang * 6.0, h * 1.5));
          float edge = 0.62 + (fbm(vec2(ang * 7.0, 2.0)) - 0.5) * 0.13;
          float aw = ang + (n2(vec2(h * 9.0, ang * 4.0)) - 0.5) * 0.045; // gullies wander a little
          float ridge = 1.0 - abs(n2(vec2(aw * 15.0 + 2.3, 4.0)) * 2.0 - 1.0);
          float reach = 0.2 * smoothstep(0.3, 0.95, n2(vec2(ang * 5.0 + 1.7, 9.0)));
          float below = clamp((edge - h) / max(reach, 1e-3), 0.0, 1.0);
          float facing = smoothstep(0.15, 0.45, abs(dot(normalize(vN), normalize(cameraPosition - vW))));
          float finger = smoothstep(0.8 + 0.18 * below, 0.86 + 0.135 * below, ridge) * (1.0 - step(0.999, below)) * facing;
          float snow = max(smoothstep(edge - 0.003, edge + 0.003, h), finger);
          // light from the left: the lit flank of rock and snow is paler
          float lit = dot(normalize(vN), normalize(vec3(-0.75, 0.25, 0.6))) * 0.5 + 0.5;
          vec3 rock = mix(${G('#3f74b2')}, ${G('#1b4680')}, smoothstep(0.05, 0.8, h)) * mix(0.82, 1.12, lit);
          vec3 ice = mix(${G('#7f9ccb')}, ${G('#ffffff')}, smoothstep(0.4, 0.6, lit + (g - 0.5) * 0.25));
          vec3 c = mix(rock, ice, snow) * byTime(vec3(1.0), ${G('#ffc0c8')}, ${G('#4a5c98')});
          // haze over the foot, the colour of the sky near the horizon
          c = mix(c, skyAt(1.5), smoothstep(0.42, 0.0, h) * 0.8);
          gl_FragColor = vec4(c, ${TAG.far.toFixed(3)});
        }`,
    }),
  );
  scene.add(fuji);
  scene.add(new THREE.Mesh(mergeGeometries(far), mat({roughness: 1}, undefined, TAG.far)));

  // Clouds as the prints draw them: flat, white on top, soft blue-grey underneath; peach at dusk, slate at night.
  const cloudGroup = new THREE.Group();
  const cloudParts = [];
  for (const [x, y, z, s] of [[-260, 70, -360, 1.3], [-185, 105, -345, 0.9], [205, 85, -360, 1.1], [285, 60, -330, 1.0]]) {
    for (let i = 0; i < 16; i++) {
      const g = new THREE.SphereGeometry(rr(14, 26) * s, 14, 10);
      g.scale(1.25, 0.8, 1);
      g.translate(x + rr(-40, 40) * s, y + rr(-6, 12) * s, z + rr(-12, 12));
      cloudParts.push(g.toNonIndexed());
    }
  }
  cloudGroup.add(
    new THREE.Mesh(
      mergeGeometries(cloudParts),
      new THREE.ShaderMaterial({
        uniforms: {uDay: U.uDay},
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `${DAY_GLSL}
          varying vec3 vN;
          void main(){
            vec3 n = normalize(vN);
            vec3 top = byTime(${G('#ffffff')}, ${G('#ffd6c0')} * 1.15, ${G('#3c4a86')});
            vec3 bot = byTime(${G('#aebfdc')}, ${G('#b9709a')}, ${G('#1b2456')});
            vec3 c = mix(bot, top, smoothstep(-0.25, 0.45, n.y + n.x * 0.25));
            gl_FragColor = vec4(c, ${TAG.far.toFixed(3)});
          }`,
      }),
    ),
  );
  scene.add(cloudGroup);
  updates.push((t) => (cloudGroup.position.x = Math.sin(t * 0.01) * 30 + t * 0.6 - 30));

  // ---------- koi pond, rocks and azaleas in the foreground ----------
  const POND = {x: -3.3, z: 3.1, rx: 1.55, rz: 1.15};
  const inPond = (x, z, m = 1) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < m;
  const water = new THREE.Mesh(
    (() => {
      const g = new THREE.CircleGeometry(1, 48);
      g.rotateX(-Math.PI / 2);
      g.scale(POND.rx, 1, POND.rz);
      g.translate(POND.x, groundY(POND.x, POND.z) + 0.03, POND.z);
      return g;
    })(),
    new THREE.ShaderMaterial({
      uniforms: {...U, uC: {value: new THREE.Vector2(POND.x, POND.z)}, uR: {value: new THREE.Vector2(POND.rx, POND.rz)}},
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${DAY_GLSL}
        uniform float uTime; uniform vec2 uC; uniform vec2 uR; varying vec3 vW;
        void main(){
          vec2 q = (vW.xz - uC) / uR;
          float edge = smoothstep(1.0, 0.75, length(q));
          vec3 deep = vec3(0.01, 0.07, 0.12), shallow = vec3(0.05, 0.22, 0.26);
          vec3 c = mix(shallow, deep, edge);
          float rip = sin(vW.x * 9.0 + uTime * 1.7) * sin(vW.z * 11.0 - uTime * 1.3) + sin((vW.x + vW.z) * 6.0 + uTime * 2.3) * 0.5;
          vec3 cameraDir = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(cameraDir.y, 0.0), 3.0);
          c += byTime(vec3(0.35, 0.55, 0.85), vec3(0.9, 0.42, 0.3), vec3(0.08, 0.11, 0.3)) * (0.18 + 0.5 * fres) * (0.85 + 0.15 * rip);
          // koi circling under the surface
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            float a = uTime * (0.25 + 0.06 * fi) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0) + fi * 1.7;
            vec2 k = vec2(cos(a), sin(a * 1.3)) * (0.35 + 0.08 * fi);
            vec2 dir = normalize(vec2(-sin(a), cos(a * 1.3) * 1.3)) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
            vec2 d = q - k;
            float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
            float body = smoothstep(1.0, 0.7, length(vec2(along / 0.16, across / 0.06)));
            vec3 kc = mod(fi, 3.0) < 1.0 ? vec3(1.0, 0.95, 0.9) : vec3(1.0, 0.32, 0.04);
            c = mix(c, kc * 0.9, body * 0.9);
          }
          gl_FragColor = vec4(c, ${TAG.water.toFixed(3)});
        }`,
    }),
  );
  scene.add(water);
  const rocks = [], bushes = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rr(-0.08, 0.08);
    const x = POND.x + Math.cos(a) * POND.rx * rr(1.0, 1.12), z = POND.z + Math.sin(a) * POND.rz * rr(1.0, 1.12);
    const g = new THREE.IcosahedronGeometry(rr(0.14, 0.26), 1);
    g.scale(1, rr(0.45, 0.7), 1);
    g.translate(x, groundY(x, z) + 0.05, z);
    rocks.push(colored(g, WC.stone.clone().lerp(WC.stoneDark, rand())));
  }
  const AZALEA = [new THREE.Color('#e0558f'), new THREE.Color('#c93a6e'), new THREE.Color('#f07aa8'), new THREE.Color('#d8344a')];
  const bush = (x, z, s) => {
    for (let k = 0; k < 6; k++) {
      const g = new THREE.IcosahedronGeometry(s * rr(0.14, 0.22), 1);
      g.scale(1, 0.75, 1);
      g.translate(x + rr(-0.25, 0.25) * s, groundY(x, z) + s * rr(0.12, 0.26), z + rr(-0.2, 0.2) * s);
      bushes.push(colored(g, (rand() < 0.9 ? AZALEA[Math.floor(rand() * 4)] : WC.cypress[1]).clone().multiplyScalar(rr(0.85, 1.1))));
    }
  };
  for (const z of [3.4, -4.2]) for (const x of [-2.3, 2.3]) if (!inPond(x, z, 1.6)) bush(x + rr(-0.2, 0.2), z + rr(-0.3, 0.3), rr(1.0, 1.4));
  for (const [x, z] of [[-5.2, 2.0], [-1.6, 4.6], [-4.6, 4.7], [3.8, 4.5], [4.4, 1.0], [-3.2, -1.6]]) bush(x, z, rr(1.1, 1.6));
  const rockMesh = new THREE.Mesh(mergeGeometries(rocks), mat({roughness: 0.95}, {detail: 1}, TAG.stone));
  rockMesh.castShadow = true;
  scene.add(rockMesh);
  const bushMesh = new THREE.Mesh(mergeGeometries(bushes), mat({roughness: 0.8}, {sway: 0.05, swayBase: 0, detail: 5}, TAG.foliage));
  bushMesh.castShadow = true;
  scene.add(bushMesh);

  // ---------- grass ----------
  const gd = emptyStrands();
  const col = new THREE.Color();
  const N_GRASS = 170000;
  for (let i = 0; i < N_GRASS; i++) {
    // denser around Kora and the path, thinner toward the edges of the view
    const k = rand();
    const x = k < 0.45 ? rr(-7, 7) : k < 0.8 ? rr(-16, 16) : rr(-34, 34);
    const z = k < 0.45 ? rr(-9, 10) : k < 0.8 ? rr(-24, 12) : rr(-45, 12);
    if (Math.abs(x) < 0.86 && z > -8.3 && z < 9.4) continue; // path
    if (inPond(x, z, 1.15)) continue;
    if (z < -8.3 && z > TERR_Z - 9 && Math.abs(x) < 7.2) continue; // steps and terrace
    const h = rr(0.07, 0.16) * (1 + 0.6 * vnoise(x * 0.6, 0, z * 0.6));
    const a = rr(0, Math.PI * 2);
    gd.root.push(x, groundY(x, z) + 0.01, z);
    gd.nrm.push(0, 1, 0);
    gd.flow.push(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
    col.copy(WC.grass).lerp(WC.grassDry, rand() * 0.6).multiplyScalar(rr(0.75, 1.15));
    gd.col.push(col.r, col.g, col.b, h);
    gd.phase.push(rand() * 6.283);
  }
  scene.add(strandMesh(gd, {tag: TAG.grass, width: 0.01, segs: 3, stiff: 3, lift: 3, sag: 0.05, flutter: 0.08, rootDark: 0.45}));

  // ---------- falling leaves by day, fireflies by night ----------
  // The same instances: as night comes, a third of them become small warm lights drifting low over the grass and
  // blinking; the rest shrink away.
  const N_LEAF = 150;
  const leafGeo = new THREE.InstancedBufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  leafGeo.setIndex([0, 1, 2, 0, 2, 3]);
  leafGeo.instanceCount = N_LEAF;
  const seedA = [], colA = [];
  for (let i = 0; i < N_LEAF; i++) {
    seedA.push(rr(-6, 6), rr(0, 1), rr(-9, 2.5), rand() * 100);
    const c = rand() < 0.65 ? WC.maple[Math.floor(rand() * 4)] : WC.ginkgo[Math.floor(rand() * 3)];
    colA.push(c.r, c.g, c.b);
  }
  leafGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seedA), 4));
  leafGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(colA), 3));
  const leaves = new THREE.Mesh(
    leafGeo,
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {...U},
      vertexShader: /* glsl */ `attribute vec4 aSeed; attribute vec3 aCol; uniform float uTime; uniform vec3 uWind; uniform float uDay;
        varying vec3 vCol; varying vec3 vN; varying float vFly;
        mat3 rot(vec3 a){ float cx=cos(a.x), sx=sin(a.x), cy=cos(a.y), sy=sin(a.y), cz=cos(a.z), sz=sin(a.z);
          return mat3(cy*cz, cy*sz, -sy, sx*sy*cz-cx*sz, sx*sy*sz+cx*cz, sx*cy, cx*sy*cz+sx*sz, cx*sy*sz-sx*cz, cx*cy); }
        void main(){
          float night = smoothstep(0.62, 0.9, uDay);
          float isFly = step(fract(aSeed.w * 0.37), 0.34);
          float T = 14.0; float k = fract(aSeed.y + uTime / T);
          vec3 c = vec3(aSeed.x, 4.2 - k * 4.3, aSeed.z);
          c += uWind * k * 4.0 + vec3(sin(uTime * 1.3 + aSeed.w) * 0.35, 0.0, cos(uTime * 1.1 + aSeed.w) * 0.25);
          // a firefly wanders slowly in a small loop, low over the ground
          vec3 f = vec3(aSeed.x * 0.8, 0.2 + 1.1 * fract(aSeed.w * 7.13), aSeed.z * 0.8 + 0.6);
          f += vec3(sin(uTime * 0.31 + aSeed.w) * 0.6, sin(uTime * 0.7 + aSeed.w * 3.0) * 0.18, cos(uTime * 0.27 + aSeed.w * 2.0) * 0.6);
          c = mix(c, f, night * isFly);
          mat3 R = rot(vec3(uTime * 2.1 + aSeed.w, uTime * 1.3 + aSeed.w * 2.0, uTime * 0.7));
          float size = mix(1.0, isFly * 0.55, night);
          vec3 p = c + R * (position * vec3(0.06, 0.045, 1.0)) * size;
          vCol = aCol; vN = R * vec3(0.0, 0.0, 1.0);
          vFly = night * isFly * pow(0.5 + 0.5 * sin(uTime * (1.3 + fract(aSeed.w) * 1.7) + aSeed.w * 5.0), 3.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `${LIGHT_GLSL} varying vec3 vCol; varying vec3 vN; varying float vFly;
        void main(){
          vec3 n = normalize(vN);
          vec3 c = mix(shade(vCol, n, n, 0.5) + vCol * 0.15, vec3(1.0, 0.78, 0.32) * 4.0, clamp(vFly * 1.4, 0.0, 1.0));
          gl_FragColor = vec4(c, ${TAG.mote.toFixed(3)});
        }`,
    }),
  );
  leaves.frustumCulled = false;
  scene.add(leaves);

  // things the time of day drives from JS: the lantern fires and their lights, the doors of the hall
  const fireOff = new THREE.Color('#2a2622'), fireOn = new THREE.Color('#ffb347').multiplyScalar(2.2);
  function setTime(v) {
    const on = sstep(0.55, 0.95, v);
    glowMat.color.copy(fireOff).lerp(fireOn, on);
    for (const l of lampLights) l.intensity = 2.6 * on;
    doorMat.emissiveIntensity = 1.4 * on;
  }
  // the summit's direction from the camera, so the moon can sit on it
  const summit = new THREE.Vector3(FUJI.x, FUJI.h - 2, FUJI.z), toPeak = new THREE.Vector3();
  function aim(camera) {
    toPeak.subVectors(summit, camera.position).normalize();
    peak.set(Math.atan2(toPeak.x, -toPeak.z) * THREE.MathUtils.RAD2DEG, Math.asin(toPeak.y) * THREE.MathUtils.RAD2DEG);
  }

  return {
    setTime,
    update: (t, camera) => {
      updates.forEach((f) => f(t));
      aim(camera);
    },
    terrace: {y: TERR_Y, z: TERR_Z},
  };
}
