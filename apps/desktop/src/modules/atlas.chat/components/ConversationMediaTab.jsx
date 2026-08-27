// apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
import { useState } from "react";
import { useChatMessages } from "../hooks/useChatMessages";
import { ChatFilesGallery } from "./ChatFilesGallery";
import { ChatAttachmentViewer } from "./ChatAttachmentViewer";

// Reuses ChatFilesGallery — the same component the header's standalone
// "Ver archivos" full-screen toggle already renders (a prior task extracted
// it into its own file so both call sites share one implementation). Only
// shows attachments from messages already loaded/paginated into the query
// cache, same limitation the existing toggle already has — this is a
// convenience view, not a replacement for that toggle.
export function ConversationMediaTab({ conversationId }) {
  const { data, isLoading } = useChatMessages(conversationId);
  const [viewer, setViewer] = useState({ open: false, attachments: [], activeIndex: 0 });

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ChatFilesGallery
        messages={data?.data ?? []}
        isLoading={isLoading}
        onAttachmentClick={(attachments, activeIndex) => setViewer({ open: true, attachments, activeIndex })}
      />
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
