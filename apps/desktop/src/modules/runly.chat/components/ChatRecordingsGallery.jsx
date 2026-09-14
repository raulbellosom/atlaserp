import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, ErrorState, Skeleton } from "@runly/ui";
import { Loader2, AlertCircle, Play, Video } from "lucide-react";
import { useConversationRecordings } from "../hooks/useConversationRecordings";
import { formatMessageTime } from "../lib/chatUtils";

// Attaches `src` (a signed HLS .m3u8 URL) to the given video ref: native
// playback on Safari (which supports HLS natively), the hls.js polyfill
// (lazy-loaded so it never enters the main bundle) everywhere else.
// A real useEffect is required here (not useState's lazy initializer,
// which only ever runs once at mount) because `src` only becomes non-null
// after the row is expanded post-mount — the effect must re-run then.
// `onFatalError` is invoked for hls.js fatal errors (network/media errors
// that hls.js itself can't recover from) — the native-Safari path relies on
// the `<video>` element's own `onError` prop instead (wired by the caller),
// since hls.js's event bus doesn't apply there.
function useHls(videoRef, src, onFatalError) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!src || !videoRef.current) return undefined;
    const video = videoRef.current;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      setReady(true);
      return () => {
        // Symmetric with the hls.js branch's hls.destroy() below — stops
        // playback and releases the media resource on cleanup instead of
        // relying solely on the <video> node being unmounted.
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    let hls;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        onFatalError?.();
        return;
      }
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) onFatalError?.();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      setReady(true);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src, videoRef, onFatalError]);

  return ready;
}

function RecordingRow({ recording, refetch }) {
  const [expanded, setExpanded] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const videoRef = useRef(null);
  // Same one-retry-then-give-up convention as MessageAttachments.jsx's
  // AudioCard: on the first playback error, refetch the recordings list
  // (the signed playlistUrl has a 1-hour TTL, so a panel left open past
  // that gets a fresh URL) and let the effect above reattach with it; if
  // it still fails, stop retrying and show an inline error instead of
  // silently leaving a broken/blank player.
  const retriedRef = useRef(false);

  const handleFatalError = useCallback(() => {
    if (!retriedRef.current) {
      retriedRef.current = true;
      refetch?.();
      return;
    }
    setPlaybackError(true);
  }, [refetch]);

  const hasPlaylist = Boolean(recording.playlistUrl);
  useHls(videoRef, expanded && hasPlaylist ? recording.playlistUrl : null, handleFatalError);

  function toggleExpanded() {
    setExpanded((wasExpanded) => {
      const next = !wasExpanded;
      if (next) {
        // Fresh attempt each time the row is (re-)opened.
        retriedRef.current = false;
        setPlaybackError(false);
      }
      return next;
    });
  }

  const isReady = recording.status === "READY";
  const isFailed = recording.status === "FAILED";
  // The backend only fills playlistUrl when signed-URL generation succeeds
  // (call-recording-service.js listRecordings) — a READY recording can still
  // have no playlistUrl if that signing call failed.
  const isUnavailable = isReady && !hasPlaylist;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatMessageTime(recording.startedAt)}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {isReady && recording.durationMs != null
              ? `${Math.round(recording.durationMs / 1000)}s`
              : isFailed ? "No se pudo procesar" : isUnavailable ? "No disponible" : "Procesando..."}
          </p>
        </div>
        {isReady && hasPlaylist && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
            aria-label="Reproducir"
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        {isFailed && <AlertCircle className="h-5 w-5 shrink-0 text-red-500" aria-label="No se pudo procesar" />}
        {isUnavailable && <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" aria-label="No disponible" />}
        {!isReady && !isFailed && (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" aria-label="Procesando" />
        )}
      </div>
      {expanded && isReady && hasPlaylist && (
        playbackError ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            No se pudo reproducir la grabación.
          </div>
        ) : (
          // react-doctor-disable-next-line media-has-caption -- internal call recording, no captions track produced by Egress.
          <video ref={videoRef} controls onError={handleFatalError} className="mt-2 w-full rounded-lg bg-black" />
        )
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
      {recordings.map((r) => <RecordingRow key={r.id} recording={r} refetch={refetch} />)}
    </div>
  );
}
