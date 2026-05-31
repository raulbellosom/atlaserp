# Atlas Website v2 — Rediseño Completo (Spec Paraguas)

**Fecha:** 2026-05-30
**Estado:** Aprobado para implementación
**Tipo:** Spec paraguas — define arquitectura y contratos entre módulos
**Supersede:** `2026-05-28-atlas-website-foundation.md`, `2026-05-28-atlas-website-module.md`, `2026-05-30-website-templates-multipage-client-login-design.md`

---

## Resumen

Rediseño total del módulo `atlas.website`. Se elimina GrapesJS por completo y se reemplaza con `@raulbellosom/atlas-web-builder` (builder visual basado en CraftJS, publicado en npm). El cambio permite contenido dinámico real: productos del catálogo, formularios con submissions reales, reservaciones integradas con `atlas.calendar`, y checkout con Stripe.

El rediseño abarca tres piezas independientes:
1. **`atlas.website`** — módulo refactorizado (editor, renderer, wizard, blog, formularios, Stripe)
2. **`atlas.catalog`** — nuevo módulo AME3 de catálogo de productos
3. **Platform Settings / SMTP** — nueva área de configuración global del ERP

Cada pieza tiene su propio plan de implementación. Los specs hijos (`atlas.catalog` y platform-settings) detallan esas piezas; este spec define los contratos entre ellas.

---

## Sección 1: Arquitectura general

```
atlas.website
  ├── depende de atlas.catalog (opcional — activa bloques ecommerce)
  ├── depende de atlas.calendar (opcional — activa bloques de reservaciones)
  ├── lee SMTP de InstanceConfig (configurado por platform-settings)
  └── Stripe keys propias en website_site

atlas.catalog
  └── independiente — cualquier módulo futuro puede consumirlo

Platform Settings / SMTP
  └── persiste en InstanceConfig — cualquier módulo puede leerlo
```

**Dependencias opcionales:** `atlas.website` verifica en runtime si `atlas.catalog` y `atlas.calendar` están instalados y habilitados. Si `atlas.catalog` no está instalado, los bloques `ProductsGridBlock`, `ProductCardBlock` y `CartBlock` no aparecen en el editor. Si `atlas.calendar` no está instalado, `BookingFormBlock` no aparece.

---

## Sección 2: Migración — corte limpio

### Código eliminado

| Archivo / directorio | Acción |
|---|---|
| `apps/desktop/src/website/atlasBlocks/` | Borrar directorio completo |
| `apps/desktop/src/website/atlasGrapesConfig.js` | Borrar |
| `apps/desktop/src/website/atlasBlocksBaseCSS.js` | Borrar |
| `apps/desktop/src/website/WebsiteGrapesEditor.jsx` | Borrar |
| `apps/desktop/src/website/WebsiteInlineEditor.jsx` | Borrar |
| `apps/desktop/src/website/WebsiteEditBar.jsx` | Borrar |
| `apps/desktop/src/website/atlasTemplates/` | Borrar directorio completo |
| `docs/superpowers/plans/2026-05-28-atlas-website-foundation.md` | Borrar |
| `docs/superpowers/plans/2026-05-28-atlas-website-module.md` | Borrar |
| `docs/superpowers/specs/2026-05-30-website-templates-multipage-client-login-design.md` | Borrar |
| `docs/superpowers/plans/2026-05-30-website-templates-multipage-A.md` | Borrar |
| `docs/superpowers/plans/2026-05-30-website-templates-multipage-B.md` | Borrar |

### Base de datos

Las tablas `website_*` son tablas AME3 (no están en `prisma/schema.prisma`). El proceso es:
1. Desinstalar `atlas.website` de forma destructiva → borra todas las tablas `website_*`
2. Los modelos AME3 se redefinen con los nuevos campos
3. Reinstalar y hacer `POST /modules/atlas.website/sync` → recrea las tablas limpias

No hay migración Prisma que editar.

### Instalación del paquete

```bash
pnpm --filter @atlas/desktop add @raulbellosom/atlas-web-builder
```

---

## Sección 3: Wizard de creación del sitio

Reemplaza `WebsiteOverviewScreen.jsx`. Se muestra cuando no existe `website_site` para la empresa. Una vez completado redirige al editor con Home abierto.

### Paso 1 — Tipo de sitio

