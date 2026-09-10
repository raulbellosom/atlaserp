// Classify an error (Error instance or {message,status}) for ApiErrorScreen.
// Pure — extracted from ApiErrorScreen.jsx so it can be unit-tested without a
// JSX loader.
export function classifyError(error) {
  if (!error) return { type: "unknown", code: null };

  const msg = (error.message ?? "").toLowerCase();
  const status = error.status ?? null;

  // Network / connection refused. A bare `TypeError` is NOT enough — a
  // render-time TypeError ("null is not an object (evaluating 'x.then')") is a
  // code bug, not a connectivity problem, and must not masquerade as
  // "SIN CONEXION". Only classify as network when the message actually looks
  // like a failed fetch.
  if (
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("net::") ||
    (msg.includes("fetch") && !status)
  ) {
    return { type: "network", code: null };
  }

  // Resolve numeric HTTP code from message like "Atlas API error 503"
  const codeFromStatus = typeof status === "number" ? status : null;
  const codeFromMsg = (() => {
    const m = msg.match(/\b([45]\d{2})\b/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const code = codeFromStatus ?? codeFromMsg;

  if (code === 401) return { type: "unauthorized", code };
  if (code === 403) return { type: "forbidden", code };
  if (code === 404) return { type: "not_found", code };
  if (code === 408) return { type: "timeout", code };
  if (code === 422) return { type: "validation", code };
  if (code === 429) return { type: "rate_limit", code };
  if (code === 500) return { type: "server_error", code };
  if (code === 502) return { type: "bad_gateway", code };
  if (code === 503) return { type: "unavailable", code };
  if (code >= 500) return { type: "server_error", code };
  if (code >= 400) return { type: "client_error", code };

  if (msg.includes("timeout") || msg.includes("timed out")) {
    return { type: "timeout", code: 408 };
  }

  return { type: "unknown", code: null };
}
