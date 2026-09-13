import { useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, Skeleton } from "@atlas/ui";
import { Loader2, AlertCircle, Play, Video } from "lucide-react";
import { useConversationRecordings } from "../hooks/useConversationRecordings";
import { formatMessageTime } from "../lib/chatUtils";

// Attaches `src` (a signed HLS .m3u8 URL) to the given video ref: native
// playback on Safari (which supports HLS natively), the hls.js polyfill
// (lazy-loaded so it never enters the main bundle) everywhere else.
// A real useEffect is required here (not useState's lazy initializer,
// which only ever runs once at mount) because `src` only becomes non-null
// after the row is expanded post-mount — the effect must re-run then.
function useHls(videoRef, src) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!src || !videoRef.current) return undefined;
    const video = videoRef.current;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      setReady(true);
      return undefined;
    }

    let hls;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      setReady(true);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src, videoRef]);

  return ready;
}

function RecordingRow({ recording }) {
  const [expanded, setExpanded] = useState(false);
  const videoRef = useRef(null);
  useHls(videoRef, expanded ? recording.playlistUrl : null);

  const isReady = recording.status === "READY";
  const isFailed = recording.status === "FAILED";

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatMessageTime(recording.startedAt)}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {isReady && recording.durationMs != null
              ? `${Math.round(recording.durationMs / 1000)}s`
              : isFailed ? "No se pudo procesar" : "Procesando..."}
          </p>
        </div>
        {isReady && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
            aria-label="Reproducir"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        {isFailed && <AlertCircle className="h-5 w-5 shrink-0 text-red-500" aria-label="No se pudo procesar" />}
        {!isReady && !isFailed && (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" aria-label="Procesando" />
        )}
      </div>
      {expanded && isReady && (
        // react-doctor-disable-next-line media-has-caption -- internal call recording, no captions track produced by Egress.
        <video ref={videoRef} controls className="mt-2 w-full rounded-lg bg-black" />
      )}
    </div>
  );
}

export function ChatRecordingsGallery({ conversationId }) {
  const { data, isLoading, isError, refetch } = useConversationRecordings(conversationId);
  const recordings = data?.data ?? data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 min-h-0 p-3">
        <ErrorState title="No se pudieron cargar las grabaciones" onRetry={refetch} />
      </div>
    );
  }

  if (!recordings.length) {
    return (
      <EmptyState
        className="flex-1 min-h-0"
        icon={Video}
        title="Aún no hay grabaciones"
        description="Las grabaciones de las llamadas de esta conversación aparecerán aquí."
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-3">
      {recordings.map((r) => <RecordingRow key={r.id} recording={r} />)}
    </div>
  );
}
