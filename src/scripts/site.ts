import Lenis from 'lenis';
import { Plotter } from './ascii';
import { compose, windows } from './windows';
import { buddy } from './buddy';
import { emit } from './events';
import { sound } from './sound';

type RGB = [number, number, number];
const PAPER: RGB = [245, 245, 243];
const SIGNAL: RGB = [255, 79, 0];
const MONO = '"Chivo Mono", ui-monospace, Menlo, monospace';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function boot() {
  sound(); // primero: escucha lo que avisan los demás
  const lenis = smoothScroll();
  revealOnScroll();
  lazyVideos();
  copyButtons();
  buddy(); // antes que las ventanas: escucha win:open
  windows(lenis);
  compose();
  plotters();
  pageWeight();
}

/* ------------------------------------------------------------------ */

/** Scroll con inercia: arranca suave, toma velocidad y frena con peso. */
function smoothScroll() {
  if (reduced) return undefined;
  const lenis = new Lenis({
    lerp: 0.075,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    anchors: { offset: -24, duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) },
  });
  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  return lenis;
}

/* ------------------------------------------------------------------ */

function revealOnScroll() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduced) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );
  // lo que ya está en pantalla al cargar aparece sin fundido
  const vh = innerHeight;
  els.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) el.classList.add('in', 'now');
    else io.observe(el);
  });
}

/* ------------------------------------------------------------------ */

/** Los loops no descargan nada hasta acercarse y se pausan fuera de pantalla. */
function lazyVideos() {
  const vids = [...document.querySelectorAll<HTMLVideoElement>('video[data-loop]')];
  if (!vids.length) return;
  const load = (v: HTMLVideoElement) => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    v.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((s) => (s.src = s.dataset.src!));
    v.load();
  };
  const near = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && load(e.target as HTMLVideoElement)),
    { rootMargin: '600px 0px' },
  );
  const onScreen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && !reduced) {
          load(v);
          v.play().catch(() => {});
        } else v.pause();
      }
    },
    { threshold: 0.15 },
  );
  vids.forEach((v) => {
    v.muted = true;
    near.observe(v);
    onScreen.observe(v);
  });
}

/* ------------------------------------------------------------------ */

function copyButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    const label = btn.querySelector<HTMLElement>('[data-copy-label]');
    const original = label?.textContent ?? '';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy!);
        if (label) label.textContent = 'Copiado';
        emit('copy:ok');
      } catch {
        location.href = `mailto:${btn.dataset.copy}`;
      }
      setTimeout(() => label && (label.textContent = original), 1800);
    });
  });
}

/* ------------------------------------------------------------------ */

/**
 * Campos ASCII: curvas de nivel suaves en el lugar de Kora y detrás del
 * contacto; la curva bajo el cursor se enciende. Sin WebGL queda el papel liso.
 */
function plotters() {
  const canvases = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-plotter]')];
  if (!canvases.length) return;
  // cada campo arranca cuando se acerca a la pantalla (y recién ahí baja su tipografía)
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        startPlotter(e.target as HTMLCanvasElement);
      }
    },
    { rootMargin: '600px 0px' },
  );
  canvases.forEach((c) => io.observe(c));
}

async function startPlotter(c: HTMLCanvasElement) {
  await Promise.race([document.fonts.load(`400 12px ${MONO}`), new Promise((r) => setTimeout(r, 1200))]);
  try {
    if (c.dataset.plotter === 'field') {
      const p = new Plotter(
        c,
        { bg: [...PAPER], ink: [196, 198, 193], hot: [...SIGNAL], intensity: 1, bands: 6 },
        MONO,
        { host: c.parentElement!, cell: 13, litRadius: 240 },
      );
      p.start();
    }
    c.classList.add('on');
  } catch {
    /* sin WebGL: queda el fondo liso */
  }
}

/* ------------------------------------------------------------------ */

/** Pie: cuánto pesó esta visita, medido por el navegador. */
function pageWeight() {
  const out = document.querySelector<HTMLElement>('[data-weight]');
  const kb = out?.querySelector<HTMLElement>('[data-weight-kb]');
  if (!out || !kb || !('getEntriesByType' in performance)) return;
  const report = () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    let bytes = nav?.transferSize ?? 0;
    for (const r of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) bytes += r.transferSize || 0;
    if (!bytes) return;
    kb.textContent = `${(bytes / 1048576).toFixed(2).replace('.', ',')} MB`;
    out.hidden = false;
  };
  new IntersectionObserver(([e]) => e.isIntersecting && report()).observe(out);
}
