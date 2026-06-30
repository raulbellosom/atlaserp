import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, Download, Play, Pause, CheckCheck, Mic, MoreHorizontal,
  FileText, FileType2, FileSpreadsheet, FileImage, FileVideo, FileAudio,
  FileArchive, FileCode, File, Copy, Trash2, Share2, EyeOff, CheckSquare,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@atlas/ui";
import { formatMessageTime, formatFileSize, isImageMime } from "../lib/chatUtils";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

function isVideoMime(m) { return String(m ?? "").startsWith("video/"); }
function isAudioMime(m) { return String(m ?? "").startsWith("audio/"); }

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
  return useQuery({
    queryKey: ["chat-attachment-url", att.id],
    queryFn: async () => {
      if (att.url) return att.url;
      try {
        const res = await atlas.chat.getAttachmentSignedUrl(att.id, session?.access_token);
        return res?.data?.url ?? null;
      } catch (err) {
        console.warn("[chat] getAttachmentSignedUrl failed", { id: att.id, status: err?.status, msg: err?.message });
        throw err;
      }
    },
    // Seed the cache with the embedded URL so it resolves synchronously
    initialData: att.url ? att.url : undefined,
    staleTime: 50 * 60 * 1000,
    retry: 2,
    enabled: Boolean(session?.access_token),
  });
}

// ── Image card ────────────────────────────────────────────────────────────────
function ImageCard({ att, index, allAttachments, onOpen }) {
  const { data: url, isLoading, isError } = useAttachmentUrl(att);
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(allAttachments, index)}
      className="block rounded-xl overflow-hidden relative hover:opacity-90 transition-opacity bg-black/10"
      style={{ minHeight: 80 }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-20 w-32">
          <Loader2 className="h-5 w-5 animate-spin opacity-40" />
        </div>
      ) : url && !imgErr ? (
        <img
          src={url}
          alt={att.fileName}
          className="block w-full object-cover"
          style={{ maxHeight: 220 }}
          onError={() => {
            console.warn("[chat] image load failed", { url, id: att.id });
            setImgErr(true);
          }}
        />
      ) : (
        <div className="flex items-center justify-center h-20 w-32 opacity-40">
          <FileText className="h-6 w-6" />
        </div>
      )}
    </button>
  );
}

// ── Video card ────────────────────────────────────────────────────────────────
function VideoCard({ att, index, allAttachments, onOpen }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const [videoErr, setVideoErr] = useState(false);

  // Appending #t=0.001 forces the browser to seek 1ms in and paint that frame as a thumbnail
  const videoSrc = url ? `${url}#t=0.001` : null;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(allAttachments, index)}
      className="relative block rounded-xl overflow-hidden bg-black/25 hover:opacity-90 active:opacity-70 transition-opacity mt-1.5"
      style={{ width: 220, height: 140, maxWidth: "100%" }}
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
  );
}

// ── Audio card (voice message player) ────────────────────────────────────────
const AUDIO_SPEEDS = [1, 1.5, 2, 0.5];

function fmtAudioTime(secs) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Seeded LCG so bars are deterministic per attachment (same each render)
function seedBars(seed, count) {
  let s = seed;
  return Array.from({ length: count }, () => {
    s = (s * 1664525 + 1013904223) | 0;
    return 20 + (Math.abs(s) % 80); // 20-100% height
  });
}

