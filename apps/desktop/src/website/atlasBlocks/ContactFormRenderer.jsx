import { useEffect, useRef } from 'react'

import { getApiUrl } from '../../lib/runtimeConfig.js'

let sdkPromise = null

function loadStorefrontSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('El SDK storefront requiere un navegador'))
  }
  if (window.AtlasERP?.renderForm) return Promise.resolve(window.AtlasERP)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('atlas-storefront-sdk')
    const script = existing ?? document.createElement('script')
    const handleLoad = () => {
      if (window.AtlasERP?.renderForm) resolve(window.AtlasERP)
      else reject(new Error('El SDK storefront no expuso renderForm'))
    }
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('No se pudo cargar el SDK storefront')),
      { once: true },
    )
    if (!existing) {
      script.id = 'atlas-storefront-sdk'
      script.src = `${getApiUrl()}/public/site/atlas-sdk.js`
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch((error) => {
    sdkPromise = null
    throw error
  })
  return sdkPromise
}

export default function ContactFormRenderer({
  formId,
  successMessage,
  buttonLabel,
}) {
  const targetRef = useRef(null)
  const loadingRef = useRef(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (!formId || !targetRef.current) return undefined
    let cancelled = false
    let controller = null
    if (loadingRef.current) loadingRef.current.style.display = 'block'
    if (errorRef.current) errorRef.current.style.display = 'none'

    loadStorefrontSdk()
      .then((atlas) =>
        atlas.renderForm(targetRef.current, {
          formId,
          theme: 'auto',
          labels: {
            button: buttonLabel,
            success: successMessage,
          },
        }),
      )
      .then((mounted) => {
        if (cancelled) {
          mounted?.destroy?.()
          return
        }
        controller = mounted
        if (loadingRef.current) loadingRef.current.style.display = 'none'
      })
      .catch(() => {
        if (cancelled) return
        if (loadingRef.current) loadingRef.current.style.display = 'none'
        if (errorRef.current) errorRef.current.style.display = 'block'
      })

    return () => {
      cancelled = true
      controller?.destroy?.()
    }
  }, [buttonLabel, formId, successMessage])

  if (!formId) {
    return (
      <div style={{ padding: '24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>
          Configura el ID del formulario en las propiedades
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '520px' }}>
      <p ref={loadingRef} style={{ color: '#64748b', fontSize: '14px' }}>
        Cargando formulario...
      </p>
      <p
        ref={errorRef}
        role="alert"
        style={{ color: '#dc2626', display: 'none', fontSize: '14px' }}
      >
        No se pudo cargar el formulario configurado.
      </p>
      <div ref={targetRef} />
    </div>
  )
}
