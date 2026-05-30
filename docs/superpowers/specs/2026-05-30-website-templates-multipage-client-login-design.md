# Atlas Website — Templates Multi-página y Login de Clientes

**Fecha:** 2026-05-30  
**Estado:** Aprobado para implementación  
**Módulo:** `atlas.website`  
**Prerequisito:** Plans A y B de `atlas.website` implementados (GrapesJS operativo, 6 templates existentes, admin screens del módulo en `modules/official/atlas.website/components/`)

---

## Resumen

Ampliar el módulo `atlas.website` con tres capacidades nuevas:

1. **Templates multi-página** — Cada template define un catálogo de páginas opcionales (Inicio, Menú, Contacto, etc.). Al aplicar un template, el usuario elige qué páginas activar al estilo Odoo.
2. **Catálogo de 12 templates** — Migrar los 6 existentes a multi-página y añadir 6 nuevos de distintas industrias.
3. **Login de clientes públicos** — Ruta `/acceso` separada del ERP, con redirect inteligente por rol post-login.

---

## Sección 1: Formato de template multi-página

### Estructura de datos del template

Todos los archivos en `apps/desktop/src/website/atlasTemplates/` adoptan el nuevo formato:

```js
export const templateEjemplo = {
  id: 'ejemplo',
  label: 'Nombre visible',
  category: 'categoria',   // hosteleria | negocios | salud | creativo | comercio | educacion | social
  color: '#hexcolor',
  description: 'Descripción corta para el picker.',
  pages: [
    {
      id: 'home',
      label: 'Inicio',
      routePath: '/',
      title: 'Inicio',
      required: true,        // no se puede desmarcar en el picker
      html: `...`,
      css: `...`,
    },
    {
      id: 'contacto',
      label: 'Contacto',
      routePath: '/contacto',
      title: 'Contacto',
      required: false,       // el usuario puede desmarcar
      html: `...`,
      css: `...`,
    },
    // ... más páginas
  ],
}
```

### Reglas de migración de templates existentes

- El `html` y `css` actuales de cada template se convierten en la página `home` (`required: true`, `routePath: '/'`).
- Se añaden las páginas extra relevantes para cada industria (ver catálogo).
- Los campos `id`, `label`, `description`, `color` se conservan. Se añade `category`.
- El campo `html`/`css` raíz desaparece; todo queda dentro de `pages[]`.

### Navbar y login en templates

Cada página de cada template incluye en su navbar un link "Iniciar sesión" que apunta a `/acceso`. Este link es parte del HTML del bloque nav y el usuario puede editarlo o eliminarlo libremente en el editor GrapesJS.

---

## Sección 2: Catálogo de 12 templates

| # | ID | Label | Categoría | Color | Páginas |
|---|-----|-------|-----------|-------|---------|
| 1 | `restaurante` | Restaurante | hosteleria | `#92400e` | Inicio · Menú · Galería · Reservas · Contacto |
| 2 | `spa` | Spa & Wellness | bienestar | `#6b21a8` | Inicio · Servicios · Tratamientos · Precios · Contacto |
| 3 | `agencia` | Agencia Digital | tecnologia | `#1e40af` | Inicio · Servicios · Portafolio · Equipo · Contacto |
| 4 | `ecommerce` | Tienda Online | comercio | `#166534` | Inicio · Productos · Sobre nosotros · Contacto |
| 5 | `servicios` | Servicios Profesionales | negocios | `#7c3aed` | Inicio · Servicios · Precios · Clientes · Contacto |
| 6 | `negocio` | Negocio General | negocios | `#374151` | Inicio · Servicios · Nosotros · Contacto |
| 7 | `clinica` | Clínica / Salud | salud | `#0e7490` | Inicio · Especialidades · Equipo médico · Citas · Contacto |
| 8 | `portfolio` | Portfolio Creativo | creativo | `#be185d` | Inicio · Portafolio · Sobre mí · Servicios · Contacto |
| 9 | `inmobiliaria` | Inmobiliaria | comercio | `#78350f` | Inicio · Propiedades · Nosotros · Blog · Contacto |
| 10 | `blog` | Blog / Noticias | medios | `#1e293b` | Inicio · Artículos · Categorías · Sobre nosotros · Contacto |
| 11 | `ong` | ONG / Fundación | social | `#065f46` | Inicio · Misión · Proyectos · Voluntarios · Donaciones · Contacto |
| 12 | `educacion` | Educación / Academia | educacion | `#1d4ed8` | Inicio · Cursos · Instructores · Testimonios · Contacto |

