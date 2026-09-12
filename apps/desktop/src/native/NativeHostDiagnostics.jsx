import { useEffect, useRef, useState } from 'react'
import { Button, PageHeader, EmptyState, ErrorState } from '@atlas/ui'
import { native } from './index.js'

export function NativeHostDiagnostics() {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [mediaActive, setMediaActive] = useState(false)
  const stream = useRef(null)
  const video = useRef(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let mounted = true
    native.getHostInfo().then((value) => { if (mounted) setInfo(value) })
      .catch((reason) => { if (mounted) setError(String(reason.message ?? reason)) })
    return () => { mounted = false; alive.current = false; stream.current?.getTracks().forEach((track) => track.stop()) }
  }, [])

  async function run(action) {
    setError(''); setStatus(''); setBusy(true)
    try { await action() } catch (reason) { setError(String(reason.message ?? reason)) }
    finally { setBusy(false) }
  }

  async function testMedia() {
    if (stream.current) {
      stream.current.getTracks().forEach((track) => track.stop())
      stream.current = null
      if (video.current) video.current.srcObject = null
      setMediaActive(false)
      setStatus('Micrófono y cámara detenidos.')
      return
    }
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    if (!alive.current) { acquired.getTracks().forEach((track) => track.stop()); return }
    stream.current = acquired
    if (video.current) video.current.srcObject = stream.current
    setMediaActive(true)
    setStatus('Micrófono y cámara activos. No se envía ni se graba contenido.')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader title="Diagnóstico de Atlas" description="Comprueba la conexión con las funciones de tu dispositivo." />
      {!native.isAvailable() ? <EmptyState title="Atlas Web" description="Estas pruebas están disponibles desde la aplicación instalada." /> : <>
        {info && <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt>Versión de la aplicación nativa</dt><dd>{info.nativeHostVersion}</dd>
          <dt>Plataforma</dt><dd>{info.platform}</dd>
          <dt>Sistema operativo</dt><dd>{info.osVersion ?? 'No disponible'}</dd>
          <dt>Versión web</dt><dd>{import.meta.env.VITE_APP_VERSION ?? 'Sin etiqueta de despliegue'}</dd>
          <dt>Funciones disponibles</dt><dd>{info.capabilities.join(', ')}</dd>
        </dl>}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !native.supports('haptics')} onClick={() => run(async () => { await native.haptics.impact(); setStatus('Vibración solicitada.'); })}>Probar vibración</Button>
          <Button disabled={busy || !info} onClick={() => run(async () => {
            const permission = await native.notifications.requestPermission()
            if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado.')
            await native.notifications.show({ title: 'Atlas ERP', body: 'La notificación local funciona.' })
            setStatus('Notificación enviada.')
          })}>Probar notificación</Button>
          <Button disabled={busy} variant="outline" onClick={() => run(testMedia)}>{mediaActive ? 'Detener cámara y micrófono' : 'Probar cámara y micrófono'}</Button>
          <Button disabled={busy} variant="outline" onClick={() => run(() => native.openExternal('https://github.com/raulbellosom/atlaserp'))}>Abrir enlace externo</Button>
        </div>
        <video ref={video} autoPlay playsInline muted className={mediaActive ? 'w-full rounded-xl' : 'hidden'} aria-label="Vista previa de cámara" />
        {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
      </>}
      {error && <ErrorState title="No se pudo completar la prueba" description={error} />}
    </div>
  )
}
