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
import { playCallSound } from "./callSounds";

const CallRoom = lazy(() =>
  import("./CallRoom").then((module) => ({ default: module.CallRoom })),
);

const CallsContext = createContext(null);

function unwrap(response) {
  return response?.data ?? response;
}

export function CallsProvider({ children }) {
  const { session, userProfile } = useAuth();
  const [config, setConfig] = useState({ enabled: false, mode: "disabled", loading: true });
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current = activeSession;
  }, [activeSession]);

  const token = session?.access_token;

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
    sessionStorage.setItem("atlas-active-call-id", payload.callId ?? payload.call.id);
    return true;
  }, []);

  useEffect(() => {
    if (!token || !userProfile?.id) return undefined;
    let cancelled = false;
    let retryTimer = null;

    async function restoreCurrentCall() {
      try {
        const current = unwrap(await atlas.calls.getCurrent(token));
        if (cancelled || !current?.call) return;
        if (current.participantStatus === "RINGING" && current.call.initiatedByUserId !== userProfile.id) {
          setIncomingCall(current.call);
          return;
        }
        if (current.participantStatus === "JOINED") {
          const joined = await atlas.calls.join(current.call.id, token);
          if (!cancelled) connectWithResponse(joined);
        }
      } catch (error) {
        if (!cancelled) console.warn("[atlas.calls] No se pudo restaurar la llamada actual:", error);
      }
    }

    async function bootstrap(attempt = 0) {
      try {
        const status = unwrap(await atlas.calls.getConfig(token));
        if (cancelled) return;
        setConfig({ ...status, loading: false });
        if (status?.enabled) await restoreCurrentCall();
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
  }, [token, userProfile?.id, connectWithResponse]);

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
          if (next?.status === "RINGING" && !activeRef.current) {
            try {
              const call = await fetchCall(callId);
              if (call?.status !== "ENDED" && call?.initiatedByUserId !== userProfile.id) {
                setIncomingCall(call);
              }
            } catch {}
            return;
          }
          if (["LEFT", "DECLINED", "MISSED"].includes(next?.status)) {
            setIncomingCall((current) => current?.id === callId ? null : current);
            if (activeRef.current?.call?.id === callId) setActiveSession(null);
          }
        },
      )
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [config.enabled, userProfile?.id, fetchCall]);

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
          if (next?.status === "ENDED") {
            playCallSound("exit");
            setIncomingCall(null);
            setActiveSession(null);
            sessionStorage.removeItem("atlas-active-call-id");
            toast.info("La llamada ha terminado.");
          }
        },
      )
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [config.enabled, watchedCallId]);

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
    try {
      await atlas.calls.decline(callId, token);
    } catch (error) {
      toast.error(error?.message || "No se pudo rechazar la llamada.");
    }
  }, [incomingCall?.id, token]);

  const leaveActive = useCallback(async () => {
    const callId = activeRef.current?.call?.id;
    setActiveSession(null);
    sessionStorage.removeItem("atlas-active-call-id");
    if (!callId) return;
    try {
      await atlas.calls.leave(callId, token);
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar el estado de la llamada.");
    }
  }, [token]);

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
        <DialogContent size="sm">
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
