import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Download, Play, Pause, Mic, AlertCircle,
  FileText, FileType2, FileSpreadsheet, FileImage, FileVideo, FileAudio,
  FileArchive, FileCode, File, Trash2, Smile,
} from "lucide-react";
import { ConfirmDialog } from "@atlas/ui";
import { formatFileSize, isImageMime } from "../lib/chatUtils";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";
import { MessageReactionPicker } from "./MessageReactionPicker";
import { isSignedUrlUsable } from "../lib/signedUrl";

function isVideoMime(m) { return String(m ?? "").startsWith("video/"); }
function isAudioMime(m) { return String(m ?? "").startsWith("audio/"); }

// In-app voice notes are always named "nota_de_voz_*". Some mobile browsers
// (and the odd proxy) hand back a Blob whose type is empty or gets remapped
// to video/webm on upload, so an audio attachment must be recognised by
// name/extension too — trusting mime alone made the voice note render as a
// black video tile (or nothing at all) on those devices.
const AUDIO_EXT_RE = /\.(m4a|mp3|mpeg|ogg|oga|opus|wav|aac|weba)$/i;
function isVoiceNoteName(name) { return /^nota_de_voz/i.test(String(name ?? "")); }
function isAudioAttachment(att) {
  if (isAudioMime(att.mimeType)) return true;
  if (isVoiceNoteName(att.fileName)) return true;
  return AUDIO_EXT_RE.test(String(att.fileName ?? "")) && !isVideoMime(att.mimeType);
}

function getFileTypeInfo(mimeType = "") {
  const m = String(mimeType).toLowerCase();
  if (m === "application/pdf") return { Icon: FileType2, colorClass: "text-red-400" };
  if (m.includes("spreadsheet") || m.includes("excel") || m === "text/csv")
    return { Icon: FileSpreadsheet, colorClass: "text-green-400" };
  if (m.includes("word") || m.includes("document"))
    return { Icon: FileText, colorClass: "text-blue-400" };
  if (m.startsWith("image/")) return { Icon: FileImage, colorClass: "text-violet-400" };
  if (m.startsWith("video/")) return { Icon: FileVideo, colorClass: "text-orange-400" };
  if (m.startsWith("audio/")) return { Icon: FileAudio, colorClass: "text-emerald-400" };
  if (m.includes("zip") || m.includes("rar") || m.includes("tar") || m.includes("7z"))
    return { Icon: FileArchive, colorClass: "text-yellow-400" };
  if (m.startsWith("text/") || m.includes("json") || m.includes("xml"))
    return { Icon: FileCode, colorClass: "text-cyan-400" };
  return { Icon: File, colorClass: "text-[hsl(var(--muted-foreground))]" };
}

// Hook: resolve the signed URL for an attachment.
// The API now embeds `url` directly in the attachment object from listMessages,
// so we skip the network call entirely when it's already present.
function useAttachmentUrl(att) {
  const { session } = useAuth();
  const embeddedUrl = isSignedUrlUsable(att.url) ? att.url : null;
  return useQuery({
    queryKey: ["chat-attachment-url", att.id],
    queryFn: async () => {
      if (isSignedUrlUsable(att.url)) return att.url;
      try {
        const res = await atlas.chat.getAttachmentSignedUrl(att.id, session?.access_token);
        return res?.data?.url ?? null;
      } catch (err) {
        console.warn("[chat] getAttachmentSignedUrl failed", { id: att.id, status: err?.status, msg: err?.message });
        throw err;
      }
    },
    // Seed the cache with the embedded URL so it resolves synchronously
    initialData: embeddedUrl ?? undefined,
    // The API may reuse a signed URL for up to 55 minutes. Keeping this query
    // stale for only five minutes ensures a restored offline cache never marks
    // an already-expired Storage URL as fresh for another hour.
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: Boolean(session?.access_token),
  });
}

