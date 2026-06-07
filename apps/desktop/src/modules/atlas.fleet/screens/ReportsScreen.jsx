import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasTable, Button, PageHeader } from '@atlas/ui'
import { Plus } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'
import { componentRegistry } from '../../../lib/moduleComponentRegistry'

const API_BASE = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

const REPORT_TABS = [
  { key: 'maintenance', label: 'Mantenimiento' },
  { key: 'service',     label: 'Servicio'      },
  { key: 'repair',      label: 'Reparacion'    },
  { key: 'other',       label: 'Otro'          },
]

const REPORT_TABLES = {
  maintenance: {
    key: 'fleet.reports.maintenance.table',
    kind: 'TABLE',
    schema: {
      entity: 'report',
      component: 'AtlasTable',
      apiPath: '/fleet/reports/maintenance',
      primaryField: 'title',
      searchable: true,
      searchPlaceholder: 'Buscar reportes de mantenimiento...',
      columns: [
        { field: 'folio', label: 'Folio', sortable: true },
        { field: 'title', label: 'Titulo', sortable: true, link: true },
        { field: 'vehicle_plate', label: 'Vehiculo' },
        { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
        { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
        { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
      ],
      rowActions: [
        { label: 'Ver detalle', permission: 'fleet.reports.read' },
        { label: 'Editar', permission: 'fleet.reports.update' },
        { label: 'Desactivar', permission: 'fleet.reports.delete' },
      ],
    },
  },
  service: {
    key: 'fleet.reports.service.table',
    kind: 'TABLE',
    schema: {
      entity: 'report',
      component: 'AtlasTable',
      apiPath: '/fleet/reports/service',
      primaryField: 'title',
      searchable: true,
      searchPlaceholder: 'Buscar reportes de servicio...',
      columns: [
        { field: 'folio', label: 'Folio', sortable: true },
        { field: 'title', label: 'Titulo', sortable: true, link: true },
        { field: 'vehicle_plate', label: 'Vehiculo' },
        { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
        { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
        { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
      ],
      rowActions: [
        { label: 'Ver detalle', permission: 'fleet.reports.read' },
        { label: 'Editar', permission: 'fleet.reports.update' },
        { label: 'Desactivar', permission: 'fleet.reports.delete' },
      ],
    },
  },
  repair: {
    key: 'fleet.reports.repair.table',
    kind: 'TABLE',
    schema: {
      entity: 'report',
      component: 'AtlasTable',
      apiPath: '/fleet/reports/repair',
      primaryField: 'title',
      searchable: true,
      searchPlaceholder: 'Buscar reportes de reparacion...',
      columns: [
        { field: 'folio', label: 'Folio', sortable: true },
        { field: 'title', label: 'Titulo', sortable: true, link: true },
        { field: 'vehicle_plate', label: 'Vehiculo' },
        { field: 'repair_priority', label: 'Prioridad' },
        { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
        { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
        { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
      ],
      rowActions: [
        { label: 'Ver detalle', permission: 'fleet.reports.read' },
        { label: 'Editar', permission: 'fleet.reports.update' },
        { label: 'Desactivar', permission: 'fleet.reports.delete' },
      ],
    },
  },
  other: {
    key: 'fleet.reports.other.table',
    kind: 'TABLE',
    schema: {
      entity: 'report',
      component: 'AtlasTable',
      apiPath: '/fleet/reports/other',
      primaryField: 'title',
      searchable: true,
      searchPlaceholder: 'Buscar reportes de otro tipo...',
      columns: [
        { field: 'folio', label: 'Folio', sortable: true },
        { field: 'title', label: 'Titulo', sortable: true, link: true },
        { field: 'other_category_label', label: 'Categoria' },
        { field: 'vehicle_plate', label: 'Vehiculo' },
        { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
        { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
        { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
      ],
      rowActions: [
        { label: 'Ver detalle', permission: 'fleet.reports.read' },
        { label: 'Editar', permission: 'fleet.reports.update' },
        { label: 'Desactivar', permission: 'fleet.reports.delete' },
      ],
    },
  },
}

const CREATE_LABELS = {
  maintenance: 'Nuevo reporte de mantenimiento',
  service: 'Nuevo reporte de servicio',
  repair: 'Nuevo reporte de reparacion',
  other: 'Nuevo reporte',
}

export default function ReportsScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const reportType = useMemo(() => {
    const segs = String(wildcard ?? '').replace(/^\/+/, '').split('/')
    const found = segs.find((s) => REPORT_TABS.some((t) => t.key === s))
    return found ?? 'maintenance'
  }, [wildcard])

  const currentBlueprint = REPORT_TABLES[reportType]

  const handleTabChange = useCallback((tab) => {
    navigate(`/app/m/atlas.fleet/reports/${tab}`, { replace: true })
  }, [navigate])

  const handleRowClick = useCallback((row) => {
    navigate(`/app/m/atlas.fleet/reports/${row.id}`)
  }, [navigate])

  const handleCreate = useCallback(() => {
    navigate(`/app/m/atlas.fleet/reports/${reportType}/new`)
  }, [navigate, reportType])

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title="Reportes de Flota" />
      <div className="flex gap-2 border-b border-[hsl(var(--border))] pb-0">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              reportType === tab.key
                ? 'border-[var(--module-accent,hsl(var(--primary)))] text-[hsl(var(--foreground))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {CREATE_LABELS[reportType]}
        </Button>
      </div>
      <AtlasTable
        blueprint={currentBlueprint}
        token={token}
        apiBaseUrl={API_BASE}
        componentRegistry={componentRegistry}
        onRowClick={handleRowClick}
        suppressCreate
      />
    </div>
  )
}
