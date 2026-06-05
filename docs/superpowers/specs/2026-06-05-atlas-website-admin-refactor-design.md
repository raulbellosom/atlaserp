# Atlas Website — Admin Panel Refactor Design

**Date:** 2026-06-05
**Status:** Approved
**Scope:** Phase 1 — Admin panel only. Public blocks (atlasBlocks/) deferred to Phase 2.

---

## 1. Problem Statement

The `atlas.website` admin module has four concrete issues:

1. **Dark mode broken** — Components use hardcoded hex colors and non-semantic Tailwind tokens, making them invisible on dark backgrounds (e.g., Configuracion screen shows dark cards on dark background).
2. **Low component quality** — Screens bypass `@atlas/ui` and use raw `div` wrappers, native `<select>`, and hand-rolled patterns instead of the shared component library.
3. **Wasted screen real estate** — Layouts apply `max-w-2xl` / `max-w-4xl` globally, leaving large gaps on laptop and monitor-size displays.
4. **Missing site lifecycle model** — No draft/publish states, no sandbox preview, wizard has missing fields (URL, giro), and the "no website" concept is unclear.

---

## 2. Information Architecture

### Current nav (8 flat items)
`Sitio web | Páginas | Plantillas | Blog | Formularios | Tema | Pagos | Configuracion`

### New nav (grouped)
```
Sitio web              ← overview / dashboard hub
─── Contenido
    Páginas
    Blog
─── Diseño
    Tema
    Plantillas
─── Negocio
    Formularios
    Pagos
─── Configuracion
```

Nav groups use `AppShell` separator support already available in `@atlas/ui`. No new nav primitives needed.

**Plantillas** remains a full view (not a modal) because it will grow into a large template stock with individual detail/preview pages.

**Conditional nav visibility** based on site mode post-wizard:

| Mode | Visible sections |
|---|---|
| Web Builder | All groups |
| ZIP / Pre-render | Overview + Configuracion only |
| Draft (no publish intent) | All groups (Web Builder mode) |

---

## 3. Site Lifecycle Model

Sites have two states: `DRAFT` and `PUBLISHED`. There is no "no website" option that disables the module — instead, users who do not want a public site simply stay in `DRAFT` indefinitely.

```
WIZARD COMPLETE
      │
      ▼
   DRAFT ──── "Publicar" button ────► PUBLISHED
      ▲                                    │
      └──────── "Despublicar" ─────────────┘
```

**Build status** (independent of DRAFT/PUBLISHED):
- `idle` — no build triggered
- `building` — dist being generated
- `ready` — last build succeeded, preview available
- `error` — last build failed, error message shown

---

## 4. Setup Wizard

The wizard renders in a **full-screen layout** (no AppShell, no sidebar). All steps are mandatory and sequential. No skip buttons.

### Step 1 — Modo de construcción
Two options:

- **Web Builder** → proceeds to steps 2–5
- **ZIP / Pre-render** → proceeds to steps 2 (site info) only, then done

### Step 2 — Información del sitio *(both modes)*
Fields:
- Nombre del sitio (text)
- URL / dominio destino (text, validated format)
- Giro / sector (CreatableComboboxField — predefined categories + custom)
- Descripción corta (textarea, optional)

### Step 3 — Tipo de sitio *(Web Builder only)*
Existing options (Informativo, Tienda online, Reservaciones, etc.) refactored with `@atlas/ui Card` components. Each card shows icon, title, description, feature badge list.

### Step 4 — Identidad *(Web Builder only)*
Logo upload, primary color picker, secondary color. Refactored with `@atlas/ui` fields.

### Step 5 — Plantilla *(Web Builder only)*
Grid of available templates (reuses the same component grid as the Plantillas view). User must select one to proceed.

### Wizard component split
`WebsiteSiteWizard.jsx` (825 lines, exceeds soft limit) is split into:
- `WebsiteWizard.jsx` — orchestrator, step state, navigation logic (~150 lines)
- `WizardStepMode.jsx` — step 1
- `WizardStepInfo.jsx` — step 2
- `WizardStepType.jsx` — step 3
- `WizardStepIdentity.jsx` — step 4
- `WizardStepTemplate.jsx` — step 5

---

## 5. Screen Designs

### 5.1 Overview (hub)
Two-column layout (no artificial max-width):
- **Left column**: site status badge (`DRAFT`/`PUBLISHED`), build status badge, site URL, mode (Web Builder / ZIP). Primary actions: "Ver preview" (opens pre-render in new tab), "Publicar" / "Despublicar".
- **Right column**: quick-stat cards — total pages, blog posts, forms, last deploy timestamp.

If no site exists (`websiteStatus === null`), the wizard renders in place of the dashboard — full layout, no sidebar.