// ── Per-tile action icons (react + delete) ─────────────────────────────────
// Shared by every grid cell type (ImageCard, ImageCoverCell, VideoCard) so
// the hover affordance, the reaction picker anchor, and the delete confirm
// flow are defined exactly once. `messageId` + `att.id` together identify
// which reaction/deletion this targets — never the whole message.
function AttachmentTileActions({ att, messageId, isOwn, onToggleReaction, onDeleteAttachment, deleting }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!onToggleReaction && !(isOwn && onDeleteAttachment)) return null;

  return (
    <>
      {/* stopPropagation on the wrapper (not each button) so a click on
          either icon never also fires the tile's own onClick={() => onOpen(...)},
          which would open the full-screen viewer underneath the picker/dialog. */}
      <div
        className="absolute top-1 right-1 flex items-center gap-1 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {onToggleReaction && (
          <MessageReactionPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={(emoji) => onToggleReaction(messageId, emoji, att.id)}
            anchorAlign={isOwn ? "end" : "start"}
          >
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors touch-manipulation"
              aria-label="Reaccionar a este archivo"
              title="Reaccionar"
            >
              <Smile className="h-3.5 w-3.5 text-white" />
            </button>
          </MessageReactionPicker>
        )}
        {isOwn && onDeleteAttachment && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors touch-manipulation"
            aria-label="Eliminar este archivo"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>
      {isOwn && onDeleteAttachment && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Eliminar archivo"
          description="Esta accion no se puede deshacer."
          confirmLabel="Eliminar"
          loading={deleting}
          onConfirm={() => { onDeleteAttachment(att.id); setConfirmOpen(false); }}
        />
      )}
    </>
  );
}

// ── Per-tile reaction pills ──────────────────────────────────────────────────
// Smaller, simpler sibling of MessageReactions.jsx: no "who reacted" modal
// (there isn't room for it inside a ~110px tile) — clicking a pill you
// reacted with removes it directly; clicking one you didn't react with does
// nothing (view-only for other people's reactions on this small surface).
function AttachmentReactionPills({ reactions, currentUserId, onToggleReaction, messageId, attachmentId }) {
  if (!reactions?.length) return null;
  return (
    <div
      className="absolute bottom-1 left-1 flex flex-wrap gap-0.5 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {reactions.map(({ emoji, userIds }) => {
        const mine = currentUserId && userIds?.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => mine && onToggleReaction?.(messageId, emoji, attachmentId)}
            className={[
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] bg-black/60 text-white",
              mine ? "ring-1 ring-white cursor-pointer" : "cursor-default",
            ].join(" ")}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{userIds?.length ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────
function ImageCard({ att, index, allAttachments, onOpen, messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const [failedUrl, setFailedUrl] = useState(null);

  return (
    <div className="relative group block rounded-xl overflow-hidden" style={{ minHeight: 80 }}>
      <button
        type="button"
        onClick={() => onOpen?.(allAttachments, index)}
        className="block w-full rounded-xl overflow-hidden hover:opacity-90 transition-opacity bg-black/10"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20 w-32">
            <Loader2 className="h-5 w-5 animate-spin opacity-40" />
          </div>
        ) : url && failedUrl !== url ? (
          <img
            src={url}
            alt={att.fileName}
            className="block w-full object-cover"
            style={{ maxHeight: 220 }}
            onError={() => {
              console.warn("[chat] image load failed", { url, id: att.id });
              setFailedUrl(url);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-20 w-32 opacity-40">
            <FileText className="h-6 w-6" />
          </div>
        )}
      </button>
      <AttachmentTileActions
        att={att}
        messageId={messageId}
        isOwn={isOwn}
        onToggleReaction={onToggleReaction}
        onDeleteAttachment={onDeleteAttachment}
        deleting={deletingAttachmentId === att.id}
      />
      <AttachmentReactionPills
        reactions={att.reactions}
        currentUserId={currentUserId}
        onToggleReaction={onToggleReaction}
        messageId={messageId}
        attachmentId={att.id}
      />
    </div>
  );
}

// ── Video card ────────────────────────────────────────────────────────────────
function VideoCard({ att, index, allAttachments, onOpen, messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const [videoErr, setVideoErr] = useState(false);

  // Appending #t=0.001 forces the browser to seek 1ms in and paint that frame as a thumbnail
  const videoSrc = url ? `${url}#t=0.001` : null;

  return (
    <div
      className="relative group block rounded-xl overflow-hidden bg-black/25 mt-1.5"
      style={{ width: 220, height: 140, maxWidth: "100%" }}
    >
      <button
        type="button"
        onClick={() => onOpen?.(allAttachments, index)}
        className="absolute inset-0 w-full h-full hover:opacity-90 active:opacity-70 transition-opacity"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/50" />
          </div>
        )}

        {videoSrc && !videoErr ? (
          <video
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            preload="auto"
            onError={() => setVideoErr(true)}
          />
        ) : !isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <FileVideo className="h-10 w-10 text-white/40" />
          </div>
        ) : null}

        {/* Play overlay — always visible */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Filename label at bottom */}
        {att.fileName && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-linear-to-t from-black/60 to-transparent">
            <p className="text-[10px] text-white/80 truncate">{att.fileName}</p>
          </div>
        )}
      </button>
      <AttachmentTileActions
        att={att}
        messageId={messageId}
        isOwn={isOwn}
        onToggleReaction={onToggleReaction}
        onDeleteAttachment={onDeleteAttachment}
        deleting={deletingAttachmentId === att.id}
      />
      <AttachmentReactionPills
        reactions={att.reactions}
        currentUserId={currentUserId}
        onToggleReaction={onToggleReaction}
        messageId={messageId}
        attachmentId={att.id}
      />
    </div>
  );
}

