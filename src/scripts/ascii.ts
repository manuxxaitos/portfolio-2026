/**
 * Plotter — campo ASCII del sitio.
 *
 * Un solo canvas detrás de todo. La CPU calcula un glifo por celda y la GPU
 * solo lo dibuja desde un atlas: una textura chica por cuadro, un draw call.
 * Las curvas de nivel se trazan con - / | \ según su dirección (no por
 * brillo), así se leen como líneas dibujadas. Sin dependencias.
 */

type RGB = [number, number, number];

export interface PlotterState {
  bg: RGB;
  ink: RGB;
  hot: RGB;
  /** 0–1: cuánto se ve el campo */
  intensity: number;
  /** cantidad de curvas de nivel */
  bands: number;
}

export interface PlotterOptions {
  /** si existe, el campo vive dentro de este elemento y no de la ventana */
  host?: HTMLElement;
  /** alto de celda en px css */
  cell?: number;
  scrollDrift?: boolean;
  /** probe: el cursor enciende la curva que tiene debajo · trail: deja una estela */
  cursor?: 'probe' | 'trail' | 'none';
  radius?: number;
  decay?: number;
  /** lectura del cursor sobre el campo (z = altura 0–1) */
  onProbe?: (p: { x: number; y: number; z: number } | null) => void;
  /** densidad máxima al dibujar una imagen (0–10): baja = trazo de plotter, alta = tono */
  srcTop?: number;
  /** opacidad de los glifos cuando dibuja una imagen */
  srcFade?: number;
  /** umbral de borde para trazar contornos de la imagen */
  edge?: number;
  /** por debajo de este tono la imagen queda en blanco (0–1) */
  srcLow?: number;
  /** radio (px) alrededor del cursor en el que se enciende la curva */
  litRadius?: number;
}

type SourceEl = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

const RAMP = ' .·:-=+*%#@'; // densidad
const DIRS = '-/|\\'; // trazos: 0°, 45°, 90°, 135°
const GLYPHS = RAMP + DIRS;
const STROKE = RAMP.length; // índice del primer trazo
const SCAN = RAMP.indexOf('#'); // frente del barrido

