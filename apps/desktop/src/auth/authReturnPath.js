export function normalizeAuthReturnPath(returnTo) {
  if (typeof returnTo !== "string") return "/app";
  if (!/^\/app(?:\/|$)/.test(returnTo)) return "/app";
  if (/^\/app\/login(?:[/?#]|$)/.test(returnTo)) return "/app";
  return returnTo;
}
