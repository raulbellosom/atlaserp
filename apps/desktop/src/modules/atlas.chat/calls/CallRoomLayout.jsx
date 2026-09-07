import { useEffect, useRef } from "react";
import { Button } from "@atlas/ui";
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PhoneOff,
  PictureInPicture2,
  ScreenShareOff,
  SwitchCamera,
  UserPlus,
  Volume2,
} from "lucide-react";
import { Track } from "livekit-client";
import { playCallSound } from "./callSounds";
import { DraggablePip } from "./DraggablePip";
import { CallViewSwitcher } from "./CallViewSwitcher";

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function TrackRenderer({ participant, source, muted = false, mirror = false, fit = "cover" }) {
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
      className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function ParticipantTile({
  participant,
  isLocal,
  mirrorLocalCamera = true,
  className = "",
  preferSource = "auto",
  // "auto" = contain for screen-share, cover for camera. Pass "contain" to
  // letterbox a camera feed too (used in the focus layout so a portrait phone
  // camera in a landscape tile isn't cropped).
  fit = "auto",
}) {
  const screen = participant?.getTrackPublication?.(Track.Source.ScreenShare);
  const camera = participant?.getTrackPublication?.(Track.Source.Camera);
  const screenLive = Boolean(screen?.track && !screen.isMuted);
  const cameraLive = Boolean(camera?.track && !camera.isMuted);
  const source =
    preferSource === "screen"
      ? Track.Source.ScreenShare
      : preferSource === "camera"
        ? Track.Source.Camera
        : screenLive
          ? Track.Source.ScreenShare
          : Track.Source.Camera;
  const hasVideo =
    source === Track.Source.ScreenShare ? screenLive : cameraLive || (preferSource === "auto" && screenLive);
  const isScreen = source === Track.Source.ScreenShare;
  const name = participant?.name || (isLocal ? "Tu" : participant?.identity) || "Participante";

  return (
    <div className={`relative h-full min-h-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10 ${className}`}>
      {hasVideo ? (
        <TrackRenderer
          participant={participant}
          source={source}
          muted={isLocal}
          fit={fit === "contain" || isScreen ? "contain" : "cover"}
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

export function CallRoomLayout({ view, actions, chat }) {
  const {
    session,
    connectionState,
    engineReady = true,
    elapsed,
    outgoingToneActive,
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
    invitePanel = null,
  } = view;

  const {
    isMobile = false,
    mobileView = "video",
    onMobileViewChange = () => {},
    chatExpanded = true,
    onToggleChatExpanded = () => {},
    chatUnread = 0,
    hasScreenShare = false,
    panel: chatPanel = null,
    canShare = false,
    onShare = () => {},
    hasGuests = false,
    pendingLobby = 0,
    roster = null,
  } = chat ?? {};

  const showRoster = canShare && (hasGuests || pendingLobby > 0);

  const showChatColumn = !isMobile && chatExpanded;
  const showChatRail = !isMobile && !chatExpanded;
  const mobileChatOpen = isMobile && mobileView === "chat";

  // While a screen share is live it becomes the full-viewport main view and
  // every camera feed (local + remote) floats over it as a draggable,
  // collapsible bubble.
  const cameraPips = screenShareEntry
    ? participants.filter(({ participant }) => {
        const cam = participant?.getTrackPublication?.(Track.Source.Camera);
        return Boolean(cam?.track && !cam.isMuted);
      })
    : [];

  return (
    <div className="fixed inset-0 z-[46] flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <OutgoingCallTone active={outgoingToneActive} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
        <div className="flex shrink-0 items-center gap-2">
          {actions.minimize && (
            <button
              type="button"
              onClick={actions.minimize}
              title="Minimizar llamada"
              aria-label="Minimizar llamada"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}
          {canShare && (
            <button
              type="button"
              onClick={onShare}
              className="relative flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 hover:text-white"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invitar
              {pendingLobby > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold ring-2 ring-slate-950">
                  {pendingLobby > 9 ? "9+" : pendingLobby}
                </span>
              )}
            </button>
          )}
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            {isVideoActive ? "Videollamada" : "Llamada de voz"}
          </span>
        </div>
      </header>

      {isMobile && (
        <CallViewSwitcher
          view={mobileView}
          onChange={onMobileViewChange}
          hasScreenShare={hasScreenShare}
          chatUnread={chatUnread}
        />
      )}

      <main className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        {mobileChatOpen ? (
          <div className="absolute inset-0 flex flex-col bg-[hsl(var(--background))]">
            {hasScreenShare && (
              <button
                type="button"
                onClick={() => onMobileViewChange("screen")}
                className="flex items-center gap-2 bg-violet-600 px-4 py-2 text-left text-xs font-medium text-white"
              >
                <MonitorUp className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">
                  {(screenShareEntry?.participant?.name) || "Alguien"} esta compartiendo pantalla
                </span>
                <span className="underline">Ver</span>
              </button>
            )}
            <div className="min-h-0 flex-1">{chatPanel}</div>
          </div>
        ) : (
          <>
        {(!isMobile || mobileView === "screen") && screenShareEntry ? (
          <div className="relative mx-auto h-full max-w-6xl">
            <ParticipantTile
              participant={screenShareEntry.participant}
              isLocal={screenShareEntry.isLocal}
              preferSource="screen"
              className="rounded-[1.5rem] bg-black"
            />
            {cameraPips.map(({ participant, isLocal }, index) => (
              <DraggablePip
                key={`pip-${participant.sid || participant.identity || "local"}`}
                label={participant?.name || (isLocal ? "Tú" : participant?.identity) || "Participante"}
                initial={(participant?.name || (isLocal ? "T" : participant?.identity) || "?").slice(0, 1).toUpperCase()}
                anchorOffset={index * 12}
              >
                <ParticipantTile
                  participant={participant}
                  isLocal={isLocal}
                  preferSource="camera"
                  mirrorLocalCamera={mirrorLocalCamera}
                  className="rounded-2xl"
                />
              </DraggablePip>
            ))}
          </div>
        ) : useFocusLayout ? (
          <div className="relative mx-auto h-full max-w-6xl">
            <ParticipantTile participant={remoteEntries[0].participant} isLocal={false} className="rounded-[1.5rem]" fit="contain" />
            <DraggablePip
              label={localEntry.participant?.name || "Tú"}
              initial={(localEntry.participant?.name || "T").slice(0, 1).toUpperCase()}
            >
              <ParticipantTile participant={localEntry.participant} isLocal mirrorLocalCamera={mirrorLocalCamera} className="rounded-2xl" />
            </DraggablePip>
          </div>
        ) : (
          <div className={`mx-auto grid h-full max-w-6xl gap-2 sm:gap-3 ${gridClass}`}>
            {participants.map(({ participant, isLocal }) => (
              <ParticipantTile
                key={participant.sid || participant.identity || "local-participant"}
                participant={participant}
                isLocal={isLocal}
                mirrorLocalCamera={mirrorLocalCamera}
                fit={participants.length <= 2 ? "contain" : "auto"}
              />
            ))}
          </div>
        )}
          </>
        )}
        {remoteParticipants.map((participant) => (
          <RemoteAudio key={`audio-${participant.identity}`} participant={participant} />
        ))}

        {invitePanel && !mobileChatOpen && !screenShareEntry && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-4 sm:items-center">
            <div className="pointer-events-auto w-full max-w-sm">{invitePanel}</div>
          </div>
        )}
      </main>

      {showRoster && (
        <div className="max-h-48 shrink-0 overflow-y-auto border-t border-white/10 bg-black/20">
          {roster}
        </div>
      )}

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
        <Button type="button" variant={micEnabled ? "secondary" : "destructive"} size="icon" disabled={!engineReady} className="h-11 w-11 rounded-full disabled:opacity-40" onClick={actions.toggleMicrophone} title={!engineReady ? "Conectando..." : micEnabled ? "Silenciar" : "Activar microfono"}>
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        {/* Camera + screen-share are always available — a call created as voice
            can be upgraded to video mid-call (no kind gate). */}
        <Button type="button" variant={cameraEnabled ? "secondary" : "destructive"} size="icon" disabled={!engineReady} className="h-11 w-11 rounded-full disabled:opacity-40" onClick={actions.toggleCamera} title={!engineReady ? "Conectando..." : cameraEnabled ? "Apagar camara" : "Encender camara"}>
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
        <Button type="button" variant={screenEnabled ? "default" : "secondary"} size="icon" disabled={!engineReady} className={`h-11 w-11 rounded-full disabled:opacity-40 ${screenShareSupported ? "" : "opacity-50"}`} onClick={actions.toggleScreen} aria-disabled={!screenShareSupported} title={!engineReady ? "Conectando..." : screenShareSupported ? (screenEnabled ? "Dejar de compartir" : "Compartir pantalla") : "Compartir pantalla no disponible en este navegador"}>
          {screenShareSupported ? <MonitorUp className="h-5 w-5" /> : <ScreenShareOff className="h-5 w-5" />}
        </Button>
        {isDirectVideo && (
          <Button type="button" variant="secondary" size="icon" className="h-11 w-11 rounded-full" onClick={actions.toggleLayout} title={layoutMode === "focus" ? "Usar vista 50/50" : "Destacar al otro participante"}>
            {layoutMode === "focus" ? <LayoutGrid className="h-5 w-5" /> : <PictureInPicture2 className="h-5 w-5" />}
          </Button>
        )}
        <Button type="button" variant="destructive" size="icon" className="h-11 w-11 rounded-full sm:w-auto sm:px-6" onClick={actions.leave} title="Colgar">
          <PhoneOff className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Colgar</span>
        </Button>
      </footer>
      </div>

      {showChatColumn && (
        <aside className="hidden w-[380px] shrink-0 border-l border-white/10 bg-[hsl(var(--background))] lg:block">
          {chatPanel}
        </aside>
      )}

      {showChatRail && (
        <aside className="hidden w-12 shrink-0 flex-col items-center border-l border-white/10 bg-slate-950 pt-3 lg:flex">
          <button
            type="button"
            onClick={() => onToggleChatExpanded(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white"
            title="Mostrar chat"
          >
            <MessageSquare className="h-5 w-5" />
            {chatUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </button>
        </aside>
      )}
    </div>
  );
}
