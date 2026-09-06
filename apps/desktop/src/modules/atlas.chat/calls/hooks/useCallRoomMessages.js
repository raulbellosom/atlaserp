import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../auth/AuthProvider";
import { atlas } from "../../../../lib/atlas";
import { mergeRoomMessages } from "../lib/roomChat";

function unwrap(r) {
  return r?.data ?? r;
}

// Member transport for the ephemeral call-room chat. `publishData` is bound by
// CallRoom (room.localParticipant.publishData); `liveIncoming` is the array
// CallRoom accumulates from RoomEvent.DataReceived.
export function useCallRoomMessages(callId, { enabled, liveIncoming = [], publishData }) {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const [dbMessages, setDbMessages] = useState([]);
  const sinceRef = useRef(null);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    if (!callId || !token || !enabled) return;
    try {
      const res = unwrap(await atlas.calls.listMessages(callId, sinceRef.current, token));
      const incoming = res?.messages ?? [];
      if (incoming.length) {
        setDbMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
          sinceRef.current = merged[merged.length - 1]?.id ?? sinceRef.current;
          return merged;
        });
      }
    } catch { /* transient */ }
  }, [callId, token, enabled]);

  useEffect(() => {
    if (!enabled) {
      setDbMessages([]);
      sinceRef.current = null;
      return undefined;
    }
    poll();
    timer.current = setInterval(poll, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled, poll]);

  const send = useCallback(async (body) => {
    const text = String(body ?? "").trim();
    if (!text || !token) return;
    const echo = {
      body: text,
      senderName: userProfile?.displayName ?? "Tú",
      senderKind: "user",
      createdAt: new Date().toISOString(),
      mine: true,
    };
    publishData?.({ type: "chat", ...echo });
    try {
      const res = unwrap(await atlas.calls.sendMessage(callId, text, token));
      if (res?.message) {
        setDbMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      }
    } catch { /* the poll will still pick it up */ }
  }, [callId, token, userProfile?.displayName, publishData]);

  return { messages: mergeRoomMessages(dbMessages, liveIncoming), send };
}
