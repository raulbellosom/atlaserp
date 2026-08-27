# Atlas Calls (LiveKit) — Design Spec

**Date:** 2026-08-27
**Módulo:** `atlas.chat` (nueva capacidad — llamadas de voz/video nativas)
**Status:** Approved para diseño — **implementación diferida** (ver §12)

## 1. Context

Hoy `atlas.calendar` tiene un campo `CalendarEvent.videoUrl` puramente decorativo: un link externo (Zoom/Meet/lo que sea) que el usuario pega a mano. No existe ninguna infraestructura de llamadas en el repo — ni modelo de datos, ni señalización, ni transporte WebRTC.

Este spec diseña **Atlas Calls**: llamadas de voz/video 1:1 y grupales nativas dentro de `atlas.chat`, disparables tanto ad-hoc desde cualquier conversación como desde una reunión agendada en `atlas.calendar` (el conector diseñado en el Spec A hermano, `2026-08-27-chat-projects-calendar-connectors-design.md`). El único punto de contacto entre ambos specs es `Call.calendarEventId`, opcional.

Es un diseño completo y aprobado, pero **la implementación se difiere a un ciclo futuro** — este documento existe para que, cuando se implemente, no haya que rediseñar la arquitectura ni retrabajar el conector de Calendario del Spec A.

---

## 2. Alcance

### Incluido (en el diseño — no en esta fase de implementación)

- Modelo de datos `Call` / `CallParticipant`.
- Señalización de estado de llamada (ringing/accepted/rejected/missed/ended) vía Supabase Realtime sobre las tablas anteriores.
- Servicio Hono de emisión de tokens LiveKit (nunca expone `LIVEKIT_API_SECRET` al navegador).
- Transporte de audio/video/screen-share vía LiveKit self-hosted, desacoplado de Hono/Supabase.
- Infraestructura de instalador: `LIVEKIT_MODE=embedded|external|disabled`, servicios Docker, generación de credenciales.
- Dos puntos de entrada: llamada ad-hoc desde cualquier conversación, y "Iniciar llamada" desde una reunión agendada (Spec A).

### Excluido (explícito, de esta fase)

- **Toda implementación de código** — este spec no se ejecuta ahora; ver §12.
- Grabación de llamadas.
- Transcripción / IA en llamada.
- Llamadas desde la app móvil (fuera de alcance de Atlas Desktop/Web por ahora).
- TURN server dedicado — se documenta como consideración de despliegue (§6) pero no se diseña su configuración detallada en este ciclo.

---

## 3. Arquitectura

### Separación de responsabilidades

```
Frontend (livekit-client) ──WebRTC directo──> LiveKit (transporte: audio/video/screen-share)
Frontend ──REST──> Hono (permisos, tokens JWT, estado de negocio)
Hono ──Prisma──> Supabase Postgres (Call, CallParticipant — fuente de verdad)
Frontend ──suscripción──> Supabase Realtime (Postgres Changes sobre call/call_participant)
```

Hono es el **único** backend de negocio — no se crea un "Calls API" separado. LiveKit se trata exclusivamente como motor de transporte WebRTC, igual que Supabase se trata exclusivamente como base de datos + realtime; ninguno de los dos conoce reglas de negocio.

### Flujo de una llamada

1. `POST /calls` (Hono) — valida que el llamante es miembro activo de la conversación → crea `Call` (status `RINGING`) + una fila `CallParticipant` por cada miembro objetivo (status `RINGING`) → genera `livekitRoomName = call_{callId}` → devuelve `{ callId, livekitUrl, token }`.
2. Los clientes de los demás miembros ya están suscritos (vía `RealtimeProvider.jsx`, existente) a cambios en `call_participant` filtrados por su `userId` → reciben el "ringing" sin polling.
3. Cada participante que acepta llama a `POST /calls/:id/join` → Hono valida, marca `CallParticipant.status = JOINED`, `joinedAt`, y devuelve un token LiveKit fresco con grants limitados a esa sala.
4. El cliente conecta directo a LiveKit (`livekit-client`) con ese token — audio/video/screen-share fluye SFU, sin pasar por Hono ni Supabase.
5. `POST /calls/:id/leave|decline|end` actualizan estado; cuando el último participante activo sale, Hono marca `Call.status = ENDED` y cierra la sala vía el SDK de servidor de LiveKit (o se apoya en el timeout nativo de sala vacía de LiveKit como red de seguridad).

### Autoridad de tokens

Solo Hono conoce `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`. El navegador únicamente recibe el JWT de corta duración, con grants acotados a la sala específica de esa llamada — nunca credenciales de administración de LiveKit.

---

## 4. Modelo de datos (Prisma)

