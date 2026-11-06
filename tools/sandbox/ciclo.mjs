// Convierte un tramo de video en un loop sin salto: el final se funde con el principio.
// Uso: import {ciclo}. Escribe tools/sandbox/src/<nombre>.mp4, que después pasa por tools/media.py.
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src');

/** desde: dónde arranca el tramo · dura: cuánto dura el loop · funde: segundos de fundido · crop: "w:h:x:y" */
export function ciclo(entrada, nombre, {desde = 0, dura, funde = 0.8, crop}) {
  fs.mkdirSync(src, {recursive: true});
  const c = crop ? `crop=${crop},` : '';
  const f = [
    `[0:v]${c}split[a][b]`,
    `[a]trim=0:${funde},setpts=PTS-STARTPTS[cabeza]`,
    `[b]trim=${funde}:${dura + funde},setpts=PTS-STARTPTS[cuerpo]`,
    `[cuerpo][cabeza]xfade=transition=fade:duration=${funde}:offset=${dura - funde},format=yuv420p[v]`,
  ].join(';');
  const salida = path.join(src, `${nombre}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(desde), '-t', String(dura + funde + 0.1), '-i', entrada,
    '-filter_complex', f, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', salida]);
  return salida;
}
