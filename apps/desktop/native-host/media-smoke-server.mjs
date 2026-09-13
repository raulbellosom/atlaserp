// Synthetic local fixture. Requires the isolated LiveKit dev server documented in ATLAS_NATIVE_HOST.md.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { NATIVE_CSP } from './web-policy.js';
const require = createRequire(new URL('../../api/package.json', import.meta.url));
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const rooms = new RoomServiceClient('http://127.0.0.1:7885', 'devkey', 'secret');
async function token(identity, screen = false) {
  const t = new AccessToken('devkey', 'secret', { identity, ttl: '10m' });
  t.addGrant({ room: 'native-smoke', roomJoin: true, canSubscribe: !screen, canPublish: true, canPublishData: !screen, ...(screen ? { canPublishSources: [3] } : {}) });
  return t.toJwt();
}
createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/app/livekit.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await readFile(new URL('../node_modules/livekit-client/dist/livekit-client.umd.js', import.meta.url))); return; }
  if (req.url === '/app/participants') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify((await rooms.listParticipants('native-smoke')).map(p => ({ identity: p.identity, tracks: p.tracks.map(t => ({ source: t.source, type: t.type })) })))); return; }
  if (req.url === '/app/session') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({callId:'fixture-call',ownerIdentity:'fixture-primary',livekitUrl:'ws://10.0.2.2:7885',token:await token('screen:fixture-primary',true)})); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Security-Policy', NATIVE_CSP);
  res.end(`<!doctype html><meta name="viewport" content="width=device-width"><h1>Atlas: prueba local de pantalla</h1><pre id="status"></pre><script src="/app/livekit.js"></script><script>
  window.smoke={}; window.invoke=(...a)=>__TAURI_INTERNALS__.invoke(...a);
  (async()=>{await invoke('host_ready'); smoke.info=await invoke('host_info'); window.room=new LivekitClient.Room(); room.on('trackSubscribed',t=>{smoke.track={kind:t.kind,source:t.source};const e=t.attach();e.id='received';e.style.width='240px';document.body.append(e);}); await room.connect('ws://10.0.2.2:7885',${JSON.stringify(await token('fixture-primary'))});smoke.connected=true;document.getElementById('status').textContent=JSON.stringify(smoke);})().catch(e=>{smoke.error=String(e)});
  window.startScreen=async()=>{smoke.share='pending';try{smoke.share=await invoke('host_screen_start',{session:await(await fetch('/app/session')).json()});}catch(e){smoke.share={error:String(e)}}};
  </script>`);
}).listen(5184,'127.0.0.1',()=>console.log('Local media fixture ready'));
