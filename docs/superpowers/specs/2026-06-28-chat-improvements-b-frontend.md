# Chat Improvements — Plan B: Frontend / UI
**Date:** 2026-06-28
**Status:** Approved — ready for implementation (after Plan A backend is deployed)

---

## Context

Plan B covers all operator-facing UX improvements in `atlas.chat` (Bandeja externa) and enhancements to the guest widget SDK. Depends on Plan A's migration being deployed (assigned_user_id, templates, idle expiry).

---

## B1 — Bandeja Externa: Realtime de mensajes del visitante

**Problem:** When a guest sends a message, it doesn't appear in real time in the operator's "Bandeja externa" view — the operator has to reload.

**Root cause:** The external inbox subscribes to Supabase Realtime channel `chat:conv:{id}` for `new_operator_message`, but the operator panel is NOT subscribing to `new_guest_message` events for the active conversation.

**Fix in** `apps/desktop/src/modules/atlas.chat/ExternalInbox.jsx` (or wherever the conversation detail renders):
- Subscribe to channel `chat:conv:{conversationId}` on mount
- Listen for event `new_guest_message` (already broadcast by `guest-service.js`)
- On event: append message to local list (optimistic) without full refetch
- On unmount: unsubscribe

```js
useEffect(() => {
  if (!conversationId) return
  const channel = supabase
    .channel(`chat:conv:${conversationId}`)
    .on('broadcast', { event: 'new_guest_message' }, ({ payload }) => {
      setMessages(prev => [...prev, payload])
    })
    .on('broadcast', { event: 'new_operator_message' }, ({ payload }) => {
      setMessages(prev => [...prev, payload])
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [conversationId])
```

Also subscribe at the **inbox list level** to `chat:company:{companyId}` for `new_external_conversation` and `new_guest_message` events to update the conversation list unread indicators without page reload.

---

## B2 — Bandeja Externa: Rediseño UI

**Problems:**
- Overflow externo visible (scrollbar en el contenedor principal)
- Layout no coincide con el chat interno (diferente estructura)
- Falta buscador de conversaciones
- No muestra información del visitante (email, página de origen, hora)

**Target:** Mismo layout de 3 columnas que el chat interno:
```
[lista convs] | [mensajes] | [panel info visitante]
```

**Columna izquierda (lista):**
- Buscador: input que filtra por nombre/email del visitante
- Filtros de estado: tabs "Abiertas / Pendientes / Cerradas"
- Cada item: avatar inicial, nombre/email, última línea del mensaje, timestamp relativo ("hace 5 min"), indicador de no leídos
- Sin overflow externo: `h-full overflow-y-auto` en el contenedor, no en el body

**Columna central (mensajes):**
- Header: nombre del visitante + email + URL de origen (link clickeable) + badge de estado
- Mensajes: burbujas alineadas (visitante=izquierda, operador=derecha) con timestamp exacto en hover (`title` attribute)
- Timestamps agrupados por día ("Hoy", "Ayer", fecha)
- Input al fondo: igual que el chat interno, con botón de templates (ver B3) y adjuntos (ver B4)
- Fix overflow: `flex flex-col h-full` con `flex-1 overflow-y-auto` en la zona de mensajes

**Columna derecha (info panel):**
- Nombre y email del visitante
- URL de origen con link
- Timestamp de inicio de sesión
- Operador asignado (dropdown para reasignar, ver Plan A A1)
- Estado de sesión: activa / expirada (idle_expires_at countdown)
- Botón "Cerrar conversación"
- Historial de sesiones anteriores del mismo email (links a conversaciones previas)

**CSS fixes (crítico):**
- Quitar `overflow: hidden` o `overflow: auto` del contenedor raíz del módulo
- Usar `h-screen` → `h-full` relativo al `AppShell` main area
- El `AppShell` ya es `flex flex-col h-screen`; el módulo debe ser `flex h-full`

---

## B3 — Templates de Mensajes en el Operador

**Depends on:** Plan A A5 (templates API).

**UX:** Botón `[/]` (slash command icon) en el input del operador. Al hacer clic abre un popover con la lista de templates de la compañía, buscable. Al seleccionar, inserta el body en el textarea. El operador puede editar antes de enviar.

**Component:** `ChatTemplatePopover` — nuevo componente en `apps/desktop/src/modules/atlas.chat/components/`.
- Props: `{ onSelect(body: string), companyId }`
- Fetches `GET /chat/templates` on open (cached 60s con TanStack Query)
- Input de búsqueda filtra por `title` y `body`
- Click en template: llama `POST /chat/templates/:id/use` (background, fire-and-forget) + `onSelect(template.body)`

**CRUD de templates:** Pantalla simple en el módulo chat (nueva ruta `/app/chat/templates`):
- `AtlasCrudView` con `GET /chat/templates`, botón crear, edit inline
- Columnas: Título, Preview body (truncado), Usos, Creado por

---

## B4 — Archivos adjuntos en Bandeja Externa

**Depends on:** Plan A migration deployed; atlas-chat bucket existente.

