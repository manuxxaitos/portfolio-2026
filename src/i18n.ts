/**
 * Dos idiomas: español en / (el original) e inglés en /en/. El texto se escribe en español en cada componente
 * y en los datos; acá está su traducción, frase por frase. Lo que no tiene traducción sale en español y el
 * build lo avisa (así una frase nueva no queda sin traducir sin que nadie se entere).
 * Los nombres propios (marcas, tapas, artistas) no se traducen: no hace falta listarlos.
 */
export type Lang = 'es' | 'en';

/** el idioma de una página, por su dirección */
export const langOf = (url: URL): Lang => (/^\/en(\/|$)/.test(url.pathname) ? 'en' : 'es');

/** la misma página en el otro idioma */
export const pathIn = (lang: Lang, pathname: string) => {
  const bare = pathname.replace(/^\/en(\/|$)/, '/');
  return lang === 'en' ? `/en${bare === '/' ? '/' : bare}` : bare;
};

const EN: Record<string, string> = {
  // ---------- página ----------
  'Tomás Cardozo — Diseñador': 'Tomás Cardozo — Designer',
  'Diseñador en Buenos Aires. Diseño marcas, sitios y productos, los programo y automatizo el resto.':
    'Designer in Buenos Aires. I design brands, websites and products, code them and automate the rest.',
  'La portada del portfolio: la presentación de Tomás y el Sandbox, con Kaze no tayori':
    'The portfolio’s front page: Tomás’s intro and the Sandbox, with Kaze no tayori',
  'Saltar al contenido': 'Skip to content',
  'Idioma': 'Language',

  // ---------- presentación ----------
  '¡Hola! Ese soy yo': 'Hi! That’s me',
  '¿Charlamos?': 'Let’s talk?',
  'Mi código, por acá': 'My code, over here',
  'Más diseño en Behance': 'More design on Behance',
  'Lo que ando haciendo, en X': 'What I’m up to, on X',

  // ---------- secciones ----------
  'Proyectos': 'Projects',
  'Más proyectos': 'More projects',
  'Con qué trabajo': 'What I work with',
  'Contacto': 'Contact',
  'Las que tienen ↗ van al sitio': 'The ones with ↗ go to the site',
  'Las otras se abren acá mismo': 'The others open right here',
  'Están vivas: entrá y tocá': 'They’re alive: go in and play',
  'Esto lo hago por curiosidad': 'I make these out of curiosity',
  'Lo que hago por curiosidad, sin cliente. Cada pieza está viva y tiene su propio link.':
    'What I make out of curiosity, with no client. Every piece is alive and has its own link.',
  'Mirá este proyecto': 'Take a look',
  'Abrimos la galería': 'Let’s open the gallery',
  'Te llevo al sitio': 'I’ll take you to the site',
  'Abrir': 'Open',
  'Ir al sitio': 'Go to site',

  // ---------- herramientas ----------
  'Diseño': 'Design',
  'Figma, sistemas de diseño, identidad, editorial': 'Figma, design systems, identity, editorial',
  'Producto y web': 'Product and web',
  'HTML, CSS, JavaScript y TypeScript, Three.js, GSAP, Astro, React, FastAPI, SQLite':
    'HTML, CSS, JavaScript and TypeScript, Three.js, GSAP, Astro, React, FastAPI, SQLite',
  'IA y automatización': 'AI and automation',
  'Claude Code, Codex, API de Anthropic, Whisper, Python, ffmpeg, OpenCV, Playwright':
    'Claude Code, Codex, Anthropic API, Whisper, Python, ffmpeg, OpenCV, Playwright',
  'Uso la IA por iniciativa propia: para explorar más ideas, prototipar rápido y automatizar lo repetitivo, sin resignar el detalle.':
    'I use AI on my own initiative: to explore more ideas, prototype fast and automate the repetitive parts, without giving up on detail.',
  'After Effects, Premiere y video generado en código': 'After Effects, Premiere and video generated in code',

  // ---------- contacto ----------
  '¿Qué construimos?': 'What are we building?',
  'Contame la idea, el producto o el proceso que querés sacarte de encima.':
    'Tell me about the idea, the product or the process you want off your plate.',
  'Tu mensaje': 'Your message',
  'Escribí tu mensaje…': 'Write your message…',
  'Enviar': 'Send',
  'Copiar': 'Copy',
  'Arriba': 'Top',
  'Tipografía Inter, de Rasmus Andersson. Hecho a mano en Astro, con un campo ASCII propio en WebGL.':
    'Set in Inter, by Rasmus Andersson. Handmade in Astro, with a custom ASCII field in WebGL.',
  'Esta visita pesó': 'This visit weighed',

  // ---------- ventanas ----------
  'Cerrar': 'Close',
  'Minimizar': 'Minimize',
  'Agrandar': 'Zoom',
  'Otros proyectos': 'Other projects',
  'Anterior': 'Previous',
  'Siguiente': 'Next',
  'Ver sitio': 'View site',
  'Movelas: se inclinan': 'Move them: they tilt',
  'Arrastrá para girar · un toque y rebota': 'Drag to spin · tap and it bounces',
  'Silenciar': 'Mute',
  'Sonido': 'Sound',

  // ---------- sandbox ----------
  'Ukiyo-e interactivo': 'Interactive ukiyo-e',
  'Una carta que lleva el viento por cinco grabados vivos. El viento sos vos.':
    'A letter carried by the wind through five living prints. You are the wind.',
  'Entrá y soplá': 'Go in and blow',
  'Los cinco grabados vivos, del otoño a la nieve, con la carta en el viento':
    'The five living prints, from autumn to snow, with the letter on the wind',
  'Diorama 3D en ASCII': '3D diorama in ASCII',
  'Kora frente al Fuji: una escena 3D en vivo, impresa en ASCII.': 'Kora facing Mount Fuji: a live 3D scene, printed in ASCII.',
  'Kora te sigue con la mirada': 'Kora follows you with her eyes',
  'Kora frente al santuario, en ASCII, del día a la noche': 'Kora facing the shrine, in ASCII, from day to night',
  'Después, al caer la tarde': 'Afterwards, at dusk',
  'Óleo vivo': 'Living oil painting',
  'Un campo después de la batalla, a la manera de Cándido López.': 'A field after the battle, in the manner of Cándido López.',
  'Entrá y esperá la noche': 'Go in and wait for nightfall',
  'Un campo con charcos al atardecer: un caballo blanco, soldados y fogatas que humean':
    'A field with puddles at sunset: a white horse, soldiers and smoking campfires',
  'Llegada a Itapirú': 'Arrival at Itapirú',
  'Una obra de Cándido López pintada de nuevo por código, sin un píxel de la foto.':
    'A painting by Cándido López repainted in code, without a single pixel from the photo.',
  'Todo se mueve: entrá': 'Everything moves: go in',
  'La caballería y los batallones del Ejército Aliado sobre la arena de Itapirú':
    'The cavalry and battalions of the Allied Army on the sands of Itapirú',

  // ---------- proyectos: comunes ----------
  'Brochure web': 'Web brochure',
  'Diseño y desarrollo de un brochure web interactivo.': 'Design and development of an interactive web brochure.',
  'Identidad y 3D': 'Identity and 3D',
  'Paleta de logos': 'Logo palette',
  'Tipografía principal': 'Primary typeface',
  'Más abajo, el sistema completo': 'Further down, the full system',

  // CiriLog
  'Plataforma interna': 'Internal platform',
  'Diseño y desarrollo de una plataforma interna.': 'Design and development of an internal platform.',
  'Tablero de CiriLog con datos de ejemplo': 'CiriLog dashboard with sample data',
  'El tablero, con datos de ejemplo': 'The dashboard, with sample data',
  'Seguimiento de pagos, con datos de ejemplo': 'Payment tracking, with sample data',
  'El tablero en modo oscuro': 'The dashboard in dark mode',
  'Abrimos el tablero': 'Let’s open the dashboard',
  'La diseñé y la programé yo': 'I designed and coded it',
  'Estudios, actas y facturación, juntos': 'Studies, records and billing, together',
  'Hoy la usan cinco personas': 'Five people use it today',
  'Ojo: los datos son inventados': 'Heads up: the data is made up',
  'Las capturas usan datos inventados: la información real es confidencial.':
    'The screenshots use made-up data: the real information is confidential.',

  // LYM Studio
  'Marca y sitio': 'Brand and website',
  'Identidad de marca y diseño y desarrollo web.': 'Brand identity and web design and development.',
  'El sitio de LYM Studio en escritorio y en el teléfono': 'The LYM Studio website on desktop and on a phone',
  'El monograma LM': 'The LM monogram',
  'Área de resguardo del logo': 'Logo clear space',
  'Paleta de color': 'Color palette',
  'Piezas para redes': 'Social media pieces',
  'Historias de Instagram': 'Instagram stories',
  'Tarjetas': 'Business cards',
  'Un estudio de arquitectura': 'An architecture studio',
  'Monograma, manual y piezas': 'Monogram, guidelines and pieces',
  'El sitio también lo programé yo': 'I coded the website too',

  // Trelles, Cañaveral, Precionauta
  'El sitio de Trelles 928 en una ventana del navegador': 'The Trelles 928 website in a browser window',
  'El sitio de Cañaveral I en una ventana del navegador': 'The Cañaveral I website in a browser window',
  'Producto propio': 'Own product',
  'Marca, diseño de producto y desarrollo de un proyecto propio.': 'Brand, product design and development of my own project.',
  'La home de Precionauta con su personaje': 'The Precionauta home page with its character',

  // Tapas
  'Tapas de discos': 'Album covers',
  'Dirección de arte': 'Art direction',
  'Dirección de arte y diseño de portadas musicales.': 'Art direction and design of music covers.',
  'Anillo de tapas de discos que gira: las del fondo nítidas, las de los costados cerca y fuera de foco':
    'A spinning ring of album covers: sharp in the back, close and out of focus at the sides',
  'Las Tías EP, contratapa': 'Las Tías EP, back cover',
  'Peregrina, presentación': 'Peregrina, launch',
  'Inteligencia Artificial, single': 'Inteligencia Artificial, single',
  'Cause & Effect: la cámara entra entre hilos rosas': 'Cause & Effect: the camera moves in through pink threads',
  'Vinilo girando para No Paper Dreams': 'Spinning vinyl for No Paper Dreams',
  'Visualizer de Empapada': 'Visualizer for Empapada',
  'Mirá las tapas de cerca': 'See the covers up close',
  'Arrastrá el anillo para girarlo': 'Drag the ring to spin it',
  'Tocá una tapa y viene adelante': 'Tap a cover and it comes forward',
  'Abajo hay algunas en movimiento': 'Below, some of them in motion',

  // AISH
  'Sistema visual y 3D': 'Visual system and 3D',
  'Rediseño de identidad, campaña gráfica y piezas 3D.': 'Identity redesign, graphic campaign and 3D pieces.',
  'El logo de AISH en 3D, en cromo violeta': 'The AISH logo in 3D, in violet chrome',
  'Abrimos la fiesta': 'Let’s open the party',
  'Una fiesta pensada como ritual': 'A party conceived as a ritual',
  'El logo de arriba es 3D: tocalo': 'The logo up top is 3D: touch it',
  'Más abajo, la campaña': 'Further down, the campaign',
  'El logo de AISH en 3D, en cromo, con estrellas que titilan: se gira arrastrando y destella si lo tocás':
    'The AISH logo in 3D, in chrome, with twinkling stars: drag to spin it, and it flashes when you touch it',
  'Arrastralo para girarlo | Tocalo: rebota y destella': 'Drag to spin it | Tap it: it bounces and flashes',
  'Todo puede pasar': 'Anything can happen',
  'De «Fiesta AISH» a AISH: el rediseño del logo': 'From «Fiesta AISH» to AISH: the logo redesign',
  'El logo en 3D de cerca, en cromo rosa': 'The 3D logo up close, in pink chrome',
  'Una bola de espejos con los colores de la fiesta': 'A disco ball in the party’s colors',
  'Exploración de color': 'Color exploration',
  'Tipografía funcional: Helvetica Now Display': 'Functional typeface: Helvetica Now Display',
  'Tipografía experimental': 'Experimental typeface',
  'La noche como exorcismo': 'The night as an exorcism',
  'Dos flyers de AISH': 'Two AISH flyers',
  'Flyer: el logo sobre una flor de vidrio': 'Flyer: the logo on a glass flower',
  'Flyer con el line-up: Juan Cavoti, No es de vegana y Gonzalo Solimano':
    'Flyer with the line-up: Juan Cavoti, No es de vegana and Gonzalo Solimano',
  'Las estrellas del logo, en 3D': 'The logo’s stars, in 3D',
  'Exploración: moodboard': 'Exploration: moodboard',
  'Historia de la 3.ª edición, con performers': 'Story from the 3rd edition, with performers',
  'La pista llena, vista desde la cabina': 'A packed dance floor, seen from the DJ booth',
  'Posando en la cabina, bajo luz violeta': 'Posing in the booth, under violet light',
  'Un performer': 'A performer',
  'Una performer, con la mano a cámara': 'A performer, hand toward the camera',
  'En la cabina': 'In the booth',

  // Supplycon
  'Identidad de marca, sistema gráfico y piezas 3D.': 'Brand identity, graphic system and 3D pieces.',
  'El isologo hecho escalones, con la pisada en lima': 'The logo as stairs, with the tread in lime',
  'Abrimos la obra': 'Let’s open the site',
  'Insumos de construcción': 'Construction supplies',
  'La pieza de arriba es 3D: tocala': 'The piece up top is 3D: touch it',
  'El isologo de Supplycon en 3D: se gira arrastrando, rebota y cambia entre las combinaciones del manual y acero':
    'The Supplycon logo in 3D: drag to spin it; it bounces and switches between the guideline combinations and steel',
  'Lima sobre carbón': 'Lime on charcoal',
  'Carbón sobre lima': 'Charcoal on lime',
  'Lima sobre crema': 'Lime on cream',
  'Acero': 'Steel',
  'Arrastrala para girarla | Tocala: rebota | Abajo, otras combinaciones del manual':
    'Drag to spin it | Tap it: it bounces | Below, other combinations from the guidelines',
  'La marca en la arquitectura': 'The brand on architecture',
  'El isologo en carbón, acero y crema, en 3D': 'The logo in charcoal, steel and cream, in 3D',
  'Un muro de isologos, en 3D': 'A wall of logos, in 3D',
  'La trama: el isologo ampliado': 'The pattern: the logo enlarged',
  'Microgramma para títulos, Archivo para texto': 'Microgramma for headings, Archivo for text',
  'Tarjetas de Supplycon: frente en carbón y dorso en gris claro': 'Supplycon business cards: charcoal front and light gray back',
  'Frente de la tarjeta: el isologo lima sobre carbón': 'Card front: the lime logo on charcoal',
  'Dorso de la tarjeta: nombre, cargo y contacto sobre gris claro': 'Card back: name, role and contact on light gray',
  'La marca en un contenedor de obra': 'The brand on a construction container',
  'Publicación: Conexión perfecta': 'Post: Perfect connection',
  'Publicación: Conexión perfecta en carbón': 'Post: Perfect connection in charcoal',
  'Publicación: Conexión perfecta con arquitectura': 'Post: Perfect connection with architecture',
  'Historia: el casco de obra': 'Story: the hard hat',
  'Historia: Conexión perfecta': 'Story: Perfect connection',
  'Historia: una columna de isologos en lima': 'Story: a column of lime logos',
  'Caja con la cinta de la marca': 'A box with the brand tape',
  'Bolsa metalizada': 'Metallic bag',
  'En el teléfono: Conexión perfecta': 'On a phone: Perfect connection',
  'La tarjeta sobre una malla de acero': 'The card on a steel mesh',

  // E-sports
  'Carpeta · 5 proyectos': 'Folder · 5 projects',
  'Diseño de contenido para redes de equipos de e-sports.': 'Social media content design for e-sports teams.',
  'Historias de River, Boca, FiRe, La Batalla de Argentina y VCL en abanico':
    'Stories for River, Boca, FiRe, La Batalla de Argentina and VCL, fanned out',
  'Abrimos la carpeta': 'Let’s open the folder',
  'Cinco proyectos de 2023': 'Five projects from 2023',
  'Cada pieza, donde se usó': 'Each piece, where it was used',
  'Seguí bajando: hay más': 'Keep scrolling: there’s more',
  'Historia: Victoria': 'Story: Victory',
  'Historia: Derrota': 'Story: Defeat',
  'Historia: En vivo': 'Story: Live',
  'En vivo: el viernes 27 a las 18 h': 'Live: Friday the 27th at 6 pm',
  'Historia: Hoy juega Boca': 'Story: Boca plays today',
  'Publicación: Boca campeón': 'Post: Boca champions',
  'Historia: los partidos del día': 'Story: today’s matches',
  'Boca campeón, en horizontal': 'Boca champions, landscape',
  'Encabezado del perfil de FiRe POWER': 'FiRe POWER profile header',
  'Historia: Ganamos 2 a 0': 'Story: We won 2–0',
  'Hoy jugamos, 17 h': 'We play today, 5 pm',
  'Encabezado de Chloezera': 'Chloezera’s header',
  'El perfil con la grilla de retratos de jugadores': 'The profile with the grid of player portraits',
  'Publicación: retrato de Nacho': 'Post: portrait of Nacho',
  'Publicación: el escudo de Boca en la camiseta': 'Post: the Boca crest on the jersey',
  'Transmisión: partido en vivo, playoffs': 'Broadcast: live match, playoffs',
  'Publicación: ganador M80': 'Post: M80 wins',
  'Transmisión: llaves de doble eliminación': 'Broadcast: double-elimination bracket',
  'Campeones del Split 2': 'Split 2 champions',

  // Realit.
  'App, web y marca': 'App, web and brand',
  'Identidad de marca y diseño de app y web.': 'Brand identity and app and web design.',
  'El logo de Realit. en blanco sobre carbón': 'The Realit. logo in white on charcoal',
  'Abrimos Realit.': 'Let’s open Realit.',
  'Para contratar oficios de la construcción': 'For hiring construction trades',
  'Marca, app y web': 'Brand, app and web',
  'Pasá por la home: se recorre': 'Hover over the home page: it scrolls',
  'El logo de Realit.': 'The Realit. logo',
  'El logo en blanco sobre carbón': 'The logo in white on charcoal',
  'El símbolo: una viga recta y un cimiento curvo que forman la R': 'The symbol: a straight beam and a curved foundation that form the R',
  'Paleta: carbón y blanco': 'Palette: charcoal and white',
  'Tipografía: Helvetica Now Display': 'Typeface: Helvetica Now Display',
  'Jerarquía: títulos, subtítulos y texto': 'Hierarchy: headings, subheadings and text',
  'La grilla geométrica de la marca': 'The brand’s geometric grid',
  'La app': 'The app',
  'La web': 'The website',
  'App: el inicio, con los oficios': 'App: the home screen, with the trades',
  'App: profesionales en el mapa': 'App: professionals on the map',
  'App: el perfil del profesional': 'App: a professional’s profile',
  'App: Mis Contratos': 'App: My Contracts',
  'Web: la home (pasá el mouse y se recorre)': 'Web: the home page (hover and it scrolls)',
  'Web: resultados en el mapa': 'Web: results on the map',

  // Hilich
  'Identidad': 'Identity',
  'Identidad de marca para un desarrollo inmobiliario.': 'Brand identity for a real estate development.',
  'La marca Hilich en un teléfono': 'The Hilich brand on a phone',
  'Una torre que también es H': 'A tower that is also an H',
  'Variantes de color': 'Color variants',
  'Tarjetas personales sobre el patrón': 'Business cards on the pattern',

  // Kench
  'Identidad de marca, manual y piezas 3D.': 'Brand identity, guidelines and 3D pieces.',
  'Las cuatro llamas de Kench en 3D: roja, negra, blanca y crema': 'Kench’s four flames in 3D: red, black, white and cream',
  'Abrimos la llama': 'Let’s open the flame',
  'Una llama con carácter': 'A flame with character',
  'La de arriba es 3D: tocala': 'The one up top is 3D: touch it',
  'La llama de Kench en 3D, en vinilo brillante: se gira arrastrando, rebota y cambia de color':
    'The Kench flame in 3D, in glossy vinyl: drag to spin it; it bounces and changes color',
  'Llama roja': 'Red flame',
  'Llama crema': 'Cream flame',
  'Llama negra': 'Black flame',
  'Llama blanca': 'White flame',
  'Arrastrala para girarla | Tocala: rebota | Abajo le cambiás el color': 'Drag to spin it | Tap it: it bounces | Change its color below',
  'Portada del manual de marca': 'Brand guidelines cover',
  'La llama negra sobre blanco, con la consigna': 'The black flame on white, with the tagline',
  'La llama blanca sobre negro': 'The white flame on black',
  'La llama roja sobre crema': 'The red flame on cream',
  'La llama crema sobre rojo': 'The cream flame on red',
  'La trama de llamas': 'The flame pattern',
  'Fichas de la llama, en 3D': 'Flame tokens, in 3D',
  'La llama en neón, en 3D': 'The flame in neon, in 3D',
  'El logo sobre crema': 'The logo on cream',
  'Tipografía principal: Helvetica Now Display': 'Primary typeface: Helvetica Now Display',
  'La trama sobre la arquitectura': 'The pattern on architecture',
  'La trama, en rojo': 'The pattern, in red',
  'Tarjetas de Kench, frente y dorso': 'Kench business cards, front and back',
  'Frente de la tarjeta: la llama crema sobre la trama roja': 'Card front: the cream flame on the red pattern',
  'Dorso de la tarjeta: nombre, cargo y foto entre llamas': 'Card back: name, role and photo among flames',

  // Kune
  'Informe': 'Report',
  'Diseño editorial de un informe.': 'Editorial design of a report.',
  'Portada del informe': 'Report cover',
  '53 páginas, con ISBN': '53 pages, with an ISBN',
  'Apertura de resultados, con el mapa de Brasil': 'Results opener, with the map of Brazil',
  'Modelo lógico de acceso': 'Logic model of access',
};

/** frases en español que no se traducen porque son nombres o ya están en inglés */
const SAME = /^(Email|GitHub|Behance|X|Sandbox|Motion|EP|Color)$/;

const missing = new Set<string>();

/** una frase en el idioma de la página */
export const t = (lang: Lang, es: string) => {
  if (lang === 'es') return es;
  const en = EN[es];
  if (en === undefined && !SAME.test(es) && !missing.has(es)) {
    missing.add(es);
    console.warn(`[i18n] sin traducción: «${es}»`);
  }
  return en ?? es;
};

/** la imagen de Astro va tal cual: no se copia */
const isImage = (v: object) => 'src' in v && 'width' in v && 'format' in v;

/** traduce todas las frases de unos datos que tengan traducción (lo demás, como rutas y nombres, queda igual) */
export function translate<T>(lang: Lang, data: T): T {
  if (lang === 'es') return data;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return EN[v] ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && !isImage(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(data) as T;
}
