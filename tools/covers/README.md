# Portadas

Composiciones en HTML que se renderizan con Chrome headless a 1600×1000 (×1,5) y se guardan en `src/assets/work/covers/`.

- `mac.html#cirilog|precionauta|lym|medibra`: la app o el sitio en una pantalla de macOS simple (y el teléfono en los sitios). `#cirilog-pipeline` y `#cirilog-dark`: ventanas sueltas para la galería de CiriLog.
- `cover.html#aish|peregrina`: piezas compuestas sobre el color de la marca.

Las capturas de origen están en `src/`. Las de CiriLog usan datos inventados: la información real es confidencial.

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --window-size=1600,1000 --force-device-scale-factor=1.5 \
  --screenshot=cirilog.png "file://$PWD/mac.html#cirilog"
```
