import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader,
  Input,
  Checkbox,
  EmptyState,
  LoadingState,
} from '@atlas/ui'
import { useInventoryAssignments } from '../hooks/useInventoryItems.js'

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function InventoryAssignmentsScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)

  const { data, isLoading } = useInventoryAssignments({ active: activeOnly || undefined })

  const raw = data?.data ?? data ?? []

  function empName(r) {
    const e = r.employee
    if (!e) return r.employeeName ?? '—'
    return [e.firstName, e.lastName].filter(Boolean).join(' ') || '—'
  }

  const rows = search
    ? raw.filter(r => {
        const q = search.toLowerCase()
        return (
          (r.item?.name ?? '').toLowerCase().includes(q) ||
          empName(r).toLowerCase().includes(q) ||
          (r.item?.assetTag ?? '').toLowerCase().includes(q)
        )
      })
    : raw

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Inventario"
        title="Asignaciones"
        description="Historial de asignaciones y devoluciones de activos"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Buscar por activo o empleado..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={activeOnly}
            onCheckedChange={v => setActiveOnly(Boolean(v))}
          />
          Solo activas
        </label>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin asignaciones"
          description={search ? 'Ninguna asignacion coincide con la busqueda' : 'No hay asignaciones registradas'}
        />
      ) : (
        <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-2.5 text-left font-medium">Activo</th>
                <th className="px-4 py-2.5 text-left font-medium">Tag</th>
                <th className="px-4 py-2.5 text-left font-medium">Empleado</th>
                <th className="px-4 py-2.5 text-left font-medium">Asignado</th>
                <th className="px-4 py-2.5 text-left font-medium">Devuelto</th>
                <th className="px-4 py-2.5 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const active = !r.returnedAt
                return (
                  <tr
                    key={r.id}
                    onClick={() => {
                      if (r.itemId) navigate(`/app/m/atlas.inventory/inventory/${r.itemId}`)
                    }}
                    className="cursor-pointer border-b border-[hsl(var(--border)/0.5)] last:border-0 hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">{r.item?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      {r.item?.assetTag ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">{empName(r)}</td>
                    <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))]">{formatDate(r.assignedAt)}</td>
                    <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))]">{formatDate(r.returnedAt)}</td>
                    <td className="px-4 py-2.5">
                      {active
                        ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Activa</span>
                        : <span className="text-xs px-1.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] font-medium">Devuelta</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
