import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { createAtlasClient } from '@atlas/sdk'
import { AppShell, Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton, Toaster, TooltipProvider } from '@atlas/ui'
import './styles.css'

const apiUrl = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'
const atlas = createAtlasClient({ baseUrl: apiUrl })
const queryClient = new QueryClient()

function Dashboard({ isDark, onThemeToggle }) {
  const modules = useQuery({ queryKey: ['modules'], queryFn: atlas.modules.list })
  const blueprints = useQuery({ queryKey: ['blueprints'], queryFn: atlas.blueprints.list })

  const navigation = [
    { label: 'Dashboard', path: '/', icon: 'LayoutDashboard' },
    { label: 'Módulos', path: '/modules', icon: 'Puzzle' },
    { label: 'Contactos', path: '/contacts', icon: 'Contact' },
    { label: 'Finanzas', path: '/finance', icon: 'Wallet' },
    { label: 'Configuración', path: '/settings', icon: 'Settings' }
  ]

  return (
    <AppShell navigation={navigation} currentPath="/" isDark={isDark} onThemeToggle={onThemeToggle}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))]">Atlas ERP</p>
            <h1 className="text-2xl font-semibold mt-1">Centro de mando</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
              Base inicial para un ERP modular con mapas, blueprints, módulos core e instalación de módulos versionados.
            </p>
          </div>
          <Button onClick={() => modules.refetch()} variant="glass" size="sm">
            Actualizar
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Módulos instalados
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {modules.isLoading
                ? <Skeleton className="h-8 w-16" />
                : <p className="text-3xl font-semibold">{modules.data?.data?.length ?? '-'}</p>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Blueprints activos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {blueprints.isLoading
                ? <Skeleton className="h-8 w-16" />
                : <p className="text-3xl font-semibold">{blueprints.data?.data?.length ?? '-'}</p>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Estado API
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge variant={modules.isError ? 'destructive' : 'success'}>
                {modules.isError ? 'Sin conexión' : 'Conectada'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Modules list */}
        <Card>
          <CardHeader>
            <CardTitle>Módulos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {modules.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {(modules.data?.data ?? []).map((module) => (
                  <div key={module.key} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{module.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                        {module.key} · v{module.version}
                      </p>
                    </div>
                    <Badge variant={module.core ? 'glass' : 'secondary'}>
                      {module.core ? 'Core' : module.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function App() {
  const [isDark, setIsDark] = useState(false)

  function handleThemeToggle() {
    setIsDark((d) => {
      document.documentElement.classList.toggle('dark', !d)
      return !d
    })
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Dashboard isDark={isDark} onThemeToggle={handleThemeToggle} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')).render(<App />)
