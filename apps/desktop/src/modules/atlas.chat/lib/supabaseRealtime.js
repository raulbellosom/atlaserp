import { getSupabaseClient } from "../../../lib/supabase.js";

/**
 * Subscribe to new/updated messages in a conversation via Postgres Changes.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(conversationId, onMessage) {
  const client = getSupabaseClient();
  const channelName = `chat:messages:${conversationId}`;

  // Supabase client.channel() returns an existing channel if one with the same
  // topic is still registered. If that channel is already subscribed, calling
  // .on() on it throws. Remove any stale channel before creating a fresh one.
  // This happens in React strict-mode (double-mount) and on dep-triggered re-runs.
  const stale = client.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
  if (stale) client.removeChannel(stale);

  const channel = client
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload),
    )
    .subscribe();

  return () => client.removeChannel(channel);
}

/**
 * Subscribe to new/updated messages via Broadcast (for guest channels too).
 * Returns an unsubscribe function.
 */
export function subscribeToBroadcast(channelName, event, onEvent) {
  const client = getSupabaseClient();
  const stale = client.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
  if (stale) client.removeChannel(stale);

  const channel = client
    .channel(channelName)
    .on("broadcast", { event }, (payload) => onEvent(payload))
    .subscribe();

  return () => client.removeChannel(channel);
}

/**
 * Create a Presence + Broadcast channel for a conversation.
 * Used for typing indicators and online status.
 */
export function createPresenceChannel(channelName, userPresenceData, { onPresenceSync, onTyping } = {}) {
  const client = getSupabaseClient();
  const channel = client.channel(channelName, {
    config: { presence: { key: userPresenceData.userId } },
  });

  if (onPresenceSync) {
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      onPresenceSync(state);
    });
  }

  if (onTyping) {
    channel.on("broadcast", { event: "typing" }, (payload) => onTyping(payload));
  }

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track(userPresenceData);
    }
  });

  const sendTyping = (isTyping) => {
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: userPresenceData.userId, isTyping },
    });
  };

  return {
    channel,
    sendTyping,
    unsubscribe: () => client.removeChannel(channel),
  };
}

