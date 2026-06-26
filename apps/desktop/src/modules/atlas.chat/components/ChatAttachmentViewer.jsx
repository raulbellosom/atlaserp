import { useCallback } from "react";
import { AdvancedFileViewer } from "../../atlas.files/components/AdvancedFileViewer";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

export function ChatAttachmentViewer({ open, onOpenChange, attachments, activeIndex, onIndexChange }) {
  const { session } = useAuth();

  const resolveSignedUrl = useCallback(
    async (file) => {
      try {
        const res = await atlas.chat.getAttachmentSignedUrl(file.id, session?.access_token);
        return res?.data?.url ?? null;
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
    />
  );
}
