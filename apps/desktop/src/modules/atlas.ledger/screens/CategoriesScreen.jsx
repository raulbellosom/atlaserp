import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

const API_BASE = getApiUrl()
const BASE_PATH = '/app/m/atlas.ledger/categories'

const CATEGORIES_TABLE = {
  key: 'ledger.categories.table',
  kind: 'TABLE',
  schema: {
    entity: 'category',
    component: 'AtlasTable',
    apiPath: '/ledger/categories',
    description: 'Agrupa movimientos por naturaleza: ingresos, egresos o ambos. Usadas para clasificar transacciones y analizarlas en el resumen de cuenta.',
    primaryField: 'name',
    searchable: false,
    columns: [
      { field: 'color', label: 'Color',  sortable: false, type: 'color' },
      { field: 'name',  label: 'Nombre', sortable: true,  link: true },
      {
        field: 'kind', label: 'Tipo', sortable: true, type: 'select',
        options: [
          { value: 'income',  label: 'Ingreso' },
          { value: 'expense', label: 'Egreso'  },
          { value: 'both',    label: 'Ambos'   },
        ],
      },
    ],
    actions: [{ label: 'Nueva categoria', permission: 'ledger.categories.manage', variant: 'primary' }],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.categories.manage' },
      { label: 'Desactivar', permission: 'ledger.categories.manage' },
    ],
    emptyState: { message: 'No hay categorias registradas.' },
  },
}

const CATEGORIES_FORM = {
  key: 'ledger.categories.form',
  kind: 'FORM',
  schema: {
    entity: 'category',
    component: 'AtlasForm',
    apiPath: '/ledger/categories',
    sections: [{
      fields: [
        { name: 'name',  label: 'Nombre', type: 'text',   required: true },
        { name: 'color', label: 'Color',  type: 'color' },
        {
          name: 'kind', label: 'Tipo', type: 'select', required: true,
          options: [
            { value: 'income',  label: 'Ingreso' },
            { value: 'expense', label: 'Egreso'  },
            { value: 'both',    label: 'Ambos'   },
          ],
        },
      ],
    }],
  },
}

const CATEGORIES_DETAIL = {
  key: 'ledger.categories.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'category',
    apiPath: '/ledger/categories',
    sections: [{
      title: 'Informacion',
      fields: [
        { name: 'name',  label: 'Nombre', type: 'text' },
        { name: 'kind',  label: 'Tipo',   type: 'text' },
        { name: 'color', label: 'Color',  type: 'color' },
      ],
    }],
  },
}

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^categories\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function CategoriesScreen() {
  const { '*': wildcard } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token ?? null

  const { initialMode, recordId } = useMemo(() => parseModeAndId(wildcard), [wildcard])

  const handleNavigate = useCallback(({ mode, recordId }) => {
    const path =
      mode === 'create' ? `${BASE_PATH}/new` :
      mode === 'detail' && recordId ? `${BASE_PATH}/${recordId}` :
      mode === 'edit' && recordId ? `${BASE_PATH}/${recordId}/edit` :
      BASE_PATH
    navigate(path, { replace: true })
  }, [navigate])

  return (
    <div className="p-4 md:p-6 min-h-dvh">
      <AtlasCrudView
        tableBlueprint={CATEGORIES_TABLE}
        formBlueprint={CATEGORIES_FORM}
        detailBlueprint={CATEGORIES_DETAIL}
        token={token}
        apiBaseUrl={API_BASE}
        initialMode={initialMode}
        recordId={recordId}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
