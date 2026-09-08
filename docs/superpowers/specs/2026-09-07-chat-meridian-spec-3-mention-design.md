# atlas.chat — MeridIAn Spec 3: mención `@meridIAn` en canales y grupos

- **Estado:** aprobado (self-approved 2026-09-07 por instrucción del usuario)
- **Depende de:** Spec 1 (motor + chat directo) y Spec 4 (router) — ambos en `main`.
- **Overview:** `docs/superpowers/specs/2026-09-07-chat-meridian-overview.md`

## 1. Objetivo

En cualquier **canal o grupo**, un miembro escribe `@meridIAn <pregunta>` y MeridIAn
responde con un **mensaje visible para todos** en ese canal, usando el contexto
reciente de esa conversación.

Ejemplos:
- "@meridIAn resume lo que se dijo hoy en este canal"
- "@meridIAn ¿qué significa 'idempotente'?"
- "@meridIAn ¿cuánto está el dólar?" → (por ahora) "no puedo consultar internet"
  (mismo camino `live` de Spec 4, bloqueado por Groq compound).

### No-objetivos (v1)

- No en `external_support` (invitados) ni en la conversación `meridian` (esa va
  por `handleUserMessage`). **Actualización 2026-09-07:** sí se habilitó en
  `direct` (DM 1-a-1) además de canales/grupos — un usuario esperaba poder
  `@meridIAn` en un DM.
- No búsqueda entre conversaciones (`search_my_conversations`): en un canal
  "mis conversaciones" no tiene un dueño único. Solo contexto del canal.
- No `describe_image` en v1 (se puede añadir después; el canal ya tiene los
  adjuntos visibles para todos).
- No hilos: la respuesta va como mensaje normal del canal, citando (`reply_to`)
  al mensaje que mencionó.
- No configurable por canal (on/off por canal se deja para v2).

## 2. Detección de la mención

MeridIAn **no** se agrega como miembro de los canales. Se detecta un **token de
texto literal** en el cuerpo del mensaje, insensible a mayúsculas y acentos:

```
/(^|[\s(])@merid[ií]an\b/i
```

- Se evalúa en `sendMessage` (o en un hook justo después), **solo** cuando
  `conversationType` es `channel` o `group`.
- El `sender_type` del mensaje disparador debe ser `user` (nunca `assistant` ni
  `system`) — previene bucles.
- El emisor debe tener el permiso `chat.meridian.use`. Si no lo tiene, la
  mención se ignora en silencio (no hay respuesta, no hay error). El check se
  hace con el mismo `permissionsService`/RBAC del emisor (por `authUserId`).
- Si el mensaje además menciona a personas reales, eso sigue funcionando igual;
  la detección de `@meridIAn` es independiente.

## 3. Flujo

```
POST /chat/conversations/:id/messages  (endpoint existente)
  -> chatService.sendMessage(...)              (persiste el mensaje del usuario, igual que hoy)
  -> [hook, ya existe el de type==='meridian'] añadir rama:
       si type in (channel, group) y matchMeridianMention(body) y emisor tiene chat.meridian.use:
         meridianService.handleChannelMention({
           companyId, conversationId, actorProfileId, actorAuthUserId,
           triggerMessageId, mentionText
         })   // fire-and-forget, sin await
  -> responde 201 al emisor de inmediato (igual que hoy)

handleChannelMention (nuevo, en meridian-service.js)
  -> rate limit: checkRate(actorProfileId)  (el de Spec 1, 20/60s)
       + cooldown por canal: 1 respuesta / 15 s por conversationId (token-bucket en memoria)
       excedidos -> se ignora en silencio (NO se inserta "voy saturado" en un canal publico)
  -> classifyTurn({ conversationId, userText: mentionText })   (reusa Spec 4)
  -> runChannelTurn(route):
       route "live"    -> misma rama compound de Spec 4 (hoy degrada)
       route "chat"/"general" -> loop gpt-oss con UNA sola herramienta:
                                 get_channel_messages (contexto del canal, sin assertMember)
                                 + conocimiento general (prompt de Spec 4)
  -> inserta la respuesta como chat_messages en el canal:
       sender_type='assistant', sender_user_id=<bot de la empresa>,
       message_type='text', reply_to_message_id=<triggerMessageId>
     (reusa un helper tipo insertMeridianReply pero con reply_to)
  -> el broadcast de "mensaje nuevo" existente lo entrega por realtime a todo el canal
  -> chat_meridian_run con route, router_ms, y una marca surface='mention'
```

