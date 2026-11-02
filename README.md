# Portfolio 2026 — Tomás Cardozo, diseñador

Una sola página en Astro, en una columna, con el tono de una carta: presentación en primera persona, Kora impresa como estampilla (una escena 3D en vivo dibujada en ASCII, con el slider de la hora del día), proyectos en tarjetas, una lista con el resto, herramientas y contacto. No hay páginas por proyecto. Los que son sitios llevan directo al sitio; el resto abre una ventana sobre la página con su galería. Una burbuja de gel verde menta acompaña al cursor y dice frases cortas: saluda según la hora, avisa qué pasa al hacer clic, cuenta cada proyecto dentro de su ventana y nombra las piezas. Ventanas, burbuja y contacto usan una estética macOS retrofuturista: vidrio esmerilado, gel Aqua, semáforos y microinteracciones. Tipografía Inter y scroll con inercia (Lenis). No hay frameworks de UI ni librerías de animación.

## Comandos

```sh
npm install
npm run dev       # http://127.0.0.1:4321 (o el siguiente puerto libre)
npm run build     # genera dist/
npm run preview   # sirve dist/ para probar la versión final
```

Requiere Node 22 o superior.

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `src/data/projects.ts` | Todos los proyectos: textos, medios y orden. `featured` define las tarjetas (el resto va a «Más proyectos»). Con `gallery` o `groups` la tarjeta abre una ventana; sin eso, lleva a `url`. `says` son las frases de la burbuja dentro de la ventana, `hover` lo que dice sobre la tarjeta y `note` una aclaración visible para todos. |
| `src/data/types.ts` | La forma de un proyecto. |
| `src/pages/index.astro` | La página: Intro, KoraStamp, Proyectos, Herramientas y Contacto. |
| `src/components/Soportes.astro` | Las piezas de redes en el soporte donde se usaron (historias y pantallas de app en teléfonos, páginas web que se recorren al pasar, placas en pantallas de transmisión, posteos, encabezados de perfil y un perfil con su grilla) sobre el color de cada equipo, derechas y sin inclinar: lo usan los grupos de E-sports y de Realit. (`stage` en `projects.ts`). |
| `src/components/Contact.astro` | El contacto como una conversación de Mensajes: quién habla va en la barra (una sola foto), los globos son todos del mismo tamaño de letra, se agrupan y miden lo que su texto; la charla de entrada aparece en orden (puntitos, globo) sin mover nada, y la burbuja del cursor se corre mientras estás adentro (`data-buddy-off`). |
| `src/components/KoraStamp.astro` | Kora como estampilla (560 px de ancho, todo escala con `--sw`): póster, ventana con la escena en vivo, leyenda, perforaciones (máscaras CSS) y el slider de día a noche. La escena se carga después de la primera pintura, solo si se acerca a la pantalla y si hay WebGL. Incluye «Cargando» (una barra Aqua) que tapa la página hasta que Kora dibuja, máximo 4 s; Kora dibuja a 60 cuadros mientras la movés y a 30 quieta o mientras scrolleás. |
| `src/kora/mount.js` + `src/kora/scene/` | La escena de Kora. `scene/` es una copia de `../exploraciones/kora-ascii/src` (ahí se edita): `node tools/kora/sync.mjs` la trae de nuevo junto con sus tipografías (Geist y Archivo, en `public/fonts/kora`). `mount.js` la monta acá: sin zoom con la rueda ni atajos de teclado, pausa fuera de pantalla, baja la resolución si va lenta y con movimiento reducido no hay viento. |
| `src/three/kit.js` | Lo común de las marcas en 3D: renderer, visor en vivo (mira al cursor, se gira arrastrando, reacciona al toque, cambia de color) y foto fija. |
| `src/kench/toy.js`, `src/aish/logo3d.js`, `src/supplycon/iso3d.js` + `src/components/Toy3D.astro` | El isologo de Supplycon (vector oficial, pieza maciza en lima, carbón, crema o acero; renders: familia, escalones de hormigón y un muro de isologos), la llama de Kench (vector del logo, vinilo, cuatro colores) y el logo de AISH (calcado del Behance con la máscara limpia, `src/aish/logo-path.js`; en cromo con las luces de la pista y estrellas que titilan) en 3D. El bisel del logo de AISH va hacia adentro y es angosto: así no se cruza en los huecos finos ni en las puntas de las estrellas (`tools/aish/revisar.mjs` + `revisar.py` revisan la triangulación). `Toy3D` los monta vivos en la galería; `renderStill()` saca las escenas fijas. |
| `src/components/TiltCards.astro` | Tarjetas o flyers que se inclinan hacia el cursor, con brillo y sombra (las tarjetas de Kench, los flyers de AISH). |
| `tools/kench/`, `tools/aish/`, `tools/supplycon/` | `src/`: láminas del Behance, el vector o el calco del logo y los renders. `tools/render3d.mjs kench\|aish\|supplycon` vuelve a sacar las escenas 3D (con `npm run dev` andando); `tools/media.py tools/manifest.json --only kench/` (o `aish/…`) las pasa a `src/assets/work`. |
| `src/assets/kora/poster.jpg` | El cuadro que se ve hasta que arranca la escena (y si no hay WebGL). Se saca de `../exploraciones/kora-ascii/dist/kora.html` al atardecer, sin los textos de encima. |
| `src/components/Window.astro` | La ventana de vidrio con la galería. Se abre con `#slug` (se puede compartir). |
| `src/components/Buddy.astro` + `src/scripts/buddy.ts` | La burbuja que acompaña al cursor. En la página aparece al apuntar algo con `data-say`, cambia de frase mientras sigas apuntando cosas y se va un segundo después. En una ventana llega con la ventana y se queda mientras el puntero esté adentro: sobre una pieza dice qué es; sobre lo demás, las frases del proyecto (`data-says`). Sola habla poco: el saludo y, con el puntero quieto un rato, algo de la sección a la vista (`data-ambient`). Resorte suave al seguir; con movimiento reducido va pegada y en pantallas táctiles no aparece. |
| `src/scripts/sound.ts` + `src/components/SoundToggle.astro` | El diseño sonoro, todo en un archivo: `SOUNDS` (cada efecto, sintetizado con Web Audio, con su volumen y duración) y `TRIGGERS` (qué evento dispara cuál). Viene prendido (suena desde el primer clic o tecla, porque el navegador no deja arrancar el audio antes); el botón del rincón lo apaga y guarda la preferencia. |
| `src/scripts/windows.ts` | Abrir y cerrar ventanas (efecto genio desde la tarjeta, flechas ← →, Esc, semáforos) y el chat de contacto: la entrada en orden, tu mensaje como globo, los puntitos que se reemplazan por la respuesta; pide el mail para contestar y envía el mensaje desde la página con FormSubmit (formsubmit.co, sin abrir el correo). Solo si el envío falla abre el correo con el mensaje. Avisa `win:open` y `win:close` para que la burbuja se mude a la ventana. |
| `src/styles/global.css` | Tokens y el kit Aqua: `.glass`, `.titlebar`, `.lights`, `.aqua`, `.bead`, burbujas. |
| `src/scripts/ascii.ts` | El motor del campo ASCII (`Plotter`). |
| `src/scripts/site.ts` | Lo que se activa al cargar: scroll, revelados, videos diferidos, copiar email, burbuja, ventanas y campos ASCII. |
| `tools/media.py` + `tools/manifest.json` | Prepara imágenes y loops desde los originales. |
| `tools/covers/` | Plantillas de las portadas (pantalla de macOS, composiciones) y sus capturas de origen. |
| `tools/qa/` | `shot.py` (capturas con Chrome headless), `perf.py` (FCP, LCP, CLS, peso) y `stepshot.py` (scroll cuadro a cuadro). |
| `tools/cirilog-mock/` | Servidor con datos inventados para las capturas de CiriLog (nunca usa la base real). |
| `_versiones/v2-con-paginas/` | La versión anterior, con una página por proyecto, hero, perfil y retrato ASCII. No entra en el build. |
| `tools/esports/` | Script que bajó las piezas de e-sports desde Behance. |
| `tools/kora/sync.mjs` | Copia la escena de Kora y sus tipografías desde la exploración. |
| `_versiones/` | Versión 1 del sitio y componentes descartados, por si hace falta recuperar algo. No entra en el build. |
| `src/components/CoverStack.astro` + `src/tapas/ring.js` | El anillo 3D de tapas (three.js) del proyecto Tapas de discos: tapas como placas de vidrio y un lente en los costados. Vive solo en la galería (gira solo, se arrastra, al tocar una tapa la trae adelante y la burbuja nombra la que apuntás); en la tarjeta de la página es una foto fija (`tapas/anillo.jpg`), para no sumar otro 3D a la página. |

