// Local test fixture only; never deployed with Atlas. Use a development/debug host.
import { createServer } from 'node:http'
import { NATIVE_CSP } from './web-policy.js'

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/app/http-error') { res.writeHead(503); res.end('Test error'); return }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (path !== '/app/no-policy' && !process.argv.includes('--no-policy')) res.setHeader('Content-Security-Policy', NATIVE_CSP)
  res.end(`<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Atlas Native Smoke</title>
    <h1>Atlas Native Host: prueba local</h1><pre id="result">Cargando bridge…</pre>
    <script>
    window.smoke = {};
    (async () => {
      try {
        smoke.info = await window.__TAURI_INTERNALS__.invoke('host_info');
        if (location.pathname !== '/app/no-ready') await window.__TAURI_INTERNALS__.invoke('host_ready');
        document.getElementById('result').textContent = JSON.stringify(smoke.info, null, 2);
      } catch (e) { smoke.error = String(e); document.getElementById('result').textContent = smoke.error; }
    })();
    </script></html>`)
})
server.listen(5184, '127.0.0.1', () => console.log('Native smoke fixture: http://127.0.0.1:5184/app/'))
