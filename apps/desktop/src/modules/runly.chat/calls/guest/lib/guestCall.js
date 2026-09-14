export const GUEST_PHASES = ["gate", "lobby", "room", "ended", "error"];

// s: { joined, status, callEnded, error }
//   status: "waiting" | "LOBBY" | "ADMITTED" | "LEFT" | "KICKED" | "DENIED"
export function guestPhase(s = {}) {
  if (!s.joined) return "gate";
  if (s.error) return "error";
  if (s.callEnded) return "ended";
  if (s.status === "DENIED" || s.status === "KICKED" || s.status === "LEFT") return "ended";
  if (s.status === "ADMITTED") return "room";
  return "lobby"; // "waiting" or "LOBBY"
}

export function endedReason(s = {}) {
  if (s.status === "DENIED") return "El anfitrión no te admitió a la llamada.";
  if (s.status === "KICKED") return "El anfitrión te sacó de la llamada.";
  return "La llamada terminó.";
}

export function buildGuestJoinUrl({ origin, token = null, code = null, invite = null }) {
  const base = String(origin ?? "").replace(/\/+$/, "");
  if (token) return `${base}/p/call/${token}${invite ? `?i=${invite}` : ""}`;
  return `${base}/p/call${code ? `?code=${code}` : ""}`;
}
