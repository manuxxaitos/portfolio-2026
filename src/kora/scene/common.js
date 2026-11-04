// Copiado de exploraciones/kora-diorama/src/common.js con tools/kora/sync.mjs: no editar acá.
// Shared pieces: the clock and wind every shader reads, the light rig, the material "tags" the ASCII pass uses to
// treat sky, world, Kora and her eyes differently, and a small value noise for procedural colour.
import * as THREE from 'three';

// Tags travel in the alpha channel of the scene render. The ASCII pass sorts each cell into one of these.
// World materials sit between 0.20 and 0.50 in steps of 0.05; the cell pass picks a glyph ramp from them.
// mote: falling leaves and fireflies, drawn as a single glyph over whatever is behind them.
export const TAG = {sky: 0.0, world: 0.2, grass: 0.25, stone: 0.3, foliage: 0.35, wood: 0.4, far: 0.45, water: 0.5, mote: 0.56, kora: 0.666, eye: 1.0};

// One set of uniform objects, shared by reference across every material.
export const U = {
  uTime: {value: 0},
  uWind: {value: new THREE.Vector3(0.55, 0.0, 0.25)}, // direction × strength of the breeze
  uGust: {value: 1},
  // time of day, as on kshv.me: 0 is midday, .5 is dusk, 1 is deep night (main.js sets the lights from it)
  uDay: {value: 0.5},
  uSunDir: {value: new THREE.Vector3(-0.55, 0.72, 0.42).normalize()},
  uSunCol: {value: new THREE.Color(1.0, 0.93, 0.82).multiplyScalar(2.6)},
  uRimDir: {value: new THREE.Vector3(0.6, 0.45, -0.65).normalize()},
  uRimCol: {value: new THREE.Color(1.0, 0.78, 0.55).multiplyScalar(1.4)},
  uSky: {value: new THREE.Color('#7fb6ee').multiplyScalar(0.55)},
  uGround: {value: new THREE.Color('#4b6a2a').multiplyScalar(0.35)},
  // the two stone lanterns beside Kora; their colour is black by day and warm at night
  uLampPos: {value: [new THREE.Vector3(-1.6, 1.0, -1.9), new THREE.Vector3(1.6, 1.0, -1.9)]},
  uLampCol: {value: new THREE.Color(0, 0, 0)},
};

// The same three-stop blend in GLSL and in JS, so the sky, the lights and the slider agree.
export const DAY_GLSL = /* glsl */ `
uniform float uDay;
vec3 byTime(vec3 day, vec3 dusk, vec3 night) {
  return uDay < 0.5 ? mix(day, dusk, smoothstep(0.0, 0.5, uDay)) : mix(dusk, night, smoothstep(0.5, 1.0, uDay));
}
float byTimeF(float day, float dusk, float night) { return byTime(vec3(day), vec3(dusk), vec3(night)).x; }`;
const smooth01 = (x) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};
// [a, b, k]: the two stops to blend and how far, for a time v
export const daySpan = (v) => (v < 0.5 ? [0, 1, smooth01(v / 0.5)] : [1, 2, smooth01((v - 0.5) / 0.5)]);
export function byTime(v, stops) {
  const [a, b, k] = daySpan(v);
  return stops[a] + (stops[b] - stops[a]) * k;
}

const fmt = (x) => x.toFixed(4);

// Procedural surface detail, picked per material with the DETAIL define: the "texture" that gives the ASCII pass
// something to draw inside a surface. 1 stone, 2 lacquered wood, 3 roof tiles, 4 ground, 5 leaves, 6 bark.
const DETAIL_GLSL = /* glsl */ `
varying vec3 vDW;
float dh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dn3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh3(i), dh3(i + vec3(1,0,0)), f.x), mix(dh3(i + vec3(0,1,0)), dh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh3(i + vec3(0,0,1)), dh3(i + vec3(1,0,1)), f.x), mix(dh3(i + vec3(0,1,1)), dh3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dfbm(vec3 p) { return dn3(p) * 0.55 + dn3(p * 2.1) * 0.3 + dn3(p * 4.3) * 0.15; }
vec3 detailTex(vec3 p) {
#if DETAIL == 1
  float f = dfbm(p * 3.0);
  vec3 c = vec3(0.78 + 0.42 * f) * (1.0 - step(0.84, dn3(p * 26.0)) * 0.35);
  return mix(c, c * vec3(0.72, 0.95, 0.5), smoothstep(0.6, 0.7, dfbm(p * 1.3 + 7.0)) * 0.6);
#elif DETAIL == 2
  return vec3(0.84 + 0.26 * dn3(vec3(p.x * 30.0, p.y * 1.5, p.z * 30.0))) * (0.92 + 0.12 * dfbm(p * 4.0));
#elif DETAIL == 3
  float row = fract(p.y * 9.0); // tile courses run level, parallel to the ridge
  float col = fract(p.x * 7.0);
  float seam = smoothstep(0.0, 0.14, row) * smoothstep(0.0, 0.1, col) * smoothstep(1.0, 0.9, col);
  return vec3(0.55 + 0.5 * seam) * (0.9 + 0.2 * dn3(p * 6.0));
#elif DETAIL == 4
  return vec3(0.72 + 0.55 * dfbm(p * 0.7));
#elif DETAIL == 5
  return vec3(0.75 + 0.5 * dn3(p * 9.0));
#elif DETAIL == 6
  return vec3(0.55 + 0.65 * dn3(vec3(p.x * 40.0, p.y * 3.0, p.z * 40.0)));
#else
  return vec3(1.0);
#endif
}`;

