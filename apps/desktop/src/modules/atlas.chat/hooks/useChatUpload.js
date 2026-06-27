import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// iOS Safari sometimes reports empty file.type for QuickTime videos (.MOV) and other formats.
// Fall back to extension-based detection so the bucket MIME check passes.
const EXT_MIME = {
  mov: "video/quicktime",  mp4: "video/mp4",   m4v: "video/x-m4v",
  avi: "video/x-msvideo", mkv: "video/x-matroska", webm: "video/webm",
  jpg: "image/jpeg",      jpeg: "image/jpeg",  png: "image/png",
  gif: "image/gif",       webp: "image/webp",  heic: "image/heic",
  pdf: "application/pdf",
  mp3: "audio/mpeg",      m4a: "audio/mp4",    ogg: "audio/ogg",
  wav: "audio/wav",       aac: "audio/aac",
  txt: "text/plain",
  zip: "application/zip",
};

function resolveMime(file) {
  if (file.type) return file.type;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return EXT_MIME[ext] ?? "application/octet-stream";
}

export function useChatUpload(conversationId) {
  const { session } = useAuth();

  async function uploadFile(file) {
    const mimeType = resolveMime(file);

    const res = await atlas.chat.presignAttachment(
      {
        conversationId,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      },
      session?.access_token,
    );

    const { attachmentId, uploadUrl } = res.data;

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: file,
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    return attachmentId;
  }

  return { uploadFile };
}
