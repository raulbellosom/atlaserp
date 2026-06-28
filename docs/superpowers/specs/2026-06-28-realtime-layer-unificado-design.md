# Spec: Realtime Layer Unificado

**Fecha:** 2026-06-28  
**Estado:** Aprobado

---

## Contexto y motivación

Atlas ERP ya tiene Supabase Realtime funcionando para chat (`postgres_changes` + Presence + Broadcast) y notificaciones personales (`user:{id}:events`). Sin embargo, el `realtime-broadcaster.js` solo se invoca desde el servicio de notificaciones — Projects, POS, Calendar e Inventory dependen únicamente de polling agresivo (15–60 s). Además, `ydoc-service.js` existe en el API pero nunca se conecta al frontend, dejando Notes sin colaboración real.

**Objetivo:** extender el mismo patrón broadcaster/Supabase a todos los módulos y conectar Y.js para CRDT real en notas.

**Infraestructura elegida:** Supabase Realtime exclusivamente (Broadcast + Presence). Sin WebSocket propio ni servidor `y-websocket` separado. El límite de 32 KB por mensaje de Supabase no es un problema porque Y.js envía deltas operacionales (<1 KB típico) y las imágenes van a Supabase Storage (solo la URL viaja en el documento).

---

## Arquitectura de canales (estado final)

| Canal | Tipo Supabase | Propósito | Estado |
|---|---|---|---|
| `user:{profileId}:events` | Broadcast | Notificaciones, mensajes de chat, eventos personales | **Existe** |
| `company:{companyId}:presence` | Presence | Online/offline de toda la empresa | **Existe** |
| `company:{companyId}:events` | Broadcast | POS, Calendar, Inventory, AME3 genérico | **Nuevo** |
| `notes:{noteId}` | Broadcast | Transporte Y.js — deltas CRDT entre clientes | **Nuevo** |
| `notes:{noteId}:awareness` | Presence | Cursores y usuario activo por nota | **Nuevo** |

El broadcaster del API publica en los canales `user:*` y `company:*`. Para notas, el cliente publica un delta al API (`POST /notes/:id/ydoc-sync`) y el API hace broadcast a `notes:{noteId}`. Los demás suscriptores del canal aplican el delta a su Y.Doc local.

---

## Plan A: Cambios en el API

### A1. `apps/api/src/services/realtime-broadcaster.js`

Añadir dos métodos nuevos reutilizando la lógica HTTP interna existente (`broadcastToUser`/`broadcastToUsers`):

```js
async broadcastToCompany(companyId, event, payload) {
  // Publica en topic: company:{companyId}:events
}

async broadcastToChannel(channelName, event, payload) {
  // Publica en topic: {channelName} (para notas, projects personalizados, etc.)
}
```

Si la lógica HTTP no está extraída en un método privado `_broadcast`, refactorizarla antes de añadir los métodos nuevos.

### A2. Projects — broadcaster calls post-mutación

Localizar el servicio/router de tasks (`modules/custom/atlas.projects/api/` o `apps/api/src/services/`).  
Después de **create, update, delete y reorder de tareas**:

```js
const memberIds = await getProjectMemberIds(projectId); // query ya existente
await broadcaster.broadcastToUsers(memberIds, 'projects.task.updated', {
  projectId, taskId, action, changes
});
```

### A3. POS — broadcaster calls

En el servicio POS, después de cada cambio de orden o estado de mesa:

```js
await broadcaster.broadcastToCompany(companyId, 'pos.order.updated', {
  orderId, tableId, status, action
});
```

### A4. Calendar — broadcaster calls

Después de CRUD de eventos de calendario:

```js
await broadcaster.broadcastToCompany(companyId, 'calendar.event.updated', {
  eventId, calendarId, action
});
```

### A5. Inventory — broadcaster calls

Después de mutaciones de records en el módulo `atlas.inventory`:

