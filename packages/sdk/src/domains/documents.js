export function createDocumentsDomain({
  request,
  requestBlob,
  withAuthHeaders,
  toQueryString,
}) {
  const templatePath = (templateId) =>
    `/documents/templates/${encodeURIComponent(templateId)}`;
  const generatedPath = (generatedId) =>
    `/documents/generated/${encodeURIComponent(generatedId)}`;

  return {
    listTemplates: (token, query = {}) =>
      request(`/documents/templates${toQueryString(query)}`, {
        headers: withAuthHeaders(token),
      }),

    createTemplate: (payload, token) =>
      request("/documents/templates", {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    getTemplate: (templateId, token) =>
      request(templatePath(templateId), {
        headers: withAuthHeaders(token),
      }),

    updateTemplate: (templateId, payload, token) =>
      request(templatePath(templateId), {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    setTemplateEnabled: (templateId, enabledOrPayload, token, updatedAt) =>
      request(`${templatePath(templateId)}/enabled`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(
          typeof enabledOrPayload === "boolean"
            ? { enabled: enabledOrPayload, updatedAt }
            : enabledOrPayload,
        ),
      }),

    listVersions: (templateId, token) =>
      request(`${templatePath(templateId)}/versions`, {
        headers: withAuthHeaders(token),
      }),

    createVersion: (templateId, payload, token) =>
      request(`${templatePath(templateId)}/versions`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    updateVersion: (templateId, versionId, payload, token) =>
      request(
        `${templatePath(templateId)}/versions/${encodeURIComponent(versionId)}`,
        {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload),
        },
      ),

    publishVersion: (templateId, versionId, payload, token) =>
      request(
        `${templatePath(templateId)}/versions/${encodeURIComponent(versionId)}/publish`,
        {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(payload),
        },
      ),

    getProviderSchema: (sourceType, token) =>
      request(
        `/documents/providers/${encodeURIComponent(sourceType)}/schema`,
        { headers: withAuthHeaders(token) },
      ),

    preview: (templateId, payload, token) =>
      requestBlob(`${templatePath(templateId)}/preview`, {
        method: "POST",
        headers: withAuthHeaders(token, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      }),

    generate: (templateId, payload, token) =>
      request(`${templatePath(templateId)}/generate`, {
        method: "POST",
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    listGenerated: (token, query = {}) =>
      request(`/documents/generated${toQueryString(query)}`, {
        headers: withAuthHeaders(token),
      }),

    getGenerated: (generatedId, token) =>
      request(generatedPath(generatedId), {
        headers: withAuthHeaders(token),
      }),

    getGeneratedDownload: (generatedId, token) =>
      request(`${generatedPath(generatedId)}/download`, {
        headers: withAuthHeaders(token),
      }),

    setGeneratedEnabled: (generatedId, enabledOrPayload, token) =>
      request(`${generatedPath(generatedId)}/enabled`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(
          typeof enabledOrPayload === "boolean"
            ? { enabled: enabledOrPayload }
            : enabledOrPayload,
        ),
      }),
  };
}
