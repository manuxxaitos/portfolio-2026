// Mide los efectos de src/scripts/sound.ts (render fuera de línea, en Chrome, contra el servidor de desarrollo)
// y propone el volumen de cada uno para que cada familia suene pareja: la burbuja es la referencia y las
// demás suben unos dB fijos por encima. Mide la energía en una ventana fija de 400 ms (un sonido corto se oye
// más bajo que uno largo con el mismo pico).
// Uso: node tools/qa/sonidos.mjs   (con `npm run dev` andando; URL en DEV, por defecto http://127.0.0.1:4322/)
import path from 'node:path';
import {createRequire} from 'node:module';

const req = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/node_modules/x.js'));
const {chromium} = req('playwright');
const dev = process.env.DEV || 'http://127.0.0.1:4322/';
/** cuántos dB sobre la burbuja va cada familia */
const ABOVE = {burbuja: 0, cambio: 4, accion: 7, resultado: 9, entrada: 4};

const b = await chromium.launch({channel: 'chrome'});
const p = await b.newPage();
await p.goto(dev, {waitUntil: 'load'});
const rows = await p.evaluate(async () => {
  const {SOUNDS} = await import('/src/scripts/sound.ts');
  const out = [];
  for (const [name, fx] of Object.entries(SOUNDS)) {
    const sr = 44100;
    const ctx = new OfflineAudioContext(1, Math.round(sr * 0.8), sr);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    fx.play({ctx, out: g, t: 0.01});
    const d = (await ctx.startRendering()).getChannelData(0);
    let peak = 0, e = 0, last = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const win = Math.round(sr * 0.4);
    for (let i = 0; i < win; i++) e += d[i] * d[i];
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak * 0.00316) last = i;
    out.push({name, family: fx.family, vol: fx.vol, e1: 10 * Math.log10(e / win), peak1: 20 * Math.log10(peak), ms: Math.round((last / sr) * 1000) - 10});
  }
  return out;
});
await b.close();
const db = (v) => 20 * Math.log10(v);
const ref = rows.find((r) => r.name === 'pop');
const refE = ref.e1 + db(ref.vol);
console.log('referencia: pop a', ref.vol, '→', refE.toFixed(1), 'dB');
console.table(
  rows.map((r) => {
    const target = refE + ABOVE[r.family];
    const vol = Math.pow(10, (target - r.e1) / 20);
    return {efecto: r.name, familia: r.family, 'vol actual': r.vol, 'dB actual': +(r.e1 + db(r.vol)).toFixed(1), 'dB objetivo': +target.toFixed(1), 'vol sugerido': +vol.toFixed(3), 'pico (dB)': +(r.peak1 + db(vol)).toFixed(1), ms: r.ms};
  }),
);
