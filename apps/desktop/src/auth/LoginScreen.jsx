import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { atlas } from '../lib/atlas'
import { TextField, PasswordField, Button } from '@atlas/ui'

export function LoginScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [branding, setBranding] = useState(location.state?.branding ?? null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotMessage, setShowForgotMessage] = useState(false)

  useEffect(() => {
    if (!branding) {
      atlas.instance.status().then(data => {
        if (data.branding) setBranding(data.branding)
      }).catch(() => {})
    }
  }, [branding])

  useEffect(() => {
    if (!branding?.primaryColor) return
    document.documentElement.style.setProperty('--brand-primary', branding.primaryColor)
    return () => {
      document.documentElement.style.removeProperty('--brand-primary')
    }
  }, [branding?.primaryColor])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setShowForgotMessage(false)
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          setError('Tu cuenta no ha sido confirmada. Contacta al administrador.')
        } else {
          setError('Correo o contraseña incorrectos.')
        }
        return
      }
      navigate('/app', { replace: true })
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Left branded panel — desktop only */}
      <div className="hidden lg:flex lg:w-[400px] lg:shrink-0 flex-col items-center justify-center gap-6 bg-foreground px-12">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt="Logo de la empresa"
            className="max-w-[160px] max-h-[80px] object-contain"
          />
        ) : (
          <span className="text-xl font-semibold tracking-tight text-background">
            Atlas ERP
          </span>
        )}
        <p className="text-sm text-background/40 text-center">Tu ERP. Tu empresa.</p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Atlas ERP
            </p>
            <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <TextField
              id="email"
              label="Correo electrónico"
              type="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              required
            />
            <PasswordField
              id="password"
              label="Contraseña"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email || !password}
              aria-busy={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => setShowForgotMessage(v => !v)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              ¿Olvidaste tu contraseña?
            </button>
            {showForgotMessage && (
              <p className="text-xs text-muted-foreground">
                Recuperación de contraseña disponible próximamente.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
