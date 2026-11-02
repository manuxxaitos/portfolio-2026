/**
 * Diseño sonoro de la página: los efectos, sus volúmenes y qué los dispara, todo acá.
 *
 * Cuatro familias, cada una con un porqué fijo, de la más suave a la más clara:
 *  1. burbuja   La burbuja aparece, o pasa a otra cosa de la página, porque moviste el puntero hacia algo: un pop
 *               de gel bajito (como mucho uno cada 0,35 s). Encadenar frases, hablar sola o llegar con una ventana no suena.
 *  2. cambio    Cambiaste un valor: el color de una marca 3D, qué tarjeta va adelante. Una gota. Si no
 *               cambió nada, no suena. El slider de día y noche, en cambio, hace clic en cada muesca que
 *               cruzás, como una rueda de selección: un tic seco y cortito que no corta ni espera a nadie.
 *  3. acción    Algo se abre o se agranda (soplido que sube), se cierra o se achica (toque que baja), o
 *               tocaste algo vivo: Kora, la llama de Kench, el logo de AISH (rebote).
 *  4. resultado El mensaje sale (clic acuoso) y llega la respuesta (pop redondo), el mail se copió (dos
 *               notas que suben) o falta algo (toque grave, siempre junto a una señal visual).
 * Nada suena al scrollear, al mover el mouse, al arrastrar (salvo las muescas del slider), por animaciones ni por links que salen del sitio.
 *
 * Tiempos: cada cosa suena siempre que pasa y, si se repite rápido, el sonido vuelve a empezar. Nunca suenan
 * dos a la vez: lo nuevo corta a lo anterior, salvo el pop de la burbuja, que no corta nada (si algo está
 * sonando, se calla).
 *
 * Los efectos se sintetizan con Web Audio (nada grabado ni copiado), con ataques redondeados y colas cortas.
 * El sonido viene prendido; el botón del rincón (SoundToggle.astro) lo apaga y guarda la preferencia. Igual
 * no suena nada hasta el primer clic o tecla: el navegador no deja arrancar el audio antes.
 * Con la pestaña oculta el audio se suspende. Las demás partes de la página solo avisan qué pasó, con
 * eventos en document (TRIGGERS, abajo).
 */
import { emit } from './events';

/* ------------------------------------------------------------------ */
/* ajustes                                                             */
/* ------------------------------------------------------------------ */

/** volumen general (cada efecto tiene además el suyo) */
const MASTER = 0.7;
const PREF_KEY = 'sonido';

type Family = 'burbuja' | 'cambio' | 'accion' | 'resultado';
interface Voice {
  ctx: AudioContext;
  out: GainNode;
  t: number;
}
interface Fx {
  family: Family;
  /** volumen propio, de 0 a 1 (calibrado para que cada familia suene pareja; ver tools/qa/sonidos.mjs) */
  vol: number;
  /** duración total en ms, para no superponer */
  ms: number;
  /** cuánto va al reverb corto */
  wet?: number;
  play: (v: Voice) => void;
}

/* ------------------------------------------------------------------ */
/* piezas para sintetizar                                              */
/* ------------------------------------------------------------------ */

// ataque redondeado (rampa corta) y caída exponencial con constante de tiempo tau
const env = (p: AudioParam, t: number, peak: number, attack: number, tau: number) => {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, tau);
};

interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** frecuencia final del glissando */
  to?: number;
  glide?: number;
  at?: number;
  peak: number;
  attack?: number;
  tau?: number;
  /** corte de un pasabajos, para apagar el brillo */
  lowpass?: number;
  end?: number;
}
function tone(v: Voice, o: ToneOpts) {
  const { ctx, out } = v;
  const t = v.t + (o.at ?? 0);
  const attack = o.attack ?? 0.008;
  const tau = o.tau ?? 0.04;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? 0.05));
  const g = ctx.createGain();
  env(g.gain, t, o.peak, attack, tau);
  let src: AudioNode = osc;
  if (o.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowpass;
    osc.connect(lp);
    src = lp;
  }
  src.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + (o.end ?? attack + tau * 6));
  return osc;
}

