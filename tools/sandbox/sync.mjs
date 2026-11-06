// Trae las piezas del sandbox desde exploraciones/, que es donde se hacen y se editan: cada dist/ es una página suelta y
// acá queda en public/sandbox/<slug>/, con su propio link. Le agrega a la copia lo que hace falta para compartir ese link
// (canónica, descripción y vista previa), sin tocar el original. Correr después de reconstruir una pieza allá:
//   node tools/sandbox/sync.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const from = path.resolve(root, '../exploraciones');
const site = 'https://tomascardozo.com';
const piezas = [
  {slug: 'ukiyo', src: 'ukiyo-mac/dist/index.html', desc: 'Una carta que lleva el viento por cinco grabados vivos. El viento sos vos.'},
  {slug: 'kora', src: 'kora-diorama/dist/kora.html', desc: 'Kora en un santuario frente al Fuji: una escena 3D en vivo, impresa en ASCII como estampilla.'},
  {slug: 'lopez-vivo', src: 'lopez-vivo/dist/index.html', desc: 'Un óleo vivo a la manera de Cándido López: el campo después de la batalla, con humo, viento, agua, sonido y la tarde que cae.'},
  {slug: 'lopez-itapiru', src: 'lopez-itapiru/dist/index.html', desc: 'Un óleo vivo según Cándido López: la llegada del Ejército Aliado a Itapirú, con sus batallones, los barcos, el río, el sonido y la noche de la marcha.'},
];

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
for (const {slug, src, desc} of piezas) {
  let html = fs.readFileSync(path.join(from, src), 'utf8');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) throw new Error(`${src} no tiene <title>`);
  const url = `${site}/sandbox/${slug}/`;
  const head = [
    !/<meta name="description"/.test(html) && `<meta name="description" content="${attr(desc)}">`,
    !/<link rel="icon"/.test(html) && `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="es_AR">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${site}/media/sandbox/${slug}.jpg">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n');
  html = html.replace('</title>', `</title>\n${head}`);
  const out = path.join(root, 'public/sandbox', slug);
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log(`${slug}: ${(html.length / 1048576).toFixed(1)} MB desde ${src}`);
}
