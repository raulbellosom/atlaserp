// Walk message pages independently of the visible chat, retaining only shared files.
export async function loadConversationFiles(listMessages, signal) {
  const messages = new Map();
  let before;
  do {
    signal?.throwIfAborted();
    const page = await listMessages({ limit: 100, before });
    signal?.throwIfAborted();
    for (const message of page.data ?? []) {
      if (!message.deleted_at && (message.attachments?.length || message.metadata?.entityRefs?.some((ref) => ref.entityType === "file"))) {
        messages.set(message.id, message);
      }
    }
    if (!page.hasMore) break;
    const next = page.data?.[0]?.created_at;
    if (!next || next === before) throw new Error("No se pudo completar el historial de archivos.");
    before = next;
  } while (true);
  return [...messages.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}
