import { useAuth } from "../../../auth/AuthProvider";
import { RoomChatView } from "./RoomChatView";
import { useCallRoomMessages } from "./hooks/useCallRoomMessages";

// Member-side wrapper: the ephemeral call-room chat shown in CallChatPanel
// whenever the call has guests.
export function CallRoomChat({ callId, liveIncoming, publishData }) {
  const { userProfile } = useAuth();
  const { messages, send } = useCallRoomMessages(callId, {
    enabled: !!callId,
    liveIncoming,
    publishData,
  });
  return (
    <RoomChatView
      messages={messages}
      onSend={send}
      currentName={userProfile?.displayName}
      notice="Chat temporal de la llamada — no se guarda en la conversación."
    />
  );
}
