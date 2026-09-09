# Plan — Layout móvil (raíz) + batch de chat (reporte 2026-09-08 #2)

Origen: reporte de QA de Raul desde iPhone. Capturas: header de "Editar
usuario" recortado, barra "Cambios sin guardar" encimada, panel de emojis fuera
de pantalla, reproductor de audio (0:0 + distorsión), búsqueda in-chat que dice
"Sin resultados" con coincidencias visibles / "Error al buscar".

Trabajar directo en `main`. Sin ramas.

Alcance explícito de Raul: arreglarlo **desde la raíz** (templates/layouts de
Atlas que usan fleet, contacts, identity, etc.), **sobre todo el chat**.

---

## 1. Fila de acciones del header recortada en móvil (raíz)

### Diagnóstico (confirmado en código)

`packages/ui/src/components/PageHeader.jsx`:

- Modo normal: el contenedor de acciones es
  `flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto`. **Sí** permite
  `flex-wrap`, pero solo sobre sus hijos directos.
- Modo `compact`: el contenedor es `flex shrink-0 items-center gap-2` — **sin
  wrap**.

El problema real: ~11 pantallas + `AtlasCrudView` (modo create) pasan como
`actions` un **único** `<div className="flex items-center gap-2">` (sin
`flex-wrap`, sin `min-w-0`). El `flex-wrap` del contenedor de `PageHeader` no
puede envolver los botones que viven dentro de ese div anidado, así que la fila
se desborda horizontalmente y `AppShell` (`overflow-x-hidden`) la recorta. En la
captura: "Eliminar usua…".

Consumidores con el patrón anidado no-wrap (verificado por grep
`actions={\s*<div className="flex`):

- `apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx:257`
- `apps/desktop/src/modules/atlas.files/components/FilesWorkspaceHeader.jsx`
- `apps/desktop/src/modules/atlas.pfm/screens/WalletDetailScreen.jsx`
- `apps/desktop/src/modules/atlas.pfm/screens/BudgetsScreen.jsx`
- `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/GroupScreen.jsx`
- `apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsitePagesScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`
- `apps/desktop/src/modules/atlas.inventory/screens/InventoryItemDetail.jsx`
- `apps/desktop/src/modules/atlas.notifications/NotificationsInboxScreen.jsx`
- `packages/ui/src/atlas-renderer/AtlasCrudView.jsx:423` (create mode)

(El modo `detail` de `AtlasCrudView:450` ya usa `flex flex-wrap` — correcto, es
el modelo a seguir.)

### Acción

**A. Endurecer `PageHeader` (raíz — una sola vez cubre a todos):**

- Modo normal, contenedor de acciones:
  `flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end`
  - quitar `shrink-0` del contenedor (dejaba que empujara fuera del viewport).
  - añadir `[&>*]:min-w-0` para que un hijo anidado pueda encogerse.
- Modo `compact`, contenedor de acciones:
  `flex min-w-0 flex-wrap items-center justify-end gap-2` (quitar `shrink-0`,
  añadir `flex-wrap`).
- El bloque de título ya tiene `min-w-0` + `truncate` (normal) / `truncate`
  (compact) — mantener.

**B. Barrido mecánico de los consumidores anidados:** en cada archivo de la
lista, cambiar el `<div className="flex items-center gap-2">` anidado por
`<div className="flex flex-wrap items-center gap-2">` (mínimo cambio, sin tocar
la lógica). Donde sea trivial, preferir pasar un fragmento `<>…</>` y dejar que
el contenedor de `PageHeader` haga el wrap.

**C. `AtlasCrudView.jsx:423`** (create mode): añadir `flex-wrap` al div de
acciones, igualando el modo detail.

### Verificación

- 390px y 1440px (captura obligatoria) en: Editar usuario (identity), Fleet
  detail, Contacts (AtlasCrudView list/create/detail), Files workspace, PFM
  wallet detail, Inventory item detail.
- Ningún botón cortado; en móvil los botones envuelven a una 2.ª línea.

---

## 2. Barra "Cambios sin guardar" no responsiva (raíz)

### Diagnóstico

Patrón duplicado, idéntico, en:

