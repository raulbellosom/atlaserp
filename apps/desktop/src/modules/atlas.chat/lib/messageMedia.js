// apps/desktop/src/modules/atlas.chat/lib/messageMedia.js
import { isImageMime, isVideoMime, isAudioAttachment } from "./chatUtils.js";

// True when a caption should share ONE bubble with the message's attachments
// (WhatsApp/Telegram style): every attachment is an image, OR the message has
// exactly one video (and it is not a voice note whose mime was mis-typed to
// video/* on upload). Every other mix keeps the stacked layout.
export function isMergeableMediaMessage(attachments) {
  const atts = attachments ?? [];
  if (atts.length === 0) return false;
  if (atts.every((a) => isImageMime(a.mimeType))) return true;
  if (atts.length === 1 && isVideoMime(atts[0].mimeType) && !isAudioAttachment(atts[0])) return true;
  return false;
}
