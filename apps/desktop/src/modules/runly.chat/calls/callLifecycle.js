import { getApiUrl } from "../../../lib/runtimeConfig";

export function leaveCallOnPageHide(callId, token) {
  fetch(`${getApiUrl()}/calls/${encodeURIComponent(callId)}/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    keepalive: true,
  }).catch(() => {});
}
