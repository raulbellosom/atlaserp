export function createCallsDomain(request, withAuthHeaders) {
  const action = (callId, name, token) =>
    request(`/calls/${encodeURIComponent(callId)}/${name}`, {
      method: "POST",
      headers: withAuthHeaders(token),
      body: JSON.stringify({}),
    });

  return {
    getConfig: (token) =>
      request("/calls/config", { headers: withAuthHeaders(token) }),
    getCurrent: (token) =>
      request("/calls/current", { headers: withAuthHeaders(token) }),
    create: (data, token) =>
      request("/calls", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),
    get: (callId, token) =>
      request(`/calls/${encodeURIComponent(callId)}`, {
        headers: withAuthHeaders(token),
      }),
    join: (callId, token) => action(callId, "join", token),
    decline: (callId, token) => action(callId, "decline", token),
    leave: (callId, token) => action(callId, "leave", token),
    end: (callId, token) => action(callId, "end", token),
  };
}
