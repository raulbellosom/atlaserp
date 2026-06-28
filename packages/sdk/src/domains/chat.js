export function createChatDomain(request, withAuthHeaders, toQueryString) {
  return {
    // ----------------------------------------------------------------
    // Conversations (internal)
    // ----------------------------------------------------------------
    listConversations: (params, token) =>
      request(`/chat/conversations${toQueryString(params)}`, {
        headers: withAuthHeaders(token),
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

    // ----------------------------------------------------------------
    // Messages (internal)
    // ----------------------------------------------------------------
    listMessages: (conversationId, params, token) =>
      request(
        `/chat/conversations/${encodeURIComponent(conversationId)}/messages${toQueryString(params)}`,
        { headers: withAuthHeaders(token) },
      ),

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

    getAttachmentSignedUrl: (attachmentId, token) =>
      request(`/chat/attachments/${encodeURIComponent(attachmentId)}/signed-url`, {
        headers: withAuthHeaders(token),
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

    toggleAvailability: (available, token) =>
      request("/chat/availability", {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify({ available }),
      }),

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
