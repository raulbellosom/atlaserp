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
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@atlas/ui";
import { Phone, PhoneOff, Video } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { getApiUrl } from "../../../lib/runtimeConfig";
import { getSupabaseClient } from "../../../lib/supabase";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";
import { playCallSound, preloadCallSounds, unlockCallSounds } from "./callSounds";

const CallRoom = lazy(() =>
  import("./CallRoom").then((module) => ({ default: module.CallRoom })),
);

const CallsContext = createContext(null);
const CURRENT_CALL_POLL_MS = 4_000;

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
    sessionStorage.removeItem("atlas-active-call-id");
    toast.info("La llamada ha terminado.");
    return true;
  }, []);

  useEffect(() => {
    preloadCallSounds();
    let unlocked = false;
    async function unlock() {
      if (unlocked) return;
      unlocked = await unlockCallSounds().catch(() => false);
      if (unlocked) {
        document.removeEventListener("pointerdown", unlock, true);
        document.removeEventListener("keydown", unlock, true);
      }
    }
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
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
    setIncomingCall(null);
    setActiveSession(payload);
    activeRef.current = payload;
    dismissSystemCallNotification(payload.call.id).catch(() => {});
    sessionStorage.setItem("atlas-active-call-id", payload.callId ?? payload.call.id);
    return true;
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
      if (incomingRef.current) setIncomingCall(null);
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
      connectWithResponse(await atlas.calls.join(current.call.id, token));
    }
    return current;
  }, [token, userProfile?.id, presentIncomingCall, connectWithResponse]);

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

  // Realtime is the fast path. Polling plus focus/visibility recovery is the
  // reliability path for suspended mobile PWAs and channels that reconnect
  // after the INSERT happened.
  useEffect(() => {
    if (!config.enabled || !token || !userProfile?.id || activeSession) return undefined;
    let running = false;
    async function sync() {
      if (running) return;
      running = true;
      try { await syncCurrentCall(); } catch (error) {
        console.warn("[atlas.calls] No se pudo sincronizar la llamada actual:", error);
      } finally { running = false; }
    }
    const timer = window.setInterval(sync, CURRENT_CALL_POLL_MS);
    const handleVisibility = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [config.enabled, token, userProfile?.id, activeSession, syncCurrentCall]);

  useEffect(() => on("chat.call.incoming", ({ callId } = {}) => {
    if (!callId || rejectIncomingWhileBusy(callId)) return;
    fetchCall(callId).then(presentIncomingCall).catch(() => syncCurrentCall().catch(() => {}));
  }), [on, fetchCall, presentIncomingCall, rejectIncomingWhileBusy, syncCurrentCall]);

  useEffect(() => on("chat.call.ended", ({ callId } = {}) => {
    finishLocalCall(callId);
  }), [on, finishLocalCall]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    function handlePushMessage(event) {
      if (event?.data?.eventType === "chat.call.incoming") {
        syncCurrentCall().catch(() => {});
      }
    }
    navigator.serviceWorker.addEventListener("message", handlePushMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handlePushMessage);
  }, [syncCurrentCall]);

  useEffect(() => {
    if (!config.enabled || !userProfile?.id) return undefined;
    const client = getSupabaseClient();
    const channel = client
      .channel(`pg-call-participant-${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_participant",
          filter: `user_id=eq.${userProfile.id}`,
        },
        async ({ new: next, old }) => {
          const callId = next?.call_id ?? old?.call_id;
          if (!callId) return;
          if (next?.status === "RINGING") {
            if (rejectIncomingWhileBusy(callId)) return;
            try {
              const call = await fetchCall(callId);
              if (call?.status !== "ENDED" && call?.initiatedByUserId !== userProfile.id) {
                presentIncomingCall(call);
              }
            } catch {}
            return;
          }
          if (["LEFT", "DECLINED", "MISSED"].includes(next?.status)) {
            finishLocalCall(callId);
          }
        },
      )
      .subscribe((status, error) => {
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          console.warn(`[atlas.calls] Canal de llamadas ${status}; se usara sincronizacion HTTP.`, error);
        }
      });
    return () => { client.removeChannel(channel); };
  }, [config.enabled, userProfile?.id, fetchCall, presentIncomingCall, rejectIncomingWhileBusy, finishLocalCall]);

  const watchedCallId = activeSession?.call?.id ?? incomingCall?.id ?? null;
  useEffect(() => {
    if (!config.enabled || !watchedCallId) return undefined;
    const client = getSupabaseClient();
    const channel = client
      .channel(`pg-call-state-${watchedCallId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call", filter: `id=eq.${watchedCallId}` },
        ({ new: next }) => {
          if (next?.status === "ENDED") finishLocalCall(watchedCallId);
        },
      )
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [config.enabled, watchedCallId, finishLocalCall]);

  // Broadcast/Postgres Changes normally close the remote UI immediately. This
  // HTTP check covers suspended tabs and transient Realtime reconnects.
  useEffect(() => {
    const callId = activeSession?.call?.id;
    if (!config.enabled || !token || !callId) return undefined;
    let running = false;
    async function syncActiveCall() {
      if (running) return;
      running = true;
      try {
        const call = await fetchCall(callId);
        if (call?.status === "ENDED") finishLocalCall(callId);
      } catch (error) {
        console.warn("[atlas.calls] No se pudo verificar la llamada activa:", error);
      } finally {
        running = false;
      }
    }
    const timer = window.setInterval(syncActiveCall, CURRENT_CALL_POLL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncActiveCall();
    };
    window.addEventListener("focus", syncActiveCall);
    window.addEventListener("online", syncActiveCall);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncActiveCall);
      window.removeEventListener("online", syncActiveCall);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [config.enabled, token, activeSession?.call?.id, fetchCall, finishLocalCall]);

  useEffect(() => {
    if (!activeSession?.call?.id || !token) return undefined;
    const callId = activeSession.call.id;
    function leaveOnPageHide() {
      fetch(`${getApiUrl()}/calls/${encodeURIComponent(callId)}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
        keepalive: true,
      }).catch(() => {});
    }
    window.addEventListener("pagehide", leaveOnPageHide);
    return () => window.removeEventListener("pagehide", leaveOnPageHide);
  }, [activeSession?.call?.id, token]);

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
    setIsStarting(true);
    try {
      connectWithResponse(await atlas.calls.join(incomingCall.id, token));
    } catch (error) {
      toast.error(error?.message || "No se pudo contestar la llamada.");
      setIncomingCall(null);
    } finally {
      setIsStarting(false);
    }
  }, [incomingCall?.id, token, connectWithResponse]);

  const declineIncoming = useCallback(async () => {
    if (!incomingCall?.id) return;
    const callId = incomingCall.id;
    setIncomingCall(null);
    incomingRef.current = null;
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
    sessionStorage.removeItem("atlas-active-call-id");
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

  const incomingName = incomingCall?.initiator?.displayName ?? "Alguien";

  return (
    <CallsContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(incomingCall)} onOpenChange={(open) => { if (!open) declineIncoming(); }}>
        <DialogContent size="sm" mobileVariant="center">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-500">
              {incomingCall?.kind === "VIDEO" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </div>
            <DialogTitle className="text-center">{incomingName}</DialogTitle>
            <DialogDescription className="text-center">
              {incomingCall?.kind === "VIDEO" ? "Videollamada entrante" : "Llamada entrante"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button type="button" variant="destructive" onClick={declineIncoming}>
              <PhoneOff className="mr-2 h-4 w-4" />
              Rechazar
            </Button>
            <Button type="button" onClick={acceptIncoming} disabled={isStarting}>
              {incomingCall?.kind === "VIDEO" ? <Video className="mr-2 h-4 w-4" /> : <Phone className="mr-2 h-4 w-4" />}
              Contestar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
