# atlas.chat — MeridIAn Spec 2: panel del asistente + "Preguntar a MeridIAn" por mensaje

- **Estado:** aprobado (self-approved 2026-09-07 por instrucción del usuario)
- **Depende de:** Spec 1 (motor), Spec 4 (router) — ambos en `main`.
- **Overview:** `docs/superpowers/specs/2026-09-07-chat-meridian-overview.md`
- **Referencia UI:** el sidebar del asistente de PFM
  (`apps/desktop/src/modules/atlas.pfm/components/PfmAssistantSidebar.jsx`,
  `hooks/use-pfm-assistant.js`) y sus tablas
  (`PfmAssistantThread`/`PfmAssistantMessage`).

## 1. Objetivo

Dentro de **cualquier conversación** (`direct`, `channel`, `group` — NO la propia
`meridian`), un panel lateral **privado del usuario** para preguntarle a MeridIAn
sobre **esa** conversación:

- "Resume los últimos 30 mensajes."
- "¿De qué trata este hilo?"
- "Explícame este mensaje" (vía la acción por mensaje).
- "¿Qué archivos se compartieron esta semana?"
- Preguntas generales (conocimiento) también valen (router de Spec 4).

Y una acción **"Preguntar a MeridIAn"** en el menú de un mensaje que abre el panel
con ese mensaje (y sus adjuntos) como tema.

### No-objetivos (v1)

- No es el chat directo (esa es Spec 1) ni la mención pública (Spec 3): el panel
  es **solo para ti**, nadie más lo ve.
- No múltiples hilos por conversación: **un hilo por (usuario, conversación)**,
  con "limpiar".
- No streaming. La petición es **síncrona** (como el asistente de PFM): el POST
  bloquea hasta la respuesta, con spinner.
- No en `external_support` ni en la conversación `meridian`.
- No acciones/escrituras. Solo lectura + responder.

## 2. Modelo de datos (Prisma, no AME3)

Migración a mano + `prisma migrate deploy`.
`prisma/migrations/20260907050000_chat_meridian_panel/migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS "chat_meridian_thread" (
  "id"                   UUID PRIMARY KEY DEFAULT uuidv7(),
  "company_id"           UUID,
  "owner_profile_id"     UUID NOT NULL,
  "host_conversation_id" UUID NOT NULL,
  "enabled"              BOOLEAN NOT NULL DEFAULT true,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- one live thread per (owner, host conversation)
CREATE UNIQUE INDEX IF NOT EXISTS "chat_meridian_thread_owner_host_idx"
  ON "chat_meridian_thread" ("owner_profile_id", "host_conversation_id")
  WHERE "enabled" = true;

CREATE TABLE IF NOT EXISTS "chat_meridian_message" (
  "id"         UUID PRIMARY KEY DEFAULT uuidv7(),
  "thread_id"  UUID NOT NULL REFERENCES "chat_meridian_thread"("id") ON DELETE CASCADE,
  "role"       TEXT NOT NULL,            -- 'user' | 'assistant'
  "content"    TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "chat_meridian_message_thread_idx"
  ON "chat_meridian_message" ("thread_id", "created_at");
```

`prisma/schema.prisma`: modelos `ChatMeridianThread` + `ChatMeridianMessage`
(mapeados). `chat_meridian_run` ya tiene `surface`; el panel usa
`surface = 'panel'`.

Aislamiento: todo filtra por `owner_profile_id = <actor>`. Un hilo de otro
usuario → 404. El `host_conversation_id` se valida con `assertMember` del actor
(via `chatService.listMessages`, que ya lo hace) antes de crear el hilo.

## 3. API

