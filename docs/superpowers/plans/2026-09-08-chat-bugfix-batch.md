# Plan — atlas.chat bug batch (reporte 2026-09-08)

Origen: reporte de QA de Raul con capturas (MeridIAn 1-a-1, picker de miembros,
header saturado, reproductor de audio, MeridIAn listado como usuario).

Trabajar directo en `main`. Sin ramas.

---

## 1. MeridIAn no responde / no aparece el `@MeridIAn` para algunos usuarios

### Diagnóstico (confirmado contra la BD en vivo)

- `chat.meridian.use` existe y está `active: true` (`moduleKey=atlas.chat`,
  módulo `INSTALLED + enabled`).
- Solo `atlas.admin` y `system.admin` (roles de sistema) tienen
  `chat.meridian.use`. `general.devops` (rol no-sistema, 215 permisos) **no** lo
  tiene → un usuario con ese rol nunca ve el candidato `@MeridIAn` en el
  compositor (`useMentionCandidates` → `GET /chat/meridian/status` responde 403)
  ni recibe respuesta al escribir `@meridian` a mano
  (`apps/api/src/routes/chat/index.js:365` exige `isAdmin ||
  permissionSet.has("chat.meridian.use")`).
- No es intermitente: depende del rol del emisor.

### Decisión de producto (Raul)

Mantener el gate por permiso. NO conceder a todos, NO desacoplar. El problema
real es que el permiso **no se encuentra** para asignarlo, y falta poder
asignar permisos directo a un usuario.

### Acciones

1. **Etiquetas del árbol de permisos** — `PermissionFeatureTree.jsx`:
   - `MODULE_LABELS`: añadir `chat: "Chat"`.
   - `FEATURE_LABELS`: añadir `meridian: "MeridIAn"`, `support: "Soporte externo"`,
     `conversations: "Conversaciones"`.
   - `ACTION_LABELS`: añadir `use: "Usar"`.
   - Resultado: la fila se lee `CHAT → MeridIAn → Usar` con su descripción, y es
     localizable por búsqueda ("meridian").
2. **Nota de soporte a Raul** (no código): para habilitar a los testers, en
   Identity → Roles → `Dev OPS` → grupo CHAT → MeridIAn → activar "Usar" y
   Guardar. (O crear un rol dedicado.)
3. **Permisos directos por usuario** — NO existe modelo `UserPermission` (solo
   `RolePermission`). Es una feature nueva (tabla + migración + resolución en
   `resolveUserContext` + UI en `UserEditorScreen`). Se documenta como spec
   aparte, **fuera de este batch**. Crear
   `docs/superpowers/specs/2026-09-08-per-user-permission-grants.md` (borrador de
   alcance, sin implementar).

Sin cambios en la lógica del gate ni en `seed.js` en este batch.

---

## 2. MeridIAn aparece como usuario invitable (pickers + lista de usuarios)

### Diagnóstico

`getOrCreateMeridianProfile` crea un `user_profile` real con `is_bot = true` y su
`membership`. `GET /identity/users` (`buildIdentityUsersWhere`) no filtra bots, así
que MeridIAn aparece en "Añadir miembros", en `CreateChatModal` y en la pantalla
de usuarios. Seleccionarlo e invitarlo es un candidato para el "Error agregando
miembros" (500 genérico; el stack real queda en el log del API del VPS vía
`handleError`).

### Acción

- `apps/api/src/index.js` → `buildIdentityUsersWhere`: añadir `where.isBot = false`
  incondicional. Cubre todos los consumidores (pickers de chat + pantalla de
  usuarios). Un bot no tiene login ni es administrable.
- Test: `apps/api/src/services/__tests__/` — si hay suite de identity users,
  añadir caso "excluye is_bot". Si no, añadir asserción mínima donde exista
  cobertura de `/identity/users`.

---

## 3. Picker "Añadir miembros": borde recortado + poco feedback

### Diagnóstico

`UserPickerItem` marca la selección con `ring-1 ring-[hsl(var(--primary))]`. El
contenedor scroll de `AddChannelMembersDialog` (`max-h-56 overflow-y-auto -mx-1
px-1`) fuerza `overflow-x: auto` (spec CSS: si un eje no es `visible`, el otro
`visible` pasa a `auto`) → el anillo de 1px se recorta en el borde derecho y en
las esquinas.

### Acción

- `UserPicker.jsx` → `UserPickerItem`: cambiar `ring-1` por
  `ring-1 ring-inset` (el anillo se dibuja dentro de la caja, nunca lo recorta el
  overflow). Mantener `bg-[hsl(var(--primary)/0.1)]`.
- `AddChannelMembersDialog.jsx` y `CreateChatModal.jsx`: subir el respiro del
  contenedor scroll a `-mx-2 px-2 py-1` para que el hover/rounded no queden a ras.
- `AddChannelMembersDialog.jsx`: el error ya se muestra inline; además propagar
  `err.message` tal cual (ya lo hace) y añadir `toast.error` para que sea visible
  aunque el usuario haya scrolleado. Texto de fallback con la misma ortografía
  que la API ("Error agregando miembros.").