```prisma
enum CallKind {
  AUDIO
  VIDEO
}

enum CallStatus {
  RINGING
  ACTIVE
  ENDED
}

enum CallParticipantStatus {
  INVITED
  RINGING
  JOINED
  LEFT
  DECLINED
  MISSED
}

model Call {
  id                String     @id @default(dbgenerated("uuidv7()")) @db.Uuid
  conversationId    String     @db.Uuid @map("conversation_id")
  // Sin relación Prisma: chat_conversations es tabla raw-SQL (fuera de schema.prisma).
  // Mismo patrón sin-FK-declarado que CalendarEvent.sourceEntityId.
  calendarEventId   String?    @db.Uuid @map("calendar_event_id")
  kind              CallKind
  status            CallStatus @default(RINGING)
  initiatedByUserId String     @db.Uuid @map("initiated_by_user_id")
  livekitRoomName   String     @unique @map("livekit_room_name")
  startedAt         DateTime?  @map("started_at")
  endedAt           DateTime?  @map("ended_at")
  endReason         String?    @map("end_reason") // ended | missed | rejected | failed
  createdAt         DateTime   @default(now()) @map("created_at")

  initiator     UserProfile     @relation(fields: [initiatedByUserId], references: [id])
  calendarEvent CalendarEvent?  @relation(fields: [calendarEventId], references: [id])
  participants  CallParticipant[]

  @@index([conversationId])
  @@index([calendarEventId])
  @@map("call")
}

model CallParticipant {
  id              String                 @id @default(dbgenerated("uuidv7()")) @db.Uuid
  callId          String                 @db.Uuid @map("call_id")
  userId          String                 @db.Uuid @map("user_id")
  status          CallParticipantStatus  @default(INVITED)
  livekitIdentity String?                @map("livekit_identity")
  joinedAt        DateTime?              @map("joined_at")
  leftAt          DateTime?              @map("left_at")
  createdAt       DateTime               @default(now()) @map("created_at")

  call Call        @relation(fields: [callId], references: [id], onDelete: Cascade)
  user UserProfile @relation(fields: [userId], references: [id])

  @@unique([callId, userId])
  @@map("call_participant")
}
```

Acceso a la llamada = ser miembro activo de `conversationId` (mismo check ya usado para enviar mensajes). No se crean permisos RBAC nuevos.

---

## 5. Contrato API (Hono)

- `POST /calls` — `{ conversationId, kind, calendarEventId? }` → `{ callId, livekitUrl, token }`.
- `POST /calls/:id/join` → `{ token }` (token fresco).
- `POST /calls/:id/decline` — marca al llamado como `DECLINED`.
- `POST /calls/:id/leave` — marca al participante como `LEFT`; si era el último activo, `Call.status = ENDED`.
- `POST /calls/:id/end` — solo el iniciador o un admin de la conversación; fuerza `ENDED` para todos.
- `GET /calls/:id` — estado actual (para reconexión tras refresh).

Todas las rutas devuelven `501 Not Implemented` si `LIVEKIT_MODE` es `disabled` o si `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` no están configuradas.

---

## 6. Infraestructura del instalador

### Modo configurable

`LIVEKIT_MODE=embedded|external|disabled` (default `disabled` en instalaciones existentes — no rompe upgrades).

### Dos URLs

El navegador abre la conexión WebRTC directo contra LiveKit (nunca a través de Hono); Hono solo administra rooms/tokens vía el SDK de servidor. Igual que Atlas ya distingue la URL interna de Docker (`http://api:4010`, usada por `nginx/spa.conf`) de la URL pública (`ATLAS_API_URL`), LiveKit necesita la misma distinción:

- `LIVEKIT_INTERNAL_URL` — solo la usa Hono (ej. `http://livekit:7880` en modo `embedded`, o la URL de la VPS RTC en modo `external`).
- `LIVEKIT_URL` — pública (`wss://rtc.tudominio.com`), expuesta al frontend como `VITE_LIVEKIT_URL`.

### `.env.external.example` / `.env.local.example` — nuevo grupo (mismo patrón que `GOOGLE_OAUTH_*`)

