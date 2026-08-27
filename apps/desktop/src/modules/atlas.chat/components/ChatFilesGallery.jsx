import { useMemo } from "react";
import { EmptyState, Skeleton } from "@atlas/ui";
import {
  FileText, FileType2, FileSpreadsheet, FileVideo, FileAudio,
  FileArchive, FileCode, File as FileIconBase, FileImage,
} from "lucide-react";
import { isImageMime, formatFileSize, formatMessageTime } from "../lib/chatUtils";

// Stable fallback so a caller passing selectionMode without selectedIds gets
// a real (empty) Set instead of undefined — keeps selectedIds?.has(...) below
// from being the only thing standing between a missing prop and a thrown error.
const EMPTY_SELECTION = new Set();

export function FileTypeIcon({ mimeType }) {
  const m = String(mimeType ?? "").toLowerCase();
  if (m === "application/pdf") return <FileType2 className="h-5 w-5 text-red-400" />;
  if (m.includes("spreadsheet") || m.includes("excel") || m === "text/csv")
    return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (m.includes("word") || m.includes("document"))
    return <FileText className="h-5 w-5 text-blue-400" />;
  if (m.startsWith("video/")) return <FileVideo className="h-5 w-5 text-orange-400" />;
  if (m.startsWith("audio/")) return <FileAudio className="h-5 w-5 text-emerald-400" />;
  if (m.includes("zip") || m.includes("rar") || m.includes("tar") || m.includes("7z"))
    return <FileArchive className="h-5 w-5 text-yellow-400" />;
  if (m.startsWith("text/") || m.includes("json") || m.includes("xml"))
    return <FileCode className="h-5 w-5 text-cyan-400" />;
  return <FileIconBase className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />;
}

function MediaSelectionCircle({ isSelected }) {
  return (
    <div
      className={[
        "absolute top-1 right-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
        isSelected
          ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
          : "border-white/70 bg-black/20",
      ].join(" ")}
    >
      {isSelected && (
        <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function ChatFilesGallery({
  messages, isLoading, onAttachmentClick,
  selectionMode = false, selectedIds = EMPTY_SELECTION, onToggleSelect, onEnterSelection, onCancelSelection,
}) {
  const allAttachments = useMemo(() => {
    if (!messages?.length) return [];
    const result = [];
    for (const msg of [...messages].reverse()) {
      for (const att of (msg.attachments ?? [])) {
        result.push({ ...att, createdAt: msg.created_at, msgAttachments: msg.attachments });
      }
    }
    return result;
  }, [messages]);

  const images = useMemo(() => allAttachments.filter((a) => isImageMime(a.mimeType)), [allAttachments]);
  const otherFiles = useMemo(() => allAttachments.filter((a) => !isImageMime(a.mimeType)), [allAttachments]);

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!allAttachments.length) {
    return (
      <EmptyState
        className="flex-1 min-h-0"
        title="Sin archivos"
        description="Aun no se han compartido archivos en esta conversacion."
      />
    );
  }

  return (
    <div className="p-3 space-y-4">
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Fotos y videos
            </p>
            {selectionMode ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {selectedIds.size} seleccionados
                </span>
                <button
                  type="button"
                  onClick={onCancelSelection}
                  className="text-[10px] font-medium text-[hsl(var(--primary))] hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onEnterSelection}
                className="text-[10px] font-medium text-[hsl(var(--primary))] hover:underline"
              >
                Seleccionar
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {images.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => {
                  if (selectionMode) {
                    onToggleSelect(att.id);
                    return;
                  }
                  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
                  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
                }}
                className="relative aspect-square bg-[hsl(var(--muted))] rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                {att.url ? (
                  <img src={att.url} alt={att.fileName ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileImage className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                  </div>
                )}
                {selectionMode && <MediaSelectionCircle isSelected={selectedIds.has(att.id)} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {otherFiles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
            Archivos
          </p>
          <div className="space-y-1">
            {otherFiles.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => {
                  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
                  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-[hsl(var(--border))] flex items-center justify-center shrink-0">
                  <FileTypeIcon mimeType={att.mimeType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{att.fileName ?? "Archivo"}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {att.sizeBytes ? `${formatFileSize(att.sizeBytes)} · ` : ""}
                    {att.createdAt ? formatMessageTime(att.createdAt) : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
