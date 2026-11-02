import type { ImageMetadata } from 'astro';

export interface LoopMedia {
  kind: 'loop';
  /** ruta en /public sin extensión */
  src: string;
  poster: string;
  /** "16 / 9", "1 / 1"… */
  ratio: string;
  label: string;
}

export interface StillMedia {
  kind: 'image';
  img: ImageMetadata;
  alt: string;
}

/** anillo 3D de tapas de discos (src/tapas/ring.js) */
export interface StackMedia {
  kind: 'stack';
  covers: { img: ImageMetadata; title: string; artist: string }[];
  /** foto fija del anillo: la tarjeta, y la espera en la galería */
  still: ImageMetadata;
  ratio: string;
  label: string;
}

/** una marca en 3D, viva (src/kench/toy.js, src/aish/logo3d.js, src/supplycon/iso3d.js): se gira, reacciona y cambia de color */
export interface ToyMedia {
  kind: 'toy';
  module: 'kench' | 'aish' | 'supplycon';
  ratio: string;
  label: string;
  /** cuadro que se ve hasta que arranca (y si no hay WebGL) */
  poster: ImageMetadata;
  ways: { key: string; name: string; fg: string; bg: string }[];
  /** lo que dice la burbuja (frases separadas por « | »; «!» marca la pista importante) */
  say: string;
}

/** tarjetas que se inclinan con el cursor */
export interface TiltMedia {
  kind: 'tilt';
  ratio: string;
  label: string;
  bg: string;
  /** ancho de cada tarjeta, en % del cuadro (horizontales ~42, verticales ~27) */
  width: number;
  cards: { img: ImageMetadata; alt: string }[];
}

export type Media = LoopMedia | StillMedia | StackMedia | ToyMedia | TiltMedia;

export type Item = Media & {
  /** columnas sobre 12 */
  span?: number;
  /** lo que dice la burbuja al pasar; false si la pieza ya lo dice sola (por defecto, su descripción) */
  say?: string | false;
};

export interface Project {
  slug: string;
  /** la marca o el proyecto */
  title: string;
  /** qué es, en pocas palabras: «Sitio institucional» */
  what: string;
  year: string;
  /** una línea debajo de la tarjeta: es una muestra, no un informe */
  line: string;
  /** tarjeta a lo ancho de la grilla (por defecto, las que son una carpeta de grupos) */
  wide?: boolean;
  /** orden en la grilla; sin esto va a «Más proyectos» */
  featured?: number;
  cover: Media;
  /** fondo de la tarjeta cuando la pieza flota (videos cuadrados o verticales) */
  tone?: string;
  thumb: ImageMetadata;
  /** sitio publicado */
  url?: { href: string; label: string };
  /** con galería, la tarjeta abre una ventana sobre la página; sin galería, va directo al sitio */
  gallery?: Item[];
  /** proyectos dentro de una carpeta (e-sports): cada uno con su título y sus piezas */
  groups?: { title: string; client: string; text?: string; items?: Item[]; stage?: Stage }[];
  /** lo que dice la burbuja que acompaña al cursor dentro de la ventana, de a una frase y con pausas */
  says?: string[];
  /** lo que dice la burbuja al pasar por la tarjeta (si no, «Abrimos la galería» o «Te llevo al sitio») */
  hover?: string;
  /** aclaración visible para todos, debajo de la línea de la ventana */
  note?: string;
}

/** abre una ventana (galería) o lleva directo al sitio */
export const opensWindow = (p: Project) => Boolean(p.gallery || p.groups);

/** una pieza de redes en el soporte donde se usó (componente Soportes.astro) */
export interface Piece {
  /** phone: historia en un teléfono · app: pantalla de app en un teléfono · screen: pantalla de transmisión · browser: página web en una ventana (si es larga, se recorre al pasar) · post: publicación · banner: encabezado de perfil · grid: perfil con la grilla */
  as: 'phone' | 'screen' | 'post' | 'banner' | 'grid' | 'app' | 'browser';
  img: ImageMetadata;
  /** solo para grid: el resto de la grilla */
  more?: ImageMetadata[];
  alt: string;
  /** ancho en % del escenario */
  w?: number;
}
/** el escenario de un grupo: el color del equipo y sus piezas puestas en soportes */
export interface Stage {
  bg: string;
  /** cuenta que firma las publicaciones y encabezados */
  account: string;
  pieces: Piece[];
}
