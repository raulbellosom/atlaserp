# Chat Channels & Roles — Phase A: Foundation (data model + permission engine)

Date: 2026-08-25
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-25-chat-channels-roles-phase-a-design.md
Plan file: docs/superpowers/plans/2026-08-25-chat-channels-roles-phase-a.md (created after spec approval)

---

## 1. Feature title

Chat Channels & Roles — Phase A: Foundation (data model + permission engine)

## 2. Status

Draft

## 3. Context

Atlas ships a working chat module (`apps/api/src/routes/chat/`, `apps/desktop/src/modules/atlas.chat/`) with direct messages, ad-hoc groups, and an external support inbox for website visitors. It is not an AME3 module — it predates AME3 and lives as a built-in feature with its own raw-SQL-managed tables (`chat_conversations`, `chat_conversation_members`, `chat_messages`, etc.), composed as independent service files (`chat-service.js`, `guest-service.js`, `template-service.js`) wired into a single Hono router.

The user wants chat to grow into a full Discord/WhatsApp-style ecosystem: persistent organizational channels, mentions (@user/@role/@everyone), and complete role-based permission management — on top of the existing direct/group/support conversations. This is large enough to span several independent phases (see the approved roadmap below); this spec covers only the first one.

Approved roadmap (each phase is its own spec → plan → implementation cycle):

| Phase | Content |
|---|---|
| **A (this spec)** | Data model: channels + unification with groups, per-conversation roles, permission engine |
| B | Channel/group UX: create, discover, join, member & role management screens |
| C | Mentions: @user, @role, @everyone/@here |
| D | Pinned messages + emoji reactions |
| E | Reply threads |
| F | Cross-module entity reference cards (generic, blueprint-driven) |

## 4. Problem

Today, multi-user chat (`type = 'group'`) has no real permission model: `chat_conversation_members.role` is a free-text label (`owner/admin/member/operator/guest`) that nothing enforces. Anyone who is a member can do anything a member can do; there is no way to designate moderators, restrict who can rename a group or remove members, or distinguish an organizational, discoverable team channel from an ad-hoc private group chat. Without this foundation, none of channels, mentions, or role-gated moderation (phases B–F) can be built safely.

## 5. Goals

1. A new conversation type `channel` exists, distinct from `direct`/`group`/`external_support`: company-scoped, optionally public/discoverable, with a slug and description.
2. Every `channel` and `group` conversation has its own set of roles (Owner/Admin/Moderator/Member by default, fully customizable), each carrying a boolean permission set.
3. Existing `group` conversations are backfilled onto the new role system without breaking current membership state.
4. A reusable permission-resolution engine determines, for a given user and conversation, which channel-scoped actions they are allowed to perform, and enforces a role hierarchy (`position`) so lower-ranked roles cannot manage higher-ranked ones.
5. Minimal API endpoints exist to create channels, list the company's discoverable channel directory, join a public channel, and manage roles/member-role-assignments — enough for Phase B to build UI against.
6. `chat_conversations.company_id` is populated on every new conversation (it currently is not), so channel discoverability can be scoped per company.

## 6. Non-goals

1. No UI screens (channel creation modal, role management screen, directory browser) — that is Phase B.
2. No mentions parsing/notifications — Phase C.
3. No pinned messages, reactions, threads, or cross-module reference cards — Phases D/E/F.
4. No multi-role-per-member support — each membership row has exactly one `role_id`. Multi-role is a possible future enhancement (Section 28), not built now.
5. No change to `direct` or `external_support` conversation semantics — the legacy free-text `role` column keeps working for those types unchanged.
6. No new global RBAC permission keys — channel/group creation continues to be gated by the existing `chat.conversations.create` permission.

## 7. User stories

- As an employee with `chat.conversations.create`, I want to create a company channel so that my team has a persistent, discoverable place to talk about a topic.
- As a channel Owner, I want to define custom roles with specific permissions (e.g., a "Support" role that can pin messages but not delete the channel) so that I can delegate moderation without giving full control.
- As a channel Admin, I want to remove a Member or change their role, but be blocked from touching an Admin or Owner ranked at or above me, so that privilege escalation is not possible.
- As any employee, I want existing groups I'm part of to keep working exactly as before immediately after this ships, so that the migration is invisible to end users until Phase B ships new UI.

## 8. UX requirements