// ── Audio card (voice message player) ────────────────────────────────────────
function fmtAudioTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Seeded LCG so the waveform is deterministic per attachment (same each render)
function seedBars(seed, count) {
  let s = seed;
  return Array.from({ length: count }, () => {
    s = (s * 1664525 + 1013904223) | 0;
    return 24 + (Math.abs(s) % 76); // 24-100% height
  });
}

// Minimal WhatsApp-style voice player: one play/pause control, a seekable
// waveform, and a SINGLE time readout — elapsed while it plays/after a scrub,
// total length when idle. Deliberately no playback-speed pill and no second
// timer (the old card stacked "0:00" + "—:——" + "x1", which read as three
// competing counters).
function AudioCard({ att, isOwn }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const audioRef = useRef(null);
  const durationFoundRef = useRef(false);
  const seekingForDurationRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false); // has playback ever advanced?
  const [loadError, setLoadError] = useState(false);

  const bars = useMemo(() => {
    const seed = Array.from(String(att.id)).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
    return seedBars(seed, 30);
  }, [att.id]);

  // MediaRecorder webm/mp4 blobs frequently report Infinity/NaN duration until
  // the media element has actually been scrubbed. Seek far past the end once
  // to force the browser to resolve the real value, then snap back to 0.
  function probeDuration(audio) {
    if (!audio || durationFoundRef.current) return;
    if (isFinite(audio.duration) && audio.duration > 0) {
      durationFoundRef.current = true;
      setDuration(audio.duration);
      return;
    }
    try {
      seekingForDurationRef.current = true;
      audio.currentTime = 1e101;
    } catch { /* ignore — some browsers throw on an out-of-range seek */ }
  }

  function handleSeeked(e) {
    const audio = e.currentTarget;
    if (durationFoundRef.current) { seekingForDurationRef.current = false; return; }
    if (isFinite(audio.duration) && audio.duration > 0) {
      durationFoundRef.current = true;
      setDuration(audio.duration);
    }
    seekingForDurationRef.current = false;
    audio.currentTime = 0;
    setCurrentTime(0);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }

  function handleSeek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.changedTouches?.[0]?.clientX ?? e.touches?.[0]?.clientX ?? e.clientX;
    if (!isFinite(clientX)) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
    setStarted(true);
  }

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const timeLabel = fmtAudioTime(started ? currentTime : (duration || 0));

  const playBg    = isOwn ? "rgba(255,255,255,0.22)" : "var(--brand-primary)";
  const playColor = isOwn ? "white"                  : "var(--brand-primary-foreground)";
  const barPlayed = isOwn ? "rgba(255,255,255,0.95)" : "var(--brand-primary)";
  const barRest   = isOwn ? "rgba(255,255,255,0.30)" : "hsl(var(--border))";
  const metaColor = isOwn ? "rgba(255,255,255,0.70)" : "hsl(var(--muted-foreground))";

  // No signed URL could be resolved at all (getAttachmentSignedUrl itself
  // failed, e.g. auth/network) — there's nothing to mount an <audio> against.
  if (!isLoading && !url) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs opacity-50" style={{ width: 240 }}>
        <FileAudio className="h-4 w-4 shrink-0" />
        <span className="truncate">{att.fileName}</span>
      </div>
    );
  }

  // The signed URL DID resolve but the browser couldn't decode/play it (bad
  // codec, or the underlying Storage object is empty/corrupt). Keep the same
  // player chrome visible — this is the "el reproductor desaparece" complaint
  // — just disabled, with a small "abrir archivo" escape hatch instead of
  // silently swallowing the whole component.
  const playDisabled = isLoading || !url || loadError;

  return (
    <div className="mt-2 flex items-center gap-2.5" style={{ width: 244, maxWidth: "100%" }}>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => probeDuration(e.currentTarget)}
          onCanPlay={(e) => probeDuration(e.currentTarget)}
          onSeeked={handleSeeked}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (isFinite(d) && d > 0 && !durationFoundRef.current) {
              durationFoundRef.current = true;
              setDuration(d);
            }
          }}
          onTimeUpdate={(e) => {
            // Ignore the giant timestamp the duration-probe seek reports.
            if (seekingForDurationRef.current) return;
            const t = e.currentTarget.currentTime;
            if (!isFinite(t)) return;
            setCurrentTime(t);
            if (t > 0) setStarted(true);
          }}
          onPlay={() => { setPlaying(true); probeDuration(audioRef.current); }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setStarted(false);
            setCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          onError={(e) => {
            console.warn("[chat] audio load failed", {
              id: att.id, url, mimeType: att.mimeType,
              code: e.currentTarget?.error?.code, message: e.currentTarget?.error?.message,
            });
            setLoadError(true);
          }}
        />
      )}

      {/* Play / pause */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={playDisabled}
        className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center touch-manipulation active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100"
        style={{ backgroundColor: playBg, color: playColor }}
        aria-label={isLoading ? "Cargando..." : loadError ? "Audio no disponible" : playing ? "Pausar" : "Reproducir"}
      >
        {isLoading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : loadError
          ? <AlertCircle className="h-4 w-4" />
          : playing
          ? <Pause className="h-4.5 w-4.5 fill-current" />
          : <Play  className="h-4.5 w-4.5 fill-current ml-0.5" />}
      </button>

      {/* Waveform + single time readout (or an error line, in place) */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          className="flex items-center gap-px cursor-pointer touch-manipulation select-none"
          style={{ height: 26, opacity: loadError ? 0.35 : 1 }}
          onClick={loadError ? undefined : handleSeek}
          onTouchEnd={loadError ? undefined : handleSeek}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: 2.5,
                height: `${h}%`,
                borderRadius: 2,
                backgroundColor: !loadError && (i + 0.5) / bars.length <= progress ? barPlayed : barRest,
                transition: "background-color 0.08s linear",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {loadError ? (
            <>
              <span className="text-[10px] leading-none" style={{ color: metaColor }}>
                Audio no disponible
              </span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] leading-none underline underline-offset-2 shrink-0"
                style={{ color: metaColor }}
              >
                Abrir archivo
              </a>
            </>
          ) : (
            <>
              <Mic className="h-2.5 w-2.5 shrink-0" style={{ color: metaColor }} />
              <span className="text-[10px] leading-none tabular-nums" style={{ color: metaColor }}>
                {timeLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── File card (generic) ───────────────────────────────────────────────────────
function FileCard({ att, index, allAttachments, onOpen, isOwn }) {
  const { data: url } = useAttachmentUrl(att);
  const { Icon, colorClass } = getFileTypeInfo(att.mimeType);

  function handleDownload(e) {
    e.stopPropagation();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = att.fileName ?? "archivo";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  return (
    <div
      className={[
        "flex items-center gap-2.5 mt-1.5 px-3 py-2 rounded-xl max-w-55",
        isOwn ? "bg-white/15" : "bg-[hsl(var(--border))]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onOpen?.(allAttachments, index)}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
      >
        <Icon className={`h-4 w-4 shrink-0 ${colorClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{att.fileName}</p>
          <p className="text-xs opacity-50">{formatFileSize(att.sizeBytes)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!url}
        title="Descargar"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Cover cell for image grids ────────────────────────────────────────────────
function ImageCoverCell({ att, index, allAttachments, onOpen, overflowCount = 0, messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const [failedUrl, setFailedUrl] = useState(null);

  return (
    <div className="absolute inset-0 w-full h-full group">
      <button
        type="button"
        onClick={() => onOpen?.(allAttachments, index)}
        className="block w-full h-full hover:opacity-90 transition-opacity bg-black/10"
      >
        {isLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <Loader2 className="h-4 w-4 animate-spin opacity-40" />
          </div>
        ) : url && failedUrl !== url ? (
          <img
            src={url}
            alt={att.fileName}
            className="w-full h-full object-cover"
            onError={() => {
              console.warn("[chat] image load failed", { url, id: att.id });
              setFailedUrl(url);
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full opacity-40">
            <FileImage className="h-5 w-5" />
          </div>
        )}
        {overflowCount > 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-bold text-xl pointer-events-none">
            +{overflowCount}
          </span>
        )}
      </button>
      {overflowCount === 0 && (
        <>
          <AttachmentTileActions
            att={att}
            messageId={messageId}
            isOwn={isOwn}
            onToggleReaction={onToggleReaction}
            onDeleteAttachment={onDeleteAttachment}
            deleting={deletingAttachmentId === att.id}
          />
          <AttachmentReactionPills
            reactions={att.reactions}
            currentUserId={currentUserId}
            onToggleReaction={onToggleReaction}
            messageId={messageId}
            attachmentId={att.id}
          />
        </>
      )}
    </div>
  );
}

// ── Image grid (Telegram-style layouts) ───────────────────────────────────────
function ImageGrid({ images, allAttachments, onOpen, startIndex, messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  const shown = images.slice(0, 4);
  const overflowCount = Math.max(0, images.length - 4);
  const count = shown.length;
  // Per-tile action/reaction props are identical for every cell — bundle
  // them once and spread, rather than repeating six props across five call
  // sites.
  const tileProps = { messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId };

  // 1 image: natural aspect ratio
  if (count === 1) {
    return (
      <div className="mt-1.5" style={{ maxWidth: 220 }}>
        <ImageCard att={images[0]} index={startIndex} allAttachments={allAttachments} onOpen={onOpen} {...tileProps} />
      </div>
    );
  }

  // 2 images: side-by-side square cells
  if (count === 2) {
    return (
      <div className="mt-1.5 flex gap-0.5 rounded-xl overflow-hidden" style={{ width: 220, maxWidth: '100%' }}>
        {shown.map((att, i) => (
          <div key={att.id} className="relative flex-1" style={{ height: 110 }}>
            <ImageCoverCell att={att} index={startIndex + i} allAttachments={allAttachments} onOpen={onOpen} {...tileProps} />
          </div>
        ))}
      </div>
    );
  }

  // 3 images: 1 wide on top + 2 side-by-side below
  if (count === 3) {
    return (
      <div className="mt-1.5 rounded-xl overflow-hidden" style={{ width: 220, maxWidth: '100%' }}>
        <div className="relative" style={{ height: 132 }}>
          <ImageCoverCell att={shown[0]} index={startIndex} allAttachments={allAttachments} onOpen={onOpen} {...tileProps} />
        </div>
        <div className="flex gap-0.5 mt-0.5">
          {shown.slice(1).map((att, i) => (
            <div key={att.id} className="relative flex-1" style={{ height: 86 }}>
              <ImageCoverCell att={att} index={startIndex + 1 + i} allAttachments={allAttachments} onOpen={onOpen} {...tileProps} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4+ images: 2×2 grid, last cell shows overflow counter
  return (
    <div className="mt-1.5 rounded-xl overflow-hidden" style={{ width: 220, maxWidth: '100%' }}>
      <div className="flex gap-0.5">
        {shown.slice(0, 2).map((att, i) => (
          <div key={att.id} className="relative flex-1" style={{ height: 110 }}>
            <ImageCoverCell att={att} index={startIndex + i} allAttachments={allAttachments} onOpen={onOpen} {...tileProps} />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 mt-0.5">
        {shown.slice(2, 4).map((att, i) => (
          <div key={att.id} className="relative flex-1" style={{ height: 110 }}>
            <ImageCoverCell
              att={att}
              index={startIndex + 2 + i}
              allAttachments={allAttachments}
              onOpen={onOpen}
              overflowCount={i === 1 ? overflowCount : 0}
              {...tileProps}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Attachments renderer ──────────────────────────────────────────────────────
export function AttachmentsBlock({ attachments, onOpen, isOwn, messageId, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId }) {
  if (!attachments?.length) return null;

  // Group images together for grid layout
  const imageAtts = attachments.filter((a) => isImageMime(a.mimeType));
  const others = attachments.filter((a) => !isImageMime(a.mimeType));

  // Reorder: images first (for viewer indexing), then others
  const ordered = [...imageAtts, ...others];

  // Same six per-tile props for the grid and every video card.
  const tileProps = { messageId, isOwn, currentUserId, onToggleReaction, onDeleteAttachment, deletingAttachmentId };

  return (
    <>
      {imageAtts.length > 0 && (
        <ImageGrid
          images={imageAtts}
          allAttachments={ordered}
          onOpen={onOpen}
          startIndex={0}
          {...tileProps}
        />
      )}
      {others.map((att, i) => {
        const globalIdx = imageAtts.length + i;
        // Audio is checked BEFORE video: a voice note whose mime got dropped
        // or remapped to video/webm on upload (seen on some mobile browsers)
        // must still render as the audio player, not a black video tile.
        if (isAudioAttachment(att)) {
          return <AudioCard key={att.id} att={att} isOwn={isOwn} />;
        }
        if (isVideoMime(att.mimeType)) {
          return (
            <VideoCard
              key={att.id}
              att={att}
              index={globalIdx}
              allAttachments={ordered}
              onOpen={onOpen}
              {...tileProps}
            />
          );
        }
        return (
          <FileCard
            key={att.id}
            att={att}
            index={globalIdx}
            allAttachments={ordered}
            onOpen={onOpen}
            isOwn={isOwn}
          />
        );
      })}
    </>
  );
}
