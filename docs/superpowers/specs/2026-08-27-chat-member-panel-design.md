# Chat UI — Member Management as an In-Place Panel

Date: 2026-08-27
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-27-chat-member-panel-design.md
Plan file: docs/superpowers/plans/2026-08-27-chat-member-panel-plan.md

Second of three sub-projects from a user-requested chat UI pass (screenshots + feedback, 2026-08-27). First (conversation identity) is shipped. Third (media quality/composer previews) is separate.

---

## 1. Feature title

Chat UI — Member Management as an In-Place Panel

## 2. Status

Draft

## 3. Context

Member/role management currently opens as `ChannelDetailsSheet` — a modal overlay (`@atlas/ui`'s `Sheet`) that slides over the chat. The user explicitly said they don't like this pattern and prefers member management to behave like the existing "Fotos y videos" view: clicking a header button swaps the main chat content area in place, with the same header/composer staying put, rather than an overlay covering the conversation.

## 4. Problem

Member/role management feels disconnected from the conversation because it opens as a modal overlay, unlike every other secondary view in this window (files gallery already uses an in-place swap).

## 5. Goals

1. Clicking the existing "Ver miembros" entry point (dropdown item) or the member avatar stack (added in Sub-project 1) swaps the main chat content area to a member/role management panel, exactly like the "Archivos" button already swaps it to the files gallery.
2. The panel keeps the existing tab structure (General / Miembros / Roles) already built for `ChannelDetailsSheet` — this is a container change, not a content redesign.
3. Only one "special view" (files gallery OR member panel) is active at a time, same as today's files-vs-messages behavior.

## 6. Non-goals

1. No redesign of `ChannelGeneralTab`/`ChannelMembersTab`/`ChannelRolesTab`'s own internal content — they move into a new container, unchanged inside.
2. `FloatingChatHub`'s mini-window doesn't gain a member panel at all (it doesn't have one today either — confirmed `ChannelDetailsSheet` is only ever used from `ChatWindow.jsx`). Not a regression, not addressed here.
3. No new permission logic — every tab's existing permission gating (`channel.manage`, `roles.manage`) is preserved exactly as-is.
4. Doesn't touch `PinnedMessagesSheet`/`ThreadPanel` — those remain sheets; this spec is scoped to member/role management specifically, per the user's explicit complaint about that one view.

## 7. User stories

- As a member, I want "Ver miembros" to feel like part of the conversation, not a popup covering it — consistent with how viewing shared files already works.

## 8. UX requirements

- Header's existing folder icon button (files toggle) gets a sibling: a "people" icon button, same style, mutually exclusive with the files toggle (opening one closes the other — matching the existing single-swap-area pattern, `filesView` already only shows one of "gallery" or "messages+composer" at a time).
- The panel itself: same `Tabs` (General/Miembros/Roles) already built, rendered directly in the main content area (no `Sheet`/`SheetContent` wrapper) with a scrollable body matching the files gallery's own scroll container styling.
- Closing: clicking the header toggle again (or the messages icon, mirroring how the files view closes) returns to the message list. No separate "X" close button inside the panel — consistent with how the files gallery has no internal close button either, only the header toggle.

## 9. Routes/screens

No new routes. `ChannelDetailsSheet.jsx` is deleted; its content becomes a new `ChatMembersPanel.jsx`, structurally parallel to the existing `ChatFilesGallery` (a local component already defined inside `ChatWindow.jsx` — `ChatMembersPanel` follows the same "separate component, rendered conditionally in the same content slot" pattern, but as its own file since it's larger than the gallery).

## 10. Data model

N/A — no schema change, this is a pure container/UX change.

## 11. Prisma impact

None.

## 12. API contract

N/A — no API change. The panel calls the exact same hooks/endpoints `ChannelDetailsSheet`'s tabs already called.

## 13. SDK contract

N/A.

## 14. Validator contract

N/A.

## 15. Module manifest impact

N/A.

## 16. Navigation impact

N/A.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

Unchanged — `channel.manage`/`roles.manage` gating inside each tab is preserved exactly (Non-goal 3).

## 19. Multi-company behavior

Unchanged — no new data access path.

## 20. Files/storage impact

N/A (the avatar-upload flow inside `ChannelGeneralTab`, already shipped, is untouched by this container change).

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A.

## 23. Edge cases

1. **Opening the member panel while the files gallery is open**: closes the gallery, same mutual-exclusion already governing files-vs-messages today (both driven by sibling boolean states in `ChatWindow`, only one true at a time).
2. **Switching conversations while the member panel is open**: closes it and returns to the message list for the new conversation — matching the EXISTING reset-on-conversation-change effect already in `ChatWindow.jsx` for `filesView`/`showPinned`/`jumpTarget`/`threadPanelRootId` (this spec adds the new state to that same existing effect, doesn't invent a new reset mechanism).
3. **A member without `roles.manage` opens the panel**: sees General + Miembros tabs; Roles tab is absent — unchanged from `ChannelDetailsSheet`'s existing behavior (the tab itself is conditionally rendered, not just its content).
4. **Direct conversations**: the "Ver miembros"/people-icon entry point already doesn't render for `direct` conversations today (per Sub-project 1's audit — the member stack and its click handler are channel/group-only) — this spec doesn't change that scoping.

## 24. Risks

1. **Risk**: `ChatWindow.jsx` is already large (per Sub-project 1's own commits, it stayed under 1000 lines, but every addition matters). Mitigation: `ChatMembersPanel` is its own new file (matching the plan's Section 9 above), not inlined into `ChatWindow.jsx` — only a toggle button, one boolean state, and one conditional render line are added to `ChatWindow.jsx` itself.
2. **Risk**: every current entry point that opens `ChannelDetailsSheet` (the "Ver miembros" dropdown item, `MemberAvatarStack`'s `onClick`, both already wired to a `setShowDetails(true)`-style handler per Sub-project 1's own commits) needs to be repointed to the new toggle, not left calling a handler for a component that no longer exists. Mitigation: the plan must grep for every current `setShowDetails`/`showDetails`/`ChannelDetailsSheet` reference in `ChatWindow.jsx` and update each one, not just add the new toggle alongside a now-dead old one.
3. **Risk**: deleting `ChannelDetailsSheet.jsx` outright (rather than leaving it as unused dead code) could break an import somewhere not yet found. Mitigation: re-confirm via grep (already done during this spec's own research: only `ChatWindow.jsx` and `ChannelGeneralTab.jsx` reference it — the latter is a false positive worth re-checking, since `ChannelGeneralTab.jsx` shouldn't need to import `ChannelDetailsSheet` itself) before deleting the file, and re-grep again after the plan's changes land, before the file is actually deleted, as a final safety check.

## 25. Acceptance criteria

1. Given a member clicks "Ver miembros" (dropdown item) or the member avatar stack, the main chat content area swaps to the member panel — no overlay, header/composer stay visible/functional exactly as they do for the files gallery.
2. Given the member panel is open and the user clicks the files-toggle button, the files gallery replaces the member panel (mutual exclusion holds).
3. Given a member switches to a different conversation while the panel is open, the new conversation opens showing its normal message list, not the panel.
4. Given `ChannelDetailsSheet.jsx` is deleted, `pnpm build` still succeeds with no missing-import errors.

## 26. Verification plan

- `pnpm build` — no build errors, no missing imports after `ChannelDetailsSheet.jsx`'s removal.
- Manual browser QA if a session is available: toggle between messages/files/members in one conversation, confirm only one shows at a time; switch conversations with the panel open, confirm it resets.

## 27. Rollback plan

Pure UI/container change — revertable via `git revert`. No data, no migration, no API change.

## 28. Future enhancements

1. A URL/deep-link to open a specific tab of the member panel directly (not requested, no current precedent for this in the chat module — the files gallery doesn't have one either).