Tres opciones:
- **Sitio informativo** (`site_type: 'informational'`) — páginas estáticas + formulario de contacto
- **Tienda online** (`site_type: 'ecommerce'`) — requiere `atlas.catalog` instalado; activa bloques de productos, carrito y pantalla Pagos
- **Sitio con reservaciones** (`site_type: 'bookings'`) — requiere `atlas.calendar` instalado; activa `BookingFormBlock`

### Paso 2 — Identidad visual

| Campo | Prop del tema |
|---|---|
| Nombre del sitio | `website_site.name` |
| Logo | `website_site.logo_asset_id` |
| Color primario | `--atlas-color-primary` |
| Color de fondo | `--atlas-color-bg` |
| Tipografía | `--atlas-font-sans` (5 opciones: Inter, Playfair Display, Space Grotesk, DM Sans, Merriweather) |

Las elecciones se convierten en un tema via `defineTheme` y se persisten en `website_theme`.

### Paso 3 — Plantilla

Grid de templates filtrable por categoría. Cada template es un objeto `Page` JSON de `atlas-web-builder` (no HTML crudo). Los tokens de color y tipografía del Paso 2 se inyectan vía el tema — los templates usan variables CSS, no colores hardcodeados. El usuario elige qué páginas activar (Inicio requerido, resto opcional).

### Paso 4 — Funciones extra (condicional)

- *Ecommerce:* toggle carrito + Stripe Publishable Key + Stripe Secret Key
- *Reservaciones:* selector del calendario de `atlas.calendar` destino
- *Todos:* toggle formulario de contacto (si SMTP configurado, activa notificaciones email)

### Al finalizar

1. `POST /website/site` — crea `website_site` con `site_type`, nombre, logo, tema
2. Por cada página seleccionada → `POST /website/pages`
3. Si Stripe configurado → `PATCH /website/site/:id` con keys encriptadas
4. Redirige a `/app/m/atlas.website/pages/:homePageId/editor`

---

## Sección 4: Editor de páginas

**Archivo:** `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx`

```jsx
import { AtlasWebBuilderEditor, baseBlocks } from '@raulbellosom/atlas-web-builder'
import '@raulbellosom/atlas-web-builder/styles'
import { atlasBlocks } from '../../../website/atlasBlocks/index.js'

<div style={{ position: 'fixed', inset: 0 }}>
  <AtlasWebBuilderEditor
    blocks={[...baseBlocks, ...atlasBlocks]}
    initialPage={currentPage}
    theme={siteTheme}
    assets={createSupabaseAssetSource('atlas-media')}
    resources={buildAtlasResources({ token, siteType })}
    brandLogo={<img src="/logo.png" height={26} />}
    brandName="Atlas ERP"
    onSaveDraft={(page) => saveDraft(page)}
    onPublish={(page) => publishPage(page)}
  />
</div>
```

`atlasBlocks` es el array de bloques custom de Atlas (ver Sección 5). Solo se incluyen los bloques relevantes al `site_type` del sitio activo.

`buildAtlasResources({ token, siteType })` retorna el objeto `resources` condicional:
```js
{
  products: siteType === 'ecommerce'
    ? ({ categoryId, limit }) => fetch(`${getApiUrl()}/catalog/products?...`, { headers: { Authorization: `Bearer ${token}` } })
    : undefined,
}
```

---

## Sección 5: Bloques custom de Atlas

**Directorio:** `apps/desktop/src/website/atlasBlocks/`
**Export:** `apps/desktop/src/website/atlasBlocks/index.js` → `atlasBlocks` (array filtrado por `site_type`)

### Bloques universales

**`ContactFormBlock`**
```js
defineBlock({
  type: 'ContactFormBlock',
  label: 'Formulario de contacto',
  category: 'atlas',
  defaultProps: { formId: '', successMessage: 'Mensaje enviado correctamente', buttonLabel: 'Enviar' },
  fields: {
    formId: { type: 'text', label: 'ID del formulario' },
    successMessage: { type: 'text', label: 'Mensaje de éxito' },
    buttonLabel: { type: 'text', label: 'Texto del botón' },
  },
  render: ({ formId, successMessage, buttonLabel }) => { /* formulario HTML con fetch a /public/website/forms/:formId/submit */ }
})
```

**`BlogIndexBlock`**
```js
defineBlock({
  type: 'BlogIndexBlock',
  label: 'Lista de posts',
  category: 'atlas',
  defaultProps: { limit: 6, columns: 3, showExcerpt: true },
  fields: {
    limit:       { type: 'number', label: 'Máximo de posts' },
    columns:     { type: 'select', label: 'Columnas', options: ['1','2','3'] },
    showExcerpt: { type: 'toggle', label: 'Mostrar extracto' },
  },
  render: ({ limit, columns, showExcerpt, ctx }) => { /* fetch /public/website/blog, render cards */ }
})
```

