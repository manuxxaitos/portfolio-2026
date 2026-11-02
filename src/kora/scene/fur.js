// Copiado de exploraciones/kora-ascii/src/fur.js con tools/kora/sync.mjs: no editar acá.
// Shell fur: the skin mesh drawn N more times, each copy pushed out along the normal and cut into locks by a 3D
// cell pattern, so the coat has volume and a soft, broken silhouette. Locks lean the way the coat is combed (flow),
// sag, and swing with the breeze: the outer shells move most, so the whole coat ripples all the time.
// One instanced draw per skin mesh: gl_InstanceID is the shell index.
import * as THREE from 'three';
import {LIGHT_GLSL, U} from './common.js';

const VERT = /* glsl */ `
attribute float aLen; attribute vec3 aFlow; // 'color' is declared by three because vertexColors is on
uniform float uShells; uniform float uTime; uniform vec3 uWind; uniform float uGust; uniform float uLean; uniform float uSag; uniform float uSwing;
varying float vH; varying vec3 vRest; varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vLen;
void main() {
  float h = (float(gl_InstanceID) + 1.0) / uShells;
  vec3 restW = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 nW = normalize(mat3(modelMatrix) * normal);
  vec3 fW = mat3(modelMatrix) * aFlow;
  float L = aLen;
  float ph = dot(restW, vec3(31.7, 23.3, 27.9));
  float slow = sin(uTime * 1.8 + ph * 0.07) * 0.6 + sin(uTime * 0.83 + ph * 0.031) * 0.4;
  float fast = sin(uTime * 6.9 + ph * 0.5) * 0.5 + sin(uTime * 10.7 + ph * 0.23) * 0.3;
  float g = uGust * (0.7 + 0.3 * sin(uTime * 0.55 + restW.x * 0.8));
  vec3 wind = uWind * g * (0.55 + 0.45 * slow) * uSwing + normalize(cross(nW, vec3(0.0, 1.0, 0.0)) + 1e-4) * fast * 0.25 * g * uSwing;
  vec3 p = restW + nW * L * h + fW * L * uLean * h * h + (vec3(0.0, -uSag, 0.0) + wind) * L * h * h;
  vH = h; vRest = position; vCol = color; vLen = L;
  vN = normalize(nW + fW * uLean * h * 0.5);
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
${LIGHT_GLSL}
uniform float uFreq; uniform float uTag; uniform float uTipLight;
varying float vH; varying vec3 vRest; varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vLen;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  if (vLen < 1e-4) discard;
  // locks: one per 3D cell, jittered, thinning toward the tip
  vec3 q = vRest * uFreq;
  vec3 ci = floor(q);
  vec3 jit = vec3(hash(ci), hash(ci + 11.0), hash(ci + 23.0));
  float d = length(fract(q) - (0.25 + jit * 0.5));
  // clumps: neighbouring locks share a length, so the coat breaks into tufts
  float clump = vnoise(vRest * uFreq * 0.22);
  float reach = mix(0.45, 1.0, clump) * (0.8 + 0.2 * hash(ci + 5.0));
  float thick = mix(0.62, 0.12, vH / max(reach, 1e-3));
  if (vH > reach || d > thick) discard;
  vec3 v = normalize(cameraPosition - vW);
  vec3 base = vCol * mix(0.5, 1.0, vH) + vCol * uTipLight * vH * vH;
  vec3 n = normalize(vN);
  gl_FragColor = vec4(shade(base, n, v, vH) + lampLight(base, vW, n), uTag);
}`;

// lenFn(p, n) → fur length in metres at a skin vertex; flowFn(p, n, out) → comb direction (object space).
export function furShells(mesh, {tag, shells = 18, freq = 150, lean = 1.1, sag = 0.35, swing = 1, tipLight = 0.35, lenFn, flowFn}) {
  const src = mesh.geometry;
  const g = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'normal', 'color']) g.setAttribute(k, src.attributes[k]);
  const pos = src.attributes.position, nrm = src.attributes.normal;
  const n = pos.count;
  const len = new Float32Array(n), flow = new Float32Array(n * 3);
  const p = new THREE.Vector3(), nn = new THREE.Vector3(), f = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    nn.fromBufferAttribute(nrm, i);
    len[i] = Math.max(0, lenFn(p, nn));
    flowFn(p, nn, f);
    f.addScaledVector(nn, -f.dot(nn));
    if (f.lengthSq() < 1e-6) f.set(0, -1, 0);
    f.normalize();
    flow.set([f.x, f.y, f.z], i * 3);
  }
  g.setAttribute('aLen', new THREE.BufferAttribute(len, 1));
  g.setAttribute('aFlow', new THREE.BufferAttribute(flow, 3));
  g.instanceCount = shells;
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: true,
    side: THREE.DoubleSide,
    uniforms: {
      ...U,
      uShells: {value: shells},
      uFreq: {value: freq},
      uLean: {value: lean},
      uSag: {value: sag},
      uSwing: {value: swing},
      uTag: {value: tag},
      uTipLight: {value: tipLight},
    },
  });
  const shell = new THREE.Mesh(g, m);
  shell.frustumCulled = false;
  return shell;
}
