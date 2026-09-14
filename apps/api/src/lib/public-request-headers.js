// Shared readers for the public-facing storefront/chat-widget request
// headers. X-Runly-* is canonical; X-Atlas-* is accepted as a fallback so an
// already-embedded customer widget running an older cached SDK build keeps
// working until it picks up the new one.
export function getCompanySlugHeader(c) {
  return c.req.header('X-Runly-Company') || c.req.header('X-Atlas-Company') || null;
}

export function getSiteIdHeader(c) {
  return c.req.header('X-Runly-Site') || c.req.header('X-Atlas-Site') || null;
}
