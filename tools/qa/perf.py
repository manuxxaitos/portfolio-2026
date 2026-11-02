#!/usr/bin/env python3
import json, socket, subprocess, tempfile, time, urllib.request, shutil, sys
import websocket
url = sys.argv[1]; mobile = '--mobile' in sys.argv
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
prof = tempfile.mkdtemp(prefix='perf-')
proc = subprocess.Popen([CH, '--headless=new', '--no-first-run', f'--remote-debugging-port={port}', f'--user-data-dir={prof}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
    w, h, dpr = (390, 844, 3) if mobile else (1440, 900, 2)
    send('Emulation.setDeviceMetricsOverride', {'width': w, 'height': h, 'deviceScaleFactor': dpr, 'mobile': mobile})
    send('Network.enable')
    # red "4G rápida" + CPU x4 en móvil
    if mobile:
        send('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 1.6e6/8*1024/1000*1000, 'uploadThroughput': 750e3/8})
        send('Emulation.setCPUThrottlingRate', {'rate': 4})
    send('Page.enable')
    send('Page.addScriptToEvaluateOnNewDocument', {'source': "window.__lcp=0;window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__lcp=e.startTime;window.__lcpEl=e.element?(e.element.tagName+'.'+(e.element.className||'').toString().split(' ')[0]+' '+(e.element.textContent||'').trim().slice(0,30)):e.url}}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});"})
    send('Page.navigate', {'url': url})
    time.sleep(7 if mobile else 4)
    r = send('Runtime.evaluate', {'expression': "JSON.stringify((()=>{const n=performance.getEntriesByType('navigation')[0];const res=performance.getEntriesByType('resource');const by={};let tot=n.transferSize;for(const x of res){const k=x.initiatorType;by[k]=(by[k]||0)+x.transferSize;tot+=x.transferSize}const fcp=performance.getEntriesByName('first-contentful-paint')[0];return {fcp:Math.round(fcp?fcp.startTime:0),lcp:Math.round(window.__lcp),cls:+window.__cls.toFixed(4),el:window.__lcpEl,dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),kb:Math.round(tot/1024),byType:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,Math.round(v/1024)])),n:res.length}})())", 'returnByValue': True})
    print(('MOBILE ' if mobile else 'DESKTOP ') + r['result']['result']['value'])
finally:
    proc.terminate(); shutil.rmtree(prof, ignore_errors=True)