### 2.1 `get_channel_messages` (herramienta acotada)

- Igual que `get_recent_messages` de Spec 1 pero:
  - **No** llama a `chatService.listMessages` (ese hace `assertMember` y el bot no
    es miembro). Lee directo con `$queryRaw` los últimos N (≤40, def 25) mensajes
    NO borrados, NO de hilo, de **ese** `conversationId`, con el `display_name`
    del emisor.
  - Es seguro: el mensaje que disparó la mención vino de un miembro del canal, y
    la respuesta es pública en ese mismo canal — leer su historial reciente no
    expone nada que los presentes no vean ya.
  - Recorta a la forma segura (sin ids de auditoría), tope ~8 KB.
- El `TOOL_DEFS` del turno de mención es **solo** `[get_channel_messages]`.

### 2.2 System prompt del turno de mención

Variante de `chatSystemPrompt()`:
- "Estás respondiendo en un canal de chat de Atlas ERP; tu respuesta la ven
  todos los miembros del canal."
- "Solo tienes el historial reciente de ESTE canal (herramienta
  get_channel_messages) y tu conocimiento general."
- Conserva: anti-inyección, no acciones, no datos en vivo, español MX, texto
  plano, breve.
- "Si te mencionan sin una pregunta clara, responde brevemente qué puedes hacer."

## 4. Modelo de datos

Ninguna tabla nueva. `chat_meridian_run` gana una columna:

`prisma/migrations/20260907040000_chat_meridian_surface/migration.sql`:
```sql
ALTER TABLE "chat_meridian_run"
  ADD COLUMN IF NOT EXISTS "surface" TEXT NOT NULL DEFAULT 'direct';
```
Valores: `direct` (chat directo / Spec 1), `mention` (este spec). Spec 2 usará
`panel`. `prisma/schema.prisma` → `ChatMeridianRun`: `surface String @default("direct")`.

## 5. Cambios de código

### `apps/api/src/routes/chat/meridian-service.js`
- `matchMeridianMention(body)` exportada (regex de §2) — pura, testeable.
- `get_channel_messages` runner + su tool def (en `meridian-tools.js` o inline;
  probablemente un `buildChannelToolRunners({ prisma })` chico nuevo en
  `meridian-tools.js` para no tocar los runners con `listMessages`).
- `channelSystemPrompt()` (§2.2).
- `channelCooldowns = new Map()` + `checkChannelCooldown(conversationId)` (15 s).
- `handleChannelMention({...})` — orquesta §3. Reusa `classifyTurn`, `callGroqRaw`,
  el loop (parametrizando `runTurn` para aceptar un `toolset` y un `systemPrompt`,
  o un `runChannelTurn` hermano más simple).
- `insertAssistantMessage` ya se inyecta; añadir soporte para `replyToMessageId`
  (el helper `insertMeridianReply` en `index.js` acepta `body`; ampliarlo a
  `{ conversationId, body, replyToMessageId }`).
- `runTurn` audit: pasar `surface` (`"direct"` por defecto; `"mention"` desde
  `handleChannelMention`).

### `apps/api/src/routes/chat/index.js`
- En el hook de `POST /chat/conversations/:id/messages` (donde ya está la rama
  `type === 'meridian'`), añadir la rama `channel`/`group` + `matchMeridianMention`
  + check de permiso del emisor + `handleChannelMention(...)` sin await.
- `insertMeridianReply`: aceptar `replyToMessageId` opcional y añadirlo al INSERT.

