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
 * Subscribe to a single broadcast event on a channel.
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
 * Subscribe to multiple broadcast events on a SINGLE channel.
 * Avoids the channel-removal conflict that occurs when subscribeToBroadcast
 * is called more than once with the same channelName.
 * handlers is an object of { eventName: callbackFn }.
 * Returns an unsubscribe function.
 */
export function subscribeToMultiBroadcast(channelName, handlers) {
  const client = getSupabaseClient();
  const stale = client.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
  if (stale) client.removeChannel(stale);

  let ch = client.channel(channelName);
  for (const [event, fn] of Object.entries(handlers)) {
    ch = ch.on("broadcast", { event }, (payload) => fn(payload));
  }
  ch.subscribe();

  return () => client.removeChannel(ch);
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

