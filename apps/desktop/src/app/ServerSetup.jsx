import { useState } from 'react'
import { Button, Card, CardContent, PageHeader, TextField } from '@atlas/ui'
import { Link2, Server } from 'lucide-react'
import {
  connectToAtlasServer,
  getServerConnectionErrorMessage,
} from '../lib/desktopRuntime.js'

export function ServerSetup({ defaultUrl = '', initialError = '' }) {
  const [serverUrl, setServerUrl] = useState(defaultUrl)
  const [error, setError] = useState(initialError)
  const [isConnecting, setIsConnecting] = useState(false)

  async function handleConnect(event) {
    event.preventDefault()
    setError('')
    setIsConnecting(true)

    try {
      await connectToAtlasServer(serverUrl)
      window.location.reload()
    } catch (connectError) {
      setError(getServerConnectionErrorMessage(connectError))
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl items-center justify-center">
        <div className="w-full space-y-6">
          <PageHeader
            eyebrow="Atlas ERP Desktop"
            title="Conectar a tu servidor"
            description="Ingresa la URL de tu instancia para usar Atlas ERP desde este equipo."
          />

          <Card>
            <CardContent className="space-y-5 p-6">
              <form className="space-y-4" onSubmit={handleConnect}>
                <TextField
                  label="URL del servidor"
                  icon={Server}
                  type="url"
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="https://mi-empresa.com"
                  autoComplete="url"
                  required
                />

                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isConnecting || !serverUrl.trim()}
                >
                  {isConnecting ? 'Conectando...' : 'Conectar'}
                </Button>
              </form>

              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Usa la URL publica de tu instancia. Ejemplo:{' '}
                    <span className="font-medium text-foreground">https://mi-empresa.com</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
