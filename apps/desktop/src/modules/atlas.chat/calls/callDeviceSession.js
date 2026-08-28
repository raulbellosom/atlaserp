export const ACTIVE_CALL_SESSION_KEY = "atlas-active-call-id";

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function getClaimedCallId(storage) {
  try {
    return resolveStorage(storage)?.getItem(ACTIVE_CALL_SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

export function claimCallForDevice(callId, storage) {
  if (!callId) return false;
  try {
    resolveStorage(storage)?.setItem(ACTIVE_CALL_SESSION_KEY, callId);
    return true;
  } catch {
    return false;
  }
}

export function releaseCallForDevice(callId, storage) {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    if (!callId || target.getItem(ACTIVE_CALL_SESSION_KEY) === callId) {
      target.removeItem(ACTIVE_CALL_SESSION_KEY);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function shouldResumeCallOnDevice(callId, participantStatus, storage) {
  return participantStatus === "JOINED" && getClaimedCallId(storage) === callId;
}