function AudioCard({ att, isOwn }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const audioRef = useRef(null);
  const durationFoundRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const speed = AUDIO_SPEEDS[speedIdx];

  // Deterministic waveform bars seeded by attachment id
  const bars = useMemo(() => {
    const seed = Array.from(att.id).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
    return seedBars(seed, 32);
  }, [att.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // MediaRecorder webm files report Infinity duration — seek to end to discover real duration
  function handleLoadedMetadata(e) {
    const audio = e.currentTarget;
    if (isFinite(audio.duration) && audio.duration > 0) {
      durationFoundRef.current = true;
      setDuration(audio.duration);
    } else {
      audio.currentTime = 1e101; // triggers seeked which reveals real duration
    }
  }

  function handleSeeked(e) {
    if (durationFoundRef.current) return;
    const audio = e.currentTarget;
    if (isFinite(audio.duration) && audio.duration > 0) {
      durationFoundRef.current = true;
      setDuration(audio.duration);
      audio.currentTime = 0;
    }
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
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  // Color tokens
  const playBg    = isOwn ? "rgba(255,255,255,0.22)" : "var(--brand-primary)";
  const playColor = isOwn ? "white"                   : "var(--brand-primary-foreground)";
  const barPlayed = isOwn ? "rgba(255,255,255,0.9)"  : "var(--brand-primary)";
  const barRest   = isOwn ? "rgba(255,255,255,0.28)" : "hsl(var(--border))";
  const metaColor = isOwn ? "rgba(255,255,255,0.65)" : "hsl(var(--muted-foreground))";
  const speedBg   = isOwn ? "rgba(255,255,255,0.15)" : "hsl(var(--muted))";
  const speedFg   = isOwn ? "rgba(255,255,255,0.9)"  : "hsl(var(--foreground))";

  if (!url && !isLoading && loadError) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs opacity-50" style={{ width: 240 }}>
        <FileAudio className="h-4 w-4 shrink-0" />
        <span className="truncate">{att.fileName}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2.5" style={{ width: 248, maxWidth: "100%" }}>
      {/* Hidden audio — only mount when URL is available to avoid phantom errors */}
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (isFinite(d) && d > 0 && !durationFoundRef.current) {
              durationFoundRef.current = true;
              setDuration(d);
            }
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
            if (audioRef.current) audioRef.current.currentTime = 0;
          }}
          onError={() => setLoadError(true)}
        />
      )}

      {/* Play / pause button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading || !url}
        className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center touch-manipulation active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100"
        style={{ backgroundColor: playBg, color: playColor }}
        aria-label={isLoading ? "Cargando..." : playing ? "Pausar" : "Reproducir"}
      >
        {isLoading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : playing
          ? <Pause className="h-4.5 w-4.5 fill-current" />
          : <Play  className="h-4.5 w-4.5 fill-current ml-0.5" />}
      </button>

      {/* Waveform + meta row */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Waveform bars — tap/click to seek */}
        <div
          className="flex items-center gap-px cursor-pointer touch-manipulation select-none"
          style={{ height: 28 }}
          onClick={handleSeek}
          onTouchEnd={handleSeek}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: 2.5,
                height: `${h}%`,
                borderRadius: 2,
                backgroundColor: i / bars.length < progress ? barPlayed : barRest,
                transition: "background-color 0.06s",
              }}
            />
          ))}
        </div>

        {/* Time row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] leading-none tabular-nums" style={{ color: metaColor }}>
            {fmtAudioTime(currentTime)}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Mic icon for voice note identity */}
            <Mic className="h-2.5 w-2.5 shrink-0" style={{ color: metaColor }} />
            <span className="text-[10px] leading-none tabular-nums" style={{ color: metaColor }}>
              {duration > 0 ? fmtAudioTime(duration) : "—:——"}
            </span>
          </div>
        </div>
      </div>

      {/* Speed pill */}
      <button
        type="button"
        onClick={() => setSpeedIdx((i) => (i + 1) % AUDIO_SPEEDS.length)}
        className="shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 touch-manipulation active:scale-95 transition-transform leading-none"
        style={{ backgroundColor: speedBg, color: speedFg }}
        aria-label="Velocidad"
      >
        x{speed}
      </button>
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
function ImageCoverCell({ att, index, allAttachments, onOpen, overflowCount = 0 }) {
  const { data: url, isLoading } = useAttachmentUrl(att);
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(allAttachments, index)}
      className="absolute inset-0 w-full h-full hover:opacity-90 transition-opacity bg-black/10"
    >
      {isLoading ? (
        <div className="flex items-center justify-center w-full h-full">
          <Loader2 className="h-4 w-4 animate-spin opacity-40" />
        </div>
      ) : url && !imgErr ? (
        <img
          src={url}
          alt={att.fileName}
          className="w-full h-full object-cover"
          onError={() => {
            console.warn("[chat] image load failed", { url, id: att.id });
            setImgErr(true);
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
  );
}

// ── Image grid (Telegram-style layouts) ───────────────────────────────────────
function ImageGrid({ images, allAttachments, onOpen, startIndex }) {
  const shown = images.slice(0, 4);
  const overflowCount = Math.max(0, images.length - 4);
  const count = shown.length;

  // 1 image: natural aspect ratio
  if (count === 1) {
    return (
      <div className="mt-1.5" style={{ maxWidth: 220 }}>
        <ImageCard att={images[0]} index={startIndex} allAttachments={allAttachments} onOpen={onOpen} />
      </div>
    );
  }

  // 2 images: side-by-side square cells
  if (count === 2) {
    return (
      <div className="mt-1.5 flex gap-0.5 rounded-xl overflow-hidden" style={{ width: 220, maxWidth: '100%' }}>
        {shown.map((att, i) => (
          <div key={att.id} className="relative flex-1" style={{ height: 110 }}>
            <ImageCoverCell att={att} index={startIndex + i} allAttachments={allAttachments} onOpen={onOpen} />
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
          <ImageCoverCell att={shown[0]} index={startIndex} allAttachments={allAttachments} onOpen={onOpen} />
        </div>
        <div className="flex gap-0.5 mt-0.5">
          {shown.slice(1).map((att, i) => (
            <div key={att.id} className="relative flex-1" style={{ height: 86 }}>
              <ImageCoverCell att={att} index={startIndex + 1 + i} allAttachments={allAttachments} onOpen={onOpen} />
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
            <ImageCoverCell att={att} index={startIndex + i} allAttachments={allAttachments} onOpen={onOpen} />
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
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Attachments renderer ──────────────────────────────────────────────────────
function AttachmentsBlock({ attachments, onOpen, isOwn }) {
  if (!attachments?.length) return null;

  // Group images together for grid layout
  const imageAtts = attachments.filter((a) => isImageMime(a.mimeType));
  const others = attachments.filter((a) => !isImageMime(a.mimeType));
  const imageStartIndex = 0; // images come first in allAttachments when we re-order below

  // Reorder: images first (for viewer indexing), then others
  const ordered = [...imageAtts, ...others];

  return (
    <>
      {imageAtts.length > 0 && (
        <ImageGrid
          images={imageAtts}
          allAttachments={ordered}
          onOpen={onOpen}
          startIndex={0}
        />
      )}
      {others.map((att, i) => {
        const globalIdx = imageAtts.length + i;
        if (isVideoMime(att.mimeType)) {
          return (
            <VideoCard
              key={att.id}
              att={att}
              index={globalIdx}
              allAttachments={ordered}
              onOpen={onOpen}
            />
          );
        }
        if (isAudioMime(att.mimeType)) {
          return <AudioCard key={att.id} att={att} isOwn={isOwn} />;
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

// ── Corner radius for grouped bubbles ─────────────────────────────────────────
function bubbleRadius(isOwn, isFirst, isLast) {
  const FULL = "rounded-2xl";
  if (isFirst && isLast) return FULL;
  if (isOwn) {
    if (isFirst) return `${FULL} rounded-br-[4px]`;
    if (isLast)  return `${FULL} rounded-tr-[4px]`;
    return `${FULL} rounded-r-[4px]`;
  } else {
    if (isFirst) return `${FULL} rounded-bl-[4px]`;
    if (isLast)  return `${FULL} rounded-tl-[4px]`;
    return `${FULL} rounded-l-[4px]`;
  }
}

// ── Selection checkbox ────────────────────────────────────────────────────────
function SelectionCircle({ isSelected }) {
  return (
    <div
      className={[
        "shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-150 self-center",
        isSelected
          ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
          : "border-[hsl(var(--foreground)/0.5)] bg-[hsl(var(--background)/0.85)]",
      ].join(" ")}
      style={!isSelected ? { boxShadow: "0 0 0 1px hsl(var(--foreground)/0.15)" } : undefined}
    >
      {isSelected && (
        <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Message action dropdown ───────────────────────────────────────────────────
function MessageActions({ isOwn, hasBody, onCopy, onDelete, onHideForMe, onForward, onEnterSelection }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="opacity-0 group-hover/msg:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 h-6 w-6 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-opacity shrink-0 self-center touch-manipulation"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? "start" : "end"} style={{ zIndex: 10000 }}>
        {hasBody && onCopy && (
          <DropdownMenuItem onSelect={onCopy}>
            <Copy className="h-3.5 w-3.5 mr-2" />
            Copiar
          </DropdownMenuItem>
        )}
        {onForward && (
          <DropdownMenuItem onSelect={onForward}>
            <Share2 className="h-3.5 w-3.5 mr-2" />
            Reenviar
          </DropdownMenuItem>
        )}
        {onEnterSelection && (
          <DropdownMenuItem onSelect={onEnterSelection}>
            <CheckSquare className="h-3.5 w-3.5 mr-2" />
            Seleccionar
          </DropdownMenuItem>
        )}
        {(hasBody && onCopy || onForward || onEnterSelection) && (onDelete || onHideForMe) && (
          <DropdownMenuSeparator />
        )}
        {isOwn && onDelete && (
          <DropdownMenuItem onSelect={onDelete} className="text-red-500 focus:text-red-500">
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Eliminar para todos
          </DropdownMenuItem>
        )}
        {onHideForMe && (
          <DropdownMenuItem onSelect={onHideForMe}>
            <EyeOff className="h-3.5 w-3.5 mr-2" />
            Eliminar para mi
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Search text highlight ──────────────────────────────────────────────────────
function HighlightedText({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const q = query.toLowerCase();
  const parts = [];
  let lastIndex = 0;
  const lower = text.toLowerCase();
  while (lastIndex < text.length) {
    const idx = lower.indexOf(q, lastIndex);
    if (idx === -1) { parts.push(text.slice(lastIndex)); break; }
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <mark key={idx} className="bg-yellow-300 text-black rounded-xs px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    lastIndex = idx + q.length;
  }
  return <>{parts}</>;
}

// ── Main bubble ───────────────────────────────────────────────────────────────
export function ChatMessageBubble({
  message,
  isOwn,
  onAttachmentClick,
  showReadReceipt,
  isFirst = true,
  isLast = true,
  onCopy,
  onDelete,
  onHideForMe,
  onForward,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onEnterSelection,
  searchQuery = "",
  isSearchMatch = false,
  isCurrentMatch = false,
}) {
  if (message.type === "date_separator") {
    return (
      <div className="flex items-center gap-3 my-4 px-4">
        <div className="flex-1 h-px bg-[hsl(var(--border))]" />
        <span className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium shrink-0 px-1">
          {message.label}
        </span>
        <div className="flex-1 h-px bg-[hsl(var(--border))]" />
      </div>
    );
  }

  if (message.sender_type === "system" || message.message_type === "system") {
    return (
      <div className="flex justify-center my-2 px-4">
        <span className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-3 py-1 rounded-full">
          {message.body}
        </span>
      </div>
    );
  }

  const [avatarErr, setAvatarErr] = useState(false);
  const isDeleted = Boolean(message.deleted_at);
  const isPending = String(message.id ?? "").startsWith("temp-");
  const attachments = message.attachments ?? [];
  const senderName =
    message.sender?.displayName ??
    (message.sender_type === "guest" ? "Visitante" : "Usuario");

  const radius = bubbleRadius(isOwn, isFirst, isLast);
  const rowPaddingY = isFirst ? "mt-2" : "mt-0.5";
  const showMeta = isLast || showReadReceipt || isPending;

  // Bubble only shown when there's text (attachments render outside/below)
  const hasText = Boolean(message.body) || isDeleted;

  const hasBody = Boolean(message.body) && !isDeleted;
  const showActions = !isDeleted && !isPending;

  if (isOwn) {
    return (
      <div
        data-msg-id={message.id}
        role={selectionMode ? "button" : undefined}
        tabIndex={selectionMode ? 0 : undefined}
        onClick={selectionMode ? onSelect : undefined}
        onKeyDown={selectionMode ? (e) => e.key === "Enter" && onSelect?.() : undefined}
        className={[
          "group/msg flex justify-end items-end gap-1 px-3 sm:px-4",
          rowPaddingY,
          isPending ? "opacity-60" : "",
          selectionMode ? "cursor-pointer" : "",
          selectionMode && isSelected ? "bg-[hsl(var(--primary)/0.08)]" : "",
          isCurrentMatch ? "bg-yellow-400/15" : isSearchMatch ? "bg-yellow-400/6" : "",
        ].join(" ")}
      >
        {selectionMode ? (
          <SelectionCircle isSelected={isSelected} />
        ) : showActions && (
          <MessageActions
            isOwn
            hasBody={hasBody}
            onCopy={onCopy}
            onDelete={onDelete}
            onHideForMe={onHideForMe}
            onForward={onForward}
            onEnterSelection={onEnterSelection}
          />
        )}
        <div className="flex flex-col items-end max-w-[72%] sm:max-w-[65%]">
          {hasText && (
            <div
              className={[
                "px-3 py-2 text-sm leading-relaxed",
                radius,
                "bg-(--brand-primary) text-(--brand-primary-foreground)",
                isDeleted ? "opacity-50 italic" : "",
              ].join(" ")}
            >
              {isDeleted ? (
                <span>Mensaje eliminado</span>
              ) : (
                <p className="text-left whitespace-pre-wrap wrap-break-word">
                  <HighlightedText text={message.body} query={searchQuery} />
                </p>
              )}
            </div>
          )}

          {!isDeleted && attachments.length > 0 && (
            <AttachmentsBlock attachments={attachments} onOpen={onAttachmentClick} isOwn />
          )}

          {showMeta && (
            <div className="flex items-center gap-1 mt-1 px-0.5">
              {message.edited_at && !isPending && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">editado</span>
              )}
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {isPending ? "Enviando..." : formatMessageTime(message.created_at)}
              </span>
              {showReadReceipt && !isPending && (
                <CheckCheck className="h-3 w-3 text-(--brand-primary)" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-msg-id={message.id}
      role={selectionMode ? "button" : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={selectionMode ? onSelect : undefined}
      onKeyDown={selectionMode ? (e) => e.key === "Enter" && onSelect?.() : undefined}
      className={[
        "group/msg flex items-end gap-1 px-3 sm:px-4",
        rowPaddingY,
        isPending ? "opacity-60" : "",
        selectionMode ? "cursor-pointer" : "",
        selectionMode && isSelected ? "bg-[hsl(var(--primary)/0.08)]" : "",
        isCurrentMatch ? "bg-yellow-400/15" : isSearchMatch ? "bg-yellow-400/6" : "",
      ].join(" ")}
    >
      {selectionMode && <SelectionCircle isSelected={isSelected} />}
      {/* Avatar — invisible on non-last to keep column alignment */}
      <div className={["shrink-0", isLast ? "visible" : "invisible"].join(" ")}>
        {message.sender?.avatarUrl && !avatarErr ? (
          <img
            src={message.sender.avatarUrl}
            alt={senderName}
            className="h-7 w-7 rounded-full object-cover"
            onError={() => setAvatarErr(true)}
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] border border-[hsl(var(--border))] flex items-center justify-center text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
            {(senderName?.[0] ?? "U").toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-col items-start max-w-[72%] sm:max-w-[65%]">
        {isFirst && (
          <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1 ml-1 truncate max-w-full">
            {senderName}
          </span>
        )}

        {hasText && (
          <div
            className={[
              "px-3 py-2 text-sm leading-relaxed",
              radius,
              "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
              isDeleted ? "opacity-50 italic" : "",
            ].join(" ")}
          >
            {isDeleted ? (
              <span>Mensaje eliminado</span>
            ) : (
              <p className="text-left whitespace-pre-wrap wrap-break-word">
                <HighlightedText text={message.body} query={searchQuery} />
              </p>
            )}
          </div>
        )}

        {!isDeleted && attachments.length > 0 && (
          <AttachmentsBlock attachments={attachments} onOpen={onAttachmentClick} isOwn={false} />
        )}

        {showMeta && (
          <div className="flex items-center gap-1 mt-1 px-0.5">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {isPending ? "Enviando..." : formatMessageTime(message.created_at)}
            </span>
            {message.edited_at && !isPending && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] italic">editado</span>
            )}
          </div>
        )}
      </div>

      {!selectionMode && showActions && (
        <MessageActions
          isOwn={false}
          hasBody={hasBody}
          onCopy={onCopy}
          onDelete={onDelete}
          onHideForMe={onHideForMe}
          onForward={onForward}
          onEnterSelection={onEnterSelection}
        />
      )}
    </div>
  );
}
