// Copiado de exploraciones/kora-diorama/src/ascii.js con tools/kora/sync.mjs: no editar acá.
// The ASCII renderer. Three passes over the scene render:
//  1. cells: one fragment per character cell. Six sample circles (2 columns × 3 rows) give the cell's shape; the
//     glyph whose ink covers the same circles is chosen (shape-aware, after Alex Harri). The cell also gets its colour
//     and a class from the tags in alpha: picture (sky), world, Kora, eye, or far (Fuji, clouds, hills).
//  2. compose: full resolution. The sky stays a picture; far things keep their picture with faint type over it; the
//     land is bright type over a dark, blurred tint of its own colour. Where land meets sky the two blend across the
//     cell edge instead of stepping. Kora's eyes are forced to a solid '@' in their own colour.
//  3. print: a little halation, a gentle S-curve, warmth in the blacks and grain, like ink on paper.
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {TAG} from './common.js';

const TAG_FAR = TAG.far.toFixed(3), TAG_MOTE = TAG.mote.toFixed(3);

// No space: even the darkest cells keep a dot, as in the references. The world uses the references' vocabulary;
// Kora gets her own set of soft, curly glyphs so her coat reads as fur even when she is small.
const WORLD = ".:-=+*o0#%&@/\\|_~^'\u2014";
const FUR = ".,:;'\"~^*%&/\\";
const GLYPHS = WORLD + FUR;
const AT = WORLD.indexOf('@');
// Flat cells of the world take a glyph by brightness from their material's ramp (dark → bright), the grammar of the
// references; only cells with a real edge inside go through the shape search. Order matches the world tags in common.js.
const RAMPS = [
  '.:-=+*o#', // generic
  '..::||||', // grass: the bright levels become / | \\ by the wind (cells pass)
  '.:-\u2014==##', // stone and steps: — = #, as in the diorama skill
  '.::*++oo', // foliage: . : * + o
  '.:||####', // lacquer and wood
  '..::oo00', // far: hills, Fuji, clouds
  '.-~~~~=~', // water
];
const EDGE = [0.22, 0.42, 0.26, 0.32, 0.22, 9.0, 0.5];
const SLASH = WORLD.indexOf('/'), BACK = WORLD.indexOf('\\'), STAR = WORLD.indexOf('*'), BAR = WORLD.indexOf('|'), DASH = WORLD.indexOf('\u2014'), TILDE = WORLD.indexOf('~'), MINUS = WORLD.indexOf('-');
const RAMP_IDX = RAMPS.flatMap((r) => [...r].map((ch) => WORLD.indexOf(ch)));
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

// Six circles: x in two columns, y in three rows counted from the top.
const CIRCLES = [
  [0.3, 0.2], [0.7, 0.2],
  [0.3, 0.5], [0.7, 0.5],
  [0.3, 0.8], [0.7, 0.8],
];
const RADIUS = 0.2; // in cell widths

function drawGlyph(ctx, ch, x, w, h) {
  if (ch === '\u2014') ctx.fillRect(x, Math.round(h * 0.47), w, Math.max(1, Math.round(h * 0.11)));
  else ctx.fillText(ch, x + w / 2, h * 0.54);
}

