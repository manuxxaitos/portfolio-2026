#!/usr/bin/env python3
"""Capturas con Chrome headless: shot.py <url> <out-prefix> --w 1440 --h 900 --dpr 1
   --at "sel=#trabajo,dy=0,mx=400,my=300,wait=1.2;y=2400" (varias capturas separadas por ;)"""
import argparse, base64, json, os, shutil, socket, subprocess, tempfile, time, urllib.request
import websocket
ap = argparse.ArgumentParser()
ap.add_argument('url'); ap.add_argument('out')
ap.add_argument('--w', type=int, default=1440); ap.add_argument('--h', type=int, default=900)
ap.add_argument('--dpr', type=float, default=1); ap.add_argument('--mobile', action='store_true')
ap.add_argument('--at', default='y=0'); ap.add_argument('--wait', type=float, default=2.5)
ap.add_argument('--js', default='')
a = ap.parse_args()
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
prof = tempfile.mkdtemp(prefix='shot-')
proc = subprocess.Popen([CH, '--headless=new', '--hide-scrollbars', '--no-first-run', f'--remote-debugging-port={port}',
                         f'--user-data-dir={prof}', f'--window-size={a.w},{a.h}', '--autoplay-policy=no-user-gesture-required', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version', timeout=1); break
        except Exception: time.sleep(0.1)
    tab = json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/json/new?about:blank', method='PUT')).read())
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=90)
    mid = [0]
    def send(m, p=None):
        mid[0] += 1; i = mid[0]
        ws.send(json.dumps({'id': i, 'method': m, 'params': p or {}}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == i: return r
    send('Emulation.setDeviceMetricsOverride', {'width': a.w, 'height': a.h, 'deviceScaleFactor': a.dpr, 'mobile': a.mobile})
    if a.mobile: send('Emulation.setTouchEmulationEnabled', {'enabled': True})
    send('Page.enable'); send('Runtime.enable'); send('Page.navigate', {'url': a.url})
    time.sleep(a.wait)
    if a.js: send('Runtime.evaluate', {'expression': a.js, 'awaitPromise': True})
    for k, spec in enumerate(a.at.split(';')):
        o = dict(kv.split('=', 1) for kv in spec.split(',') if '=' in kv)
        if 'sel' in o:
            expr = f"(()=>{{const e=document.querySelector({json.dumps(o['sel'])});window.scrollTo(0,e.getBoundingClientRect().top+scrollY+{float(o.get('dy',0))});return scrollY}})()"
        else:
            expr = f"(()=>{{window.scrollTo(0,{float(o.get('y',0))});return scrollY}})()"
        send('Runtime.evaluate', {'expression': expr})
        time.sleep(0.5)
        if 'mx' in o:
            mx, my = float(o['mx']), float(o['my'])
            for j in range(8):
                send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': mx - 40 + j * 5, 'y': my, 'pointerType': 'mouse'})
                time.sleep(0.05)
        time.sleep(float(o.get('wait', 1.2)))
        r = send('Page.captureScreenshot', {'format': 'png'})
        path = f'{a.out}-{k}.png'
        open(path, 'wb').write(base64.b64decode(r['result']['data'])); print(path)
finally:
    proc.terminate(); shutil.rmtree(prof, ignore_errors=True)
