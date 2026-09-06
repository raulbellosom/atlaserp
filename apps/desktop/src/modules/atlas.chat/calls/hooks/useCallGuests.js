import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../auth/AuthProvider";
import { atlas } from "../../../../lib/atlas";

function unwrap(r) {
  return r?.data ?? r;
}

// Polls the host guest roster for a live call. Returns { guests, lobby,
// admitted, refresh, admit, deny, kick, mute }. `enabled` gates polling
// (pass false when there is no call / the user is not a call manager — a 403
// from the endpoint is swallowed so nothing renders).
export function useCallGuests(callId, { enabled = true, intervalMs = 3000 } = {}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [guests, setGuests] = useState([]);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    if (!callId || !token || !enabled) return;
    try {
      const res = unwrap(await atlas.calls.listGuests(callId, token));
      setGuests(res?.guests ?? []);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [callId, token, enabled]);

  useEffect(() => {
    if (!callId || !token || !enabled) {
      setGuests([]);
      return undefined;
    }
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [callId, token, enabled, intervalMs, refresh]);

  const act = useCallback(async (fn) => {
    await fn();
    await refresh();
  }, [refresh]);

  return {
    guests,
    lobby: guests.filter((g) => g.status === "LOBBY"),
    admitted: guests.filter((g) => g.status === "ADMITTED"),
    error,
    refresh,
    admit: (guestId) => act(() => atlas.calls.admitGuest(callId, guestId, token)),
    deny: (guestId) => act(() => atlas.calls.denyGuest(callId, guestId, token)),
    kick: (guestId) => act(() => atlas.calls.kickGuest(callId, guestId, token)),
    mute: (guestId, muted) => act(() => atlas.calls.muteGuest(callId, guestId, muted, token)),
  };
}
