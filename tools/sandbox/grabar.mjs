// Graba las capturas de ukiyo y de Kora desde sus páginas, cuadro por cuadro, a tools/sandbox/src/<nombre>.mp4.
// Correr: node tools/sandbox/grabar.mjs [ukiyo] [kora] && python3 tools/media.py tools/manifest.json --only sandbox/ --force
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {lanzar, abrir} from './reloj.mjs';
import {ciclo, src} from './ciclo.mjs';

const ex = path.join(process.env.HOME, 'main/02-Personal/exploraciones');
const FPS = 30, PASO = 1000 / FPS;
const quiero = process.argv.slice(2);
const pide = (n) => !quiero.length || quiero.includes(n);
const b = await lanzar();
const pasos = (p, n, ms = PASO) => p.evaluate(async ([n, ms]) => {
  for (let i = 0; i < n; i++) await window.__reloj.paso(ms);
}, [n, ms]);

/** una carpeta de cuadros a un video casi sin pérdida */
function pegar(dir, salida, vf) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'),
    '-vf', `${vf},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', salida]);
}

// ukiyo: un paso por los cinco grabados, del otoño a la nieve. Cada tramo arranca cuando pasa algo: seg es a qué segundo de
// esa parada empieza. El recorte saca el borde de papel y deja 16:10.
const TRAMOS = [
  {ep: 0, seg: 20.5}, // la carta se va con el viento
  {ep: 1, seg: 2}, // cae en el lago
  {ep: 2, seg: 8},
  {ep: 3, seg: 15}, // los paraguas en el puente
  {ep: 4, seg: 10}, // la nieve y el paraguas rojo
];
const DURA = 2.6, FUNDE = 0.6;
if (pide('ukiyo')) {
  const clips = [];
  for (const {ep, seg} of TRAMOS) {
    const p = await abrir(b, path.join(ex, 'ukiyo-mac/dist/index.html'));
    await p.waitForFunction(() => window.KAZE && window.KAZE.ready, null, {timeout: 30000});
    await p.addStyleTag({content: '#subs, #card { visibility: hidden !important; }'});
    await p.evaluate((e) => window.KAZE.goto(e), ep);
    await p.waitForFunction(() => window.KAZE.phase === 'card');
    await p.evaluate(() => window.KAZE.skipCard());
    await p.waitForFunction(() => window.KAZE.phase === 'play');
    await p.evaluate(() => window.__reloj.frenar());
    await pasos(p, Math.round((seg * 1000) / 50), 50);
    const clip = await (await p.$('#printWrap')).boundingBox();
    const dir = path.join(src, `ukiyo-${ep}`);
    fs.rmSync(dir, {recursive: true, force: true});
    fs.mkdirSync(dir, {recursive: true});
    const n = Math.round((DURA + FUNDE) * FPS);
    for (let i = 0; i < n; i++) {
      await pasos(p, 1);
      await p.screenshot({path: path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94, clip});
    }
    const salida = path.join(src, `ukiyo-${ep}.mp4`);
    pegar(dir, salida, 'crop=iw*0.86:iw*0.86*10/16:iw*0.07:ih*0.05');
    fs.rmSync(dir, {recursive: true, force: true});
    clips.push(salida);
    console.log(`ukiyo ${ep}`, JSON.stringify(clip), p.errores.slice(0, 2));
    await p.context().close();
  }
  // los cinco, fundidos en cadena; el último vuelve al primero
  const uno = DURA + FUNDE;
  let f = '';
  clips.forEach((_, i) => (f += `[${i}:v]settb=AVTB,fps=${FPS}[c${i}];`));
  let prev = 'c0', t = uno - FUNDE;
  for (let i = 1; i < clips.length; i++) {
    f += `[${prev}][c${i}]xfade=transition=fade:duration=${FUNDE}:offset=${t.toFixed(3)}[x${i}];`;
    prev = `x${i}`;
    t += uno - FUNDE;
  }
  const todo = path.join(src, 'ukiyo-todo.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...clips.flatMap((c) => ['-i', c]), '-filter_complex', f.replace(/;$/, ''), '-map', `[${prev}]`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', todo]);
  ciclo(todo, 'ukiyo', {dura: t, funde: FUNDE});
  clips.concat(todo).forEach((c) => fs.rmSync(c));
}

// Kora: del día a la noche y de vuelta, mirando a los costados. Va la zona de Kora y el torii, con las letras a su tamaño.
if (pide('kora')) {
  const T = 8, FUNDEK = 0.6;
  // ventana chica: la estampilla sale más chica y las letras llegan legibles al tamaño de la tarjeta
  const p = await abrir(b, path.join(ex, 'kora-diorama/dist/kora.html'), {w: 900, h: 800});
  await p.waitForFunction(() => window.KORA && window.KORA.ready, null, {timeout: 60000});
  await p.addStyleTag({content: '.value, .country { visibility: hidden !important; }'});
  await p.evaluate(() => {
    window.KORA.setDay(0.1);
    window.KORA.lookAt(0, 0.1);
  });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__reloj.frenar());
  await pasos(p, 30);
  const clip = await p.evaluate(() => {
    const r = document.getElementById('c').parentElement.getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
  });
  const dir = path.join(src, 'kora');
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const n = Math.round((T + FUNDEK) * FPS);
  for (let i = 0; i < n; i++) {
    const s = (i / FPS / T) * Math.PI * 2;
    await p.evaluate(([v, x, y]) => {
      window.KORA.setDay(v);
      window.KORA.lookAt(x, y);
    }, [0.53 - 0.43 * Math.cos(s), 0.34 * Math.sin(s), 0.1 + 0.1 * Math.sin(2 * s)]);
    await pasos(p, 1);
    await p.screenshot({path: path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95, clip});
  }
  const salida = path.join(src, 'kora-todo.mp4');
  pegar(dir, salida, 'null');
  fs.rmSync(dir, {recursive: true, force: true});
  console.log('kora', JSON.stringify(clip), p.errores.slice(0, 2));
  ciclo(salida, 'kora', {dura: T, funde: FUNDEK});
  await p.context().close();
}
await b.close();