### 5.2 Páginas
- `PageHeader` + "Nueva página" button.
- Full-width card grid: 3 cols on laptop, 4 cols on wide monitor.
- Each card: page title, slug, status badge (Publicada/Borrador), last modified date.
- Click → existing `WebsitePageEditorScreen` (refactored).
- No global `max-w` wrapper on the grid container.

### 5.3 Plantillas
- `PageHeader` + optional "Subir plantilla" button (future).
- Full-width grid: 3–4 cols. Cards show: thumbnail (aspect-video), name, page count, category badge, "Previsualizar" button.
- Click on card → **Template detail page**: full-width iframe preview of the template, metadata sidebar (description, pages included, category), "Usar esta plantilla" button.
- "Usar esta plantilla" → `ConfirmDialog` if pages already exist ("Esto reemplazará las páginas actuales").

### 5.4 Blog
- `PageHeader` + "Nuevo post" button.
- `AtlasTable` with columns: Título, Estado, Fecha, Autor. Sortable.
- Click row → `WebsiteBlogPostEditorScreen` (refactored).

### 5.5 Formularios
- `PageHeader` with two tabs: "Formularios" / "Respuestas".
- Formularios tab: list with search. Click → Sheet with form builder (`FormFieldBuilder` refactored inside).
- Respuestas tab: `AtlasTable` of submissions filterable by form.

### 5.6 Tema
- Two-panel layout: left config (colors via `ThemeColorEditor`, typography via `ThemeTypographyEditor`), right live preview panel.
- "Cambiar plantilla" button navigates to Plantillas view in selection mode.
- Save changes button → triggers rebuild if in Web Builder mode.

### 5.7 Pagos
- `PageHeader`.
- Gateway cards (Stripe, etc.) with connected/disconnected status badge.
- Click card → Sheet with gateway-specific config fields.

### 5.8 Configuracion
- `PageHeader` + tabs: "Fuente del sitio" / "Correo electrónico".
- **Default state**: when no site exists, both tabs render an `EmptyState` with message "Completa el asistente de configuración para activar estas opciones."
- **ZIP mode**: "Fuente del sitio" tab active and populated; "Correo electrónico" tab active.
- **Web Builder mode**: both tabs active.
- Zero hardcoded colors. All cards use `bg-card dark:bg-card border border-border`.
- `WebsiteSourceSelector` component refactored to use `@atlas/ui Card` with radio-like selection state.

---

## 6. Component Standards (all screens)

### Dark mode
- No hex color values in className strings.
- Use semantic pairs: `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-card-foreground`, `text-muted-foreground`.
- Where explicit light/dark needed: `bg-white dark:bg-zinc-900`, `text-gray-900 dark:text-gray-100`.

### Width
- Outer layout wrapper: `w-full` — no `max-w` at the page container level.
- Form/config screens: `max-w-3xl` applied only to the inner form area, not the page wrapper.
- Grid screens (Páginas, Plantillas, Blog cards): `grid grid-cols-3 xl:grid-cols-4 gap-4`.

### Mandatory `@atlas/ui` usage
| Element | Component |
|---|---|
| Select inputs | `SelectField` or `CreatableComboboxField` |
| Option cards (wizard) | `@atlas/ui Card` with focus ring |
| Destructive confirmations | `ConfirmDialog` |
| Empty states | `EmptyState` |
| Error states | `ErrorState` |
| Screen headers | `PageHeader` |
| Tables | `AtlasTable` |
| Side panels | `Sheet` |
| Forms | React Hook Form + `@atlas/ui` field components |

### File size
No file in the admin screens directory may exceed 500 lines after refactor (well below the 800-line soft limit). The wizard split detailed in §4 is mandatory.

---

## 7. Out of Scope (Phase 1)

- Public block components (`apps/desktop/src/website/atlasBlocks/`) — Phase 2.
- `PublicWebsiteEntry.jsx` split — Phase 2 (currently 926 lines; flagged but deferred).
- New block types or template creation UI.
- Payment gateway integrations beyond UI refactor.
- Backend API changes (the refactor is purely frontend; existing API contracts are preserved).

---

## 8. Files Affected

**Modified (refactored):**
- `apps/desktop/src/modules/atlas.website/screens/` — all 21 screen files
- `apps/desktop/src/modules/atlas.website/components/WebsiteSourceSelector.jsx`
- `apps/desktop/src/modules/atlas.website/components/DistUploadPanel.jsx`

**Split (WebsiteSiteWizard.jsx → 6 files):**
- `WebsiteWizard.jsx`, `WizardStepMode.jsx`, `WizardStepInfo.jsx`, `WizardStepType.jsx`, `WizardStepIdentity.jsx`, `WizardStepTemplate.jsx`

**New:**
- `WebsiteTemplateDetailScreen.jsx` — template detail + preview page

**Deleted:**
- `WebsiteSiteWizard.jsx` — replaced by the 6-file split

**Unchanged:**
- All API routes and services
- `prisma/schema.prisma`
- `apps/desktop/src/website/` (Phase 2)
