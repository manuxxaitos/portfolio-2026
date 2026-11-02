/**
 * Burbuja compañera del cursor (components/Buddy.astro).
 *
 * Cuándo aparece, cuándo se va y cuándo suena, con una regla por contexto:
 * - En la página: aparece cuando apuntás algo con data-say y, mientras sigas apuntando cosas, solo cambia
 *   de frase. Se va un segundo después de que dejes de apuntar.
 * - En una ventana de proyecto: llega con la ventana y se queda mientras el puntero esté adentro. Sobre
 *   una pieza dice qué es; sobre lo demás cuenta el proyecto (data-says del <dialog>), una frase cada tanto.
 *   Se va si sacás el puntero de la ventana o la cerrás.
 * - Sola habla poco: saluda al llegar y, si dejás el puntero quieto un rato, dice algo de la sección que
 *   tenés a la vista (data-ambient). Esas frases se van solas.
 * - Suena (buddy:open, un pop bajito) solo cuando aparece porque moviste el puntero hacia algo. No suena al
 *   cambiar de frase, cuando habla sola, cuando llega con una ventana (ya suena la ventana) ni con el scroll.
 * - Varias frases separadas por « | » se encadenan mientras sigas ahí; la vez siguiente retoma donde quedó.
 * - Va arriba y a la derecha del puntero, con un resorte suave; se da vuelta cerca de los bordes y no
 *   intercepta clics. En pantallas táctiles no aparece; con movimiento reducido va pegada, sin resorte.
 * - Donde ya hay una conversación (data-buddy-off: el chat de contacto) se corre: se esconde mientras el
 *   puntero esté adentro y no habla sola.
 * - Otros pueden hacerla hablar con buddy:say (sin sonido).
 */
import { emit } from './events';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const H = 28;
/** de la punta del puntero a la burbuja: casi pegada, a la derecha y arriba (o abajo, cerca del borde de
    arriba, dejando lugar a la flecha del puntero) */
const GAP_X = 5;
const GAP_UP = 3;
const GAP_DOWN = 24;
const EDGE = 12;
const MAX_W = 320;
/** cuánto espera antes de aparecer sobre algo (así no parpadea al cruzar) y antes de irse al dejar de apuntar */
const DWELL = 140;
const GRACE = 1000;
/** en una ventana, cada cuánto pasa a la frase siguiente del proyecto */
const WIN_NEXT = 3600;
/** puntero quieto este tiempo: puede decir algo de la sección (como mucho PAGE_BUDGET veces por visita) */
const IDLE = 4000;
const PAGE_BUDGET = 3;

const greeting = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Buen día' : h >= 12 && h < 20 ? 'Buenas tardes' : 'Buenas noches';
};
const readFor = (s: string) => Math.min(Math.max(1600 + s.length * 45, 2200), 4200);
const list = (raw?: string) => {
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};
const phrases = (t: HTMLElement) => t.dataset.say!.split(' | ').map((s) => s.replace(/^!/, ''));

type Mode = 'point' | 'self' | 'window';
type Cause = 'pointer' | 'scroll';

