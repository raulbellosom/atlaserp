import { bootstrapDesktopRuntime } from './lib/desktopRuntime.js'

const runtimeState = await bootstrapDesktopRuntime().catch(() => ({
  initialServerUrl: null,
  requiresServerSetup: true,
  bootstrapError: 'No se pudo conectar. Verifica la URL e intenta de nuevo.',
}))

const { renderApp } = await import('./app/AppEntry.jsx')

renderApp(runtimeState)
