import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, LogIn, RefreshCcw } from 'lucide-react'
import { Button, Card, CardContent, ErrorState } from '@atlas/ui'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthProvider'
import { AppLoader } from '../components/AppLoader'
import { useFinishGoogleCalendarConnect } from '../modules/atlas.calendar/hooks/useGoogleCalendarData'

const CALENDAR_RETURN_PATH = '/app/m/atlas.calendar/calendar'

function buildGoogleErrorMessage(errorCode) {
  if (errorCode === 'access_denied') {
    return 'Cancelaste la autorizacion en Google. Puedes intentarlo de nuevo cuando quieras.'
  }

  return `Google devolvio el error "${errorCode}". Intenta nuevamente desde Atlas.`
}

export function GoogleCalendarCallbackScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const finishConnect = useFinishGoogleCalendarConnect()
  const hasStartedRef = useRef(false)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const googleError = searchParams.get('error')
  const token = session?.access_token ?? null
  const needsLogin = !token && !googleError

  const callbackError = useMemo(() => {
    if (googleError) {
      return {
        title: 'Google no autorizo la conexion',
        description: buildGoogleErrorMessage(googleError),
      }
    }

    if (!token) {
      return {
        title: 'Tu sesion ya no es valida',
        description: 'Inicia sesion de nuevo y vuelve a conectar Google Calendar.',
      }
    }

    if (!code) {
      return {
        title: 'La respuesta de Google esta incompleta',
        description: 'No recibimos el codigo de autorizacion necesario para completar la conexion.',
      }
    }

    if (!state) {
      return {
        title: 'La respuesta de Google esta incompleta',
        description: 'No recibimos el estado OAuth necesario para validar la conexion.',
      }
    }

    return null
  }, [code, googleError, state, token])

  const handleConnectSuccess = useCallback((result) => {
    const googleEmail = result?.connection?.googleEmail
    toast.success(
      googleEmail
        ? `Google Calendar conectado como ${googleEmail}.`
        : 'Google Calendar conectado correctamente.',
    )
    navigate(CALENDAR_RETURN_PATH, { replace: true })
  }, [navigate])

  const handleConnectError = useCallback((error) => {
    hasStartedRef.current = false
    toast.error(error?.message || 'No se pudo completar la conexion con Google.')
  }, [])

  const runConnection = useCallback(() => {
    if (!code || !state || !token) return
    finishConnect.mutate(
      { code, state },
      {
        onSuccess: handleConnectSuccess,
        onError: handleConnectError,
      },
    )
  }, [code, finishConnect, handleConnectError, handleConnectSuccess, state, token])

  useEffect(() => {
    if (
      callbackError ||
      !code ||
      !state ||
      !token ||
      hasStartedRef.current ||
      finishConnect.isPending
    ) {
      return
    }

    hasStartedRef.current = true
    runConnection()
  }, [callbackError, code, finishConnect.isPending, runConnection, state, token])

  function handleBack() {
    navigate(CALENDAR_RETURN_PATH, { replace: true })
  }

  function handleRetry() {
    if (!code || !state || !token) return
    finishConnect.reset()
    hasStartedRef.current = true
    runConnection()
  }

  if (callbackError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4 py-8">
        <Card className="w-full max-w-xl border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <ErrorState
              title={callbackError.title}
              description={callbackError.description}
              className="px-2 py-6"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {needsLogin ? (
                <Button onClick={() => navigate('/app/login', { replace: true })}>
                  <LogIn className="h-4 w-4" />
                  Ir a iniciar sesion
                </Button>
              ) : null}
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                Volver al calendario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (finishConnect.isPending) {
    return <AppLoader message="Conectando Google Calendar..." />
  }

  if (finishConnect.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4 py-8">
        <Card className="w-full max-w-xl border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-none">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <ErrorState
              title="No se pudo completar la conexion con Google"
              description={
                finishConnect.error?.message ||
                'Reintenta la conexion desde Atlas o valida la configuracion OAuth.'
              }
              className="px-2 py-6"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                Volver al calendario
              </Button>
              <Button onClick={handleRetry}>
                <RefreshCcw className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AppLoader message="Procesando respuesta de Google..." />
}
