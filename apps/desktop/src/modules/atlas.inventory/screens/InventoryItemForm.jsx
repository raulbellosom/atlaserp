import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  Button,
  PageHeader,
  TextField,
  SelectField,
  DateField,
  MarkdownField,
  CreatableComboboxField,
  AttachmentsPanel,
  ErrorState,
  LoadingState,
} from '@atlas/ui'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  useInventoryItem,
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from '../hooks/useInventoryItems.js'
import {
  useInventoryCategories,
  useInventoryBrands,
  useInventoryLocations,
  useInventoryCustomFields,
  useCreateInventoryCategory,
  useCreateInventoryBrand,
  useCreateInventoryLocation,
} from '../hooks/useInventoryCatalogs.js'
import { InventoryCustomFieldsForm } from '../components/InventoryCustomFieldsForm.jsx'
import { InventoryCommentThread } from '../components/InventoryCommentThread.jsx'
import { ITEM_STATUSES, ITEM_TYPES } from '../lib/inventory-constants.js'

// ── CollapsibleSection ────────────────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[hsl(var(--border))] rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] ${open ? 'rounded-t-lg' : 'rounded-lg'}`}
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultValues = {
  name: '',
  assetTag: '',
  itemType: '',
  categoryId: '',
  brandId: '',
  locationId: '',
  status: 'available',
  model: '',
  serialNumber: '',
  partNumber: '',
  purchaseDate: null,
  purchasePrice: '',
  vendorName: '',
  invoiceNumber: '',
  warrantyExpiry: null,
  warrantyNotes: '',
  notes: '',
  customValues: {},
}

function mapItemToForm(item) {
  const cvMap = {}
  if (Array.isArray(item.customValues)) {
    for (const cv of item.customValues) {
      if (cv.field?.fieldKey) {
        cvMap[cv.field.fieldKey] = cv.value ?? ''
      }
    }
  }
  return {
    name: item.name ?? '',
    assetTag: item.assetTag ?? '',
    itemType: item.itemType ?? '',
    categoryId: item.categoryId ?? '',
    brandId: item.brandId ?? '',
    locationId: item.locationId ?? '',
    status: item.status ?? 'available',
    model: item.model ?? '',
    serialNumber: item.serialNumber ?? '',
    partNumber: item.partNumber ?? '',
    purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : null,
    purchasePrice: item.purchasePrice != null ? String(item.purchasePrice) : '',
    vendorName: item.vendorName ?? '',
    invoiceNumber: item.invoiceNumber ?? '',
    warrantyExpiry: item.warrantyExpiry ? item.warrantyExpiry.slice(0, 10) : null,
    warrantyNotes: item.warrantyNotes ?? '',
    notes: item.notes ?? '',
    customValues: cvMap,
  }
}

