import { useCallback, useEffect, useRef, useState } from 'react';
import { native } from '../../../native/index.js';
import { atlas } from '../../../lib/atlas';
import { useAuth } from '../../../auth/AuthProvider';

export function useNativeScreenShare(callId) {
  const { session } = useAuth();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const supported = native.supports('screen-share');
  useEffect(() => {
    const run = ++generation.current;
    if (!supported) return undefined;
    const timer = setInterval(() => {
      native.screenShare.status().then((state) => {
        if (generation.current === run) setActive(state.active && state.callId === callId);
      }).catch(() => {});
    }, 1000);
    return () => {
      generation.current++;
      clearInterval(timer);
      native.screenShare.stop().catch(() => {});
    };
  }, [callId, supported]);
  const toggle = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const run = generation.current;
    try {
      if (active) {
        await native.screenShare.stop();
        if (run === generation.current) setActive(false);
      } else {
        const response = await atlas.calls.screenToken(callId, session?.access_token);
        if (run !== generation.current) return;
        const state = await native.screenShare.start(response.data ?? response);
        if (run === generation.current) setActive(Boolean(state.active));
        else await native.screenShare.stop();
      }
    } finally {
      inFlight.current = false;
      if (run === generation.current) setBusy(false);
    }
  }, [active, callId, session?.access_token]);
  return { supported, active, busy, toggle };
}