// Writes the tag into alpha. sway: canopy-style vertex wind, scaled by height above swayBase (world y).
// detail: procedural texture (see DETAIL_GLSL).
export function tagged(mat, tag, {sway = 0, swayBase = 0, detail = 0} = {}) {
  mat.defines = {...(mat.defines || {}), DETAIL: detail};
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uGust = U.uGust;
    let vs = 'uniform float uTime; uniform float uGust; varying vec3 vDW;\n' + sh.vertexShader;
    let inject = '';
    if (sway) {
      inject += `
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float h = max(wp.y - ${fmt(swayBase)}, 0.0);
          float g = uGust * (0.7 + 0.3 * sin(uTime * 0.6 + wp.x * 0.15));
          transformed.x += (sin(uTime * 1.3 + wp.x * 0.7 + wp.z * 0.5) * 0.7 + sin(uTime * 3.7 + wp.y * 5.0 + wp.x * 3.0) * 0.3) * ${fmt(sway)} * h * g;
          transformed.z += cos(uTime * 1.1 + wp.z * 0.6 + wp.y * 2.0) * ${fmt(sway)} * 0.6 * h * g;
          transformed.y += sin(uTime * 4.3 + wp.x * 6.0 + wp.z * 5.0) * ${fmt(sway)} * 0.25 * h * g;
        }`;
    }
    inject += `
        {
          vec4 dw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          dw = instanceMatrix * dw;
          #endif
          vDW = (modelMatrix * dw).xyz;
        }`;
    sh.vertexShader = vs.replace('#include <begin_vertex>', '#include <begin_vertex>' + inject);
    sh.fragmentShader = DETAIL_GLSL + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= detailTex(vDW);')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n  gl_FragColor.a = ${fmt(tag)};`);
  };
  mat.customProgramCacheKey = () => `tag${tag}|${sway}|${swayBase}|${detail}`;
  return mat;
}

// GLSL used by the strand shaders (fur, grass): two lights + sky/ground fill, plus the lanterns at night.
export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uRimDir; uniform vec3 uRimCol; uniform vec3 uSky; uniform vec3 uGround;
uniform vec3 uLampPos[2]; uniform vec3 uLampCol;
vec3 shade(vec3 base, vec3 n, vec3 v, float tip) {
  float lam = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  vec3 hemi = mix(uGround, uSky, n.y * 0.5 + 0.5);
  vec3 c = base * (uSunCol * mix(wrap * 0.45, lam, 0.6) + hemi);
  // light through the tips of hair or grass when lit from behind
  float back = pow(max(dot(-v, uRimDir), 0.0), 2.0) + 0.35 * pow(1.0 - abs(dot(n, v)), 3.0);
  c += base * uRimCol * back * tip;
  return c;
}
// warm light from the two lanterns, falling off with distance (w: world position)
vec3 lampLight(vec3 base, vec3 w, vec3 n) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec3 d = uLampPos[i] - w;
    float k = 1.0 / (1.0 + dot(d, d) * 0.9);
    c += base * uLampCol * k * (0.3 + 0.7 * max(dot(n, normalize(d)), 0.0));
  }
  return c;
}`;

// Cheap deterministic noise for procedural colour.
function hash(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
const lerp = (a, b, t) => a + (b - a) * t;
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
export const sstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Seeded random so the scene is the same on every load.
let seed = 7;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export const rr = (a, b) => a + (b - a) * rand();
