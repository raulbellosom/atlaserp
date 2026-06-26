# Atlas ERP — Live Chat Module Technical Spec
**Status**: AUTO-APPROVED  
**Date**: 2026-06-25  
**Module key**: `atlas.chat`  
**Author**: Claude Code (architect agent)

---

## 1. Overview

A full real-time chat system for Atlas ERP with two distinct scenarios:

1. **Internal chat** — authenticated Atlas ERP users exchanging messages in 1:1 conversations and multi-user groups.
2. **External/support chat** — guest visitors from public websites (served by `atlas.website`) opening live support sessions with internal operators.

Both scenarios share the same database schema, Supabase Realtime infrastructure, and Hono API layer.

---

## 2. Architecture Decisions

| Concern | Decision |
|---|---|
| Real-time layer | Supabase Realtime (Postgres Changes + Broadcast + Presence) |
| API layer | Hono router, factory pattern, mounted in `apps/api/src/index.js` |
| Route location | `apps/api/src/routes/chat/` |
| Frontend module | `apps/desktop/src/modules/atlas.chat/` |
| Screen registration | `ModuleOutlet.jsx` SCREEN_MAP |
| Module manifest | Added to `apps/api/src/manifests/official/feature-modules.js` |
| SDK domain | `packages/sdk/src/domains/chat.js` |
| Validators | `packages/validators/src/chat.js` |
| Migration | `prisma/migrations/20260625000000_add_chat_tables/migration.sql` |
| Auth (internal) | Supabase JWT — existing `authMiddleware` on all internal endpoints |
| Auth (guest) | Opaque session token (SHA-256 hashed) stored in `chat_guest_sessions` |
| Cross-company chat | Allowed — `company_id` is metadata only, not an access filter |
| File attachments | Supabase Storage bucket `atlas-chat`, signed URLs |
| Typing indicators | Supabase Realtime Broadcast (ephemeral, no DB write) |
| Online presence | Supabase Realtime Presence per conversation channel |

---

## 3. Database Schema

### 3.1 `chat_conversations`

```sql
CREATE TABLE chat_conversations (
  id               UUID PRIMARY KEY DEFAULT uuidv7(),
  type             TEXT NOT NULL CHECK (type IN ('direct','group','external_support')),
  title            TEXT,
  avatar_url       TEXT,
  created_by_user_id UUID REFERENCES "UserProfile"(id) ON DELETE SET NULL,
  created_by_guest_id UUID,            -- FK to chat_guest_sessions
  website_id       UUID,               -- nullable, for external chats
  company_id       UUID,               -- context only, not access filter
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','pending','closed','archived')),
  last_message_id  UUID,
  last_message_at  TIMESTAMPTZ,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
```

### 3.2 `chat_conversation_members`

```sql
CREATE TABLE chat_conversation_members (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  conversation_id     UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES "UserProfile"(id) ON DELETE CASCADE,
  guest_session_id    UUID,            -- FK to chat_guest_sessions
  role                TEXT NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner','admin','member','operator','guest')),
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at             TIMESTAMPTZ,
  muted_until         TIMESTAMPTZ,
  last_read_at        TIMESTAMPTZ,
  last_read_message_id UUID,
  metadata            JSONB DEFAULT '{}'
);
```

### 3.3 `chat_messages`

```sql
CREATE TABLE chat_messages (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  conversation_id     UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_user_id      UUID REFERENCES "UserProfile"(id) ON DELETE SET NULL,
  sender_guest_id     UUID,            -- FK to chat_guest_sessions
  sender_type         TEXT NOT NULL CHECK (sender_type IN ('user','guest','system')),
  body                TEXT NOT NULL DEFAULT '',
  message_type        TEXT NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text','image','file','system')),
  attachment_count    INT NOT NULL DEFAULT 0,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at           TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);
```

### 3.4 `chat_message_reads`

```sql
CREATE TABLE chat_message_reads (
  message_id          UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL,
  user_id             UUID REFERENCES "UserProfile"(id) ON DELETE CASCADE,
  guest_session_id    UUID,
  read_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, COALESCE(user_id::TEXT, guest_session_id::TEXT))
);
```

### 3.5 `chat_attachments`

