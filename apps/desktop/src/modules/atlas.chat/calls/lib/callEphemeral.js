// apps/desktop/src/modules/atlas.chat/calls/lib/callEphemeral.js
//
// Pure state helpers for the ephemeral (LiveKit data-channel only) in-call
// affordances: floating reactions and raise-hand. No persistence, no API.
export const REACTION_CAP = 24;
export const REACTION_TTL_MS = 4000;
export const QUICK_REACTIONS = ["❤️", "👍", "😂", "🎉", "👏", "😮"];

let _seq = 0;
export function makeReactionEntry(emoji, fromName) {
  _seq += 1;
  return { id: `r${Date.now()}-${_seq}`, emoji, fromName: fromName ?? null, at: Date.now() };
}

// Given { reactions, raisedHands(Map) } and an inbound data packet, return the
// next state — same reference when the packet is a no-op.
export function applyDataPacket(state, packet, _selfIdentity) {
  if (!packet || typeof packet !== "object") return state;

  if (packet.type === "reaction") {
    const entry = makeReactionEntry(packet.emoji, packet.fromName);
    return { ...state, reactions: [...state.reactions, entry].slice(-REACTION_CAP) };
  }

  if (packet.type === "hand" && packet.identity) {
    const raisedHands = new Map(state.raisedHands);
    raisedHands.delete(packet.identity); // re-raise => move to the end of the order
    if (packet.raised) raisedHands.set(packet.identity, { name: packet.name ?? null, at: Date.now() });
    return { ...state, raisedHands };
  }

  if (packet.type === "hand-lower" && packet.identity) {
    if (!state.raisedHands.has(packet.identity)) return state;
    const raisedHands = new Map(state.raisedHands);
    raisedHands.delete(packet.identity);
    return { ...state, raisedHands };
  }

  return state;
}

export function removeReaction(state, id) {
  const reactions = state.reactions.filter((r) => r.id !== id);
  return reactions.length === state.reactions.length ? state : { ...state, reactions };
}

export function dropIdentity(state, identity) {
  if (!identity || !state.raisedHands.has(identity)) return state;
  const raisedHands = new Map(state.raisedHands);
  raisedHands.delete(identity);
  return { ...state, raisedHands };
}

// Raised hands as an array in raise order (Map preserves insertion order).
export function raiseOrder(map) {
  return [...map.entries()].map(([identity, v]) => ({ identity, ...v }));
}