Router: se añade a `meridian-routes.js`. Todos con `requirePermission("chat.meridian.use")`.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `GET` | `/chat/meridian/panel/:conversationId` | — | `{ data: { threadId, messages: [{ role, content, createdAt }] } }` (get-or-create; 404 si el actor no es miembro de esa conversación) |
| `POST` | `/chat/meridian/panel/:conversationId/messages` | `{ content: string (<=2000), focusMessageId?: uuid }` | `{ data: { message: { role: "assistant", content, createdAt } } }` (síncrono) |
| `DELETE` | `/chat/meridian/panel/:conversationId` | — | `{ data: { cleared: true } }` (soft-delete: `enabled=false`; un GET posterior crea uno nuevo) |

Errores: sin `GROQ_API_KEY` → 503 "MeridIAn no está configurado."; actor no
miembro → 404; `content` vacío/>2000 → 400; rate limit (reusa `checkRate`) →
429; Groq caído → 502.

SDK (`packages/sdk/src/domains/chat.js`, subgrupo `meridian`):
`panel(conversationId, token)`, `panelSend(conversationId, { content, focusMessageId }, token)`,
`panelClear(conversationId, token)`.

## 4. Motor — `handlePanelMessage`

En `meridian-service.js`:

```
handlePanelMessage({ companyId, ownerProfileId, ownerAuthUserId, hostConversationId, threadId, content, focusMessageId })
  -> checkRate(ownerProfileId)  (429 si excede)
  -> classifyTurn({ conversationId: hostConversationId, userText: content })   (Spec 4)
  -> construir messages:
       system = panelSystemPrompt(hostConversationId-hint)
       + (si focusMessageId) un bloque de contexto: "El usuario pregunta sobre este mensaje: <cuerpo recortado> [de <sender>, <fecha>]" y, si tiene adjunto imagen, su attachmentId para describe_image
       + historial del hilo (ultimas 20 filas de chat_meridian_message)
       + { role: "user", content }
  -> route "live"  -> rama compound de Spec 4 (hoy degrada)
     route chat/general -> loop gpt-oss con TOOL_DEFS de Spec 1
        ctx.conversationId = hostConversationId (get_recent_messages / list_conversation_files / describe_image quedan fijados al chat anfitrion; get_conversation_messages / search_my_conversations siguen validando membresia del actor)
  -> persistir fila 'user' y fila 'assistant' en chat_meridian_message
  -> chat_meridian_run con surface='panel', route, router_ms
  -> devolver { message: { role:'assistant', content, createdAt } }
```

`panelSystemPrompt()` = variante de `chatSystemPrompt()` con una línea extra:
"El usuario está viendo una conversación de chat; usa get_recent_messages para
leer sus mensajes recientes. Este panel es privado: solo lo ve quien pregunta."

`get-or-create thread`: `INSERT ... ON CONFLICT (owner_profile_id, host_conversation_id) WHERE enabled DO NOTHING RETURNING id`; si no devuelve fila, `SELECT` el existente.

Historial enviado al modelo: 20 filas del hilo (no del chat anfitrión — ese lo
lee por herramienta).

## 5. Frontend

### 5.1 `MeridianPanel` (Sheet lateral derecho)

`apps/desktop/src/modules/atlas.chat/components/MeridianPanel.jsx`:
- Un `Sheet` de `@atlas/ui` (slide-over derecho), **no** un panel embebido en el
  flex de `ChatWindow` (ese archivo ya es enorme). `side="right"`, ancho ~380 px
  / full en móvil.
- Contenido: header "MeridIAn · privado", lista de mensajes (burbujas usuario /
  asistente con la identidad Sparkles ya existente), `MessageComposer`-lite o un
  `TextareaField` + botón enviar, botón "Limpiar" (`ConfirmDialog`).
- Estado abierto en `useState` dentro de `ChatWindow`; el `Sheet` se monta
  siempre pero `open` controlado.
- Si `useMeridianStatus().available === false` → el botón de abrir se muestra
  deshabilitado con tooltip "No configurado".

### 5.2 Punto de entrada

- **Botón en el header de `ChatWindow`**: un `headerBtnCls` con ícono `Sparkles`,
  a la izquierda del de búsqueda, visible salvo `type === 'meridian'` / `type ===
  'external_support'`. `onClick` → abre el panel sin `focusMessage`.
