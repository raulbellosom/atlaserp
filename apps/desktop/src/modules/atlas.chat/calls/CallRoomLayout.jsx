import { useEffect, useRef } from "react";
import { Button } from "@atlas/ui";
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  LayoutGrid,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  PictureInPicture2,
  ScreenShareOff,
  SwitchCamera,
  Volume2,
} from "lucide-react";
import { Track } from "livekit-client";
import { playCallSound } from "./callSounds";

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
    // react-doctor-disable-next-line media-has-caption -- LiveKit attaches a video-only WebRTC track; remote audio is rendered separately.
    <video
      ref={elementRef}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function ParticipantTile({ participant, isLocal, mirrorLocalCamera = true, className = "" }) {
  const screen = participant?.getTrackPublication?.(Track.Source.ScreenShare);
  const camera = participant?.getTrackPublication?.(Track.Source.Camera);
  const hasVideo = Boolean(
    (screen?.track && !screen.isMuted) || (camera?.track && !camera.isMuted),
  );
  const source = screen?.track && !screen.isMuted ? Track.Source.ScreenShare : Track.Source.Camera;
  const name = participant?.name || (isLocal ? "Tu" : participant?.identity) || "Participante";

  return (
    <div className={`relative h-full min-h-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10 ${className}`}>
      {hasVideo ? (
        <TrackRenderer
          participant={participant}
          source={source}
          muted={isLocal}
          mirror={isLocal && source === Track.Source.Camera && mirrorLocalCamera}
        />
      ) : (
        <div className="flex h-full min-h-0 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
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

  // react-doctor-disable-next-line media-has-caption no-autoplay-without-muted -- This is live call audio after explicit acceptance; muting it would break the call.
  return <audio ref={audioRef} autoPlay />;
}

function OutgoingCallTone({ active }) {
  useEffect(() => {
    if (!active) return undefined;
    return playCallSound("ringtone", { loop: true, volume: 0.5 });
  }, [active]);

  return null;
}

export function CallRoomLayout({ view, actions }) {
  const {
    session,
    connectionState,
    elapsed,
    outgoingToneActive,
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
  } = view;

  return (
    <div className="fixed inset-0 z-[10020] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-950 text-white">
      <OutgoingCallTone active={outgoingToneActive} />
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-3"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
          paddingLeft: "calc(1rem + env(safe-area-inset-left, 0px))",
          paddingRight: "calc(1rem + env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {session.call.calendarEvent?.title || session.call.initiator?.displayName || "Atlas Calls"}
          </p>
          <p className="text-xs text-white/60">
            {connectionState === "connected" && outgoingToneActive ? "Llamando..." :
              connectionState === "connected" ? formatDuration(elapsed) :
                connectionState === "reconnecting" ? "Reconectando..." :
                  connectionState === "failed" ? "No se pudo conectar" : "Conectando..."}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          {session.call.kind === "VIDEO" ? "Videollamada" : "Llamada de voz"}
        </span>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        {useFocusLayout ? (
          <div className="relative mx-auto h-full max-w-6xl">
            <ParticipantTile participant={remoteEntries[0].participant} isLocal={false} className="rounded-[1.5rem]" />
            <div className="absolute bottom-3 right-3 z-10 aspect-[3/4] w-[34%] max-w-56 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20 sm:aspect-video sm:w-[28%]">
              <ParticipantTile participant={localEntry.participant} isLocal mirrorLocalCamera={mirrorLocalCamera} className="rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className={`mx-auto grid h-full max-w-6xl gap-2 sm:gap-3 ${gridClass}`}>
            {participants.map(({ participant, isLocal }) => (
              <ParticipantTile
                key={participant.sid || participant.identity || "local-participant"}
                participant={participant}
                isLocal={isLocal}
                mirrorLocalCamera={mirrorLocalCamera}
              />
            ))}
          </div>
        )}
        {remoteParticipants.map((participant) => (
          <RemoteAudio key={`audio-${participant.identity}`} participant={participant} />
        ))}
      </main>

      <footer
        className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-white/10 bg-black/30 pt-3 backdrop-blur-xl"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "calc(0.75rem + env(safe-area-inset-left, 0px))",
          paddingRight: "calc(0.75rem + env(safe-area-inset-right, 0px))",
        }}
      >
        {needsAudio && (
          <Button type="button" variant="secondary" size="sm" className="basis-full sm:basis-auto" onClick={actions.activateAudio}>
            <Volume2 className="mr-2 h-4 w-4" />
            Activar audio
          </Button>
        )}
        <Button type="button" variant={micEnabled ? "secondary" : "destructive"} size="icon" className="h-11 w-11 rounded-full" onClick={actions.toggleMicrophone} title={micEnabled ? "Silenciar" : "Activar microfono"}>
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        {session.call.kind === "VIDEO" && (
          <>
            <Button type="button" variant={cameraEnabled ? "secondary" : "destructive"} size="icon" className="h-11 w-11 rounded-full" onClick={actions.toggleCamera} title={cameraEnabled ? "Apagar camara" : "Encender camara"}>
              {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </Button>
            {cameraEnabled && canSwitchCamera && (
              <Button type="button" variant="secondary" size="icon" className="h-11 w-11 rounded-full" onClick={actions.switchCamera} title="Cambiar camara">
                <SwitchCamera className="h-5 w-5" />
              </Button>
            )}
            {cameraEnabled && torchSupported && (
              <Button type="button" variant={torchEnabled ? "default" : "secondary"} size="icon" className="h-11 w-11 rounded-full" onClick={actions.toggleTorch} title={torchEnabled ? "Apagar linterna" : "Encender linterna"}>
                {torchEnabled ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
              </Button>
            )}
            <Button type="button" variant={screenEnabled ? "default" : "secondary"} size="icon" className={`h-11 w-11 rounded-full ${screenShareSupported ? "" : "opacity-50"}`} onClick={actions.toggleScreen} aria-disabled={!screenShareSupported} title={screenShareSupported ? (screenEnabled ? "Dejar de compartir" : "Compartir pantalla") : "Compartir pantalla no disponible en este navegador"}>
              {screenShareSupported ? <MonitorUp className="h-5 w-5" /> : <ScreenShareOff className="h-5 w-5" />}
            </Button>
            {isDirectVideo && (
              <Button type="button" variant="secondary" size="icon" className="h-11 w-11 rounded-full" onClick={actions.toggleLayout} title={layoutMode === "focus" ? "Usar vista 50/50" : "Destacar al otro participante"}>
                {layoutMode === "focus" ? <LayoutGrid className="h-5 w-5" /> : <PictureInPicture2 className="h-5 w-5" />}
              </Button>
            )}
          </>
        )}
        <Button type="button" variant="destructive" size="icon" className="h-11 w-11 rounded-full sm:w-auto sm:px-6" onClick={actions.leave} title="Colgar">
          <PhoneOff className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Colgar</span>
        </Button>
      </footer>
    </div>
  );
}
