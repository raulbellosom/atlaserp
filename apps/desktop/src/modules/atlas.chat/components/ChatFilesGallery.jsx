import { useMemo, useState } from "react";
import { EmptyState, Skeleton, ImageViewer } from "@atlas/ui";
import {
  FileText, FileType2, FileSpreadsheet, FileVideo, FileAudio,
  FileArchive, FileCode, File as FileIconBase, FileImage, Loader2, Link2, Download,
} from "lucide-react";
import { isImageMime, formatFileSize, formatMessageTime, downloadViaBlob } from "../lib/chatUtils";
import { useFileRefSignedUrl } from "../hooks/useFileRefSignedUrl";
import { EntityFileViewer } from "./EntityFileViewer";

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

function MediaImageThumb({ att }) {
  const { data: lazyUrl, isLoading } = useFileRefSignedUrl(att.id, "card", att.isEntityRef);
  const url = att.isEntityRef ? lazyUrl : att.url;

  if (att.isEntityRef && isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin opacity-40" />
      </div>
    );
  }
  if (url) return <img src={url} alt={att.fileName ?? ""} className="w-full h-full object-cover" />;
  return (
    <div className="w-full h-full flex items-center justify-center">
      <FileImage className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
    </div>
  );
}

function ChatFilesGalleryImageViewer({ recordId, title, open, onClose }) {
  const { data: fullUrl } = useFileRefSignedUrl(recordId, "full", open);
  return <ImageViewer src={fullUrl} alt={title} fileName={title} open={open} onClose={onClose} />;
}

