// Copiado de exploraciones/kora-ascii/src/strands.js con tools/kora/sync.mjs: no editar acá.
// Instanced strands: one thin camera-facing ribbon per hair or grass blade, bent by gravity and a breeze that never
// stops. Positions are given in the space of the object the strands are parented to, so fur follows the head when it
// turns while the wind stays in world space. The constant small motion is what makes the ASCII glyphs flicker.
import * as THREE from 'three';
import {LIGHT_GLSL, U} from './common.js';

function ribbon(segs) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pos.push(-0.5, t, 0, 0.5, t, 0);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const VERT = /* glsl */ `
attribute vec3 aRoot; attribute vec3 aNrm; attribute vec3 aFlow; attribute vec4 aCol; attribute float aPhase;
uniform float uTime; uniform vec3 uWind; uniform float uGust; uniform float uWidth; uniform float uStiff; uniform float uLift; uniform float uSag; uniform float uFlutter;
varying vec3 vCol; varying float vT; varying vec3 vN; varying vec3 vW;
void main() {
  float t = position.y;
  float len = aCol.a;
  vec3 rootW = (modelMatrix * vec4(aRoot, 1.0)).xyz;
  vec3 nW = normalize(mat3(modelMatrix) * aNrm);
  vec3 fW = mat3(modelMatrix) * aFlow;
  vec3 d0 = normalize(nW * uLift + fW);
  // breeze: slow sway plus a fast flutter, different per strand and per place
  float ph = aPhase + dot(rootW, vec3(3.1, 1.7, 2.3));
  float slow = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 0.9 + ph * 0.37) * 0.4;
  float fast = sin(uTime * 7.3 + ph * 2.9) * 0.5 + sin(uTime * 11.1 + ph * 1.3) * 0.25;
  float gust = uGust * (0.65 + 0.35 * sin(uTime * 0.55 + rootW.x * 0.8 + rootW.z * 0.5));
  vec3 wind = uWind * gust * (0.55 + 0.45 * slow) + normalize(cross(d0, vec3(0.0, 1.0, 0.0)) + 1e-4) * fast * uFlutter * gust;
  vec3 bend = (vec3(0.0, -uSag, 0.0) + wind) / uStiff;
  vec3 p = rootW - nW * 0.002 + (d0 * t + bend * t * t) * len;
  vec3 dir = normalize(d0 + bend * 2.0 * t);
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = cross(dir, toCam);
  side = length(side) > 1e-4 ? normalize(side) : vec3(1.0, 0.0, 0.0);
  p += side * position.x * uWidth * (1.0 - 0.8 * t);
  vT = t; vCol = aCol.rgb; vN = normalize(mix(nW, dir, 0.35)); vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
${LIGHT_GLSL}
uniform float uTag; uniform float uRootDark;
varying vec3 vCol; varying float vT; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  vec3 n = normalize(vN);
  if (dot(n, v) < 0.0) n = -n * 0.6 + n * 0.4;
  vec3 base = vCol * mix(uRootDark, 1.08, vT);
  gl_FragColor = vec4(shade(base, normalize(n), v, vT) + lampLight(base, vW, normalize(n)), uTag);
}`;

// Builds a strand mesh. strands: {root[], nrm[], flow[], col[] (rgb + length), phase[]} as flat arrays.
export function strandMesh(data, {tag, width = 0.003, segs = 4, stiff = 1, lift = 0.5, sag = 0.25, flutter = 0.05, rootDark = 0.55}) {
  const g = ribbon(segs);
  const n = data.phase.length;
  g.instanceCount = n;
  g.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(data.root), 3));
  g.setAttribute('aNrm', new THREE.InstancedBufferAttribute(new Float32Array(data.nrm), 3));
  g.setAttribute('aFlow', new THREE.InstancedBufferAttribute(new Float32Array(data.flow), 3));
  g.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(data.col), 4));
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(data.phase), 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      ...U,
      uTag: {value: tag},
      uWidth: {value: width},
      uStiff: {value: stiff},
      uLift: {value: lift},
      uSag: {value: sag},
      uFlutter: {value: flutter},
      uRootDark: {value: rootDark},
    },
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

export function emptyStrands() {
  return {root: [], nrm: [], flow: [], col: [], phase: []};
}
