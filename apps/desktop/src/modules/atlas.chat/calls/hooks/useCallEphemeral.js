import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent } from "livekit-client";
import {
  applyDataPacket,
  removeReaction,
  dropIdentity,
  makeReactionEntry,
  REACTION_CAP,
  REACTION_TTL_MS,
} from "../lib/callEphemeral.js";

// Ephemeral in-call affordances over the LiveKit data channel: floating
// reactions + raise-hand. Adds its OWN DataReceived listener so the chat's
// handler stays untouched. Nothing is persisted; late joiners don't see hands
// raised before they connected (accepted for v1).
export function useCallEphemeral({ room, publishData, selfIdentity, selfName, isHost = false }) {
  const [state, setState] = useState(() => ({ reactions: [], raisedHands: new Map() }));
  const lastReactAt = useRef(0);

  useEffect(() => {
    if (!room) return undefined;

    const onData = (payload) => {
      let packet;
      try {
        packet = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      if (!packet || (packet.type !== "reaction" && packet.type !== "hand" && packet.type !== "hand-lower")) return;
      setState((prev) => applyDataPacket(prev, packet, selfIdentity));
      if (packet.type === "reaction") {
        setTimeout(() => {
          setState((prev) => {
            const last = prev.reactions[prev.reactions.length - 1];
            return last ? removeReaction(prev, last.id) : prev;
          });
        }, REACTION_TTL_MS);
      }
    };

    const onLeft = (participant) => setState((prev) => dropIdentity(prev, participant?.identity));

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
    };
  }, [room, selfIdentity]);

  const sendReaction = useCallback(
    (emoji) => {
      const now = Date.now();
      if (now - lastReactAt.current < 350) return; // simple client throttle
      lastReactAt.current = now;
      publishData?.({ type: "reaction", emoji, fromName: selfName });
      const entry = makeReactionEntry(emoji, selfName);
      setState((prev) => ({ ...prev, reactions: [...prev.reactions, entry].slice(-REACTION_CAP) }));
      setTimeout(() => setState((prev) => removeReaction(prev, entry.id)), REACTION_TTL_MS);
    },
    [publishData, selfName],
  );

  const myHandRaised = state.raisedHands.has(selfIdentity);

  const toggleHand = useCallback(() => {
    setState((prev) => {
      const next = !prev.raisedHands.has(selfIdentity);
      publishData?.({ type: "hand", identity: selfIdentity, name: selfName, raised: next });
      return applyDataPacket(prev, { type: "hand", identity: selfIdentity, name: selfName, raised: next }, selfIdentity);
    });
  }, [publishData, selfIdentity, selfName]);

  const lowerHand = useCallback(
    (identity) => {
      if (!isHost && identity !== selfIdentity) return;
      publishData?.({ type: "hand-lower", identity });
      setState((prev) => dropIdentity(prev, identity));
    },
    [publishData, isHost, selfIdentity],
  );

  return {
    reactions: state.reactions,
    raisedHands: state.raisedHands,
    myHandRaised,
    sendReaction,
    toggleHand,
    lowerHand,
  };
}
