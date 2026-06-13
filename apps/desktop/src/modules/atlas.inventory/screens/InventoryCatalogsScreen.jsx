import { useState } from 'react'
import {
  PageHeader,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  TextField,
  TextareaField,
  SelectField,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  Card,
} from '@atlas/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useInventoryCategories,
  useCreateInventoryCategory,
  useUpdateInventoryCategory,
  useDeleteInventoryCategory,
  useInventoryBrands,
  useCreateInventoryBrand,
  useUpdateInventoryBrand,
  useDeleteInventoryBrand,
  useInventoryLocations,
  useCreateInventoryLocation,
  useUpdateInventoryLocation,
  useDeleteInventoryLocation,
  useInventoryCustomFields,
  useCreateInventoryCustomField,
  useUpdateInventoryCustomField,
  useDeleteInventoryCustomField,
} from '../hooks/useInventoryCatalogs.js'

// ── Generic CRUD table ────────────────────────────────────────────────────────

function CatalogRow({ item, onEdit, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const handleDelete = async () => { await onDelete(item.id) }
  return (
    <>
      <tr className="border-b border-[hsl(var(--border)/0.5)] last:border-0 hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
        <td className="px-4 py-2.5 font-medium">{item.name}</td>
        <td className="px-4 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hidden sm:table-cell">
          {item.description ?? '—'}
        </td>
        <td className="px-4 py-2.5 w-20">
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="flex h-7 w-7 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-rose-500/10 hover:text-rose-500 active:bg-rose-500/10 active:text-rose-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Eliminar "${item.name}"`}
        description="Esta accion deshabilitara el registro. Los items asociados no se veran afectados."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </>
  )
}

function CatalogTable({ rows, onEdit, onDelete, isLoading, emptyMsg, onCreate }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin registros" description={emptyMsg} action={{ label: 'Agregar', onClick: onCreate }} />
      ) : (
        <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-2.5 text-left font-medium">Nombre</th>
                <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Descripcion</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <CatalogRow key={r.id} item={r} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Simple edit sheet ─────────────────────────────────────────────────────────

function SimpleSheet({ open, onOpenChange, title, fields, values, onChange, onSave, busy }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="py-6 space-y-4">
          {fields.map(f => f.type === 'textarea' ? (
            <TextareaField
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={3}
            />
          ) : (
            <TextField
              key={f.key}
              label={f.label}
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              required={f.required}
            />
          ))}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy || !values.name?.trim()}>
            {busy ? 'Guardando...' : 'Guardar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Category tab ──────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', color: '#7c3aed' })

  const { data, isLoading } = useInventoryCategories()
  const rows = (data?.data ?? data ?? []).filter(c => c.enabled !== false)
  const createMutation = useCreateInventoryCategory()
  const updateMutation = useUpdateInventoryCategory()
  const deleteMutation = useDeleteInventoryCategory()

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', color: '#7c3aed' })
    setSheetOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({ name: item.name, description: item.description ?? '', color: item.color ?? '#7c3aed' })
    setSheetOpen(true)
  }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Categoria actualizada')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Categoria creada')
      }
      setSheetOpen(false)
    } catch (err) {
      toast.error(err?.message ?? 'Error al guardar')
    }
  }

  const busy = createMutation.isPending || updateMutation.isPending

  return (
    <>
      <CatalogTable
        rows={rows}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
        isLoading={isLoading}
        emptyMsg="Crea tu primera categoria de activos"
        onCreate={openCreate}
      />
      <SimpleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? 'Editar categoria' : 'Nueva categoria'}
        fields={[
          { key: 'name', label: 'Nombre', placeholder: 'Tecnologia', required: true },
          { key: 'description', label: 'Descripcion', placeholder: 'Equipos electronicos...', type: 'textarea' },
          { key: 'color', label: 'Color (hex)', placeholder: '#7c3aed' },
        ]}
        values={form}
        onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
        onSave={handleSave}
        busy={busy}
      />
    </>
  )
}

// ── Brand tab ─────────────────────────────────────────────────────────────────

function BrandsTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const { data, isLoading } = useInventoryBrands()
  const rows = (data?.data ?? data ?? []).filter(b => b.enabled !== false)
  const createMutation = useCreateInventoryBrand()
  const updateMutation = useUpdateInventoryBrand()
  const deleteMutation = useDeleteInventoryBrand()

  function openCreate() { setEditing(null); setForm({ name: '', description: '' }); setSheetOpen(true) }
  function openEdit(item) { setEditing(item); setForm({ name: item.name, description: item.description ?? '' }); setSheetOpen(true) }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Marca actualizada')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Marca creada')
      }
      setSheetOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Error al guardar') }
  }

  return (
    <>
      <CatalogTable
        rows={rows}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
        isLoading={isLoading}
        emptyMsg="Crea tu primera marca"
        onCreate={openCreate}
      />
      <SimpleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? 'Editar marca' : 'Nueva marca'}
        fields={[
          { key: 'name', label: 'Nombre', placeholder: 'Dell', required: true },
          { key: 'description', label: 'Descripcion', placeholder: 'Fabricante de equipos...', type: 'textarea' },
        ]}
        values={form}
        onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
        onSave={handleSave}
        busy={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

// ── Location tab ──────────────────────────────────────────────────────────────

function LocationsTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', address: '' })

  const { data, isLoading } = useInventoryLocations()
  const rows = (data?.data ?? data ?? []).filter(l => l.enabled !== false)
  const createMutation = useCreateInventoryLocation()
  const updateMutation = useUpdateInventoryLocation()
  const deleteMutation = useDeleteInventoryLocation()

  function openCreate() { setEditing(null); setForm({ name: '', description: '', address: '' }); setSheetOpen(true) }
  function openEdit(item) { setEditing(item); setForm({ name: item.name, description: item.description ?? '', address: item.address ?? '' }); setSheetOpen(true) }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Ubicacion actualizada')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Ubicacion creada')
      }
      setSheetOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Error al guardar') }
  }

  return (
    <>
      <CatalogTable
        rows={rows}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
        isLoading={isLoading}
        emptyMsg="Crea tu primera ubicacion"
        onCreate={openCreate}
      />
      <SimpleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? 'Editar ubicacion' : 'Nueva ubicacion'}
        fields={[
          { key: 'name', label: 'Nombre', placeholder: 'Oficina principal', required: true },
          { key: 'description', label: 'Descripcion', placeholder: 'Planta 3, area de TI...', type: 'textarea' },
          { key: 'address', label: 'Direccion', placeholder: 'Av. Lima 123...' },
        ]}
        values={form}
        onChange={(k, v) => setForm(f => ({ ...f, [k]: v }))}
        onSave={handleSave}
        busy={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

// ── Custom fields tab ─────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Numero' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Si/No' },
  { value: 'select', label: 'Lista de opciones' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
]

function CustomFieldsTab() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ label: '', fieldKey: '', fieldType: 'text' })

  const { data, isLoading } = useInventoryCustomFields()
  const rows = (data?.data ?? data ?? []).filter(f => f.enabled !== false)
  const createMutation = useCreateInventoryCustomField()
  const updateMutation = useUpdateInventoryCustomField()
  const deleteMutation = useDeleteInventoryCustomField()

  function openCreate() { setEditing(null); setForm({ label: '', fieldKey: '', fieldType: 'text' }); setSheetOpen(true) }
  function openEdit(item) {
    setEditing(item)
    setForm({ label: item.label, fieldKey: item.fieldKey, fieldType: item.fieldType })
    setSheetOpen(true)
  }

  async function handleSave() {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast.success('Campo actualizado')
      } else {
        await createMutation.mutateAsync(form)
        toast.success('Campo creado')
      }
      setSheetOpen(false)
    } catch (err) { toast.error(err?.message ?? 'Error al guardar') }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuevo campo
          </Button>
        </div>
        {isLoading ? <LoadingState /> : rows.length === 0 ? (
          <EmptyState title="Sin campos" description="Crea campos personalizados para tus categorias" action={{ label: 'Nuevo campo', onClick: openCreate }} />
        ) : (
          <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
                  <th className="px-4 py-2.5 text-left font-medium">Etiqueta</th>
                  <th className="px-4 py-2.5 text-left font-medium">Clave</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <CatalogRow
                    key={r.id}
                    item={{ ...r, name: r.label, description: r.fieldKey }}
                    onEdit={() => openEdit(r)}
                    onDelete={id => deleteMutation.mutateAsync(id).then(() => toast.success('Eliminado'))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar campo' : 'Nuevo campo personalizado'}</SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <TextField
              label="Etiqueta"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Numero de serie externo"
              required
            />
            <TextField
              label="Clave (fieldKey)"
              value={form.fieldKey}
              onChange={e => setForm(f => ({ ...f, fieldKey: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
              placeholder="serial_ext"
              hint="Solo letras, numeros y guiones bajos"
              disabled={Boolean(editing)}
            />
            <SelectField
              label="Tipo de campo"
              value={form.fieldType}
              onChange={v => setForm(f => ({ ...f, fieldType: v }))}
              options={FIELD_TYPES}
            />
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.label.trim() || !form.fieldKey.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InventoryCatalogsScreen() {
  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas Inventario"
        title="Catalogos"
        description="Administra categorias, marcas, ubicaciones y campos personalizados"
      />

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="locations">Ubicaciones</TabsTrigger>
          <TabsTrigger value="custom-fields">Campos personalizados</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="brands" className="mt-4">
          <BrandsTab />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationsTab />
        </TabsContent>
        <TabsContent value="custom-fields" className="mt-4">
          <CustomFieldsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
