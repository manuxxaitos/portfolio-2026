#!/usr/bin/env python3
"""
Prepara los medios del portfolio a partir de los originales (Mac o tarjeta).

    python3 tools/media.py tools/manifest.json [--only slug] [--force]

- videos  -> public/media/<out>.mp4 (H.264), <out>.av1.mp4 (AV1) y <out>.jpg (póster)
- images  -> src/assets/work/<out> (Astro genera AVIF/WebP responsivos al compilar)
- ascii   -> public/ascii/<out> (miniatura que el campo ASCII convierte en glifos)

Nunca modifica los originales: solo lee y escribe dentro del proyecto. Las rutas de origen usan
$ORIGINALES (la carpeta de proyectos), $TRABAJO y $HOME:

    ORIGINALES=/ruta/a/PROYECTOS python3 tools/media.py tools/manifest.json
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
ASSETS = ROOT / 'src' / 'assets' / 'work'


def resolve(src):
    """$ORIGINALES (la carpeta de proyectos), $TRABAJO y $HOME vienen del entorno; lo relativo, del proyecto."""
    src = os.path.expandvars(src)
    return src if os.path.isabs(src) else str(ROOT / src)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print('   ! ffmpeg:', r.stderr.strip().splitlines()[-1] if r.stderr else r.returncode)
        return False
    return True


def vf_chain(item, width):
    chain = []
    if item.get('crop'):
        chain.append(f"crop={item['crop']}")
    chain.append(f"scale={width}:-2:flags=lanczos")
    if item.get('fps'):
        chain.append(f"fps={item['fps']}")
    chain.append('format=yuv420p')
    return ','.join(chain)


def video(item, force):
    src = resolve(item['src'])
    out = PUBLIC / 'media' / item['out']
    out.parent.mkdir(parents=True, exist_ok=True)
    width = item.get('w', 1280)
    seek = ['-ss', str(item.get('ss', 0))]
    dur = ['-t', str(item['t'])] if item.get('t') else []
    vf = vf_chain(item, width)
    mp4 = out.with_suffix('.mp4')
    av1 = out.with_name(out.name + '.av1.mp4')
    poster = out.with_suffix('.jpg')
    if force or not mp4.exists():
        run(['ffmpeg', '-y', '-v', 'error', *seek, '-i', src, *dur, '-an', '-vf', vf,
             '-c:v', 'libx264', '-preset', 'slow', '-crf', str(item.get('crf', 24)),
             '-profile:v', 'high', '-movflags', '+faststart', str(mp4)])
    if force or not av1.exists():
        run(['ffmpeg', '-y', '-v', 'error', *seek, '-i', src, *dur, '-an', '-vf', vf,
             '-c:v', 'libsvtav1', '-preset', '6', '-crf', str(item.get('crf_av1', 40)),
             '-g', '120', '-movflags', '+faststart', str(av1)])
    if force or not poster.exists():
        pos = float(item.get('ss', 0)) + float(item.get('poster_at', 0))
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(pos), '-i', src, '-frames:v', '1',
             '-vf', vf.replace(',format=yuv420p', ''), '-q:v', '3', str(poster)])
    sizes = [p.stat().st_size // 1024 for p in (mp4, av1, poster) if p.exists()]
    print(f"   video {item['out']}: mp4/av1/jpg = {sizes} KB")


def image(item, force):
    src = Path(resolve(item['src']))
    out = ASSETS / item['out']
    if out.exists() and not force:
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    if item.get('crop'):
        im = im.crop(tuple(item['crop']))
    w = item.get('w', 2400)
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    if out.suffix.lower() == '.png':
        im.save(out, optimize=True)
    else:
        # un PNG con transparencia va sobre el fondo indicado (si no, la transparencia queda negra)
        if item.get('bg') and im.mode in ('RGBA', 'LA', 'P'):
            back = Image.new('RGBA', im.size, item['bg'])
            back.alpha_composite(im.convert('RGBA'))
            im = back
        im.convert('RGB').save(out, quality=item.get('q', 90), optimize=True, progressive=True)
    print(f"   image {item['out']}: {im.width}x{im.height} {out.stat().st_size // 1024} KB")


def ascii_thumb(item, force):
    out = PUBLIC / 'ascii' / item['out']
    if out.exists() and not force:
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    src = resolve(item['src'])
    if src.lower().endswith(('.mp4', '.mov', '.webm', '.m4v')):
        tmp = out.with_suffix('.tmp.jpg')
        run(['ffmpeg', '-y', '-v', 'error', '-ss', str(item.get('ss', 1)), '-i', src,
             '-frames:v', '1', '-vf', 'scale=640:-2', str(tmp)])
        im = Image.open(tmp)
        tmp.unlink()
    else:
        im = ImageOps.exif_transpose(Image.open(src))
    if item.get('crop'):
        im = im.crop(tuple(item['crop']))
    im = im.convert('RGB')
    im.thumbnail((640, 640), Image.LANCZOS)
    im.save(out.with_suffix('.jpg'), quality=82, optimize=True)
    print(f"   ascii {item['out']}: {im.width}x{im.height}")


def main():
    manifest = json.loads(Path(sys.argv[1]).read_text())
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    force = '--force' in sys.argv
    for kind, fn in (('images', image), ('videos', video), ('ascii', ascii_thumb)):
        for item in manifest.get(kind, []):
            if only and not item['out'].startswith(only):
                continue
            print(f"-> {kind[:-1]} {item['out']}")
            try:
                fn(item, force)
            except Exception as e:  # noqa: BLE001
                print('   ! error:', e)


if __name__ == '__main__':
    main()
