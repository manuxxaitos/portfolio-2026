// Copiado de exploraciones/kora-ascii/src/kora.js con tools/kora/sync.mjs: no editar acá.
// Kora: a ginger-and-white border collie mix, sitting. Built from smooth primitives with her markings painted into
// vertex colours (white blaze, muzzle with freckles, chest ruff, socks, white tail tip), covered in shell fur and long
// moving locks, with her two eyes: amber on her right, ice blue on her left. update() turns her head toward a target
// point, blinks, flicks her ears, breathes and sweeps her tail.
import * as THREE from 'three';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {TAG, U, rand, rr, sstep, tagged, vnoise} from './common.js';
import {furShells} from './fur.js';
import {emptyStrands, strandMesh} from './strands.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const KC = {
  ginger: new THREE.Color('#c9762f'),
  gingerDeep: new THREE.Color('#a85a1f'),
  gingerLight: new THREE.Color('#e3a868'),
  white: new THREE.Color('#f3ece2'),
  cream: new THREE.Color('#ead7bd'),
  earIn: new THREE.Color('#e6b48c'),
  nose: new THREE.Color('#161211'),
  amber: new THREE.Color('#d98a24'),
  ice: new THREE.Color('#9fd8f6'),
};

// ---------- geometry helpers (all non-indexed so they merge) ----------
function ellipsoid(c, r, rot = [0, 0, 0], seg = 28) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(r[0], r[1], r[2]);
  g.rotateX(rot[0]);
  g.rotateY(rot[1]);
  g.rotateZ(rot[2]);
  g.translate(c[0], c[1], c[2]);
  return g.toNonIndexed();
}
function limb(a, b, ra, rb, seg = 16) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, len, seg, 6, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return [g.toNonIndexed(), ellipsoid([a.x, a.y, a.z], [ra, ra, ra], [0, 0, 0], 16), ellipsoid([b.x, b.y, b.z], [rb, rb, rb], [0, 0, 0], 16)];
}
function paint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  const out = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nn.fromBufferAttribute(n, i);
    fn(v, nn, c, uv ? uv.getX(i) : 0);
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return geo;
}
const mix = (out, a, b, t) => out.copy(a).lerp(b, Math.min(Math.max(t, 0), 1));

