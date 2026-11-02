// Trae la escena de Kora desde exploraciones/kora-ascii, que es donde se hace y se edita. Copia los módulos de la
// escena (no main.js, que es la página de allá: acá la monta src/kora/mount.js) y las dos tipografías de la estampilla.
// Solo lee la carpeta de origen. Correr después de cambiar la escena allá: node tools/kora/sync.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const from = path.resolve(root, '../exploraciones/kora-ascii');
const scene = ['ascii.js', 'common.js', 'fur.js', 'kora.js', 'strands.js', 'world.js'];
const fonts = ['geist-latin.woff2', 'archivo-wide-latin.woff2'];

const outScene = path.join(root, 'src/kora/scene');
const outFonts = path.join(root, 'public/fonts/kora');
fs.mkdirSync(outScene, {recursive: true});
fs.mkdirSync(outFonts, {recursive: true});
for (const f of scene) {
  const src = fs.readFileSync(path.join(from, 'src', f), 'utf8');
  fs.writeFileSync(path.join(outScene, f), `// Copiado de exploraciones/kora-ascii/src/${f} con tools/kora/sync.mjs: no editar acá.\n${src}`);
}
for (const f of fonts) fs.copyFileSync(path.join(from, 'fonts', f), path.join(outFonts, f));
console.log(`Kora: ${scene.length} módulos y ${fonts.length} tipografías copiados desde ${path.relative(root, from)}`);
