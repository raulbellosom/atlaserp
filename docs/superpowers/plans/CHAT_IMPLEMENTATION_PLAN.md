# Atlas ERP — Chat Module Implementation Plan
**Status**: AUTO-APPROVED  
**Date**: 2026-06-25  
**Spec**: docs/superpowers/specs/CHAT_SPEC.md

---

## Phase A — Infrastructure & API

### A1. SQL Migration
- File: `prisma/migrations/20260625000000_add_chat_tables/migration.sql`
- Creates 6 tables: `chat_conversations`, `chat_conversation_members`, `chat_messages`, `chat_message_reads`, `chat_attachments`, `chat_guest_sessions`
- Adds indexes for conversation queries
- Enables Supabase Realtime publication on chat tables
- Adds RLS policies for internal users

### A2. Chat Validators
- File: `packages/validators/src/chat.js`
- Exports: `chatCreateConversationSchema`, `chatSendMessageSchema`, `chatUpdateConversationSchema`, `chatAddMembersSchema`, `chatGuestSessionSchema`, `chatGuestMessageSchema`
- Re-exported from `packages/validators/src/index.js`

### A3. Chat Service
- File: `apps/api/src/routes/chat/chat-service.js`
- Factory: `createChatService({ prisma, supabaseAdmin })`
- Methods: `listConversations`, `createConversation`, `getConversation`, `sendMessage`, `listMessages`, `addMembers`, `removeMember`, `markRead`, `editMessage`, `softDeleteMessage`, `listExternalInbox`, `assignOperator`, `closeExternalConversation`, `presignAttachmentUpload`

### A4. Guest Service
- File: `apps/api/src/routes/chat/guest-service.js`
- Factory: `createGuestChatService({ prisma, supabaseAdmin })`
- Methods: `createGuestSession`, `getGuestSession`, `sendGuestMessage`, `listGuestMessages`, `closeGuestSession`

### A5. Chat Router
- File: `apps/api/src/routes/chat/index.js`
- Exports `createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission })`
- Mounts all `/chat/*` and `/public/chat/*` endpoints

### A6. API Integration
- Edit `apps/api/src/index.js` — import and mount `createChatRouter`
- Edit `apps/api/src/manifests/official/feature-modules.js` — add `atlas.chat` manifest

---

## Phase B — SDK

### B1. Chat SDK Domain
- File: `packages/sdk/src/domains/chat.js`
- Exports `createChatDomain(request, withAuthHeaders, toQueryString)`
- Methods mirror all API endpoints
- Edit `packages/sdk/src/index.js` — import and add `chat` domain to client

---

## Phase C — Frontend

### C1. Chat Hooks
- `apps/desktop/src/modules/atlas.chat/hooks/`
  - `useChatConversations.js` — TanStack Query list + Postgres Changes subscription
  - `useChatMessages.js` — TanStack Query messages + Postgres Changes subscription
  - `useRealtimeMessages.js` — Supabase Realtime subscription helper
  - `useChatPresence.js` — Supabase Presence per channel
  - `useTypingIndicator.js` — Broadcast send/receive
  - `useSendMessage.js` — mutation + optimistic update
  - `useMarkRead.js` — mutation on conversation open

### C2. Chat Components
- `apps/desktop/src/modules/atlas.chat/components/`
  - `ChatLayout.jsx` — two-column layout (sidebar + main)
  - `ChatSidebar.jsx` — conversation list + new chat button
  - `ChatConversationItem.jsx` — avatar, name, last message, unread badge
  - `ChatWindow.jsx` — main message area orchestrator
  - `ChatHeader.jsx` — title, participants, presence dots
  - `ChatMessageList.jsx` — scrollable list with date separators
  - `ChatMessageBubble.jsx` — own vs other, system messages, deleted state
  - `MessageComposer.jsx` — textarea + send + attachment button
  - `TypingIndicator.jsx` — animated "... typing"
  - `PresenceAvatars.jsx` — online indicator dots
  - `CreateChatModal.jsx` — user picker for direct/group
  - `AttachmentPreview.jsx` — inline image / file card

### C3. Chat Screens
- `apps/desktop/src/modules/atlas.chat/screens/ChatScreen.jsx`
- `apps/desktop/src/modules/atlas.chat/screens/ExternalInboxScreen.jsx`
- Register both in `apps/desktop/src/app/ModuleOutlet.jsx` SCREEN_MAP

### C4. External Widget
- `apps/desktop/src/modules/atlas.chat/widget/ExternalChatWidget.jsx`
- Self-contained, uses guest API endpoints
- Session management via localStorage

---

## Validation Checklist

- [ ] Migration applies cleanly: `pnpm db:migrate`
- [ ] API starts without errors: `pnpm dev:api`
- [ ] Chat conversations endpoint responds: `GET /chat/conversations`
- [ ] Supabase Realtime subscription fires on new message insert
- [ ] Frontend renders chat screen at `/app/m/atlas.chat/chat/inbox`
- [ ] Can create a conversation and send a message
- [ ] Second browser tab receives message via Realtime
- [ ] Typing indicator shows via Broadcast
- [ ] Guest session can be created via `POST /public/chat/session`
- [ ] Guest message appears in external inbox
- [ ] Build does not break: `pnpm build`
