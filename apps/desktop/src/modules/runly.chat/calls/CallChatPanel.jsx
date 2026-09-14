import { Loader2 } from "lucide-react";
import "../chat-theme.css";
import {
  ChatPreferencesProvider,
  useChatPreferences,
  chatPreferencesStyle,
} from "../hooks/useChatPreferences";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { ChatWindow } from "../components/ChatWindow";
import { CallRoomChat } from "./CallRoomChat";

function unwrap(response) {
  return response?.data ?? response;
}

// The in-call chat surface. In "conversation" mode it is the real ChatWindow
// bound to the call's conversation (call-trimmed header). In "call" mode — used
// whenever the call has guests — it is the ephemeral call-room chat, so guest
// messages never enter the org conversation. Placement / show-hide is the
// caller's job; this component owns theming.
export function CallChatPanel({
  conversationId,
  onClose,
  roomMode = "conversation",
  callId = null,
  liveIncoming = [],
  publishData = null,
}) {
  return (
    <ChatPreferencesProvider>
      <CallChatPanelInner
        conversationId={conversationId}
        onClose={onClose}
        roomMode={roomMode}
        callId={callId}
        liveIncoming={liveIncoming}
        publishData={publishData}
      />
    </ChatPreferencesProvider>
  );
}

function CallChatPanelInner({ conversationId, onClose, roomMode, callId, liveIncoming, publishData }) {
  const { prefs } = useChatPreferences();
  const isRoom = roomMode === "call";
  // Passing null disables the query (the hook guards on Boolean(token && id)).
  const { data, isLoading, isError } = useChatConversationDetail(isRoom ? null : conversationId);
  const conversation = unwrap(data);

  return (
    <div
      className="chat-glass-theme flex h-full w-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
      style={chatPreferencesStyle(prefs)}
    >
      {isRoom ? (
        <CallRoomChat callId={callId} liveIncoming={liveIncoming} publishData={publishData} />
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError || !conversation ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No se pudo cargar el chat de la llamada.
        </div>
      ) : (
        <ChatWindow conversation={conversation} embedded="call" onCollapse={onClose} />
      )}
    </div>
  );
}
