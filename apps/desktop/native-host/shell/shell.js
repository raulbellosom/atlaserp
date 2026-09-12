const status = document.getElementById('status')
const retry = document.getElementById('retry')
const diagnostics = document.getElementById('diagnostics')
const invoke = (command) => window.__TAURI_INTERNALS__.invoke(command)

async function connect() {
  retry.disabled = true
  status.textContent = 'Conectando con Atlas…'
  try {
    await invoke('host_connect')
  } catch (error) {
    status.textContent = 'No se pudo conectar con Atlas.'
    diagnostics.textContent += `\nError: ${String(error)}\nRed: ${navigator.onLine ? 'disponible' : 'sin conexión'}`
  } finally { retry.disabled = false }
}

retry.addEventListener('click', connect)
invoke('host_info').then((info) => {
  diagnostics.textContent = `Host: ${info.nativeHostVersion}\nPlataforma: ${info.platform}\nSistema: ${info.osVersion}\nFrontend: ${info.frontendUrl}\nRed: ${navigator.onLine ? 'disponible' : 'sin conexión'}`
  if (location.hash === '#failed') status.textContent = 'No se pudo conectar con Atlas.'
  else connect()
}).catch(() => { status.textContent = 'No se pudo iniciar Atlas. Reinicia la aplicación.' })