let noiseBuf: AudioBuffer | null = null;
const noise = (ctx: AudioContext) => {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
};
interface HissOpts {
  filter?: BiquadFilterType;
  f: number;
  to?: number;
  glide?: number;
  q?: number;
  at?: number;
  peak: number;
  attack?: number;
  tau?: number;
  end: number;
}
function hiss(v: Voice, o: HissOpts) {
  const { ctx, out } = v;
  const t = v.t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? 0.1));
  const g = ctx.createGain();
  env(g.gain, t, o.peak, o.attack ?? 0.01, o.tau ?? 0.04);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + o.end);
}

/* ------------------------------------------------------------------ */
/* los efectos                                                         */
/* ------------------------------------------------------------------ */

// una nota tibia: triángulo apagado con su octava muy baja
const warm = (v: Voice, at: number, f: number) => {
  tone(v, { type: 'triangle', f, at, peak: 0.42, attack: 0.012, tau: 0.042, lowpass: 2600 });
  tone(v, { f: f * 2, at, peak: 0.08, attack: 0.012, tau: 0.03 });
};

export const SOUNDS = {
  /* 1. burbuja ------------------------------------------------------- */

  /** la burbuja aparece porque apuntaste algo: el pop de gel, chiquito y bajo */
  pop: {
    family: 'burbuja',
    vol: 0.085,
    ms: 140,
    play: (v) => {
      tone(v, { f: 380, to: 760, glide: 0.05, peak: 0.5, attack: 0.008, tau: 0.024 });
      tone(v, { f: 760, to: 1520, glide: 0.05, peak: 0.1, attack: 0.008, tau: 0.016 });
    },
  },
  /* 2. cambio -------------------------------------------------------- */

  /** cambiaste un valor (color, hora, tarjeta de adelante): gota sutil */
  drop: {
    family: 'cambio',
    vol: 0.09,
    ms: 180,
    play: (v) => {
      tone(v, { f: 780, to: 1500, glide: 0.045, peak: 0.5, attack: 0.004, tau: 0.03 });
    },
  },

  /** el slider cruza una muesca: un tic mecánico, seco, como la rueda de un selector */
  tick: {
    family: 'cambio',
    vol: 0.07,
    ms: 0,
    play: (v) => {
      hiss(v, { filter: 'bandpass', f: 3400, q: 3.5, peak: 0.9, attack: 0.0008, tau: 0.0035, end: 0.025 });
      tone(v, { f: 1650, peak: 0.35, attack: 0.0008, tau: 0.005 });
    },
  },

  /* 3. acción -------------------------------------------------------- */

  /** se activa el sonido: un pop de gel más agudo */
  on: {
    family: 'accion',
    vol: 0.11,
    ms: 210,
    play: (v) => {
      tone(v, { f: 420, to: 900, glide: 0.07, peak: 0.5, attack: 0.012, tau: 0.035 });
      tone(v, { f: 840, to: 1800, glide: 0.07, peak: 0.1, attack: 0.012, tau: 0.025 });
    },
  },
  /** algo se abre o se agranda (una ventana, el semáforo verde): soplido corto que sube */
  open: {
    family: 'accion',
    vol: 0.17,
    ms: 320,
    play: (v) => {
      hiss(v, { f: 380, to: 2600, glide: 0.24, q: 0.9, peak: 0.9, attack: 0.07, tau: 0.06, end: 0.32 });
      tone(v, { f: 240, to: 480, glide: 0.22, peak: 0.12, attack: 0.04, tau: 0.06 });
    },
  },
  /** algo se cierra o se achica: toque apagado que baja */
  close: {
    family: 'accion',
    vol: 0.105,
    ms: 235,
    play: (v) => {
      tone(v, { type: 'triangle', f: 520, to: 280, glide: 0.1, peak: 0.6, attack: 0.006, tau: 0.04, lowpass: 1400 });
      hiss(v, { filter: 'lowpass', f: 900, q: 0.7, peak: 0.25, attack: 0.002, tau: 0.012, end: 0.06 });
    },
  },
  /** tocaste algo vivo (Kora, la llama de Kench, el logo de AISH): rebote elástico */
  boing: {
    family: 'accion',
    vol: 0.085,
    ms: 340,
    play: (v) => {
      const o = tone(v, { f: 280, to: 330, glide: 0.25, peak: 0.5, attack: 0.01, tau: 0.07, end: 0.34 });
      // vibrato que se calma: la frecuencia oscila como un resorte amortiguado
      const lfo = v.ctx.createOscillator();
      lfo.frequency.value = 13;
      const depth = v.ctx.createGain();
      depth.gain.setValueAtTime(70, v.t);
      depth.gain.setTargetAtTime(0, v.t, 0.08);
      lfo.connect(depth).connect(o.frequency);
      lfo.start(v.t);
      lfo.stop(v.t + 0.34);
    },
  },
  /* 4. resultado ----------------------------------------------------- */

  /** sale un mensaje: clic acuoso */
  send: {
    family: 'resultado',
    vol: 0.16,
    ms: 110,
    play: (v) => {
      tone(v, { f: 1600, to: 540, glide: 0.03, peak: 0.55, attack: 0.003, tau: 0.018 });
      hiss(v, { f: 1900, q: 7, peak: 0.25, attack: 0.002, tau: 0.01, end: 0.05 });
    },
  },
  /** llega la respuesta: otro pop, más redondo */
  reply: {
    family: 'resultado',
    vol: 0.16,
    ms: 270,
    play: (v) => {
      tone(v, { type: 'triangle', f: 520, to: 700, glide: 0.05, peak: 0.45, attack: 0.012, tau: 0.045, lowpass: 2400 });
      tone(v, { f: 1040, to: 1400, glide: 0.05, peak: 0.1, attack: 0.012, tau: 0.03 });
    },
  },
  /** algo salió bien de verdad (copiar el mail): dos notas tibias que suben */
  success: {
    family: 'resultado',
    vol: 0.125,
    ms: 350,
    wet: 0.2,
    play: (v) => {
      warm(v, 0, 587.33);
      warm(v, 0.085, 880);
    },
  },
  /** falta algo (mandar el mensaje vacío): un toque grave y amable, junto a la señal visual */
  error: {
    family: 'resultado',
    vol: 0.1,
    ms: 300,
    play: (v) => {
      tone(v, { f: 220, to: 180, glide: 0.12, peak: 0.6, attack: 0.012, tau: 0.05, lowpass: 900 });
      tone(v, { f: 440, to: 360, glide: 0.12, peak: 0.08, attack: 0.012, tau: 0.03 });
    },
  },
} satisfies Record<string, Fx>;