- `apps/desktop/src/modules/atlas.identity/screens/RoleEditorScreen.jsx:354`
- `apps/desktop/src/modules/atlas.identity/components/UserPermissionGrantsCard.jsx:157`

```
<div className="sticky bottom-0 z-20 …">
  <div className="glass-strong flex items-center justify-between gap-3 …">
    <p>Cambios sin guardar en permisos</p>
    <div className="flex items-center gap-2 shrink-0"> Descartar / Guardar </div>
  </div>
</div>
```

`flex items-center justify-between` sin wrap: en 390px el label + los dos botones
no caben → se enciman (captura 2). Además `sticky bottom-0` dentro de un
contenedor scrolleado no siempre "pega" en móvil y puede quedar bajo el
composer / la barra inferior; no respeta `env(safe-area-inset-bottom)`.

### Acción

**Extraer `UnsavedChangesBar` a `@atlas/ui`** (`packages/ui/src/components/
UnsavedChangesBar.jsx`, exportar en `index.js`, documentar en
`docs/ai-context/ame3-runtime-capabilities.md`).

Contrato:

```
<UnsavedChangesBar
  message="Cambios sin guardar en permisos"
  saving={boolean}
  onDiscard={fn}
  onSave={fn}
  saveLabel="Guardar permisos"
  savingLabel="Guardando..."
/>
```

Comportamiento:

- Layout: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
- Botones: `w-full sm:w-auto` en móvil (apilados, ancho completo), en fila en
  `sm+`. Orden: en móvil "Guardar" primero (primario arriba), "Descartar"
  debajo; en desktop se mantiene Descartar → Guardar.
- Contenedor `sticky bottom-0` con
  `pb-[max(1rem,env(safe-area-inset-bottom))]`, `z-30`.
- Mantener `glass-strong`, `rounded-2xl`, `border`, `shadow-2xl`.
- Usar `Button` de `@atlas/ui` (política UI-first).

Reemplazar ambos usos por `<UnsavedChangesBar …/>`. Buscar otros sitios con el
mismo texto/patrón y migrarlos también.

### Verificación

390px: label arriba, dos botones ancho completo, sin encimado, no tapado por el
nav inferior. 1440px: fila como hoy.

---

## 3. Panel de emojis se renderiza fuera de pantalla (chat)

### Diagnóstico

`apps/desktop/src/modules/atlas.chat/components/MessageComposer.jsx:852` — el
emoji picker es un Radix `Popover` (`side="top" align="start"`,
`collisionPadding={12}`, `max-w-[calc(100vw-1rem)]`) con
`<EmojiPicker width={compact ? "min(230px,calc(100vw - 1rem))" : "min(300px,…)"}
height={compact ? 280 : 360}/>`.

Cuando el composer vive dentro de un `Sheet` (ThreadPanel, MessageActionSheet) o
al fondo de un layout 85dvh en móvil, Radix hace flip a `bottom` si no hay
espacio arriba; dentro de un Sheet anclado abajo, "bottom" queda fuera de la
vista. `align="start"` ancla el borde izquierdo del picker al botón (3.er icono
de la barra) — con el ancho fijo del picker puede sobresalir por la derecha en
anchos intermedios. La lib `emoji-picker-react` fija su propio ancho/alto y su
scroll interno no responde bien cuando Radix le da menos alto del pedido.

### Acción (revisada por Raul 2026-09-08)

Evitar el Popover en móvil por completo:

- En **coarse-pointer** (`useCoarsePointer()` de `@atlas/ui`): mostrar una
  **fila inline en el composer** con ~8 emojis frecuentes (mezcla de un set
  común fijo + "más usados" del usuario si hay señal barata; si no, solo el set
  fijo) y un botón **`+`** al final que abre un **`Dialog`** (`@atlas/ui`,
  centrado, `size="lg"`, no Popover) con el `EmojiPicker` completo
  (`width="100%"`, altura ~60dvh, el Dialog aporta el marco y el scroll).
  Tap en un emoji de la fila o del Dialog → `insertEmoji` + cerrar Dialog.
- En **pointer fino** (desktop): mantener el `Popover` actual tal cual (ahí no
  hay bug); no se toca.