```js
await broadcaster.broadcastToCompany(companyId, 'modules.atlas.inventory.record.updated', {
  modelKey, recordId, action
});
```

### A6. Notes — endpoints Y.js

En el router de notas (`apps/api/src/routes/notes/`):

**`GET /notes/:id/ydoc`**  
- Requiere acceso del usuario a la nota (verificar como el resto de endpoints de notes)  
- Llama `ydocService.getDocState(noteId)` → `{ state: base64, stateVector: base64 }`

**`POST /notes/:id/ydoc-sync`**  
- Body: `{ update: base64, clientStateVector?: base64 }`  
- Aplica el update al Y.Doc del servidor: `ydocService.applyUpdate(noteId, update)`  
- Hace broadcast a `notes:{noteId}`: evento `ydoc.update`, payload `{ update, authorId: user.id }`  
- Devuelve `{ serverUpdate: base64 | null }` — diff desde `clientStateVector` hasta el estado actual (null si ya está en sync)

### A7. `apps/api/src/services/ydoc-service.js`

Verificar que existan los métodos `getDocState(noteId)` y `applyUpdate(noteId, update)`.  
Si no existen, implementarlos con `Y.encodeStateAsUpdate` / `Y.applyUpdate` de la librería `yjs`.  
El Y.Doc del servidor debe persistir al campo `ydoc_state` de la nota (o tabla dedicada si ya existe).

---

## Plan B: Cambios en el Frontend

### B1. `apps/desktop/src/providers/RealtimeProvider.jsx`

Añadir un tercer canal al bloque de useEffect existente, siguiendo exactamente el patrón de cleanup de los dos canales actuales:

```js
const companyEventsChannel = supabase.channel(`company:${userProfile.companyId}:events`);
companyEventsChannel
  .on('broadcast', { event: 'pos.order.updated' }, () =>
    queryClient.invalidateQueries({ queryKey: ['pos'] }))
  .on('broadcast', { event: 'calendar.event.updated' }, () =>
    queryClient.invalidateQueries({ queryKey: ['calendar'] }))
  .on('broadcast', { event: 'modules.atlas.inventory.record.updated' }, () =>
    queryClient.invalidateQueries({ queryKey: ['atlas.inventory'] }))
  .subscribe();
// return: supabase.removeChannel(companyEventsChannel)
```

### B2. `apps/desktop/src/modules/atlas.chat/hooks/useChatMessages.js` — línea ~20

Cambiar:
```js
refetchInterval: 8_000,  // antes
refetchInterval: 30_000, // después
```
El WebSocket `postgres_changes` entrega mensajes al instante; 30 s es solo red de seguridad.

### B3. Hook nuevo: `apps/desktop/src/modules/atlas.notes/hooks/useNotesYjs.js`

```js
export function useNotesYjs(noteId) {
  const ydoc = useMemo(() => new Y.Doc(), [noteId]);
  const [isSynced, setIsSynced] = useState(false);

  // Carga estado inicial
  useEffect(() => {
    atlasClient.notes.getYdoc(noteId).then(({ state }) => {
      if (state) Y.applyUpdate(ydoc, base64ToUint8Array(state), 'remote');
      setIsSynced(true);
    });
  }, [noteId, ydoc]);

  // Recibe deltas de otros clientes vía Supabase Broadcast
  useEffect(() => {
    const channel = supabase.channel(`notes:${noteId}`)
      .on('broadcast', { event: 'ydoc.update' }, ({ payload }) => {
        if (payload.authorId !== currentUserId) {
          Y.applyUpdate(ydoc, base64ToUint8Array(payload.update), 'remote');
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [noteId, ydoc]);

  // Envía deltas locales al API
  useEffect(() => {
    const handler = (update, origin) => {
      if (origin !== 'remote') {
        atlasClient.notes.syncYdoc(noteId, { update: uint8ArrayToBase64(update) });
      }
    };
    ydoc.on('update', handler);
    return () => ydoc.off('update', handler);
  }, [noteId, ydoc]);

  // Awareness (cursores) via Presence
  const awarenessChannel = useMemo(() => {
    return supabase.channel(`notes:${noteId}:awareness`, {
      config: { presence: { key: currentUserId } }
    });
  }, [noteId]);

  return { ydoc, isSynced, awarenessChannel };
}
```