No se toca el contrato de la API de miembros.

---

## 4. Header del canal saturado en móvil (Raul: "Ambos")

### Diagnóstico

`ChatHeader.jsx` modo normal renderiza hasta 8 controles sueltos antes del `⋮`:
llamada voz, video, enlace-invitado, MeridIAn, buscar, archivos, fijados, `⋮`.
En móvil el título (`flex-1 min-w-0`) queda sin ancho.

### Acción (ambas opciones)

1. **Agrupar llamadas**: un solo botón `Phone`/`Video` "Llamar" con
   `DropdownMenu` → "Llamada de voz", "Videollamada", y (si aplica)
   "Invitar a alguien externo". Reemplaza los 2–3 botones sueltos actuales.
   Visible en todos los tamaños.
2. **Colapsar el resto en móvil**: bajo `sm` (usar `hidden sm:flex` en los
   botones secundarios y moverlos al `DropdownMenuContent` con `sm:hidden`
   items), dejar visibles solo: avatar+título, botón "Llamar" agrupado, buscar,
   `⋮`. Archivos, MeridIAn y fijados pasan al `⋮` en móvil; en `sm+` siguen
   sueltos como hoy.
   - Fijados: si `pinnedCount > 0` y estamos en móvil, item en `⋮` con el conteo.
   - MeridIAn: item en `⋮` en móvil ("Preguntar a MeridIAn"), respetando
     `meridianDisabled`.
3. Mantener intactos los modos `selection`, `search` y `external`.
4. No romper props: la firma de `ChatHeader` no cambia; solo reorganiza el JSX
   del bloque "Normal mode".

Revisar en 390px y 1440px (captura obligatoria, ver feedback de QA).

---

## 5. Reproductor de audio: no llega a la derecha + invisible en tema claro + errores

### Diagnóstico

`MessageAttachments.jsx` → `AudioCard`:
- `style={{ width: 244 }}` fijo → la burbuja se encoge a 244px y deja hueco.
- `barRest = isOwn ? rgba(255,255,255,0.30) : "hsl(var(--border))"` → en tema
  claro las barras "sin reproducir" son casi blancas sobre la burbuja recibida.
- `probeDuration` hace `audio.currentTime = 1e101`; varios navegadores móviles
  lanzan y dejan `loadError` pegado → "no se reproduce / da error".

### Acción

1. **Ancho**: `style={{ width: "100%", minWidth: 200, maxWidth: 340 }}` (llena la
   burbuja; la onda con `flex-1` se expande hasta el borde derecho). La burbuja
   ya está limitada por `max-w-[72%] sm:max-w-[65%]`.
2. **Colores tema claro**: para `!isOwn`
   - `barRest = "hsl(var(--muted-foreground) / 0.35)"`
   - `barPlayed = "hsl(var(--primary))"`
   - `playBg` se mantiene `hsl(var(--primary))`, `playColor` `--primary-foreground`.
   Para `isOwn` se mantienen los `rgba(255,255,255,*)`.
3. **Robustez de duración/playback**:
   - Envolver el `audio.currentTime = 1e101` en try/catch (ya lo tiene el bloque
     exterior; asegurar que `seekingForDurationRef` se limpia en `catch`).
   - Si `probeDuration` no consigue duración tras `onCanPlay`, no marcar error:
     dejar `timeLabel` en `--:--` y permitir reproducir igual (seek deshabilitado
     hasta que `onTimeUpdate` reporte progreso).
   - `onError`: antes de fijar `loadError`, si aún no se ha reintentado una vez,
     `refetch()` + `audio.load()` (una sola vez, con ref-guard) — cubre signed URL
     expirada, que es la causa más común.
4. Test: `apps/desktop/.../lib/__tests__/` no cubre el componente; añadir, si es
   barato, un test de `fmtAudioTime`/`seedBars` no-regresión. El resto es QA
   manual (reproducir una nota de voz en tema claro y oscuro, móvil y desktop).

---

## Orden de ejecución

1. API: `buildIdentityUsersWhere` isBot filter (#2).
2. UI compartida: `PermissionFeatureTree` labels (#1), `UserPicker` ring-inset (#3).
3. `AddChannelMembersDialog` + `CreateChatModal` padding/toast (#3).
4. `MessageAttachments` AudioCard (#5).
5. `ChatHeader` reorg (#4).
6. Spec borrador per-user grants (#1.3).
7. Verificar: `pnpm lint`, `node --test apps/api/src/**/__tests__`, tests de chat
   desktop, `pnpm build`.
8. QA manual pendiente (documentar como abierto): 390/1440 header, audio ambos
   temas, invitar miembro real, `@MeridIAn` tras conceder el permiso a un rol.

## Fuera de alcance / abierto

- Feature de permisos directos por usuario (#1.3) — spec aparte.
- Causa raíz exacta del 500 "Error agregando miembros" con un humano válido —
  requiere el stack del log del API del VPS; el filtro de bots elimina el
  disparador más probable.
- Sin QA en navegador en esta sesión.