### Bloques ecommerce (solo `site_type = 'ecommerce'`)

**`ProductsGridBlock`** — Props: `categoryId`, `limit`, `columns` (2-4), `showPrice`, `showAddToCart`. Usa `ctx.resource('products', { categoryId, limit })`.

**`ProductCardBlock`** — Props: `productId`, `showPrice`, `showDescription`, `showAddToCart`.

**`CartBlock`** — Estado en `localStorage`. Al checkout → `POST /public/website/checkout` → Stripe Checkout Session URL → redirect.

### Bloques reservaciones (solo `site_type = 'bookings'`)

**`BookingFormBlock`** — Props: `calendarId`, `serviceDuration` (minutos, default 60), `successMessage`. Selector de fecha/hora + formulario (nombre, email, notas). Submit → `POST /public/website/bookings` → crea evento en `atlas.calendar` con status `pending`.

### Bloques de navegación extendidos

**`AtlasNavbarBlock`** — extiende `NavbarBlock` con props: `showCartIcon` (ecommerce), `showLoginLink` (link `/acceso`), `logoAssetId`.

**`AtlasFooterBlock`** — extiende `FooterBlock` con prop `showLoginLink`.

---

## Sección 6: Renderer público

**Archivo:** `apps/desktop/src/website/WebsitePageRenderer.jsx` (reescrito)

```jsx
import { AtlasWebBuilderProvider, AtlasWebRenderer, baseBlocks, defineTheme, defaultTheme } from '@raulbellosom/atlas-web-builder'
import { atlasBlocks } from './atlasBlocks/index.js'

export function WebsitePageRenderer({ page, theme, siteType }) {
  const resolvedTheme = theme
    ? defineTheme({ ...defaultTheme, tokens: { ...defaultTheme.tokens, ...theme.tokens } })
    : defaultTheme

  const blocks = [...baseBlocks, ...atlasBlocks]

  if (!page?.publishedBuilderData) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-gray-400">Esta pagina no tiene contenido publicado aun.</p></div>
  }

  return (
    <AtlasWebBuilderProvider blocks={blocks} theme={resolvedTheme}>
      <AtlasWebRenderer page={parsePage(page.publishedBuilderData)} mode="public" />
    </AtlasWebBuilderProvider>
  )
}
```

`PublicWebsiteEntry.jsx` ya existe y llama a `WebsitePageRenderer` — solo cambia la implementación interna del renderer.

---

## Sección 7: Blog

**Modelo AME3:** `website_page` añade campos `excerpt` (text) y `cover_asset_id` (uuid). El campo `page_type` ya existe. Los posts tienen `page_type = 'blog_post'`.

**Pantalla `WebsiteBlogScreen.jsx`:**
- Tabla de posts (título, extracto, estado, fecha actualización)
- Botón "Nuevo post" → crea página con `page_type = 'blog_post'` y template inicial JSON predefinido (HeadingBlock + ImageBlock + RichTextBlock) → abre editor
- El mismo `WebsitePageEditorScreen.jsx` se usa para editar posts

**Endpoint público:** `GET /public/website/blog?siteId=&limit=&offset=` — devuelve páginas `page_type = 'blog_post'`, `status = 'published'`, ordenadas por `updated_at` DESC. Lo consume `BlogIndexBlock`.

**Ruta pública:** Posts se sirven vía `GET /public/website/resolve?path=/blog/:slug`.

---

## Sección 8: Formularios

**Modelos AME3 nuevos:**

`website_form` — id, site_id, name, fields (JSONB: array de `{name, label, type, required}`), notification_email, enabled

`website_form_submission` — id, form_id, data (JSONB), read (bool, default false), created_at

**Pantalla `WebsiteFormsScreen.jsx`:**
- Lista de formularios con nombre, número de submissions no leídas
- Crear/editar formulario: nombre, campos configurables, email de notificación
- Al seleccionar un formulario → panel lateral de submissions con tabla (fecha, datos, toggle leído)

**Endpoint público:** `POST /public/website/forms/:formId/submit` → valida campos → inserta en `website_form_submission` → si SMTP configurado, envía email via `createSmtpService` al `notification_email` del formulario.

---

## Sección 9: Stripe en `atlas.website`

