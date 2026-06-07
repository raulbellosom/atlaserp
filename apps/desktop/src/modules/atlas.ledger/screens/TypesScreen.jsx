import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtlasCrudView } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

const API_BASE = getApiUrl()
const BASE_PATH = '/app/m/atlas.ledger/types'

const TYPES_TABLE = {
  key: 'ledger.types.table',
  kind: 'TABLE',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasTable',
    apiPath: '/ledger/types',
    description: 'Codigos de operacion bancaria (DEP, CHQ, TRANSF, etc.). Identifican el instrumento de cada movimiento y permiten filtrar el registro por tipo.',
    primaryField: 'code',
    searchable: false,
    columns: [
      { field: 'code', label: 'Codigo', sortable: true, link: true },
      { field: 'name', label: 'Nombre', sortable: true },
    ],
    actions: [{ label: 'Nuevo tipo', permission: 'ledger.types.manage', variant: 'primary' }],
    rowActions: [
      { label: 'Editar',     permission: 'ledger.types.manage' },
      { label: 'Desactivar', permission: 'ledger.types.manage' },
    ],
    emptyState: { message: 'No hay tipos de movimiento registrados.' },
  },
}

const TYPES_FORM = {
  key: 'ledger.types.form',
  kind: 'FORM',
  schema: {
    entity: 'transaction_type',
    component: 'AtlasForm',
    apiPath: '/ledger/types',
    sections: [{
      fields: [
        { name: 'code', label: 'Codigo', type: 'text', required: true },
        { name: 'name', label: 'Nombre', type: 'text', required: true },
      ],
    }],
  },
}

const TYPES_DETAIL = {
  key: 'ledger.types.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'transaction_type',
    apiPath: '/ledger/types',
    sections: [{
      title: 'Informacion',
      fields: [
        { name: 'code', label: 'Codigo', type: 'text' },
        { name: 'name', label: 'Nombre', type: 'text' },
      ],
    }],
  },
}

function parseModeAndId(wildcard) {
  const segs = String(wildcard ?? '').replace(/^\/+/, '').replace(/^types\/?/, '').split('/').filter(Boolean)
  if (segs[0] === 'new') return { initialMode: 'create', recordId: null }
  if (segs[1] === 'edit') return { initialMode: 'edit', recordId: segs[0] }
  if (segs[0]) return { initialMode: 'detail', recordId: segs[0] }
  return { initialMode: 'list', recordId: null }
}

export default function TypesScreen() {
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
        tableBlueprint={TYPES_TABLE}
        formBlueprint={TYPES_FORM}
        detailBlueprint={TYPES_DETAIL}
        token={token}
        apiBaseUrl={API_BASE}
        initialMode={initialMode}
        recordId={recordId}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
