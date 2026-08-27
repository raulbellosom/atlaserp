// apps/desktop/src/modules/atlas.chat/hooks/useFileRefSignedUrl.js
// Resolves a signed URL for an arbitrary company file by id, through the
// generic files-module endpoint (GET /files/:id/signed-url) — used wherever
// a chat entity reference (file attachment, HR employee photo, etc.) needs
// to preview or download a file that ISN'T a chat_attachments row, so the
// chat-specific getAttachmentSignedUrl endpoint doesn't apply.
//
// Extracted out of FileReferenceAttachment.jsx (its original home) into its
// own module once a third consumer (EntityReferenceCard.jsx, for HR employee
// avatars) needed it too — three components importing this straight from
// each other would have compounded an already-flagged fragile cross-import
// between ChatFilesGallery.jsx and FileReferenceAttachment.jsx.
import { useQuery } from "@tanstack/react-query";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

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