**Archivos:**
- `apps/desktop/src/website/atlasTemplates/templateRestaurante.js` — migrar + páginas extra
- `apps/desktop/src/website/atlasTemplates/templateSpa.js` — migrar + páginas extra
- `apps/desktop/src/website/atlasTemplates/templateAgencia.js` — migrar + páginas extra
- `apps/desktop/src/website/atlasTemplates/templateEcommerce.js` — migrar + páginas extra
- `apps/desktop/src/website/atlasTemplates/templateServicios.js` — migrar + páginas extra
- `apps/desktop/src/website/atlasTemplates/templateNegocio.js` — migrar + páginas extra
- `apps/desktop/src/website/atlasTemplates/templateClinica.js` — nuevo
- `apps/desktop/src/website/atlasTemplates/templatePortfolio.js` — nuevo
- `apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js` — nuevo
- `apps/desktop/src/website/atlasTemplates/templateBlog.js` — nuevo
- `apps/desktop/src/website/atlasTemplates/templateOng.js` — nuevo
- `apps/desktop/src/website/atlasTemplates/templateEducacion.js` — nuevo
- `apps/desktop/src/website/atlasTemplates/index.js` — actualizar exports

### Calidad de los templates

Cada página de cada template debe incluir:

- **Navbar** consistente con el estilo visual del template + link "Iniciar sesión" → `/acceso`
- **Al menos 3 secciones de contenido** relevantes para esa página y ese tema
- **Footer** con datos de contacto placeholder, links de navegación y copyright
- Responsive: funcional en desktop y mobile (media queries inline)
- Placeholders con `placehold.co` para imágenes, textos en español

---

## Sección 3: Flujo de aplicación — picker de 2 pasos

### Paso 1: Elegir template (igual al actual)

Grid de cards filtrable por categoría. Cada card muestra: franja de color, nombre, descripción, badges con los nombres de las páginas disponibles.

### Paso 2: Seleccionar páginas (nuevo)

Aparece al confirmar la elección del template.

```
Template: "Restaurante"

Selecciona las páginas que deseas crear:

  [✓]  Inicio        /          (requerida)
  [✓]  Menú          /menu
  [✓]  Galería       /galeria
  [ ]  Reservas      /reservas
  [✓]  Contacto      /contacto

  ← Cambiar template         [Crear 4 páginas →]
```

**Comportamiento:**
- Páginas `required: true` aparecen marcadas y el checkbox está deshabilitado.
- Todas las demás inician marcadas; el usuario desmarca las que no quiere.
- El botón de acción muestra el conteo: "Crear N páginas".
- Si el sitio ya tiene páginas con la misma `routePath`, se muestra una alerta antes de confirmar: _"Las páginas con rutas existentes serán reemplazadas. Las rutas nuevas se crearán. ¿Continuar?"_

**Al confirmar:**
1. Para cada página seleccionada:
   - Si la ruta ya existe en el sitio → `PATCH /website/pages/:id` para actualizar `draft_builder_data` y `seo` + titulo
   - Si la ruta no existe → `POST /website/pages` para crearla
2. Se carga la página `home` en el editor GrapesJS activo.
3. Se invalida el query `['website-pages', siteId]` de TanStack Query.

### Puntos de acceso al picker

