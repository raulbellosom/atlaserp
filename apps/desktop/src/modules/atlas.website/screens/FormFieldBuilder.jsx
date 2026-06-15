import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, verticalListSortingStrategy,
  useSortable, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Type, Mail, Phone, AlignLeft, List, CheckSquare, Hash, Calendar } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Button, CheckboxField, ConfirmDialog, SelectField, TextField,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { toast } from 'sonner'

const FIELD_TYPES = [
  { value: 'text',     label: 'Texto corto',      Icon: Type },
  { value: 'email',    label: 'Email',             Icon: Mail },
  { value: 'phone',    label: 'Telefono',          Icon: Phone },
  { value: 'textarea', label: 'Texto largo',       Icon: AlignLeft },
  { value: 'select',   label: 'Lista desplegable', Icon: List },
  { value: 'checkbox', label: 'Casilla',           Icon: CheckSquare },
  { value: 'number',   label: 'Numero',            Icon: Hash },
  { value: 'date',     label: 'Fecha',             Icon: Calendar },
]

const FIELD_TYPE_OPTIONS = FIELD_TYPES.map(({ value, label }) => ({ value, label }))
const SEMANTIC_OPTIONS = [
  { value: 'custom', label: 'Campo personalizado' },
  { value: 'name', label: 'Nombre del lead' },
  { value: 'email', label: 'Correo del lead' },
  { value: 'phone', label: 'Telefono del lead' },
  { value: 'company', label: 'Empresa del lead' },
  { value: 'message', label: 'Mensaje del lead' },
]

function toFieldName(label) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// Form content is a separate component so its setState calls don't re-render
// the Dialog shell (DialogOverlay / Presence). Re-rendering Dialog triggers a
// Radix composeRefs instability loop when Presence is in the tree.
function FieldForm({ formId, field, isEdit, onOpenChange, onSaved }) {
  const { session } = useAuth()
  const token = session?.access_token

  const [form, setForm] = useState({
    label:       field?.label       ?? '',
    name:        field?.name        ?? '',
    fieldType:   field?.fieldType   ?? 'text',
    semanticKey: field?.semanticKey ?? 'custom',
    placeholder: field?.placeholder ?? '',
    required:    field?.required    ?? false,
    options:     Array.isArray(field?.options) ? field.options.join(', ') : '',
  })
  const [nameTouched, setNameTouched] = useState(isEdit)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = isEdit
        ? `${getApiUrl()}/website/form-fields/${field.id}`
        : `${getApiUrl()}/website/forms/${formId}/fields`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Campo actualizado' : 'Campo agregado')
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message || 'Error al guardar campo'),
  })

  function handleLabelChange(e) {
    const label = e.target.value
    setForm((f) => ({
      ...f, label,
      ...(!nameTouched && { name: toFieldName(label) }),
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      label:       form.label.trim(),
      name:        form.name.trim(),
      fieldType:   form.fieldType,
      semanticKey: form.semanticKey,
      placeholder: form.placeholder.trim() || undefined,
      required:    form.required,
      options:     form.fieldType === 'select' && form.options.trim()
        ? form.options.split(',').map((s) => s.trim()).filter(Boolean)
        : null,
    }
    mutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <TextField
        label="Etiqueta"
        value={form.label}
        onChange={handleLabelChange}
        required
        autoFocus
      />
      <TextField
        label="Nombre del campo (clave)"
        value={form.name}
        onChange={(e) => { setNameTouched(true); setForm((f) => ({ ...f, name: e.target.value })) }}
        placeholder="nombre_campo"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Tipo"
          value={form.fieldType}
          onChange={(v) => setForm((f) => ({ ...f, fieldType: v }))}
          options={FIELD_TYPE_OPTIONS}
        />
        <TextField
          label="Placeholder"
          value={form.placeholder}
          onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))}
        />
      </div>
      <SelectField
        label="Uso para el lead"
        value={form.semanticKey}
        onChange={(value) =>
          setForm((current) => ({
            ...current,
            semanticKey: value,
          }))
        }
        options={SEMANTIC_OPTIONS}
      />
      {form.fieldType === 'select' && (
        <TextField
          label="Opciones (separadas por coma)"
          value={form.options}
          onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
          placeholder="Opcion 1, Opcion 2"
        />
      )}
      <CheckboxField
        label="Campo obligatorio"
        checked={form.required}
        onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button type="submit" disabled={mutation.isPending || !form.label.trim() || !form.name.trim()}>
          {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar' : 'Agregar'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function FieldDialog({ formId, field, open, onOpenChange, onSaved }) {
  const isEdit = Boolean(field)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar campo' : 'Agregar campo'}</DialogTitle>
        </DialogHeader>
        <FieldForm
          formId={formId}
          field={field}
          isEdit={isEdit}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function SortableField({ field, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const TypeIcon = FIELD_TYPES.find((t) => t.value === field.fieldType)?.Icon ?? Type

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2.5 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg group"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-[hsl(var(--muted-foreground))] touch-none">
        <GripVertical size={14} />
      </button>
      <TypeIcon size={14} className="text-[hsl(var(--muted-foreground))] shrink-0" />
      <span className="flex-1 text-sm font-medium">{field.label}</span>
      {field.required && <span className="text-[10px] text-red-500 font-mono">*</span>}
      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{field.fieldType}</span>
      {field.semanticKey && field.semanticKey !== 'custom' && (
        <span className="text-[10px] rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[hsl(var(--muted-foreground))]">
          {SEMANTIC_OPTIONS.find((option) => option.value === field.semanticKey)?.label}
        </span>
      )}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(field)} className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Pencil size={12} /></button>
        <button onClick={() => onDelete(field)} className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--destructive))]"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

