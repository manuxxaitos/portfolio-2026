// Trae las piezas del sandbox desde exploraciones/, que es donde se hacen y se editan: cada dist/ es una página suelta y
// acá queda en public/sandbox/<slug>/, con su propio link. Le agrega a la copia lo que hace falta para compartir ese link
// (canónica, descripción y vista previa) y el link a su proyecto de Behance, sin tocar el original. El link va entre las
// marcas <!-- behance --> para que los armar-pieza de tools/behance lo saquen. Correr después de reconstruir una pieza allá:
//   node tools/sandbox/sync.mjs                 todas
//   node tools/sandbox/sync.mjs lopez-vivo      solo esa, para no traer una pieza que sigue a medio hacer
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const from = path.resolve(root, '../exploraciones');
const site = 'https://tomascardozo.com';
// el link se viste de cada pieza: su letra, su tinta y su color al pasar. La flecha y su salto son los del portfolio
const lopez = `
  #behance { font-size: 14px; opacity: .5; }
  #behance:hover, #behance:focus-visible { opacity: 1; }
  @media (min-width: 1081px) and (min-height: 481px) {
    #obra p { display: inline; }
    #behance::before { content: '·'; display: inline-block; margin: 0 .5em; }
  }
  @media (max-width: 1080px), (max-height: 480px) { #behance { display: block; width: fit-content; margin-top: 1px; } }
  @media (max-height: 480px) and (min-width: 701px) { #behance { font-size: 13px; } }`;
const obra = {
  texto: 'Ver más en Behance',
  antes: /<\/div>\s*<div id="mando">/,
  css: lopez,
};
const piezas = [
  {
    slug: 'ukiyo',
    src: 'ukiyo-mac/dist/index.html',
    desc: 'Una carta que lleva el viento por cinco grabados vivos. El viento sos vos.',
    behance: {
      url: 'https://www.behance.net/gallery/258158297/Kaze-no-tayori-Ukiyo-e-interactivo',
      texto: 'Ver más en Behance',
      antes: /<main id="sheet">/,
      // en el papel, tinta y al pasar el rojo del sello; en la Mac, el beige del gabinete y el ámbar del visor. Se va con el título
      css: `
  #behance { position: fixed; right: 16px; bottom: 14px; z-index: 61; font: 11px/1 var(--mono); color: #2a2826; opacity: .42; }
  #behance:hover, #behance:focus-visible { color: #c23b2b; opacity: 1; }
  body.mac #behance { color: #d6cdb7; }
  body.mac #behance:hover, body.mac #behance:focus-visible { color: #ffae4a; }
  body.inicio #behance { opacity: 0; pointer-events: none; }`,
    },
  },
  {
    slug: 'kora',
    src: 'kora-diorama/dist/kora.html',
    desc: 'Kora en un santuario frente al Fuji: una escena 3D en vivo, impresa en ASCII como estampilla.',
    behance: {
      url: 'https://www.behance.net/gallery/258158215/Kora-Diorama-3D-en-ASCII',
      // sigue la línea de atajos que hay debajo de la estampilla, con su misma letra y su mismo gris
      texto: 'ver más en Behance',
      antes: /<\/p>\s*<\/main>/,
      separador: ' · ',
      css: `
  #behance:hover, #behance:focus-visible { color: var(--strong); }`,
    },
  },
  {
    slug: 'lopez-vivo',
    src: 'lopez-vivo/dist/index.html',
    desc: 'Un óleo vivo a la manera de Cándido López: el campo después de la batalla, con humo, viento, agua, sonido y la tarde que cae.',
    behance: {...obra, url: 'https://www.behance.net/gallery/258154519/Despus-al-caer-la-tarde-Oleo-vivo'},
  },
  {
    slug: 'lopez-itapiru',
    src: 'lopez-itapiru/dist/index.html',
    desc: 'Un óleo vivo según Cándido López: la llegada del Ejército Aliado a Itapirú, con sus batallones, los barcos, el río, el sonido y la noche de la marcha.',
    behance: {...obra, url: 'https://www.behance.net/gallery/258158255/Llegada-a-Itapiru-Oleo-vivo'},
  },
];
const cssBehance = `
  #behance { color: inherit; text-decoration: none; white-space: nowrap; transition: opacity .4s cubic-bezier(.16, 1, .3, 1), color .3s cubic-bezier(.16, 1, .3, 1); }
  #behance svg { display: inline-block; width: .72em; height: .72em; margin-left: .3em; transition: transform .35s cubic-bezier(.34, 1.56, .64, 1); }
  #behance:hover svg, #behance:focus-visible svg { transform: translate(2px, -2px); }
  #behance:focus-visible { outline: 1.5px solid currentColor; outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) { #behance, #behance svg { transition: none; } #behance:hover svg, #behance:focus-visible svg { transform: none; } }`;
const flecha = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" transform="rotate(-45 8 8)"/></svg>`;
const marcas = (s) => `<!-- behance -->${s}<!-- /behance -->`;
const conBehance = (html, {url, texto, antes, separador = '', css}) => {
  if (!antes.test(html)) throw new Error(`No encontré dónde va el link a ${url}`);
  return html
    .replace('</head>', () => `${marcas(`<style>${cssBehance}${css}\n</style>`)}\n</head>`)
    .replace(antes, (m) => `${marcas(`${separador}<a id="behance" href="${url}" target="_blank" rel="noopener">${texto}${flecha}</a>`)}${m}`);
};

const pedidas = process.argv.slice(2);
const desconocida = pedidas.find((slug) => !piezas.some((p) => p.slug === slug));
if (desconocida) throw new Error(`No hay ninguna pieza ${desconocida}`);

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
for (const {slug, src, desc, behance} of piezas.filter((p) => !pedidas.length || pedidas.includes(p.slug))) {
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
  html = conBehance(html.replace('</title>', `</title>\n${head}`), behance);
  const out = path.join(root, 'public/sandbox', slug);
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log(`${slug}: ${(html.length / 1048576).toFixed(1)} MB desde ${src}`);
}
