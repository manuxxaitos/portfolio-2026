/** Avisos entre partes de la página (la burbuja, las ventanas, el sonido) como eventos en document. */
export const emit = (name: string, detail?: unknown) => document.dispatchEvent(new CustomEvent(name, { detail }));