**Operador adjunta archivo:** Botón clip en el input → `FileUploader` de `@atlas/ui` → sube a `atlas-chat/{companyId}/{conversationId}/` → llama `POST /chat/external/:id/messages` con `messageType: 'file'` + metadata del archivo en `metadata`.

**Visitante recibe el archivo:** El mensaje tipo `file` en el widget muestra enlace de descarga (URL firmada del archivo). En `useGuestChat`, cuando llega un `new_operator_message` con `messageType === 'file'`, renderizar como link.

**Visitante adjunta archivo (widget):** 
- Botón clip en el widget (solo si `capabilities.fileUpload === true` en la config del sitio)
- Upload a Supabase Storage directamente desde el SDK usando `supabaseAnonKey` → bucket `atlas-chat` con policy de insert público restringida a paths `public/chat-uploads/`
- Llama `POST /public/chat/session/:token/messages` con `messageType: 'file'`

---

## B5 — Sonidos de Notificación

**When:**
- Operador: cuando llega `new_guest_message` y la ventana NO está en foco → reproducir sonido suave
- Visitante (widget): cuando llega `new_operator_message` → reproducir sonido suave

**Implementation:**
- Archivo de audio: `apps/desktop/public/sounds/chat-notification.mp3` (un beep corto, ~50kb)
- `const audio = new Audio('/sounds/chat-notification.mp3'); audio.volume = 0.3; audio.play().catch(() => {})`
- Wrapped en `document.visibilityState === 'hidden'` para el operador (solo suena si no están mirando)
- Para el widget SDK: `public/sounds/` no está disponible; embeber el sonido como base64 data URL en el SDK (mínimo, ~5kb) o fetchear de un CDN

**No controles de usuario en esta fase** — simplemente reproducir. Si el usuario quiere silenciar, puede usar el mute del sistema.

---

## B6 — Perfil del Operador en la Conversación (widget)

**Goal:** El visitante ve el nombre y avatar del operador cuando este responde.

**Data flow:**
- Cuando el operador responde, el broadcast `new_operator_message` ya lleva el `senderType: 'user'`
- Necesitamos incluir `senderName` y `senderAvatarUrl` en el payload del broadcast (modificar el handler en `apps/api/src/routes/chat/index.js` para agregar estos campos del UserProfile del operador)

**Widget rendering (`ChatWidget.jsx`):**
- Mensajes del operador: mostrar avatar circular con inicial o foto, nombre del operador, timestamp
- Mensajes del visitante: burbuja sencilla a la derecha, sin avatar
- Si `senderName` está disponible en el payload → mostrar; si no → "Agente de soporte"

**Timestamps en el widget:**
- Cada mensaje muestra hora local (`HH:mm`)
- Agrupar por fecha (si la conversación cruza medianoche)

---

## B7 — Timestamps y Detalles de Tiempo

**Applies to:** Bandeja externa + Widget

**Bandeja externa:**
- Lista de conversaciones: timestamp relativo (`moment.js` ya es dependencia? Si no, usar función propia sin librería extra)
  - "hace 2 min", "hace 1h", "ayer", "lun 23 jun"
- Cabecera de conversación: "Iniciado el 28 jun 2026 a las 17:38"
- Mensajes: hora en hover (`:title` attribute con hora exacta)
- Indicador "sesión activa hasta HH:mm" basado en `idle_expires_at` (Plan A A4)

**Widget SDK:**
- Cada mensaje: timestamp `HH:mm` visible
- Separadores de día si aplica

**Implementation:** Custom `formatRelativeTime(date)` utility — sin librerías externas. ~20 líneas.

---

## Files to Modify/Create

| Action | Path |
|---|---|
| Modify | `apps/desktop/src/modules/atlas.chat/ExternalInbox.jsx` (realtime + redesign) |
| New | `apps/desktop/src/modules/atlas.chat/components/ChatTemplatePopover.jsx` |
| New | `apps/desktop/src/modules/atlas.chat/components/VisitorInfoPanel.jsx` |
| New | `apps/desktop/src/modules/atlas.chat/components/ConversationList.jsx` (extracted) |
| Modify | `packages/storefront-sdk/src/react/ChatWidget.jsx` (operator profile, sounds, timestamps) |
| Modify | `packages/storefront-sdk/src/react/useGuestChat.js` (sound on operator message) |
| New | `apps/desktop/public/sounds/chat-notification.mp3` |
| Modify | `apps/api/src/routes/chat/index.js` (include senderName/senderAvatarUrl in broadcast) |

---

## Verification

1. Send guest message → operator sees it in Bandeja Externa in real time (no reload)
2. Operator sends reply → guest widget shows name + avatar of operator
3. Bandeja externa: 3-column layout, no external overflow, search works
4. Templates button in operator input → popover with search → select → inserts in textarea
5. Sound plays when new guest message arrives while operator tab is not focused
6. Session timer shows in info panel: "Expira a las 18:15"
7. File upload in operator input → guest receives download link in widget
8. Timestamps show correctly in both widget and bandeja externa
