import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, Download, Play, CheckCheck } from "lucide-react";
import { formatMessageTime, formatFileSize, isImageMime } from "../lib/chatUtils";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

function isVideoMime(m) { return String(m ?? "").startsWith("video/"); }
function isAudioMime(m) { return String(m ?? "").startsWith("audio/"); }

// Hook: pre-fetch signed URL for a single attachment (image, audio, video)
function useAttachmentUrl(att) {
  const { session } = useAuth();
  const needsUrl = isImageMime(att.mimeType) || isAudioMime(att.mimeType) || isVideoMime(att.mimeType);
  return useQuery({
    queryKey: ["chat-attachment-url", att.id],
    queryFn: async () => {
      try {
        const res = await atlas.chat.getAttachmentSignedUrl(att.id, session?.access_token);
        return res?.data?.url ?? null;
      } catch (err) {
        console.warn("[chat] getAttachmentSignedUrl failed", { id: att.id, status: err?.status, msg: err?.message });
        throw err;
      }
    },
    staleTime: 50 * 60 * 1000,
    retry: 2,
    enabled: needsUrl && Boolean(session?.access_token),
  });
}

// ── Image card ────────────────────────────────────────────────────────────────
function ImageCard({ att, index, allAttachments, onOpen }) {
  const { data: url, isLoading, isError } = useAttachmentUrl(att);

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
      ) : url ? (
        <img src={url} alt={att.fileName} className="block w-full object-cover" style={{ maxHeight: 220 }} />
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
  const { data: url } = useAttachmentUrl(att);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(allAttachments, index)}
      className="relative block rounded-xl overflow-hidden bg-black/20 hover:opacity-90 transition-opacity"
      style={{ minHeight: 80, maxWidth: 220 }}
    >
      {url ? (
        <video src={url} className="block w-full object-cover" style={{ maxHeight: 160 }} muted preload="metadata" />
      ) : (
        <div className="flex items-center justify-center h-24 w-40" />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
          <Play className="h-5 w-5 text-white fill-white ml-0.5" />
        </div>
      </div>
    </button>
  );
}

// ── Audio card ────────────────────────────────────────────────────────────────
function AudioCard({ att, isOwn }) {
  const { data: url, isLoading } = useAttachmentUrl(att);

  return (
    <div className="mt-1.5 max-w-55">
      {isLoading ? (
        <div className="flex items-center gap-2 opacity-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Cargando audio...</span>
        </div>
      ) : url ? (
        <audio
          src={url}
          controls
          className="w-full"
          style={{ height: 36, filter: isOwn ? "invert(1) brightness(0.85)" : "none" }}
        />
      ) : (
        <div className="flex items-center gap-2 text-xs opacity-50">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{att.fileName}</span>
        </div>
      )}
    </div>
  );
}

// ── File card (generic) ───────────────────────────────────────────────────────
function FileCard({ att, index, allAttachments, onOpen, isOwn }) {
  const { data: url } = useAttachmentUrl(att);

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
        <FileText className="h-4 w-4 shrink-0 opacity-60" />
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

// ── Image grid (2+ images grouped) ───────────────────────────────────────────
function ImageGrid({ images, allAttachments, onOpen, startIndex }) {
  if (images.length === 1) {
    return (
      <div className="mt-1.5 max-w-55">
        <ImageCard att={images[0]} index={startIndex} allAttachments={allAttachments} onOpen={onOpen} />
      </div>
    );
  }

  const shown = images.slice(0, 4);
  const overflow = images.length > 4 ? images.length - 4 : 0;

  return (
    <div className={`mt-1.5 grid gap-1 ${shown.length === 2 ? "grid-cols-2" : "grid-cols-2"}`} style={{ maxWidth: 220 }}>
      {shown.map((att, i) => {
        const globalIdx = startIndex + i;
        const isLast = i === shown.length - 1 && overflow > 0;
        return (
          <div key={att.id} className="relative rounded-lg overflow-hidden">
            <ImageCard att={att} index={globalIdx} allAttachments={allAttachments} onOpen={onOpen} />
            {isLast && (
              <button
                type="button"
                onClick={() => onOpen?.(allAttachments, globalIdx)}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-bold text-lg"
              >
                +{overflow + 1}
              </button>
            )}
          </div>
        );
      })}
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

// ── Main bubble ───────────────────────────────────────────────────────────────
export function ChatMessageBubble({
  message,
  isOwn,
  onAttachmentClick,
  showReadReceipt,
  isFirst = true,
  isLast = true,
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

  if (isOwn) {
    return (
      <div
        className={[
          "flex justify-end items-end gap-2 px-3 sm:px-4",
          rowPaddingY,
          isPending ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex flex-col items-end max-w-[72%] sm:max-w-[65%]">
          {hasText && (
            <div
              className={[
                "px-3 py-2 text-sm leading-relaxed",
                radius,
                "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                isDeleted ? "opacity-50 italic" : "",
              ].join(" ")}
            >
              {isDeleted ? (
                <span>Mensaje eliminado</span>
              ) : (
                <p className="text-left whitespace-pre-wrap wrap-break-word">{message.body}</p>
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
                <CheckCheck className="h-3 w-3 text-[hsl(var(--primary))]" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex items-end gap-2 px-3 sm:px-4",
        rowPaddingY,
        isPending ? "opacity-60" : "",
      ].join(" ")}
    >
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
              <p className="text-left whitespace-pre-wrap wrap-break-word">{message.body}</p>
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
    </div>
  );
}
