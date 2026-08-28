import { useCallback, useEffect, useMemo, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { toast } from "sonner";
import { playCallSound } from "./callSounds";
import { CallRoomLayout } from "./CallRoomLayout";

const UNANSWERED_CALL_TIMEOUT_MS = 36_000;

export function CallRoom({ session, onLeave, onUnanswered, isInitiator = false }) {
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
    events.forEach((event) => room.on(event, refresh));
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
    if (!isInitiator || hasRemoteJoined) return undefined;
    const createdAt = new Date(session.call.createdAt ?? Date.now()).getTime();
    const remaining = Math.max(0, UNANSWERED_CALL_TIMEOUT_MS - (Date.now() - createdAt));
    const timer = window.setTimeout(() => onUnanswered?.(), remaining);
    return () => window.clearTimeout(timer);
  }, [isInitiator, hasRemoteJoined, session.call.createdAt, onUnanswered]);

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
  const isDirectVideo = session.call.kind === "VIDEO" && participants.length === 2;
  const useFocusLayout = isDirectVideo && layoutMode === "focus";
  const mirrorLocalCamera = cameraFacing !== "environment";
  const gridClass = participants.length === 1
    ? "grid-cols-1 grid-rows-1"
    : participants.length === 2
      ? "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1"
      : "grid-cols-2 auto-rows-[minmax(10rem,1fr)] overflow-y-auto";
  void renderVersion;

  return (
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
      }}
    />
  );
}
