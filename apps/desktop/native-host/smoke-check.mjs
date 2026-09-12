// Debug emulator only. Forward its WebView devtools socket to localhost:9228 first.
import assert from 'node:assert/strict'

const pages = await (await fetch('http://127.0.0.1:9228/json/list')).json()
const page = pages.find((page) => page.type === 'page')
assert.ok(page, 'No debug WebView available')
assert.ok(['http://10.0.2.2:5184/', 'http://localhost:5184/', 'http://tauri.localhost/'].some((prefix) => page.url.startsWith(prefix)), 'Use only the development fixture host')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let sequence = 0
const pending = new Map()
socket.onmessage = ({ data }) => {
  const response = JSON.parse(data)
  const callback = pending.get(response.id)
  if (callback) { pending.delete(response.id); callback(response) }
}
async function evaluate(expression) {
  const id = ++sequence
  const result = new Promise((resolve) => pending.set(id, resolve))
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true, userGesture: true } }))
  const response = await result
  assert.ok(!response.error && !response.result.exceptionDetails, JSON.stringify(response))
  return response.result.result.value
}

try {
  const mode = process.argv[2] ?? 'bridge'
  if (mode === 'bridge') {
    const result = await evaluate(`(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const info = await invoke('host_info');
      const denied = {};
      for (const [command, args] of [ ['host_connect', {}], ['plugin:sql|load', {db:'sqlite:test.db'}], ['host_open_external', {url:'javascript:alert(1)'}] ]) {
        try { await invoke(command, args); denied[command] = false; } catch { denied[command] = true; }
      }
      await invoke('plugin:haptics|impact_feedback', {style:'light'});
      let blockedDirective = null;
      const onViolation = (event) => { if (event.effectiveDirective === 'frame-src') blockedDirective = event.effectiveDirective; };
      document.addEventListener('securitypolicyviolation', onViolation);
      const frame = document.createElement('iframe'); frame.src = 'https://example.com/'; document.body.append(frame);
      await new Promise(r => setTimeout(r, 800));
      document.removeEventListener('securitypolicyviolation', onViolation);
      frame.remove();
      return {info, denied, blockedDirective, ua:navigator.userAgent};
    })()`)
    assert.equal(result.info.platform, 'android')
    assert.equal(result.info.nativeHostVersion, '1.0.0')
    assert.ok(Object.values(result.denied).every(Boolean))
    assert.ok(result.ua.includes('Android') && result.ua.includes('Chrome') && result.ua.includes('AtlasNativeHost/'))
    assert.equal(result.blockedDirective, 'frame-src')
    console.log(JSON.stringify({ bridge: 'PASS', ...result }, null, 2))
  } else if (mode === 'queue') {
    const result = await evaluate(`(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const first = await invoke('host_events'); const second = await invoke('host_events');
      await invoke('host_ack_events', {ids:first.map(e=>e.id)});
      return {first, second, after:await invoke('host_events')};
    })()`)
    assert.ok(result.first.length > 0, 'Send atlas://call/smoke-123 before running queue test')
    assert.deepEqual(result.first, result.second)
    assert.deepEqual(result.after, [])
    console.log(JSON.stringify({ queue: 'PASS', ...result }, null, 2))
  } else if (mode === 'notification') {
    const result = await evaluate(`(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const granted = await invoke('plugin:notification|is_permission_granted');
      if (granted) await invoke('plugin:notification|notify', {options:{title:'Atlas Native Smoke',body:'Notificación local de prueba'}});
      return {granted};
    })()`)
    assert.equal(result.granted, true, 'Grant notification permission on the emulator first')
    console.log(JSON.stringify({ notification: 'PASS', ...result }))
  } else if (mode === 'media') {
    const result = await evaluate(`(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true,video:true});
      const tracks = stream.getTracks().map(t => ({kind:t.kind,readyState:t.readyState,enabled:t.enabled}));
      stream.getTracks().forEach(t=>t.stop());
      return {secure:isSecureContext,tracks};
    })()`)
    assert.equal(result.secure, true)
    assert.ok(result.tracks.some((t) => t.kind === 'audio' && t.readyState === 'live'))
    assert.ok(result.tracks.some((t) => t.kind === 'video' && t.readyState === 'live'))
    console.log(JSON.stringify({ media: 'PASS', ...result }))
  } else if (mode === 'external') {
    const result = await evaluate(`(async () => {
      const before=location.href;
      await window.__TAURI_INTERNALS__.invoke('host_open_external',{url:'https://example.com/'});
      return {before,after:location.href};
    })()`)
    assert.equal(result.before, result.after)
    console.log(JSON.stringify({ external: 'PASS', ...result }))
  } else if (mode === 'fallback') {
    await evaluate(`location.href = '/app/no-ready'; true`)
    await new Promise((resolve) => setTimeout(resolve, 32_000))
    const result = await evaluate(`({url:location.href, text:document.body.innerText})`)
    assert.ok(result.url.startsWith('http://tauri.localhost/') && result.url.endsWith('#failed'))
    assert.match(result.text, /No se pudo conectar con Atlas/)
    console.log(JSON.stringify({ fallback: 'PASS', ...result }, null, 2))
  } else if (mode === 'policy') {
    const result = await evaluate(`({url:location.href,diagnostic:document.getElementById('diagnostics')?.textContent})`)
    assert.ok(result.url.startsWith('http://tauri.localhost/'))
    assert.match(result.diagnostic, /MISSING_NATIVE_FRAME_POLICY/)
    console.log(JSON.stringify({ missingPolicy: 'PASS', ...result }, null, 2))
  } else if (mode === 'retry') {
    await evaluate(`document.getElementById('retry').click(); true`)
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const result = await evaluate(`({url:location.href, info:window.smoke?.info})`)
    assert.equal(result.info?.platform, 'android')
    console.log(JSON.stringify({ retry: 'PASS', ...result }, null, 2))
  } else throw new Error('Unknown smoke mode')
} finally { socket.close() }
