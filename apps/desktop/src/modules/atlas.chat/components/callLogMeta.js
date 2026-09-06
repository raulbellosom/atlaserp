// Pure: decide whether a chat message row is an atlas.calls lifecycle card and
// return its { callId?, kind, event, endReason, durationSec } payload, else
// null. No JSX so it is unit-testable under `node --test`.

export function getCallMeta(message) {
  if (!message) return null;
  const isSystem = message.sender_type === "system" || message.message_type === "system";
  if (!isSystem) return null;

  let meta = message.metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return null;
    }
  }

  const call = meta && typeof meta === "object" ? meta.call : null;
  if (!call || (call.event !== "started" && call.event !== "ended")) return null;
  return call;
}