- **Acción por mensaje**: en el menú de acciones del mensaje
  (`buildMessageActions` / `MessageActionSheet` / el popover), añadir
  "Preguntar a MeridIAn" (ícono `Sparkles`). `onAskMeridian(message)` sube a
  `ChatWindow`, que abre el panel con `focusMessage = message` y auto-envía una
  primera pregunta ("¿Qué me puedes decir de este mensaje?") **o** solo precarga
  el composer con esa pregunta (preferido: precargar, el usuario decide). El
  `focusMessageId` se manda en `panelSend`.

### 5.3 Hook

`hooks/useMeridianPanel.js`:
- `useMeridianPanelThread(conversationId, { enabled })` — `GET .../panel/:id`.
- `useSendMeridianPanel(conversationId)` — mutación `POST`, invalida el thread.
- `useClearMeridianPanel(conversationId)` — `DELETE`.

### 5.4 UI-first

Todo `@atlas/ui` (`Sheet`, `Button`, `TextareaField`, `ConfirmDialog`,
`EmptyState`, `Badge`, lucide `Sparkles`). Sin nativos, sin `window.*`.

## 6. Seguridad

| Riesgo | Mitigación |
|---|---|
| Ver el panel de otro usuario | Todo filtra por `owner_profile_id`; hilo ajeno → 404 |
| Leer un chat del que no eres miembro | `assertMember` del actor sobre `host_conversation_id` al crear el hilo y en cada herramienta (`get_recent_messages` etc. ya lo hacen) |
| `focusMessageId` de otra conversación | Se valida que el mensaje pertenezca a `hostConversationId` antes de inyectarlo |
| Prompt-injection | Herramientas solo lectura, cláusula anti-inyección, sin acciones; el panel es privado |
| Costo | `checkRate` por usuario; router; `surface='panel'` para medir; historial recortado a 20 |

## 7. Pruebas

Backend `meridian-panel.test.js`:
1. `GET /panel/:id` crea el hilo (idempotente: 2 GET → mismo `threadId`).
2. Actor no miembro de `:id` → 404, sin crear hilo.
3. `POST .../messages` → persiste fila `user` + `assistant`, devuelve la del
   asistente; `chat_meridian_run.surface === 'panel'`.
4. `focusMessageId` de otra conversación → se ignora / 400 (no se inyecta).
5. Aislamiento: `GET`/`POST` sobre un `threadId` de otro `owner` → 404.
6. `DELETE` → `enabled=false`; siguiente `GET` crea uno nuevo (distinto id).
7. Sin `GROQ_API_KEY` → `POST` → 503.
8. Router: `content` "¿cuánto está el dólar?" → `route='live'` → rama compound
   (hoy: mensaje "no internet"), fila `assistant` igual se persiste.

Frontend: helpers puros si los hay (formato de burbuja, predicado "mostrar botón
del panel"). Sin tests de componentes (no hay RTL).

## 8. Alcance de implementación — dos planes

- **Plan A (API + datos + motor):** migración + modelos, `handlePanelMessage`,
  `panelSystemPrompt`, get-or-create thread, 3 endpoints en `meridian-routes.js`,
  SDK, tests backend. Verificable con script de diagnóstico.
- **Plan B (UI):** `MeridianPanel` (Sheet), botón en el header de `ChatWindow`,
  acción "Preguntar a MeridIAn" en el menú de mensaje, `useMeridianPanel`,
  `build:web` verde, QA 390/1440.

## 9. Fuera de alcance (v3)

- Múltiples hilos por conversación / historial navegable.
- Streaming de la respuesta del panel.
- Que el panel proponga acciones (crear tarea, recordatorio) con confirmación.
- Compartir un fragmento de la conversación con el panel como "adjunto".
- Panel en `atlas.chat` widget flotante / mini-ventanas.
