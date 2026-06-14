export function createWebsiteDomain({ request, withAuthHeaders }) {
  return {
    getSite: (siteId, token) =>
      request(`/website/sites/${encodeURIComponent(siteId)}`, {
        headers: withAuthHeaders(token),
      }),
    updateSite: (siteId, data, token) =>
      request(`/website/sites/${encodeURIComponent(siteId)}`, {
        method: "PATCH",
        headers: withAuthHeaders(token),
        body: JSON.stringify(data),
      }),
    uploadDist: (siteId, file, token) => {
      const formData = new FormData();
      formData.append("file", file);
      return request(
        `/website/sites/${encodeURIComponent(siteId)}/dist/upload`,
        {
          method: "POST",
          headers: withAuthHeaders(token),
          body: formData,
        },
      );
    },
    deleteDist: (siteId, token) =>
      request(`/website/sites/${encodeURIComponent(siteId)}/dist`, {
        method: "DELETE",
        headers: withAuthHeaders(token),
      }),
  };
}
