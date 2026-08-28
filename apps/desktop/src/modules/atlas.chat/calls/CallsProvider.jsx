import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";
import { playCallSound } from "./callSounds";
import {
  claimCallForDevice,
  releaseCallForDevice,
  shouldResumeCallOnDevice,
} from "./callDeviceSession";
import { useCallSynchronization } from "./useCallSynchronization";
import { IncomingCallDialog } from "./IncomingCallDialog";

const CallRoom = lazy(() =>
  import("./CallRoom").then((module) => ({ default: module.CallRoom })),
);

const CallsContext = createContext(null);

function unwrap(response) {
  return response?.data ?? response;
}

async function dismissSystemCallNotification(callId) {
  if (!callId || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const notifications = await registration?.getNotifications?.({ tag: `call:${callId}` });
  notifications?.forEach((notification) => notification.close());
}

export function CallsProvider({ children }) {
  const { session, userProfile } = useAuth();
  const { on } = useRealtimeContext();
  const [config, setConfig] = useState({ enabled: false, mode: "disabled", loading: true });
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const activeRef = useRef(null);
  const incomingRef = useRef(null);
  const joiningCallRef = useRef(null);
  const busyNoticeRef = useRef(new Set());

  useEffect(() => {
    activeRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    incomingRef.current = incomingCall;
  }, [incomingCall]);

  const token = session?.access_token;

  const finishLocalCall = useCallback((callId) => {
    if (!callId) return false;
    const matchesIncoming = incomingRef.current?.id === callId;
    const matchesActive = activeRef.current?.call?.id === callId;
    if (!matchesIncoming && !matchesActive) return false;
    incomingRef.current = null;
    activeRef.current = null;
    setIncomingCall(null);
    setActiveSession(null);
    playCallSound("exit");
    dismissSystemCallNotification(callId).catch(() => {});
    releaseCallForDevice(callId);
    toast.info("La llamada ha terminado.");
    return true;
  }, []);

  useEffect(() => {
    if (!incomingCall?.id) return undefined;
    return playCallSound("ringtone", { loop: true, volume: 0.5 });
  }, [incomingCall?.id]);

  const fetchCall = useCallback(async (callId) => {
    const response = await atlas.calls.get(callId, token);
    return unwrap(response);
  }, [token]);

  const connectWithResponse = useCallback((response) => {
    const payload = unwrap(response);
    if (!payload?.call || !payload?.token || !payload?.livekitUrl) return false;
    incomingRef.current = null;
    setIncomingCall(null);
    setActiveSession(payload);
    activeRef.current = payload;
    dismissSystemCallNotification(payload.call.id).catch(() => {});
    claimCallForDevice(payload.callId ?? payload.call.id);
    return true;
  }, []);

  const dismissAnsweredOnOtherDevice = useCallback((callId) => {
    if (!callId || activeRef.current?.call?.id === callId) return false;
    const wasIncoming = incomingRef.current?.id === callId;
    if (wasIncoming) {
      incomingRef.current = null;
      setIncomingCall(null);
      toast.info("La llamada fue contestada en otro dispositivo.");
    }
    releaseCallForDevice(callId);
    dismissSystemCallNotification(callId).catch(() => {});
    return wasIncoming;
  }, []);

  const rejectIncomingWhileBusy = useCallback((callId) => {
    const activeCallId = activeRef.current?.call?.id;
    if (!callId || !activeCallId || callId === activeCallId) return false;
    if (busyNoticeRef.current.has(callId)) return true;
    if (busyNoticeRef.current.size > 100) busyNoticeRef.current.clear();
    busyNoticeRef.current.add(callId);
    toast.info("Otra persona intento llamarte mientras estabas ocupado.");
    atlas.calls.decline(callId, token).catch(() => {});
    return true;
  }, [token]);

  const presentIncomingCall = useCallback((call) => {
    if (!call?.id || call.status === "ENDED" || call.initiatedByUserId === userProfile?.id) return;
    // Already connected to THIS call — a stale RINGING postgres_changes row or
    // a poll that lands right after you answer must not re-open the incoming
    // dialog, which restarts its looping ringtone over the CallRoom's own
    // "join" sound. (rejectIncomingWhileBusy deliberately returns false for
    // callId === activeCallId, so it can't catch this case.)
    if (activeRef.current?.call?.id === call.id) return;
    if (rejectIncomingWhileBusy(call.id)) return;
    const isNewCall = incomingRef.current?.id !== call.id;
    incomingRef.current = call;
    setIncomingCall(call);
    if (isNewCall) globalThis.navigator?.vibrate?.([400, 180, 400, 180, 400]);
  }, [userProfile?.id, rejectIncomingWhileBusy]);

  const syncCurrentCall = useCallback(async () => {
    if (!token || !userProfile?.id) return null;
    const current = unwrap(await atlas.calls.getCurrent(token));
    if (!current?.call) {
      if (incomingRef.current) {
        incomingRef.current = null;
        setIncomingCall(null);
      }
      if (!activeRef.current) releaseCallForDevice();
      return null;
    }
    if (
      current.participantStatus === "RINGING"
      && current.call.initiatedByUserId !== userProfile.id
      && !activeRef.current
    ) {
      presentIncomingCall(current.call);
      return current;
    }
    if (current.participantStatus === "JOINED" && !activeRef.current) {
      if (!shouldResumeCallOnDevice(current.call.id, current.participantStatus)) {
        dismissAnsweredOnOtherDevice(current.call.id);
        return current;
      }
      if (joiningCallRef.current === current.call.id) return current;
      joiningCallRef.current = current.call.id;
      try {
        connectWithResponse(await atlas.calls.join(current.call.id, token));
      } finally {
        joiningCallRef.current = null;
      }
    }
    return current;
  }, [token, userProfile?.id, presentIncomingCall, connectWithResponse, dismissAnsweredOnOtherDevice]);

  useEffect(() => {
    if (!token || !userProfile?.id) return undefined;
    let cancelled = false;
    let retryTimer = null;

    async function bootstrap(attempt = 0) {
      try {
        const status = unwrap(await atlas.calls.getConfig(token));
        if (cancelled) return;
        setConfig({ ...status, loading: false });
        if (status?.enabled) await syncCurrentCall();
      } catch (error) {
        if (cancelled) return;
        setConfig({ enabled: false, mode: "unavailable", loading: false });
        if (attempt === 0) console.warn("[atlas.calls] Configuracion no disponible; se reintentara.", error);
        const delay = Math.min(1_000 * (2 ** attempt), 30_000);
        retryTimer = window.setTimeout(() => bootstrap(attempt + 1), delay);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [token, userProfile?.id, syncCurrentCall]);

  useCallSynchronization({
    enabled: config.enabled,
    token,
    userId: userProfile?.id,
    activeCallId: activeSession?.call?.id,
    incomingCallId: incomingCall?.id,
    onRealtime: on,
    syncCurrentCall,
    fetchCall,
    presentIncomingCall,
    rejectIncomingWhileBusy,
    finishLocalCall,
    dismissAnsweredOnOtherDevice,
  });

  const startCall = useCallback(async ({ conversationId, kind, calendarEventId }) => {
    if (!config.enabled || isStarting) return false;
    setIsStarting(true);
    try {
      const response = await atlas.calls.create({ conversationId, kind, calendarEventId }, token);
      connectWithResponse(response);
      return true;
    } catch (error) {
      const existingCallId = error?.details?.details?.callId;
      if (error?.status === 409 && existingCallId) {
        try {
          connectWithResponse(await atlas.calls.join(existingCallId, token));
          toast.info("Te uniste a la llamada que ya estaba en curso.");
          return true;
        } catch (joinError) {
          toast.error(joinError?.message || "No se pudo unir a la llamada.");
          return false;
        }
      }
      toast.error(error?.message || "No se pudo iniciar la llamada.");
      return false;
    } finally {
      setIsStarting(false);
    }
  }, [config.enabled, isStarting, token, connectWithResponse]);

  const acceptIncoming = useCallback(async () => {
    if (!incomingCall?.id) return;
    const callId = incomingCall.id;
    claimCallForDevice(callId);
    joiningCallRef.current = callId;
    setIsStarting(true);
    try {
      connectWithResponse(await atlas.calls.join(callId, token));
    } catch (error) {
      releaseCallForDevice(callId);
      toast.error(error?.message || "No se pudo contestar la llamada.");
      incomingRef.current = null;
      setIncomingCall(null);
    } finally {
      joiningCallRef.current = null;
      setIsStarting(false);
    }
  }, [incomingCall?.id, token, connectWithResponse]);

  const declineIncoming = useCallback(async () => {
    if (!incomingCall?.id) return;
    const callId = incomingCall.id;
    setIncomingCall(null);
    incomingRef.current = null;
    releaseCallForDevice(callId);
    dismissSystemCallNotification(callId).catch(() => {});
    try {
      await atlas.calls.decline(callId, token);
    } catch (error) {
      toast.error(error?.message || "No se pudo rechazar la llamada.");
    }
  }, [incomingCall?.id, token]);

  const leaveActive = useCallback(async ({ unanswered = false } = {}) => {
    const current = activeRef.current;
    const callId = current?.call?.id;
    const isInitiator = current?.call?.initiatedByUserId === userProfile?.id;
    setActiveSession(null);
    activeRef.current = null;
    releaseCallForDevice(callId);
    if (!callId) return;
    try {
      if (isInitiator) await atlas.calls.end(callId, token);
      else await atlas.calls.leave(callId, token);
      if (unanswered) toast.info("Nadie respondio la llamada.");
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar el estado de la llamada.");
    }
  }, [token, userProfile?.id]);

  const endUnansweredCall = useCallback(() => {
    leaveActive({ unanswered: true });
  }, [leaveActive]);

  const value = useMemo(() => ({
    enabled: config.enabled,
    loading: config.loading,
    isStarting,
    activeCall: activeSession?.call ?? null,
    startCall,
  }), [config.enabled, config.loading, isStarting, activeSession?.call, startCall]);

  return (
    <CallsContext.Provider value={value}>
      {children}
      <IncomingCallDialog
        call={incomingCall}
        isStarting={isStarting}
        onAccept={acceptIncoming}
        onDecline={declineIncoming}
      />
      {activeSession && (
        <Suspense fallback={<div className="fixed inset-0 z-[10020] bg-slate-950" />}>
          <CallRoom
            key={activeSession.call.id}
            session={activeSession}
            onLeave={leaveActive}
            onUnanswered={endUnansweredCall}
            isInitiator={activeSession.call.initiatedByUserId === userProfile?.id}
          />
        </Suspense>
      )}
    </CallsContext.Provider>
  );
}

export function useCalls() {
  const value = useContext(CallsContext);
  if (!value) throw new Error("useCalls must be used inside CallsProvider");
  return value;
}
