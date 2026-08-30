// apps/desktop/src/modules/atlas.ledger/screens/SpreadsheetRegister.jsx
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOfflineStatus } from '@atlas/offline'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Button, ConfirmDialog,
  Sheet, SheetContent, SheetHeader, SheetTitle,
  TextField, NumberField, SelectField, DatePickerField,
} from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { useAccountTransactions } from '../hooks/use-ledger-queries.js'

const API_BASE = getApiUrl()

const EDITABLE_COLS = ['fecha', 'tipo_id', 'numero', 'nombre', 'referencia', 'concepto', 'deposito', 'retiro', 'category_id']
const PAGE_STEP = 200

function fmtDecimal(value) {
  if (value == null || value === '') return ''
  const amount = Number(value)
  return Number.isFinite(amount)
    ? amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
}

function toDateValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function emptyRow(accountId) {
  return {
    _isNew: true,
    _dirty: false,
    id: null,
    account_id: accountId,
    fecha: new Date().toISOString().slice(0, 10),
    tipo_id: null,
    numero: '',
    nombre: '',
    referencia: '',
    concepto: '',
    deposito: '',
    retiro: '',
    category_id: null,
  }
}

function CategoryOptions({ categories }) {
  const system = categories.filter((c) => c.is_system)
  const personal = categories.filter((c) => !c.is_system && c.is_system !== undefined)
  const flat = categories.every((c) => c.is_system === undefined)
  return (
    <>
      <option value="">Sin categoria</option>
      {system.length > 0 && (
        <optgroup label="Sistema">
          {system.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      )}
      {personal.length > 0 && (
        <optgroup label="Mis categorias">
          {personal.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      )}
      {flat && categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </>
  )
}

export default function SpreadsheetRegister({ accountId, dateFrom, dateTo, types = [], categories = [], canWrite = true }) {
  const { session } = useAuth()
  const { isOnline } = useOfflineStatus()
  const token = session?.access_token ?? null
  const queryClient = useQueryClient()
  const [editingRows, setEditingRows] = useState({})
  const [newRow, setNewRow] = useState(null)
  const [limit, setLimit] = useState(PAGE_STEP)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [mobileSheet, setMobileSheet] = useState(null) // { mode: 'new' | 'edit', draft }
  const tableRef = useRef(null)
  const canEdit = isOnline && !!token && canWrite

  const queryKey = ['ledger-transactions', accountId, dateFrom ?? null, dateTo ?? null, limit, 'remote']
  const { data, isLoading, isError } = useAccountTransactions(accountId, { dateFrom, dateTo, limit })

  const rows = data?.data ?? []
  const total = data?.pagination?.total ?? rows.length
  const hasMore = total > rows.length

  const saveMutation = useMutation({
    mutationFn: async ({ isNew, id, payload }) => {
      const url = isNew
        ? `${API_BASE}/ledger/accounts/${accountId}/transactions`
        : `${API_BASE}/ledger/accounts/${accountId}/transactions/${id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error al guardar.')
      }
      return res.json()
    },
    onMutate: async ({ isNew, id, payload }) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old) => {
        if (!old?.data) return old
        if (isNew) {
          const tempRow = {
            ...payload,
            id: `__temp_${Date.now()}`,
            account_id: accountId,
            _pending: true,
            consecutive: '?',
            saldo_actual: null,
          }
          return { ...old, data: [...old.data, tempRow] }
        }
        return {
          ...old,
          data: old.data.map((row) => (
            row.id === id ? { ...row, ...payload, _pending: true } : row
          )),
        }
      })
      return { previousData }
    },
    onError: (error, _vars, context) => {
      if (context?.previousData) queryClient.setQueryData(queryKey, context.previousData)
      toast.error(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-transactions', accountId] })
      queryClient.invalidateQueries({ queryKey: ['ledger-account', accountId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (txId) => {
      const res = await fetch(
        `${API_BASE}/ledger/accounts/${accountId}/transactions/${txId}/enabled`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enabled: false }),
        },
      )
      if (!res.ok) throw new Error('No se pudo eliminar el movimiento.')
    },
    onSuccess: () => {
      toast.success('Movimiento eliminado.')
      queryClient.invalidateQueries({ queryKey: ['ledger-transactions', accountId] })
      queryClient.invalidateQueries({ queryKey: ['ledger-account', accountId] })
    },
    onError: (error) => { toast.error(error.message) },
  })

  function getDraft(row, rowIdx) {
    const key = row.id ?? `new-${rowIdx}`
    return editingRows[key] ?? row
  }

  function setDraft(row, rowIdx, field, value) {
    if (!canEdit) return
    const key = row.id ?? `new-${rowIdx}`
    setEditingRows((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? row), [field]: value, _dirty: true },
    }))
  }

  function clearDraft(row, rowIdx) {
    const key = row.id ?? `new-${rowIdx}`
    setEditingRows((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function buildPayload(draft) {
    const deposito = draft.deposito !== '' && draft.deposito != null ? Number(draft.deposito) : null
    const retiro = draft.retiro !== '' && draft.retiro != null ? Number(draft.retiro) : null
    if (!draft.nombre?.trim()) {
      toast.error('El campo Nombre es obligatorio.')
      return null
    }
    if (!deposito && !retiro) {
      toast.error('Se requiere deposito o retiro mayor a cero.')
      return null
    }
    return {
      fecha: toDateValue(draft.fecha),
      tipo_id: draft.tipo_id || null,
      numero: draft.numero || null,
      nombre: draft.nombre.trim(),
      referencia: draft.referencia || null,
      concepto: draft.concepto || null,
      deposito,
      retiro,
      category_id: draft.category_id || null,
    }
  }

  function saveRow(row, rowIdx) {
    if (!canEdit) return
    const draft = getDraft(row, rowIdx)
    if (!draft._dirty && !draft._isNew) return
    const payload = buildPayload(draft)
    if (!payload) return
    saveMutation.mutate({ isNew: !!draft._isNew, id: row.id, payload })
    clearDraft(row, rowIdx)
    if (draft._isNew) setNewRow(null)
  }

  function handleKeyDown(event, row, rowIdx, colName) {
    if (event.key === 'Escape') {
      event.preventDefault()
      clearDraft(row, rowIdx)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.ctrlKey) { saveRow(row, rowIdx); return }
      const colIdx = EDITABLE_COLS.indexOf(colName)
      if (colIdx < EDITABLE_COLS.length - 1) {
        focusCell(`[data-row="${rowIdx}"][data-col="${EDITABLE_COLS[colIdx + 1]}"]`)
      } else {
        saveRow(row, rowIdx)
      }
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? -1 : 1
      const nextIdx = rowIdx + direction
      if (nextIdx < 0 || nextIdx >= rows.length) return
      const colIdx = EDITABLE_COLS.indexOf(colName)
      focusCell(`[data-row="${nextIdx}"][data-col="${EDITABLE_COLS[colIdx]}"]`)
    }
  }

  function focusCell(selector) {
    const el = tableRef.current?.querySelector(selector)
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    el.focus()
  }

  function handleRowBlur(event, row, rowIdx) {
    const nextFocused = event.relatedTarget
    const rowEl = event.currentTarget
    if (rowEl.contains(nextFocused)) return
    saveRow(row, rowIdx)
  }

  // ── Mobile sheet handlers ──────────────────────────────────────────────────
  function openMobileNew() {
    setMobileSheet({ mode: 'new', draft: { ...emptyRow(accountId), numero: String(total + 1) } })
  }
  function openMobileEdit(row) {
    setMobileSheet({ mode: 'edit', draft: { ...row } })
  }
  function setSheetField(field, value) {
    setMobileSheet((s) => (s ? { ...s, draft: { ...s.draft, [field]: value } } : s))
  }
  function submitMobileSheet(e) {
    e?.preventDefault?.()
    if (!mobileSheet) return
    const payload = buildPayload(mobileSheet.draft)
    if (!payload) return
    saveMutation.mutate({ isNew: mobileSheet.mode === 'new', id: mobileSheet.draft.id, payload })
    setMobileSheet(null)
  }

  const colClass = 'px-2 py-0 h-8 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] rounded w-full'
  const thClass = 'px-2 py-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))] text-left whitespace-nowrap border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] select-none last:border-r-0'
  const tdClass = 'border-b border-r border-[hsl(var(--border)/0.5)] p-0 align-middle last:border-r-0'

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
          <div className="h-3.5 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
          <div className="h-7 w-20 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
        </div>
        <div className="flex-1 overflow-hidden p-3 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-[hsl(var(--muted)/0.4)] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return <div className="p-4 text-sm text-red-500">No se pudieron cargar los movimientos.</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {rows.length === total
            ? `${total} movimiento${total !== 1 ? 's' : ''}`
            : `${rows.length} de ${total}`}
        </span>
        <>
          {/* Desktop: inline new row. Mobile: sheet form. */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setNewRow({ ...emptyRow(accountId), numero: String(total + 1) })}
            disabled={!!newRow || !canEdit}
          >
            <Plus size={13} className="mr-1" />
            Agregar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden"
            onClick={openMobileNew}
            disabled={!canEdit}
          >
            <Plus size={13} className="mr-1" />
            Agregar
          </Button>
        </>
      </div>

      {!canEdit && (
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          {!isOnline
            ? 'Viendo movimientos en modo solo lectura offline. Para agregar, editar o eliminar reconecta la app.'
            : 'Tienes acceso de solo lectura a esta cuenta. Pide al propietario permisos de edicion para registrar movimientos.'}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {hasMore && (
          <div className="flex justify-center py-2 border-b border-[hsl(var(--border)/0.6)]">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE_STEP)}>
              Cargar movimientos anteriores
            </Button>
          </div>
        )}

        {/* ── Mobile card list ──────────────────────────────────────────── */}
        <div className="sm:hidden divide-y divide-[hsl(var(--border)/0.5)]">
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Sin movimientos.
            </div>
          )}
          {rows.map((row) => (
            <div key={row.id} className="px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{row.nombre}</span>
                  <span className={`text-sm font-mono font-semibold shrink-0 ${Number(row.deposito) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {Number(row.deposito) > 0 ? '+' : '-'}{fmtDecimal(row.deposito || row.retiro)}
                  </span>
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 flex flex-wrap gap-x-2">
                  <span>{toDateValue(row.fecha)}</span>
                  {row.tipo_code && <span>· {row.tipo_code}</span>}
                  {row.category_name && <span>· {row.category_name}</span>}
                </div>
                {(row.concepto || row.referencia) && (
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                    {row.concepto || row.referencia}
                  </div>
                )}
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 font-mono">
                  Saldo: {fmtDecimal(row.saldo_actual)}
                </div>
              </div>
              {canEdit && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Editar movimiento ${row.consecutive ?? ''}`}
                    className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                    onClick={() => openMobileEdit(row)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar movimiento ${row.consecutive ?? ''}`}
                    className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-red-500"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Desktop spreadsheet ───────────────────────────────────────── */}
        <table
          ref={tableRef}
          className="hidden sm:table w-full min-w-262.5 border-collapse text-sm"
          onFocus={(e) => {
            const el = e.target
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
              el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            }
          }}
        >
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${thClass} w-10 text-center`}>#</th>
              <th className={`${thClass} w-28`}>Fecha</th>
              <th className={`${thClass} w-32`}>Tipo</th>
              <th className={`${thClass} w-24`}>Numero</th>
              <th className={`${thClass} min-w-40`}>Nombre</th>
              <th className={`${thClass} w-28`}>Referencia</th>
              <th className={`${thClass} min-w-32`}>Concepto</th>
              <th className={`${thClass} w-28 text-right`}>Ingreso</th>
              <th className={`${thClass} w-28 text-right`}>Egreso</th>
              <th className={`${thClass} w-36`}>Categoria</th>
              <th className={`${thClass} w-28 text-right`}>Saldo</th>
              <th className={`${thClass} w-8`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const draft = getDraft(row, rowIdx)
              return (
                <tr
                  key={row.id}
                  onBlur={(event) => handleRowBlur(event, row, rowIdx)}
                  className="hover:bg-[hsl(var(--muted)/0.2)]"
                >
                  <td className={`${tdClass} text-center text-xs text-[hsl(var(--muted-foreground))]`}>
                    {row.consecutive}
                  </td>
                  <td className={tdClass}>
                    <input
                      type="date"
                      aria-label={`Fecha movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="fecha"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={toDateValue(draft.fecha)}
                      onChange={(event) => setDraft(row, rowIdx, 'fecha', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'fecha')}
                    />
                  </td>
                  <td className={tdClass}>
                    <select
                      aria-label={`Tipo movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="tipo_id"
                      disabled={!canEdit}
                      value={draft.tipo_id ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'tipo_id', event.target.value || null)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'tipo_id')}
                    >
                      <option value="">—</option>
                      {types.map((type) => <option key={type.id} value={type.id}>{type.code}</option>)}
                    </select>
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Numero movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="numero"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.numero ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'numero', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'numero')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Nombre movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="nombre"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.nombre ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'nombre', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'nombre')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Referencia movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="referencia"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.referencia ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'referencia', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'referencia')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      aria-label={`Concepto movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="concepto"
                      disabled={!canEdit}
                      enterKeyHint="next"
                      value={draft.concepto ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'concepto', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'concepto')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      aria-label={`Ingreso movimiento ${row.consecutive ?? rowIdx + 1}`}
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      enterKeyHint="next"
                      className={`${colClass} text-right`}
                      data-row={rowIdx}
                      data-col="deposito"
                      disabled={!canEdit}
                      value={draft.deposito ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'deposito', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'deposito')}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      aria-label={`Egreso movimiento ${row.consecutive ?? rowIdx + 1}`}
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      enterKeyHint="next"
                      className={`${colClass} text-right`}
                      data-row={rowIdx}
                      data-col="retiro"
                      disabled={!canEdit}
                      value={draft.retiro ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'retiro', event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'retiro')}
                    />
                  </td>
                  <td className={tdClass}>
                    <select
                      aria-label={`Categoria movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className={colClass}
                      data-row={rowIdx}
                      data-col="category_id"
                      disabled={!canEdit}
                      value={draft.category_id ?? ''}
                      onChange={(event) => setDraft(row, rowIdx, 'category_id', event.target.value || null)}
                      onKeyDown={(event) => handleKeyDown(event, row, rowIdx, 'category_id')}
                    >
                      <CategoryOptions categories={categories} />
                    </select>
                  </td>
                  <td className={`${tdClass} text-right pr-3 text-xs font-mono font-semibold`}>
                    {fmtDecimal(row.saldo_actual)}
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <button
                      type="button"
                      aria-label={`Eliminar movimiento ${row.consecutive ?? rowIdx + 1}`}
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-500 text-xs px-1 disabled:opacity-40"
                      disabled={!canEdit}
                      onClick={() => setDeleteTarget(row)}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}

            {newRow && (
              <tr
                onBlur={(event) => {
                  const nextFocused = event.relatedTarget
                  if (event.currentTarget.contains(nextFocused)) return
                  saveRow(newRow, rows.length)
                }}
                className="bg-[hsl(var(--muted)/0.3)]"
              >
                <td className={`${tdClass} text-center text-xs text-[hsl(var(--muted-foreground))]`}>*</td>
                <td className={tdClass}>
                  <input
                    type="date"
                    aria-label="Fecha nuevo movimiento"
                    className={colClass}
                    autoFocus
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.fecha}
                    onChange={(event) => setNewRow((row) => ({ ...row, fecha: event.target.value, _dirty: true }))}
                    onKeyDown={(event) => { if (event.key === 'Escape') setNewRow(null) }}
                  />
                </td>
                <td className={tdClass}>
                  <select
                    aria-label="Tipo nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    value={newRow.tipo_id ?? ''}
                    onChange={(event) => setNewRow((row) => ({ ...row, tipo_id: event.target.value || null, _dirty: true }))}
                  >
                    <option value="">—</option>
                    {types.map((type) => <option key={type.id} value={type.id}>{type.code}</option>)}
                  </select>
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Numero nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.numero}
                    onChange={(event) => setNewRow((row) => ({ ...row, numero: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Nombre nuevo movimiento"
                    className={colClass}
                    placeholder="Nombre *"
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.nombre}
                    onChange={(event) => setNewRow((row) => ({ ...row, nombre: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Referencia nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.referencia}
                    onChange={(event) => setNewRow((row) => ({ ...row, referencia: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="text"
                    aria-label="Concepto nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    enterKeyHint="next"
                    value={newRow.concepto}
                    onChange={(event) => setNewRow((row) => ({ ...row, concepto: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    aria-label="Ingreso nuevo movimiento"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className={`${colClass} text-right`}
                    disabled={!canEdit}
                    value={newRow.deposito}
                    onChange={(event) => setNewRow((row) => ({ ...row, deposito: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    aria-label="Egreso nuevo movimiento"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className={`${colClass} text-right`}
                    disabled={!canEdit}
                    value={newRow.retiro}
                    onChange={(event) => setNewRow((row) => ({ ...row, retiro: event.target.value, _dirty: true }))}
                  />
                </td>
                <td className={tdClass}>
                  <select
                    aria-label="Categoria nuevo movimiento"
                    className={colClass}
                    disabled={!canEdit}
                    value={newRow.category_id ?? ''}
                    onChange={(event) => setNewRow((row) => ({ ...row, category_id: event.target.value || null, _dirty: true }))}
                  >
                    <CategoryOptions categories={categories} />
                  </select>
                </td>
                <td className={`${tdClass} text-right pr-3 text-xs`}>—</td>
                <td className={`${tdClass} text-center`}>
                  <button type="button" aria-label="Cancelar nuevo movimiento" className="text-xs px-1 hover:text-red-500 disabled:opacity-40" disabled={!canEdit} onClick={() => setNewRow(null)}>
                    ×
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile add / edit sheet ───────────────────────────────────────── */}
      <Sheet open={!!mobileSheet} onOpenChange={(open) => { if (!open) setMobileSheet(null) }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{mobileSheet?.mode === 'new' ? 'Nuevo movimiento' : 'Editar movimiento'}</SheetTitle>
          </SheetHeader>
          {mobileSheet && (
            <form onSubmit={submitMobileSheet} className="space-y-3 pt-4 pb-2">
              <DatePickerField
                label="Fecha"
                value={toDateValue(mobileSheet.draft.fecha) || undefined}
                onChange={(val) => setSheetField('fecha', val ?? '')}
              />
              <TextField
                label="Nombre"
                required
                value={mobileSheet.draft.nombre ?? ''}
                onChange={(e) => setSheetField('nombre', e.target.value)}
                maxLength={255}
              />
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Ingreso"
                  value={mobileSheet.draft.deposito ?? ''}
                  onChange={(e) => setSheetField('deposito', e.target.value)}
                  min={0}
                  step="0.01"
                />
                <NumberField
                  label="Egreso"
                  value={mobileSheet.draft.retiro ?? ''}
                  onChange={(e) => setSheetField('retiro', e.target.value)}
                  min={0}
                  step="0.01"
                />
              </div>
              <SelectField
                label="Tipo"
                value={mobileSheet.draft.tipo_id ?? '__none__'}
                onValueChange={(val) => setSheetField('tipo_id', val === '__none__' ? null : val)}
                options={[{ value: '__none__', label: 'Sin tipo' }, ...types.map((t) => ({ value: t.id, label: t.code }))]}
              />
              <SelectField
                label="Categoria"
                value={mobileSheet.draft.category_id ?? '__none__'}
                onValueChange={(val) => setSheetField('category_id', val === '__none__' ? null : val)}
                options={[
                  { value: '__none__', label: 'Sin categoria' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <TextField
                label="Numero"
                value={mobileSheet.draft.numero ?? ''}
                onChange={(e) => setSheetField('numero', e.target.value)}
                maxLength={64}
              />
              <TextField
                label="Referencia"
                value={mobileSheet.draft.referencia ?? ''}
                onChange={(e) => setSheetField('referencia', e.target.value)}
                maxLength={255}
              />
              <TextField
                label="Concepto"
                value={mobileSheet.draft.concepto ?? ''}
                onChange={(e) => setSheetField('concepto', e.target.value)}
                maxLength={512}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setMobileSheet(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Eliminar movimiento"
        description={
          deleteTarget
            ? `¿Eliminar el movimiento "${deleteTarget.nombre ?? ''}" del ${toDateValue(deleteTarget.fecha)}? El saldo se recalculara.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
