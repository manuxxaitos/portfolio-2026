import type Lenis from 'lenis';
import { emit } from './events';
import { tr } from './lang';

/* Ventanas de proyecto (galerías sobre la página) y el chat de contacto.
   Avisan win:open al abrir (con cómo: genie, switch o instant), win:closing al
   empezar a cerrar y win:close al terminar: la burbuja del cursor se muda a la
   ventana, que vive en la capa superior, y el sonido acompaña. */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

/* ------------------------------------------------------------------ */

/**
 * Cada tarjeta con galería abre su <dialog>. La ventana sale de la tarjeta
 * y vuelve a ella al cerrarse (un genio simplificado). El ancla #proyecto
 * queda en la dirección para compartirla.
 */
export function windows(lenis?: Lenis) {
  const wins = new Map<string, HTMLDialogElement>();
  document.querySelectorAll<HTMLDialogElement>('dialog[data-win]').forEach((d) => wins.set(d.dataset.win!, d));
  if (!wins.size) return;
  let current: HTMLDialogElement | null = null;
  let busy = false;

  const cardOf = (slug: string) => document.querySelector<HTMLElement>(`[data-open="${slug}"]`);
  const originOf = (slug: string) => {
    const card = cardOf(slug);
    return card?.querySelector<HTMLElement>('.card__media, .row__icon') ?? card;
  };

  /** la ventana se estira desde (o hacia) la tarjeta */
  const genie = (d: HTMLDialogElement, closing: boolean) => {
    const frame = d.querySelector<HTMLElement>('[data-win-frame]')!;
    const from = originOf(d.dataset.win!);
    const f = frame.getBoundingClientRect();
    let start = 'translateY(28px) scale(0.94)';
    if (from) {
      const r = from.getBoundingClientRect();
      const dx = r.left + r.width / 2 - (f.left + f.width / 2);
      const dy = r.top + r.height / 2 - (f.top + f.height / 2);
      start = `translate(${dx}px, ${dy}px) scale(${Math.max(r.width / f.width, 0.04)}, ${Math.max(r.height / f.height, 0.04)})`;
    }
    const frames = [
      { transform: start, opacity: 0, borderRadius: '40px' },
      { transform: 'none', opacity: 1, borderRadius: '14px' },
    ];
    return frame.animate(closing ? frames.reverse() : frames, {
      duration: closing ? 320 : 620,
      easing: closing ? 'cubic-bezier(0.55, 0, 0.75, 0.2)' : 'cubic-bezier(0.18, 1.2, 0.32, 1)',
    }).finished;
  };

  const open = async (slug: string, how: 'genie' | 'switch' | 'instant' = 'genie') => {
    const d = wins.get(slug);
    if (!d || busy) return;
    busy = true;
    if (current && current !== d) {
      current.classList.remove('is-open', 'is-max');
      current.close();
    }
    current = d;
    if (!d.open) d.showModal();
    emit('win:open', { dialog: d, how });
    lenis?.stop();
    history.replaceState(null, '', `#${slug}`);
    d.querySelector<HTMLElement>('[data-win-body]')!.scrollTop = 0;
    requestAnimationFrame(() => d.classList.add('is-open'));
    if (!reduced && how === 'genie') await genie(d, false);
    else if (!reduced && how === 'switch')
      await d.querySelector<HTMLElement>('[data-win-frame]')!.animate(
        [{ opacity: 0.4, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'ease-out' },
      ).finished;
    busy = false;
  };

  const close = async () => {
    const d = current;
    if (!d || busy) return;
    busy = true;
    emit('win:closing', d);
    d.classList.remove('is-open');
    if (!reduced) await genie(d, true);
    d.classList.remove('is-max');
    d.close();
    emit('win:close', d);
    current = null;
    busy = false;
    lenis?.start();
    history.replaceState(null, '', location.pathname + location.search);
    cardOf(d.dataset.win!)?.focus({ preventScroll: true });
  };

  // al acercarse a una tarjeta, las primeras imágenes de su ventana empiezan a bajar (así no se abre en gris)
  const warm = (slug: string) => {
    const d = wins.get(slug);
    if (!d || d.dataset.warm) return;
    d.dataset.warm = '1';
    d.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img, i) => i < 6 && (img.loading = 'eager'));
  };

  // las tarjetas: el clic no sigue hasta Lenis, que trataría el ancla como un salto
  document.querySelectorAll<HTMLElement>('[data-open]').forEach((a) =>
    ['pointerenter', 'focus'].forEach((ev) => a.addEventListener(ev, () => warm(a.dataset.open!), { passive: true })),
  );
  document.querySelectorAll<HTMLElement>('[data-open]').forEach((a) =>
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      open(a.dataset.open!);
    }),
  );

  for (const d of wins.values()) {
    d.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    // clic fuera de la ventana
    d.addEventListener('click', (e) => e.target === d && close());
    d.querySelectorAll('[data-win-close]').forEach((b) => b.addEventListener('click', close));
    // el semáforo verde agranda o achica (avisa win:zoom: suena como abrir o cerrar)
    d.querySelector('[data-win-zoom]')?.addEventListener('click', () => emit('win:zoom', d.classList.toggle('is-max')));
    d.querySelectorAll<HTMLElement>('[data-win-go]').forEach((b) => b.addEventListener('click', () => open(b.dataset.winGo!, 'switch')));
  }

  // flechas del teclado: proyecto anterior o siguiente
  addEventListener('keydown', (e) => {
    if (!current || busy || e.altKey || e.metaKey || e.ctrlKey) return;
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? 0 : -1;
    if (dir < 0) return;
    const go = current.querySelectorAll<HTMLElement>('[data-win-go]')[dir];
    go && open(go.dataset.winGo!, 'switch');
  });

  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (wins.has(fromHash)) open(fromHash, 'instant');
}

