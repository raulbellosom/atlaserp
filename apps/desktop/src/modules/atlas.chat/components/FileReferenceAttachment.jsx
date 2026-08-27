// apps/desktop/src/modules/atlas.chat/components/FileReferenceAttachment.jsx
// Renders a "file" entity reference (a link to an existing atlas.files record,
// attached via the composer's entity-ref picker) as a real attachment card —
// an image thumbnail or a downloadable file row — instead of the generic
// EntityReferenceCard link chip. Only usable when the reference carries
// `mimeType` (added when the backend resolves the ref at send time — refs
// sent before that change won't have it, and the caller falls back to
// EntityReferenceCard for those). Kept in its own file rather than added to
// ChatMessageBubble.jsx, which is already over this project's 1000-line
// soft limit.
//
// Unlike real chat attachments (whose `url` is embedded directly in the
// message payload), a file reference's actual signed URL is never persisted
// — it would go stale, since message metadata is stored forever and signed
// URLs expire. Every render here fetches its own signed URL on demand via
// the generic files-module endpoint (GET /files/:id/signed-url), the same
// endpoint any other module already uses to preview/download a company
// file — this introduces no new access exposure over what already exists.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download } from "lucide-react";
import { ImageViewer } from "@atlas/ui";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";
import { formatFileSize, isImageMime } from "../lib/chatUtils";
import { FileTypeIcon } from "./ChatFilesGallery";

export function useFileRefSignedUrl(recordId, variant, enabled) {
  const { session } = useAuth();
  const token = session?.access_token;
  return useQuery({
    queryKey: ["chat-file-ref-signed-url", recordId, variant],
    queryFn: async () => {
      const res = await atlas.files.getSignedUrl(recordId, token, { variant });
      return res?.data?.signedUrl ?? null;
    },
    enabled: Boolean(enabled && recordId && token),
    staleTime: 50 * 60 * 1000,
  });
}

function FileRefImage({ reference, isOwn }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const { data: cardUrl, isLoading } = useFileRefSignedUrl(reference.recordId, "card", true);
  const { data: fullUrl } = useFileRefSignedUrl(reference.recordId, "full", viewerOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        className="block rounded-xl overflow-hidden relative hover:opacity-90 transition-opacity bg-black/10 mt-1.5"
        style={{ minHeight: 80, maxWidth: 220 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-20 w-32">
            <Loader2 className="h-5 w-5 animate-spin opacity-40" />
          </div>
        ) : cardUrl ? (
          <img src={cardUrl} alt={reference.title} className="block w-full object-cover" style={{ maxHeight: 220 }} />
        ) : (
          <div className="flex items-center justify-center h-20 w-32 opacity-40">
            <FileTypeIcon mimeType={reference.mimeType} />
          </div>
        )}
      </button>
      <ImageViewer
        src={fullUrl ?? cardUrl}
        alt={reference.title}
        fileName={reference.title}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

function FileRefDownloadRow({ reference, isOwn }) {
  const [wantsUrl, setWantsUrl] = useState(false);
  const { data: url, isLoading } = useFileRefSignedUrl(reference.recordId, "full", wantsUrl);

  function handleClick() {
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = reference.title ?? "archivo";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    setWantsUrl(true);
  }

  return (
    <div
      className={[
        "flex items-center gap-2.5 mt-1.5 px-3 py-2 rounded-xl max-w-55",
        isOwn ? "bg-white/15" : "bg-[hsl(var(--border))]",
      ].join(" ")}
    >
      <FileTypeIcon mimeType={reference.mimeType} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{reference.title}</p>
        <p className="text-xs opacity-50">{reference.sizeBytes ? formatFileSize(reference.sizeBytes) : ""}</p>
      </div>
      <button type="button" onClick={handleClick} disabled={isLoading} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function FileReferenceAttachment({ reference, isOwn }) {
  if (isImageMime(reference.mimeType)) return <FileRefImage reference={reference} isOwn={isOwn} />;
  return <FileRefDownloadRow reference={reference} isOwn={isOwn} />;
}