Set común fijo (orden): 👍 ❤️ 😂 🙏 🔥 😮 😢 🎉 (alineado con
`MessageReactionPicker`). "Más usados": si es trivial, `localStorage` con un
contador por emoji insertado; si no, omitir en este batch.

`MessageReactionPicker` ya es un popover pequeño de 6-8 emojis anclado a un
mensaje — no comparte el bug del picker grande; no se toca salvo que QA lo
muestre.

### Verificación

Móvil real: abrir emojis desde el composer principal, desde ThreadPanel y desde
MessageActionSheet — el panel siempre visible y scrolleable. Desktop: sin
regresión.

---

## 4. Reproductor de audio: "0:0" + reproduce ~1s distorsionado (chat)

### Diagnóstico — cuestionando el enfoque (2.º intento sobre AudioCard)

`apps/desktop/src/modules/atlas.chat/components/MessageAttachments.jsx` →
`AudioCard` + `probeDuration()`:

- `probeDuration` hace `audio.currentTime = 1e101` en `onLoadedMetadata`,
  `onCanPlay` y `onPlay` para forzar que el navegador resuelva la duración de un
  blob de `MediaRecorder` (webm/opus **nunca** trae el elemento Duration).
- En Safari iOS ese seek fuera de rango: (a) no siempre dispara `seeked`, así
  que `seekingForDurationRef` **queda pegado en true** y **todos** los
  `timeupdate` posteriores se ignoran → `currentTime` clavado en 0 → "0:0";
  (b) deja el elemento en un estado de posición roto → al pulsar play reproduce
  una fracción y termina → "1 segundo distorsionado".
- `MessageComposer.startRecording` sube la nota de voz como `File` plano, **sin
  metadatos de duración**. `chat_attachments` no tiene columna de duración
  (grep confirma: no hay `duration`/`meta` en `chat-attachments-service.js`).
  `recorder.start(100)` (timeslice 100ms) — en iOS el timeslice puede producir
  contenedores fragmentados/corruptos.

El seek-hack `1e101` es frágil por diseño en móvil. Hay que quitarlo.

### Acción

**Grabación (`MessageComposer.startRecording`):**

- `recorder.start()` **sin timeslice** (o timeslice grande, p.ej. 1000ms) para
  que iOS emita un contenedor único válido. Mantener el array de chunks.
- Medir la duración real al grabar: `performance.now()` al `start` y al `stop`;
  guardar `Math.round(elapsedMs)`.
- Pasar la duración al `File`/cola de subida como metadato
  (`file.__voiceDurationMs` o un campo paralelo en `addFilesToQueue`).

**Persistencia (decisión pendiente — ver preguntas):**

- Opción A (cliente, sin migración): no persistir; el player la deriva con
  `AudioContext.decodeAudioData` (exacto, sin seek-hack) cuando el elemento no
  reporta duración. Para notas nuevas, si el composer la pasa en el mensaje
  `metadata` (JSON ya existe en `chat_messages.metadata`), leerla de ahí.
- Opción B (bulletproof): `chat_attachments.duration_ms int null` + forward
  migration + devolverla en el payload de adjuntos + `startRecording` la manda
  al crear el adjunto.

**Player (`AudioCard`):**

- **Eliminar** `audio.currentTime = 1e101` y todo el mecanismo
  `seekingForDurationRef` / `handleSeeked`-que-resetea.
- Fuente de duración, en orden: (1) prop/`metadata` si viene del backend;
  (2) `audio.duration` si es finito > 0 (`onLoadedMetadata`/`onDurationChange`);
  (3) fallback `decodeAudioData` sobre el blob ya descargado (lazy: solo al
  primer play o al entrar en viewport).
- Si ninguna resuelve: `timeLabel = "--:--"`, permitir reproducción lineal
  (play/pause), seek deshabilitado hasta que `onTimeUpdate` reporte progreso.
  Nunca marcar `loadError` por falta de duración.
- Mantener el retry de signed-URL en `onError` (una vez, ref-guard) — correcto.

### Verificación

Móvil real (iOS + Android) y desktop: grabar nota de voz, ver duración correcta
antes de reproducir, reproducir completa sin distorsión, seek funcional. Notas
antiguas (sin metadato): duración vía decode o "--:--" pero reproducibles.
Test barato de no-regresión para `fmtAudioTime`/`seedBars`.