/* ------------------------------------------------------------------ */

/**
 * Contacto, una conversación: la charla de entrada aparece en orden (puntitos, globo; puntitos, globo) la
 * primera vez que se ve la ventana. Lo que escribís sale como globo, contesto con tres puntitos y se abre tu
 * correo con el mensaje listo. Vacío, la caja se sacude, se marca y lo dice.
 */
export function compose() {
  const form = document.querySelector<HTMLFormElement>('[data-compose]');
  const log = document.querySelector<HTMLElement>('[data-compose-log]');
  if (!form || !log) return;
  const email = form.dataset.compose!;
  const ta = form.querySelector('textarea')!;
  const send = form.querySelector<HTMLElement>('[data-compose-send]')!;
  let placeholder = ta.placeholder;
  let errTimer = 0;

  const typing = (ghost = false) => {
    const el = document.createElement(ghost ? 'span' : 'li');
    el.setAttribute('aria-hidden', 'true');
    if (ghost) {
      el.className = 'bubble typing typing--ghost pop';
      el.innerHTML = '<i></i><i></i><i></i>';
    } else {
      el.className = 'msg msg--in pop';
      el.innerHTML = '<span class="bubble typing"><i></i><i></i><i></i></span>';
    }
    return el;
  };
  const bubble = (who: 'in' | 'out', text: string) => {
    const li = document.createElement('li');
    li.className = `msg msg--${who} pop`;
    const p = document.createElement('p');
    p.className = 'bubble';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = who === 'in' ? 'Tomás: ' : tr('Vos: ', 'You: ');
    p.append(sr, text);
    li.append(p);
    return li;
  };

  // un globo de varias líneas mide lo que su línea más larga (el navegador lo dejaría al ancho máximo,
  // con un hueco a la derecha)
  const tighten = (p: HTMLElement) => {
    p.style.width = '';
    // solo el texto que se ve (no el «Tomás:» para lectores de pantalla), línea por línea
    const lines: DOMRect[] = [];
    const range = document.createRange();
    p.childNodes.forEach((n) => {
      if (n.nodeType !== Node.TEXT_NODE || !n.textContent!.trim()) return;
      range.selectNodeContents(n);
      lines.push(...[...range.getClientRects()].filter((r) => r.width > 1));
    });
    if (new Set(lines.map((r) => Math.round(r.top))).size < 2) return;
    // si está en medio de su animación de entrada, las medidas vienen achicadas
    const scale = p.getBoundingClientRect().width / p.offsetWidth || 1;
    const cs = getComputedStyle(p);
    const widest = Math.max(...lines.map((r) => r.width)) / scale;
    p.style.width = `${Math.ceil(widest + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) + 1}px`;
  };
  const tightenAll = () => log.querySelectorAll<HTMLElement>('.bubble:not(.typing)').forEach(tighten);
  document.fonts.ready.then(tightenAll);
  let resizeT = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(tightenAll, 150);
  });

  // la charla de entrada: sus globos ya ocupan su lugar (invisibles), así nada se mueve al aparecer
  const intro = [...log.querySelectorAll<HTMLElement>('[data-intro]')];
  let introDone = false;
  const finishIntro = () => {
    if (introDone) return;
    introDone = true;
    intro.forEach((li) => {
      li.querySelector('.typing--ghost')?.remove();
      li.classList.add('is-in');
    });
  };
  if (reduced) finishIntro();
  else
    new IntersectionObserver(
      async ([e], io) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        for (const [i, li] of intro.entries()) {
          if (introDone) return;
          const ghost = typing(true);
          li.prepend(ghost);
          await wait(i === 0 ? 500 : 800);
          if (introDone) return;
          ghost.remove();
          li.querySelector('.bubble')!.classList.add('pop');
          li.classList.add('is-in');
          await wait(260);
        }
        introDone = true;
      },
      { threshold: 0.6 },
    ).observe(log);
  // si empezás a escribir antes, la charla termina de golpe
  ta.addEventListener('focus', finishIntro);

  const grow = () => {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    send.classList.toggle('aqua--pulse', ta.value.trim().length > 0);
  };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // la charla: primero el mensaje, después a qué mail contestar; se envía desde acá (FormSubmit), sin abrir
  // el correo. Si el envío falla, recién ahí abre el correo con el mensaje escrito.
  let step: 'msg' | 'mail' = 'msg';
  let message = '';
  const isMail = (t: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
  const say = async (text: string, think = 900, sound = 'chat:reply') => {
    const dots = typing();
    log.append(dots);
    await wait(think);
    const reply = bubble('in', text);
    dots.replaceWith(reply);
    tighten(reply.querySelector('.bubble')!);
    emit(sound);
  };
  const ask = (mail: boolean) => {
    step = mail ? 'mail' : 'msg';
    ta.placeholder = placeholder = mail ? tr('tu@mail.com', 'you@email.com') : tr('Escribí tu mensaje…', 'Write your message…');
    ta.inputMode = mail ? 'email' : 'text';
    ta.autocomplete = mail ? 'email' : 'off';
  };
  const deliver = async (mail: string) => {
    try {
      const r = await fetch(`https://formsubmit.co/ajax/${email}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: tr('Mensaje desde tomascardozo.com', 'Mensaje desde tomascardozo.com (en inglés)'),
          _template: 'box',
          _captcha: 'false',
          _replyto: mail,
          email: mail,
          mensaje: message,
        }),
      });
      const j = await r.json().catch(() => ({}));
      return r.ok && String(j.success) === 'true';
    } catch {
      return false;
    }
  };
  const fail = (text: string) => {
    clearTimeout(errTimer);
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake', 'is-error');
    ta.placeholder = text;
    emit('form:error');
    ta.focus();
    errTimer = window.setTimeout(() => {
      form.classList.remove('is-error');
      ta.placeholder = placeholder;
    }, 2200);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    // vacío: la caja se sacude, se marca y lo dice; suena un toque grave
    if (!text) return fail(step === 'mail' ? tr('Escribí tu mail', 'Write your email') : tr('Escribí tu mensaje primero', 'Write your message first'));
    if (step === 'mail' && !isMail(text)) {
      ta.value = text;
      return fail(tr('Ese mail no parece completo', 'That email doesn’t look complete'));
    }
    clearTimeout(errTimer);
    form.classList.remove('is-error');
    ta.placeholder = placeholder;
    finishIntro();
    const mine = bubble('out', text);
    log.append(mine);
    tighten(mine.querySelector('.bubble')!);
    emit('chat:send');
    ta.value = '';
    grow();
    await wait(380);
    if (step === 'msg') {
      message = text;
      ask(true);
      await say(tr('¡Gracias! ¿A qué mail te contesto?', 'Thanks! What email should I reply to?'));
      return;
    }
    // el mail: se envía mientras «escribe»
    ask(false);
    const dots = typing();
    log.append(dots);
    const [ok] = await Promise.all([deliver(text), wait(900)]);
    dots.remove();
    if (ok) {
      // llegó de verdad: las dos notas del éxito en lugar del pop de respuesta
      await say(tr('Listo, me llegó. Te escribo pronto.', 'Done, got it. I’ll write back soon.'), 10, 'chat:sent');
      return;
    }
    await say(tr('No pude enviarlo desde acá, así que te abro el correo con tu mensaje.', 'I couldn’t send it from here, so I’m opening your email app with your message.'), 10);
    await wait(700);
    location.href = `mailto:${email}?subject=${encodeURIComponent(tr('Hola, Tomás', 'Hi Tomás'))}&body=${encodeURIComponent(message)}`;
  });
}
