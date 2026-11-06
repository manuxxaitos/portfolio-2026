/**
 * La entrada de la portada: al llegar se ve solo la presentación, centrada. Las palabras aparecen de a una, cada frase con
 * una nota muy baja, y después el texto sube a su lugar y el Sandbox llega detrás, con el mismo movimiento.
 *
 * Un script en Intro.astro decide antes de pintar si hay entrada (html.intro-on): no la hay con un ancla en la dirección, al
 * volver atrás, si recargás estando más abajo ni con movimiento reducido. Cualquier clic, tecla o scroll la adelanta.
 * Las palabras son de esta animación; subir es una transición de Intro.astro, que tarda LIFT.
 */
import type Lenis from 'lenis';
import { emit } from './events';
import { play, wake, type SoundName } from './sound';

/** papel solo, antes de la primera palabra */
const START = 350;
/** entre palabra y palabra, por frase: la última es larga y va más rápido */
const PER_WORD = [95, 95, 60];
/** entre frase y frase */
const PAUSE = 320;
/** lo que tarda en asentarse cada palabra */
const WORD = 1100;
/** quieto y entero antes de subir, para leerlo */
const HOLD = 1200;
const LIFT = 1500;
const NOTES: SoundName[] = ['nota1', 'nota2', 'nota3'];
const SKIP = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/** parte una frase en palabras; un link o un dato en negrita es una palabra entera */
function split(line: HTMLElement) {
  const units: HTMLElement[] = [];
  for (const node of [...line.childNodes]) {
    if (node instanceof HTMLElement) {
      if (node.classList.contains('sr-only')) continue;
      node.classList.add('iw');
      units.push(node);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const words = document.createDocumentFragment();
      for (const part of (node.textContent ?? '').split(/(\s+)/)) {
        if (!part) continue;
        const prev = units.at(-1);
        if (/^\s/.test(part)) words.append(' ');
        else if (prev && !words.childNodes.length && node.previousSibling === prev) {
          // la coma o el punto pegados a un link van con él: que nunca queden solos en otro renglón
          const both = document.createElement('span');
          both.className = 'iw';
          prev.classList.remove('iw');
          prev.replaceWith(both);
          both.append(prev, part);
          units[units.length - 1] = both;
        } else {
          const w = document.createElement('span');
          w.className = 'iw';
          w.textContent = part;
          words.append(w);
          units.push(w);
        }
      }
      node.replaceWith(words);
    }
  }
  return units;
}

export function intro(lenis?: Lenis) {
  // para saber, al recargar, si estabas más abajo
  addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem('intro-y', String(scrollY));
    } catch {
      /* sin almacenamiento: al recargar vuelve la entrada */
    }
  });

  const html = document.documentElement;
  const box = document.querySelector<HTMLElement>('.intro');
  if (!box || !html.classList.contains('intro-on')) return;
  html.classList.add('intro-run');
  lenis?.stop();
  wake();

  const lines = ([...box.children] as HTMLElement[]).map(split);
  const timers: number[] = [];
  let anims: Animation[] = [];
  let lifted = false;

  const finish = () => {
    anims.forEach((a) => a.cancel());
    html.classList.remove('intro-on', 'intro-run', 'intro-play', 'intro-go');
    html.style.removeProperty('--intro-y');
    emit('intro:end');
  };

  const lift = () => {
    if (lifted) return;
    lifted = true;
    timers.forEach(clearTimeout);
    SKIP.forEach((ev) => removeEventListener(ev, lift));
    // si la adelantaron, las palabras que faltaban llegan enseguida y mientras suben
    for (const a of anims) {
      if (a.playState === 'finished') continue;
      const delay = Number(a.effect?.getTiming().delay ?? 0);
      if (Number(a.currentTime ?? 0) < delay) a.currentTime = delay;
      a.updatePlaybackRate(3);
    }
    html.classList.add('intro-go');
    lenis?.start();
    play('subida');
    window.setTimeout(finish, LIFT);
  };

  const begin = () => {
    if (lifted) return;
    const pad = parseFloat(getComputedStyle(box).paddingTop);
    const top = box.getBoundingClientRect().top + pad;
    const height = box.offsetHeight - pad;
    // un poco arriba del centro exacto, que se ve bajo
    html.style.setProperty('--intro-y', `${Math.max(0, innerHeight * 0.47 - height / 2 - top)}px`);
    html.classList.add('intro-play');

    let at = START;
    lines.forEach((units, i) => {
      const note = at;
      timers.push(window.setTimeout(() => play(NOTES[i]), note));
      units.forEach((u, j) => {
        anims.push(
          u.animate(
            [
              { opacity: 0, translate: '0 0.5em', filter: 'blur(6px)' },
              { opacity: 1, translate: '0 0', filter: 'blur(0)' },
            ],
            { duration: WORD, delay: at + j * PER_WORD[i], easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
          ),
        );
      });
      at += units.length * PER_WORD[i] + PAUSE;
    });
    timers.push(window.setTimeout(lift, at - PAUSE + WORD * 0.7 + HOLD));
  };

  SKIP.forEach((ev) => addEventListener(ev, lift, { passive: true }));
  // las medidas valen con la tipografía final, y en una pestaña de fondo espera a que la miren
  Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 500))]).then(() => {
    if (!document.hidden) return begin();
    document.addEventListener('visibilitychange', begin, { once: true });
  });
}
