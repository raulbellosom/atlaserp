import { useState } from 'react'
import {
  PageHeader, Card, CardContent, CardHeader, CardTitle, Button,
  Badge, EmptyState, Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, Input, SelectField,
} from '@atlas/ui'
import {
  usePosSettings, useUpdatePosSettings,
  usePosOutlets, useCreatePosOutlet, useUpdatePosOutlet,
  usePosTerminals, useCreatePosTerminal, useUpdatePosTerminal,
  usePosStations, useCreatePosStation, useUpdatePosStation,
} from '../hooks/usePosSettings'

const MODE_OPTIONS = [
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'RETAIL', label: 'Tienda' },
  { value: 'HYBRID', label: 'Híbrido' },
]

const TABS = ['General', 'Sucursales & Terminales', 'Estaciones']

export default function PosSettingsScreen() {
  const [tab, setTab] = useState('General')

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader title="Configuración POS" description="Sucursales, terminales, estaciones y parámetros generales." />
        <div className="flex gap-2 border-b border-border pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                tab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'General' && <GeneralTab />}
        {tab === 'Sucursales & Terminales' && <OutletsTab />}
        {tab === 'Estaciones' && <StationsTab />}
      </div>
    </div>
  )
}

function GeneralTab() {
  const { data: settings, isLoading } = usePosSettings()
  const update = useUpdatePosSettings()
  const [mode, setMode] = useState(null)

  const currentMode = mode ?? settings?.mode ?? 'RESTAURANT'

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>

  return (
    <Card>
      <CardHeader><CardTitle>Parámetros generales</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Modo de operación</label>
          <SelectField
            value={currentMode}
            onChange={(v) => setMode(v)}
            options={MODE_OPTIONS}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            id="tips"
            type="checkbox"
            defaultChecked={settings?.tips_enabled ?? true}
            className="h-4 w-4"
          />
          <label htmlFor="tips" className="text-sm">Propinas habilitadas</label>
        </div>
        <Button
          onClick={() => update.mutate({ mode: currentMode })}
          disabled={update.isPending}
        >
          Guardar
        </Button>
      </CardContent>
    </Card>
  )
}

function OutletsTab() {
  const { data: outlets = [], isLoading: loadingOutlets } = usePosOutlets()
  const { data: terminals = [], isLoading: loadingTerminals } = usePosTerminals()
  const createOutlet = useCreatePosOutlet()
  const createTerminal = useCreatePosTerminal()

  const [outletDialog, setOutletDialog] = useState(false)
  const [terminalDialog, setTerminalDialog] = useState(false)
  const [outletName, setOutletName] = useState('')
  const [outletCode, setOutletCode] = useState('')
  const [terminalName, setTerminalName] = useState('')
  const [terminalCode, setTerminalCode] = useState('')
  const [terminalOutletId, setTerminalOutletId] = useState('')

  function handleCreateOutlet() {
    createOutlet.mutate({ name: outletName, code: outletCode || undefined }, {
      onSuccess: () => { setOutletDialog(false); setOutletName(''); setOutletCode('') },
    })
  }

  function handleCreateTerminal() {
    createTerminal.mutate(
      { name: terminalName, code: terminalCode || undefined, outlet_id: terminalOutletId },
      { onSuccess: () => { setTerminalDialog(false); setTerminalName(''); setTerminalCode(''); setTerminalOutletId('') } },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sucursales</CardTitle>
          <Button size="sm" onClick={() => setOutletDialog(true)}>+ Sucursal</Button>
        </CardHeader>
        <CardContent>
          {loadingOutlets ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : outlets.length === 0 ? (
            <EmptyState title="Sin sucursales" description="Crea la primera sucursal para continuar." />
          ) : (
            <ul className="divide-y divide-border">
              {outlets.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    {o.code && <p className="text-xs text-muted-foreground">Código: {o.code}</p>}
                  </div>
                  <Badge variant={o.enabled ? 'default' : 'secondary'}>
                    {o.enabled ? 'Activa' : 'Inactiva'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Terminales</CardTitle>
          <Button size="sm" onClick={() => setTerminalDialog(true)} disabled={outlets.length === 0}>
            + Terminal
          </Button>
        </CardHeader>
        <CardContent>
          {loadingTerminals ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : terminals.length === 0 ? (
            <EmptyState title="Sin terminales" description="Crea una terminal para cada punto de venta." />
          ) : (
            <ul className="divide-y divide-border">
              {terminals.map((t) => {
                const outlet = outlets.find((o) => o.id === t.outlet_id)
                return (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {outlet?.name ?? 'Sucursal desconocida'}{t.code ? ` · ${t.code}` : ''}
                      </p>
                    </div>
                    <Badge variant={t.enabled ? 'default' : 'secondary'}>
                      {t.enabled ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={outletDialog} onOpenChange={setOutletDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva sucursal</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Input placeholder="Nombre" value={outletName} onChange={(e) => setOutletName(e.target.value)} />
            <Input placeholder="Código (opcional)" value={outletCode} onChange={(e) => setOutletCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutletDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateOutlet} disabled={!outletName || createOutlet.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={terminalDialog} onOpenChange={setTerminalDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva terminal</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <SelectField
              value={terminalOutletId}
              onChange={setTerminalOutletId}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Selecciona sucursal"
            />
            <Input placeholder="Nombre" value={terminalName} onChange={(e) => setTerminalName(e.target.value)} />
            <Input placeholder="Código (opcional)" value={terminalCode} onChange={(e) => setTerminalCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTerminalDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateTerminal}
              disabled={!terminalName || !terminalOutletId || createTerminal.isPending}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StationsTab() {
  const { data: outlets = [] } = usePosOutlets()
  const [outletId, setOutletId] = useState('')
  const query = outletId ? { outlet_id: outletId } : {}
  const { data: stations = [], isLoading } = usePosStations(query)
  const createStation = useCreatePosStation()
  const [dialog, setDialog] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  function handleCreate() {
    createStation.mutate(
      { name, code, outlet_id: outletId },
      { onSuccess: () => { setDialog(false); setName(''); setCode('') } },
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Estaciones de preparación</CardTitle>
        <Button size="sm" onClick={() => setDialog(true)} disabled={!outletId}>+ Estación</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SelectField
          value={outletId}
          onChange={setOutletId}
          options={outlets.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="Selecciona sucursal"
        />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : stations.length === 0 ? (
          <EmptyState title="Sin estaciones" description="Crea estaciones como Cocina, Barra, Postres." />
        ) : (
          <ul className="divide-y divide-border">
            {stations.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Código: {s.code}</p>
                </div>
                <Badge variant={s.enabled ? 'default' : 'secondary'}>
                  {s.enabled ? 'Activa' : 'Inactiva'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva estación</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Input placeholder="Nombre (ej. Cocina)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Código (ej. KITCHEN)" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name || !code || createStation.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