export default function FormFieldBuilder({ formId, fields = [], onRefresh }) {
  const { session } = useAuth()
  const token = session?.access_token

  const [addOpen, setAddOpen] = useState(false)
  const [editField, setEditField] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [localFields, setLocalFields] = useState(fields)
  const [confirmField, setConfirmField] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reorderMutation = useMutation({
    mutationFn: async (reordered) => {
      const res = await fetch(`${getApiUrl()}/website/forms/${formId}/fields/reorder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reordered.map((f, i) => ({ id: f.id, sortOrder: i * 10 })) }),
      })
      if (!res.ok) throw new Error('Error al reordenar')
    },
    onError: () => toast.error('Error al guardar el orden'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (fieldId) => {
      const res = await fetch(`${getApiUrl()}/website/form-fields/${fieldId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al eliminar')
    },
    onSuccess: () => { toast.success('Campo eliminado'); setConfirmField(null); onRefresh() },
    onError: () => { toast.error('Error al eliminar campo'); setConfirmField(null) },
  })

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = localFields.findIndex((f) => f.id === active.id)
    const newIndex  = localFields.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(localFields, oldIndex, newIndex)
    setLocalFields(reordered)
    reorderMutation.mutate(reordered)
  }

  const displayFields = localFields.length > 0 ? localFields : fields

  return (
    <div className="space-y-3">
      {displayFields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay campos. Agrega el primer campo.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {displayFields.map((field) => (
                <SortableField
                  key={field.id}
                  field={field}
                  onEdit={(f) => { setEditField(f); setEditOpen(true) }}
                  onDelete={setConfirmField}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={() => setAddOpen(true)}
        className="w-full rounded-lg border border-dashed border-[hsl(var(--border))] py-2 text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors"
      >
        + Agregar campo
      </button>

      <FieldDialog formId={formId} field={null} open={addOpen} onOpenChange={setAddOpen} onSaved={() => { setLocalFields([]); onRefresh() }} />
      <FieldDialog formId={formId} field={editField} open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditField(null) }} onSaved={() => { setLocalFields([]); onRefresh() }} />

      <ConfirmDialog
        open={Boolean(confirmField)}
        onOpenChange={(open) => { if (!open) setConfirmField(null) }}
        title="Eliminar campo"
        description={`Se eliminara permanentemente el campo "${confirmField?.label}". Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(confirmField?.id)}
      />
    </div>
  )
}