---

## 5. Búsqueda in-chat: "Sin resultados" con coincidencias visibles / "Error al buscar"

### Diagnóstico (confirmado en código)

**5a — "Sin resultados" con highlights amarillos en pantalla:**

- `apps/desktop/src/modules/atlas.chat/hooks/useChatMessageSearch.js`:
  `MIN_LEN = 2`, `active = enabled && Boolean(token) && debounced.length >= 2`.
  Con `q = "Y"` (1 char) → `debounced = "y"` (len 1) → `active = false` → la
  query **nunca corre** → `hits = []` → `searchMatchCount = 0`.
- `ChatHeader.jsx:116-140` (modo search): con `searchQuery` truthy,
  `searchMatchCount === 0`, `searchBusy === false`, `searchError === false` →
  renderiza literalmente **"Sin resultados"**.
- En paralelo, `ChatMessageBubble.jsx` → `HighlightedText({text, query:
  searchQuery})` hace un **resaltado de substring del lado cliente** sobre los
  mensajes ya montados, **independiente** de si la búsqueda de servidor corrió.
  Con `q="Y"` pinta cada "y"/"Y" en `<mark class="bg-yellow-300">`.
- Resultado: muchas marcas amarillas + contador "Sin resultados". Contradicción
  exacta del reporte.
- Nota: el servidor **sí** maneja 1 char (`tokenizeQuery("y")` → `["y"]`,
  `body_norm ILIKE '%y%'`). El gate `MIN_LEN=2` es fricción puramente cliente.

**5b — "Error al buscar" intermitente:**

