import type { LoopMedia } from './types';

/* Exploraciones personales: páginas vivas que se hacen en ../exploraciones y se publican enteras
   en public/sandbox/<slug>/ (tools/sandbox/sync.mjs). Cada una tiene su propio link y una captura
   breve que sale de tools/sandbox. */
export interface Exploration {
  slug: string;
  title: string;
  /** qué es, en pocas palabras */
  what: string;
  /** una línea debajo de la ventana */
  line: string;
  /** lo que dice la burbuja al pasar */
  hover: string;
  /** ocupa todo el ancho de la columna */
  wide?: boolean;
  capture: LoopMedia;
}

const capture = (slug: string, label: string, ratio = '16 / 10'): LoopMedia => ({
  kind: 'loop',
  src: `/media/sandbox/${slug}`,
  poster: `/media/sandbox/${slug}.jpg`,
  ratio,
  label,
});

export const sandbox: Exploration[] = [
  {
    slug: 'ukiyo',
    title: 'Kaze no tayori',
    what: 'Ukiyo-e interactivo',
    line: 'Una carta que lleva el viento por cinco grabados vivos. El viento sos vos.',
    hover: 'Entrá y soplá',
    wide: true,
    capture: capture('ukiyo', 'Los cinco grabados vivos, del otoño a la nieve, con la carta en el viento'),
  },
  {
    slug: 'kora',
    title: 'Kora',
    what: 'Diorama 3D en ASCII',
    line: 'Kora frente al Fuji: una escena 3D en vivo, impresa en ASCII.',
    hover: 'Kora te sigue con la mirada',
    capture: capture('kora', 'Kora frente al santuario, en ASCII, del día a la noche'),
  },
  {
    slug: 'lopez-vivo',
    title: 'Después, al caer la tarde',
    what: 'Óleo vivo',
    line: 'Un campo después de la batalla, a la manera de Cándido López.',
    hover: 'Entrá y esperá la noche',
    capture: capture('lopez-vivo', 'Un campo con charcos al atardecer: un caballo blanco, soldados y fogatas que humean'),
  },
  {
    slug: 'lopez-itapiru',
    title: 'Llegada a Itapirú',
    what: 'Óleo vivo',
    line: 'Una obra de Cándido López pintada de nuevo por código, sin un píxel de la foto.',
    hover: 'Todo se mueve: entrá',
    wide: true,
    capture: capture('lopez-itapiru', 'La caballería y los batallones del Ejército Aliado sobre la arena de Itapirú', '2 / 1'),
  },
  {
    slug: 'pro-mouse',
    title: 'Pro Mouse',
    what: 'Objeto 3D',
    line: 'El mouse transparente de Apple del 2000, en tamaño real. Giralo, hacé clic o usalo con tu mouse.',
    hover: 'Entrá y hacé clic: suena',
    wide: true,
    capture: capture('pro-mouse', 'El Pro Mouse negro girando sobre blanco, con su carcasa de acrílico transparente y el cable'),
  },
];
