#!/usr/bin/env python3
"""Graba un scroll cuadro por cuadro (captura por posición) para páginas pesadas.
uso: stepshot.py <out.mp4> <url> --y0 0 --y1 1600 --frames 150 --w 1440 --h 900 --wait 8 --settle 0.07"""
import argparse, base64, json, os, shutil, socket, subprocess, tempfile, time, urllib.request
import websocket
ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('url')
ap.add_argument('--y0', type=int, default=0); ap.add_argument('--y1', type=int, default=1600)
ap.add_argument('--frames', type=int, default=150)
ap.add_argument('--w', type=int, default=1440); ap.add_argument('--h', type=int, default=900)
ap.add_argument('--wait', type=float, default=8); ap.add_argument('--settle', type=float, default=0.07)
ap.add_argument('--hold', type=int, default=12)
a = ap.parse_args()
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
prof = tempfile.mkdtemp(prefix='step-')
frames = tempfile.mkdtemp(prefix='frames-')
proc = subprocess.Popen([CH, '--headless=new', '--hide-scrollbars', '--no-first-run', f'--remote-debugging-port={port}',
                         f'--user-data-dir={prof}', f'--window-size={a.w},{a.h}', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version', timeout=1); break
        except Exception: time.sleep(0.1)
    tab = json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/json/new?about:blank', method='PUT')).read())
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=60)
    mid = [0]
    def send(m, p=None):
        mid[0] += 1; i = mid[0]
        ws.send(json.dumps({'id': i, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == i: return r
    send('Emulation.setDeviceMetricsOverride', {'width': a.w, 'height': a.h, 'deviceScaleFactor': 1, 'mobile': False})
    send('Page.enable'); send('Page.navigate', {'url': a.url})
    time.sleep(a.wait)
    send('Runtime.evaluate', {'expression': f'window.scrollTo({{top:{a.y0},behavior:"instant"}})'}); time.sleep(1)
    n = 0
    def shot():
        global n
        r = send('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
        open(os.path.join(frames, f'f{n:04d}.jpg'), 'wb').write(base64.b64decode(r['result']['data'])); n += 1
    for _ in range(a.hold): shot()
    for k in range(a.frames):
        t = (k + 1) / a.frames
        e = t * t * (3 - 2 * t)
        y = a.y0 + (a.y1 - a.y0) * e
        send('Runtime.evaluate', {'expression': f'window.scrollTo({{top:{y:.1f},behavior:"instant"}})'})
        time.sleep(a.settle)
        shot()
    for _ in range(a.hold): shot()
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', '30', '-i', os.path.join(frames, 'f%04d.jpg'),
                    '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', a.out], check=True)
    print(a.out, n, 'frames')
finally:
    proc.terminate()
    shutil.rmtree(prof, ignore_errors=True); shutil.rmtree(frames, ignore_errors=True)
