import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@atlas/ui";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Volume2,
} from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { toast } from "sonner";
import { playCallSound } from "./callSounds";

const UNANSWERED_CALL_TIMEOUT_MS = 36_000;

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function TrackRenderer({ participant, source, muted = false, mirror = false }) {
  const elementRef = useRef(null);
  const publication = participant?.getTrackPublication?.(source);
  const track = publication?.track;

  useEffect(() => {
    const element = elementRef.current;
    if (!track || !element) return undefined;
    track.attach(element);
    return () => track.detach(element);
  }, [track]);

  if (!track || publication?.isMuted) return null;
  return (
    <video
      ref={elementRef}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function ParticipantTile({ participant, isLocal }) {
  const screen = participant?.getTrackPublication?.(Track.Source.ScreenShare);
  const camera = participant?.getTrackPublication?.(Track.Source.Camera);
  const hasVideo = Boolean(
    (screen?.track && !screen.isMuted) || (camera?.track && !camera.isMuted),
  );
  const source = screen?.track && !screen.isMuted ? Track.Source.ScreenShare : Track.Source.Camera;
  const name = participant?.name || (isLocal ? "Tu" : participant?.identity) || "Participante";

  return (
    <div className="relative min-h-44 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
      {hasVideo ? (
        <TrackRenderer
          participant={participant}
          source={source}
          muted={isLocal}
          mirror={isLocal && source === Track.Source.Camera}
        />
      ) : (
        <div className="flex h-full min-h-44 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/20 text-3xl font-semibold text-violet-100 ring-1 ring-violet-400/30">
            {name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8">
        <span className="truncate text-sm font-medium text-white">
          {isLocal ? `${name} (tu)` : name}
        </span>
        {!participant?.isMicrophoneEnabled && <MicOff className="h-4 w-4 text-white/70" />}
      </div>
    </div>
  );
}

function RemoteAudio({ participant }) {
  const audioRef = useRef(null);
  const publication = participant?.getTrackPublication?.(Track.Source.Microphone);
  const track = publication?.track;

  useEffect(() => {
    const element = audioRef.current;
    if (!track || !element) return undefined;
    track.attach(element);
    return () => track.detach(element);
  }, [track]);

  return <audio ref={audioRef} autoPlay />;
}

function OutgoingCallTone({ active }) {
  useEffect(() => {
    if (!active) return undefined;
    return playCallSound("ringtone", { loop: true, volume: 0.5 });
  }, [active]);

  return null;
}

export function CallRoom({ session, onLeave, onUnanswered, isInitiator = false }) {
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: true }), [session.callId]);
  const [renderVersion, setRenderVersion] = useState(0);
  const [connectionState, setConnectionState] = useState("connecting");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(session.call.kind === "VIDEO");
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasRemoteJoined, setHasRemoteJoined] = useState(false);

  const refresh = useCallback(() => setRenderVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
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
    events.forEach((event) => room.on(event, refresh));
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);

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
      room.disconnect();
    };
  }, [room, session, refresh]);

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
      refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo cambiar la camara.");
    }
  }

  async function toggleScreen() {
    try {
      const next = !screenEnabled;
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenEnabled(next);
      refresh();
    } catch (error) {
      toast.error(error?.message || "No se pudo compartir la pantalla.");
    }
  }

  function handleLeave() {
    playCallSound("exit");
    onLeave();
  }

  const remoteParticipants = Array.from(room.remoteParticipants.values());
  const participants = [
    { participant: room.localParticipant, isLocal: true },
    ...remoteParticipants.map((participant) => ({ participant, isLocal: false })),
  ];
  void renderVersion;

  return (
    <div className="fixed inset-0 z-[10020] flex flex-col bg-slate-950 text-white">
      <OutgoingCallTone
        active={isInitiator && !hasRemoteJoined && !["failed", "disconnected"].includes(connectionState)}
      />
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {session.call.calendarEvent?.title || session.call.initiator?.displayName || "Atlas Calls"}
          </p>
          <p className="text-xs text-white/60">
            {connectionState === "connected" && isInitiator && !hasRemoteJoined ? "Llamando..." :
              connectionState === "connected" ? formatDuration(elapsed) :
              connectionState === "reconnecting" ? "Reconectando..." :
                connectionState === "failed" ? "No se pudo conectar" : "Conectando..."}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          {session.call.kind === "VIDEO" ? "Videollamada" : "Llamada de voz"}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className={`mx-auto grid h-full max-w-6xl gap-3 ${participants.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
          {participants.map(({ participant, isLocal }) => (
            <ParticipantTile
              key={participant.sid || participant.identity || "local-participant"}
              participant={participant}
              isLocal={isLocal}
            />
          ))}
        </div>
        {remoteParticipants.map((participant) => (
          <RemoteAudio key={`audio-${participant.identity}`} participant={participant} />
        ))}
      </main>

      <footer className="safe-bottom flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/30 px-4 py-4 backdrop-blur-xl">
        {needsAudio && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => room.startAudio().then(() => setNeedsAudio(false))}
          >
            <Volume2 className="mr-2 h-4 w-4" />
            Activar audio
          </Button>
        )}
        <Button type="button" variant={micEnabled ? "secondary" : "destructive"} size="icon" onClick={toggleMicrophone} title={micEnabled ? "Silenciar" : "Activar microfono"}>
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        {session.call.kind === "VIDEO" && (
          <>
            <Button type="button" variant={cameraEnabled ? "secondary" : "destructive"} size="icon" onClick={toggleCamera} title={cameraEnabled ? "Apagar camara" : "Encender camara"}>
              {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </Button>
            <Button type="button" variant={screenEnabled ? "default" : "secondary"} size="icon" onClick={toggleScreen} title={screenEnabled ? "Dejar de compartir" : "Compartir pantalla"}>
              <MonitorUp className="h-5 w-5" />
            </Button>
          </>
        )}
        <Button type="button" variant="destructive" className="rounded-full px-6" onClick={handleLeave}>
          <PhoneOff className="mr-2 h-5 w-5" />
          Colgar
        </Button>
      </footer>
    </div>
  );
}
