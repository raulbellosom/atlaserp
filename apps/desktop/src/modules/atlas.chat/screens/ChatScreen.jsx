import { useState } from "react";
import { PageHeader } from "@atlas/ui";
import { ChatSidebar } from "../components/ChatSidebar";
import { ChatWindow } from "../components/ChatWindow";
import { useChatConversations } from "../hooks/useChatConversations";

export function ChatScreen() {
  const [activeConversation, setActiveConversation] = useState(null);
  const [mobileShowWindow, setMobileShowWindow] = useState(false);

  const { data, isLoading } = useChatConversations();
  const conversations = data?.data ?? [];

  function handleSelect(conv) {
    setActiveConversation(conv);
    setMobileShowWindow(true);
  }

  function handleCreated(conv) {
    if (conv?.id) {
      setActiveConversation(conv);
      setMobileShowWindow(true);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
      <div className="shrink-0 px-4 pt-4 pb-0">
        <PageHeader title="Chat" description="Mensajeria interna en tiempo real" />
      </div>

      <div className="flex flex-1 min-h-0 mt-4 border-t border-[hsl(var(--border))]">
        {/* Sidebar — hidden on mobile when conversation is open */}
        <div className={[
          "flex flex-col",
          mobileShowWindow ? "hidden lg:flex" : "flex",
        ].join(" ")}>
          <ChatSidebar
            conversations={conversations}
            isLoading={isLoading}
            activeId={activeConversation?.id}
            onSelect={handleSelect}
            onCreated={handleCreated}
          />
        </div>

        {/* Chat window */}
        <div className={[
          "flex flex-1 min-w-0",
          mobileShowWindow ? "flex" : "hidden lg:flex",
        ].join(" ")}>
          <ChatWindow
            conversation={activeConversation}
            onClose={() => setMobileShowWindow(false)}
          />
        </div>
      </div>
    </div>
  );
}