1. **Botón "Plantillas"** ya existente en la barra del editor GrapesJS (`WebsiteGrapesEditor.jsx`)
2. **Pantalla "Plantillas"** nueva en el admin (`WebsiteTemplatesScreen.jsx`)
3. **Botón "Empezar desde plantilla"** en `WebsitePagesScreen.jsx` cuando el sitio no tiene páginas

---

## Sección 4: Pantalla "Plantillas" en el admin del módulo

### Archivo

`modules/official/atlas.website/components/WebsiteTemplatesScreen.jsx`

### UI

- Header: "Plantillas" + descripción
- **Chips de categoría** horizontales: Todos · Hostelería · Negocios · Salud · Creativo · Comercio · Educación · Social · Medios
- **Grid de cards** (misma composición visual que el picker): franja de color, nombre, categoría, descripción, lista de páginas como badges, botón "Aplicar plantilla" / "Cambiar plantilla"
- Al hacer clic en "Aplicar plantilla" se abre el `TemplatePickerModal` directamente en el **Paso 2** (con el template ya preseleccionado)

### Modificaciones al manifest

En `modules/official/atlas.website/module.manifest.js`, añadir entrada de navegación:

```js
{
  label: 'Plantillas',
  path: '/app/m/atlas.website/templates',
  icon: 'LayoutTemplate',
  layout: 'main',
  permissionKey: 'website.pages.create',
},
```

Posición: entre "Páginas" y "Tema".

### Modificaciones al ModuleOutlet / screen map

En `apps/desktop/src/app/ModuleOutlet.jsx` (o donde se resuelven los screens del módulo website), añadir:

```js
'atlas.website/templates': () => import('.../.../WebsiteTemplatesScreen.jsx')
```

---

## Sección 5: Login de clientes públicos (`/acceso`)

### Ruta nueva

En `apps/desktop/src/main.jsx`, añadir junto a `/login` y `/setup`:

```jsx
<Route path="/acceso" element={<PublicClientLogin />} />
```

Sin ningún guard de autenticación. Si el usuario ya tiene sesión activa, redirige inmediatamente según su rol.

### Componente

`apps/desktop/src/shell/PublicClientLogin.jsx`

**UI:**
- Página sin el shell del ERP (`AppShell`)
- Logo / nombre del sitio (obtenido de `GET /public/website/resolve?path=/`, campo `site.name`)
- Formulario: campo email + contraseña + botón "Entrar"
- Link "Volver al sitio" → `/`
- Sin opción de registro (solo autenticación de usuarios Supabase existentes)
- Mensajes de error en español: "Correo o contraseña incorrectos", "Ocurrió un error, intenta de nuevo"

**Lógica post-login:**

```
1. signInWithPassword({ email, password }) via Supabase client
2. Si error → mostrar mensaje de error
3. Si éxito → GET /public/website/auth-check  (header: Authorization: Bearer <token>)
4. Según respuesta:
   { canAccessErp: true }  → navigate('/app', { replace: true })
   { canAccessErp: false } → navigate('/', { replace: true })
```

### Endpoint nuevo: `GET /public/website/auth-check`

Añadir al router en `apps/api/src/routes/public-website.js`:

```
GET /public/website/auth-check
Header: Authorization: Bearer <supabase_jwt>
```

**Lógica del endpoint:**
1. Extraer el JWT del header `Authorization: Bearer <token>` directamente (no pasa por el `authMiddleware` global — el router público es no-autenticado por defecto). Verificar el JWT contra `SUPABASE_JWT_SECRET` con `jose` o `jsonwebtoken` (ya en uso en el proyecto).
2. Buscar el `UserProfile` + `Membership` del usuario
3. Si el usuario tiene algún `RolePermission` con `permissionKey` que empiece con `atlas.` (es decir, cualquier permiso del ERP) → `{ canAccessErp: true }`
4. Si el usuario no tiene membresía activa o solo tiene permisos de `website.client.*` → `{ canAccessErp: false }`
5. Si el JWT es inválido o expirado → `401`

