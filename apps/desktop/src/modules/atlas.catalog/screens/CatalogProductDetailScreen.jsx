// apps/desktop/src/modules/atlas.catalog/screens/CatalogProductDetailScreen.jsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Badge, Button, Input, Label, MarkdownField, Skeleton, Switch, cn } from '@atlas/ui'
import { ArrowLeft, EyeOff, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { atlas } from '../../../lib/atlas.js'
import ProductImageManager  from '../components/ProductImageManager.jsx'
import StockMovementModal   from '../components/StockMovementModal.jsx'
import VariantOptionsEditor from '../components/VariantOptionsEditor.jsx'
import VariantMatrix        from '../components/VariantMatrix.jsx'

const ALL_TABS = ['General', 'Imagenes', 'Precios', 'Variantes', 'Inventario', 'SEO']

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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  const product    = productData?.data
  if (!product) return <div className="p-4 md:p-6 text-sm text-red-500">Producto no encontrado.</div>

  const categories = categoriesData?.data ?? []
  const movements  = movementsData?.data  ?? []
  const movTotal   = movementsData?.total ?? 0
  const isVariable = product.product_type === 'VARIABLE'
  const visibleTabs = ALL_TABS.filter(t => t !== 'Variantes' || isVariable)

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/app/m/atlas.catalog')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{product.name}</span>
          <Badge variant={isVariable ? 'secondary' : 'outline'} className="shrink-0 text-xs">
            {isVariable ? 'Variable' : 'Simple'}
          </Badge>
          <Badge variant={product.published ? 'success' : 'outline'} className="shrink-0 text-xs">
            {product.published ? 'Publicado' : 'Borrador'}
          </Badge>
        </div>
        {canUpdate && (
          <div className="flex items-center gap-2 shrink-0">
            {product.published ? (
              <Button variant="outline" size="sm" onClick={() => publishMutation.mutate(false)} disabled={publishMutation.isPending}>
                <EyeOff className="h-4 w-4 mr-1.5" /> Despublicar
              </Button>
            ) : (
              <Button size="sm" onClick={() => publishMutation.mutate(true)} disabled={publishMutation.isPending}>
                <Globe className="h-4 w-4 mr-1.5" /> Publicar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pill tabs */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-1 w-fit overflow-x-auto">
          {visibleTabs.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 whitespace-nowrap',
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

      {/* Tab content */}
      <div className="flex-1 px-4 md:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'General'    && <GeneralTab    product={product} categories={categories} onSave={updateMutation.mutate} saving={updateMutation.isPending} />}
            {tab === 'Imagenes'   && <ImagenesTab   product={product} token={token} onSave={updateMutation.mutate} />}
            {tab === 'Precios'    && <PreciosTab    product={product} onSave={updateMutation.mutate} saving={updateMutation.isPending} onStockAdjust={() => setStockModalOpen(true)} />}
            {tab === 'Variantes' && isVariable && <VariantesTab product={product} token={token} productId={id} />}
            {tab === 'Inventario' && <InventarioTab movements={movements} total={movTotal} onAdjust={() => setStockModalOpen(true)} />}
            {tab === 'SEO'        && <SeoTab        product={product} onSave={updateMutation.mutate} saving={updateMutation.isPending} />}
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionCard title="Informacion basica">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Nombre</Label>
            <Input id="g-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-slug">Slug</Label>
            <Input id="g-slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Descripcion</Label>
            <MarkdownField value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Describe el producto..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-cat">Categoria</Label>
            <select
              id="g-cat"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">Sin categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Atributos">
        <div className="space-y-2">
          {form.attributes.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input placeholder="Clave" value={a.key} onChange={e => setAttr(i, 'key', e.target.value)} className="w-36" />
              <Input placeholder="Valor" value={a.value} onChange={e => setAttr(i, 'value', e.target.value)} className="flex-1" />
              <button type="button" onClick={() => removeAttr(i)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors text-xs">✕</button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addAttr}>+ Agregar atributo</Button>
        </div>
      </SectionCard>

      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
    </form>
  )
}

function ImagenesTab({ product, token, onSave }) {
  return (
    <div className="max-w-2xl">
      <SectionCard title="Imagenes del producto">
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionCard title="Precios">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-price">Precio</Label>
            <Input id="pr-price" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-currency">Moneda</Label>
            <Input id="pr-currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-compare">Precio anterior (tachado, opcional)</Label>
          <Input id="pr-compare" type="number" min="0" step="0.01" value={form.compare_price} onChange={e => setForm(f => ({ ...f, compare_price: e.target.value }))} />
        </div>
      </SectionCard>

      {!isVariable && (
        <>
          <SectionCard title="Codigos">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pr-sku">SKU</Label>
                <Input id="pr-sku" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Codigo interno" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-barcode">Codigo de barras (EAN/UPC)</Label>
                <Input id="pr-barcode" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-weight">Peso (kg)</Label>
              <Input id="pr-weight" type="number" min="0" step="0.001" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
          </SectionCard>

          <SectionCard title="Inventario">
            <div className="flex items-center gap-3">
              <Switch id="pr-track" checked={form.track_stock} onCheckedChange={v => setForm(f => ({ ...f, track_stock: v }))} />
              <Label htmlFor="pr-track">Controlar stock</Label>
            </div>
            {form.track_stock && (
              <div className="flex items-center gap-6 mt-3 p-4 rounded-xl bg-[hsl(var(--muted))]/50">
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock actual</p>
                  <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{product.stock ?? 0}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onStockAdjust}>Registrar ajuste</Button>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {isVariable && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Los precios, SKU y stock se gestionan por variante en la pestana Variantes.
        </p>
      )}

      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
    </form>
  )
}

function VariantesTab({ product, token, productId }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <SectionCard title="Opciones">
        <VariantOptionsEditor token={token} productId={productId} options={product.options ?? []} />
      </SectionCard>
      <SectionCard title="Combinaciones de variantes">
        <VariantMatrix token={token} productId={productId} variants={product.variants ?? []} />
      </SectionCard>
    </div>
  )
}

function InventarioTab({ movements, total, onAdjust }) {
  function fmtDate(val) {
    if (!val) return '—'
    try { return new Date(val).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return val }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Movimientos de stock ({total})
        </p>
        <Button size="sm" onClick={onAdjust}>Registrar ajuste</Button>
      </div>

      {movements.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sin movimientos registrados.
        </div>
      ) : (
        <div className="rounded-2xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden">
          {movements.map(m => (
            <div key={m.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', m.quantity_delta > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                  </span>
                  {m.reason && <span className="text-sm text-[hsl(var(--foreground))]">{m.reason}</span>}
                </div>
                {m.note && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{m.note}</p>}
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{fmtDate(m.created_at)}</p>
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <SectionCard title="Metadatos SEO">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seo-title">Titulo SEO</Label>
            <Input id="seo-title" value={form.meta_title} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))} placeholder={product.name} maxLength={160} />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{form.meta_title.length}/160</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seo-desc">Descripcion SEO</Label>
            <textarea
              id="seo-desc"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] resize-none"
              rows={3}
              value={form.meta_description}
              onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
              placeholder="Descripcion para motores de busqueda..."
              maxLength={320}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{form.meta_description.length}/320</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Vista previa en Google">
        <div className="max-w-md space-y-0.5 p-3 rounded-xl bg-[hsl(var(--muted))]/30">
          <p className="text-sm text-blue-600 truncate">{form.meta_title || product.name}</p>
          <p className="text-xs text-green-700">/{product.slug}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
            {form.meta_description || product.description || 'Sin descripcion'}
          </p>
        </div>
      </SectionCard>

      <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar SEO'}</Button>
    </form>
  )
}
