// Revisa el logo 3D de AISH: triangula la cara (src/aish/logo3d.js) y guarda los triángulos en JSON para cruzarlos
// con la máscara (tools/aish/revisar.py). Un triángulo con el centro fuera del dibujo es una astilla.
// Uso: node tools/aish/revisar.mjs && python3 tools/aish/revisar.py   (con `npm run dev` andando)
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/node_modules/x.js'));
const {chromium} = req('playwright');
const b = await chromium.launch({channel: 'chrome'});
const p = await b.newPage();
await p.goto(process.env.DEV || 'http://127.0.0.1:4322/', {waitUntil: 'load'});
const tris = await p.evaluate(async () => (await import('/src/aish/logo3d.js')).logoTriangles());
await b.close();
fs.writeFileSync(path.join(here, 'src', 'triangulos.json'), JSON.stringify(tris));
console.log('triángulos', tris.length);
