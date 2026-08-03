import { useCallback, useRef } from "react";
import { AdvancedFileViewer } from "../../atlas.files/components/AdvancedFileViewer";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

export function ChatAttachmentViewer({ open, onOpenChange, attachments, activeIndex, onIndexChange }) {
  const { session } = useAuth();
  // Per-viewer-session cache so re-visiting an already-viewed attachment
  // (e.g. navigating A -> B -> A in a multi-image message) doesn't re-fetch
  // the full-res signed URL over the network every time.
  const fullUrlCacheRef = useRef(new Map());

  const resolveSignedUrl = useCallback(
    async (file) => {
      const cached = fullUrlCacheRef.current.get(file.id);
      if (cached) return cached;
      // The embedded URL from listMessages is the small `card` variant (see
      // Plan A) — the viewer always needs the full-resolution image, so it
      // fetches it explicitly rather than reusing that URL.
      try {
        const res = await atlas.chat.getAttachmentSignedUrl(file.id, session?.access_token, { variant: "full" });
        const url = res?.data?.url ?? null;
        if (url) fullUrlCacheRef.current.set(file.id, url);
        return url;
      } catch (err) {
        console.warn("[chat] viewer getAttachmentSignedUrl failed", { id: file.id, status: err?.status, msg: err?.message });
        return null;
      }
    },
    [session?.access_token],
  );

  // AdvancedFileViewer expects originalName + sizeBytes
  const files = (attachments ?? []).map((att) => ({
    id: att.id,
    mimeType: att.mimeType,
    originalName: att.fileName,
    sizeBytes: att.sizeBytes,
  }));

  return (
    <AdvancedFileViewer
      open={open}
      onOpenChange={onOpenChange}
      files={files}
      activeIndex={activeIndex ?? 0}
      onIndexChange={onIndexChange}
      onResolveSignedUrl={resolveSignedUrl}
      zIndex={10000}
    />
  );
}
