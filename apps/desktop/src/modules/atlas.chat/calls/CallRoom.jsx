import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { toast } from "sonner";
import { useIsMobile, Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@atlas/ui";
import { useChatMessages } from "../hooks/useChatMessages";
import { playCallSound } from "./callSounds";
import { nextCallView } from "./lib/callChat";
import { CallChatPanel } from "./CallChatPanel";
import { CallGuestRoster } from "./CallGuestRoster";
import { CallShareDialog } from "./CallShareDialog";
import { CallInvitePanel } from "./CallInvitePanel";
import { MiniCallBubble } from "./MiniCallBubble";
import { useCallGuests } from "./hooks/useCallGuests";
import { CallRoomLayout } from "./CallRoomLayout";

const UNANSWERED_CALL_TIMEOUT_MS = 36_000;
// Meet-style: a meeting room where nobody ever joined auto-closes after this,
// with a 60s "¿sigues aquí?" warning + an "extender" button that resets it.
const ALONE_LIMIT_MS = 5 * 60_000;

const CHAT_PANEL_PREF_KEY = "atlas.calls.chatPanel.collapsed";

function readChatCollapsedPref() {
  try {
    return localStorage.getItem(CHAT_PANEL_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function writeChatCollapsedPref(collapsed) {
  try {
    localStorage.setItem(CHAT_PANEL_PREF_KEY, collapsed ? "1" : "0");
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
}

export function CallRoom({ session, onLeave, onUnanswered, isInitiator = false, minimized = false, onMinimize, onRestore }) {
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: true }), [session.callId]);
  const [renderVersion, setRenderVersion] = useState(0);
  const [connectionState, setConnectionState] = useState("connecting");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(session.call.kind === "VIDEO");
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [layoutMode, setLayoutMode] = useState("focus");
  const [cameraFacing, setCameraFacing] = useState("user");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasRemoteJoined, setHasRemoteJoined] = useState(false);

  const conversationId = session.call.conversationId;
  const isMobile = useIsMobile(1024);
  const [mobileView, setMobileView] = useState("video");
  const [chatExpanded, setChatExpanded] = useState(() => !readChatCollapsedPref());

  const { data: chatData } = useChatMessages(conversationId);
  const chatMsgCount = chatData?.data?.length ?? 0;
  const chatActive = isMobile ? mobileView === "chat" : chatExpanded;
  const chatSeenRef = useRef(0);
  const chatLoadedRef = useRef(false);
  const [chatUnread, setChatUnread] = useState(0);

  // Guest access: only the initiator polls the roster (a non-manager member
  // gets a swallowed 403); the share dialog + roster are hidden otherwise.
  const guestsApi = useCallGuests(session.call.id, { enabled: isInitiator });
  const hasGuests = guestsApi.guests.some((g) => g.status === "ADMITTED" || g.status === "LOBBY");
  const [shareOpen, setShareOpen] = useState(false);
  const [liveMessages, setLiveMessages] = useState([]);
  const [aloneDeadline, setAloneDeadline] = useState(() => Date.now() + ALONE_LIMIT_MS);
  const [aloneSecondsLeft, setAloneSecondsLeft] = useState(0);

  const publishData = useCallback((obj) => {
    try {
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true });
    } catch { /* not connected yet */ }
  }, [room]);

  const refresh = useCallback(() => setRenderVersion((value) => value + 1), []);
  const screenShareSupported = Boolean(globalThis.navigator?.mediaDevices?.getDisplayMedia);

  const refreshCameraCapabilities = useCallback(async () => {
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const mediaTrack = publication?.track?.mediaStreamTrack;
    const settings = mediaTrack?.getSettings?.() ?? {};
    const capabilities = mediaTrack?.getCapabilities?.() ?? {};
    if (settings.facingMode === "user" || settings.facingMode === "environment") {
      setCameraFacing(settings.facingMode);
    }
    setTorchSupported(Boolean(capabilities.torch));
    setTorchEnabled(Boolean(settings.torch));
    try {
      const devices = await Room.getLocalDevices("videoinput", false);
      setCanSwitchCamera(devices.length > 1);
    } catch {
      setCanSwitchCamera(false);
    }
  }, [room]);

  useEffect(() => {
    let cancelled = false;
    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged,
    ];
    const handleReconnecting = () => setConnectionState("reconnecting");
    const handleReconnected = () => setConnectionState("connected");
    const handleDisconnected = () => {
      setConnectionState("disconnected");
      playCallSound("exit");
    };
    const handleParticipantConnected = () => {
      setHasRemoteJoined(true);
      playCallSound("join");
      refresh();
    };
    const handleParticipantDisconnected = () => {
      playCallSound("exit");
      refresh();
    };
    const handleMediaDevicesChanged = () => {
      refreshCameraCapabilities().catch(() => {});
    };
    const handleLocalTrackPublished = (publication) => {
      if (publication?.source === Track.Source.ScreenShare) setScreenEnabled(true);
      refresh();
    };
    const handleLocalTrackUnpublished = (publication) => {
      if (publication?.source === Track.Source.ScreenShare) setScreenEnabled(false);
      refresh();
    };
    const handleData = (payload, participant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type !== "chat") return;
        setLiveMessages((prev) => [...prev.slice(-199), {
          body: msg.body,
          senderName: msg.senderName,
          senderKind: msg.senderKind
            ?? (participant?.identity?.startsWith?.("guest_") ? "guest" : "user"),
          createdAt: msg.createdAt ?? new Date().toISOString(),
        }]);
      } catch { /* not a chat data packet */ }
    };
    events.forEach((event) => room.on(event, refresh));
    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.MediaDevicesChanged, handleMediaDevicesChanged);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

    async function connect() {
      try {
        await room.connect(session.livekitUrl, session.token);
        if (cancelled) return;
        if (room.remoteParticipants.size > 0) {
          setHasRemoteJoined(true);
          playCallSound("join");
        }
        setConnectionState("connected");
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch (error) {
          if (!cancelled) {
            setMicEnabled(false);
            toast.error(error?.message || "No se pudo activar el microfono.");
          }
        }
        if (session.call.kind === "VIDEO") {
          try {
            await room.localParticipant.setCameraEnabled(true);
            await refreshCameraCapabilities();
          } catch (error) {
            if (!cancelled) {
              setCameraEnabled(false);
              toast.error(error?.message || "No se pudo activar la camara.");
            }
          }
        }
        await room.startAudio().catch(() => {
          if (!cancelled) setNeedsAudio(true);
        });
        if (!cancelled) refresh();
      } catch (error) {
        if (cancelled) return;
        setConnectionState("failed");
        toast.error(error?.message || "No se pudo conectar a la llamada.");
      }
    }
    connect();

    return () => {
      cancelled = true;
      events.forEach((event) => room.off(event, refresh));
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.MediaDevicesChanged, handleMediaDevicesChanged);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.DataReceived, handleData);
      room.disconnect();
    };
  }, [room, session, refresh, refreshCameraCapabilities]);

  useEffect(() => {
    const started = new Date(session.call.startedAt ?? session.call.createdAt ?? Date.now()).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session.call.createdAt, session.call.startedAt]);

  useEffect(() => {
    // A meeting-room call starts ACTIVE (host alone, guests join via link) —
    // it must not auto-hang-up while the host waits for guests.
    if (!isInitiator || hasRemoteJoined || session.call.status === "ACTIVE") return undefined;
    const createdAt = new Date(session.call.createdAt ?? Date.now()).getTime();
    const remaining = Math.max(0, UNANSWERED_CALL_TIMEOUT_MS - (Date.now() - createdAt));
    const timer = window.setTimeout(() => onUnanswered?.(), remaining);
    return () => window.clearTimeout(timer);
  }, [isInitiator, hasRemoteJoined, session.call.status, session.call.createdAt, onUnanswered]);

  // Count chat messages that arrive while the panel is not the active view.
  useEffect(() => {
    if (!chatLoadedRef.current) {
      if (chatData) {
        chatLoadedRef.current = true;
        chatSeenRef.current = chatMsgCount;
      }
      return;
    }
    if (chatActive) {
      chatSeenRef.current = chatMsgCount;
      setChatUnread(0);
      return;
    }
    if (chatMsgCount > chatSeenRef.current) {
      setChatUnread((current) => current + (chatMsgCount - chatSeenRef.current));
      chatSeenRef.current = chatMsgCount;
    }
  }, [chatMsgCount, chatActive, chatData]);

  async function toggleMicrophone() {
    try {
      const next = !micEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
      refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo cambiar el microfono.");
    }
  }

  async function toggleCamera() {
    try {
      const next = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      if (next) await refreshCameraCapabilities();
      else {
        setTorchEnabled(false);
        setTorchSupported(false);
      }
      refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo cambiar la camara.");
    }
  }

  async function switchCamera() {
    try {
      const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (!cameraTrack?.restartTrack) throw new Error("No hay una camara activa.");
      const nextFacing = cameraFacing === "environment" ? "user" : "environment";
      await cameraTrack.restartTrack({ facingMode: nextFacing });
      setCameraFacing(nextFacing);
      setTorchEnabled(false);
      await refreshCameraCapabilities();
      refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo cambiar de camara.");
    }
  }

  async function toggleTorch() {
    try {
      const mediaTrack = room.localParticipant
        .getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
      if (!mediaTrack || !torchSupported) {
        toast.info("La camara activa no permite controlar la linterna.");
        return;
      }
      const next = !torchEnabled;
      await mediaTrack.applyConstraints({ advanced: [{ torch: next }] });
      setTorchEnabled(next);
    } catch (error) {
      toast.error(error?.message || "No se pudo cambiar la linterna.");
    }
  }

  async function toggleScreen() {
    if (!screenShareSupported) {
      toast.info("Tu navegador no permite compartir pantalla durante una llamada. Prueba desde Chrome o Edge en una computadora.");
      return;
    }
    try {
      const next = !screenEnabled;
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenEnabled(next);
      refresh();
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        toast.info("No se concedio permiso para compartir la pantalla.");
      } else {
        toast.error(error?.message || "No se pudo compartir la pantalla.");
      }
    }
  }

  function handleLeave() {
    playCallSound("exit");
    onLeave();
  }

  const remoteParticipants = Array.from(room.remoteParticipants.values());
  const localEntry = { participant: room.localParticipant, isLocal: true };
  const remoteEntries = remoteParticipants.map((participant) => ({ participant, isLocal: false }));
  const participants = [localEntry, ...remoteEntries];

  const hasLiveTrack = (participant, source) => {
    const pub = participant?.getTrackPublication?.(source);
    return Boolean(pub?.track && !pub.isMuted);
  };
  const anyRemoteHasVideo = remoteParticipants.some(
    (p) => hasLiveTrack(p, Track.Source.Camera) || hasLiveTrack(p, Track.Source.ScreenShare),
  );
  // A call created as AUDIO becomes a video call the moment anyone turns on a
  // camera or starts sharing — the UI must follow the tracks, not the frozen
  // session.call.kind (there is no backend endpoint to change kind mid-call).
  const isVideoActive =
    session.call.kind === "VIDEO" || cameraEnabled || screenEnabled || anyRemoteHasVideo;
  const screenShareEntry =
    participants.find(({ participant }) => hasLiveTrack(participant, Track.Source.ScreenShare)) ?? null;
  const hasScreenShare = Boolean(screenShareEntry);
  const isDirectVideo = isVideoActive && participants.length === 2;
  const useFocusLayout = isDirectVideo && layoutMode === "focus" && !screenShareEntry;
  const mirrorLocalCamera = cameraFacing !== "environment";
  const gridClass = participants.length === 1
    ? "grid-cols-1 grid-rows-1"
    : participants.length === 2
      ? "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1"
      : "grid-cols-2 auto-rows-[minmax(10rem,1fr)] overflow-y-auto";
  void renderVersion;

  const isAlone = participants.length === 1 && !hasGuests;
  // Only meeting-room calls (start ACTIVE, guest link exists) get the alone
  // auto-close — a normal call already has the 36s unanswered timeout.
  const aloneEligible = session.call.status === "ACTIVE" && isInitiator && !hasRemoteJoined && isAlone;

  useEffect(() => {
    if (hasRemoteJoined || hasGuests) setAloneDeadline(Date.now() + ALONE_LIMIT_MS);
  }, [hasRemoteJoined, hasGuests]);

  useEffect(() => {
    if (!aloneEligible) { setAloneSecondsLeft(0); return undefined; }
    const tick = () => {
      const left = aloneDeadline - Date.now();
      if (left <= 0) { handleLeave(); return; }
      setAloneSecondsLeft(left <= 60_000 ? Math.ceil(left / 1000) : 0);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [aloneEligible, aloneDeadline]); // eslint-disable-line react-hooks/exhaustive-deps

  const extendAlone = useCallback(() => {
    setAloneDeadline(Date.now() + ALONE_LIMIT_MS);
    setAloneSecondsLeft(0);
  }, []);

  useEffect(() => {
    const corrected = nextCallView(mobileView, { hasScreenShare });
    if (corrected !== mobileView) setMobileView(corrected);
  }, [mobileView, hasScreenShare]);

  const handleChatClose = useCallback(() => {
    if (isMobile) {
      setMobileView("video");
    } else {
      setChatExpanded(false);
      writeChatCollapsedPref(true);
    }
  }, [isMobile]);

  const handleToggleChatExpanded = useCallback((next) => {
    setChatExpanded(next);
    writeChatCollapsedPref(!next);
  }, []);

  const chatPanelNode =
    !isMobile || mobileView === "chat"
      ? (
        <CallChatPanel
          conversationId={conversationId}
          onClose={handleChatClose}
          roomMode={hasGuests ? "call" : "conversation"}
          callId={session.call.id}
          liveIncoming={liveMessages}
          publishData={publishData}
        />
      )
      : null;

  if (minimized) {
    return (
      <MiniCallBubble
        remoteParticipants={remoteParticipants}
        localParticipant={room.localParticipant}
        elapsed={elapsed}
        micEnabled={micEnabled}
        onToggleMic={toggleMicrophone}
        onRestore={onRestore}
        onHangUp={handleLeave}
      />
    );
  }

  return (
    <>
    <CallRoomLayout
      view={{
        session,
        connectionState,
        elapsed,
        outgoingToneActive: isInitiator
          && !hasRemoteJoined
          && !["failed", "disconnected"].includes(connectionState),
        remoteParticipants,
        remoteEntries,
        localEntry,
        participants,
        useFocusLayout,
        screenShareEntry,
        isVideoActive,
        mirrorLocalCamera,
        gridClass,
        needsAudio,
        micEnabled,
        cameraEnabled,
        canSwitchCamera,
        torchSupported,
        torchEnabled,
        screenEnabled,
        screenShareSupported,
        isDirectVideo,
        layoutMode,
        invitePanel: isInitiator && isAlone
          ? <CallInvitePanel conversationId={conversationId} />
          : null,
      }}
      actions={{
        activateAudio: () => room.startAudio().then(() => setNeedsAudio(false)),
        toggleMicrophone,
        toggleCamera,
        switchCamera,
        toggleTorch,
        toggleScreen,
        toggleLayout: () => setLayoutMode((current) => current === "focus" ? "balanced" : "focus"),
        leave: handleLeave,
        minimize: onMinimize,
      }}
      chat={{
        isMobile,
        mobileView,
        onMobileViewChange: setMobileView,
        chatExpanded,
        onToggleChatExpanded: handleToggleChatExpanded,
        chatUnread,
        hasScreenShare,
        panel: chatPanelNode,
        hasGuests,
        canShare: isInitiator,
        onShare: () => setShareOpen(true),
        pendingLobby: guestsApi.lobby.length,
        roster: isInitiator ? <CallGuestRoster guestsApi={guestsApi} /> : null,
      }}
    />
    {isInitiator && (
      <CallShareDialog open={shareOpen} onOpenChange={setShareOpen} conversationId={conversationId} />
    )}
    <AloneWarningDialog
      open={aloneSecondsLeft > 0}
      seconds={aloneSecondsLeft}
      onStay={extendAlone}
      onLeave={handleLeave}
    />
    </>
  );
}

function AloneWarningDialog({ open, seconds, onStay, onLeave }) {
  return (
    // Non-modal: don't lock the call controls while the "are you there" prompt
    // is up, and any interaction outside counts as "still here".
    <Dialog open={open} modal={false} onOpenChange={(o) => { if (!o) onStay(); }}>
      <DialogContent className="sm:max-w-xs" onInteractOutside={onStay}>
        <DialogHeader><DialogTitle>¿Sigues en la reunión?</DialogTitle></DialogHeader>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Nadie más se ha unido. La reunión se cerrará en {seconds} s.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onLeave}>Salir</Button>
          <Button onClick={onStay}>Seguir aquí</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