```env
# ── Atlas Calls / LiveKit (opcional) ────────────────────────────────────────
# embedded: Atlas instala y levanta LiveKit + Redis en esta misma VPS.
# external: usa una instancia LiveKit ya desplegada (otra VPS/RTC dedicada).
# disabled: no se instalan ni activan llamadas.
LIVEKIT_MODE=disabled
LIVEKIT_URL=
LIVEKIT_INTERNAL_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

### `docker-compose.yml`

Nuevos servicios `livekit` y `livekit-redis` bajo un perfil Compose adicional `livekit` (se combina con `local`/`external`, no los reemplaza: `docker compose --profile external --profile livekit up -d`). Puertos publicados explícitamente en el compose base (`7880/tcp` señalización, `7881/tcp` RTC-over-TCP fallback, un único puerto UDP de ICE — LiveKit permite configurar un solo puerto UDP en vez del rango completo `50000-60000/UDP`, mucho más simple de abrir en firewall).

### `docker-compose.linux.yml` (override solo-Linux, ya existe para `host.docker.internal`)

Gana una entrada `livekit: network_mode: host` — LiveKit recomienda host networking en producción por el tipo de tráfico WebRTC (UDP/ICE); no aplica en Windows/macOS (Docker Desktop no soporta host networking de la misma forma, y el compose base con puertos publicados ya cubre desarrollo local).

### `setup-external.mjs` (y equivalente en `setup-local.mjs`)

Cuando `LIVEKIT_MODE=embedded`:
- Genera `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` automáticamente si están vacías (`crypto.randomBytes` — a diferencia de `GOOGLE_OAUTH_ENCRYPTION_KEY`, que hoy solo se documenta para generación manual, estas claves son internas Atlas↔LiveKit y el script las genera y escribe directamente).
- Genera `infra/installer/livekit/livekit.yaml` (config de Redis + puerto ICE) si no existe.
- Añade `livekit/livekit-server` y `redis` a la lista de imágenes a hacer `pull`.
- Añade `--profile livekit` al `docker compose up`.

Cuando `LIVEKIT_MODE=external`: no toca contenedores RTC, solo valida que las 4 variables estén rellenas antes de arrancar Atlas. Cuando `disabled`: no-op — el frontend oculta cualquier UI de llamadas.

### Documentación

`infra/installer/README.md` gana una sección "Modo LiveKit" bajo `local` y `external`; ambos `.env.*.example` documentan el grupo nuevo.

---

## 7. Permisos

Ninguno nuevo — pertenecer a la conversación es el único gate (ver §4).

---

## 8. UI — Puntos de entrada (cuando se implemente)

- **Ad-hoc**: botón "Llamar" en el header de `ChatWindow.jsx`/`MiniChatWindow.jsx` (1:1 o grupal) → `Call` sin `calendarEventId`.
- **Desde reunión agendada**: botón "Iniciar llamada" en `EventDetailModal` (atlas.calendar) para eventos con `sourceModule = 'atlas.chat'` → `Call` con `calendarEventId` seteado.

---

## 9. Edge cases

- Asistentes de la reunión que no son miembros del canal → quedan fuera de la llamada (no se auto-agregan a la conversación); resolver explícitamente en el plan de implementación si se necesita lo contrario.
- Llamante cierra la pestaña antes de que alguien conteste → timeout server-side marca a los `CallParticipant` en `RINGING` como `MISSED` y `Call.status = ENDED`.
- Doble llamada simultánea a la misma conversación → el segundo `POST /calls` debe fallar o unirse a la llamada `ACTIVE`/`RINGING` existente en vez de crear una segunda sala (a definir en el plan).
- `LIVEKIT_MODE` cambia de `embedded` a `external` en una instancia con llamadas históricas → `Call`/`CallParticipant` son solo historial (Postgres), no dependen de que la sala LiveKit siga existiendo.

---

## 10. Criterios de aceptación (para cuando se implemente)

- [ ] Una llamada ad-hoc 1:1 conecta audio bidireccional entre dos clientes en `LIVEKIT_MODE=embedded`.
- [ ] `LIVEKIT_API_SECRET` nunca aparece en ninguna respuesta HTTP ni en el bundle del frontend.
- [ ] Cambiar `LIVEKIT_MODE=embedded` → `external` (apuntando a otra VPS) no requiere cambios de código, solo de `.env`.
- [ ] Iniciar llamada desde una reunión de `atlas.calendar` la deja vinculada vía `Call.calendarEventId`.

---

## 11. Dependencias y riesgos

- Depende de que Spec A esté implementado (existencia de conversaciones vinculadas a proyectos/reuniones), aunque Atlas Calls también funciona sobre conversaciones sin ningún vínculo.
- Riesgo de infraestructura: WebRTC en producción es sensible a NAT/firewall — el plan de implementación debe incluir pruebas de conectividad real (no solo localhost) antes de marcar el criterio de aceptación como cumplido.
- Riesgo de alcance: si en el futuro se necesita TURN dedicado (redes muy restrictivas), es una extensión de infraestructura, no un cambio de arquitectura — ya contemplado en la separación embedded/external.

---

## 12. Roadmap de implementación futura (no ejecutar ahora)

Este spec queda **aprobado y congelado** para consulta. Su implementación se activa como un ciclo de trabajo propio, con su propio plan en `docs/superpowers/plans/`, cuando el negocio decida dar el siguiente paso de "reuniones con llamada real". No se crea ningún stub de código, migración, ni variable de entorno en el ciclo actual — eso pertenece al momento en que este spec pase a plan de implementación.
