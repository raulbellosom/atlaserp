// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  Button, ComboboxField, EmptyState, MarkdownField, NumberField,
  SelectField, Skeleton, Switch, TextareaField, TextField, cn,
} from '@atlas/ui'
import { ArrowLeft, EyeOff, Globe, Package, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'
import ProductImageManager  from '../components/ProductImageManager.jsx'
import StockMovementModal   from '../components/StockMovementModal.jsx'
import VariantOptionsEditor from '../components/VariantOptionsEditor.jsx'
import VariantMatrix        from '../components/VariantMatrix.jsx'

const ALL_TABS = ['General', 'Imagenes', 'Precios', 'Variantes', 'Inventario', 'SEO']

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
  { value: 'GTQ', label: 'GTQ — Quetzal guatemalteco' },
]

function SectionCard({ title, children, className }) {
  return (
    <div className={cn('rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4', className)}>
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{title}</h3>
      )}
      {children}
    </div>
  )
}

export default function CatalogProductDetailScreen() {
  const { '*': wildcard } = useParams()
  const id = wildcard
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const permissions = userProfile?.permissions ?? []
  const hasPermission = key => Boolean(userProfile?.isAdmin || permissions.includes(key))
  const canUpdate = hasPermission('catalog.products.update')

  const [tab, setTab] = useState('General')
  const [stockModalOpen, setStockModalOpen] = useState(false)

  const { data: productData, isPending } = useQuery({
    queryKey: ['catalog-product', id, token],
    queryFn: () => atlas.catalog.getProduct(id, token),
    enabled: Boolean(token && id),
    staleTime: 30_000,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['catalog-categories-flat', token],
    queryFn: () => atlas.catalog.listCategories(token, { flat: 'true' }),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const { data: movementsData } = useQuery({
    queryKey: ['catalog-stock-movements', id, token],
    queryFn: () => atlas.catalog.listStockMovements(id, token, { limit: 50 }),
    enabled: Boolean(token && id && tab === 'Inventario'),
    staleTime: 30_000,
  })

  const updateMutation = useMutation({
    mutationFn: data => atlas.catalog.updateProduct(id, data, token),
    onSuccess: () => {
      toast.success('Producto guardado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', id] })
    },
    onError: err => toast.error(err?.message ?? 'Error al guardar'),
  })

  const publishMutation = useMutation({
    mutationFn: pub => pub
      ? atlas.catalog.publishProduct(id, token)
      : atlas.catalog.unpublishProduct(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-product', id] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  if (isPending) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  const product = productData?.data
  if (!product) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState icon={Package} title="Producto no encontrado" description="El producto no existe o fue eliminado." />
      </div>
    )
  }

  const categories = categoriesData?.data ?? []
  const movements  = movementsData?.data  ?? []
  const movTotal   = movementsData?.total ?? 0
  const isVariable = product.product_type === 'VARIABLE'
  const visibleTabs = ALL_TABS.filter(t => t !== 'Variantes' || isVariable)

  return (
    <div className="flex flex-col min-h-dvh">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/app/m/atlas.catalog')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{product.name}</h1>
              <span className="shrink-0 inline-flex items-center rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                {isVariable ? 'Variable' : 'Simple'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', product.published ? 'bg-emerald-500' : 'bg-amber-400')} />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {product.published ? 'Publicado' : 'Borrador — no visible al público'}
              </span>
            </div>
          </div>
        </div>
        {canUpdate && (
          <Button
            size="sm"
            variant={product.published ? 'outline' : 'default'}
            onClick={() => publishMutation.mutate(!product.published)}
            disabled={publishMutation.isPending}
          >
            {product.published
              ? <><EyeOff className="h-4 w-4 mr-1.5" />Despublicar</>
              : <><Globe className="h-4 w-4 mr-1.5" />Publicar</>}
          </Button>
        )}
      </div>

      {/* ── Pill tabs ── */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-1 w-fit overflow-x-auto">
          {visibleTabs.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 whitespace-nowrap',
                tab === t
                  ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 px-4 md:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'General'   && <GeneralTab   product={product} categories={categories} onSave={updateMutation.mutate} saving={updateMutation.isPending} />}
            {tab === 'Imagenes'  && <ImagenesTab  product={product} token={token} onSave={updateMutation.mutate} />}
            {tab === 'Precios'   && <PreciosTab   product={product} onSave={updateMutation.mutate} saving={updateMutation.isPending} onStockAdjust={() => setStockModalOpen(true)} />}
            {tab === 'Variantes' && isVariable && <VariantesTab product={product} token={token} productId={id} />}
            {tab === 'Inventario' && <InventarioTab movements={movements} total={movTotal} stock={product.stock} onAdjust={() => setStockModalOpen(true)} />}
            {tab === 'SEO'       && <SeoTab       product={product} onSave={updateMutation.mutate} saving={updateMutation.isPending} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <StockMovementModal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        token={token}
        productId={id}
      />
    </div>
  )
}

// ── Tab components ────────────────────────────────────────────────────────────

function GeneralTab({ product, categories, onSave, saving }) {
  const [form, setForm] = useState({
    name:        product.name        ?? '',
    slug:        product.slug        ?? '',
    description: product.description ?? '',
    category_id: product.category_id ?? '',
    attributes:  Array.isArray(product.attributes) ? product.attributes : [],
  })

  function slugify(s) {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  function handleNameChange(e) {
    const name = e.target.value
    const autoSlug = slugify(product.name ?? '')
    const isAutoSlug = form.slug === autoSlug || form.slug === slugify(form.name)
    setForm(f => ({ ...f, name, slug: isAutoSlug ? slugify(name) : f.slug }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      name:        form.name,
      slug:        form.slug,
      description: form.description || undefined,
      category_id: form.category_id || null,
      attributes:  form.attributes.filter(a => a.key?.trim()),
    })
  }

  function addAttr()        { setForm(f => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] })) }
  function removeAttr(i)    { setForm(f => ({ ...f, attributes: f.attributes.filter((_, idx) => idx !== i) })) }
  function setAttr(i, k, v) { setForm(f => ({ ...f, attributes: f.attributes.map((a, idx) => idx === i ? { ...a, [k]: v } : a) })) }

  const categoryOptions = [
    { value: '', label: 'Sin categoría' },
    ...categories.map(c => ({ value: c.id, label: c.name })),
  ]

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main — 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          <SectionCard title="Información básica">
            <TextField
              label="Nombre del producto"
              value={form.name}
              onChange={handleNameChange}
              required
            />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              description="Identificador en la URL del producto"
              required
            />
            <MarkdownField
              label="Descripción"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe el producto..."
            />
          </SectionCard>

          <SectionCard title="Atributos personalizados">
            <div className="space-y-2">
              {form.attributes.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Sin atributos. Agrega pares clave-valor para especificaciones adicionales.
                </p>
              )}
              {form.attributes.map((a, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <TextField
                    label={i === 0 ? 'Clave' : undefined}
                    value={a.key}
                    onChange={e => setAttr(i, 'key', e.target.value)}
                    placeholder="Ej: Material"
                    className="w-40"
                  />
                  <TextField
                    label={i === 0 ? 'Valor' : undefined}
                    value={a.value}
                    onChange={e => setAttr(i, 'value', e.target.value)}
                    placeholder="Ej: Aluminio"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttr(i)}
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      'text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-500',
                      i === 0 && 'mb-0',
                    )}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addAttr}>
                + Agregar atributo
              </Button>
            </div>
          </SectionCard>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-5">
          <SectionCard title="Organización">
            <ComboboxField
              label="Categoría"
              options={categoryOptions}
              value={form.category_id}
              onChange={v => setForm(f => ({ ...f, category_id: v }))}
              placeholder="Seleccionar categoría..."
              searchPlaceholder="Buscar categoría..."
              emptyText="Sin resultados"
            />
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

