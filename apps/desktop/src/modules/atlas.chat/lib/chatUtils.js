export function formatMessageTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) {
    return d.toLocaleDateString("es-MX", { weekday: "short" });
  }
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
}

export function formatDateSeparator(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

export function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;

  for (const msg of messages) {
    const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null;
    if (msgDate !== currentDate) {
      groups.push({ type: "date_separator", date: msg.created_at });
      currentDate = msgDate;
    }
    groups.push({ type: "message", ...msg });
  }
  return groups;
}

export function getConversationDisplayName(conversation, currentUserId) {
  if (conversation?.title) return conversation.title;
  if (conversation?.type === "direct") {
    const other = (conversation.members ?? []).find(
      (m) => m.userId !== currentUserId,
    );
    return other?.displayName ?? "Conversacion directa";
  }
  return "Grupo";
}

export function isImageMime(mimeType) {
  return String(mimeType ?? "").startsWith("image/");
}

export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const GUEST_TOKEN_KEY = "atlas_chat_guest_token";
const GUEST_SESSION_KEY = "atlas_chat_guest_session";

export function saveGuestSession(token, sessionData) {
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(sessionData));
  } catch {}
}

export function loadGuestSession() {
  try {
    const token = localStorage.getItem(GUEST_TOKEN_KEY);
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!token) return null;
    return { token, session: raw ? JSON.parse(raw) : null };
  } catch {
    return null;
  }
}

export function clearGuestSession() {
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {}
}
