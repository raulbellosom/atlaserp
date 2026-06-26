import { useState } from "react";
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
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Conversation list — full width on mobile, fixed 288px on desktop */}
      <div
        className={[
          "flex flex-col shrink-0 w-full md:w-72",
          mobileShowWindow ? "hidden md:flex" : "flex",
        ].join(" ")}
      >
        <ChatSidebar
          conversations={conversations}
          isLoading={isLoading}
          activeId={activeConversation?.id}
          onSelect={handleSelect}
          onCreated={handleCreated}
        />
      </div>

      {/* Chat window — fills remaining space */}
      <div
        className={[
          "flex flex-1 min-w-0",
          mobileShowWindow ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <ChatWindow
          conversation={activeConversation}
          onClose={() => setMobileShowWindow(false)}
        />
      </div>
    </div>
  );
}
