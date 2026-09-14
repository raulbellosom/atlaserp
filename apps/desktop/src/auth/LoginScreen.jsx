import { useState } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Layers, Building2, Mail, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TextField, PasswordField, Button } from '@runly/ui'
import { clearServerUrl, isTauriRuntime } from '../lib/serverStore.js'
import { atlas } from '../lib/atlas'
import { useAuth } from './AuthProvider'
import { normalizeAuthReturnPath } from './authReturnPath.js'

const SIDEBAR_FEATURES = [
  { icon: Server, label: 'Autoalojado en tu infraestructura' },
  { icon: Layers, label: 'Módulos que crecen con tu operación' },
  { icon: Building2, label: 'Multi-empresa desde el primer día' },
]

export function LoginScreen({ returnTo = '/app' }) {
  const navigate = useNavigate()
  const destination = normalizeAuthReturnPath(returnTo)
  const { session, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotMessage, setShowForgotMessage] = useState(false)

  useEffect(() => {
    let mounted = true
    atlas.instance.status()
      .then((data) => {
        if (!mounted) return
        if (!data?.initialized) {
          navigate('/app/setup', { replace: true })
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [navigate])

  useEffect(() => {
    if (authLoading) return
    if (session) {
      navigate(destination, { replace: true })
    }
  }, [authLoading, destination, navigate, session])

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
          setError('Credenciales incorrectas. Verifica tu correo y contraseña.')
        }
        return
      }
      navigate(destination, { replace: true })
    } catch {
      setError('Sin conexión con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleChangeServer() {
    await supabase.auth.signOut().catch(() => {})
    await clearServerUrl().catch(() => {})
    window.location.reload()
  }

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — Midnight/Navy base per the brand guide (the warm gradient
          is an accent, never a full-bleed fill); matches the setup wizard's
          hero panel treatment so both auth-adjacent screens read as one product. */}
      <div
        className="hidden lg:flex lg:w-105 lg:shrink-0 flex-col justify-between px-12 py-14 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #0C172D 0%, #132646 55%, #0C172D 100%)',
        }}
      >
        {/* Background depth glows — warm accent, per brand guide */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute -top-32 -left-32 w-md h-112 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(253,96,22,0.85) 0%, transparent 65%)' }}
          />
          <div
            className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(19,38,70,0.85) 0%, transparent 65%)' }}
          />
        </div>

        {/* Top: Runly logo — the login screen is shared across every company on
            this instance (multi-tenant), so it never shows a specific
            company's branding; that only appears once inside the app, after
            the user picks/activates a company. */}
        <div className="relative flex flex-col gap-4">
          <img
            src="/runly/runly-logo-dark.png"
            alt="Runly ERP"
            className="w-40 object-contain"
            draggable={false}
          />
        </div>

        {/* Middle: Feature list */}
        <div className="relative flex flex-col gap-6">
          <ul className="flex flex-col gap-5" role="list">
            {SIDEBAR_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ background: 'rgba(253,139,42,0.24)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#FD8B2A' }} aria-hidden="true" />
                </span>
                <span className="text-sm text-white/75 font-medium leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: slogan + version stamp */}
        <div className="relative flex flex-col gap-2">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.22em]">
            Business in motion.
          </p>
          <p className="text-white/20 text-xs tracking-wide">v2.0</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3">
            <img
              src="/runly/runly-isotipo-light.png"
              alt="Runly ERP"
              className="w-10 h-10 object-contain dark:hidden"
              draggable={false}
            />
            <img
              src="/runly/runly-isotipo-dark.png"
              alt="Runly ERP"
              className="hidden w-10 h-10 object-contain dark:block"
              draggable={false}
            />
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Runly ERP
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Bienvenido de nuevo</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ingresa para continuar donde lo dejaste.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <TextField
              id="email"
              icon={Mail}
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
              icon={Lock}
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
              {loading ? 'Verificando credenciales...' : 'Acceder al sistema'}
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
                Contacta al administrador del sistema para restablecer tu acceso.
              </p>
            )}
            {isTauriRuntime() ? (
              <button
                type="button"
                onClick={handleChangeServer}
                className="text-sm text-primary hover:text-primary/80 transition-colors duration-150"
              >
                Cambiar servidor
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
