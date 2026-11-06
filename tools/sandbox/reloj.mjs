// Lo común para grabar una pieza del sandbox: Chrome con GPU real y un reloj que avanza cuadro por cuadro, así el video
// no depende de la velocidad de la máquina. La página corre libre hasta que arranca; después solo avanza con paso().
import path from 'node:path';
import {createRequire} from 'node:module';

const req = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/node_modules/x.js'));
const {chromium} = req('playwright');

export const lanzar = () => chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--enable-webgl', '--enable-gpu-rasterization', '--use-angle=metal'],
});

const RELOJ = `(() => {
  const raf = window.requestAnimationFrame.bind(window);
  let t = 0, libre = true, id = 0;
  const cola = new Map();
  performance.now = () => t;
  window.requestAnimationFrame = (cb) => (cola.set(++id, cb), id);
  window.cancelAnimationFrame = (i) => cola.delete(i);
  const correr = () => {
    const cbs = [...cola.values()];
    cola.clear();
    cbs.forEach((cb) => cb(t));
  };
  const suelto = () => {
    if (!libre) return;
    t += 1000 / 60;
    correr();
    raf(suelto);
  };
  raf(suelto);
  window.__reloj = {
    frenar: () => { libre = false; },
    paso: (ms) => new Promise((ok) => raf(() => { t += ms; correr(); raf(() => ok()); })),
  };
})();`;

export async function abrir(b, archivo, {w = 1440, h = 900, dpr = 2} = {}) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: dpr});
  const p = await ctx.newPage();
  p.errores = [];
  p.on('pageerror', (e) => p.errores.push(e.message));
  p.on('console', (m) => m.type() === 'error' && p.errores.push(m.text()));
  await p.addInitScript(RELOJ);
  await p.goto('file://' + archivo);
  return p;
}
