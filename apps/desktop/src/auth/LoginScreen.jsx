import { useState } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Layers, Building2, Mail, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TextField, PasswordField, Button } from '@atlas/ui'
import { useBrandingStore } from '../stores/branding'
import { atlas } from '../lib/atlas'
import { useAuth } from './AuthProvider'

const SIDEBAR_FEATURES = [
  { icon: Server, label: 'Autoalojado en tu infraestructura' },
  { icon: Layers, label: 'Módulos que crecen con tu operación' },
  { icon: Building2, label: 'Multi-empresa desde el primer día' },
]

export function LoginScreen() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const branding = useBrandingStore((s) => s.branding)
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
          navigate('/setup', { replace: true })
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
      navigate('/app', { replace: true })
    }
  }, [authLoading, navigate, session])

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
      navigate('/app', { replace: true })
    } catch {
      setError('Sin conexión con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — color always from CSS var (set before render, no flash) */}
      <div
        className="hidden lg:flex lg:w-105 lg:shrink-0 flex-col justify-between px-12 py-14 relative overflow-hidden"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        {/* Background depth glows */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-md h-112 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Top: Atlas logo + company branding */}
        <div className="relative flex flex-col gap-4">
          <img
            src="/brand/atlas-logo-monochrome-light.png"
            alt="Atlas ERP"
            className="w-40 object-contain"
            draggable={false}
          />
          <span className="text-white/40 text-[11px] font-semibold uppercase tracking-[0.18em]">
            Meridian Edition
          </span>
          {(branding?.logoUrl || branding?.companyName) && (
            <div className="mt-2 pt-4 border-t border-white/10 flex flex-col gap-2">
              {branding.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName ?? 'Logo de la empresa'}
                  className="w-32 object-contain opacity-80"
                  draggable={false}
                />
              )}
              {branding.companyName && (
                <p className="text-white/70 text-sm font-semibold leading-tight">
                  {branding.companyName}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Middle: Feature list */}
        <div className="relative flex flex-col gap-6">
          <ul className="flex flex-col gap-5" role="list">
            {SIDEBAR_FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 shrink-0">
                  <Icon className="w-4 h-4 text-white" aria-hidden="true" />
                </span>
                <span className="text-sm text-white/75 font-medium leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: slogan + version stamp */}
        <div className="relative flex flex-col gap-2">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.22em]">
            Conecta. Gestiona. Crece.
          </p>
          <p className="text-white/20 text-xs tracking-wide">v2.0 &middot; Meridian Edition</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3">
            <img
              src="/brand/atlas-logo-isotype.png"
              alt="Atlas ERP"
              className="w-10 h-10 object-contain"
              draggable={false}
            />
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {branding?.companyName
                  ? branding.companyName
                  : 'Atlas ERP · Meridian Edition'}
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
          </div>
        </div>
      </div>
    </div>
  )
}
