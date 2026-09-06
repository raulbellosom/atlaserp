import { Loader2 } from "lucide-react";
import "../chat-theme.css";
import {
  ChatPreferencesProvider,
  useChatPreferences,
  chatPreferencesStyle,
} from "../hooks/useChatPreferences";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { ChatWindow } from "../components/ChatWindow";

function unwrap(response) {
  return response?.data ?? response;
}

// The in-call chat surface: the real ChatWindow bound to the call's
// conversation, with call-trimmed header chrome. Placement (desktop dock /
// mobile full-bleed) and show/hide are the caller's job — this component only
// owns theming + the conversation fetch.
export function CallChatPanel({ conversationId, onClose }) {
  return (
    <ChatPreferencesProvider>
      <CallChatPanelInner conversationId={conversationId} onClose={onClose} />
    </ChatPreferencesProvider>
  );
}

function CallChatPanelInner({ conversationId, onClose }) {
  const { prefs } = useChatPreferences();
  const { data, isLoading, isError } = useChatConversationDetail(conversationId);
  const conversation = unwrap(data);

  return (
    <div
      className="chat-glass-theme flex h-full w-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
      style={chatPreferencesStyle(prefs)}
    >
      {isLoading ? (
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
