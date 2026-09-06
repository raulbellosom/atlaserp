// Merge polled DB messages with live LiveKit-data-channel messages, deduped by
// id, sorted by createdAt then id. Live messages that lack a real id
// (optimistic echoes) are kept only until a DB row with matching body + sender
// + a close timestamp arrives.
export function mergeRoomMessages(dbMessages = [], liveMessages = []) {
  const byId = new Map();
  for (const m of dbMessages) byId.set(m.id, m);
  for (const m of liveMessages) {
    if (m.id && byId.has(m.id)) continue;
    if (m.id) { byId.set(m.id, m); continue; }
    const dup = dbMessages.some(
      (d) => d.body === m.body
        && d.senderName === m.senderName
        && Math.abs(new Date(d.createdAt).getTime() - new Date(m.createdAt).getTime()) < 15000,
    );
    if (!dup) byId.set(m.localId ?? `local:${m.createdAt}:${m.body}`, m);
  }
  return [...byId.values()].sort((a, b) => {
    const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return t !== 0 ? t : String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}