export type SoundName = keyof typeof SOUNDS;

/* ------------------------------------------------------------------ */
/* qué evento dispara qué sonido                                       */
/* ------------------------------------------------------------------ */

const TRIGGERS: Record<string, SoundName | ((e: CustomEvent) => SoundName | null)> = {
  // 1. burbuja: aparece porque apuntaste algo
  'buddy:open': 'pop',
  // 2. cambio: un valor distinto (los componentes avisan solo si cambió)
  'toy:color': 'drop',
  'sky:tick': 'tick',
  'tilt:front': 'drop',
  // 3. acción: abrir (no si la ventana ya llega abierta desde el ancla), cerrar, agrandar o achicar, tocar
  'win:open': (e) => (e.detail?.how === 'instant' ? null : 'open'),
  'win:closing': 'close',
  'win:zoom': (e) => (e.detail ? 'open' : 'close'),
  'kora:poke': 'boing',
  'toy:poke': 'boing',
  // 4. resultado
  'chat:send': 'send',
  'chat:reply': 'reply',
  'copy:ok': 'success',
  'chat:sent': 'success',
  'form:error': 'error',
};

/* ------------------------------------------------------------------ */
/* el motor                                                            */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode;
let wetBus: GainNode;
let enabled = false;
let gestured = false;
let current: { out: GainNode; until: number } | null = null;

// reverb corto y oscuro, solo para lo que es de vidrio
function roomImpulse(c: AudioContext) {
  const len = Math.round(c.sampleRate * 0.3);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return ir;
}

