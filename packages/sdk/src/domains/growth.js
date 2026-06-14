export function createGrowthDomain({ request, withAuthHeaders, toQueryString }) {
  const leadPath = (leadId) => `/growth/leads/${encodeURIComponent(leadId)}`;

  return {
    getLeadSummary: (token, query = {}) =>
      request(`/growth/leads/summary${toQueryString(query)}`, {
        headers: withAuthHeaders(token),
      }),

    listLeads: (token, query = {}) =>
      request(`/growth/leads${toQueryString(query)}`, {
        headers: withAuthHeaders(token),
      }),

    listLeadAssignees: (token) =>
      request("/growth/leads/assignees", {
        headers: withAuthHeaders(token),
      }),

    getLead: (leadId, token) =>
      request(leadPath(leadId), {
        headers: withAuthHeaders(token),
      }),

    createLead: (payload, token) =>
      request("/growth/leads", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    updateLead: (leadId, payload, token) =>
      request(leadPath(leadId), {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    addLeadNote: (leadId, noteOrPayload, token, updatedAt) =>
      request(`${leadPath(leadId)}/notes`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(
          typeof noteOrPayload === "string"
            ? { note: noteOrPayload, updatedAt }
            : noteOrPayload,
        ),
      }),

    convertLead: (leadId, payload, token) =>
      request(`${leadPath(leadId)}/convert`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    setLeadEnabled: (leadId, enabledOrPayload, token, updatedAt) =>
      request(`${leadPath(leadId)}/enabled`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(
          typeof enabledOrPayload === "boolean"
            ? { enabled: enabledOrPayload, updatedAt }
            : enabledOrPayload,
        ),
      }),
  };
}
