import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { createPresenceChannel } from "../lib/supabaseRealtime";
import { useGlobalPresence } from "../../../providers/RealtimeProvider";

export function useChatPresence(conversationId) {
  const { userProfile: user } = useAuth();
  const { isUserOnline } = useGlobalPresence();
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const channelRef = useRef(null);
  const typingTimeouts = useRef({});

  useEffect(() => {
    setOnlineUsers({});
    setTypingUsers({});
    if (!conversationId || !user?.id) return;
    let disposed = false;

    const { sendTyping, unsubscribe } = createPresenceChannel(
      `chat:presence:${conversationId}`,
      { userId: user.id, displayName: user.displayName ?? user.email ?? user.id },
      {
        onPresenceSync: (state) => {
          if (disposed) return;
          const online = {};
          Object.values(state).forEach((presences) => {
            const p = presences[0];
            if (p?.userId) online[p.userId] = p;
          });
          setOnlineUsers(online);
        },
        onTyping: ({ payload }) => {
          if (disposed) return;
          const { userId, isTyping } = payload ?? {};
          if (!userId || userId === user.id) return;

          if (isTyping) {
            setTypingUsers((prev) => ({ ...prev, [userId]: true }));
            // Auto-clear after 4 seconds if no follow-up
            clearTimeout(typingTimeouts.current[userId]);
            typingTimeouts.current[userId] = setTimeout(() => {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
              });
            }, 4000);
          } else {
            clearTimeout(typingTimeouts.current[userId]);
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[userId];
              return next;
            });
          }
        },
      },
    );

    channelRef.current = { sendTyping };

    return () => {
      disposed = true;
      channelRef.current = null;
      unsubscribe();
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
    };
  }, [conversationId, user?.id, user?.displayName, user?.email]);

  const sendTyping = useCallback((isTyping) => {
    channelRef.current?.sendTyping(isTyping);
  }, []);

  const typingUsersList = Object.keys(typingUsers);

  // isOnline checks per-conversation presence AND global company presence.
  // A user appears online if they have this conversation open OR the app open anywhere.
  const isOnline = (userId) => Boolean(onlineUsers[userId]) || isUserOnline(userId);

  return { onlineUsers, typingUsersList, sendTyping, isOnline };
}
