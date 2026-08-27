import { useCallback, useRef } from "react";
import { AdvancedFileViewer } from "../../atlas.files/components/AdvancedFileViewer";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

// Doubles as the whole conversation's media viewer (opened from any message
// bubble via ChatWindow/MiniChatWindow's global attachments list — see
// buildAllAttachments in chatUtils.js), so paging through it walks every
// file ever shared in the chat, not just the ones attached to the message
// that was clicked — real attachments AND file-type entity references
// together. Each entry resolves through whichever endpoint actually owns its
// record: entity refs (`isEntityRef: true`) live in atlas.files and use the
// generic files signed-url endpoint; real attachments live in
// chat_attachments and use the chat-specific one. Callers that only ever
// pass real attachments (e.g. ConversationMediaTab.jsx) are unaffected —
// `isEntityRef` is simply absent/falsy for every entry there.
export function ChatAttachmentViewer({ open, onOpenChange, attachments, activeIndex, onIndexChange }) {
  const { session } = useAuth();
  const token = session?.access_token;
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
        const url = file.isEntityRef
          ? (await atlas.files.getSignedUrl(file.id, token, { variant: "full" }))?.data?.signedUrl ?? null
          : (await atlas.chat.getAttachmentSignedUrl(file.id, token, { variant: "full" }))?.data?.url ?? null;
        if (url) fullUrlCacheRef.current.set(file.id, url);
        return url;
      } catch (err) {
        console.warn("[chat] viewer resolveSignedUrl failed", { id: file.id, isEntityRef: file.isEntityRef, status: err?.status, msg: err?.message });
        return null;
      }
    },
    [token],
  );

  // AdvancedFileViewer expects originalName + sizeBytes
  const files = (attachments ?? []).map((att) => ({
    id: att.id,
    mimeType: att.mimeType,
    originalName: att.fileName,
    sizeBytes: att.sizeBytes,
    isEntityRef: att.isEntityRef ?? false,
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
