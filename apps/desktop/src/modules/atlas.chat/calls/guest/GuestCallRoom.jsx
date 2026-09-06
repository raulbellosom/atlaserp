import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "@atlas/ui";
import { Mic, MicOff, Camera, CameraOff, MonitorUp, PhoneOff, MessageSquare } from "lucide-react";
import { GuestRoomChat } from "./GuestRoomChat";

function Tile({ participant, mirror }) {
  const ref = useRef(null);
  const camPub = participant?.getTrackPublication?.(Track.Source.Camera);
  const screenPub = participant?.getTrackPublication?.(Track.Source.ScreenShare);
  const pub = (screenPub?.track && !screenPub.isMuted) ? screenPub : camPub;
  const track = pub?.track && !pub.isMuted ? pub.track : null;
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => track.detach(el);
  }, [track]);
  const name = participant?.name || participant?.identity || "Participante";
  return (
    <div className="relative min-h-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
      {track ? (
        // react-doctor-disable-next-line media-has-caption -- live WebRTC video track; remote audio rendered separately.
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={participant?.isLocal}
          className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-2xl font-semibold text-violet-100">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{name}</span>
    </div>
  );
}

function RemoteAudio({ participant }) {
  const ref = useRef(null);
  const pub = participant?.getTrackPublication?.(Track.Source.Microphone);
  const track = pub?.track;
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return undefined;
    track.attach(el);
    return () => track.detach(el);
  }, [track]);
  // react-doctor-disable-next-line media-has-caption no-autoplay-without-muted -- live call audio after the guest joined.
  return <audio ref={ref} autoPlay />;
}

export function GuestCallRoom({ fetchLivekitToken, messages, onSendMessage, onLeave, myName }) {
  const room = useMemo(() => new Room({ adaptiveStream: true, dynacast: true }), []);
  const [, force] = useState(0);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [screen, setScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [live, setLive] = useState([]);
  const refresh = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const onData = (payload, participant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type !== "chat") return;
        setLive((p) => [...p.slice(-199), {
          body: msg.body,
          senderName: msg.senderName,
          senderKind: participant?.identity?.startsWith?.("guest_") ? "guest" : "user",
          createdAt: msg.createdAt ?? new Date().toISOString(),
        }]);
      } catch { /* ignore */ }
    };
    [
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
    ].forEach((e) => room.on(e, refresh));
    room.on(RoomEvent.DataReceived, onData);

    (async () => {
      try {
        const { livekitUrl, token } = await fetchLivekitToken();
        if (cancelled) return;
        await room.connect(livekitUrl, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.startAudio().catch(() => {});
        refresh();
      } catch { /* surfaced by the parent poll (KICKED / not live) */ }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.DataReceived, onData);
      room.disconnect();
    };
  }, [room, fetchLivekitToken, refresh]);

  const remote = Array.from(room.remoteParticipants.values());
  const tiles = [room.localParticipant, ...remote];

  const publishChat = useCallback((body) => {
    const echo = { type: "chat", body, senderName: myName, senderKind: "guest", createdAt: new Date().toISOString() };
    try {
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(echo)), { reliable: true });
    } catch { /* not connected */ }
    onSendMessage(body);
  }, [room, myName, onSendMessage]);

  async function toggleMic() {
    try { const n = !mic; await room.localParticipant.setMicrophoneEnabled(n); setMic(n); } catch { /* noop */ }
  }
  async function toggleCam() {
    try { const n = !cam; await room.localParticipant.setCameraEnabled(n); setCam(n); refresh(); } catch { /* noop */ }
  }
  async function toggleScreen() {
    try { const n = !screen; await room.localParticipant.setScreenShareEnabled(n); setScreen(n); refresh(); } catch { /* noop */ }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white">
      <main className="relative min-h-0 flex-1 p-2 sm:p-4">
        {showChat ? (
          <GuestRoomChat polled={messages} liveIncoming={live} onSend={publishChat} myName={myName} />
        ) : (
          <div className={`mx-auto grid h-full max-w-5xl gap-2 ${tiles.length <= 1 ? "grid-cols-1" : tiles.length === 2 ? "sm:grid-cols-2" : "grid-cols-2"}`}>
            {tiles.map((p, i) => <Tile key={p?.sid || p?.identity || i} participant={p} mirror={p?.isLocal && cam} />)}
          </div>
        )}
        {remote.map((p) => <RemoteAudio key={`a-${p.identity}`} participant={p} />)}
      </main>
      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-black/30 p-3">
        <Button variant={mic ? "secondary" : "destructive"} size="icon" className="h-11 w-11 rounded-full" onClick={toggleMic}>
          {mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button variant={cam ? "secondary" : "destructive"} size="icon" className="h-11 w-11 rounded-full" onClick={toggleCam}>
          {cam ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
        </Button>
        <Button variant={screen ? "default" : "secondary"} size="icon" className="h-11 w-11 rounded-full" onClick={toggleScreen}>
          <MonitorUp className="h-5 w-5" />
        </Button>
        <Button variant={showChat ? "default" : "secondary"} size="icon" className="h-11 w-11 rounded-full" onClick={() => setShowChat((v) => !v)}>
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button variant="destructive" size="icon" className="h-11 w-11 rounded-full sm:w-auto sm:px-6" onClick={onLeave}>
          <PhoneOff className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Salir</span>
        </Button>
      </footer>
    </div>
  );
}