**Razón de esta regla:** cualquier usuario con permisos ERP es staff/admin. Los clientes del sitio son usuarios de Supabase sin rol de ERP asignado.

### Navbar del sitio público — estado de sesión

Los templates incluyen en el nav un link `<a href="/acceso">Iniciar sesión</a>`. Este es HTML estático editable en GrapesJS. No hay lógica dinámica de "ya está logueado" en el renderer público, ya que el renderer de GrapesJS sirve HTML estático. El usuario puede reemplazar ese link manualmente si quiere un comportamiento diferente.

---

## Archivos creados / modificados

### Crear

| Archivo | Descripción |
|---------|-------------|
| `apps/desktop/src/website/atlasTemplates/templateClinica.js` | Template nuevo |
| `apps/desktop/src/website/atlasTemplates/templatePortfolio.js` | Template nuevo |
| `apps/desktop/src/website/atlasTemplates/templateInmobiliaria.js` | Template nuevo |
| `apps/desktop/src/website/atlasTemplates/templateBlog.js` | Template nuevo |
| `apps/desktop/src/website/atlasTemplates/templateOng.js` | Template nuevo |
| `apps/desktop/src/website/atlasTemplates/templateEducacion.js` | Template nuevo |
| `apps/desktop/src/shell/PublicClientLogin.jsx` | Login de clientes públicos |
| `modules/official/atlas.website/components/WebsiteTemplatesScreen.jsx` | Pantalla admin de plantillas |

### Modificar

| Archivo | Cambio |
|---------|--------|
| `apps/desktop/src/website/atlasTemplates/templateRestaurante.js` | Migrar a formato multi-página + páginas extra |
| `apps/desktop/src/website/atlasTemplates/templateSpa.js` | Migrar a formato multi-página + páginas extra |
| `apps/desktop/src/website/atlasTemplates/templateAgencia.js` | Migrar a formato multi-página + páginas extra |
| `apps/desktop/src/website/atlasTemplates/templateEcommerce.js` | Migrar a formato multi-página + páginas extra |
| `apps/desktop/src/website/atlasTemplates/templateServicios.js` | Migrar a formato multi-página + páginas extra |
| `apps/desktop/src/website/atlasTemplates/templateNegocio.js` | Migrar a formato multi-página + páginas extra |
| `apps/desktop/src/website/atlasTemplates/index.js` | Añadir 6 nuevos exports |
| `apps/desktop/src/website/WebsiteGrapesEditor.jsx` | Picker de 2 pasos + extracción de `TemplatePickerModal` a archivo propio |
| `apps/desktop/src/main.jsx` | Añadir ruta `/acceso` |
| `apps/api/src/routes/public-website.js` | Añadir endpoint `GET /auth-check` |
| `modules/official/atlas.website/module.manifest.js` | Añadir nav entry "Plantillas" |
| `modules/official/atlas.website/components/WebsitePagesScreen.jsx` | Botón "Empezar desde plantilla" cuando no hay páginas |

---

## Notas de implementación

- **Límite de tamaño:** `WebsiteGrapesEditor.jsx` puede acercarse a 800 líneas. Extraer `TemplatePickerModal` a `apps/desktop/src/website/TemplatePickerModal.jsx` como parte de esta tarea.
- **No se crean tablas nuevas en DB.** Los templates son datos estáticos en JS; las páginas creadas usan el modelo `website_page` ya existente.
- **Split del plan:** Por el volumen de trabajo (12 templates × N páginas + lógica + login), el plan de implementación se debe dividir en Plan A (templates + picker) y Plan B (pantalla admin + login de clientes).
- **Todo el texto UI en español**, código y comentarios en inglés.
- **UUID v7:** las páginas creadas por el picker usan `INSERT ... RETURNING *` — la DB genera el ID.
