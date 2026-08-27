// apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
import { useState, useMemo } from "react";
import { ChatFilesGallery } from "./ChatFilesGallery";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";

// Receives messages as a prop rather than calling useChatMessages itself —
// the parent (ChatWindow/MiniChatWindow) already has this data from its own
// single useChatMessages call. Calling the hook a second time here would
// open a second Supabase Realtime subscription for the same conversationId,
// and subscribeToMessages() defensively tears down any existing channel
// with the same topic before subscribing — silently killing the main
// message list's live updates the moment this tab mounts.
export function ConversationMediaTab({ messages, isLoading }) {
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Same lookup ChatFilesGallery builds internally, needed here too so
  // "Descargar" can resolve each selected id back to its url/fileName.
  const allAttachments = useMemo(() => {
    if (!messages?.length) return [];
    const result = [];
    for (const msg of messages) {
      for (const att of (msg.attachments ?? [])) result.push(att);
    }
    return result;
  }, [messages]);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancelSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  // Direct sequential downloads — no zip library, no new dependency. Staggered
  // by 150ms per file so browsers that would otherwise block a burst of
  // simultaneous downloads (Chrome's multi-download permission prompt) let
  // them through one at a time instead.
  function handleBulkDownload() {
    const targets = allAttachments.filter((a) => selectedIds.has(a.id));
    targets.forEach((att, i) => {
      setTimeout(() => {
        if (!att.url) return;
        const a = document.createElement("a");
        a.href = att.url;
        a.download = att.fileName ?? "archivo";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }, i * 150);
    });
    cancelSelection();
  }

  return (
    <div className="flex flex-col">
      <ChatFilesGallery
        messages={messages ?? []}
        isLoading={isLoading}
        onAttachmentClick={(attachments, activeIndex) => setViewer({ open: true, attachments, activeIndex })}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onEnterSelection={() => setSelectionMode(true)}
        onCancelSelection={cancelSelection}
      />
      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky bottom-0 px-4 py-2.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center justify-between">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {selectedIds.size} {selectedIds.size === 1 ? "archivo" : "archivos"}
          </span>
          <button
            type="button"
            onClick={handleBulkDownload}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            Descargar ({selectedIds.size})
          </button>
        </div>
      )}
      <ChatAttachmentViewer
        open={viewer.open}
        onOpenChange={(open) => setViewer((v) => ({ ...v, open }))}
        attachments={viewer.attachments}
        activeIndex={viewer.activeIndex}
        onIndexChange={(i) => setViewer((v) => ({ ...v, activeIndex: i }))}
      />
    </div>
  );
}