/** copia profunda: los colores se interpolan in situ y no deben compartir arrays */
const clone = (s: PlotterState): PlotterState => ({
  ...s,
  bg: [...s.bg] as RGB,
  ink: [...s.ink] as RGB,
  hot: [...s.hot] as RGB,
});

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
uniform vec2 uRes;uniform vec2 uCell;uniform vec2 uGrid;
uniform sampler2D uVal;uniform sampler2D uAtlas;uniform float uGlyphs;
uniform vec3 uInk;uniform vec3 uHot;uniform vec3 uBg;uniform float uFade;
uniform sampler2D uPhoto;uniform float uReveal;uniform vec4 uPhotoUV;
void main(){
  vec2 f=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 c=floor(f/uCell);vec2 k=fract(f/uCell);
  vec4 v=texture2D(uVal,(c+.5)/uGrid);
  float i=floor(v.r*255.+.5);
  float a=texture2D(uAtlas,vec2((i+k.x)/uGlyphs,k.y)).a*mix(uFade,1.,v.a);
  vec3 o=mix(uBg,mix(uInk,uHot,v.a),a);
  if(uReveal>.5){vec3 ph=texture2D(uPhoto,f*uPhotoUV.xy+uPhotoUV.zw).rgb;o=mix(o,ph,smoothstep(.32,.78,v.a));}
  gl_FragColor=vec4(o,1.);
}`;

/* ---------- ruido ---------- */
const P = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h: number, x: number, y: number) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
function perlin(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const X = xi & 255, Y = yi & 255;
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const aa = P[P[X] + Y], ab = P[P[X] + Y + 1], ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
  const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
  const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
  return x1 + v * (x2 - x1); // ~[-1, 1]
}
function fbm(x: number, y: number) {
  return perlin(x, y) * 0.62 + perlin(x * 2.03 + 17.1, y * 2.03 - 9.7) * 0.27 + perlin(x * 4.1 - 3.3, y * 4.1 + 5.2) * 0.11;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** dirección de la tangente (px, y hacia abajo) → índice de trazo 0–3 */
const strokeFor = (gx: number, gy: number) => {
  let a = Math.atan2(-gx, -gy);
  if (a < 0) a += Math.PI;
  return Math.round(a / (Math.PI / 4)) & 3;
};

export class Plotter {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private atlasTex!: WebGLTexture;
  private valTex!: WebGLTexture;
  private photoTex!: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};

  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private cellW = 7; // px css
  private cellH = 12;
  private cols = 0;
  private rows = 0;

  private vals = new Uint8Array(0);
  private field = new Float32Array(0);
  private heat = new Float32Array(0);
  private rand = new Float32Array(0);
  private from = new Uint8Array(0);
  private last = new Uint8Array(0);
  private srcLum: Float32Array | null = null;
  private srcDir: Int8Array | null = null;
  /** brillo de cada curva de nivel encendida por el cursor */
  private lit = new Float32Array(32);

  private sample = document.createElement('canvas');
  private sctx = this.sample.getContext('2d', { willReadFrequently: true })!;
  private source: SourceEl | null = null;
  private sourceBox: { x: number; y: number; w: number; h: number } | null = null;
  private transT0 = -1e9;
  private transDur = 900;
  private reveal: HTMLImageElement | null = null;

  private state: PlotterState;
  private target: PlotterState;
  private stateFrom: PlotterState;
  private stateT0 = 0;
  private fade = 1;

  private mx = -1e4;
  private my = -1e4;
  private pmx = -1e4;
  private pmy = -1e4;
  private moved = false;
  private scrolled = false;
  private probing = false;

  private running = false;
  private raf = 0;
  private lastStep = 0;
  private t0 = performance.now();
  private reduced: boolean;
  private font: string;

  private host: HTMLElement | null;
  private cellBase: number;
  private scrollDrift: boolean;
  private cursor: 'probe' | 'trail' | 'none';
  private radius: number;
  private decayRate: number;
  private onProbe?: PlotterOptions['onProbe'];
  private srcTop: number;
  private srcFade: number;
  private edge: number;
  private srcLow: number;
  private litRadius: number;
  private lmx = -1e4;
  private lmy = -1e4;
  private visible = true;

  constructor(canvas: HTMLCanvasElement, initial: PlotterState, font: string, opts: PlotterOptions = {}) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('webgl');
    this.gl = gl;
    this.canvas = canvas;
    this.font = font;
    this.host = opts.host ?? null;
    this.cellBase = opts.cell ?? 13;
    this.scrollDrift = opts.scrollDrift ?? !opts.host;
    this.cursor = opts.cursor ?? 'probe';
    this.radius = opts.radius ?? 5.5;
    this.decayRate = opts.decay ?? 0.9;
    this.onProbe = opts.onProbe;
    this.srcTop = opts.srcTop ?? 3;
    this.srcFade = opts.srcFade ?? 0.9;
    this.edge = opts.edge ?? 0.3;
    this.srcLow = opts.srcLow ?? 0;
    this.litRadius = opts.litRadius ?? 1e6;
    this.state = clone(initial);
    this.target = clone(initial);
    this.stateFrom = clone(initial);
    this.fade = initial.intensity;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.host ?? document.documentElement);
    addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        if (this.host) {
          const r = this.canvas.getBoundingClientRect();
          this.mx = e.clientX - r.left;
          this.my = e.clientY - r.top;
        } else {
          this.mx = e.clientX;
          this.my = e.clientY;
        }
        this.moved = true;
      },
      { passive: true },
    );
    document.addEventListener('pointerleave', () => {
      this.mx = this.my = this.pmx = this.pmy = -1e4;
      this.moved = true;
    });
    if (this.scrollDrift) addEventListener('scroll', () => (this.scrolled = true), { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.visible && this.start()));
    if (this.host) {
      new IntersectionObserver(
        ([e]) => {
          this.visible = e.isIntersecting;
          this.visible ? this.start() : this.stop();
        },
        { rootMargin: '80px' },
      ).observe(this.host);
    }
  }

  private init() {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uCell', 'uGrid', 'uVal', 'uAtlas', 'uGlyphs', 'uInk', 'uHot', 'uBg', 'uFade', 'uPhoto', 'uReveal', 'uPhotoUV']) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    const tex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.valTex = tex();
    this.atlasTex = tex();
    gl.activeTexture(gl.TEXTURE2);
    this.photoTex = tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.uniform1i(this.u.uVal, 0);
    gl.uniform1i(this.u.uAtlas, 1);
    gl.uniform1i(this.u.uPhoto, 2);
    gl.uniform1f(this.u.uReveal, 0);
  }

  private buildAtlas() {
    const gl = this.gl;
    const w = Math.round(this.cellW * this.dpr);
    const h = Math.round(this.cellH * this.dpr);
    const c = document.createElement('canvas');
    c.width = w * GLYPHS.length;
    c.height = h;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `400 ${Math.round(this.cellH * 0.86 * this.dpr)}px ${this.font}`;
    for (let i = 0; i < GLYPHS.length; i++) x.fillText(GLYPHS[i], i * w + w / 2, h / 2 + this.dpr * 0.5);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.uniform1f(this.u.uGlyphs, GLYPHS.length);
    gl.uniform2f(this.u.uCell, w, h);
  }

  resize() {
    const vw = this.host ? this.host.clientWidth : innerWidth;
    const vh = this.host ? this.host.clientHeight : Math.max(innerHeight, document.documentElement.clientHeight);
    if (!vw || !vh) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const small = innerWidth < 720;
    const cellH = small ? Math.round(this.cellBase * 0.85) : this.cellBase;
    const cellW = Math.round(cellH * 0.6);
    if (vw === this.cssW && vh === this.cssH && dpr === this.dpr && cellH === this.cellH) return;
    this.cssW = vw;
    this.cssH = vh;
    this.dpr = dpr;
    this.cellH = cellH;
    this.cellW = cellW;
    const cw = Math.round(cellW * dpr), ch = Math.round(cellH * dpr);
    this.canvas.width = Math.ceil((vw * dpr) / cw) * cw;
    this.canvas.height = Math.ceil((vh * dpr) / ch) * ch;
    this.canvas.style.width = `${this.canvas.width / dpr}px`;
    this.canvas.style.height = `${this.canvas.height / dpr}px`;
    this.cols = this.canvas.width / cw;
    this.rows = this.canvas.height / ch;
    const n = this.cols * this.rows;
    this.vals = new Uint8Array(n * 2);
    this.field = new Float32Array(n);
    this.heat = new Float32Array(n);
    this.from = new Uint8Array(n);
    this.last = new Uint8Array(n);
    this.rand = new Float32Array(n);
    for (let i = 0; i < n; i++) this.rand[i] = Math.random();
    this.sample.width = this.cols;
    this.sample.height = this.rows;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.u.uGrid, this.cols, this.rows);
    this.buildAtlas();
    this.mapReveal();
    if (this.source) this.readSource();
    this.step(performance.now());
  }

  /** Cambia de lámina: colores e intensidad con una transición suave. */
  setState(next: Partial<PlotterState>) {
    this.stateFrom = clone(this.state);
    this.target = clone({ ...this.target, ...next });
    this.stateT0 = performance.now();
    if (this.reduced) this.state = clone(this.target);
  }

  /** Dibuja una imagen o video en ASCII; `box` limita la zona (px css del host o la ventana). */
  setSource(el: SourceEl | null, box?: { x: number; y: number; w: number; h: number }) {
    if (el === this.source && !box) return;
    this.from.set(this.last);
    this.transT0 = performance.now();
    this.source = el;
    this.sourceBox = box ?? null;
    this.srcLum = null;
    this.srcDir = null;
    if (el) this.readSource();
  }

  /** Debajo de los glifos queda la foto: el calor del cursor la revela. */
  setReveal(img: HTMLImageElement) {
    const gl = this.gl;
    this.reveal = img;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform1f(this.u.uReveal, 1);
    this.mapReveal();
  }

  /** el mismo recorte "cover" que readSource, en px de dispositivo */
  private mapReveal() {
    const img = this.reveal;
    if (!img || !img.naturalWidth || !this.cssW) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const boxAspect = this.cssW / this.cssH;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (iw / ih > boxAspect) { sw = ih * boxAspect; sx = (iw - sw) / 2; }
    else { sh = iw / boxAspect; sy = (ih - sh) / 2; }
    const k = this.dpr;
    this.gl.uniform4f(this.u.uPhotoUV, sw / (iw * this.cssW * k), sh / (ih * this.cssH * k), sx / iw, sy / ih);
  }

  private readSource() {
    const el = this.source;
    if (!el) return;
    const iw = el instanceof HTMLVideoElement ? el.videoWidth : el instanceof HTMLImageElement ? el.naturalWidth : el.width;
    const ih = el instanceof HTMLVideoElement ? el.videoHeight : el instanceof HTMLImageElement ? el.naturalHeight : el.height;
    if (!iw || !ih) return;
    const { cols, rows, cellW, cellH } = this;
    const ctx = this.sctx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cols, rows);
    const b = this.sourceBox ?? { x: 0, y: 0, w: this.cssW, h: this.cssH };
    // caja destino en celdas
    const dx = b.x / cellW, dy = b.y / cellH, dw = b.w / cellW, dh = b.h / cellH;
    // recorte "cover" respetando el aspecto real (las celdas no son cuadradas)
    const boxAspect = b.w / b.h, imgAspect = iw / ih;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (imgAspect > boxAspect) { sw = ih * boxAspect; sx = (iw - sw) / 2; }
    else { sh = iw / boxAspect; sy = (ih - sh) / 2; }
    try {
      ctx.drawImage(el, sx, sy, sw, sh, dx, dy, dw, dh);
      const d = ctx.getImageData(0, 0, cols, rows).data;
      const n = cols * rows;
      const lum = this.srcLum && this.srcLum.length === n ? this.srcLum : new Float32Array(n);
      for (let i = 0; i < n; i++) lum[i] = 1 - (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
      // estira el contraste para que la imagen se lea en pocas densidades
      let lo = 1, hi = 0;
      for (let i = 0; i < n; i++) { const v = lum[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      const span = Math.max(hi - lo, 0.2);
      const low = this.srcLow;
      for (let i = 0; i < n; i++) lum[i] = Math.pow(clamp01(((lum[i] - lo) / span - low) / (1 - low)), 1.15);
      // bordes: donde la imagen cambia fuerte, un trazo que sigue el contorno
      const dir = this.srcDir && this.srcDir.length === n ? this.srcDir : new Int8Array(n);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const gx = lum[c < cols - 1 ? i + 1 : i] - lum[c > 0 ? i - 1 : i];
          const gy = lum[r < rows - 1 ? i + cols : i] - lum[r > 0 ? i - cols : i];
          dir[i] = Math.hypot(gx, gy) > this.edge ? strokeFor(gx / cellW, gy / cellH) : -1;
        }
      }
      this.srcLum = lum;
      this.srcDir = dir;
    } catch {
      this.srcLum = null;
      this.srcDir = null;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const busy =
        this.moved ||
        this.scrolled ||
        this.probing ||
        t - this.transT0 < this.transDur + 50 ||
        t - this.stateT0 < 800 ||
        this.source instanceof HTMLVideoElement;
      const interval = this.reduced ? 1e9 : busy ? 16 : 40;
      if (t - this.lastStep < interval) return;
      this.step(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private step(now: number) {
    this.lastStep = now;
    const { cols, rows, cellW, cellH } = this;
    if (!cols || !rows) return;

    // estado (colores/intensidad) con ease-out exponencial
    const sp = this.reduced ? 1 : clamp01((now - this.stateT0) / 700);
    const se = 1 - Math.pow(2, -10 * sp);
    const s = this.state;
    for (let i = 0; i < 3; i++) {
      s.bg[i] = lerp(this.stateFrom.bg[i], this.target.bg[i], se);
      s.ink[i] = lerp(this.stateFrom.ink[i], this.target.ink[i], se);
      s.hot[i] = lerp(this.stateFrom.hot[i], this.target.hot[i], se);
    }
    s.intensity = lerp(this.stateFrom.intensity, this.target.intensity, se);
    s.bands = lerp(this.stateFrom.bands, this.target.bands, se);

    const src = this.srcLum;
    const fadeTo = src ? this.srcFade : s.intensity;
    this.fade = this.reduced ? fadeTo : this.fade + (fadeTo - this.fade) * 0.14;

    if (this.source instanceof HTMLVideoElement && !this.source.paused) this.readSource();

    const inside = this.mx >= 0 && this.my >= 0 && this.mx < this.cssW && this.my < this.cssH;

    // estela: deposita calor a lo largo del trazo del cursor
    const heat = this.heat;
    const trail = this.cursor === 'trail' && !this.reduced;
    if (trail) {
      for (let i = 0; i < heat.length; i++) heat[i] *= this.decayRate;
      if (this.mx > -1e3) {
        const ax = this.pmx < -1e3 ? this.mx : this.pmx;
        const ay = this.pmy < -1e3 ? this.my : this.pmy;
        const dist = Math.hypot(this.mx - ax, this.my - ay);
        const steps = Math.max(1, Math.ceil(dist / (cellW * 2)));
        const R = this.radius;
        const amp = Math.min(1, 0.35 + dist / 90);
        for (let k = 1; k <= steps; k++) {
          const px = lerp(ax, this.mx, k / steps) / cellW;
          const py = lerp(ay, this.my, k / steps) / cellH;
          const c0 = Math.max(0, Math.floor(px - R)), c1 = Math.min(cols - 1, Math.ceil(px + R));
          const r0 = Math.max(0, Math.floor(py - R * 0.6)), r1 = Math.min(rows - 1, Math.ceil(py + R * 0.6));
          for (let r = r0; r <= r1; r++) {
            const dy = (r + 0.5 - py) / 0.6;
            for (let c = c0; c <= c1; c++) {
              const dx = c + 0.5 - px;
              const d2 = (dx * dx + dy * dy) / (R * R);
              if (d2 >= 1) continue;
              const i = r * cols + c;
              const h = heat[i] + amp * (1 - d2) * (1 - d2) * 0.5;
              heat[i] = h > 1 ? 1 : h;
            }
          }
        }
        this.pmx = this.mx;
        this.pmy = this.my;
      }
    }
    this.moved = false;
    this.scrolled = false;

    // campo: alturas que derivan con el tiempo y el scroll
    const t = this.reduced ? 12 : (now - this.t0) / 1000;
    const sy = this.scrollDrift ? scrollY / this.cssH : 0;
    const scale = 1 / (this.cssH * 0.55);
    const field = this.field;
    for (let r = 0; r < rows; r++) {
      const y = r * cellH * scale + sy * 0.35 - t * 0.012;
      for (let c = 0; c < cols; c++) {
        field[r * cols + c] = fbm(c * cellW * scale + t * 0.018, y) * 0.5 + 0.5;
      }
    }

    // sonda: la curva de nivel que pasa bajo el cursor se enciende
    const bands = s.bands;
    let probeK = -1;
    if (this.cursor === 'probe' && inside && !src) {
      const z = field[Math.floor(this.my / cellH) * cols + Math.floor(this.mx / cellW)];
      probeK = Math.round(z * bands);
      this.lmx = this.mx;
      this.lmy = this.my;
      this.onProbe?.({ x: this.mx, y: this.my, z });
    } else if (this.probing && probeK < 0 && this.cursor === 'probe') {
      this.onProbe?.(null);
    }
    const lit = this.lit;
    let anyLit = false;
    for (let k = 0; k < lit.length; k++) {
      lit[k] += ((k === probeK ? 1 : 0) - lit[k]) * (this.reduced ? 1 : 0.16);
      if (lit[k] > 0.01) anyLit = true;
    }
    this.probing = probeK >= 0 || anyLit;
    const litGain = 0.35 + 0.65 * s.intensity;

    const tp = clamp01((now - this.transT0) / this.transDur);
    const transitioning = tp < 1 && !this.reduced;
    const dir = this.srcDir;
    const vals = this.vals, last = this.last, from = this.from, rand = this.rand;
    const top = RAMP.length - 1;
    for (let r = 0; r < rows; r++) {
      const rowN = r / rows;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let g = 0;
        let hot = 0;
        if (src && dir) {
          g = dir[i] >= 0 ? STROKE + dir[i] : Math.round(Math.pow(src[i], 1.25) * this.srcTop);
        } else {
          const n = field[i];
          // distancia a la curva más cercana, medida en celdas
          const gx = (field[c < cols - 1 ? i + 1 : i] - field[c > 0 ? i - 1 : i]) * 0.5;
          const gy = (field[r < rows - 1 ? i + cols : i] - field[r > 0 ? i - cols : i]) * 0.5;
          const b = (n * bands) % 1;
          const d = Math.min(b, 1 - b) / (bands * Math.hypot(gx, gy) + 1e-5);
          if (d < 0.5) {
            g = STROKE + strokeFor(gx / cellW, gy / cellH);
            hot = lit[Math.round(n * bands)] * litGain;
            if (hot > 0.01) {
              // solo cerca del cursor: una linterna sobre la curva
              const f = clamp01(1 - Math.hypot((c + 0.5) * cellW - this.lmx, (r + 0.5) * cellH - this.lmy) / this.litRadius);
              hot *= f * f * (3 - 2 * f);
            }
          } else if (d < 1.5 && rand[i] < 0.5) {
            g = 1; // '.' a la sombra de la curva
          }
        }
        if (trail) {
          const h = heat[i];
          if (h > 0.02) {
            if (g < STROKE) g = Math.round(clamp01(g / top + h * 0.75) * top);
            if (h > hot) hot = h;
          }
        }
        if (transitioning) {
          // barrido: cada celda cambia al pasar el frente, con algo de ruido
          const x = tp * 1.18 - (rowN * 0.55 + rand[i] * 0.45);
          if (x < 0) {
            g = from[i];
            hot = 0;
          } else if (x < 0.05) {
            g = SCAN;
            hot = 0.9;
          }
        }
        last[i] = g;
        vals[i * 2] = g;
        vals[i * 2 + 1] = hot * 255;
      }
    }

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.valTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, cols, rows, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, vals);
    gl.uniform3f(this.u.uBg, s.bg[0] / 255, s.bg[1] / 255, s.bg[2] / 255);
    gl.uniform3f(this.u.uInk, s.ink[0] / 255, s.ink[1] / 255, s.ink[2] / 255);
    gl.uniform3f(this.u.uHot, s.hot[0] / 255, s.hot[1] / 255, s.hot[2] / 255);
    gl.uniform1f(this.u.uFade, this.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
