export function createAtlasClient({ baseUrl }) {
  function withAuthHeaders(token, headers = {}) {
    if (!token) return headers;
    return { ...headers, Authorization: `Bearer ${token}` };
  }

  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(`${baseUrl}${path}`, {
      headers: isFormData
        ? (options.headers ?? {})
        : { "Content-Type": "application/json", ...(options.headers ?? {}) },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Atlas API error ${response.status}`);
    }
    return response.json();
  }

  return {
    health: () => request("/health"),
    instance: { status: () => request("/instance/status") },
    setup: {
      initialize: (formData) =>
        request("/setup/initialize", { method: "POST", body: formData }),
    },
    auth: {
      me: (token) =>
        request("/user/me", { headers: { Authorization: `Bearer ${token}` } }),
    },
    profile: {
      me: (token) =>
        request("/profile/me", { headers: withAuthHeaders(token) }),
      updateMe: (data, token) =>
        request("/profile/me", {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      uploadAvatar: (file, token) => {
        const formData = new FormData();
        formData.append("avatar", file);
        return request("/profile/me/avatar", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: formData,
        });
      },
      changePassword: (data, token) =>
        request("/profile/me/password", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
    },
    instanceConfig: {
      get: (token) =>
        request("/instance/config", { headers: withAuthHeaders(token) }),
      update: (data, token) =>
        request("/instance/config", {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
    },
    company: {
      getProfile: (token) =>
        request("/company/profile", { headers: withAuthHeaders(token) }),
      updateProfile: (data, token) =>
        request("/company/profile", {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      getAddress: (token) =>
        request("/company/address", { headers: withAuthHeaders(token) }),
      updateAddress: (data, token) =>
        request("/company/address", {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      getBranding: (token) =>
        request("/company/branding", { headers: withAuthHeaders(token) }),
      updateBranding: (data, token) =>
        request("/company/branding", {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
    },
    memberships: {
      me: (token) =>
        request("/memberships/me", {
          headers: withAuthHeaders(token),
        }),
    },
    modules: {
      list: () => request("/modules"),
      install: (manifest, token) =>
        request("/modules/install", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ manifest }),
        }),
      uninstall: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}`, {
          method: "DELETE",
          headers: withAuthHeaders(token),
        }),
      disable: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}/disable`, {
          method: "POST",
          headers: withAuthHeaders(token),
        }),
      enable: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}/enable`, {
          method: "POST",
          headers: withAuthHeaders(token),
        }),
    },
    blueprints: { list: () => request("/blueprints") },
    identity: {
      listUsers: (token) =>
        request("/identity/users", { headers: withAuthHeaders(token) }),
      updateUser: (id, data, token) =>
        request(`/identity/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      listRoles: (token) =>
        request("/identity/roles", { headers: withAuthHeaders(token) }),
      createRole: (data, token) =>
        request("/identity/roles", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateRole: (id, data, token) =>
        request(`/identity/roles/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setRoleEnabled: (id, enabled, token) =>
        request(`/identity/roles/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      listPermissions: (token) =>
        request("/identity/permissions", { headers: withAuthHeaders(token) }),
      setRolePermissions: (id, permissionKeys, token) =>
        request(`/identity/roles/${encodeURIComponent(id)}/permissions`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ permissionKeys }),
        }),
      createUser: (data, token) =>
        request("/identity/users", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      deleteUser: (id, token) =>
        request(`/identity/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: withAuthHeaders(token),
        }),
    },
    finance: {
      listAccounts: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.q) params.set("q", options.q);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/finance/accounts?${query}` : "/finance/accounts";
        return request(path, { headers: withAuthHeaders(token) });
      },
      createAccount: (data, token) =>
        request("/finance/accounts", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateAccount: (id, data, token) =>
        request(`/finance/accounts/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setAccountEnabled: (id, enabled, token) =>
        request(`/finance/accounts/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      listEntries: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/finance/entries?${query}` : "/finance/entries";
        return request(path, { headers: withAuthHeaders(token) });
      },
      getEntry: (id, token) =>
        request(`/finance/entries/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
      createEntry: (data, token) =>
        request("/finance/entries", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setEntryEnabled: (id, enabled, token) =>
        request(`/finance/entries/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      getBalances: (token) =>
        request("/finance/balances", {
          headers: withAuthHeaders(token),
        }),
      listFxRates: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.baseCurrency) params.set("baseCurrency", options.baseCurrency);
        if (options.quoteCurrency) params.set("quoteCurrency", options.quoteCurrency);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/finance/fx-rates?${query}` : "/finance/fx-rates";
        return request(path, { headers: withAuthHeaders(token) });
      },
      listTaxRates: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.kind) params.set("kind", options.kind);
        if (options.direction) params.set("direction", options.direction);
        if (options.enabled !== undefined) {
          params.set("enabled", String(options.enabled));
        }
        if (options.q) params.set("q", options.q);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/finance/tax-rates?${query}` : "/finance/tax-rates";
        return request(path, { headers: withAuthHeaders(token) });
      },
      createTaxRate: (data, token) =>
        request("/finance/tax-rates", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setTaxRateEnabled: (id, enabled, token) =>
        request(`/finance/tax-rates/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      createFxRate: (data, token) =>
        request("/finance/fx-rates", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setFxRateEnabled: (id, enabled, token) =>
        request(`/finance/fx-rates/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      getDashboard: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.from) params.set("from", options.from);
        if (options.to) params.set("to", options.to);
        const query = params.toString();
        const path = query ? `/finance/dashboard?${query}` : "/finance/dashboard";
        return request(path, { headers: withAuthHeaders(token) });
      },
      listDocuments: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.direction) params.set("direction", options.direction);
        if (options.docType) params.set("docType", options.docType);
        if (options.status) params.set("status", options.status);
        if (options.contactId) params.set("contactId", options.contactId);
        if (options.q) params.set("q", options.q);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/finance/documents?${query}` : "/finance/documents";
        return request(path, { headers: withAuthHeaders(token) });
      },
      createDocument: (data, token) =>
        request("/finance/documents", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      getDocument: (id, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
      updateDocument: (id, data, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setDocumentEnabled: (id, enabled, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      sendDocumentReminder: (id, payload, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}/reminder`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload ?? {}),
        }),
      sendBulkDocumentReminders: (payload, token) =>
        request("/finance/documents/reminders/bulk", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload ?? {}),
        }),
      previewApplication: (id, payload, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}/apply-preview`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload),
        }),
      applyDocument: (id, payload, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}/apply`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload),
        }),
      getAging: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.direction) params.set("direction", options.direction);
        if (options.contactId) params.set("contactId", options.contactId);
        if (options.asOf) params.set("asOf", options.asOf);
        if (options.currency) params.set("currency", options.currency);
        const query = params.toString();
        const path = query ? `/finance/aging?${query}` : "/finance/aging";
        return request(path, { headers: withAuthHeaders(token) });
      },
      listApplications: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.direction) params.set("direction", options.direction);
        if (options.status) params.set("status", options.status);
        if (options.sourceDocumentId) {
          params.set("sourceDocumentId", options.sourceDocumentId);
        }
        if (options.targetDocumentId) {
          params.set("targetDocumentId", options.targetDocumentId);
        }
        if (options.contactId) params.set("contactId", options.contactId);
        if (options.from) params.set("from", options.from);
        if (options.to) params.set("to", options.to);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query
          ? `/finance/applications?${query}`
          : "/finance/applications";
        return request(path, { headers: withAuthHeaders(token) });
      },
      reverseApplication: (id, payload, token) =>
        request(`/finance/applications/${encodeURIComponent(id)}/reverse`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload ?? {}),
        }),
      getDocumentJournalLinks: (id, token) =>
        request(`/finance/documents/${encodeURIComponent(id)}/journal-links`, {
          headers: withAuthHeaders(token),
        }),
    },
    contacts: {
      list: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.q) params.set("q", options.q);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/contacts?${query}` : "/contacts";
        return request(path, { headers: withAuthHeaders(token) });
      },
      picker: (token, options = {}) => {
        const params = new URLSearchParams();
        if (options.q) params.set("q", options.q);
        if (options.limit) params.set("limit", String(options.limit));
        const query = params.toString();
        const path = query ? `/contacts/picker?${query}` : "/contacts/picker";
        return request(path, { headers: withAuthHeaders(token) });
      },
      create: (data, token) =>
        request("/contacts", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      update: (id, data, token) =>
        request(`/contacts/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setEnabled: (id, enabled, token) =>
        request(`/contacts/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      delete: (id, token) =>
        request(`/contacts/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: withAuthHeaders(token),
        }),
    },
    files: {
      upload: (formData, token) =>
        request("/files/upload", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: formData,
        }),
      list: (params = {}, token) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined || value === null || value === "") continue;
          search.set(key, String(value));
        }
        const query = search.toString();
        return request(query ? `/files?${query}` : "/files", {
          headers: withAuthHeaders(token),
        });
      },
      get: (id, token) =>
        request(`/files/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
      getSignedUrl: (id, token) =>
        request(`/files/${encodeURIComponent(id)}/signed-url`, {
          headers: withAuthHeaders(token),
        }),
      rename: (id, data, token) =>
        request(`/files/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      bulkDownload: (payload, token) =>
        request("/files/bulk-download", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload),
        }),
      setEnabled: (id, enabled, token) =>
        request(`/files/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      delete: (id, token) =>
        request(`/files/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: withAuthHeaders(token),
        }),
    },
  };
}