**Campos en `website_site`:** `stripe_publishable_key` (text), `stripe_secret_key` (text, encriptado con AES + JWT_SECRET), `stripe_currency` (text, default 'usd'), `stripe_success_message` (text).

**Pantalla `WebsitePaymentsScreen.jsx`** (solo visible cuando `site_type = 'ecommerce'`):
- Formulario con los 4 campos
- Secret key se muestra como `••••••••` tras guardar
- Botón "Verificar conexión" → `POST /website/payments/verify` → el API hace una llamada simple a Stripe API y devuelve ok/error

**Flujo de checkout:**
1. `CartBlock` acumula items en `localStorage`
2. Al pagar → `POST /public/website/checkout` con `{ items: [{productId, qty}] }` + header `X-Site-Id`
3. El API valida productos contra `atlas.catalog`, crea Stripe Checkout Session con `stripe_secret_key`
4. Devuelve `{ url: 'https://checkout.stripe.com/...' }` → browser redirige
5. Stripe redirige a `/gracias?session_id=...` o `/error`
6. Webhook `POST /public/website/stripe/webhook` → confirma pago → decrementa stock si `track_stock = true`

---

## Sección 10: Módulo `atlas.catalog`

> Spec hijo detallado: `docs/superpowers/specs/2026-05-30-atlas-catalog-design.md`

**Modelos AME3:**
- `catalog_category` — id, name, slug, description, enabled
- `catalog_product` — id, name, slug, description, price, compare_price, currency, stock, track_stock, cover_asset_id, images (JSONB), category_id, enabled, published

**API privada (autenticada):**
- `GET /catalog/products` — lista con filtros `categoryId`, `search`, paginación
- `GET /catalog/categories`
- `POST|PATCH|DELETE /catalog/products/:id`
- `POST|PATCH|DELETE /catalog/categories/:id`

**API pública (sin auth):**
- `GET /public/catalog/products?categoryId=&limit=&siteId=` — solo `published = true`
- `GET /public/catalog/categories`

**Navegación del módulo:**
- Productos `/app/m/atlas.catalog`
- Categorías `/app/m/atlas.catalog/categories`

**Dependencia en atlas.website:** `atlas.website` verifica `GET /modules/atlas.catalog` en runtime. Si está instalado y enabled, incluye los bloques ecommerce en el editor.

---

## Sección 11: Platform Settings — SMTP

> Spec hijo detallado: `docs/superpowers/specs/2026-05-30-platform-settings-smtp-design.md`

**Ruta:** `/app/settings/integrations/smtp` — nueva área en el shell del ERP.

**Permiso:** `platform.settings.manage` — solo admins del sistema.

**Persistencia en `InstanceConfig`:**
| Key | Descripción |
|---|---|
| `smtp.host` | Servidor SMTP |
| `smtp.port` | Puerto (465 / 587) |
| `smtp.user` | Usuario |
| `smtp.pass` | Contraseña (AES encriptada) |
| `smtp.from_name` | Nombre del remitente |
| `smtp.from_email` | Email del remitente |
| `smtp.tls` | Boolean |

**Servicio compartido:** `apps/api/src/services/smtp-service.js` — `createSmtpService({ prisma })`. Lee las claves de `InstanceConfig`, construye un transporter de `nodemailer`. Cualquier módulo lo importa.

**Endpoint de prueba:** `POST /settings/smtp/test` — envía un email de prueba al email del usuario logueado.

---

## Sección 12: Navegación final del módulo `atlas.website`

```js
navigation: [
  { label: 'Sitio web',    path: '/app/m/atlas.website',              icon: 'Globe',        permissionKey: 'website.access' },
  { label: 'Paginas',      path: '/app/m/atlas.website/pages',        icon: 'FileText',     permissionKey: 'website.pages.read' },
  { label: 'Plantillas',   path: '/app/m/atlas.website/templates',    icon: 'LayoutTemplate', permissionKey: 'website.pages.create' },
  { label: 'Blog',         path: '/app/m/atlas.website/blog',         icon: 'BookOpen',     permissionKey: 'website.pages.read' },
  { label: 'Formularios',  path: '/app/m/atlas.website/forms',        icon: 'FormInput',    permissionKey: 'website.pages.read' },
  { label: 'Tema',         path: '/app/m/atlas.website/theme',        icon: 'Palette',      permissionKey: 'website.theme.read' },
  { label: 'Pagos',        path: '/app/m/atlas.website/payments',     icon: 'CreditCard',   permissionKey: 'website.site.update', condition: 'site_type=ecommerce' },
]
```