// ---------- markings ----------
// body space: y up, z forward (chest), x to her left
function bodyColour(p, n, c) {
  const nz = (vnoise(p.x * 22 + 3, p.y * 22, p.z * 22) - 0.5) * 0.05;
  let w = 0;
  // chest, ruff and the front of the neck
  w = Math.max(w, sstep(-0.01, 0.04, p.z + nz - 0.02 + (0.42 - p.y) * 0.12) * sstep(0.16, 0.24, p.y));
  // white collar reaching up the sides of the neck
  w = Math.max(w, sstep(0.5, 0.56, p.y + nz) * sstep(-0.04, 0.02, p.z + 0.03));
  // belly and inner legs
  w = Math.max(w, sstep(0.17, 0.11, p.y + nz) * sstep(-0.16, -0.06, p.z) * sstep(0.1, 0.05, Math.abs(p.x)));
  // front legs: white socks all the way, a ginger stripe on the back of the forearm
  const onFront = Math.abs(Math.abs(p.x) - 0.065) < 0.05 && p.z > 0.06 && p.y < 0.34;
  if (onFront) w = p.z < 0.11 && p.y > 0.13 && n.z < -0.2 ? 0.25 : 1;
  // hind feet and hocks
  if (p.y < 0.075 + nz) w = 1;
  mix(c, KC.ginger, KC.white, w);
  if (w < 0.5) {
    // deeper ginger along the back, lighter on the haunches
    c.lerp(KC.gingerDeep, sstep(0.22, 0.42, p.y) * sstep(0.02, -0.22, p.z) * 0.45);
    c.lerp(KC.gingerLight, sstep(0.0, 0.6, n.x * Math.sign(p.x)) * sstep(0.25, 0.1, p.y) * 0.25);
  }
}
// head space: origin at the top of the neck, z along the muzzle
function headColour(p, n, c) {
  const nz = (vnoise(p.x * 40 + 9, p.y * 40, p.z * 40) - 0.5) * 0.02;
  // ginger hood over the sides and back of the skull and around the eyes; more of it on her left (+x)
  const side = Math.abs(p.x) - (p.x > 0 ? 0.018 : 0.026);
  const blaze = 0.013 + Math.max(0, 0.09 - p.y) * 0.25 + Math.max(0, p.z - 0.07) * 0.5;
  let g = sstep(blaze - 0.006, blaze + 0.006, side + nz);
  g *= sstep(0.03, 0.06, p.y + nz * 2 + (p.z > 0.1 ? -0.02 : 0)); // cheeks and jaw stay white
  g *= sstep(0.13, 0.09, p.z + (p.y - 0.08) * 0.3); // muzzle white
  g = Math.max(g, sstep(0.0, -0.06, p.z) * sstep(0.04, 0.08, p.y)); // back of the head
  mix(c, KC.white, KC.ginger, g);
  if (g < 0.4) {
    // freckles on the muzzle and around the blaze
    const f = vnoise(p.x * 160 + 1, p.y * 160, p.z * 160);
    if (p.z > 0.06 && f > 0.78) c.lerp(KC.gingerDeep, 0.65);
    c.lerp(KC.cream, sstep(0.05, 0.0, p.y) * 0.3);
  }
}
function earColour(p, n, c) {
  const inner = sstep(0.2, 0.7, n.z) * sstep(0.03, 0.015, Math.abs(p.x)) * sstep(0.08, 0.04, p.y);
  mix(c, KC.ginger, KC.earIn, inner * 0.8);
  c.lerp(KC.gingerDeep, sstep(0.06, 0.1, p.y) * 0.3);
}

// ---------- the build ----------
function surfaceStrands(mesh, count, lenFn, flowFn, colJitter = 0.06) {
  const s = new MeshSurfaceSampler(mesh).build();
  const d = emptyStrands();
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color(), f = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    s.sample(p, n, c);
    const len = lenFn(p, n, c);
    if (len <= 0) continue;
    flowFn(p, n, f);
    f.addScaledVector(n, -f.dot(n));
    if (f.lengthSq() < 1e-6) f.set(0, -1, 0);
    f.normalize();
    const j = 1 + (rand() - 0.5) * colJitter * 2;
    d.root.push(p.x, p.y, p.z);
    d.nrm.push(n.x, n.y, n.z);
    d.flow.push(f.x, f.y, f.z);
    d.col.push(c.r * j, c.g * j, c.b * j, len * rr(0.75, 1.2));
    d.phase.push(rand() * 6.283);
  }
  return d;
}

function eyeMaterial(iris) {
  return new THREE.ShaderMaterial({
    uniforms: {uIris: {value: iris.clone()}, ...U},
    vertexShader: /* glsl */ `varying vec3 vNo; varying vec3 vNw; varying vec3 vPw;
      void main(){ vNo = normal; vNw = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vPw = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uIris; uniform vec3 uSunDir; varying vec3 vNo; varying vec3 vNw; varying vec3 vPw;
      void main(){
        float d = normalize(vNo).z;
        vec3 c = vec3(0.025, 0.018, 0.014);                                   // dark rim, dogs show little white
        float ring = smoothstep(0.5, 0.58, d);
        vec3 iris = uIris * (0.75 + 0.55 * smoothstep(0.6, 0.86, d));         // brighter toward the pupil, like hers
        c = mix(c, iris, ring);
        c = mix(c, vec3(0.006), smoothstep(0.885, 0.91, d));                  // pupil
        vec3 v = normalize(cameraPosition - vPw);
        vec3 r = reflect(-v, normalize(vNw));
        c += vec3(1.0) * pow(max(dot(r, normalize(uSunDir + vec3(0.0, 0.2, 0.4))), 0.0), 80.0) * 2.5;  // catchlight
        gl_FragColor = vec4(c * 1.6, ${TAG.eye.toFixed(3)});
      }`,
  });
}