Helpers `base64ToUint8Array` / `uint8ArrayToBase64` como funciones de utilidad en `lib/`.

### B4. Editor de notas con TipTap + Y.js

Instalar:
```
pnpm add yjs @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
```

En la pantalla de edición de notas:
```js
const { ydoc, isSynced, awarenessChannel } = useNotesYjs(noteId);
const editor = useEditor({
  extensions: [
    ...,
    Collaboration.configure({ document: ydoc }),
    CollaborationCursor.configure({
      provider: awarenessChannel,
      user: { name: userProfile.displayName, color: getUserColor(userProfile.id) }
    }),
  ],
  editable: isSynced,
});
```

Si Notes usa un editor distinto a TipTap, adaptar el binding de Y.js al editor existente antes de la implementación.

### B5. Reducción de polling en módulos con broadcaster

| Hook | Archivo | Antes | Después |
|---|---|---|---|
| usePosOrder | `usePosOrder.js` ~línea 30 | 15 s | 60 s |
| usePosKitchen | `usePosKitchen.js` ~línea 19 | 15 s | 60 s |
| usePosFloor | `usePosFloor.js` ~líneas 19, 56 | 15–30 s | 60 s |
| useCalendarData | `useCalendarData.js` línea 285 | 60 s | 300 s |
| Inventory | buscar en `modules/custom/atlas.inventory/` hooks con `refetchInterval` | si existe | 300 s |

### B6. SDK — `packages/sdk/src/`

En el cliente de `notes`, añadir dos métodos:
- `getYdoc(noteId)` → `GET /notes/:id/ydoc`
- `syncYdoc(noteId, { update, clientStateVector? })` → `POST /notes/:id/ydoc-sync`

---

## Qué NO cambia

- Chat `postgres_changes` WebSocket — funciona, no tocar
- Chat typing/presencia (Supabase Presence por conversación) — funciona, no tocar
- Company presence online/offline — funciona, no tocar
- Web Push / service worker — funciona, no tocar
- External chat widget polling 30 s — correcto para guests sin sesión Supabase

---

## Split de planes de implementación

Dado el alcance (backend + frontend), la implementación se divide en dos planes:

- **Plan A** (API): broadcaster expansion (A1–A5) + notes ydoc endpoints (A6–A7)
- **Plan B** (Frontend): RealtimeProvider (B1) + polling reduction (B2, B5) + useNotesYjs + editor (B3–B4) + SDK (B6)

---

## Verificación end-to-end

1. **Projects realtime:** dos sesiones con el mismo proyecto → mover tarea en una → la otra la refleja sin reload. DevTools WS debe mostrar el broadcast llegando.

2. **POS realtime:** dos sesiones con la pantalla POS → crear/actualizar orden en una → estado actualiza en la otra al instante.

3. **Calendar realtime:** crear evento en sesión A → sesión B refleja sin reload. Polling reducido a 300 s visible en DevTools Network.

4. **Chat polling reducido:** DevTools Network → `/chat/conversations/{id}/messages` debe aparecer cada ~30 s, pero los mensajes nuevos llegan al instante vía WS (pestaña WS de DevTools).

5. **Notes CRDT:** dos sesiones con la misma nota → escribir en sesión A → texto aparece en sesión B en tiempo real. Cursor de sesión A visible en sesión B con nombre de usuario.

6. **Awareness notas:** al abrir la misma nota en dos ventanas, cada una muestra el avatar/nombre del otro usuario activo en la nota.