export function buddy() {
  const el = document.querySelector<HTMLElement>('[data-buddy]');
  if (!el || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const pill = el.querySelector<HTMLElement>('.buddy__pill')!;
  const text = el.querySelector<HTMLElement>('.buddy__text')!;
  const ruler = el.querySelector<HTMLElement>('.buddy__ruler')!;
  document.documentElement.classList.add('has-buddy');

  let px = -1;
  let py = -1;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let w = 44;
  let left = false;
  let down = false;
  let raf = 0;
  let last = 0;
  let shown = false;
  let mode: Mode | null = null;
  /** lo que tiene una frase debajo del puntero */
  let target: HTMLElement | null = null;
  let win: HTMLDialogElement | null = null;
  let lastRealMove = 0;
  let pageCount = 0;
  /** el puntero está sobre algo que ya conversa (data-buddy-off) */
  let away = false;
  const said = new Set<string>();
  const timers = { dwell: 0, chain: 0, grace: 0, self: 0, idle: 0, next: 0, swap: 0 };
  const clear = (...k: (keyof typeof timers)[]) => k.forEach((n) => clearTimeout(timers[n]));

  /* ---------- posición ---------- */

  const place = () => {
    let tx = px + GAP_X;
    let ty = py - GAP_UP - H;
    const l = tx + w + EDGE > innerWidth;
    const d = ty < EDGE;
    if (l) tx = px - GAP_X - w;
    if (d) ty = py + GAP_DOWN;
    if (l !== left) el.classList.toggle('is-left', (left = l));
    if (d !== down) el.classList.toggle('is-down', (down = d));
    return [tx, ty];
  };
  const paint = (tilt = 0) => {
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
  };
  const snap = () => {
    [x, y] = place();
    vx = vy = 0;
    paint();
  };
  // resorte amortiguado: rigidez 170, fricción 17 (rebota apenas)
  const step = (t: number) => {
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    const [tx, ty] = place();
    vx += (170 * (tx - x) - 17 * vx) * dt;
    vy += (170 * (ty - y) - 17 * vy) * dt;
    x += vx * dt;
    y += vy * dt;
    paint(Math.max(-9, Math.min(9, vx * 0.012)));
    const still = Math.abs(tx - x) < 0.15 && Math.abs(ty - y) < 0.15 && Math.abs(vx) < 1 && Math.abs(vy) < 1;
    raf = still ? 0 : requestAnimationFrame(step);
  };
  const follow = () => {
    if (!shown || reduced) return snap();
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  };

  /* ---------- mostrar y esconder ---------- */

  // la voz de la burbuja: todo en minúscula y, en una de cada cuatro frases más o menos, una carita al final.
  // La elige la frase misma (siempre la misma para la misma frase), así no cambia ni titila al repetirse;
  // los nombres de piezas («título · artista») van sin carita
  const FACES = [':)', '.✦ ݁˖', '<𝟑', ':D', '˖ ࣪⊹'];
  const voice = (s: string) => {
    const t = s.toLocaleLowerCase('es');
    // la del contacto, siempre con corazón
    if (t === '¿charlamos?') return `${t} <𝟑`;
    if (t.includes(' · ') || t.length > 46) return t;
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    h = Math.abs(h);
    // cuál carita: otra mezcla del mismo número, para que no salga siempre la misma
    return h % 4 === 0 ? `${t} ${FACES[(Math.imul(h, 2654435761) >>> 27) % FACES.length]}` : t;
  };

  const widthFor = (s: string) => {
    ruler.textContent = s;
    return Math.min(Math.ceil(ruler.getBoundingClientRect().width) + 24, MAX_W);
  };
  /** muestra una frase; pop: aparece (o, si estaba hablando sola, rebota) y suena */
  const show = (raw: string, m: Mode, pop = false) => {
    if (px < 0 || !raw) return;
    const s = voice(raw);
    clear('swap');
    mode = m;
    w = widthFor(s);
    if (!shown) {
      // aparece en su lugar, con el ancho ya puesto (sin estirarse desde el texto anterior)
      text.textContent = s;
      text.style.opacity = '1';
      pill.style.width = `${w}px`;
      snap();
      void pill.offsetWidth;
      shown = true;
      pill.classList.add('is-on');
      if (pop) emit('buddy:open', s);
    } else {
      if (text.textContent !== s) {
        // ya estaba a la vista: cambia el texto y el ancho se adapta
        text.style.opacity = '0';
        pill.style.width = `${w}px`;
        timers.swap = window.setTimeout(
          () => {
            text.textContent = s;
            text.style.opacity = '1';
          },
          reduced ? 0 : 90,
        );
        follow();
      }
      if (pop) {
        // estaba hablando sola y ahora te habla de lo que apuntás: un rebote, para que el sonido se vea
        pill.classList.remove('is-repop');
        void pill.offsetWidth;
        pill.classList.add('is-repop');
        emit('buddy:open', s);
      }
    }
  };
  const hide = () => {
    clear('dwell', 'chain', 'grace', 'self', 'next');
    if (!shown) return;
    shown = false;
    mode = null;
    pill.classList.remove('is-on');
  };

  /* ---------- lo que apuntás ---------- */

  // las frases de algo, encadenadas mientras sigas ahí
  const speak = (t: HTMLElement, m: Mode, pop: boolean) => {
    clear('chain', 'next', 'self');
    const parts = phrases(t);
    let i = Number(t.dataset.sayAt ?? 0) % parts.length;
    const say = (p: boolean) => {
      show(parts[i], m, p);
      t.dataset.sayAt = String((i + 1) % parts.length);
      if (i < parts.length - 1)
        timers.chain = window.setTimeout(() => {
          if (t !== target) return;
          i++;
          say(false);
        }, readFor(parts[i]));
    };
    say(pop);
  };

  // en la página
  let poppedAt = -1e9;
  const pointPage = (t: HTMLElement | null, cause: Cause) => {
    if (t === target) return;
    target = t;
    clear('dwell', 'chain');
    if (t) {
      clear('grace');
      const talking = shown && mode === 'point';
      // suena cuando empieza a hablar de lo que apuntás, y también al pasar a otra cosa (rebota), si moviste el
      // puntero; como mucho un pop cada 0,35 s, para que recorrer una fila no sea una ametralladora
      timers.dwell = window.setTimeout(() => {
        if (t !== target) return;
        const now = performance.now();
        const pop = cause === 'pointer' && now - poppedAt > 350;
        if (pop) poppedAt = now;
        speak(t, 'point', pop);
      }, talking ? 60 : DWELL);
    } else if (shown && mode === 'point') {
      clear('grace');
      timers.grace = window.setTimeout(hide, GRACE);
    }
  };

  // en una ventana: sobre una pieza, la pieza; sobre lo demás, el proyecto
  const projectLine = (pop = false) => {
    if (!win) return;
    const says = list(win.dataset.says);
    if (!says.length) return;
    let k = Number(win.dataset.saysAt ?? 0) % says.length;
    const say = (p: boolean) => {
      show(says[k], 'window', p);
      win!.dataset.saysAt = String((k + 1) % says.length);
      if (k < says.length - 1)
        timers.next = window.setTimeout(() => {
          if (target || !win) return;
          k++;
          say(false);
        }, WIN_NEXT);
    };
    say(pop);
  };
  const pointWindow = (n: Element | null, cause: Cause) => {
    const frame = win!.querySelector('[data-win-frame]');
    const inside = !!(n && frame?.contains(n));
    if (!inside) {
      target = null;
      clear('dwell', 'chain', 'next');
      if (shown) {
        clear('grace');
        timers.grace = window.setTimeout(hide, GRACE);
      }
      return;
    }
    clear('grace');
    const t = n!.closest<HTMLElement>('[data-say]');
    if (t === target && shown) return;
    target = t;
    clear('dwell', 'chain', 'next');
    // vuelve a aparecer (si la habías sacado de la ventana): suena como cualquier aparición
    const pop = !shown && cause === 'pointer';
    timers.dwell = window.setTimeout(
      () => {
        if (!win || t !== target) return;
        if (t) speak(t, 'window', pop);
        else projectLine(pop);
      },
      shown ? 60 : DWELL,
    );
  };

  const point = (n: Element | null, cause: Cause) => {
    away = !!n?.closest('[data-buddy-off]');
    if (away) {
      // ahí ya hay una conversación: se corre enseguida
      target = null;
      clear('dwell', 'chain', 'grace');
      if (shown) hide();
      return;
    }
    if (win) return pointWindow(n, cause);
    pointPage(n ? n.closest<HTMLElement>('[data-say]') : null, cause);
  };

  /* ---------- cuando habla sola ---------- */

  // una frase sin sonido que se va sola; si apuntás algo mientras tanto, pasa a hablar de eso
  const selfSay = (s: string) => {
    show(s, 'self');
    clear('self');
    timers.self = window.setTimeout(() => {
      if (mode !== 'self') return;
      if (target) speak(target, win ? 'window' : 'point', false);
      else hide();
    }, readFor(s));
  };

  const ratios = new Map<Element, number>();
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0)),
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  document.querySelectorAll('[data-ambient]').forEach((s) => io.observe(s));
  // puntero quieto un rato, burbuja cerrada: algo de la sección que tenés a la vista
  const idle = () => {
    if (shown || win || away || document.hidden || px < 0 || pageCount >= PAGE_BUDGET) return;
    let best: HTMLElement | null = null;
    let r = 0.2;
    for (const [k, v] of ratios) if (v > r) [best, r] = [k as HTMLElement, v];
    const s = best ? list(best.dataset.ambient).find((p) => !said.has(p)) : undefined;
    if (!s) return;
    said.add(s);
    pageCount++;
    selfSay(s);
  };

  /* ---------- eventos ---------- */

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const first = px < 0;
      px = e.clientX;
      py = e.clientY;
      // los movimientos que el navegador inventa después del scroll no cuentan
      if (e.movementX || e.movementY || first) lastRealMove = performance.now();
      follow();
      clear('idle');
      timers.idle = window.setTimeout(idle, IDLE);
      if (first)
        // saludo según la hora, apenas se mueve el puntero (sin sonido)
        window.setTimeout(() => !shown && !target && !win && selfSay(greeting()), 600);
    },
    { passive: true },
  );
  const cause = (): Cause => (performance.now() - lastRealMove < 250 ? 'pointer' : 'scroll');
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    point(e.target instanceof Element ? e.target : null, cause());
  });
  document.addEventListener('mouseout', (e) => {
    if (e.relatedTarget) return;
    target = null;
    hide();
  });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return hide();
    pill.classList.add('is-press');
    window.setTimeout(() => pill.classList.remove('is-press'), 140);
  });
  // escribiendo, se corre
  addEventListener('keydown', (e) => (e.target as Element).closest?.('input, textarea') && hide());
  // con el scroll (de la página o de una ventana) cambia lo que hay debajo del puntero: sin sonido
  let scrolling = 0;
  document.addEventListener(
    'scroll',
    () => {
      if (scrolling || px < 0) return;
      scrolling = requestAnimationFrame(() => {
        scrolling = 0;
        point(document.elementFromPoint(px, py), 'scroll');
      });
    },
    { capture: true, passive: true },
  );

  // un aviso de otra parte de la página (p. ej. «Sonido activado»)
  document.addEventListener('buddy:say', (e) => {
    const s = (e as CustomEvent<string>).detail;
    if (s && !away) selfSay(s);
  });

  // las ventanas viven en la capa superior: la burbuja se muda adentro y llega con la ventana, sin sonido
  document.addEventListener('win:open', (e) => {
    const { dialog, how } = (e as CustomEvent<{ dialog: HTMLDialogElement; how: string }>).detail;
    const switching = !!win;
    win = dialog;
    win.append(el);
    target = null;
    clear('dwell', 'chain', 'grace', 'self', 'next');
    if (!switching) {
      shown = false;
      mode = null;
      pill.classList.remove('is-on');
    }
    // cuando la ventana termina de abrirse, si el puntero está adentro
    window.setTimeout(
      () => {
        if (win !== dialog) return;
        const n = px < 0 ? null : document.elementFromPoint(px, py);
        if (!n || !dialog.querySelector('[data-win-frame]')?.contains(n)) return;
        const t = n.closest<HTMLElement>('[data-say]');
        target = t;
        if (t) speak(t, 'window', false);
        else projectLine();
      },
      how === 'genie' ? 650 : 120,
    );
  });
  document.addEventListener('win:close', () => {
    win = null;
    target = null;
    document.body.append(el);
    hide();
  });
}