### Permiso
Ninguno nuevo. Reusa `chat.meridian.use`. El check del emisor usa el
`requirePermission`/RBAC ya disponible (resolver desde `authUserId`).

## 6. Seguridad / abuso

| Riesgo | Mitigación |
|---|---|
| Spam de `@meridIAn` en un canal | Cooldown por canal (1 / 15 s) + rate limit por emisor (20 / 60 s). Excedido = silencio, no un mensaje de "saturado" en público. |
| Bucle (el bot se auto-menciona) | El disparador debe ser `sender_type='user'`; los mensajes `assistant` nunca entran al hook. |
| Prompt-injection desde el canal | Única herramienta es de lectura del propio canal; prompt anti-inyección; sin acciones; la respuesta es solo texto. |
| Fuga de otros canales | `get_channel_messages` está fijado al `conversationId` de la mención; no acepta otro id. |
| Usuario sin permiso "invoca" al bot | Check `chat.meridian.use` del emisor antes de responder; sin permiso, silencio. |
| Costo | Router + 1-2 llamadas gpt-oss por mención, con cooldown. `chat_meridian_run.surface='mention'` para medir volumen. |

## 7. Pruebas (`node --test`)

`meridian-mention.test.js`:
1. `matchMeridianMention`: matchea `@meridIAn`, `@meridian`, `hola @MeridIAn?`,
   `(@meridian)`; NO matchea `email@meridian.com`, `meridian` suelto,
   `@meridiano`.
2. `handleChannelMention`: inserta UNA respuesta `assistant` en el canal con
   `reply_to_message_id` = trigger; `run.surface === 'mention'`.
3. Contexto: `get_channel_messages` devuelve los mensajes del canal correcto
   (stub de `$queryRaw`), recortados; nunca llama a `listMessages`.
4. Cooldown: 2ª mención en el mismo canal dentro de 15 s → no se inserta 2ª
   respuesta.
5. Emisor sin `chat.meridian.use` → el hook no llama a `handleChannelMention`
   (test en `index.js` / router, o en el guard puro).
6. Bucle: un mensaje `sender_type='assistant'` que contiene `@meridian` → el
   hook lo ignora.
7. Routing: mención con "¿cuánto está el dólar?" → `route='live'` → rama compound
   (hoy: mensaje de "no puedo consultar internet"), `run.surface='mention'`.
8. Regresión: enviar a un canal SIN `@meridIAn` no dispara nada;
   `type==='meridian'` sigue yendo por `handleUserMessage` (Spec 1);
   los 246 tests de chat siguen verdes.

## 8. Frontend

Casi nada:
- El mensaje del bot en el canal se renderiza con la identidad Sparkles/MeridIAn
  que **ya** puso Spec 1 en `ChatMessageBubble` (`sender_type === 'assistant'`).
- Autocompletado de menciones: opcional añadir "MeridIAn" como candidato fijo en
  `useMentionCandidates` para canales cuando el usuario tiene `chat.meridian.use`,
  de modo que `@me…` lo sugiera. Si se hace, insertar el texto literal
  `@meridIAn` (no un token `@[uuid]`, porque el bot no es miembro). **Opcional en
  v1**, media hora; si se omite, el usuario igual puede escribir `@meridIAn` a
  mano y funciona.
- Sin cambios de rutas ni de `ChatWindow`.

## 9. Alcance de implementación — un plan

`meridian-service.js` + `meridian-tools.js` (helper de canal) + hook en
`index.js` + migración `surface` + tests. **Un Plan A.** El candidato de mención
en el autocompletado es un último task opcional (Plan B mínimo).

## 10. Fuera de alcance (v2)

- On/off de MeridIAn por canal (config del canal).
- `describe_image` en menciones.
- Responder en hilo en vez de en el timeline.
- Que MeridIAn "escuche" sin mención (resúmenes automáticos, etc.).
- Menciones en `external_support` (invitados) — nunca.
