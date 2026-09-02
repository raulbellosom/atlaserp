export function createChatDomain(request, withAuthHeaders, toQueryString) {
  return {
    // ----------------------------------------------------------------
    // Conversations (internal)
    // ----------------------------------------------------------------
    listConversations: (params, token) =>
      request(`/chat/conversations${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
      }),

    archiveConversation: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/archive`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    unarchiveConversation: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/unarchive`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    createConversation: (data, token) =>
      request("/chat/conversations", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    getConversation: (id, token) =>
      request(`/chat/conversations/${encodeURIComponent(id)}`, {
        headers: withAuthHeaders(token),
      }),

    updateConversation: (id, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteConversation: (id, token) =>
      request(`/chat/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    createChannel: (data, token) =>
      request("/chat/channels", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    listChannelDirectory: (params, token) =>
      request(`/chat/channels/directory${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
      }),

    // module: e.g. "atlas.projects". entityId: the linked record's id.
    // Returns { data: conversation | null } — used to decide "Crear canal"
    // vs. "Ir al canal" before the user clicks anything.
    getLinkedChannel: (module, entityId, token) =>
      request(`/chat/channels/linked${toQueryString({ module, entityId })}`, {
        headers: withAuthHeaders(token),
      }),

    joinChannel: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/join`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    listChannelRoles: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles`, {
        headers: withAuthHeaders(token),
      }),

    createChannelRole: (conversationId, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    updateChannelRole: (conversationId, roleId, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles/${encodeURIComponent(roleId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteChannelRole: (conversationId, roleId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/roles/${encodeURIComponent(roleId)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    assignMemberRole: (conversationId, memberId, roleId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(memberId)}/role`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ roleId }),
      }),

    // ----------------------------------------------------------------
    // Messages (internal)
    // ----------------------------------------------------------------
    listMessages: (conversationId, params, token) =>
      request(
        `/chat/conversations/${encodeURIComponent(conversationId)}/messages${toQueryString(params)}`,
        { headers: withAuthHeaders(token) },
      ),

    // Fuzzy message search. `params`: { q, conversationId?, limit?, offset? }.
    // Omit conversationId for a global search across the caller's conversations.
    searchMessages: (params, token) =>
      request(`/chat/search/messages${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
      }),

    // `data` may include `replyToMessageId` (uuid) — the message this one
    // quotes (WhatsApp-style inline reply). Independent of `threadRootId`.
    sendMessage: (conversationId, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    editMessage: (messageId, data, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteMessage: (messageId, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    deleteAttachment: (attachmentId, token) =>
      request(`/chat/attachments/${encodeURIComponent(attachmentId)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    pinMessage: (messageId, pinned, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/pin`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ pinned }),
      }),

    listPinnedMessages: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/pinned-messages`, {
        headers: withAuthHeaders(token),
      }),

    getThread: (messageId, token) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/thread`, {
        headers: withAuthHeaders(token),
      }),

    toggleReaction: (messageId, emoji, token, { attachmentId } = {}) =>
      request(`/chat/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ emoji, attachmentId: attachmentId ?? null }),
      }),

    markRead: (conversationId, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    // ----------------------------------------------------------------
    // Members (internal)
    // ----------------------------------------------------------------
    addMembers: (conversationId, data, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/members`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    removeMember: (conversationId, userId, token) =>
      request(
        `/chat/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: withAuthHeaders(token),
        },
      ),

    // ----------------------------------------------------------------
    // Attachments (internal)
    // ----------------------------------------------------------------
    presignAttachment: (data, token) =>
      request("/chat/attachments/presign", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    getAttachmentSignedUrl: (attachmentId, token, options = {}) =>
      request(`/chat/attachments/${encodeURIComponent(attachmentId)}/signed-url${toQueryString({ variant: options.variant })}`, {
        headers: withAuthHeaders(token),
      }),

    // ----------------------------------------------------------------
    // Conversation profile / moderation (internal)
    // ----------------------------------------------------------------
    muteConversation: (conversationId, muted, token) =>
      request(`/chat/conversations/${encodeURIComponent(conversationId)}/mute`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ muted }),
      }),

    getBlockStatus: (userId, token) =>
      request(`/chat/users/${encodeURIComponent(userId)}/block-status`, {
        headers: withAuthHeaders(token),
      }),

    blockUser: (userId, token) =>
      request(`/chat/users/${encodeURIComponent(userId)}/block`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    unblockUser: (userId, token) =>
      request(`/chat/users/${encodeURIComponent(userId)}/block`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    getGroupsInCommon: (userId, token) =>
      request(`/chat/users/${encodeURIComponent(userId)}/groups-in-common`, {
        headers: withAuthHeaders(token),
      }),

    createReport: (payload, token) =>
      request("/chat/reports", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    listReports: (query, token) =>
      request(`/chat/reports${toQueryString(query)}`, {
        headers: withAuthHeaders(token),
      }),

    resolveReport: (reportId, action, token) =>
      request(`/chat/reports/${encodeURIComponent(reportId)}/resolve`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ action }),
      }),

    // ----------------------------------------------------------------
    // External inbox (operators)
    // ----------------------------------------------------------------
    listExternalInbox: (params, token) =>
      request(`/chat/external/inbox${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
      }),

    listExternalMessages: (conversationId, params, token) =>
      request(
        `/chat/external/${encodeURIComponent(conversationId)}/messages${toQueryString(params)}`,
        { headers: withAuthHeaders(token) },
      ),

    sendExternalMessage: (conversationId, data, token) =>
      request(`/chat/external/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    assignOperator: (conversationId, data, token) =>
      request(`/chat/external/${encodeURIComponent(conversationId)}/assign`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    closeExternal: (conversationId, token) =>
      request(`/chat/external/${encodeURIComponent(conversationId)}/close`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    markExternalRead: (conversationId, token) =>
      request(`/chat/external/${encodeURIComponent(conversationId)}/read`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    toggleAvailability: (available, token) =>
      request("/chat/availability", {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ available }),
      }),

    listTemplates: (token) =>
      request("/chat/templates", { headers: withAuthHeaders(token) }),

    createTemplate: (data, token) =>
      request("/chat/templates", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    updateTemplate: (templateId, data, token) =>
      request(`/chat/templates/${encodeURIComponent(templateId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),

    deleteTemplate: (templateId, token) =>
      request(`/chat/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),

    recordTemplateUse: (templateId, token) =>
      request(`/chat/templates/${encodeURIComponent(templateId)}/use`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({}),
      }),

    assignOperator: (conversationId, userId, token) =>
      request(`/chat/external/${encodeURIComponent(conversationId)}/assign`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ userId }),
      }),

    listAvailableOperators: (token) =>
      request("/chat/operators/available", { headers: withAuthHeaders(token) }),

    // ----------------------------------------------------------------
    // Guest / Public (no auth token)
    // ----------------------------------------------------------------
    createGuestSession: (data) =>
      request("/public/chat/session", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getGuestSession: (token) =>
      request(`/public/chat/session/${encodeURIComponent(token)}`),

    sendGuestMessage: (sessionToken, data) =>
      request(`/public/chat/session/${encodeURIComponent(sessionToken)}/messages`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    listGuestMessages: (sessionToken, params) =>
      request(
        `/public/chat/session/${encodeURIComponent(sessionToken)}/messages${toQueryString(params)}`,
      ),

    closeGuestSession: (sessionToken) =>
      request(`/public/chat/session/${encodeURIComponent(sessionToken)}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  };
}
