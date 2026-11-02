import json, socket, subprocess, tempfile, time, urllib.request, shutil, sys
import websocket
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
prof = tempfile.mkdtemp()
proc = subprocess.Popen([CH, '--headless=new', '--no-first-run', f'--remote-debugging-port={port}', f'--user-data-dir={prof}', '--window-size=1440,900', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
out = {}
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
    send('Page.enable')
    send('Network.setUserAgentOverride', {'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 'acceptLanguage': 'es-AR,es'})
    send('Page.addScriptToEvaluateOnNewDocument', {'source': "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"})
    for pid in sys.argv[1:]:
        send('Page.navigate', {'url': f'https://www.behance.net/gallery/{pid}/x'})
        time.sleep(12)
        print('  ', send('Runtime.evaluate', {'expression': 'document.title + " | " + document.body.innerText.slice(0,120)', 'returnByValue': True})['result']['result'].get('value'))
        for k in range(30):
            send('Runtime.evaluate', {'expression': 'window.scrollBy(0, 1400)'}); time.sleep(0.35)
        time.sleep(2)
        js = """JSON.stringify({title: document.title, imgs: [...document.querySelectorAll('img')].map(i => { const ss = (i.srcset||'').split(',').map(x=>x.trim().split(' ')[0]).filter(Boolean); return ss.length ? ss[ss.length-1] : i.currentSrc || i.src; }).filter(u => u.includes('project_modules'))})"""
        r = send('Runtime.evaluate', {'expression': js, 'returnByValue': True})
        v = json.loads(r['result']['result']['value']); out[pid] = v
        print(pid, v['title'][:70], len(v['imgs']))
finally:
    proc.terminate(); shutil.rmtree(prof, ignore_errors=True)
json.dump(out, open('urls.json', 'w'), indent=1)