```sql
CREATE TABLE chat_attachments (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  message_id          UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL,
  bucket              TEXT NOT NULL DEFAULT 'atlas-chat',
  object_key          TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  size_bytes          BIGINT NOT NULL DEFAULT 0,
  width               INT,
  height              INT,
  uploaded_by_user_id UUID REFERENCES "UserProfile"(id) ON DELETE SET NULL,
  uploaded_by_guest_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.6 `chat_guest_sessions`

```sql
CREATE TABLE chat_guest_sessions (
  id               UUID PRIMARY KEY DEFAULT uuidv7(),
  session_token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of opaque token
  email            TEXT,
  name             TEXT,
  phone            TEXT,
  website_id       UUID,
  page_url         TEXT,
  referrer         TEXT,
  user_agent       TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  closed_at        TIMESTAMPTZ
);
```

---

## 4. Supabase Realtime Strategy

| Feature | Mechanism | Channel name |
|---|---|---|
| New messages | Postgres Changes (`INSERT` on `chat_messages` filtered by `conversation_id`) | `chat:conv:{id}` |
| Message updates/deletes | Postgres Changes (`UPDATE` on `chat_messages`) | `chat:conv:{id}` |
| Conversation list changes | Postgres Changes (`UPDATE` on `chat_conversations`) | `chat:user:{userId}:convlist` |
| Typing indicator | Broadcast (`typing` event) | `chat:conv:{id}` |
| Online presence | Presence | `chat:conv:{id}` |
| Guest new messages | Postgres Changes on `chat_messages` | `chat:guest:{guestSessionId}` |

**Important**: For internal users, Supabase Realtime channels use the authenticated session (anon key + JWT). For guest sessions, we use server-side broadcast via Hono API calling `supabaseAdmin.channel().send()` to push messages to the guest channel.

---

## 5. RLS Policies

### Internal users
- `chat_conversations`: user can SELECT if they have a row in `chat_conversation_members` with matching `user_id` and `left_at IS NULL`
- `chat_messages`: user can SELECT/INSERT if they are a member of the conversation
- `chat_conversation_members`: user can SELECT members of conversations they belong to

### Guest sessions
- No RLS on guest-facing tables — all guest operations go through Hono API endpoints (service role)
- Guests receive messages via Supabase Realtime using a dedicated guest channel authenticated by the Hono-issued guest token

### Realtime publication
- All chat tables added to Supabase Realtime publication

---

## 6. API Endpoints

### Internal (auth required)

| Method | Path | Description |
|---|---|---|
| GET | `/chat/conversations` | List conversations for current user |
| POST | `/chat/conversations` | Create direct or group conversation |
| GET | `/chat/conversations/:id` | Get conversation detail |
| PATCH | `/chat/conversations/:id` | Update title/status |
| GET | `/chat/conversations/:id/messages` | Paginated message history |
| POST | `/chat/conversations/:id/messages` | Send message |
| PATCH | `/chat/messages/:messageId` | Edit message body |
| DELETE | `/chat/messages/:messageId` | Soft-delete message |
| POST | `/chat/conversations/:id/members` | Add members |
| DELETE | `/chat/conversations/:id/members/:userId` | Remove member |
| POST | `/chat/conversations/:id/read` | Mark conversation read |
| GET | `/chat/external/inbox` | External support inbox |
| POST | `/chat/external/:conversationId/assign` | Assign operator |
| POST | `/chat/external/:conversationId/close` | Close external chat |
| POST | `/chat/attachments/presign` | Pre-sign upload URL |

### Public (no auth / guest token)

| Method | Path | Description |
|---|---|---|
| POST | `/public/chat/session` | Create guest session |
| GET | `/public/chat/session/:token` | Get guest session info |
| POST | `/public/chat/session/:token/messages` | Send guest message |
| GET | `/public/chat/session/:token/messages` | Get guest messages |
| POST | `/public/chat/session/:token/close` | Close guest session |

---

## 7. Module Manifest

```js
key: "atlas.chat"
name: "Chat"
core: false
uninstallable: true
permissions: ["chat.access", "chat.conversations.read", "chat.conversations.create", "chat.support.manage"]
navigation: [
  { label: "Chat", path: "/chat/inbox", icon: "MessageSquare", layout: "main" }
]
```

---

## 8. Frontend Module Structure

```
apps/desktop/src/modules/atlas.chat/
  screens/
    ChatScreen.jsx          -- main internal chat layout
    ExternalInboxScreen.jsx -- operator inbox for external chats
  components/
    ChatLayout.jsx
    ChatSidebar.jsx
    ChatConversationList.jsx
    ChatConversationItem.jsx
    ChatWindow.jsx
    ChatHeader.jsx
    ChatMessageList.jsx
    ChatMessageBubble.jsx
    MessageComposer.jsx
    TypingIndicator.jsx
    PresenceAvatars.jsx
    CreateChatModal.jsx
    AttachmentPreview.jsx
  hooks/
    useChatConversations.js
    useChatMessages.js
    useRealtimeMessages.js
    useChatPresence.js
    useTypingIndicator.js
    useSendMessage.js
    useMarkRead.js
  lib/
    chatUtils.js
    supabaseRealtime.js
```

---

## 9. External Widget

```
apps/desktop/src/modules/atlas.chat/widget/
  ExternalChatWidget.jsx    -- embeddable public-facing widget
```

Props: `{ websiteId, pageUrl, theme?, position?, operatorName? }`

Session persisted in `localStorage` as `atlas_chat_guest_token`.

---

## 10. Attachments

- Bucket: `atlas-chat` (private)
- Path: `conversations/{conversationId}/{messageId}/{filename}`
- Max size: 20 MB
- Allowed MIME: `image/*`, `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`, common archives
- Access: signed URLs (1 hour), generated by API on demand

---

## 11. Assumptions

1. No separate `websites` table exists yet — `website_id` is stored as UUID metadata, connected later.
2. All internal users are operators for external chat (no dedicated operator role needed in Phase 1).
3. Typing indicators are ephemeral Broadcast — no DB persistence.
4. Message pagination is cursor-based (by `created_at` DESC).
5. The `atlas-chat` Supabase Storage bucket must be created manually or via migration seed.
6. Supabase Realtime is already enabled on the self-hosted instance.