function ImagenesTab({ product, token, onSave }) {
  return (
    <div className="max-w-3xl">
      <SectionCard title="Imágenes del producto">
        <ProductImageManager
          token={token}
          coverId={product.cover_asset_id}
          imageIds={Array.isArray(product.images) ? product.images : []}
          onChange={({ coverId, imageIds }) => onSave({ cover_asset_id: coverId, images: imageIds })}
        />
      </SectionCard>
    </div>
  )
}

function PreciosTab({ product, onSave, saving, onStockAdjust }) {
  const isVariable = product.product_type === 'VARIABLE'
  const [form, setForm] = useState({
    price:         String(product.price        ?? 0),
    compare_price: product.compare_price != null ? String(product.compare_price) : '',
    currency:      product.currency     ?? 'USD',
    sku:           product.sku          ?? '',
    barcode:       product.barcode      ?? '',
    weight:        product.weight  != null ? String(product.weight) : '',
    track_stock:   product.track_stock  ?? false,
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      price:         Number(form.price),
      compare_price: form.compare_price ? Number(form.compare_price) : null,
      currency:      form.currency,
      sku:           form.sku     || null,
      barcode:       form.barcode || null,
      weight:        form.weight  ? Number(form.weight) : null,
      track_stock:   form.track_stock,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main — 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          <SectionCard title="Precio de venta">
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Precio"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                min={0}
                step={0.01}
                required
              />
              <SelectField
                label="Moneda"
                options={CURRENCY_OPTIONS}
                value={form.currency}
                onValueChange={v => setForm(f => ({ ...f, currency: v }))}
                placeholder="Seleccionar..."
              />
            </div>
            <NumberField
              label="Precio anterior (tachado, opcional)"
              value={form.compare_price}
              onChange={e => setForm(f => ({ ...f, compare_price: e.target.value }))}
              min={0}
              step={0.01}
              description="Se muestra tachado junto al precio actual para indicar descuento"
            />
          </SectionCard>

          {!isVariable && (
            <SectionCard title="Identificadores y logística">
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="SKU"
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="Código interno"
                  description="Referencia interna del producto"
                />
                <TextField
                  label="Código de barras"
                  value={form.barcode}
                  onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  placeholder="EAN / UPC"
                />
              </div>
              <NumberField
                label="Peso (kg)"
                value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                min={0}
                step={0.001}
                description="Peso para cálculo de costos de envío"
              />
            </SectionCard>
          )}

          {isVariable && (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Los precios, SKU y stock se gestionan por variante.<br />
              <span className="font-medium">Usa la pestaña Variantes.</span>
            </div>
          )}
        </div>

        {/* Sidebar — 1/3 */}
        {!isVariable && (
          <div className="space-y-5">
            <SectionCard title="Inventario">
              <div className="flex items-start gap-3">
                <Switch
                  id="pr-track"
                  checked={form.track_stock}
                  onCheckedChange={v => setForm(f => ({ ...f, track_stock: v }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium leading-none">Controlar stock</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Registrar entradas y salidas</p>
                </div>
              </div>

              {form.track_stock && (
                <div className="rounded-xl bg-[hsl(var(--muted))]/50 p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock actual</p>
                    <p className={cn(
                      'text-3xl font-bold tabular-nums',
                      (product.stock ?? 0) <= 0 ? 'text-red-500' : 'text-[hsl(var(--foreground))]',
                    )}>
                      {product.stock ?? 0}
                    </p>
                    {(product.stock ?? 0) <= 0 && (
                      <p className="text-xs text-red-500 mt-0.5">Sin stock disponible</p>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={onStockAdjust}>
                    Registrar ajuste
                  </Button>
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

function VariantesTab({ product, token, productId }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <SectionCard title="Opciones de variante">
        <VariantOptionsEditor token={token} productId={productId} options={product.options ?? []} />
      </SectionCard>
      <SectionCard title="Combinaciones">
        <VariantMatrix token={token} productId={productId} variants={product.variants ?? []} />
      </SectionCard>
    </div>
  )
}

function InventarioTab({ movements, total, stock, onAdjust }) {
  function fmtDate(val) {
    if (!val) return '—'
    try {
      return new Date(val).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return val
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Movimientos de inventario</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {total} movimiento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={onAdjust}>Registrar ajuste</Button>
      </div>

      {movements.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin movimientos"
          description="Aún no hay ajustes de stock registrados para este producto."
        />
      ) : (
        <div className="rounded-2xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden">
          {movements.map(m => (
            <div
              key={m.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--muted))]/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  m.quantity_delta > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600',
                )}>
                  {m.quantity_delta > 0
                    ? <TrendingUp className="h-3.5 w-3.5" />
                    : <TrendingDown className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-semibold tabular-nums',
                      m.quantity_delta > 0 ? 'text-emerald-600' : 'text-red-600',
                    )}>
                      {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                    </span>
                    {m.reason && (
                      <span className="text-sm text-[hsl(var(--foreground))] truncate">{m.reason}</span>
                    )}
                  </div>
                  {m.note && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate mt-0.5">{m.note}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 ml-3">{fmtDate(m.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SeoTab({ product, onSave, saving }) {
  const [form, setForm] = useState({
    meta_title:       product.meta_title       ?? '',
    meta_description: product.meta_description ?? '',
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ meta_title: form.meta_title || null, meta_description: form.meta_description || null })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main — 2/3 */}
        <div className="lg:col-span-2">
          <SectionCard title="Metadatos SEO">
            <TextField
              label="Título SEO"
              value={form.meta_title}
              onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
              placeholder={product.name}
              maxLength={160}
              description={`${form.meta_title.length} / 160 caracteres`}
            />
            <TextareaField
              label="Descripción SEO"
              value={form.meta_description}
              onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
              placeholder="Descripción para motores de búsqueda..."
              maxLength={320}
              rows={4}
              description={`${form.meta_description.length} / 320 caracteres`}
            />
          </SectionCard>
        </div>

        {/* Sidebar — 1/3 */}
        <div>
          <SectionCard title="Vista previa en Google">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
              Ejemplo de resultado
            </p>
            <div className="space-y-0.5">
              <p className="text-sm text-blue-600 font-medium truncate leading-snug">
                {form.meta_title || product.name}
              </p>
              <p className="text-xs text-emerald-700 truncate">tudominio.com / {product.slug}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-3 leading-relaxed mt-1">
                {form.meta_description || product.description || 'Sin descripción SEO configurada.'}
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar SEO'}
        </Button>
      </div>
    </form>
  )
}