La entrada "Menús" se elimina. La gestión de navegación se hace directamente desde los bloques `AtlasNavbarBlock` y `AtlasFooterBlock` en el editor visual.

Los modelos AME3 `website_menu` y `website_menu_item` también se eliminan — no forman parte del nuevo diseño. El endpoint `GET /public/website/resolve` ya no devuelve `menus` en su respuesta.

**Entrada "Pagos" condicional:** El manifest de navegación es estático — la entrada "Pagos" aparece siempre en la barra lateral. La condición se evalúa client-side: `WebsitePaymentsScreen.jsx` comprueba `site.site_type` al montar y redirige a `/app/m/atlas.website` si no es `'ecommerce'`.

---

## Sección 13: Modelos AME3 de `atlas.website`

### `website_site`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | uuidv7() |
| company_id | uuid | FK |
| name | text | |
| domain | text | nullable |
| logo_asset_id | uuid | nullable |
| site_type | text | 'informational' \| 'ecommerce' \| 'bookings' |
| status | text | 'draft' \| 'published' |
| stripe_publishable_key | text | nullable |
| stripe_secret_key | text | nullable, encriptado |
| stripe_currency | text | default 'usd' |
| stripe_success_message | text | nullable |
| booking_calendar_id | uuid | nullable, FK a calendar |
| enabled | bool | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `website_theme`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | uuidv7() |
| site_id | uuid | FK |
| company_id | uuid | FK |
| tokens | jsonb | tokens CSS del builder (`defineTheme`) |
| typography | text | nombre de fuente seleccionada |
| enabled | bool | default true |

### `website_page`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | uuidv7() |
| site_id | uuid | FK |
| company_id | uuid | FK |
| title | text | |
| slug | text | ruta pública ej. `/contacto` |
| page_type | text | 'page' \| 'blog_post' |
| excerpt | text | nullable, solo blog_post |
| cover_asset_id | uuid | nullable, solo blog_post |
| status | text | 'draft' \| 'published' \| 'archived' |
| draft_builder_data | jsonb | objeto `Page` de atlas-web-builder |
| published_builder_data | jsonb | snapshot publicado |
| seo | jsonb | `{title, description, canonical, ogImageAssetId}` |
| enabled | bool | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `website_form`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | uuidv7() |
| site_id | uuid | FK |
| company_id | uuid | FK |
| name | text | |
| fields | jsonb | array de `{name, label, type, required}` |
| notification_email | text | nullable |
| enabled | bool | default true |

### `website_form_submission`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | uuidv7() |
| form_id | uuid | FK |
| company_id | uuid | FK |
| data | jsonb | campos enviados |
| read | bool | default false |
| created_at | timestamptz | |

---

## Sección 14: Templates v2

Los templates se reescriben como objetos `Page` JSON de `atlas-web-builder`. Se mantienen las mismas 10 categorías pero el formato es:

```js
export const templateRestaurante = {
  pages: [
    {
      id: 'home',
      label: 'Inicio',
      routePath: '/',
      required: true,
      page: {
        schemaVersion: 1,
        id: 'page_home',
        slug: '/',
        title: 'Inicio',
        visibility: 'public',
        regions: { main: { id: 'region_main', children: ['blk_hero', 'blk_menu', 'blk_cta'] } },
        blocks: {
          blk_hero: { id: 'blk_hero', type: 'HeroBlock', props: { title: 'Bienvenidos', variant: 'centered' }, children: {} },
          // ...
        },
        seo: { title: 'Inicio', description: '', canonical: null, ogImageAssetId: null },
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
    },
    // más páginas...
  ],
  id: 'restaurante',
  label: 'Restaurante',
  category: 'hosteleria',
  color: '#92400e',
  description: 'Sitio para restaurantes con menú, galería y reservas.',
}
```

---

## Sección 15: Archivos creados / modificados

### Eliminar

```
apps/desktop/src/website/atlasBlocks/
apps/desktop/src/website/atlasGrapesConfig.js
apps/desktop/src/website/atlasBlocksBaseCSS.js
apps/desktop/src/website/WebsiteGrapesEditor.jsx
apps/desktop/src/website/WebsiteInlineEditor.jsx
apps/desktop/src/website/WebsiteEditBar.jsx
apps/desktop/src/website/atlasTemplates/
docs/superpowers/plans/2026-05-28-atlas-website-foundation.md
docs/superpowers/plans/2026-05-28-atlas-website-module.md
docs/superpowers/specs/2026-05-30-website-templates-multipage-client-login-design.md
docs/superpowers/plans/2026-05-30-website-templates-multipage-A.md
docs/superpowers/plans/2026-05-30-website-templates-multipage-B.md
```