## Agregar o cambiar un proyecto

1. Sumá sus medios a `tools/manifest.json`:
   - `images` van a `src/assets/work/`. Astro genera AVIF y WebP al compilar.
   - `videos` van a `public/media/`, en H.264, AV1 y póster. Se indican `ss` (inicio), `t` (duración) y `crop` de ffmpeg.
2. Corré `python3 tools/media.py tools/manifest.json --only <carpeta>`. Solo lee los originales, nunca los modifica.
3. Agregá el proyecto en `src/data/projects.ts`. Con `featured` aparece como tarjeta; sin `featured`, en la lista «Más proyectos» (usa `thumb` como icono).

Los datos de los textos salen de los repos, READMEs y notas de cada proyecto.

## El campo ASCII

`Plotter` calcula un glifo por celda en la CPU y la GPU lo dibuja desde un atlas, con una textura chica y un solo draw call por cuadro.

- **Curvas de nivel.** Ruido fbm con trazos `- / | \` que siguen la tangente de cada curva, en gris claro detrás del contacto y del 404. Cada campo arranca recién cuando se acerca a la pantalla.
- **Linterna.** Cerca del cursor, la curva que pasa por debajo se enciende en naranja.
- **Retrato.** El modo con foto (`setSource`, `setReveal`) sigue en el motor, aunque la página ya no lo usa.

El campo se pausa fuera de pantalla y con la pestaña oculta. Con `prefers-reduced-motion` queda un cuadro fijo, y sin WebGL queda el papel liso.

## Sonido

Efectos originales, sintetizados en el navegador (nada grabado), de 100 a 340 ms. Cuatro familias, cada una con un porqué fijo; de la más suave a la más clara:

| Familia | Cuándo suena | Sonido | Evento |
|---|---|---|---|
| **Burbuja** | La burbuja aparece porque moviste el puntero hacia algo (o, si estaba hablando sola, pasa a hablarte de lo que apuntás, con un rebote). No suena al cambiar de frase, cuando habla sola, cuando llega con una ventana ni con el scroll. | pop de gel bajito | `buddy:open` |
| **Cambio** | Cambiaste un valor: el color de una marca 3D, qué tarjeta va adelante (gota; si no cambió nada, no suena). El slider de día y noche hace un tic en cada muesca que cruza, como una rueda de selección. | gota, tic | `toy:color`, `tilt:front`, `sky:tick` |
| **Acción** | Algo se abre o se agranda (una ventana, pasar de proyecto, el semáforo verde) / se cierra o se achica / tocaste algo vivo (Kora, la llama de Kench, el logo de AISH). | soplido que sube / toque que baja / rebote | `win:open`, `win:zoom`, `win:closing`, `kora:poke`, `toy:poke` |
| **Resultado** | El mensaje sale y llega la respuesta / el mail se copió / falta algo (siempre junto a la sacudida y el aviso). | clic acuoso y pop redondo / dos notas / toque grave | `chat:send`, `chat:reply`, `copy:ok`, `form:error` |

Nada suena al scrollear, al mover el mouse, al arrastrar, por animaciones ni por links que salen del sitio. Cada cosa suena siempre que pasa y, si se repite rápido, vuelve a empezar. Nunca suenan dos a la vez: lo nuevo corta a lo anterior, salvo el pop de la burbuja, que no corta nada. Los volúmenes están calibrados para que cada familia suene pareja (`node tools/qa/sonidos.mjs` los mide y propone). Con la pestaña oculta el audio se suspende. En desarrollo, `window.__sonidos` registra lo que sonó.

## Publicar

`dist/` es estático. Está preparado para **Vercel**: importá el repo en vercel.com/new y Vercel detecta Astro solo (build `npm run build`, salida `dist`, Node 22 o más). `site` en `astro.config.mjs` toma el dominio de producción del proyecto en Vercel (`VERCEL_PROJECT_PRODUCTION_URL`); si usás un dominio propio, definí `SITE_URL` (por ejemplo `https://tomascardozo.com`) en las variables del proyecto, porque se usa en las URLs canónicas y en las imágenes para redes.

El repo no incluye `_versiones/` (material apartado) ni las fuentes de trabajo de `tools/*/src` (imágenes sacadas de originales de clientes) ni `tools/cirilog-mock` (la copia de CiriLog para las capturas): las herramientas que las usan solo corren en esta Mac.

## Tipografías

Inter e Inter Display, de Rasmus Andersson (SIL OFL), autoalojadas en `public/fonts` con un subconjunto latino. La estampilla de Kora usa además Geist (Vercel, SIL OFL) y Archivo (Omnibus-Type, SIL OFL), que solo se descargan con ella; el japonés usa la tipografía del sistema.
