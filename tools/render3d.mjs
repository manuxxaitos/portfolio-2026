// Saca las escenas 3D fijas de los proyectos (src/kench/toy.js, src/aish/logo3d.js) en un Chrome con GPU, contra el
// servidor de desarrollo. Guarda PNG en tools/<proyecto>/src/ (después tools/media.py los pasa a src/assets/work).
// Uso: node tools/render3d.mjs kench [family hero tokens neon]
//      node tools/render3d.mjs aish [hero cromo detalle bola estrellas]
//      node tools/render3d.mjs supplycon [hero familia escalones ladrillos]
// (con `npm run dev` corriendo; URL en DEV, por defecto http://127.0.0.1:4322/)
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODULES = {kench: '/src/kench/toy.js', aish: '/src/aish/logo3d.js', supplycon: '/src/supplycon/iso3d.js'};
const [project = 'kench', ...rest] = process.argv.slice(2);
const req = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/node_modules/x.js'));
const {chromium} = req('playwright');
const exe = path.join(process.env.HOME, 'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const dev = process.env.DEV || 'http://127.0.0.1:4322/';
const PRESETS = {kench: ['family', 'hero', 'tokens', 'neon'], aish: ['hero', 'cromo', 'detalle', 'bola', 'estrellas'], supplycon: ['hero', 'familia', 'escalones', 'ladrillos']};
const want = rest.length ? rest : PRESETS[project];

const b = await chromium.launch({executablePath: exe, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--enable-gpu-rasterization']});
const p = await b.newPage();
p.on('pageerror', (e) => console.error('pageerror', e.message));
await p.goto(dev, {waitUntil: 'load'});
for (const name of want) {
  const [w, h] = [2400, 1500];
  const url = await p.evaluate(async ([mod, name, w, h]) => {
    const m = await import(mod);
    return m.renderStill(name, w, h);
  }, [MODULES[project], name, w, h]);
  const out = path.join(here, project, 'src', `render-${name}.png`);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(out, w, h);
}
await b.close();
