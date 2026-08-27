// apps/desktop/src/modules/atlas.chat/components/ConversationMediaTab.jsx
import { useState } from "react";
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

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ChatFilesGallery
        messages={messages ?? []}
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
