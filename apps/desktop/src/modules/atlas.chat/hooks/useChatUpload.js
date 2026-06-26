import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

export function useChatUpload(conversationId) {
  const { session } = useAuth();

  async function uploadFile(file) {
    const res = await atlas.chat.presignAttachment(
      {
        conversationId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      },
      session?.access_token,
    );

    const { attachmentId, uploadUrl } = res.data;

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    return attachmentId;
  }

  return { uploadFile };
}