function buildApiPayload(formData, customFields) {
  const { customValues, purchasePrice, purchaseDate, warrantyExpiry, ...rest } = formData

  const payload = {
    ...rest,
    purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : null,
    purchaseDate: purchaseDate ? `${purchaseDate}T00:00:00.000Z` : null,
    warrantyExpiry: warrantyExpiry ? `${warrantyExpiry}T00:00:00.000Z` : null,
    categoryId: rest.categoryId || null,
    brandId: rest.brandId || null,
    locationId: rest.locationId || null,
  }

  if (customFields?.length && customValues && typeof customValues === 'object') {
    payload.customValues = customFields
      .filter((cf) => customValues[cf.fieldKey] !== undefined && customValues[cf.fieldKey] !== '')
      .map((cf) => ({ fieldId: cf.id, value: String(customValues[cf.fieldKey]) }))
  }

  return payload
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryItemForm() {
  const { "*": wildcard } = useParams()
  const id = useMemo(() => {
    const parts = (wildcard ?? '').split('/')
    return parts[2] === 'edit' ? parts[1] : null
  }, [wildcard])
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const { session } = useAuth()
  const token = session?.access_token

  const itemQuery = useInventoryItem(isEdit ? id : null)
  const editItem = itemQuery.data?.data ?? itemQuery.data ?? null

  const categoriesQuery = useInventoryCategories()
  const brandsQuery = useInventoryBrands()
  const locationsQuery = useInventoryLocations()

  const createCategory = useCreateInventoryCategory()
  const createBrand = useCreateInventoryBrand()
  const createLocation = useCreateInventoryLocation()

  const { control, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues,
  })

  useEffect(() => {
    if (isEdit && editItem) {
      reset(mapItemToForm(editItem))
    }
  }, [isEdit, editItem, reset])

  const watchedCategoryId = watch('categoryId')
  const customFieldsQuery = useInventoryCustomFields(watchedCategoryId || undefined)
  const customFields = customFieldsQuery.data?.data ?? customFieldsQuery.data ?? []

  const createItem = useCreateInventoryItem()
  const updateItem = useUpdateInventoryItem()

  const statusOptions = ITEM_STATUSES.map((s) => ({ value: s.value, label: s.label }))

  const categoryOptions = (categoriesQuery.data?.data ?? categoriesQuery.data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))
  const brandOptions = (brandsQuery.data?.data ?? brandsQuery.data ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }))
  const locationOptions = (locationsQuery.data?.data ?? locationsQuery.data ?? []).map((l) => ({
    value: l.id,
    label: l.name,
  }))

  const attachmentsConfig = useMemo(() => ({
    label: 'Archivos',
    listPath: '/inventory/items/:id/files',
    addPath: '/inventory/items/:id/files',
    removePath: '/inventory/items/:id/files/:docId',
    upload: { endpoint: '/files/upload', moduleKey: 'atlas.inventory', entityType: 'InvItem' },
    fields: { fileAssetId: 'fileAssetId' },
    signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
  }), [])

  async function onSubmit(formData) {
    try {
      const payload = buildApiPayload(formData, customFields)
      if (isEdit) {
        await updateItem.mutateAsync({ id, ...payload })
        toast.success('Activo actualizado')
        navigate(`/app/m/atlas.inventory/inventory/${id}`)
      } else {
        const result = await createItem.mutateAsync(payload)
        const newId = result?.data?.id ?? result?.id
        toast.success('Activo creado')
        if (newId) {
          navigate(`/app/m/atlas.inventory/inventory/${newId}`)
        } else {
          navigate('/app/m/atlas.inventory/inventory')
        }
      }
    } catch (err) {
      toast.error(err?.message ?? 'Error al guardar el activo')
    }
  }

  if (isEdit && itemQuery.isLoading) {
    return <LoadingState message="Cargando activo..." />
  }
  if (isEdit && itemQuery.isError) {
    return <ErrorState message="No se pudo cargar el activo" />
  }

  const title = isEdit ? `Editar activo` : 'Nuevo activo'
  const busy = isSubmitting || createItem.isPending || updateItem.isPending

  return (
    <div className="p-4 md:p-6 pb-24">
      <PageHeader
        title={title}
        subtitle={isEdit ? (editItem?.name ?? '') : 'Completa la informacion del activo'}
      />

      <div className={isEdit ? 'mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start' : 'mt-6 max-w-3xl'}>
      <form id="item-form" onSubmit={handleSubmit(onSubmit)} className={`space-y-4 ${isEdit ? 'lg:col-span-2' : ''}`}>
        <CollapsibleSection title="Identificacion" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="name"
              control={control}
              rules={{ required: 'El nombre es requerido' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Nombre"
                  required
                  error={errors.name?.message}
                  placeholder="Laptop Dell XPS 15"
                />
              )}
            />
            <Controller
              name="assetTag"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Etiqueta de activo"
                  placeholder="AT-0001 (opcional, se genera si se omite)"
                  hint="Dejar vacio para auto-generar"
                />
              )}
            />
            <Controller
              name="itemType"
              control={control}
              render={({ field }) => (
                <SelectField
                  label="Tipo"
                  value={field.value || '__none__'}
                  onChange={v => field.onChange(v === '__none__' ? '' : v)}
                  options={[{ value: '__none__', label: 'Sin tipo' }, ...ITEM_TYPES]}
                />
              )}
            />
            <Controller
              name="serialNumber"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Numero de serie" placeholder="SN-XXXXXXXX" />
              )}
            />
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <CreatableComboboxField
                  label="Categoria"
                  options={categoryOptions}
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Buscar o crear categoria..."
                  searchPlaceholder="Buscar categoria..."
                  onCreate={async (name) => {
                    try {
                      const result = await createCategory.mutateAsync({ name })
                      const newId = result?.data?.id ?? result?.id
                      if (newId) field.onChange(newId)
                      toast.success(`Categoria "${name}" creada`)
                    } catch {
                      toast.error('No se pudo crear la categoria')
                    }
                  }}
                  isCreating={createCategory.isPending}
                />
              )}
            />
            <Controller
              name="brandId"
              control={control}
              render={({ field }) => (
                <CreatableComboboxField
                  label="Marca"
                  options={brandOptions}
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Buscar o crear marca..."
                  searchPlaceholder="Buscar marca..."
                  onCreate={async (name) => {
                    try {
                      const result = await createBrand.mutateAsync({ name })
                      const newId = result?.data?.id ?? result?.id
                      if (newId) field.onChange(newId)
                      toast.success(`Marca "${name}" creada`)
                    } catch {
                      toast.error('No se pudo crear la marca')
                    }
                  }}
                  isCreating={createBrand.isPending}
                />
              )}
            />
            <Controller
              name="model"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Modelo" placeholder="XPS 15 9530" />
              )}
            />
            <Controller
              name="partNumber"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Numero de parte" placeholder="PN-XXXXX" />
              )}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Ubicacion y estado" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="locationId"
              control={control}
              render={({ field }) => (
                <CreatableComboboxField
                  label="Ubicacion"
                  options={locationOptions}
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Buscar o crear ubicacion..."
                  searchPlaceholder="Buscar ubicacion..."
                  onCreate={async (name) => {
                    try {
                      const result = await createLocation.mutateAsync({ name })
                      const newId = result?.data?.id ?? result?.id
                      if (newId) field.onChange(newId)
                      toast.success(`Ubicacion "${name}" creada`)
                    } catch {
                      toast.error('No se pudo crear la ubicacion')
                    }
                  }}
                  isCreating={createLocation.isPending}
                />
              )}
            />
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <SelectField
                  {...field}
                  label="Estado"
                  options={statusOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Compra" defaultOpen={false}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="purchaseDate"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Fecha de compra"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
            <Controller
              name="purchasePrice"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Precio de compra"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              )}
            />
            <Controller
              name="vendorName"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Proveedor" placeholder="Nombre del proveedor" />
              )}
            />
            <Controller
              name="invoiceNumber"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Numero de factura" placeholder="FAC-001" />
              )}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Garantia" defaultOpen={false}>
          <div className="space-y-4">
            <Controller
              name="warrantyExpiry"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Vencimiento de garantia"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
            <Controller
              name="warrantyNotes"
              control={control}
              render={({ field }) => (
                <MarkdownField
                  label="Notas de garantia"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  placeholder="Condiciones, numero de caso, etc."
                />
              )}
            />
          </div>
        </CollapsibleSection>

        {customFields.length > 0 && (
          <CollapsibleSection title="Campos personalizados" defaultOpen>
            <InventoryCustomFieldsForm
              customFields={customFields}
              control={control}
              fieldPrefix="customValues"
            />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Notas" defaultOpen={false}>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <MarkdownField
                label="Notas adicionales"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                placeholder="Informacion adicional sobre el activo..."
              />
            )}
          />
        </CollapsibleSection>

        {isEdit && editItem?.id && (
          <CollapsibleSection title="Archivos" defaultOpen={false}>
            <AttachmentsPanel
              apiBaseUrl={getApiUrl()}
              token={token}
              recordId={editItem.id}
              config={attachmentsConfig}
              context="detail"
              showHeading={false}
            />
          </CollapsibleSection>
        )}

      </form>

      {isEdit && editItem?.id && (
        <div className="space-y-4 lg:sticky lg:top-6">
          <InventoryCommentThread itemId={editItem.id} />
        </div>
      )}
      </div>

      {/* Fixed action bar — always visible during scroll; sidebar (z-40) overlaps left naturally */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-sm">
        <div className="flex items-center justify-end gap-3 px-4 md:px-6 py-3 safe-bottom">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="submit" form="item-form" disabled={busy}>
            {busy ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear activo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