N/A for this phase — no UI is shipped in Phase A. All labels introduced here (permission key display names, role names) will need Spanish copy when Phase B builds the UI; this spec defines the underlying keys only (see Section 10).

## 9. Routes/screens

N/A — Phase A ships no frontend routes or screens. Phase B will add screens under `apps/desktop/src/modules/atlas.chat/`.

## 10. Data model

### New models

**`chat_channel_roles`** — a role definition scoped to one conversation (channel or group).

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK, `DEFAULT uuidv7()` |
| conversation_id | UUID | FK → `chat_conversations(id)` ON DELETE CASCADE |
| name | TEXT | e.g. "Owner", "Admin", or custom |
| color | TEXT | nullable, hex color for future UI |
| position | INT | hierarchy rank; higher = more senior. Default 0. |
| is_system | BOOLEAN | true only for the seeded "Owner" role; blocks deletion |
| permissions | JSONB | `{ "channel.manage": true, ... }` — boolean map over the fixed permission catalog (Section 18) |
| created_at / updated_at | TIMESTAMPTZ | |

Unique constraint on `(conversation_id, name)`.

### Modified models

**`chat_conversations`**:
- `type` CHECK constraint extended to include `'channel'` (was `direct`, `group`, `external_support`).
- New column `is_public BOOLEAN NOT NULL DEFAULT false` — true = listed in the company's channel directory and joinable without invite.
- New column `slug TEXT` — nullable; unique per `(company_id, slug)` when set; used for `#channel-name` style display in Phase B.
- New column `description TEXT` — nullable, shown in directory/settings (Phase B).
- `company_id` (already exists, currently unpopulated) — populated on every new conversation created after this change, resolved from the creator's active `Membership.companyId`.

**`chat_conversation_members`**:
- New column `role_id UUID` — FK → `chat_channel_roles(id)` ON DELETE SET NULL. Nullable; only meaningful for `channel`/`group` conversations. The existing free-text `role` column is untouched and remains the source of truth for `direct`/`external_support` conversations.

## 11. Prisma impact

New models: None as Prisma models — `chat_*` tables are managed via raw SQL migrations (not Prisma-modeled), consistent with how the existing chat tables already work. No `prisma/schema.prisma` edits.
Modified models: None (same reason).
New migration required: Yes — a new forward SQL migration under `prisma/migrations/`, following the exact pattern of `20260625000000_add_chat_tables` and `20260629000000_chat_improvements_a`.
Migration safety notes:
- Adding nullable columns (`is_public` defaults false, `slug`, `description`, `role_id`) is non-breaking for existing rows.
- Extending a `CHECK` constraint requires `DROP CONSTRAINT` + `ADD CONSTRAINT` — safe since it only adds an allowed value.
- The backfill (Section 23, edge case 1) runs inside the same migration transaction: seed 4 default roles per existing `group` conversation, map legacy `role` text → `role_id`.
- New table `chat_channel_roles` needs RLS enabled with a members-only SELECT policy (mirroring `chat_is_member()` usage in the existing migration) plus a service-role bypass policy, and should be added to `supabase_realtime` publication so Phase B can subscribe to role changes live.

## 12. API contract

All endpoints require authentication. Response convention: success `{ data: ... }`, error `{ error: string }`.

### POST /chat/channels

Auth: required
Permission: `chat.conversations.create`
Body: `{ title: string, description?: string, isPublic?: boolean, slug?: string, memberUserIds?: string[] }`
Response: `{ data: Conversation }` — creates `type='channel'`, seeds 4 default roles, creator gets the `Owner` role.
Errors: 400 (invalid slug/duplicate slug in company), 403 (missing permission).

### GET /chat/channels/directory

Auth: required
Permission: `chat.conversations.read`
Query: `{ cursor?, limit? }`
Response: `{ data: Conversation[], nextCursor }` — public channels (`is_public = true`) in the caller's company, excluding ones already joined.

### POST /chat/conversations/:id/join

Auth: required
Permission: `chat.conversations.create`
Response: `{ data: Membership }` — fails 400 if the target conversation is not `type='channel'` or `is_public=false`.
Errors: 404 (not found/not public), 400 (already a member).

### GET /chat/conversations/:id/roles

Auth: required
Permission: `chat.conversations.read` + caller must be a member of `:id`
Response: `{ data: ChannelRole[] }` ordered by `position DESC`.

### POST /chat/conversations/:id/roles

