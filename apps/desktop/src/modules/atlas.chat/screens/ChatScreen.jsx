import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChatSidebar } from "../components/ChatSidebar";
import { ChatWindow } from "../components/ChatWindow";
import { useChatConversations } from "../hooks/useChatConversations";

export function ChatScreen() {
  const { "*": wildcard } = useParams();
  const navigate = useNavigate();

  // Extract conversation ID from /chat/inbox/<id>
  const conversationIdFromUrl = useMemo(() => {
    const match = (wildcard ?? "").match(/^chat\/inbox\/(.+)$/);
    return match ? match[1] : null;
  }, [wildcard]);

  const [mobileShowWindow, setMobileShowWindow] = useState(
    () => Boolean(conversationIdFromUrl),
  );

  const { data, isLoading } = useChatConversations();
  const conversations = data?.data ?? [];

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === conversationIdFromUrl) ?? null,
    [conversations, conversationIdFromUrl],
  );

  // Once the conversation list loads and the URL ID resolves, reveal the window on mobile
  useEffect(() => {
    if (conversationIdFromUrl && activeConversation) {
      setMobileShowWindow(true);
    }
  }, [conversationIdFromUrl, activeConversation]);

  function handleSelect(conv) {
    navigate(`/app/m/atlas.chat/chat/inbox/${conv.id}`, { replace: true });
    setMobileShowWindow(true);
  }

  function handleCreated(conv) {
    if (conv?.id) {
      navigate(`/app/m/atlas.chat/chat/inbox/${conv.id}`, { replace: true });
      setMobileShowWindow(true);
    }
  }

  function handleClose() {
    navigate("/app/m/atlas.chat/chat/inbox", { replace: true });
    setMobileShowWindow(false);
  }

  return (
    <div className="flex h-below-topbar overflow-hidden">
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
          "flex flex-1 min-w-0 min-h-0 overflow-hidden",
          mobileShowWindow ? "flex" : "hidden md:flex",
        ].join(" ")}
      >
        <ChatWindow
          conversation={activeConversation}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}