function ensure() {
  if (ctx && ctx.state !== 'closed') return ctx;
  ctx = new AudioContext({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  master = ctx.createGain();
  master.gain.value = MASTER;
  master.connect(comp).connect(ctx.destination);
  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx);
  wetBus = ctx.createGain();
  wetBus.gain.value = 0.5;
  wetBus.connect(room).connect(master);
  return ctx;
}

/** suena si corresponde; devuelve si sonó */
// si el audio todavía está despertando (pasa justo en el primer clic), el sonido espera y sale apenas arranca
let waiting: { name: SoundName; at: number } | null = null;
export function play(name: SoundName): boolean {
  if (!enabled || document.hidden) return false;
  if (!ctx || ctx.state !== 'running') {
    // sin un gesto previo (clic, tecla, toque) el navegador no deja sonar nada
    if (!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive && !gestured) return false;
    const c = ensure();
    waiting = { name, at: performance.now() };
    c.resume().then(() => {
      const w = waiting;
      waiting = null;
      if (w && performance.now() - w.at < 1000) play(w.name);
    }, () => {});
    return false;
  }
  const fx: Fx = SOUNDS[name];
  // el tic de una muesca es tan corto que va por su cuenta: no corta ni lo cortan
  if (name === 'tick') {
    const out = ctx.createGain();
    out.gain.value = fx.vol;
    out.connect(master);
    fx.play({ ctx, out, t: ctx.currentTime + 0.002 });
    setTimeout(() => out.disconnect(), 200);
    if (import.meta.env.DEV) ((window as unknown as { __sonidos?: string[] }).__sonidos ??= []).push(name);
    return true;
  }
  const now = performance.now();
  const busy = current !== null && now < current.until;
  // el pop de la burbuja no corta nada: si algo está sonando, se calla
  if (fx.family === 'burbuja' && busy) return false;
  // lo demás corta lo que esté sonando (también a sí mismo, si se repite rápido)
  if (busy) current!.out.gain.setTargetAtTime(0, ctx.currentTime, 0.008);
  const out = ctx.createGain();
  out.gain.value = fx.vol;
  out.connect(master);
  if (fx.wet) {
    const send = ctx.createGain();
    send.gain.value = fx.wet;
    out.connect(send).connect(wetBus);
  }
  fx.play({ ctx, out, t: ctx.currentTime + 0.004 });
  current = { out, until: now + fx.ms };
  setTimeout(() => out.disconnect(), fx.ms + 700);
  // en desarrollo queda registro de lo que sonó, para probar los disparadores
  if (import.meta.env.DEV) ((window as unknown as { __sonidos?: string[] }).__sonidos ??= []).push(name);
  return true;
}

/* ------------------------------------------------------------------ */
/* el control y el ciclo de vida                                       */
/* ------------------------------------------------------------------ */

export function sound() {
  const btn = document.querySelector<HTMLButtonElement>('[data-sound-toggle]');
  try {
    // prendido de entrada: solo se calla si lo apagaste (y lo recuerda)
    enabled = localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    enabled = true;
  }
  const render = () => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(enabled));
    btn.dataset.say = enabled ? 'Silenciar' : 'Sonidos suaves, si querés';
  };
  render();

  // el navegador deja arrancar el audio recién con un gesto (clic o tecla)
  // en cada gesto, si el audio quedó dormido (Safari lo duerme al cambiar de pestaña), se lo despierta ahí mismo:
  // reanudar y dar un sonido mudo dentro del gesto es lo que Safari pide para dejarlo sonar
  const unlock = () => {
    gestured = true;
    if (!enabled || document.hidden) return;
    const c = ensure();
    if (c.state === 'running') return;
    c.resume().catch(() => {});
    const mute = c.createBufferSource();
    mute.buffer = c.createBuffer(1, 1, c.sampleRate);
    mute.connect(c.destination);
    mute.start(0);
  };
  for (const ev of ['pointerdown', 'mousedown', 'pointerup', 'touchend', 'keydown', 'click'])
    addEventListener(ev, unlock, { capture: true, passive: true });

  btn?.addEventListener('click', async () => {
    enabled = !enabled;
    try {
      localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off');
    } catch {
      /* sin almacenamiento: vale para esta visita */
    }
    render();
    if (enabled) {
      await ensure().resume().catch(() => {});
      play('on');
      emit('buddy:say', 'Sonido activado');
    } else {
      emit('buddy:say', 'Sonido apagado');
      ctx?.suspend();
    }
  });

  // no se suspende al ocultar la pestaña: play() ya no suena con la pestaña oculta, y reanudar sin un gesto es justo
  // lo que Safari no deja (quedaba mudo hasta apagar y prender el botón). Al volver, se intenta; si no, el próximo gesto
  document.addEventListener('visibilitychange', () => {
    if (ctx && enabled && !document.hidden && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted && ctx && enabled && ctx.state !== 'running') ctx.resume().catch(() => {});
  });

  for (const [event, pick] of Object.entries(TRIGGERS)) {
    document.addEventListener(event, (e) => {
      if (!enabled) return;
      const name = typeof pick === 'function' ? pick(e as CustomEvent) : pick;
      if (name) play(name);
    });
  }
}
