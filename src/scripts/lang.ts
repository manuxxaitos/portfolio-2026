/** el idioma de la página que corre (lo pone Base.astro en <html lang>): para las frases que arman los scripts */
export const EN = document.documentElement.lang === 'en';
export const tr = (es: string, en: string) => (EN ? en : es);