// Own row component (rather than an inline click handler in the .map()) so
// entity-ref files can carry their own viewer-open/download state. The row
// opens the shared EntityFileViewer (image/PDF/video/audio preview) on
// click, same as real attachments already do via onAttachmentClick — plus a
// dedicated download button for entity-ref files, since those otherwise had
// no quick "just download it" path without first opening the viewer (real
// attachments already have one inside ChatAttachmentViewer/AdvancedFileViewer
// once opened, and their row here has always opened that same viewer).
function ArchivoRow({ att, onAttachmentClick }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Never auto-enabled — `refetch()` is called explicitly from the download
  // button's own click handler below. A boolean-gated `enabled` flag plus a
  // useEffect reacting to `data` looks equivalent but isn't: once this exact
  // queryKey (fileId + "full") has EVER resolved anywhere else in the app in
  // this session (react-query caches across all callers, e.g. the same file
  // downloaded earlier from the profile Media tab), later mounts of THIS row
  // get that cached `data` back immediately regardless of `enabled` — firing
  // the auto-download effect with no click at all. Fetching imperatively via
  // refetch() and acting only on ITS OWN return value sidesteps that.
  const { refetch } = useFileRefSignedUrl(att.id, "full", false);
  const viewerFiles = [{ id: att.id, mimeType: att.mimeType, originalName: att.fileName, sizeBytes: att.sizeBytes ?? null }];

  function handleRowClick() {
    if (!att.isEntityRef) {
      const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
      onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
      return;
    }
    setViewerOpen(true);
  }

  async function handleDownloadClick() {
    setDownloading(true);
    try {
      const { data: url } = await refetch();
      if (url) {
        await downloadViaBlob(url, att.fileName).catch(() => {
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="w-full flex items-center gap-1 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">
        <button type="button" onClick={handleRowClick} className="flex items-center gap-3 flex-1 min-w-0 p-2.5 text-left">
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
        {att.isEntityRef && (
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={downloading}
            title="Descargar"
            className="shrink-0 h-8 w-8 mr-1.5 rounded-full flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))] transition-colors disabled:opacity-40"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        )}
      </div>
      {att.isEntityRef && (
        <EntityFileViewer open={viewerOpen} onOpenChange={setViewerOpen} files={viewerFiles} activeIndex={0} />
      )}
    </>
  );
}

// A photo tile's own colors are unpredictable (a bright product shot next to
// a near-black photo, in either app theme) — a flat theme-token border can
// disappear against matching photo content either way. A white ring plus a
// dark drop shadow stays legible against any photo, in any theme, the same
// way native photo pickers (WhatsApp, Google Photos) handle this; the
// selected state adds a filled primary dot + a slight scale-up so the two
// states are unmistakable even at a glance.
function MediaSelectionCircle({ isSelected }) {
  return (
    <div
      className={[
        "absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center transition-all duration-150",
        "shadow-[0_1px_4px_rgba(0,0,0,0.7)]",
        isSelected
          ? "bg-[hsl(var(--primary))] ring-2 ring-white scale-110"
          : "bg-black/30 ring-2 ring-white/90",
      ].join(" ")}
    >
      {isSelected && (
        <svg viewBox="0 0 10 8" className="w-2 h-1.5" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// Entity-ref images can't join the bulk-download selection (see the click
// handler below), so instead of silently doing nothing during selection
// mode, this marks them as a reference at a glance — same corner spot the
// selection circle would occupy on a real attachment.
function EntityRefBadge() {
  return (
    <div
      title="Referencia — toca para ver"
      className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-black/40 ring-2 ring-white/70 flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
    >
      <Link2 className="h-2 w-2 text-white" />
    </div>
  );
}

export function ChatFilesGallery({
  messages, isLoading, onAttachmentClick,
  selectionMode = false, selectedIds = EMPTY_SELECTION, onToggleSelect, onEnterSelection, onCancelSelection,
  // Two callers, two different layout contracts: ChatWindow.jsx's standalone
  // "files view" swaps this in as the entire message-area content (its own
  // wrapper provides no scrolling, same as ChatMessageList's own roots), so
  // it needs to own its scroll region — the default. ConversationMediaTab
  // nests this inside ConversationProfilePanel's single flat-sections scroll
  // column instead, so it must NOT own a second one.
  scrollable = true,
  previewLimit,
}) {
  const [entityRefViewer, setEntityRefViewer] = useState({ open: false, recordId: null, title: null });
  const scrollableClass = scrollable ? "flex-1 min-h-0 overflow-y-auto" : "";
  const allAttachments = useMemo(() => {
    if (!messages?.length) return [];
    const result = [];
    for (const msg of [...messages].reverse()) {
      for (const att of (msg.attachments ?? [])) {
        result.push({ ...att, createdAt: msg.created_at, msgAttachments: msg.attachments, isEntityRef: false });
      }
      for (const ref of (msg.metadata?.entityRefs ?? [])) {
        if (ref.entityType !== "file" || !ref.mimeType) continue;
        result.push({
          id: ref.recordId,
          mimeType: ref.mimeType,
          fileName: ref.title,
          sizeBytes: ref.sizeBytes,
          createdAt: msg.created_at,
          url: null,
          isEntityRef: true,
        });
      }
    }
    return result;
  }, [messages]);

  const images = useMemo(() => {
    const all = allAttachments.filter((a) => isImageMime(a.mimeType));
    return previewLimit ? all.slice(0, previewLimit) : all;
  }, [allAttachments, previewLimit]);
  const otherFiles = useMemo(() => {
    const all = allAttachments.filter((a) => !isImageMime(a.mimeType));
    return previewLimit ? all.slice(0, previewLimit) : all;
  }, [allAttachments, previewLimit]);

  if (isLoading) {
    return (
      <div className={[scrollableClass, "p-4 space-y-2"].join(" ")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!allAttachments.length) {
    return (
      <EmptyState
        className={scrollable ? "flex-1 min-h-0" : "py-8"}
        title="Sin archivos"
        description="Aun no se han compartido archivos en esta conversacion."
      />
    );
  }

  return (
    <>
    <div className={[scrollableClass, "p-3 space-y-4"].join(" ")}>
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
                  // Entity-ref images have no embedded url and no resolved-download
                  // entry in ConversationMediaTab's own attachment list for bulk
                  // download to use — selecting one would silently drop it from
                  // "Descargar (N)" with no feedback. Not selectable; always opens
                  // the single-image viewer instead, selection mode or not.
                  if (att.isEntityRef) {
                    setEntityRefViewer({ open: true, recordId: att.id, title: att.fileName });
                    return;
                  }
                  if (selectionMode) {
                    onToggleSelect(att.id);
                    return;
                  }
                  const idx = att.msgAttachments.findIndex((a) => a.id === att.id);
                  onAttachmentClick(att.msgAttachments, idx >= 0 ? idx : 0);
                }}
                className="relative aspect-square bg-[hsl(var(--muted))] rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                <MediaImageThumb att={att} />
                {selectionMode && !att.isEntityRef && <MediaSelectionCircle isSelected={selectedIds.has(att.id)} />}
                {selectionMode && att.isEntityRef && <EntityRefBadge />}
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
              <ArchivoRow key={att.id} att={att} onAttachmentClick={onAttachmentClick} />
            ))}
          </div>
        </div>
      )}
    </div>
    <ChatFilesGalleryImageViewer
      recordId={entityRefViewer.recordId}
      title={entityRefViewer.title}
      open={entityRefViewer.open}
      onClose={() => setEntityRefViewer((v) => ({ ...v, open: false }))}
    />
    </>
  );
}
