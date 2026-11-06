// Los loops de los dos López salen de sus películas, en un tramo donde la cámara se queda quieta, sin el borde de papel.
// Correr: node tools/sandbox/lopez.mjs && python3 tools/media.py tools/manifest.json --only sandbox/lopez --force
import path from 'node:path';
import {ciclo} from './ciclo.mjs';

const ex = path.join(process.env.HOME, 'main/02-Personal/exploraciones');
ciclo(path.join(ex, 'lopez-vivo/out/despues-al-caer-la-tarde.mp4'), 'lopez-vivo', {desde: 18.4, dura: 4.8, crop: '1248:780:600:125'});
ciclo(path.join(ex, 'lopez-itapiru/out/llegada-a-itapiru.mp4'), 'lopez-itapiru', {desde: 27, dura: 5.2, crop: '1560:780:260:120'});