export function buildKora() {
  const kora = new THREE.Group();
  const body = new THREE.Group();
  kora.add(body);
  const skin = (tag = TAG.kora) => tagged(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.9, color: new THREE.Color(0.62, 0.6, 0.58)}), tag);

  // body: sitting, chest up, haunches on the ground, front legs straight
  const bodyParts = [
    ellipsoid([0, 0.165, -0.2], [0.125, 0.14, 0.15]),
    ...limb(V(0, 0.2, -0.17), V(0, 0.4, 0.02), 0.12, 0.115),
    ellipsoid([0, 0.39, 0.06], [0.105, 0.14, 0.105]),
    ellipsoid([0, 0.46, 0.1], [0.095, 0.115, 0.07]), // ruff
    ...limb(V(0, 0.47, 0.04), V(0, 0.6, 0.08), 0.07, 0.058), // neck
    ...[-1, 1].flatMap((s) => [
      ellipsoid([s * 0.068, 0.35, 0.06], [0.048, 0.08, 0.065]), // shoulder
      ...limb(V(s * 0.068, 0.32, 0.1), V(s * 0.066, 0.05, 0.13), 0.042, 0.032), // front leg
      ellipsoid([s * 0.066, 0.024, 0.16], [0.04, 0.025, 0.05]), // front paw
      ellipsoid([s * 0.105, 0.15, -0.12], [0.064, 0.1, 0.13], [-0.45, 0, 0]), // thigh
      ...limb(V(s * 0.11, 0.09, -0.24), V(s * 0.108, 0.03, -0.17), 0.03, 0.025), // hock
      ellipsoid([s * 0.1, 0.02, -0.06], [0.032, 0.02, 0.085]), // hind foot along the ground
    ]),
  ].map((g) => paint(g, bodyColour));
  const bodyMesh = new THREE.Mesh(mergeGeometries(bodyParts), skin());
  bodyMesh.castShadow = true;
  body.add(bodyMesh);

  // head on a pivot at the top of the neck
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.6, 0.075);
  body.add(headPivot);
  const head = new THREE.Group();
  headPivot.add(head);
  head.scale.setScalar(1.22);
  const headParts = [
    ellipsoid([0, 0.075, 0.015], [0.08, 0.077, 0.092]), // skull
    ellipsoid([0, 0.088, 0.075], [0.058, 0.052, 0.05]), // brow and stop
    ellipsoid([0, 0.062, 0.14], [0.034, 0.03, 0.07]), // bridge
    ellipsoid([0, 0.044, 0.17], [0.034, 0.031, 0.075]), // muzzle
    ellipsoid([0, 0.02, 0.14], [0.03, 0.019, 0.075]), // jaw
    ellipsoid([-0.052, 0.045, 0.055], [0.045, 0.045, 0.05]), // cheeks
    ellipsoid([0.052, 0.045, 0.055], [0.045, 0.045, 0.05]),
  ].map((g) => paint(g, headColour));
  const headMesh = new THREE.Mesh(mergeGeometries(headParts), skin());
  headMesh.castShadow = true;
  head.add(headMesh);
  const nose = new THREE.Mesh(
    paint(ellipsoid([0, 0.058, 0.243], [0.02, 0.016, 0.015]), (p, n, c) => c.copy(KC.nose)),
    tagged(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.35}), TAG.kora),
  );
  head.add(nose);

  // eyes: her right (−x) amber, her left (+x) ice blue
  const eyes = [];
  for (const [s, iris] of [[-1, KC.amber], [1, KC.ice]]) {
    const socket = new THREE.Group();
    socket.position.set(s * 0.043, 0.09, 0.093);
    socket.rotation.y = s * 0.32;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 24, 18), eyeMaterial(iris));
    socket.add(eye);
    head.add(socket);
    eyes.push(eye);
  }

  // ears: semi-erect, tips folded forward and out
  const ears = [];
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.042, 0);
    shape.quadraticCurveTo(-0.044, 0.065, -0.012, 0.098);
    shape.quadraticCurveTo(0.018, 0.1, 0.04, 0.0);
    shape.quadraticCurveTo(0, -0.01, -0.042, 0);
    const g = new THREE.ExtrudeGeometry(shape, {depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 12, steps: 1});
    g.translate(0, 0, -0.004);
    // fold the top forward
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      if (y > 0.04) {
        // bend along an arc so the folded part keeps its length
        const r = y - 0.04;
        const a = Math.max((r / 0.06) * 1.7, 1e-4);
        const R = r / a;
        p.setY(i, 0.04 + R * Math.sin(a));
        p.setZ(i, z + R * (1 - Math.cos(a)));
      }
    }
    g.computeVertexNormals();
    const eg = paint(g.toNonIndexed(), earColour);
    const ear = new THREE.Group();
    ear.position.set(s * 0.058, 0.13, -0.012);
    ear.rotation.set(-0.05, -s * 0.5, -s * 0.85);
    ear.userData.base = ear.rotation.clone();
    const em = new THREE.Mesh(eg, skin());
    em.castShadow = true;
    ear.add(em);
    head.add(ear);
    ears.push(ear);
  }

  // tail lies on the ground and curls around her right side, white tip
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.11, -0.31);
  body.add(tailPivot);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(-0.01, -0.045, -0.1), V(-0.07, -0.085, -0.19), V(-0.19, -0.095, -0.2), V(-0.29, -0.095, -0.11), V(-0.33, -0.09, 0.02), V(-0.31, -0.085, 0.13)]);
  const tube = new THREE.TubeGeometry(curve, 48, 0.034, 14, false);
  {
    const p = tube.attributes.position, uv = tube.attributes.uv, q = new THREE.Vector3(), c0 = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      curve.getPointAt(u, c0);
      q.fromBufferAttribute(p, i).sub(c0).multiplyScalar(1 - 0.55 * u);
      p.setXYZ(i, c0.x + q.x, c0.y + q.y, c0.z + q.z);
    }
    tube.computeVertexNormals();
  }
  const tailGeo = mergeGeometries([
    paint(tube.toNonIndexed(), (p, n, c, u) => mix(c, KC.ginger, KC.white, Math.max(sstep(0.78, 0.86, u), sstep(-0.2, -0.6, n.y) * 0.85))),
    paint(ellipsoid([-0.31, -0.085, 0.13], [0.016, 0.016, 0.016]), (p, n, c) => c.copy(KC.white)),
  ]);
  const tailMesh = new THREE.Mesh(tailGeo, skin());
  tailMesh.castShadow = true;
  tailPivot.add(tailMesh);

  // ---------- fur ----------
  // Lengths in metres, per region. The shells give the coat its volume and broken outline; the strands are the long
  // locks that make the silhouette (ruff, mane, pants, tail plume, ear fringes) and swing most in the wind.
  const bodyLen = (p, n) => {
    if (p.y < 0.07) return 0.007; // feet
    const fore = p.z > 0.06 && p.y < 0.32 && Math.abs(Math.abs(p.x) - 0.067) < 0.05;
    if (fore) return n.z < -0.2 && p.y > 0.1 ? 0.05 : 0.022; // feathering behind the forelegs
    let L = 0.038;
    L = Math.max(L, 0.085 * sstep(0.32, 0.42, p.y) * sstep(0.0, 0.07, p.z) * sstep(0.64, 0.56, p.y)); // ruff
    L = Math.max(L, 0.065 * sstep(0.49, 0.56, p.y)); // mane around the neck
    L = Math.max(L, 0.08 * sstep(-0.15, -0.26, p.z) * sstep(0.3, 0.16, p.y)); // pants on the haunches
    L = Math.max(L, 0.05 * sstep(0.18, 0.1, p.y) * sstep(-0.14, -0.04, p.z)); // belly
    return L;
  };
  const bodyFlow = (p, n, f) => f.set(0, -0.8, -1);
  const eyePos = [V(-0.043, 0.09, 0.093), V(0.043, 0.09, 0.093)];
  const headLen = (p) => {
    if (eyePos.some((e) => e.distanceTo(p) < 0.03)) return 0;
    if (p.z > 0.13) return 0.003; // muzzle almost smooth
    let L = 0.012;
    L = Math.max(L, 0.03 * sstep(0.05, 0.07, Math.abs(p.x)) * sstep(0.07, 0.02, p.y)); // cheek fluff
    L = Math.max(L, 0.035 * sstep(0.0, -0.06, p.z)); // back of the head into the mane
    return L;
  };
  const headFlow = (p, n, f) => f.set(0, 0.05, -1);
  const earLen = (p) => 0.01 + 0.028 * sstep(0.022, 0.038, Math.abs(p.x)) * sstep(0.0, 0.03, p.y);
  const earFlow = (p, n, f) => f.set(Math.sign(p.x) * 0.6, -1, 0);
  // the tail is combed along itself, toward the tip
  const tailPts = curve.getSpacedPoints(80);
  const tailFlow = (p, n, f) => {
    let bi = 0, bd = 1e9;
    tailPts.forEach((q, i) => {
      const d = q.distanceToSquared(p);
      if (d < bd) (bd = d), (bi = i);
    });
    const a = tailPts[Math.max(bi - 1, 0)], b = tailPts[Math.min(bi + 1, tailPts.length - 1)];
    return f.subVectors(b, a).normalize().addScaledVector(n, 0.15);
  };
  const tailLen = (p, n) => 0.07 + 0.035 * sstep(-0.1, -0.6, n.y) + 0.02 * sstep(0.1, 0.6, Math.abs(n.x));

  const furTag = {tag: TAG.kora};
  body.add(furShells(bodyMesh, {...furTag, shells: 20, freq: 95, lean: 1.0, sag: 0.4, lenFn: bodyLen, flowFn: bodyFlow}));
  head.add(furShells(headMesh, {...furTag, shells: 12, freq: 170, lean: 0.8, sag: 0.2, lenFn: headLen, flowFn: headFlow}));
  for (const ear of ears) ear.add(furShells(ear.children[0], {...furTag, shells: 10, freq: 170, lean: 0.9, sag: 0.5, swing: 1.6, lenFn: earLen, flowFn: earFlow}));
  tailPivot.add(furShells(tailMesh, {...furTag, shells: 22, freq: 75, lean: 1.2, sag: 0.25, swing: 1.4, tipLight: 0.5, lenFn: tailLen, flowFn: tailFlow}));

  // long locks only where they shape the silhouette
  const lockOpts = {tag: TAG.kora, width: 0.0045, segs: 4, stiff: 4, lift: 0.3, sag: 0.4, flutter: 0.09, rootDark: 0.7};
  const locks = (len) => (p, n) => (len(p, n) >= 0.05 ? len(p, n) * 1.25 : 0);
  body.add(strandMesh(surfaceStrands(bodyMesh, 16000, locks(bodyLen), bodyFlow), lockOpts));
  head.add(strandMesh(surfaceStrands(headMesh, 3000, (p) => (headLen(p) >= 0.028 ? headLen(p) * 1.2 : 0), headFlow), {...lockOpts, width: 0.0035}));
  for (const ear of ears) ear.add(strandMesh(surfaceStrands(ear.children[0], 1400, (p) => (earLen(p) > 0.025 ? earLen(p) * 1.3 : 0), earFlow), {...lockOpts, width: 0.003, flutter: 0.14, stiff: 3}));
  tailPivot.add(strandMesh(surfaceStrands(tailMesh, 6000, (p, n) => tailLen(p, n) * 1.3, tailFlow), {...lockOpts, lift: 0.5, sag: 0.15, flutter: 0.13, stiff: 2.6}));

  // ---------- behaviour ----------
  const st = {
    yaw: 0, pitch: 0, roll: 0, vy: 0, vp: 0, vr: 0,
    blinkAt: 2.5, blink: 0,
    earFlick: [0, 0], nextFlick: 1.5,
    wag: 0, cock: 0, nextCock: 4,
  };
  const tmp = new THREE.Vector3();
  const spring = (x, v, target, k, dt) => {
    const a = k * k * (target - x) - 2 * k * v;
    v += a * dt;
    return [x + v * dt, v];
  };

  function update(t, dt, target, excite) {
    // breathing
    const br = Math.sin(t * 2.2);
    body.scale.set(1 + br * 0.008, 1 + br * 0.006, 1 + br * 0.01);

    // head toward the target, in body space
    headPivot.updateWorldMatrix(true, false);
    tmp.copy(target);
    body.worldToLocal(tmp);
    tmp.sub(headPivot.position);
    let yaw = Math.atan2(tmp.x, tmp.z);
    let pitch = Math.atan2(tmp.y - 0.08, Math.hypot(tmp.x, tmp.z));
    yaw = Math.max(-1.0, Math.min(1.0, yaw));
    pitch = Math.max(-0.45, Math.min(0.5, pitch));
    // the head tilt she does when she is curious
    if (t > st.nextCock) {
      st.cock = rand() < 0.45 ? (rand() < 0.5 ? -1 : 1) * rr(0.18, 0.32) : 0;
      st.nextCock = t + rr(2.5, 6);
    }
    [st.yaw, st.vy] = spring(st.yaw, st.vy, yaw, 7, dt);
    [st.pitch, st.vp] = spring(st.pitch, st.vp, pitch, 7, dt);
    [st.roll, st.vr] = spring(st.roll, st.vr, st.cock, 5, dt);
    head.rotation.set(-st.pitch, st.yaw, st.roll, 'YXZ');

    // blink
    if (t > st.blinkAt) {
      st.blink = 0.14;
      st.blinkAt = t + rr(2.5, 6);
    }
    st.blink = Math.max(0, st.blink - dt);
    const lid = st.blink > 0 ? 0.12 : 1;
    for (const e of eyes) e.scale.y = lid;

    // ears: flutter in the wind, an occasional flick, perk up when she is excited
    if (t > st.nextFlick) {
      st.earFlick[rand() < 0.5 ? 0 : 1] = 1;
      st.nextFlick = t + rr(1.2, 4);
    }
    ears.forEach((ear, i) => {
      const s = i === 0 ? -1 : 1;
      st.earFlick[i] = Math.max(0, st.earFlick[i] - dt * 5);
      const fl = Math.sin(st.earFlick[i] * Math.PI) * 0.45;
      const b = ear.userData.base;
      const flutter = Math.sin(t * 6.1 + i * 2) * 0.03 * U.uGust.value + Math.sin(t * 13.7 + i) * 0.012;
      ear.rotation.set(b.x - fl * 0.5 - excite * 0.15, b.y, b.z - s * (fl + flutter) + s * excite * 0.2);
    });

    // tail: lazy sweep along the floor, faster when she is excited
    st.wag += dt * (1.2 + excite * 9);
    tailPivot.rotation.y = Math.sin(st.wag) * (0.08 + excite * 0.22);
  }

  // world positions of both eyes (for framing and checks)
  function eyeWorld() {
    return eyes.map((e) => e.getWorldPosition(new THREE.Vector3()));
  }
  function headWorld() {
    return head.localToWorld(V(0, 0.07, 0.08));
  }

  return {group: kora, update, eyeWorld, headWorld, head};
}
