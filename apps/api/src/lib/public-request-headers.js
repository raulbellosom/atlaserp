// Shared readers for the public-facing storefront/chat-widget request headers.
export function getCompanySlugHeader(c) {
  return c.req.header('X-Runly-Company') || null;
}

export function getSiteIdHeader(c) {
  return c.req.header('X-Runly-Site') || null;
}