Auth: required
Permission: `chat.conversations.create` + caller must hold `roles.manage` on `:id`
Body: `{ name: string, color?: string, position: number, permissions: Record<string, boolean> }`
Response: `{ data: ChannelRole }`
Errors: 403 (lacks `roles.manage`, or attempts to set `position` ≥ caller's own role position), 400 (duplicate name in conversation).

### PATCH /chat/conversations/:id/roles/:roleId

Auth: required, requires `roles.manage` on `:id`, caller's position must exceed the target role's current `position`
Body: partial of the POST body
Response: `{ data: ChannelRole }`
Errors: 403 (system role, or insufficient hierarchy), 404.

### DELETE /chat/conversations/:id/roles/:roleId

Auth: required, requires `roles.manage` on `:id`, cannot delete `is_system` roles
Response: `{ data: { id, reassignedMemberCount } }` — members holding the deleted role fall back to the conversation's default `Member` role.
Errors: 403 (system role), 404.

### PATCH /chat/conversations/:id/members/:memberId/role

Auth: required, requires `roles.manage` on `:id`. Caller's position must exceed the target member's *current* role position. Caller's position must also exceed the *new* role's position — **except** when the new role is the system `Owner` role, which only an existing `Owner` (i.e. another `is_system` role holder) may grant (this is the one case where position-equality is allowed, since Owner's position is the ceiling).
Body: `{ roleId: string }`
Response: `{ data: Membership }`
Errors: 403 (hierarchy violation), 404 (member or role not found in this conversation).

## 13. SDK contract

Domain: `chat` (extends the existing `@atlas/sdk` chat domain)

- `createChannel(payload, token)` → `{ data: Conversation }`
- `listChannelDirectory(query, token)` → `{ data: Conversation[], nextCursor }`
- `joinChannel(conversationId, token)` → `{ data: Membership }`
- `listChannelRoles(conversationId, token)` → `{ data: ChannelRole[] }`
- `createChannelRole(conversationId, payload, token)` → `{ data: ChannelRole }`
- `updateChannelRole(conversationId, roleId, payload, token)` → `{ data: ChannelRole }`
- `deleteChannelRole(conversationId, roleId, token)` → `{ data: { id, reassignedMemberCount } }`
- `assignMemberRole(conversationId, memberId, roleId, token)` → `{ data: Membership }`

## 14. Validator contract

In `packages/validators/src/chat.js`:

- `chatCreateChannelSchema` — new schema dedicated to `POST /chat/channels` (kept separate from `chatCreateConversationSchema` so the generic direct/group creation flow is untouched): `title: z.string().trim().min(1).max(200)`, `description: z.string().trim().max(500).optional()`, `isPublic: z.boolean().optional().default(false)`, `slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/).optional()`, `memberUserIds: z.array(z.string().uuid()).max(50).optional().default([])` (no minimum — a channel can be created with zero explicit invites since the creator always becomes Owner).
- `chatCreateConversationSchema` — unchanged in shape; the DB-level `type` CHECK constraint gains `'channel'` regardless, since `createConversation` in `chat-service.js` is reused internally by the `/chat/channels` route, but the existing `/chat/conversations` endpoint continues to only accept `direct`/`group`/`external_support` from this schema.
- `chatCreateChannelRoleSchema` — `name: z.string().trim().min(1).max(50)`, `color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()`, `position: z.number().int().min(0).max(99)` (100 reserved for Owner), `permissions: z.record(z.boolean())`.
- `chatUpdateChannelRoleSchema` — same shape, all fields optional.
- `chatAssignMemberRoleSchema` — `roleId: z.string().uuid()`.

## 15. Module manifest impact

N/A — `atlas.chat` is a built-in feature module (predates AME3), not registered via `defineAtlasModule`. No manifest file exists or is created by this change.

## 16. Navigation impact

N/A — no new navigation items in Phase A (no UI shipped).

## 17. Blueprint impact

N/A — chat does not use the AME3 blueprint system.

## 18. RBAC/permissions

No new global permission keys. All Phase A endpoints reuse the existing catalog:

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| `chat.conversations.create` | POST /chat/channels, POST /chat/conversations/:id/join, POST/PATCH/DELETE roles endpoints, PATCH member role | No |
| `chat.conversations.read` | GET /chat/channels/directory, GET /chat/conversations/:id/roles | No |

**Channel-scoped permission catalog** (new — not global RBAC, not seeded in the `Permission` table; a fixed set of keys used inside `chat_channel_roles.permissions` JSONB and enforced in application code):

| Key | Meaning |
|---|---|
| `channel.manage` | Edit name/description/slug/visibility, delete the channel |
| `members.manage` | Add/remove members, invite to a private channel/group |
| `roles.manage` | Create/edit/delete roles, assign roles to members (bounded by hierarchy; can never touch the Owner role) |
| `messages.send` | Post messages (base permission; false = read-only/announcement channel) |
| `messages.pin` | Pin/unpin messages (reserved for Phase D, defined now so default role sets are stable) |
| `messages.delete_others` | Delete messages sent by other members (moderation) |
| `mentions.everyone` | Use `@everyone` (reserved for Phase C) |
| `mentions.here` | Use `@here` (reserved for Phase C) |

Default role → permission grants:

| Role | position | Grants |
|---|---|---|
| Owner (system) | 100 | all keys, implicitly, regardless of JSONB content |
| Admin | 75 | `channel.manage`, `members.manage`, `roles.manage`, `messages.pin`, `messages.delete_others`, `mentions.everyone`, `messages.send` |
| Moderator | 50 | `messages.pin`, `messages.delete_others`, `mentions.here`, `messages.send` |
| Member | 0 | `messages.send` |

## 19. Multi-company behavior

`chat_conversations.company_id` is populated at creation time going forward (resolved from the creator's active `Membership.companyId`, same lookup pattern already used in `chat-service.js` for notification dispatch). The channel directory (`GET /chat/channels/directory`) filters strictly on the caller's `company_id`. Existing rows with `company_id IS NULL` (all current conversations) are left as-is — they predate company scoping and are not retroactively assigned a company in this migration, since Atlas is currently single-company per deployment and this has caused no observed issue; this is called out explicitly as a residual gap in Section 24 (Risks) rather than silently glossed over.

## 20. Files/storage impact

N/A — no new file/storage interactions in Phase A.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

| Action key | Trigger | Payload |
|---|---|---|
| `chat.channel.create` | POST /chat/channels | after: `{ id, title, type, isPublic, slug }` |
| `chat.role.create` | POST /chat/conversations/:id/roles | after: `{ id, conversationId, name, position, permissions }` |
| `chat.role.update` | PATCH .../roles/:roleId | before/after: `{ name, position, permissions }` |
| `chat.role.delete` | DELETE .../roles/:roleId | after: `{ id, reassignedMemberCount }` |
| `chat.member.role_change` | PATCH .../members/:memberId/role | before: `{ roleId }`, after: `{ roleId }` |

## 23. Edge cases

1. **Backfilling existing groups**: every current `type='group'` conversation must get 4 seeded roles and every member's legacy `role` text mapped to a `role_id` (`owner`→Owner, `admin`→Admin, `member`/anything else→Member) inside the same migration transaction, so no group is left without a resolvable role for its members.
2. **Conversation with zero Owners**: if the sole Owner is removed as a member (existing `removeMember` flow), the conversation must not end up with no role positioned at 100 with an active holder — Phase A's `removeMember` path (already existing) gets a guard: block removing the last remaining Owner-role member; require reassigning Owner first. This is an addition to the *existing* `chat-service.js#removeMember`, not new API surface.
3. **Duplicate slug within a company**: `POST /chat/channels` with a slug already used by another channel in the same `company_id` returns 400.
4. **Deleting a role that members still hold**: must reassign affected members to the conversation's Member role (by `is_system=false, name='Member'` within that conversation) in the same transaction as the delete, never leaving `role_id` dangling (the FK is `ON DELETE SET NULL`, but the service layer proactively reassigns rather than leaving it null).
5. **Position collision**: creating/updating a role with a `position` equal to another non-system role in the same conversation is allowed (ties are broken by `created_at` for display ordering) — not an error, since forcing strict uniqueness adds complexity with no functional need at this phase.
6. **Self-demotion**: an Admin can change their own role to something with a lower position (self-demotion is allowed — hierarchy checks only protect *other* members/roles from being managed by someone ranked at or below them), but cannot promote themselves to Owner.
7. **Non-member calling role endpoints**: any `/chat/conversations/:id/roles*` or member-role endpoint must 404 (not 403) for a conversation the caller cannot see, to avoid leaking conversation existence — consistent with the existing `assertMember` pattern in `chat-service.js`.

## 24. Risks

1. Risk: Existing `chat_conversations` rows have `company_id = NULL`, so they will never appear in any company-scoped directory query even after being converted conceptually to channels. Mitigation: none needed for Phase A since directory listing only applies to newly created channels going forward; flagged here so Phase B does not assume all groups are company-scoped.
2. Risk: `chat-service.js` is already at the 1000-line soft limit; adding role/permission logic there would breach it. Mitigation: all new logic lives in a new file, `chat-permissions-service.js`, imported by `chat-service.js` and wired into the router in `index.js` — no growth of the existing file beyond the small edits needed to call the new guard functions.
3. Risk: The role-hierarchy check (`position` comparison) is easy to get subtly wrong (e.g., allowing equal-position management). Mitigation: a single shared `assertHigherPosition(actorPosition, targetPosition)` helper used by every mutating endpoint, covered by dedicated unit tests (Section 26).
4. Risk: Backfill migration touches every existing group conversation in one transaction; on a large dataset this could be slow or lock tables. Mitigation: current group conversation count is low (verify via `SELECT count(*) FROM chat_conversations WHERE type='group'` before running in production); acceptable for current data volume, revisit if it grows.

## 25. Acceptance criteria

1. Given a user with `chat.conversations.create`, when they POST `/chat/channels` with a title, then a conversation with `type='channel'` is created, `company_id` is populated from their membership, and they hold the `Owner` role in the new conversation.
2. Given an existing `group` conversation created before this migration, when the migration runs, then the conversation has exactly 4 roles (Owner/Admin/Moderator/Member) and every existing member has a non-null `role_id` consistent with their prior `role` text value.
3. Given a member with the `Member` role (position 0) in a channel, when they attempt `PATCH /chat/conversations/:id/roles/:roleId` on the `Admin` role, then the API returns 403.
4. Given a member with the `Admin` role, when they attempt to delete the `Owner` role, then the API returns 403 and the role is not deleted.
5. Given a public channel (`is_public=true`) in the caller's company that they are not a member of, when they call `POST /chat/conversations/:id/join`, then they become a member with the conversation's default `Member` role.
6. Given a private (`is_public=false`) channel, when a non-member calls `POST /chat/conversations/:id/join`, then the API returns 404.
7. Given a role is deleted while 2 members hold it, when the delete completes, then both members now hold the conversation's `Member` role and the response reports `reassignedMemberCount: 2`.

## 26. Verification plan

- `pnpm db:migrate` — new migration applies cleanly against the Supabase instance.
- `node --check apps/api/src/routes/chat/chat-permissions-service.js` and other touched files — syntax check.
- `node --test apps/api/src/routes/chat/__tests__/` — new unit tests covering: permission resolution, `assertHigherPosition`, backfill role mapping logic, Owner-role deletion/reassignment guard.
- `pnpm build` — no build errors across `apps/api`, `packages/validators`, `packages/sdk`.
- Manual (via curl/local dev, using a placeholder token per project convention): create a channel, confirm Owner role assignment; attempt role management as a Member, confirm 403; join a public channel as a second user, confirm Member role assignment; delete a custom role with members assigned, confirm reassignment.

## 27. Rollback plan

The migration is additive (new table, new nullable columns, widened CHECK constraint) plus a backfill of existing group memberships. Rollback is a new forward migration that:
1. Drops the `chat_channel_roles` table (cascades to `role_id` references, already `ON DELETE SET NULL` so no data loss on `chat_conversation_members`).
2. Drops `is_public`, `slug`, `description` columns from `chat_conversations`.
3. Restores the original `type` CHECK constraint (only safe if no `channel`-typed rows exist yet — if any do, they must be handled manually first, e.g. converted to `group`).
No existing data (messages, direct/external_support conversations, legacy group `role` text) is destructively altered by the forward migration, so rollback risk is low.

## 28. Future enhancements

1. Multi-role per member (currently one `role_id` per membership row).
2. Role-based `@role` mentions (Phase C) consuming the roles created here.
3. Owner transfer flow (explicitly promoting another member to Owner and optionally demoting yourself) — Phase A only allows an existing Owner to grant the Owner role to someone else via the generic role-assignment endpoint; a dedicated "transfer ownership" UX is deferred to Phase B.
4. Retroactively populating `company_id` on pre-existing NULL conversations, if a real need arises.
5. Per-role notification preferences (e.g. mute `@here` but not `@user` mentions) — deferred to Phase C.