// Coverage of each glyph inside the six circles, measured on a large canvas, normalised by the overall maximum.
function glyphVectors() {
  const W = 60, H = 100;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', {willReadFrequently: true});
  const vecs = [];
  let max = 0;
  for (const ch of GLYPHS) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(H / 1.12)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawGlyph(ctx, ch, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const v = CIRCLES.map(([cx, cy]) => {
      let s = 0, n = 0;
      const r = RADIUS * W;
      for (let y = Math.floor(cy * H - r); y <= cy * H + r; y++)
        for (let x = Math.floor(cx * W - r); x <= cx * W + r; x++) {
          if ((x - cx * W) ** 2 + (y - cy * H) ** 2 > r * r || x < 0 || y < 0 || x >= W || y >= H) continue;
          s += d[(y * W + x) * 4] / 255;
          n++;
        }
      return s / n;
    });
    vecs.push(v);
    max = Math.max(max, ...v);
  }
  const data = new Float32Array(GLYPHS.length * 2 * 4);
  vecs.forEach((v, i) => {
    data.set([v[0] / max, v[1] / max, v[2] / max, v[3] / max], i * 4);
    data.set([v[4] / max, v[5] / max, 0, 0], (GLYPHS.length + i) * 4);
  });
  const tex = new THREE.DataTexture(data, GLYPHS.length, 2, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  return tex;
}

// Atlas at the exact device-pixel cell size, one row, white on black.
function glyphAtlas(cw, ch) {
  const cv = document.createElement('canvas');
  cv.width = cw * GLYPHS.length;
  cv.height = ch;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(ch / 1.12)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...GLYPHS].forEach((g, i) => drawGlyph(ctx, g, i * cw, cw, ch));
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

const DISPLAY = /* glsl */ `
uniform float uExposure; uniform float uSat;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toDisplay(vec3 c) {
  c = aces(c * uExposure);
  c = pow(c, vec3(1.0 / 2.2));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(mix(vec3(l), c, uSat), 0.0, 1.0);
}`;

const CELLS_FRAG = /* glsl */ `
${DISPLAY}
uniform sampler2D tScene; uniform sampler2D tGlyph; uniform vec2 uRes; uniform vec2 uCell; uniform float uN; uniform float uExp; uniform float uAt;
uniform float uTime; uniform float uGain; uniform float uWorldN; uniform float uRamp[56]; uniform float uEdge[7]; uniform float uKoraGain;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y); }
// an edge picks the stroke that runs along it: | \ — / by the angle of the brightness gradient (y up)
float edgeGlyph(vec2 g) {
  float a4 = mod(atan(g.y, g.x) + 0.3927, 3.14159) / 0.7854;
  return a4 < 1.0 ? ${BAR}.0 : a4 < 2.0 ? ${BACK}.0 : a4 < 3.0 ? ${DASH}.0 : ${SLASH}.0;
}
void main() {
  vec2 o = floor(gl_FragCoord.xy) * uCell;
  float v[6]; vec3 sum = vec3(0.0); float wsum = 0.0; float tagMax = 0.0; float worldTag = 0.0; float farN = 0.0; float moteLum = -1.0; vec3 moteCol = vec3(0.0);
  vec3 eyeCol = vec3(0.0); float eyeChroma = -1.0; vec3 kCol = vec3(0.0); float kLum = -1.0;
  float r = ${RADIUS.toFixed(3)} * uCell.x;
  for (int k = 0; k < 6; k++) {
    vec2 cc = k == 0 ? vec2(0.3, 0.2) : k == 1 ? vec2(0.7, 0.2) : k == 2 ? vec2(0.3, 0.5) : k == 3 ? vec2(0.7, 0.5) : k == 4 ? vec2(0.3, 0.8) : vec2(0.7, 0.8);
    vec2 c = o + vec2(cc.x, 1.0 - cc.y) * uCell;
    float l = 0.0;
    for (int j = 0; j < 5; j++) {
      vec2 d = j == 0 ? vec2(0.0) : j == 1 ? vec2(r * 0.6, 0.0) : j == 2 ? vec2(-r * 0.6, 0.0) : j == 3 ? vec2(0.0, r * 0.6) : vec2(0.0, -r * 0.6);
      vec4 s = textureLod(tScene, (c + d) / uRes, 0.0);
      // the tag never blends between neighbours: read it from the nearest pixel
      s.a = texelFetch(tScene, ivec2(c + d), 0).a;
      vec3 col = toDisplay(s.rgb);
      l += dot(col, vec3(0.2126, 0.7152, 0.0722));
      float w = 0.2 + dot(col, vec3(0.33));
      sum += col * w; wsum += w;
      tagMax = max(tagMax, s.a);
      bool far = abs(s.a - ${TAG_FAR}) < 0.012;
      bool mote = abs(s.a - ${TAG_MOTE}) < 0.012;
      if (far) farN += 1.0;
      else if (mote) {
        float ml = dot(col, vec3(0.2126, 0.7152, 0.0722));
        if (ml > moteLum) { moteLum = ml; moteCol = col; }
      }
      else if (s.a > 0.12 && s.a < 0.58) worldTag = max(worldTag, s.a);
      if (s.a > 0.85) {
        float ch = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
        if (ch > eyeChroma) { eyeChroma = ch; eyeCol = col; }
      } else if (s.a > 0.58) {
        float kl = dot(col, vec3(0.2126, 0.7152, 0.0722));
        if (kl > kLum) { kLum = kl; kCol = col; }
      }
    }
    v[k] = clamp(l / 5.0 * uGain, 0.0, 1.0);
  }
  // Kora's ginger is darker than her white: lift her so the coat takes dense glyphs
  if (tagMax > 0.58 && tagMax < 0.85) for (int k = 0; k < 6; k++) v[k] = clamp(v[k] * uKoraGain, 0.0, 1.0);
  float m = max(max(max(v[0], v[1]), max(v[2], v[3])), max(v[4], v[5]));
  float mn = min(min(min(v[0], v[1]), min(v[2], v[3])), min(v[4], v[5]));
  float mean = (v[0] + v[1] + v[2] + v[3] + v[4] + v[5]) / 6.0;
  // brightness gradient across the cell, before the contrast below: right minus left, top minus bottom
  vec2 grad = vec2((v[1] + v[3] + v[5]) - (v[0] + v[2] + v[4]), ((v[0] + v[1]) - (v[4] + v[5])) * 1.5) / 3.0;
  // global contrast inside the cell sharpens the shape
  if (m > 1e-3) for (int k = 0; k < 6; k++) v[k] = pow(v[k] / m, uExp) * m;
  vec4 va = vec4(v[0], v[1], v[2], v[3]); vec2 vb = vec2(v[4], v[5]);
  // eye > Kora > land > mote > far > sky: a cell takes the nearest thing in it
  float cls = tagMax > 0.85 ? 3.0 : tagMax > 0.58 ? 2.0 : worldTag > 0.12 ? 1.0 : moteLum >= 0.0 ? 5.0 : farN > 7.0 ? 4.0 : 0.0;
  float lo = cls > 1.5 && cls < 2.5 ? uWorldN : 0.0;
  float hi = cls > 1.5 && cls < 2.5 ? uN : uWorldN;
  float best = 1e9; float bi = 0.0;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= hi) break;
    if (float(i) < lo) continue;
    vec4 a = texelFetch(tGlyph, ivec2(i, 0), 0);
    vec4 b = texelFetch(tGlyph, ivec2(i, 1), 0);
    vec4 da = va - a; vec2 db = vb - b.xy;
    float d = dot(da, da) + dot(db, db);
    if (d < best) { best = d; bi = float(i); }
  }
  vec3 col = sum / max(wsum, 1e-4);
  if (cls > 3.5 && cls < 4.5) {
    float val = max(max(col.r, col.g), col.b) * 0.75 + mean * 0.5;
    bi = uRamp[5 * 8 + int(clamp(val, 0.0, 0.999) * 8.0)];
  }
  if (cls > 0.5 && cls < 1.5) {
    int mat = int(clamp(floor((worldTag - 0.2) / 0.05 + 0.5), 0.0, 6.0));
    float val = max(max(col.r, col.g), col.b) * 0.75 + mean * 0.5;
    int lvl = int(clamp(val, 0.0, 0.999) * 8.0);
    // the breeze: slow gusts travel across the field (with the wind, so most blades lean '/'); slow enough not to strobe
    vec2 cc = floor(gl_FragCoord.xy);
    float w = vn(cc * vec2(0.045, 0.08) + vec2(-uTime * 0.22, uTime * 0.05)) * 2.0 - 1.0 + 0.28;
    if (mat == 1) {
      bi = uRamp[8 + lvl];
      if (lvl >= 4) bi = w > 0.18 ? ${SLASH}.0 : w < -0.22 ? ${BACK}.0 : ${BAR}.0;
    } else if (mat == 6) {
      bi = uRamp[6 * 8 + lvl];
      if (lvl >= 2 && lvl < 6) bi = w > 0.25 ? ${TILDE}.0 : ${MINUS}.0;
    } else if (m - mn < uEdge[mat]) {
      bi = uRamp[mat * 8 + lvl];
    } else if (mat == 0 || mat == 2 || mat == 4) {
      // a real edge on stone, wood or lacquer: the stroke that runs along it
      if (length(grad) > 0.06) bi = edgeGlyph(grad);
    }
    if (mat == 2 && bi == ${DASH}.0 && hash2(cc) < 0.18) bi = ${WORLD.indexOf('=')}.0;
  }
  if (cls > 4.5) { bi = ${STAR}.0; col = moteCol; }  // a leaf or a firefly: one star in its own colour
  if (cls > 1.5 && cls < 2.5) col = mix(col, kCol, 0.6);  // Kora: lit from her brightest hairs
  if (cls > 2.5 && cls < 3.5) { bi = uAt; col = eyeCol; }
  gl_FragColor = vec4(col, bi + 64.0 * cls);
}`;

const COMPOSE_FRAG = /* glsl */ `
${DISPLAY}
uniform sampler2D tCells; uniform sampler2D tAtlas; uniform sampler2D tScene; uniform vec2 uCell; uniform vec2 uRes; uniform float uRaw;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// 1 where the cell shows the picture (sky), .85 for far things under faint type, 0 where it's type on dark
float openOf(float cls) { return cls < 0.5 ? 1.0 : cls > 3.5 && cls < 4.5 ? 0.85 : 0.0; }
float clsAt(ivec2 c, ivec2 cmax) { return floor(texelFetch(tCells, clamp(c, ivec2(0), cmax), 0).a / 64.0 + 0.001); }
float openAt(ivec2 c, ivec2 cmax) {
  float cls = clsAt(c, cmax);
  // a leaf has no background of its own: take it from beside it
  if (cls > 4.5) cls = clsAt(c + ivec2(2, 0), cmax);
  if (cls > 4.5) cls = clsAt(c - ivec2(2, 0), cmax);
  return cls > 4.5 ? 1.0 : openOf(cls);
}
void main() {
  ivec2 fc = ivec2(gl_FragCoord.xy);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 lp = floor(gl_FragCoord.xy - cell * uCell);
  ivec2 ci = ivec2(cell), cmax = textureSize(tCells, 0) - 1;
  vec4 c = texelFetch(tCells, ci, 0);
  float cls = floor(c.a / 64.0 + 0.001);
  float gi = c.a - cls * 64.0;
  float ink = texelFetch(tAtlas, ivec2(int(gi * uCell.x + lp.x), int(lp.y)), 0).r;
  vec3 col = c.rgb;
  if (uRaw > 0.5) { gl_FragColor = vec4(toDisplay(texelFetch(tScene, fc, 0).rgb), 1.0); return; }

  // land against sky: read openness from the four nearest cells and blend, so the line between them doesn't step
  vec2 q = gl_FragCoord.xy / uCell - 0.5;
  ivec2 qi = ivec2(floor(q));
  vec2 qf = smoothstep(0.0, 1.0, q - floor(q));
  float open = mix(mix(openAt(qi, cmax), openAt(qi + ivec2(1, 0), cmax), qf.x),
                   mix(openAt(qi + ivec2(0, 1), cmax), openAt(qi + ivec2(1, 1), cmax), qf.x), qf.y);
  // the picture: sharp in the sky, a soft blur of the land's own colour under its type
  vec3 pic = toDisplay(textureLod(tScene, uv, mix(2.6, 0.0, open)).rgb);
  // the sky a little quieter than the land, like a printed wash
  pic = mix(vec3(luma(pic)), pic, mix(1.0, 0.86, open));
  // the land keeps a dark wash of its own colour under the type, like the first block of a print
  float under = mix(0.3, 1.0, open);
  vec3 outc = pic * under;

  if (cls > 4.5) {
    outc = mix(outc, min(col * 1.5 + 0.05, vec3(1.0)), ink);
  } else if (cls > 3.5) {
    // far: faint type over the picture, darker ink on snow and cloud, lighter on rock
    vec3 g = luma(pic) > 0.55 ? pic * 0.8 : min(pic * 1.35 + 0.04, vec3(1.0));
    outc = mix(outc, g, ink * 0.32);
  } else if (cls > 0.5 && cls < 1.5) {
    outc = mix(outc, min(col * 1.45, vec3(1.0)), ink);
  } else if (cls > 1.5 && cls < 2.5) {
    // Kora reads as a solid shape: her coat colour under the type, not near-black
    outc = mix(col * 0.5, min(col * 1.3 + 0.08, vec3(1.0)), ink);
  } else if (cls > 2.5) {
    vec3 e = col / max(max(col.r, max(col.g, col.b)), 1e-3);
    outc = mix(e * 0.22, e, ink);
  }
  // is a Kora cell next to this one? then this cell is part of her outline
  if (cls < 1.5 || (cls > 3.5 && cls < 4.5)) {
    float nearKora = 0.0;
    for (int k = 0; k < 4; k++) {
      ivec2 o = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
      float a = texelFetch(tCells, clamp(ci + o, ivec2(0), cmax), 0).a;
      float kc = floor(a / 64.0 + 0.001);
      if (kc > 1.5 && kc < 3.5) nearKora = 1.0;
    }
    outc *= 1.0 - 0.5 * nearKora;
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

const PRINT_FRAG = /* glsl */ `
uniform sampler2D tA; uniform vec2 uRes; uniform float uT; uniform vec4 uTilt;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture2D(tA, uv).rgb;
  // tilt-shift, as a model photographed close: a sharp band through Kora; above it (and a little below) the type
  // melts into a soft painting on a golden-angle disc. uTilt: focus height, sharp half-band up, down, max radius (px)
  float away = uv.y > uTilt.x ? (uv.y - uTilt.x - uTilt.y) / 0.42 : (uTilt.x - uTilt.z - uv.y) / 0.12;
  float r = pow(clamp(away, 0.0, 1.0), 1.5) * uTilt.w * uRes.y / 1000.0;
  if (r > 0.3) {
    float lod = max(log2(r / 4.0), 0.0);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      float t = float(i) + 0.5, a = t * 2.39996, rr = sqrt(t / 32.0) * r;
      acc += textureLod(tA, uv + vec2(cos(a), sin(a)) * rr / uRes, lod).rgb;
    }
    c = acc / 32.0;
  }
  // a little halation off anything bright
  vec3 glow = textureLod(tA, uv, 4.5).rgb;
  c += glow * glow * 0.09;
  // a gentle S-curve, warmth in the blacks
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);
  c *= vec3(1.015, 1.0, 0.965);
  c += vec3(0.014, 0.010, 0.006);
  vec2 v = (uv - 0.5) * vec2(1.1, 1.0);
  c *= 1.0 - 0.16 * pow(dot(v, v) * 1.7, 1.4);
  float grain = fract(sin(dot(gl_FragCoord.xy + fract(uT) * 91.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(c + grain * 0.024, 1.0);
}`;

export function createAscii(renderer) {
  const glyphTex = glyphVectors();
  const quad = (frag, uniforms) => new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  }));
  const common = {uExposure: {value: 1.25}, uSat: {value: 1.3}};
  const cells = quad(CELLS_FRAG, {
    ...common, tScene: {value: null}, tGlyph: {value: glyphTex}, uRes: {value: new THREE.Vector2()}, uCell: {value: new THREE.Vector2()},
    uTime: {value: 0}, uN: {value: GLYPHS.length}, uWorldN: {value: WORLD.length}, uRamp: {value: RAMP_IDX}, uEdge: {value: EDGE}, uKoraGain: {value: 1.05}, uExp: {value: 2.6}, uAt: {value: AT}, uGain: {value: 0.52},
  });
  const compose = quad(COMPOSE_FRAG, {
    ...common, tCells: {value: null}, tAtlas: {value: null}, tScene: {value: null}, uCell: {value: new THREE.Vector2()}, uRes: {value: new THREE.Vector2()}, uRaw: {value: 0},
  });
  const print = quad(PRINT_FRAG, {tA: {value: null}, uRes: {value: new THREE.Vector2()}, uT: {value: 0}, uTilt: {value: new THREE.Vector4(0.36, 0.28, 0.3, 13)}});

  let sceneRT, cellsRT, asciiRT, atlas, W = 0, H = 0, cw = 0, ch = 0;
  const state = {cssCell: 4.5, raw: false};
  // mipmapped, so the compose pass can read a soft blur of the land under its type and the print pass a glow
  const mipRT = (w, h, opts = {}) => {
    const rt = new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, ...opts});
    return rt;
  };

  function resize(w, h, dpr) {
    W = Math.max(1, Math.round(w * dpr));
    H = Math.max(1, Math.round(h * dpr));
    // dense grid: down to 4 × 7 device pixels, where glyphs still read as texture
    cw = Math.max(4, Math.round(state.cssCell * dpr));
    ch = Math.max(7, Math.round(cw * 1.65));
    sceneRT?.dispose();
    cellsRT?.dispose();
    asciiRT?.dispose();
    atlas?.dispose();
    sceneRT = mipRT(W, H);
    cellsRT = new THREE.WebGLRenderTarget(Math.ceil(W / cw), Math.ceil(H / ch), {type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false});
    asciiRT = mipRT(W, H, {depthBuffer: false});
    atlas = glyphAtlas(cw, ch);
    const cellPx = new THREE.Vector2(cw, ch);
    cells.material.uniforms.uRes.value.set(W, H);
    cells.material.uniforms.uCell.value.copy(cellPx);
    compose.material.uniforms.uCell.value.copy(cellPx);
    compose.material.uniforms.uRes.value.set(W, H);
    compose.material.uniforms.tAtlas.value = atlas;
    print.material.uniforms.uRes.value.set(W, H);
    return {cols: Math.ceil(W / cw), rows: Math.ceil(H / ch)};
  }

  function render(scene, camera, t = 0) {
    renderer.setRenderTarget(sceneRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);

    cells.material.uniforms.tScene.value = sceneRT.texture;
    cells.material.uniforms.uTime.value = t;
    renderer.setRenderTarget(cellsRT);
    cells.render(renderer);

    const cu = compose.material.uniforms;
    cu.tCells.value = cellsRT.texture;
    cu.tScene.value = sceneRT.texture;
    cu.uRaw.value = state.raw ? 1 : 0;
    renderer.setRenderTarget(asciiRT);
    compose.render(renderer);

    print.material.uniforms.tA.value = asciiRT.texture;
    print.material.uniforms.uT.value = t;
    renderer.setRenderTarget(null);
    print.render(renderer);
  }

  return {resize, render, state, uniforms: {cells: cells.material.uniforms, compose: compose.material.uniforms, print: print.material.uniforms}};
}