- `ChatHeader` muestra "Error al buscar" cuando `useChatMessageSearch` reporta
  `isError`. `chat-search-service.js` usa `body_norm ILIKE '%tok%'` (comodín
  inicial → sin índice) + `word_similarity(tok, body_norm)` en conversaciones
  potencialmente grandes → **timeout de query** bajo carga (encaja con "a
  veces"). Menos probable: 401/403 transitorio, red.
- **Confianza media** — falta el log del API del VPS para confirmar la causa
  exacta. No asumir; instrumentar/observar.

### Acción

**5a (raíz de la contradicción):**

1. Bajar `MIN_LEN` a `1` en `useChatMessageSearch` (el servidor ya lo soporta),
   o — mejor — alinear el gate con el servidor: correr en cuanto haya ≥1 char
   no-espacio.
2. `ChatHeader.jsx` modo search: separar los estados visuales:
   - sin query / query por debajo del mínimo efectivo → **no** mostrar "Sin
     resultados"; mostrar nada o un hint neutro ("Escribe para buscar").
   - `searchBusy` → "Buscando…".
   - query válida + 0 hits → "Sin resultados".
   - `searchError` → "Error al buscar" + permitir reintento (tap).
3. Coherencia highlight/contador: el `<mark>` cliente de `HighlightedText` debe
   activarse con la **misma** condición que habilita la búsqueda de servidor
   (no pintar marcas si la query no está "activa"). Así nunca hay marcas sin
   contador ni contador sin marcas.

**5b:**

4. `chat-search-service.js`: envolver el `$queryRaw` con manejo de error que
   distinga timeout (`57014` / statement_timeout) de otros; devolver `503`
   "búsqueda no disponible, reintenta" en vez de 500 genérico, y loguear
   `q`, `conversationId`, `tokens`, código PG.
5. Rendimiento: añadir índice GIN trigram donde falte
   (`chat_messages.body_norm gin_trgm_ops`, `user_profile.name_norm`) — forward
   migration. Verificar `EXPLAIN` de la query de búsqueda scoped a una
   conversación grande. Considerar subir `statement_timeout` solo para esta
   query o cambiar el comodín inicial por `word_similarity` + índice.
6. `useChatMessageSearch`: `retry: 1` en la query (hoy sin retry) para absorber
   el 401 transitorio de refresh de token.

### Verificación

- Buscar "y", "a", "de" en una conversación con esos términos → contador
  coherente con las marcas.
- Búsqueda en una conversación con miles de mensajes → responde < 2s, sin
  "Error al buscar".
- 390px: la fila de búsqueda del header no se recorta (relacionado con #1).

---

## 6. "Error" al invitar a un canal + no hay selector de rol

### Diagnóstico

- **No hay selector de rol al invitar — es por diseño.** `AddChannelMembersDialog`
  llama `addMembers({ userIds })` sin `role`; el schema mete `role: "member"` por
  defecto y el servicio fuerza `role_id` al rol "Member" del canal
  (`chat-service.js:610`). El rol real se asigna **después** en la pestaña
  Miembros → `⋮` de cada miembro → "Asignar rol: X" (`ChannelMembersTab.jsx`,
  `PATCH /members/:id/role`, modelo `chat_channel_roles`). El param `role` del
  API solo escribe la columna string legacy, no `role_id` — un picker en el
  diálogo sería engañoso para canales sin cablear `role → role_id` primero.
- **El "error" al invitar (causa más probable):** `filterCompanyPeers`
  (`chat-service.js:216`). Si el usuario que invita **no tiene ninguna
  `Membership` de empresa activa** (cuenta platform-admin — típico del dueño de
  la instancia), la rama `companyIds.length === 0` devolvía **solo self** →
  `validUserIds.length !== requestedUserIds.length` →
  `ChatServiceError("Uno o mas usuarios no pertenecen a tu empresa.", 403)` en
  **toda** invitación. El mensaje además es engañoso: los invitados sí tienen
  empresa; el que no la tiene es quien invita.
- No se pudo confirmar 100% sin el texto exacto del toast / log del API del VPS.
  Otras causas posibles descartables por mensaje específico: MeridIAn en el
  picker (ya filtrado por `isBot=false` en el batch hermano), invitado de otra
  empresa (rechazo correcto del guard), canal legacy sin roles seed
  (`assertChannelPermission` daría 403 "No tienes permiso…" y además ocultaría
  el botón "Añadir miembros").

### Acción

- [x] `filterCompanyPeers`: rama sin-membership ahora permite cualquier candidato
  que sea miembro real y `enabled` de alguna empresa (en vez de solo self). Un
  platform-admin ya pasó el guard de permiso de ruta + `members.manage`; el
  cross-tenant guard sigue intacto para usuarios de empresa normales. +1 test en
  `chat-tenant.test.js` (292 tests chat verdes).
- [ ] Confirmar con Raul el texto exacto del toast para cerrar la causa raíz.
- [ ] (Opcional, follow-up) Selector de rol al invitar: requiere cablear `role`
  → `role_id` en `addMembers` para canales. Fuera de este batch.

## Estado de ejecución (2026-09-08, sesión 1)

Hecho en `main` (local, sin commit):

- [x] **#1A** `PageHeader` endurecido (normal + `compact`): `min-w-0`,
  `flex-wrap`, `[&>*]:min-w-0`, `sm:justify-end`, sin `shrink-0`.
- [x] **#1B/#1C** Barrido: 11 pantallas + `AtlasCrudView` (create + edit) — el
  `<div>` anidado de acciones ahora lleva `flex-wrap`.
- [x] **#2** `UnsavedChangesBar` nuevo en `@atlas/ui` (+ export + doc en
  ame3-runtime-capabilities.md). `RoleEditorScreen` y `UserPermissionGrantsCard`
  migrados; barra vieja borrada en ambos.
- [x] **#5a** `useChatMessageSearch`: `minLen` 1 (in-conv) / 2 (global),
  `retry: 1`, `hasQuery = active`. `ChatWindow` pasa `searchHasQuery` a
  `ChatHeader` y **gatea el highlight** (`searchQuery` solo si `searchHasQuery`).
  `ChatHeader`: el estado (contador / "Buscando..." / "Sin resultados" /
  "Error al buscar") solo aparece cuando la búsqueda corre de verdad.
- [x] **#5b** `chat-search-service`: `try/catch` sobre el `$queryRaw`, timeout PG
  `57014` → `ChatServiceError` 503 + `console.warn` con contexto; otros errores
  se relanzan. +2 tests. (Los índices GIN trigram de body/nombre **ya existían**
  desde `20260902000000_chat_message_search` — no hizo falta migración de
  índices; ver Fuera de alcance.)
- [x] **#4** `duration_ms`: migración `20260908150000_chat_attachment_duration`
  (NO aplicada), `chatPresignAttachmentSchema.durationMs` opcional,
  `presignAttachmentUpload` inserta la columna, serialización de adjuntos
  devuelve `durationMs` (2 mapeos + copia en forward), `useChatUpload` lo manda
  desde `file.voiceDurationMs`, `MessageComposer.startRecording` mide con
  `performance.now()` y quita el timeslice (`recorder.start()` sin `100`).
  `AudioCard` reescrito: sin `currentTime = 1e101`, sin `seekingForDurationRef`;
  duración = servidor > elemento > `decodeAudioData`; `timeLabel` "--:--" y
  reproducción lineal cuando no hay duración.
- [x] **#3** Emoji: `useCoarsePointer` → en táctil el botón abre una **fila
  in-flow** de 8 emojis frecuentes + `+` que abre un `Dialog` (portaled a
  `<body>`) con el `EmojiPicker` completo. Desktop mantiene el `Popover`.

Verde: `pnpm lint`, `pnpm build` (web + Tauri), 291 tests API chat, 81 tests
desktop chat, 16 tests chat-search-service, 6 validators, 318 API services.

Pendiente:

- [x] `pnpm db:migrate` aplicado a la BD en vivo (`chat_attachments.duration_ms`
  añadida; `20260908150000_chat_attachment_duration`).
- [ ] QA en dispositivo (390/1440): headers de 6 módulos, barra sin guardar,
  emojis (composer / ThreadPanel / MessageActionSheet), nota de voz iOS+Android
  (duración correcta, reproduce completa), búsqueda in-chat ("y"/"de" → contador
  coherente con los resaltados), conversación grande sin "Error al buscar".
- [ ] Doc `UnsavedChangesBar` en el 14-aspect UI checklist si aplica.

## Orden de ejecución

1. `PageHeader` hardening (#1A) — raíz, bajo riesgo.
2. `UnsavedChangesBar` a `@atlas/ui` + reemplazos (#2).
3. Barrido de consumidores con div anidado no-wrap (#1B, #1C).
4. `useChatMessageSearch` + `ChatHeader` estados de búsqueda + coherencia
   highlight (#5a).
5. `chat-search-service` manejo de error + índices trigram + retry (#5b).
6. Emoji picker → Sheet en coarse-pointer (#3).
7. AudioCard: quitar seek-hack + duración por decode/metadato; `startRecording`
   sin timeslice + medir duración (#4). Migración de `duration_ms` solo si se
   elige Opción B.
8. Verificar: `pnpm lint`, `node --test apps/api/src/**/__tests__` +
   `apps/api/src/routes/chat/__tests__`, tests de chat desktop, `pnpm build`.
9. QA manual en dispositivo (abierto): 390/1440 headers en 6 pantallas, barra
   sin guardar, emojis en 3 contenedores, nota de voz iOS+Android, búsqueda
   in-chat coherente + conversación grande.

## Decisiones (Raul, 2026-09-08)

- **#3 emoji**: **Fila inline + botón `+` → Dialog completo** en móvil
  (coarse-pointer). Nada de Popover en táctil. Desktop mantiene el Popover
  actual. Ver sección 3 para el detalle.
- **#4 audio**: **Opción B** — `chat_attachments.duration_ms int null` + forward
  migration + devolver en el payload de adjuntos + `startRecording` mide y manda
  la duración. `AudioCard` la consume del backend; `decodeAudioData` solo como
  fallback para notas antiguas. Quitar el seek-hack `1e101` igualmente.
- **#5b**: **Incluir** la migración de índices trigram en este batch
  (`chat_messages.body_norm gin_trgm_ops`, `user_profile.name_norm
  gin_trgm_ops`) + manejo de timeout → 503.

## Fuera de alcance / abierto

- Causa raíz exacta del "Error al buscar" — requiere log del API del VPS.
- Sin QA en navegador/dispositivo en esta sesión (solo lectura de código).
- `ChatMessageBubble.jsx` (1188 líneas) y `chat-service.js` — límites de tamaño
  ya anotados en CLAUDE.md; no crecerlos en este batch.