### Crear

```
apps/desktop/src/website/atlasBlocks/contactFormBlock.js
apps/desktop/src/website/atlasBlocks/blogIndexBlock.js
apps/desktop/src/website/atlasBlocks/productsGridBlock.js
apps/desktop/src/website/atlasBlocks/productCardBlock.js
apps/desktop/src/website/atlasBlocks/cartBlock.js
apps/desktop/src/website/atlasBlocks/bookingFormBlock.js
apps/desktop/src/website/atlasBlocks/atlasNavbarBlock.js
apps/desktop/src/website/atlasBlocks/atlasFooterBlock.js
apps/desktop/src/website/atlasBlocks/index.js
apps/desktop/src/website/atlasTemplates/templateRestaurante.js   (formato Page JSON)
apps/desktop/src/website/atlasTemplates/templateSpa.js
apps/desktop/src/website/atlasTemplates/templateAgencia.js
apps/desktop/src/website/atlasTemplates/templateNegocio.js
apps/desktop/src/website/atlasTemplates/templateServicios.js
apps/desktop/src/website/atlasTemplates/templateEcommerce.js
apps/desktop/src/website/atlasTemplates/templateClinica.js
apps/desktop/src/website/atlasTemplates/templatePortfolio.js
apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js
apps/desktop/src/website/atlasTemplates/index.js
apps/desktop/src/modules/atlas.website/screens/WebsiteSiteWizard.jsx
apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx
apps/api/src/services/smtp-service.js
apps/api/src/routes/website/forms-routes.js         (reescribir)
apps/api/src/routes/public-website.js               (añadir: /bookings, /checkout, /stripe/webhook, /blog)
docs/superpowers/specs/2026-05-30-atlas-catalog-design.md        (spec hijo)
docs/superpowers/specs/2026-05-30-platform-settings-smtp-design.md (spec hijo)
```

### Modificar

```
apps/desktop/src/website/WebsitePageRenderer.jsx     (reescribir con AtlasWebRenderer)
apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx  (reescribir con AtlasWebBuilderEditor)
apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx    (reemplazar con wizard)
apps/desktop/src/modules/atlas.website/screens/WebsiteThemeScreen.jsx       (reescribir con defineTheme)
apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx       (ajustar picker de templates)
apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx        (ajustar para page_type)
apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx       (añadir submissions panel)
apps/api/src/manifests/official/feature-modules.js  (actualizar navegación, añadir Pagos condicional)
apps/desktop/package.json                            (añadir @raulbellosom/atlas-web-builder)
```

---

## Sección 16: Specs hijos pendientes

Antes de iniciar la implementación se deben escribir:

1. **`docs/superpowers/specs/2026-05-30-atlas-catalog-design.md`** — diseño detallado del módulo `atlas.catalog`: modelos AME3, API completa, pantallas admin, permisos, blueprints.

2. **`docs/superpowers/specs/2026-05-30-platform-settings-smtp-design.md`** — diseño de la nueva área de configuración: ruta en el shell, permiso `platform.settings.manage`, pantalla SMTP, `smtp-service.js`, endpoint de prueba.

---

## Notas de implementación

- **Tamaño de archivos:** `WebsitePageEditorScreen.jsx` y `WebsiteSiteWizard.jsx` deben mantenerse bajo 800 líneas. Si el wizard crece, extraer cada paso a un componente propio en `screens/wizard/`.
- **Encriptación de Stripe secret key y SMTP password:** usar AES-256-GCM con `JWT_SECRET` como clave derivada (pbkdf2). Nunca loguear ni exponer en responses.
- **Stripe secret key:** nunca incluir en `GET /website/site` público ni en el resolve endpoint. Solo se usa server-side.
- **`parsePage` en renderer:** si los datos en DB son de GrapesJS (objeto inválido para el builder), `parsePage` lanzará un error — el renderer lo captura y muestra la pantalla "sin contenido publicado".
- **Orden de implementación sugerido:**
  1. Spec hijo `atlas.catalog` → plan → implementar
  2. Spec hijo platform-settings/SMTP → plan → implementar
  3. Plan A de `atlas.website`: migración + builder + wizard + editor + renderer + templates
  4. Plan B de `atlas.website`: blog + formularios + Stripe + bloques dinámicos
